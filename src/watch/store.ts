import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { ChatWatch, WatchOrigin, WatchStoreDocument } from './types.js';

const DEFAULT_STORE_PATH = resolve(process.env.WAHA_WATCH_STORE || '.waha-chat-watches.json');

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeId(value: string): string {
  return value.trim();
}

export function watchStorePath(): string {
  return DEFAULT_STORE_PATH;
}

export class WatchStore {
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly path = DEFAULT_STORE_PATH) {}

  get filePath(): string {
    return this.path;
  }

  async list(options: { includeClosed?: boolean; session?: string; chatId?: string } = {}): Promise<ChatWatch[]> {
    const document = await this.readDocument();
    const now = Date.now();
    return document.watches
      .filter((watch) => options.includeClosed || this.isActive(watch, now))
      .filter((watch) => !options.session || watch.session === options.session)
      .filter((watch) => !options.chatId || watch.chatId === options.chatId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<ChatWatch | undefined> {
    const document = await this.readDocument();
    return document.watches.find((watch) => watch.id === id);
  }

  async create(input: {
    session: string;
    chatId: string;
    objective: string;
    allowedSenders?: string[];
    permissions?: string[];
    origin: WatchOrigin;
    wakeUrl: string;
    wakeSecret: string;
    expiresAt?: string;
  }): Promise<ChatWatch> {
    const session = normalizeId(input.session);
    const chatId = normalizeId(input.chatId);
    const objective = input.objective.trim();
    if (!session || !chatId || !objective) throw new Error('session, chatId and objective are required');
    this.validateWake(input.wakeUrl, input.wakeSecret);
    this.validateExpiry(input.expiresAt);

    let created!: ChatWatch;
    await this.mutate((document) => {
      const duplicate = document.watches.find(
        (watch) => this.isActive(watch) && watch.session === session && watch.chatId === chatId,
      );
      if (duplicate) {
        throw new Error(
          `An active watch already exists for session=${session} chatId=${chatId}: ${duplicate.id}. Update or close it instead.`,
        );
      }
      const timestamp = nowIso();
      created = {
        id: randomUUID(),
        session,
        chatId,
        objective,
        allowedSenders: this.uniqueIds(input.allowedSenders ?? []),
        permissions: this.uniqueStrings(input.permissions ?? []),
        origin: this.validateOrigin(input.origin),
        wakeUrl: input.wakeUrl.trim(),
        wakeSecret: input.wakeSecret.trim(),
        expiresAt: input.expiresAt,
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      document.watches.push(created);
    });
    return created;
  }

  async update(
    id: string,
    patch: Partial<Pick<ChatWatch, 'objective' | 'allowedSenders' | 'permissions' | 'wakeUrl' | 'wakeSecret' | 'expiresAt'>>,
  ): Promise<ChatWatch> {
    let updated!: ChatWatch;
    await this.mutate((document) => {
      const watch = document.watches.find((candidate) => candidate.id === id);
      if (!watch) throw new Error(`Watch not found: ${id}`);
      if (watch.status !== 'active') throw new Error(`Watch ${id} is ${watch.status}; create a new watch instead.`);
      if (patch.objective !== undefined) {
        const objective = patch.objective.trim();
        if (!objective) throw new Error('objective cannot be empty');
        watch.objective = objective;
      }
      if (patch.allowedSenders !== undefined) watch.allowedSenders = this.uniqueIds(patch.allowedSenders);
      if (patch.permissions !== undefined) watch.permissions = this.uniqueStrings(patch.permissions);
      if (patch.wakeUrl !== undefined || patch.wakeSecret !== undefined) {
        const wakeUrl = patch.wakeUrl?.trim() ?? watch.wakeUrl;
        const wakeSecret = patch.wakeSecret?.trim() ?? watch.wakeSecret;
        this.validateWake(wakeUrl, wakeSecret);
        watch.wakeUrl = wakeUrl;
        watch.wakeSecret = wakeSecret;
      }
      if (patch.expiresAt !== undefined) {
        this.validateExpiry(patch.expiresAt);
        watch.expiresAt = patch.expiresAt || undefined;
      }
      watch.updatedAt = nowIso();
      updated = { ...watch };
    });
    return updated;
  }

  async close(id: string): Promise<ChatWatch> {
    let closed!: ChatWatch;
    await this.mutate((document) => {
      const watch = document.watches.find((candidate) => candidate.id === id);
      if (!watch) throw new Error(`Watch not found: ${id}`);
      if (watch.status !== 'closed') {
        watch.status = 'closed';
        watch.closedAt = nowIso();
        watch.updatedAt = watch.closedAt;
      }
      closed = { ...watch };
    });
    return closed;
  }

  async activeMatches(session: string, chatId: string): Promise<ChatWatch[]> {
    return this.list({ session, chatId });
  }

  private async mutate(fn: (document: WatchStoreDocument) => void): Promise<void> {
    const operation = this.writeChain.then(async () => {
      const document = await this.readDocument();
      fn(document);
      await this.writeDocument(document);
    });
    this.writeChain = operation.catch(() => {});
    return operation;
  }

  private async readDocument(): Promise<WatchStoreDocument> {
    try {
      const raw = await readFile(this.path, 'utf8');
      const parsed = JSON.parse(raw) as WatchStoreDocument;
      if (parsed.version !== 1 || !Array.isArray(parsed.watches)) throw new Error('unsupported watch store format');
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, watches: [] };
      throw new Error(`Cannot read watch store ${this.path}: ${(error as Error).message}`);
    }
  }

  private async writeDocument(document: WatchStoreDocument): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 });
    await rename(tmp, this.path);
    const handle = await open(this.path, 'r');
    await handle.chmod(0o600);
    await handle.close();
    const file = await stat(this.path);
    if ((file.mode & 0o077) !== 0) throw new Error(`Watch store permissions are not private: ${this.path}`);
  }

  private isActive(watch: ChatWatch, now = Date.now()): boolean {
    if (watch.status !== 'active') return false;
    if (!watch.expiresAt) return true;
    return Date.parse(watch.expiresAt) > now;
  }

  private validateWake(url: string, secret: string): void {
    const parsed = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('wakeUrl must use http or https');
    if (!secret.trim()) throw new Error('wakeSecret is required');
  }

  private validateOrigin(origin: WatchOrigin): WatchOrigin {
    const platform = origin.platform?.trim();
    const chatId = origin.chatId?.trim();
    const chatType = origin.chatType?.trim();
    if (!platform || !chatId || !chatType) {
      throw new Error('origin platform, chatId and chatType are required');
    }
    return {
      platform,
      chatId,
      chatType,
      threadId: origin.threadId?.trim() || undefined,
      userId: origin.userId?.trim() || undefined,
      userIdAlt: origin.userIdAlt?.trim() || undefined,
      profile: origin.profile?.trim() || undefined,
      scopeId: origin.scopeId?.trim() || undefined,
      sessionId: origin.sessionId?.trim() || undefined,
      sessionKey: origin.sessionKey?.trim() || undefined,
    };
  }

  private validateExpiry(expiresAt?: string): void {
    if (expiresAt && !Number.isFinite(Date.parse(expiresAt))) throw new Error('expiresAt must be an ISO-8601 date/time');
  }

  private uniqueIds(values: string[]): string[] {
    return [...new Set(values.map(normalizeId).filter(Boolean))];
  }

  private uniqueStrings(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }
}
