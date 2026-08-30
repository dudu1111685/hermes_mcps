import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GmailMessage } from './types.js';

const execFileAsync = promisify(execFile);

export interface GwsClientOptions {
  binary?: string;
  xdgConfigHome?: string;
  timeoutMs?: number;
}

export class GwsClient {
  readonly binary: string;
  readonly xdgConfigHome?: string;
  readonly timeoutMs: number;

  constructor(options: GwsClientOptions = {}) {
    this.binary = options.binary || process.env.GMAIL_GWS_BIN || 'gws';
    this.xdgConfigHome = options.xdgConfigHome ?? process.env.GMAIL_GWS_XDG_CONFIG_HOME;
    this.timeoutMs = options.timeoutMs ?? Number(process.env.GMAIL_GWS_TIMEOUT_MS || 60_000);
  }

  private env(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND: process.env.GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND || 'file',
      ...(this.xdgConfigHome ? { XDG_CONFIG_HOME: this.xdgConfigHome } : {}),
    };
  }

  async json(args: string[]): Promise<any> {
    const { stdout, stderr } = await execFileAsync(this.binary, args, {
      env: this.env(), timeout: this.timeoutMs, maxBuffer: 20 * 1024 * 1024,
    });
    const output = `${stdout}\n${stderr}`;
    const candidates: Array<{ value: any; length: number }> = [];
    for (let index = 0; index < output.length; index += 1) {
      if (output[index] !== '{' && output[index] !== '[') continue;
      let depth = 0; let quoted = false; let escaped = false;
      for (let end = index; end < output.length; end += 1) {
        const char = output[end];
        if (quoted) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === '"') quoted = false;
          continue;
        }
        if (char === '"') { quoted = true; continue; }
        if (char === '{' || char === '[') depth += 1;
        if (char === '}' || char === ']') depth -= 1;
        if (depth === 0) {
          const raw = output.slice(index, end + 1);
          try { candidates.push({ value: JSON.parse(raw), length: raw.length }); } catch { /* not JSON */ }
          break;
        }
      }
    }
    if (candidates.length === 0) throw new Error(`gws returned no JSON: ${output.slice(-1000)}`);
    // Nested objects are also valid JSON candidates. The complete gws response is
    // the largest balanced value, not the final nested header/body object.
    return candidates.reduce((best, item) => item.length > best.length ? item : best).value;
  }

  async profile(): Promise<{ emailAddress: string; historyId: string }> {
    return this.json(['gmail', 'users', 'getProfile', '--params', JSON.stringify({ userId: 'me' })]);
  }

  async history(startHistoryId: string, pageToken?: string): Promise<{ history?: any[]; nextPageToken?: string; historyId: string }> {
    return this.json(['gmail', 'users', 'history', 'list', '--params', JSON.stringify({
      userId: 'me', startHistoryId, historyTypes: ['messageAdded'], maxResults: 500,
      ...(pageToken ? { pageToken } : {}),
    })]);
  }

  async message(id: string, format: 'full' | 'metadata' = 'full'): Promise<GmailMessage> {
    return this.json(['gmail', 'users', 'messages', 'get', '--params', JSON.stringify({ userId: 'me', id, format })]);
  }

  async sendText(input: { to: string[]; subject: string; body: string; cc?: string[]; bcc?: string[] }): Promise<{ id: string; threadId: string }> {
    const args = ['gmail', '+send', '--to', input.to.join(','), '--subject', input.subject, '--body', input.body];
    if (input.cc?.length) args.push('--cc', input.cc.join(','));
    if (input.bcc?.length) args.push('--bcc', input.bcc.join(','));
    return this.json(args);
  }

  async replyText(input: { messageId: string; body: string; to?: string[]; cc?: string[]; bcc?: string[] }): Promise<{ id: string; threadId: string }> {
    const args = ['gmail', '+reply', '--message-id', input.messageId, '--body', input.body];
    if (input.to?.length) args.push('--to', input.to.join(','));
    if (input.cc?.length) args.push('--cc', input.cc.join(','));
    if (input.bcc?.length) args.push('--bcc', input.bcc.join(','));
    return this.json(args);
  }

  async raw(serviceArgs: string[], params?: Record<string, unknown>, body?: Record<string, unknown>): Promise<any> {
    const args = ['gmail', ...serviceArgs];
    if (params) args.push('--params', JSON.stringify(params));
    if (body) args.push('--json', JSON.stringify(body));
    return this.json(args);
  }
}
