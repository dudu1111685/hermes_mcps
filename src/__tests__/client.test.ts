import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WAHAClient, WAHAApiError } from '../client.js';

/** Minimal Response-like mock so we control json()/text() behavior exactly. */
function mockResponse(options: {
  ok?: boolean;
  status?: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
  contentType?: string | null;
  arrayBuffer?: () => Promise<ArrayBuffer>;
}) {
  const {
    ok = true,
    status = 200,
    json = async () => ({}),
    text = async () => '',
    contentType = 'application/json',
    arrayBuffer = async () => new ArrayBuffer(0),
  } = options;
  return {
    ok,
    status,
    json,
    text,
    arrayBuffer,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null),
    },
  } as unknown as Response;
}

function makeClient() {
  // Trailing slashes on baseUrl must be stripped.
  return new WAHAClient({ baseUrl: 'http://waha:3000//', apiKey: 'secret-key' });
}

describe('WAHAClient.request', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds query params, skipping undefined values', async () => {
    fetchMock.mockResolvedValue(mockResponse({ json: async () => ({ ok: 1 }) }));

    await makeClient().get('/api/chats', {
      limit: 20,
      offset: 0,
      archived: false,
      sortBy: 'name',
      skipMe: undefined,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe('http://waha:3000/api/chats');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.get('offset')).toBe('0');
    expect(url.searchParams.get('archived')).toBe('false');
    expect(url.searchParams.get('sortBy')).toBe('name');
    expect(url.searchParams.has('skipMe')).toBe(false);
  });

  it('sends auth and content-type headers and serializes POST body', async () => {
    fetchMock.mockResolvedValue(mockResponse({ json: async () => ({ id: 'x' }) }));

    await makeClient().post('/api/sendText', { chatId: '1@c.us', text: 'hi' });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe('secret-key');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ chatId: '1@c.us', text: 'hi' }));
  });

  it('parses JSON error bodies into WAHAApiError with statusCode', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        ok: false,
        status: 422,
        json: async () => ({ statusCode: 422, message: 'chatId is invalid' }),
      }),
    );

    const err = await makeClient().get('/api/chats').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WAHAApiError);
    expect((err as WAHAApiError).statusCode).toBe(422);
    expect((err as WAHAApiError).message).toBe('WAHA API error (422): chatId is invalid');
  });

  it('falls back to text body when error body is not JSON', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
        text: async () => 'Bad Gateway from nginx',
      }),
    );

    const err = await makeClient().get('/api/chats').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WAHAApiError);
    expect((err as WAHAApiError).statusCode).toBe(502);
    expect((err as WAHAApiError).message).toBe('WAHA API error (502): Bad Gateway from nginx');
  });

  it('falls back to "HTTP <status>" when error body is empty', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError('Unexpected end of JSON input');
        },
        text: async () => '',
      }),
    );

    const err = await makeClient().get('/api/chats').catch((e: unknown) => e);
    expect((err as WAHAApiError).message).toBe('WAHA API error (500): HTTP 500');
  });

  it('maps TimeoutError rejections to a friendly timeout message without statusCode', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';
    fetchMock.mockRejectedValue(timeoutError);

    const err = await makeClient().get('/api/chats').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WAHAApiError);
    expect((err as WAHAApiError).statusCode).toBeUndefined();
    expect((err as WAHAApiError).message).toContain('WAHA did not respond within 30s');
    expect((err as WAHAApiError).message).toContain('GET /api/chats');
  });

  it('respects a custom timeoutMs in the timeout message', async () => {
    const timeoutError = new Error('timeout');
    timeoutError.name = 'TimeoutError';
    fetchMock.mockRejectedValue(timeoutError);

    const client = new WAHAClient({ baseUrl: 'http://waha:3000', apiKey: 'k', timeoutMs: 5000 });
    const err = await client.get('/api/x').catch((e: unknown) => e);
    expect((err as WAHAApiError).message).toContain('within 5s');
  });

  it('maps other network errors to a "Cannot reach WAHA" message', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const err = await makeClient().get('/api/chats').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WAHAApiError);
    expect((err as WAHAApiError).message).toBe(
      'Cannot reach WAHA at http://waha:3000: fetch failed',
    );
  });

  it('returns plain text for non-JSON success responses', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ contentType: 'text/plain', text: async () => 'OK' }),
    );
    const result = await makeClient().get<string>('/api/ping');
    expect(result).toBe('OK');
  });
});

describe('WAHAClient.download', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the X-Api-Key header and returns bytes + content type', async () => {
    const payload = new TextEncoder().encode('audio-bytes');
    fetchMock.mockResolvedValue(
      mockResponse({
        contentType: 'audio/ogg',
        arrayBuffer: async () => payload.buffer.slice(0) as ArrayBuffer,
      }),
    );

    const { data, contentType } = await makeClient().download('http://waha:3000/api/files/a.ogg');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe('secret-key');
    expect(contentType).toBe('audio/ogg');
    expect(data.toString()).toBe('audio-bytes');
  });

  it('prefixes baseUrl for relative paths', async () => {
    fetchMock.mockResolvedValue(mockResponse({ contentType: 'image/png' }));
    await makeClient().download('/api/files/pic.png');
    expect(fetchMock.mock.calls[0][0]).toBe('http://waha:3000/api/files/pic.png');
  });

  it('rewrites a media URL origin to the configured baseUrl (WAHA advertises its internal host:port)', async () => {
    fetchMock.mockResolvedValue(mockResponse({ contentType: 'audio/ogg' }));
    // WAHA returns localhost:3000 (container-internal); the client reaches it at localhost:3001.
    const client = new WAHAClient({ baseUrl: 'http://localhost:3001', apiKey: 'k' });
    await client.download('http://localhost:3000/api/files/default/x.oga?token=abc');
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3001/api/files/default/x.oga?token=abc');
  });

  it('defaults content type to application/octet-stream', async () => {
    fetchMock.mockResolvedValue(mockResponse({ contentType: null }));
    const { contentType } = await makeClient().download('/api/files/blob');
    expect(contentType).toBe('application/octet-stream');
  });

  it('throws WAHAApiError with expiry hint and statusCode on HTTP failure', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: false, status: 404 }));

    const err = await makeClient().download('/api/files/gone.ogg').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WAHAApiError);
    expect((err as WAHAApiError).statusCode).toBe(404);
    expect((err as WAHAApiError).message).toContain('Failed to download media (404)');
    expect((err as WAHAApiError).message).toContain('expire quickly');
    expect((err as WAHAApiError).message).toContain('downloadMedia=true');
  });

  it('wraps network failures in WAHAApiError', async () => {
    fetchMock.mockRejectedValue(new TypeError('socket hang up'));
    const err = await makeClient().download('/api/files/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WAHAApiError);
    expect((err as WAHAApiError).message).toContain('Failed to download');
    expect((err as WAHAApiError).message).toContain('socket hang up');
  });
});
