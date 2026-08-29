import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hermesV2Headers, verifyWahaHmac } from '../watch/webhook.js';

describe('watch webhook signatures', () => {
  it('verifies WAHA sha512 HMAC headers', () => {
    const body = Buffer.from('{"event":"message"}');
    const signature = createHmac('sha512', 'secret').update(body).digest('hex');
    expect(verifyWahaHmac(body, {
      'x-webhook-hmac': signature,
      'x-webhook-hmac-algorithm': 'sha512',
    }, 'secret')).toBe(true);
    expect(verifyWahaHmac(body, { 'x-webhook-hmac': 'bad' }, 'secret')).toBe(false);
  });

  it('creates Hermes replay-protected V2 headers and stable request id', () => {
    const body = Buffer.from('{"hello":"world"}');
    const headers = hermesV2Headers(body, 'secret', 'watch:message');
    expect(headers['X-Request-ID']).toBe('watch:message');
    expect(headers['X-Webhook-Timestamp']).toMatch(/^\d+$/);
    const expected = createHmac('sha256', 'secret')
      .update(headers['X-Webhook-Timestamp'])
      .update('.')
      .update(body)
      .digest('hex');
    expect(headers['X-Webhook-Signature-V2']).toBe(expected);
  });
});
