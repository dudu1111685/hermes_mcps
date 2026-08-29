import { createServer } from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startWatchListener } from '../watch-listener.js';
import { WatchStore } from '../watch/store.js';

const servers: Array<ReturnType<typeof createServer>> = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function listen(server: ReturnType<typeof createServer>): Promise<number> {
  server.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  return (server.address() as { port: number }).port;
}

describe('WAHA watch listener', () => {
  it('wakes Hermes once for a watched incoming message and forwards a stable request id', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'waha-listener-'));
    const store = new WatchStore(join(dir, 'watches.json'));
    let wakeCount = 0;
    let requestId = '';
    let wakeBody: Record<string, unknown> = {};
    const hermes = createServer(async (request, response) => {
      wakeCount += 1;
      requestId = String(request.headers['x-request-id']);
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      wakeBody = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end('{"status":"accepted"}');
    });
    const hermesPort = await listen(hermes);
    const watch = await store.create({
      session: 'default', chatId: '123@c.us', objective: 'finish the task',
      origin: { platform: 'telegram', chatId: '-1001', chatType: 'group', threadId: '42' },
      wakeUrl: `http://127.0.0.1:${hermesPort}/webhooks/watch`, wakeSecret: 'secret',
    });
    const listener = startWatchListener({
      host: '127.0.0.1', port: 0, path: '/waha', maxBodyBytes: 1_000_000,
      wakeTimeoutMs: 2000, store,
    });
    servers.push(listener);
    await new Promise<void>((resolve) => listener.once('listening', resolve));
    const port = (listener.address() as { port: number }).port;
    const payload = {
      event: 'message', session: 'default',
      payload: { id: 'message-1', timestamp: 1, from: '123@c.us', to: 'me@c.us', fromMe: false, body: 'reply' },
    };
    const result = await fetch(`http://127.0.0.1:${port}/waha`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    expect(result.status).toBe(200);
    expect((await result.json()).status).toBe('woken');
    expect(wakeCount).toBe(1);
    expect(requestId).toBe(`${watch.id}:message-1`);
    expect(wakeBody.event_type).toBe('waha.chat_watch.message');
    expect(JSON.stringify(wakeBody)).not.toContain('wakeSecret');
  });

  it('ignores own and unwatched messages without waking Hermes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'waha-listener-'));
    const store = new WatchStore(join(dir, 'watches.json'));
    const listener = startWatchListener({
      host: '127.0.0.1', port: 0, path: '/waha', maxBodyBytes: 1_000_000,
      wakeTimeoutMs: 1000, store,
    });
    servers.push(listener);
    await new Promise<void>((resolve) => listener.once('listening', resolve));
    const port = (listener.address() as { port: number }).port;
    const response = await fetch(`http://127.0.0.1:${port}/waha`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'message', session: 'default', payload: { id: 'm', from: 'x@c.us', fromMe: false } }),
    });
    expect((await response.json()).reason).toBe('no_watch');
  });
});
