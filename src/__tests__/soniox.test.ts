import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { transcribeAudio, transcribeWithCache, isConfigured } from '../utils/soniox.js';

interface RecordedCall {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'mock',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

/**
 * Routing fetch mock for the Soniox API.
 * `pollStatuses` is consumed one entry per GET /v1/transcriptions/:id poll.
 */
function installSonioxFetch(pollStatuses: Array<{ status: string; error_message?: string }>) {
  const calls: RecordedCall[] = [];
  let pollIndex = 0;

  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.replace('https://api.soniox.com', '');
    const method = init?.method ?? 'GET';
    calls.push({
      method,
      path,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body,
    });

    if (method === 'DELETE') return jsonResponse({});
    if (method === 'POST' && path === '/v1/files') return jsonResponse({ id: 'file-1' });
    if (method === 'POST' && path === '/v1/transcriptions') return jsonResponse({ id: 'tr-1' });
    if (method === 'GET' && path === '/v1/transcriptions/tr-1/transcript') {
      return jsonResponse({ text: 'shalom world' });
    }
    if (method === 'GET' && path === '/v1/transcriptions/tr-1') {
      const status = pollStatuses[Math.min(pollIndex, pollStatuses.length - 1)];
      pollIndex += 1;
      return jsonResponse(status);
    }
    throw new Error(`Unexpected Soniox call: ${method} ${path}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

function deleteCalls(calls: RecordedCall[]): string[] {
  return calls.filter((c) => c.method === 'DELETE').map((c) => c.path);
}

describe('soniox', () => {
  beforeEach(() => {
    process.env.SONIOX_API_KEY = 'test-soniox-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SONIOX_API_KEY;
  });

  describe('isConfigured', () => {
    it('reflects presence of SONIOX_API_KEY', () => {
      expect(isConfigured()).toBe(true);
      delete process.env.SONIOX_API_KEY;
      expect(isConfigured()).toBe(false);
    });
  });

  describe('transcribeAudio', () => {
    it('throws immediately when SONIOX_API_KEY is not set', async () => {
      delete process.env.SONIOX_API_KEY;
      await expect(transcribeAudio(Buffer.from('x'))).rejects.toThrow(
        'SONIOX_API_KEY not set',
      );
    });

    it(
      'runs the full happy flow: upload → create → poll → transcript → both cleanup DELETEs',
      async () => {
        // One "processing" poll exercises the 1s sleep loop, then completes.
        const { calls } = installSonioxFetch([{ status: 'processing' }, { status: 'completed' }]);

        const text = await transcribeAudio(Buffer.from('fake-ogg-bytes'), {
          messageId: 'msg-42',
          languageHints: ['he'],
        });

        expect(text).toBe('shalom world');

        // Order: upload, create, poll(s), transcript, then cleanup.
        const sequence = calls.map((c) => `${c.method} ${c.path}`);
        expect(sequence).toEqual([
          'POST /v1/files',
          'POST /v1/transcriptions',
          'GET /v1/transcriptions/tr-1',
          'GET /v1/transcriptions/tr-1',
          'GET /v1/transcriptions/tr-1/transcript',
          'DELETE /v1/transcriptions/tr-1',
          'DELETE /v1/files/file-1',
        ]);

        // Auth header present on every call.
        for (const call of calls) {
          expect(call.headers.Authorization).toBe('Bearer test-soniox-key');
        }

        // Transcription creation payload references the uploaded file.
        const create = calls.find((c) => c.method === 'POST' && c.path === '/v1/transcriptions');
        const payload = JSON.parse(create!.body as string);
        expect(payload.file_id).toBe('file-1');
        expect(payload.model).toBe('stt-async-v4');
        expect(payload.language_hints).toEqual(['he']);
      },
      10_000,
    );

    it('propagates error_message on error status and still runs both cleanup DELETEs', async () => {
      const { calls } = installSonioxFetch([
        { status: 'error', error_message: 'audio is corrupted' },
      ]);

      await expect(transcribeAudio(Buffer.from('bad'))).rejects.toThrow(
        'Soniox transcription failed: audio is corrupted',
      );

      expect(deleteCalls(calls)).toEqual(['/v1/transcriptions/tr-1', '/v1/files/file-1']);
    });

    it('falls back to "unknown error" when error status has no message, and cleans up', async () => {
      const { calls } = installSonioxFetch([{ status: 'error' }]);

      await expect(transcribeAudio(Buffer.from('bad'))).rejects.toThrow(
        'Soniox transcription failed: unknown error',
      );
      expect(deleteCalls(calls)).toEqual(['/v1/transcriptions/tr-1', '/v1/files/file-1']);
    });

    it('cleans up the uploaded file even when transcription creation fails', async () => {
      const calls: RecordedCall[] = [];
      const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
        const path = String(input).replace('https://api.soniox.com', '');
        const method = init?.method ?? 'GET';
        calls.push({ method, path, headers: {} });
        if (method === 'POST' && path === '/v1/files') return jsonResponse({ id: 'file-9' });
        if (method === 'POST' && path === '/v1/transcriptions') {
          return jsonResponse({ message: 'quota exceeded' }, 429);
        }
        if (method === 'DELETE') return jsonResponse({});
        throw new Error(`Unexpected call: ${method} ${path}`);
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(transcribeAudio(Buffer.from('x'))).rejects.toThrow(
        'Soniox API error (429)',
      );
      // No transcription id was obtained — only the file DELETE runs.
      expect(deleteCalls(calls)).toEqual(['/v1/files/file-9']);
    });
  });

  describe('transcribeWithCache', () => {
    it('caches by messageId and does not call fetchAudio or fetch again', async () => {
      installSonioxFetch([{ status: 'completed' }]);
      const fetchAudio = vi.fn(async () => Buffer.from('voice-note'));

      const first = await transcribeWithCache('cache-test-msg-1', fetchAudio);
      expect(first).toBe('shalom world');
      expect(fetchAudio).toHaveBeenCalledTimes(1);

      // Second call: any network or audio fetch is a failure.
      const forbiddenFetch = vi.fn(async () => {
        throw new Error('fetch must not be called on cache hit');
      });
      vi.stubGlobal('fetch', forbiddenFetch);

      const second = await transcribeWithCache('cache-test-msg-1', fetchAudio);
      expect(second).toBe('shalom world');
      expect(fetchAudio).toHaveBeenCalledTimes(1);
      expect(forbiddenFetch).not.toHaveBeenCalled();
    });

    it('different messageIds are cached independently', async () => {
      installSonioxFetch([{ status: 'completed' }]);
      const fetchAudio = vi.fn(async () => Buffer.from('voice-note'));

      await transcribeWithCache('cache-test-msg-2', fetchAudio);
      expect(fetchAudio).toHaveBeenCalledTimes(1);

      installSonioxFetch([{ status: 'completed' }]);
      await transcribeWithCache('cache-test-msg-3', fetchAudio);
      expect(fetchAudio).toHaveBeenCalledTimes(2);
    });
  });
});
