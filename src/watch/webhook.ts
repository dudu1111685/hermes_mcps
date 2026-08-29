import { createHmac, timingSafeEqual } from 'node:crypto';
import { IncomingHttpHeaders } from 'node:http';

export function headerValue(headers: IncomingHttpHeaders, name: string): string {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export function verifyWahaHmac(body: Buffer, headers: IncomingHttpHeaders, secret?: string): boolean {
  if (!secret) return true;
  const provided = headerValue(headers, 'x-webhook-hmac').trim().toLowerCase();
  if (!provided) return false;
  const algorithm = headerValue(headers, 'x-webhook-hmac-algorithm').trim().toLowerCase() || 'sha512';
  if (algorithm !== 'sha512') return false;
  const expected = createHmac('sha512', secret).update(body).digest('hex');
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
}

export function hermesV2Headers(body: Buffer, secret: string, requestId: string): Record<string, string> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', secret)
    .update(timestamp)
    .update('.')
    .update(body)
    .digest('hex');
  return {
    'Content-Type': 'application/json',
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Signature-V2': signature,
    'X-Request-ID': requestId,
  };
}
