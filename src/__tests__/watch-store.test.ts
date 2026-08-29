import { chmod, mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WatchStore } from '../watch/store.js';

describe('WatchStore', () => {
  it('creates, lists, updates and closes a watch without exposing extra active entries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'waha-watch-'));
    const path = join(dir, 'watches.json');
    const store = new WatchStore(path);
    const created = await store.create({
      session: 'default',
      chatId: '123@c.us',
      objective: 'Finish invoice clarification and close when confirmed',
      allowedSenders: ['123@c.us', '123@c.us'],
      permissions: ['read', 'reply-within-thread'],
      origin: { platform: 'telegram', chatId: '-1001', chatType: 'group', threadId: '42' },
      wakeUrl: 'http://127.0.0.1:8644/webhooks/waha-watch',
      wakeSecret: 'secret',
    });
    expect((await store.list()).map((watch) => watch.id)).toEqual([created.id]);
    await expect(store.create({
      session: 'default', chatId: '123@c.us', objective: 'duplicate',
      origin: { platform: 'telegram', chatId: '-1001', chatType: 'group', threadId: '42' },
      wakeUrl: 'http://127.0.0.1:8644/webhooks/waha-watch', wakeSecret: 'secret',
    })).rejects.toThrow('already exists');

    const updated = await store.update(created.id, { objective: 'Updated objective' });
    expect(updated.objective).toBe('Updated objective');
    await store.close(created.id);
    expect(await store.list()).toEqual([]);
    expect((await store.list({ includeClosed: true }))[0].status).toBe('closed');
    expect((await stat(path)).mode & 0o077).toBe(0);
    expect(JSON.parse(await readFile(path, 'utf8')).version).toBe(1);
  });

  it('filters expired watches from active matches', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'waha-watch-'));
    const store = new WatchStore(join(dir, 'watches.json'));
    await store.create({
      session: 'default', chatId: '1@c.us', objective: 'expired',
      origin: { platform: 'telegram', chatId: '-1001', chatType: 'group' },
      wakeUrl: 'http://localhost/hook', wakeSecret: 'secret', expiresAt: '2000-01-01T00:00:00Z',
    });
    expect(await store.activeMatches('default', '1@c.us')).toEqual([]);
  });
});
