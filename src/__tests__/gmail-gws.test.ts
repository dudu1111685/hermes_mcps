import { describe, expect, it } from 'vitest';
import { GwsClient } from '../gmail/gws.js';

describe('GwsClient live account adapter', () => {
  it('reuses the existing authenticated gws account', async () => {
    const profile = await new GwsClient({ timeoutMs: 30_000 }).profile();
    expect(profile.emailAddress).toMatch(/@/);
    expect(profile.historyId).toMatch(/^\d+$/);
  }, 40_000);
});
