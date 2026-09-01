import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { matchesGmailWatch } from '../gmail/matcher.js';
import { collectHistoryMessages, processGmailHistory } from '../gmail/processor.js';
import { GmailWatchStore } from '../gmail/store.js';
import { GmailMessage } from '../gmail/types.js';

const origin = { platform: 'telegram', chatId: '-1001', chatType: 'group', threadId: '42' };

async function store(): Promise<GmailWatchStore> {
  const dir = await mkdtemp(join(tmpdir(), 'gmail-watch-'));
  return new GmailWatchStore(join(dir, 'state.json'));
}

function message(overrides: Partial<GmailMessage> = {}): GmailMessage {
  return {
    id: 'm1', threadId: 't1', labelIds: ['INBOX'], snippet: 'hello',
    payload: { headers: [
      { name: 'From', value: 'Alice <alice@example.com>' },
      { name: 'To', value: 'Me <me@example.com>' },
      { name: 'Subject', value: 'Concert details' },
    ] },
    ...overrides,
  };
}

describe('Gmail logical watches', () => {
  it('matches thread watches only in the exact Gmail thread', async () => {
    const s = await store();
    const watch = await s.create({
      accountId: 'a', accountEmail: 'me@example.com', matchMode: 'thread', gmailThreadId: 't1',
      objective: 'wait', origin, wakeUrl: 'http://localhost/wake', wakeSecret: 'secret',
    });
    expect(matchesGmailWatch(watch, message())).toBe(true);
    expect(matchesGmailWatch(watch, message({ threadId: 'other' }))).toBe(false);
  });

  it('matches exact correspondents by direction, not display name', async () => {
    const s = await store();
    const watch = await s.create({
      accountId: 'a', accountEmail: 'me@example.com', matchMode: 'correspondent',
      correspondents: ['alice@example.com'], direction: 'from', objective: 'wait', origin,
      wakeUrl: 'http://localhost/wake', wakeSecret: 'secret',
    });
    expect(matchesGmailWatch(watch, message())).toBe(true);
    expect(matchesGmailWatch(watch, message({ payload: { headers: [
      { name: 'From', value: 'Alice <other@example.com>' }, { name: 'To', value: 'me@example.com' },
    ] } }))).toBe(false);
  });

  it('keeps correspondent direction filtering after send-and-watch binds to a thread', async () => {
    const s = await store();
    const watch = await s.create({
      accountId: 'a', accountEmail: 'me@example.com', matchMode: 'correspondent',
      correspondents: ['alice@example.com'], direction: 'from', objective: 'wait', origin,
      wakeUrl: 'http://localhost/wake', wakeSecret: 'secret',
    });
    const linked = await s.update(watch.id, { matchMode: 'thread', gmailThreadId: 't1' });
    expect(matchesGmailWatch(linked, message())).toBe(true);
    expect(matchesGmailWatch(linked, message({ payload: { headers: [
      { name: 'From', value: 'Me <me@example.com>' },
      { name: 'To', value: 'Alice <alice@example.com>' },
      { name: 'Subject', value: 'Concert details' },
    ] } }))).toBe(false);
  });

  it('keeps a watch active until explicitly closed', async () => {
    const s = await store();
    const watch = await s.create({
      accountId: 'a', accountEmail: 'me@example.com', matchMode: 'thread', gmailThreadId: 't1',
      objective: 'wait', origin, wakeUrl: 'http://localhost/wake', wakeSecret: 'secret',
    });
    expect((await s.list()).map((item) => item.id)).toContain(watch.id);
    await s.close(watch.id);
    expect(await s.list()).toHaveLength(0);
  });

  it('paginates Gmail history, deduplicates IDs, bounds gws concurrency, and uses metadata', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const client = {
      history: vi.fn()
        .mockResolvedValueOnce({ history: [{ messagesAdded: [{ message: { id: 'm1' } }, { message: { id: 'm2' } }, { message: { id: 'm3' } }, { message: { id: 'm4' } }, { message: { id: 'm5' } }] }], nextPageToken: 'p2', historyId: '101' })
        .mockResolvedValueOnce({ history: [{ messagesAdded: [{ message: { id: 'm1' } }, { message: { id: 'm6' } }, { message: { id: 'm7' } }, { message: { id: 'm8' } }, { message: { id: 'm9' } }, { message: { id: 'm10' } }] }], historyId: '105' }),
      message: vi.fn(async (id: string, format: string) => {
        inFlight += 1; maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 2));
        inFlight -= 1;
        return message({ id, threadId: id === 'm1' ? 't1' : 't2' });
      }),
    };
    const result = await collectHistoryMessages(client as never, '100');
    expect(result.nextHistoryId).toBe('105');
    expect(result.messages.map((item) => item.id)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10']);
    expect(client.message).toHaveBeenCalledTimes(10);
    expect(client.message).toHaveBeenCalledWith('m10', 'metadata', ['From', 'To', 'Cc', 'Subject', 'Date']);
    expect(maxInFlight).toBeLessThanOrEqual(4);
  });

  it('does not fetch messages when there are no active watches', async () => {
    const client = {
      history: vi.fn().mockResolvedValue({ history: [{ messagesAdded: [{ message: { id: 'm1' } }] }], historyId: '101' }),
      message: vi.fn(),
    };
    const result = await processGmailHistory({
      client: client as never, store: await store(), accountId: 'a', accountEmail: 'me@example.com', startHistoryId: '100',
    });
    expect(result.nextHistoryId).toBe('101');
    expect(result.messageIds).toEqual([]);
    expect(client.message).not.toHaveBeenCalled();
  });
});
