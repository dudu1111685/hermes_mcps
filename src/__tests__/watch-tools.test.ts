import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { WAHAClient } from '../client.js';
import { registerWatchTools } from '../tools/watches.js';
import { WatchStore } from '../watch/store.js';

type Handler = (args: Record<string, unknown>) => Promise<CallToolResult>;

function capture(client: Partial<WAHAClient>, store: WatchStore): Map<string, Handler> {
  const tools = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _meta: unknown, handler: Handler) => tools.set(name, handler),
  } as unknown as McpServer;
  registerWatchTools(server, client as WAHAClient, store);
  return tools;
}

function textOf(result: CallToolResult): string {
  const item = result.content[0];
  if (item.type !== 'text') throw new Error('expected text');
  return item.text;
}

describe('watch MCP tools', () => {
  it('preserves existing session webhooks while adding the listener', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'waha-watch-tools-'));
    const store = new WatchStore(join(dir, 'watches.json'));
    const get = vi.fn().mockResolvedValue({
      name: 'default', status: 'WORKING',
      config: { noweb: { store: { enabled: true } }, webhooks: [{ url: 'http://timeline/waha', events: ['message'] }] },
    });
    const put = vi.fn().mockResolvedValue({});
    const tools = capture({ get, put }, store);
    const result = await tools.get('waha_watch_chat')!({
      session: 'default', chatId: '123@c.us', objective: 'finish this conversation',
      allowedSenders: [], permissions: ['reply'], wakeUrl: 'http://hermes:8644/webhooks/watch',
      wakeSecret: 'secret', expiresAt: undefined,
      _hermesOrigin: { platform: 'telegram', chatId: '-1001', chatType: 'group', threadId: '42' },
    });
    expect(textOf(result)).toContain('Watch opened without sending a message');
    const update = put.mock.calls[0][1] as {
      config: { webhooks: Array<{ url: string }>; noweb: unknown };
    };
    expect(update.config.webhooks.map((webhook) => webhook.url)).toEqual([
      'http://timeline/waha', 'http://127.0.0.1:8793/waha',
    ]);
    expect(update.config.noweb).toEqual({ store: { enabled: true } });
    expect(Object.keys(update)).toEqual(['config']);
  });

  it('can send one text and open a persistent watch in one race-safe call', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'waha-watch-tools-'));
    const store = new WatchStore(join(dir, 'watches.json'));
    const get = vi.fn().mockResolvedValue({ name: 'default', status: 'WORKING', config: {} });
    const put = vi.fn().mockResolvedValue({});
    const post = vi.fn().mockResolvedValue({ id: 'sent-message-1' });
    const tools = capture({ get, put, post }, store);
    const result = await tools.get('waha_send_text_and_watch')!({
      session: 'default', chatId: '123@c.us', text: 'Please send the details',
      objective: 'collect the complete answer', allowedSenders: [], permissions: ['read'],
      wakeUrl: 'http://hermes:8644/webhooks/watch', wakeSecret: 'secret', expiresAt: undefined,
      _hermesOrigin: { platform: 'telegram', chatId: '-1001', chatType: 'group', threadId: '42' },
    });
    expect(post).toHaveBeenCalledWith('/api/sendText', {
      session: 'default', chatId: '123@c.us', text: 'Please send the details',
    });
    expect(textOf(result)).toContain('Sent and watch active');
    expect(textOf(result)).toContain('sent-message-1');
    const active = await store.list({ includeClosed: false });
    expect(active).toHaveLength(1);
    expect(active[0].objective).toBe('collect the complete answer');
  });

  it('closes the newly created watch when the combined send fails', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'waha-watch-tools-'));
    const store = new WatchStore(join(dir, 'watches.json'));
    const get = vi.fn().mockResolvedValue({ name: 'default', status: 'WORKING', config: {} });
    const put = vi.fn().mockResolvedValue({});
    const post = vi.fn().mockRejectedValue(new Error('send failed'));
    const tools = capture({ get, put, post }, store);
    const result = await tools.get('waha_send_text_and_watch')!({
      session: 'default', chatId: '123@c.us', text: 'Please reply',
      objective: 'collect answer', allowedSenders: [], permissions: [],
      wakeUrl: 'http://hermes:8644/webhooks/watch', wakeSecret: 'secret', expiresAt: undefined,
      _hermesOrigin: { platform: 'telegram', chatId: '-1001', chatType: 'group' },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('send failed');
    expect(await store.list({ includeClosed: false })).toHaveLength(0);
    expect(await store.list({ includeClosed: true })).toHaveLength(1);
  });
});
