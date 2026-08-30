import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { registerGmailTools } from '../gmail/tools.js';
import { GmailWatchStore } from '../gmail/store.js';

process.env.GMAIL_WATCH_DEFAULT_WAKE_URL = 'http://127.0.0.1:8644/webhooks/gmail-watch';
process.env.GMAIL_WATCH_DEFAULT_WAKE_SECRET = 'secret';

type Handler = (args: Record<string, any>) => Promise<CallToolResult>;

function capture(client: any, store: GmailWatchStore): Map<string, Handler> {
  const tools = new Map<string, Handler>();
  const server = { registerTool: (name: string, _meta: unknown, handler: Handler) => tools.set(name, handler) } as unknown as McpServer;
  registerGmailTools(server, client, store);
  return tools;
}

function text(result: CallToolResult): string {
  const item = result.content[0];
  if (item.type !== 'text') throw new Error('text expected');
  return item.text;
}

const origin = { platform: 'telegram', chatId: '-1001', chatType: 'group' };

describe('Gmail MCP tools', () => {
  it('sends without creating a watch', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gmail-tools-'));
    const store = new GmailWatchStore(join(dir, 'state.json'));
    const client = { profile: vi.fn(), sendText: vi.fn().mockResolvedValue({ id: 'm1', threadId: 't1' }) };
    const tools = capture(client, store);
    const result = await tools.get('gmail_send')!({ to: ['a@example.com'], subject: 's', body: 'b', cc: [], bcc: [] });
    expect(text(result)).toContain('Sent without watch');
    expect(await store.list()).toHaveLength(0);
  });

  it('opens watch without sending', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gmail-tools-'));
    const store = new GmailWatchStore(join(dir, 'state.json'));
    const client = { profile: vi.fn().mockResolvedValue({ emailAddress: 'me@example.com', historyId: '1' }), sendText: vi.fn() };
    const tools = capture(client, store);
    const result = await tools.get('gmail_watch')!({
      matchMode: 'correspondent', correspondents: ['a@example.com'], direction: 'from',
      labelIds: [], objective: 'wait', permissions: [], _hermesOrigin: origin,
    });
    expect(text(result)).toContain('Watch opened without sending');
    expect(client.sendText).not.toHaveBeenCalled();
    expect(await store.list()).toHaveLength(1);
  });

  it('opens before send and binds successful send to its Gmail thread', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gmail-tools-'));
    const store = new GmailWatchStore(join(dir, 'state.json'));
    const client = {
      profile: vi.fn().mockResolvedValue({ emailAddress: 'me@example.com', historyId: '1' }),
      sendText: vi.fn().mockResolvedValue({ id: 'm1', threadId: 't1' }),
    };
    const tools = capture(client, store);
    const result = await tools.get('gmail_send_and_watch')!({
      to: ['a@example.com'], subject: 's', body: 'b', cc: [], bcc: [], correspondents: [],
      objective: 'wait', permissions: [], direction: 'from', labelIds: [], _hermesOrigin: origin,
    });
    expect(text(result)).toContain('Sent and watch active');
    const watches = await store.list();
    expect(watches[0].matchMode).toBe('thread');
    expect(watches[0].gmailThreadId).toBe('t1');
    expect(watches[0].sentMessageId).toBe('m1');
  });

  it('closes the provisional watch if send fails', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gmail-tools-'));
    const store = new GmailWatchStore(join(dir, 'state.json'));
    const client = {
      profile: vi.fn().mockResolvedValue({ emailAddress: 'me@example.com', historyId: '1' }),
      sendText: vi.fn().mockRejectedValue(new Error('send failed')),
    };
    const tools = capture(client, store);
    const result = await tools.get('gmail_send_and_watch')!({
      to: ['a@example.com'], subject: 's', body: 'b', cc: [], bcc: [], correspondents: [],
      objective: 'wait', permissions: [], direction: 'from', labelIds: [], _hermesOrigin: origin,
    });
    expect(result.isError).toBe(true);
    expect(await store.list()).toHaveLength(0);
  });
});
