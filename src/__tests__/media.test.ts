import { describe, it, expect, vi } from 'vitest';
import { readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { sep } from 'node:path';
import { downloadMedia, saveToTemp } from '../utils/media.js';
import type { WAHAClient } from '../client.js';

function fakeClient(data: Buffer, contentType = 'audio/ogg'): WAHAClient {
  return {
    download: vi.fn(async () => ({ data, contentType })),
  } as unknown as WAHAClient;
}

describe('downloadMedia', () => {
  it('returns data, mimetype and size for media within the limit', async () => {
    const data = Buffer.from('small audio');
    const client = fakeClient(data);

    const result = await downloadMedia(client, 'http://waha/api/files/a.ogg');

    expect(result.data).toBe(data);
    expect(result.mimetype).toBe('audio/ogg');
    expect(result.sizeBytes).toBe(data.length);
    // maxBytes is forwarded so the size cap applies during streaming, not after.
    expect(client.download).toHaveBeenCalledWith('http://waha/api/files/a.ogg', 64 * 1024 * 1024);
  });

  it('throws a size-cap error when media exceeds maxBytes', async () => {
    const client = fakeClient(Buffer.alloc(10));

    await expect(
      downloadMedia(client, 'http://waha/api/files/big.mp4', { maxBytes: 5 }),
    ).rejects.toThrow('Media too large: 10 bytes (limit 5). Refusing to process.');
  });

  it('accepts media exactly at the limit', async () => {
    const client = fakeClient(Buffer.alloc(5));
    const result = await downloadMedia(client, 'u', { maxBytes: 5 });
    expect(result.sizeBytes).toBe(5);
  });
});

describe('saveToTemp', () => {
  it('writes the buffer to a temp file with the given extension', async () => {
    const data = Buffer.from('voice note bytes');

    const path = await saveToTemp(data, '.ogg');

    expect(path.startsWith(tmpdir() + sep)).toBe(true);
    expect(path).toContain(`${sep}waha-mcp${sep}`);
    expect(path.endsWith('.ogg')).toBe(true);
    expect((await stat(path)).isFile()).toBe(true);
    expect(await readFile(path)).toEqual(data);
  });

  it('prepends a dot when the extension has none', async () => {
    const path = await saveToTemp(Buffer.from('x'), 'png');
    expect(path.endsWith('.png')).toBe(true);
    expect(path.endsWith('..png')).toBe(false);
  });

  it('generates unique paths per call', async () => {
    const a = await saveToTemp(Buffer.from('a'), 'txt');
    const b = await saveToTemp(Buffer.from('b'), 'txt');
    expect(a).not.toBe(b);
  });
});
