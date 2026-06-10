import { afterEach, describe, expect, it } from 'vitest';
import { resetThrottle, throttleGroupOp, throttleSend } from '../utils/throttle.js';

afterEach(() => resetThrottle());

describe('throttleSend', () => {
  it('first send passes immediately', async () => {
    const start = Date.now();
    await throttleSend('a@c.us');
    expect(Date.now() - start).toBeLessThan(200);
  });

  it('second send to the same chat waits at least the per-chat gap', async () => {
    await throttleSend('a@c.us');
    const start = Date.now();
    await throttleSend('a@c.us');
    expect(Date.now() - start).toBeGreaterThanOrEqual(3000);
  }, 20_000);
});

describe('throttleGroupOp', () => {
  it('first group op passes immediately', async () => {
    const start = Date.now();
    await throttleGroupOp();
    expect(Date.now() - start).toBeLessThan(200);
  });

  it('immediate second group op throws a retry-hint error (120s gap > inline wait cap)', async () => {
    await throttleGroupOp();
    await expect(throttleGroupOp()).rejects.toThrow(/group operations.*spaced/i);
  });
});
