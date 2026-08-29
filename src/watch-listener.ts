#!/usr/bin/env node

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { matchesWatch, resolveChatId, resolveSenderId } from './watch/event.js';
import { WatchStore } from './watch/store.js';
import { hermesV2Headers, verifyWahaHmac } from './watch/webhook.js';
import { ChatWatch, WakePayload, WahaWebhookBody } from './watch/types.js';

export interface WatchListenerOptions {
  host: string;
  port: number;
  path: string;
  maxBodyBytes: number;
  wakeTimeoutMs: number;
  inboundSecret?: string;
  store: WatchStore;
}

export function listenerOptionsFromEnv(): WatchListenerOptions {
  return {
    host: process.env.WAHA_WATCH_HOST || '127.0.0.1',
    port: Number(process.env.WAHA_WATCH_PORT || 8793),
    path: process.env.WAHA_WATCH_PATH || '/waha',
    maxBodyBytes: Number(process.env.WAHA_WATCH_MAX_BODY_BYTES || 1_048_576),
    wakeTimeoutMs: Number(process.env.WAHA_WATCH_WAKE_TIMEOUT_MS || 30_000),
    inboundSecret: process.env.WAHA_WATCH_INBOUND_SECRET?.trim() || undefined,
    store: new WatchStore(),
  };
}

function send(response: ServerResponse, status: number, payload: Record<string, unknown>): void {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(`${JSON.stringify(payload)}\n`);
}

async function readBody(request: IncomingMessage, maxBodyBytes: number): Promise<Buffer> {
  const contentLength = Number(request.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) throw new Error('body_too_large');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const raw of request) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error('body_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function safeWatch(watch: ChatWatch): Omit<ChatWatch, 'wakeSecret'> {
  const { wakeSecret: _secret, ...safe } = watch;
  return safe;
}

async function wake(
  watch: ChatWatch,
  body: WahaWebhookBody,
  chatId: string,
  senderId: string,
  timeoutMs: number,
): Promise<Response> {
  const payload: WakePayload = {
    event_type: 'waha.chat_watch.message',
    watch: safeWatch(watch),
    whatsapp: {
      event: body.event || 'message',
      session: body.session || watch.session,
      chatId,
      senderId,
      message: body.payload || {},
    },
  };
  const bytes = Buffer.from(JSON.stringify(payload));
  const messageId = body.payload?.id || `${body.session}:${chatId}:${body.payload?.timestamp ?? Date.now()}`;
  return fetch(watch.wakeUrl, {
    method: 'POST',
    headers: hermesV2Headers(bytes, watch.wakeSecret, `${watch.id}:${messageId}`),
    body: bytes,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function handleWebhook(
  request: IncomingMessage,
  response: ServerResponse,
  options: WatchListenerOptions = listenerOptionsFromEnv(),
): Promise<void> {
  if (request.method === 'GET' && request.url === '/health') {
    send(response, 200, { status: 'ok', store: options.store.filePath });
    return;
  }
  if (request.method !== 'POST' || request.url !== options.path) {
    send(response, 404, { error: 'not_found' });
    return;
  }

  let bytes: Buffer;
  try {
    bytes = await readBody(request, options.maxBodyBytes);
  } catch (error) {
    send(response, (error as Error).message === 'body_too_large' ? 413 : 400, { error: (error as Error).message });
    return;
  }
  if (!verifyWahaHmac(bytes, request.headers, options.inboundSecret)) {
    send(response, 401, { error: 'invalid_signature' });
    return;
  }

  let body: WahaWebhookBody;
  try {
    body = JSON.parse(bytes.toString('utf8')) as WahaWebhookBody;
  } catch {
    send(response, 400, { error: 'invalid_json' });
    return;
  }
  if (body.event !== 'message' && body.event !== 'message.any') {
    send(response, 200, { status: 'ignored', reason: 'event' });
    return;
  }
  if (!body.session || !body.payload || body.payload.fromMe) {
    send(response, 200, { status: 'ignored', reason: body.payload?.fromMe ? 'from_me' : 'missing_fields' });
    return;
  }
  const chatId = resolveChatId(body);
  const senderId = resolveSenderId(body);
  if (!chatId || !senderId) {
    send(response, 200, { status: 'ignored', reason: 'unresolved_identity' });
    return;
  }

  const watches = (await options.store.activeMatches(body.session, chatId)).filter((watch) => matchesWatch(watch, body));
  if (watches.length === 0) {
    send(response, 200, { status: 'ignored', reason: 'no_watch' });
    return;
  }

  const outcomes = await Promise.all(watches.map(async (watch) => {
    try {
      const result = await wake(watch, body, chatId, senderId, options.wakeTimeoutMs);
      const text = await result.text();
      const outcome = { watchId: watch.id, ok: result.ok, status: result.status, response: text.slice(0, 500) };
      console.error(JSON.stringify({ type: 'wake_outcome', messageId: body.payload?.id, chatId, ...outcome }));
      return outcome;
    } catch (error) {
      const outcome = { watchId: watch.id, ok: false, status: 0, error: (error as Error).message };
      console.error(JSON.stringify({ type: 'wake_outcome', messageId: body.payload?.id, chatId, ...outcome }));
      return outcome;
    }
  }));
  const allOk = outcomes.every((outcome) => outcome.ok);
  send(response, allOk ? 200 : 502, { status: allOk ? 'woken' : 'wake_failed', outcomes });
}

export function startWatchListener(options: WatchListenerOptions = listenerOptionsFromEnv()): ReturnType<typeof createServer> {
  const server = createServer((request, response) => {
    void handleWebhook(request, response, options).catch((error) => {
      console.error('WAHA watch listener error:', error);
      if (!response.headersSent) send(response, 500, { error: 'internal_error' });
      else response.end();
    });
  });
  server.listen(options.port, options.host, () => {
    console.error(`WAHA watch listener running on http://${options.host}:${options.port}${options.path}`);
  });
  return server;
}

const isDirectExecution = process.argv[1]
  && new URL(import.meta.url).pathname === process.argv[1];
if (isDirectExecution) startWatchListener();
