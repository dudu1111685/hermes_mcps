import { WAHAConfig, WAHAError } from './types.js';

export class WAHAClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: WAHAConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
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
    };

    if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      let errorBody: WAHAError | string;
      try {
        errorBody = await response.json() as WAHAError;
      } catch {
        errorBody = await response.text();
      }

      const message = typeof errorBody === 'object' && errorBody.message
        ? errorBody.message
        : typeof errorBody === 'string'
          ? errorBody
          : `HTTP ${response.status}`;

      throw new Error(`WAHA API error (${response.status}): ${message}`);
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

  async delete<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('DELETE', path, body);
  }
}
