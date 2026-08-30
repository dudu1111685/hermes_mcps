import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { GmailWatch, GmailWatchAccountState, GmailWatchOrigin } from './types.js';

interface GmailStoreDocument {
  version: 1;
  account?: GmailWatchAccountState;
  watches: GmailWatch[];
  processed: Array<{ accountId: string; watchId: string; messageId: string; processedAt: string }>;
}

const defaultDocument = (): GmailStoreDocument => ({ version: 1, watches: [], processed: [] });

export class GmailWatchStore {
  readonly filePath: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(filePath = process.env.GMAIL_WATCH_STORE || '~/.hermes/gmail-watch-state.json') {
    this.filePath = resolve(filePath.replace(/^~(?=\/)/, process.env.HOME || ''));
  }

  private async load(): Promise<GmailStoreDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as GmailStoreDocument;
      return { version: 1, watches: parsed.watches ?? [], processed: parsed.processed ?? [], account: parsed.account };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultDocument();
      throw error;
    }
  }

  private async save(document: GmailStoreDocument): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 });
    await rename(tmp, this.filePath);
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation, operation);
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }

  async create(input: {
    accountId: string; accountEmail: string; matchMode: GmailWatch['matchMode']; gmailThreadId?: string;
    correspondents?: string[]; direction?: GmailWatch['direction']; subjectContains?: string; labelIds?: string[];
    objective: string; permissions?: string[]; origin: GmailWatchOrigin; wakeUrl: string; wakeSecret: string;
    expiresAt?: string; sentMessageId?: string;
  }): Promise<GmailWatch> {
    return this.serialize(async () => {
      const doc = await this.load();
      const now = new Date().toISOString();
      const active = doc.watches.find((watch) => watch.status === 'active' && watch.accountId === input.accountId
        && watch.matchMode === input.matchMode
        && (input.matchMode === 'thread'
          ? watch.gmailThreadId === input.gmailThreadId
          : JSON.stringify(watch.correspondents) === JSON.stringify(input.correspondents ?? [])));
      if (active) throw new Error(`An active Gmail watch already exists for this scope: ${active.id}`);
      const watch: GmailWatch = {
        id: randomUUID(), accountId: input.accountId, accountEmail: input.accountEmail,
        matchMode: input.matchMode, gmailThreadId: input.gmailThreadId,
        correspondents: (input.correspondents ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean),
        direction: input.direction ?? 'from', subjectContains: input.subjectContains,
        labelIds: input.labelIds ?? [], objective: input.objective, permissions: input.permissions ?? [],
        origin: input.origin, wakeUrl: input.wakeUrl, wakeSecret: input.wakeSecret,
        status: 'active', createdAt: now, updatedAt: now, expiresAt: input.expiresAt,
        sentMessageId: input.sentMessageId,
      };
      doc.watches.push(watch);
      await this.save(doc);
      return watch;
    });
  }

  async list(filters: { includeClosed?: boolean; accountId?: string } = {}): Promise<GmailWatch[]> {
    const doc = await this.load();
    const now = Date.now();
    return doc.watches.filter((watch) => (filters.includeClosed || watch.status === 'active')
      && (!filters.accountId || watch.accountId === filters.accountId)
      && (!watch.expiresAt || Date.parse(watch.expiresAt) > now));
  }

  async update(id: string, changes: Partial<Pick<GmailWatch, 'objective' | 'permissions' | 'expiresAt' | 'subjectContains' | 'labelIds' | 'gmailThreadId' | 'sentMessageId' | 'matchMode' | 'correspondents' | 'direction'>>): Promise<GmailWatch> {
    return this.serialize(async () => {
      const doc = await this.load();
      const watch = doc.watches.find((item) => item.id === id);
      if (!watch) throw new Error(`Gmail watch not found: ${id}`);
      if (watch.status !== 'active') throw new Error(`Gmail watch is not active: ${id}`);
      Object.assign(watch, changes, { updatedAt: new Date().toISOString() });
      await this.save(doc);
      return watch;
    });
  }

  async close(id: string): Promise<GmailWatch> {
    return this.serialize(async () => {
      const doc = await this.load();
      const watch = doc.watches.find((item) => item.id === id);
      if (!watch) throw new Error(`Gmail watch not found: ${id}`);
      if (watch.status === 'active') {
        watch.status = 'closed';
        watch.closedAt = new Date().toISOString();
        watch.updatedAt = watch.closedAt;
        await this.save(doc);
      }
      return watch;
    });
  }

  async updateAccount(account: GmailWatchAccountState): Promise<void> {
    return this.serialize(async () => {
      const doc = await this.load();
      doc.account = account;
      await this.save(doc);
    });
  }

  async account(): Promise<GmailWatchAccountState | undefined> {
    return (await this.load()).account;
  }

  async wasProcessed(accountId: string, watchId: string, messageId: string): Promise<boolean> {
    return (await this.load()).processed.some((item) => item.accountId === accountId && item.watchId === watchId && item.messageId === messageId);
  }

  async markProcessed(accountId: string, watchId: string, messageId: string): Promise<void> {
    return this.serialize(async () => {
      const doc = await this.load();
      if (!doc.processed.some((item) => item.accountId === accountId && item.watchId === watchId && item.messageId === messageId)) {
        doc.processed.push({ accountId, watchId, messageId, processedAt: new Date().toISOString() });
        if (doc.processed.length > 5000) doc.processed.splice(0, doc.processed.length - 5000);
        await this.save(doc);
      }
    });
  }
}
