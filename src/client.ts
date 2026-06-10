import { WAHAConfig, WAHAError } from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;

export class WAHAApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'WAHAApiError';
  }
}

export class WAHAClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor(config: WAHAConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private getHeaders(): Record<string, string> {
    return {
      'X-Api-Key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(this.timeoutMs),
    };

    if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
      options.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), options);
    } catch (error) {
      if ((error as Error).name === 'TimeoutError' || (error as Error).name === 'AbortError') {
        throw new WAHAApiError(
          `WAHA did not respond within ${this.timeoutMs / 1000}s (${method} ${path}). Check that WAHA is running and reachable.`,
        );
      }
      throw new WAHAApiError(`Cannot reach WAHA at ${this.baseUrl}: ${(error as Error).message}`);
    }

    if (!response.ok) {
      let errorBody: WAHAError | string;
      try {
        errorBody = await response.json() as WAHAError;
      } catch {
        errorBody = await response.text().catch(() => '');
      }

      const message = typeof errorBody === 'object' && errorBody.message
        ? errorBody.message
        : typeof errorBody === 'string' && errorBody
          ? errorBody
          : `HTTP ${response.status}`;

      throw new WAHAApiError(`WAHA API error (${response.status}): ${message}`, response.status);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json() as Promise<T>;
    }

    const text = await response.text();
    return text as unknown as T;
  }

  async get<T>(path: string, queryParams?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>('GET', path, undefined, queryParams);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  /**
   * WAHA emits media URLs using its OWN base URL (often the container-internal
   * host:port, e.g. http://localhost:3000), which is unreachable from wherever
   * the MCP server actually runs. Rewrite the origin to our configured baseUrl
   * so media downloads work regardless of how WAHA advertises itself; keep the
   * path + query intact. Path-only inputs are resolved against baseUrl as-is.
   */
  private resolveDownloadUrl(urlOrPath: string): string {
    if (!urlOrPath.startsWith('http')) return `${this.baseUrl}${urlOrPath}`;
    try {
      const base = new URL(this.baseUrl);
      const target = new URL(urlOrPath);
      target.protocol = base.protocol;
      target.host = base.host; // host includes port
      return target.toString();
    } catch {
      return urlOrPath;
    }
  }

  /**
   * Download a binary resource (e.g. media file) from WAHA with auth.
   * Returns the raw bytes and content type.
   * When maxBytes is set, the limit is enforced DURING the download (early
   * Content-Length reject + streamed read), never buffering more than the cap.
   */
  async download(urlOrPath: string, maxBytes?: number): Promise<{ data: Buffer; contentType: string }> {
    const url = this.resolveDownloadUrl(urlOrPath);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'X-Api-Key': this.apiKey },
        signal: AbortSignal.timeout(this.timeoutMs * 2),
      });
    } catch (error) {
      throw new WAHAApiError(`Failed to download ${url}: ${(error as Error).message}`);
    }
    if (!response.ok) {
      throw new WAHAApiError(
        `Failed to download media (${response.status}). WAHA media files expire quickly (default 180s) — re-fetch the message with downloadMedia=true to get a fresh URL.`,
        response.status,
      );
    }

    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';

    if (maxBytes !== undefined) {
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        await response.body?.cancel().catch(() => {});
        throw new WAHAApiError(
          `Media too large: ${contentLength} bytes (limit ${maxBytes}). Refusing to download.`,
        );
      }
      if (response.body) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > maxBytes) {
            await reader.cancel().catch(() => {});
            throw new WAHAApiError(
              `Media too large: exceeded ${maxBytes} bytes while downloading. Refusing to process.`,
            );
          }
          chunks.push(value);
        }
        return { data: Buffer.concat(chunks), contentType };
      }
    }

    const data = Buffer.from(await response.arrayBuffer());
    return { data, contentType };
  }
}
