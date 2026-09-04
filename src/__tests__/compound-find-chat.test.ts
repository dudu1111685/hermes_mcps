import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { registerCompoundTools } from '../tools/compound.js';
import { WAHAClient } from '../client.js';

type Handler = (args: Record<string, unknown>) => Promise<CallToolResult>;

function captureTools(client: Pick<WAHAClient, 'get'>): Map<string, Handler> {
  const tools = new Map<string, Handler>();
  const fakeServer = {
    registerTool: (name: string, _meta: unknown, handler: Handler) => tools.set(name, handler),
  } as unknown as McpServer;
  registerCompoundTools(fakeServer, client as WAHAClient);
  return tools;
}

function textOf(result: CallToolResult): string {
  const block = result.content[0];
  if (block.type !== 'text') throw new Error(`expected text block, got ${block.type}`);
  return block.text;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('waha_find_chat directory fallback', () => {
  it('resolves a recently saved contact even when chats overview hangs', async () => {
    vi.useFakeTimers();
    const get = vi.fn((path: string) => {
      if (path === '/api/contacts/all') {
        return Promise.resolve([
          {
            id: '972545755545@c.us',
            name: 'גגו לקוח קדמה יזם נדלן',
            pushname: 'Gago Klugman',
          },
        ]);
      }
      if (path.endsWith('/chats/overview')) return new Promise(() => undefined);
      return Promise.reject(new Error(`unexpected path ${path}`));
    });
    const tools = captureTools({ get } as unknown as Pick<WAHAClient, 'get'>);

    const pending = tools.get('waha_find_chat')!({
      query: 'גגו לקוח קדמה יזם',
      session: 'hanging-overview-test',
      limit: 5,
    });
    await vi.advanceTimersByTimeAsync(2_500);
    const text = textOf(await pending);

    expect(text).toContain('972545755545@c.us');
    expect(text).toContain('גגו לקוח קדמה יזם נדלן');
    expect(text).toContain('"type":"contact"');
  });

  it('still includes chat and group matches when overview responds quickly', async () => {
    const get = vi.fn((path: string) => {
      if (path === '/api/contacts/all') return Promise.resolve([]);
      if (path.endsWith('/chats/overview')) {
        return Promise.resolve([
          { id: '120363000000000000@g.us', name: 'קדמה צוות', isGroup: true, timestamp: 1_788_000_000 },
        ]);
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });
    const tools = captureTools({ get } as unknown as Pick<WAHAClient, 'get'>);

    const text = textOf(await tools.get('waha_find_chat')!({
      query: 'קדמה',
      session: 'fast-overview-test',
      limit: 5,
    }));

    expect(text).toContain('120363000000000000@g.us');
    expect(text).toContain('"type":"group"');
  });
});
