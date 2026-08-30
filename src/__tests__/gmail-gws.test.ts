import { describe, expect, it } from 'vitest';
import { GwsClient } from '../gmail/gws.js';

describe('GwsClient live account adapter', () => {
  it('reuses the existing authenticated gws account', async () => {
    const profile = await new GwsClient({ timeoutMs: 30_000 }).profile();
    expect(profile.emailAddress).toMatch(/@/);
    expect(profile.historyId).toMatch(/^\d+$/);
  }, 40_000);

  it('returns the complete message object rather than the final nested JSON object', async () => {
    const client = new GwsClient({ timeoutMs: 30_000 });
    const page = await client.history('1518776');
    const messageId = page.history?.flatMap((record) => record.messagesAdded ?? [])
      .map((item) => item.message?.id).find(Boolean);
    expect(messageId).toBeTruthy();
    const message = await client.message(messageId, 'full');
    expect(message.id).toBe(messageId);
    expect(message.threadId).toBeTruthy();
    expect(message.payload?.headers).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'From' }),
    ]));
  }, 40_000);
});
