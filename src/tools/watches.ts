import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WAHAClient } from '../client.js';
import { SendResult, SessionInfo, WebhookConfig } from '../types.js';
import { defineTool } from '../utils/define-tool.js';
import { compactJson, listResponse, messageIdOf } from '../utils/format.js';
import { sessionParam } from '../utils/session.js';
import { throttleSend } from '../utils/throttle.js';
import { WatchStore } from '../watch/store.js';
import { ChatWatch, WatchOrigin } from '../watch/types.js';

function publicWatch(watch: ChatWatch): Record<string, unknown> {
  const { wakeSecret: _secret, ...safe } = watch;
  return safe;
}

function listenerUrl(): string {
  return (process.env.WAHA_WATCH_LISTENER_URL || 'http://127.0.0.1:8793/waha').trim();
}

function listenerHmacKey(): string | undefined {
  const value = process.env.WAHA_WATCH_INBOUND_SECRET?.trim();
  return value || undefined;
}

const originSchema = z.object({
  platform: z.string().min(1),
  chatId: z.string().min(1),
  chatType: z.string().min(1),
  threadId: z.string().optional(),
  userId: z.string().optional(),
  userIdAlt: z.string().optional(),
  profile: z.string().optional(),
  scopeId: z.string().optional(),
  sessionId: z.string().optional(),
  sessionKey: z.string().optional(),
});

function watchCreateSchema() {
  return {
    session: sessionParam(),
    chatId: z.string().describe('Exact WhatsApp chat ID, e.g. 9725...@c.us or 120363...@g.us'),
    objective: z.string().min(1).describe('The bounded business goal this conversation serves and its stopping condition'),
    allowedSenders: z.array(z.string()).default([]).describe('Optional exact sender IDs allowed to wake Hermes; empty means any sender in this chat'),
    permissions: z.array(z.string()).default([]).describe('Explicit actions Hermes may take when woken, e.g. read, reply-within-thread, update-sheet'),
    wakeUrl: z.string().url().optional().describe('Hermes webhook route URL. Defaults to WAHA_WATCH_DEFAULT_WAKE_URL.'),
    wakeSecret: z.string().min(1).optional().describe('Hermes route HMAC secret. Defaults to WAHA_WATCH_DEFAULT_WAKE_SECRET.'),
    expiresAt: z.string().optional().describe('Optional ISO-8601 expiry; use for temporary delegated work'),
    _hermesOrigin: originSchema.optional().describe('Reserved Hermes gateway return address; injected automatically by the native MCP client'),
  };
}

type CreateWatchArgs = {
  session: string;
  chatId: string;
  objective: string;
  allowedSenders: string[];
  permissions: string[];
  wakeUrl?: string;
  wakeSecret?: string;
  expiresAt?: string;
  _hermesOrigin?: WatchOrigin;
};

function validateOrigin(origin?: WatchOrigin): WatchOrigin {
  if (!origin) {
    throw new Error('This watch must be created from a live Hermes gateway session so replies can return to the opening session.');
  }
  return origin;
}

function equivalentWebhook(webhook: WebhookConfig, url: string): boolean {
  return webhook.url.replace(/\/+$/, '') === url.replace(/\/+$/, '');
}

async function ensureListenerWebhook(client: WAHAClient, session: string): Promise<'added' | 'present'> {
  const url = listenerUrl();
  const info = await client.get<SessionInfo>(`/api/sessions/${encodeURIComponent(session)}`);
  const config = info.config ?? {};
  const webhooks = [...(config.webhooks ?? [])];
  const index = webhooks.findIndex((webhook) => equivalentWebhook(webhook, url));
  const hmacKey = listenerHmacKey();
  const desired: WebhookConfig = {
    ...(index >= 0 ? webhooks[index] : {}),
    url,
    events: ['message', 'message.any'],
  };
  if (hmacKey) desired.hmac = { key: hmacKey };
  if (index >= 0 && JSON.stringify(webhooks[index]) === JSON.stringify(desired)) return 'present';
  if (index >= 0) webhooks[index] = desired;
  else webhooks.push(desired);
  await client.put(`/api/sessions/${encodeURIComponent(session)}`, {
    config: { ...config, webhooks },
  });
  return index >= 0 ? 'present' : 'added';
}

async function createWatch(
  client: WAHAClient,
  store: WatchStore,
  args: CreateWatchArgs,
): Promise<{ watch: ChatWatch; webhook: 'added' | 'present' }> {
  const resolvedWakeUrl = args.wakeUrl ?? process.env.WAHA_WATCH_DEFAULT_WAKE_URL;
  const resolvedWakeSecret = args.wakeSecret ?? process.env.WAHA_WATCH_DEFAULT_WAKE_SECRET;
  if (!resolvedWakeUrl || !resolvedWakeSecret) {
    throw new Error('wakeUrl/wakeSecret are required, or set WAHA_WATCH_DEFAULT_WAKE_URL and WAHA_WATCH_DEFAULT_WAKE_SECRET.');
  }
  const origin = validateOrigin(args._hermesOrigin);
  const webhook = await ensureListenerWebhook(client, args.session);
  const watch = await store.create({
    session: args.session,
    chatId: args.chatId,
    objective: args.objective,
    allowedSenders: args.allowedSenders,
    permissions: args.permissions,
    origin,
    wakeUrl: resolvedWakeUrl,
    wakeSecret: resolvedWakeSecret,
    expiresAt: args.expiresAt,
  });
  return { watch, webhook };
}

export function registerWatchTools(server: McpServer, client: WAHAClient, store = new WatchStore()): void {
  defineTool(server, {
    name: 'waha_watch_chat',
    description: 'Open a persistent event-driven watch without sending any message. Every new incoming message wakes the opening Hermes session; the watch stays active across multiple messages until Hermes explicitly calls waha_close_chat_watch. One active watch per session+chat.',
    schema: watchCreateSchema(),
    annotations: { idempotentHint: false },
    handler: async ({ session, chatId, objective, allowedSenders, permissions, wakeUrl, wakeSecret, expiresAt, _hermesOrigin }) => {
      const { watch, webhook } = await createWatch(client, store, {
        session, chatId, objective, allowedSenders, permissions, wakeUrl, wakeSecret, expiresAt, _hermesOrigin,
      });
      return `Watch opened without sending a message and remains active across incoming messages until explicitly closed with waha_close_chat_watch; WAHA listener webhook ${webhook}. ${compactJson(publicWatch(watch))}`;
    },
  });

  defineTool(server, {
    name: 'waha_send_text_and_watch',
    description: 'Send one WhatsApp text and open a persistent event-driven watch for replies in one race-safe call. Use this instead of separate send+watch calls when a reply could arrive immediately. The watch stays active across messages until explicitly closed.',
    schema: {
      ...watchCreateSchema(),
      text: z.string().min(1).describe('Text message to send before waiting for replies'),
    },
    annotations: { idempotentHint: false },
    handler: async ({ session, chatId, text, objective, allowedSenders, permissions, wakeUrl, wakeSecret, expiresAt, _hermesOrigin }) => {
      const { watch, webhook } = await createWatch(client, store, {
        session, chatId, objective, allowedSenders, permissions, wakeUrl, wakeSecret, expiresAt, _hermesOrigin,
      });
      try {
        await throttleSend(chatId);
        const sent = await client.post<SendResult>('/api/sendText', { session, chatId, text });
        return `Sent and watch active. messageId=${messageIdOf(sent)}; WAHA listener webhook ${webhook}. Continue listening by default; close with waha_close_chat_watch only when the sender appears finished and the objective is clear. ${compactJson(publicWatch(watch))}`;
      } catch (error) {
        await store.close(watch.id);
        throw new Error(`Message send failed; newly created watch ${watch.id} was closed to avoid an unintended listener. ${(error as Error).message}`);
      }
    },
  });

  defineTool(server, {
    name: 'waha_list_chat_watches',
    description: 'List event-driven WhatsApp chat watches. Secrets are never returned.',
    schema: {
      includeClosed: z.boolean().default(false),
      session: z.string().optional(),
      chatId: z.string().optional(),
    },
    annotations: { readOnlyHint: true },
    handler: async (args) => {
      const watches = await store.list(args);
      return listResponse(watches, { map: publicWatch, label: 'chat watches' });
    },
  });

  defineTool(server, {
    name: 'waha_update_chat_watch',
    description: 'Update an active WhatsApp chat watch without creating another polling loop.',
    schema: {
      watchId: z.string(),
      objective: z.string().min(1).optional(),
      allowedSenders: z.array(z.string()).optional(),
      permissions: z.array(z.string()).optional(),
      wakeUrl: z.string().url().optional(),
      wakeSecret: z.string().min(1).optional(),
      expiresAt: z.string().optional().describe('ISO-8601 expiry; empty string clears expiry'),
    },
    annotations: { idempotentHint: true },
    handler: async ({ watchId, ...changes }) => {
      const watch = await store.update(watchId, changes);
      return `Watch updated. ${compactJson(publicWatch(watch))}`;
    },
  });

  defineTool(server, {
    name: 'waha_close_chat_watch',
    description: 'Explicitly close a WhatsApp chat watch when the sender appears finished and the objective is clear. Future messages in that chat no longer wake Hermes through this watch. Do not close merely because one message arrived.',
    schema: { watchId: z.string() },
    annotations: { idempotentHint: true },
    handler: async ({ watchId }) => {
      const watch = await store.close(watchId);
      return `Watch closed. ${compactJson(publicWatch(watch))}`;
    },
  });
}
