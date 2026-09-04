import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { sessionParam } from '../utils/session.js';
import { WAHAClient } from '../client.js';
import { ChatInfo, ContactInfo, SendResult, WAMessage } from '../types.js';
import { defineTool } from '../utils/define-tool.js';
import { compactJson, formatTime, messageIdOf } from '../utils/format.js';
import { throttleSend } from '../utils/throttle.js';
import { resolveLid } from '../utils/lid.js';
import { downloadMedia } from '../utils/media.js';
import { isConfigured as sonioxConfigured, transcribeWithCache } from '../utils/soniox.js';

// ---------- Shared directory cache (contacts + chats overview, TTL 5 min) ----------

const DIRECTORY_TTL_MS = 5 * 60 * 1000;
// The GOWS chats overview endpoint can hang for tens of seconds on large
// accounts. Contact resolution must not wait for it: saved contacts are the
// authoritative fast path, while chat/group enrichment is best-effort.
const CHAT_OVERVIEW_SOFT_TIMEOUT_MS = 2_500;

function bestEffortWithin<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(fallback), timeoutMs);
    promise.then(finish).catch(() => finish(fallback));
  });
}

interface ChatOverview extends ChatInfo {
  lastMessage?: { timestamp?: number };
}

interface Directory {
  contacts: ContactInfo[];
  chats: ChatOverview[];
  fetchedAt: number;
}

const directoryCache = new Map<string, Directory>();

async function getDirectory(client: WAHAClient, session: string): Promise<Directory> {
  // Evict expired entries so stale sessions don't accumulate for the process lifetime.
  const now = Date.now();
  for (const [key, value] of directoryCache) {
    if (now - value.fetchedAt >= DIRECTORY_TTL_MS) directoryCache.delete(key);
  }
  const cached = directoryCache.get(session);
  if (cached && Date.now() - cached.fetchedAt < DIRECTORY_TTL_MS) return cached;
  // Start both requests together, but only contacts are required. On large GOWS
  // stores `/chats/overview` may never return; falling back to contacts keeps
  // recently saved Google/phone contacts resolvable in a few seconds.
  const contactsPromise = client.get<ContactInfo[]>('/api/contacts/all', { session });
  const chatsPromise = bestEffortWithin(
    client.get<ChatOverview[]>(`/api/${encodeURIComponent(session)}/chats/overview`, { limit: 200 }),
    CHAT_OVERVIEW_SOFT_TIMEOUT_MS,
    [],
  );
  const contacts = await contactsPromise;
  const chats = await chatsPromise;
  const entry: Directory = { contacts, chats, fetchedAt: Date.now() };
  directoryCache.set(session, entry);
  return entry;
}

/** id → display name, built from contacts (name/pushname) and chat names. */
function buildNameMap(dir: Directory): Map<string, string> {
  const map = new Map<string, string>();
  for (const chat of dir.chats) {
    if (chat.name) map.set(chat.id, chat.name);
  }
  for (const contact of dir.contacts) {
    const name = contact.name || contact.pushname;
    if (name) map.set(contact.id, name);
  }
  return map;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** "2026-06-10 14:32" → "06-10 14:32" (year adds noise in a conversation render). */
function shortTime(unixSeconds?: number): string {
  return formatTime(unixSeconds).slice(5);
}

export function registerCompoundTools(server: McpServer, client: WAHAClient): void {
  // ---------- waha_find_chat ----------

  defineTool(server, {
    name: 'waha_find_chat',
    description:
      "Use whenever the user refers to a person/group by name — resolves to chatId (like 123@c.us / 123@g.us). Call before any send/read tool if you don't have the chatId.",
    schema: {
      query: z.string().describe('Human name to search for, e.g. "Shlomo" or "Family group"'),
      session: sessionParam(),
      limit: z.number().int().min(1).max(100).default(5).describe('Max matches to return'),
    },
    annotations: { readOnlyHint: true },
    handler: async ({ query, session, limit }) => {
      const normalized = query.toLowerCase().trim();
      if (!normalized) throw new Error('query must not be empty');
      const dir = await getDirectory(client, session);

      const score = (candidate?: string): number => {
        if (!candidate) return 0;
        const c = candidate.toLowerCase().trim();
        if (c === normalized) return 3;
        if (c.startsWith(normalized)) return 2;
        if (c.includes(normalized)) return 1;
        return 0;
      };

      interface Match {
        id: string;
        name?: string;
        type: 'contact' | 'group' | 'chat';
        lastActivity?: string;
        score: number;
      }
      const matches = new Map<string, Match>();
      const upsert = (m: Match) => {
        if (m.score === 0) return;
        const existing = matches.get(m.id);
        if (!existing || m.score > existing.score) {
          matches.set(m.id, { ...existing, ...m, lastActivity: m.lastActivity ?? existing?.lastActivity });
        } else if (m.lastActivity && !existing.lastActivity) {
          existing.lastActivity = m.lastActivity;
        }
      };

      for (const contact of dir.contacts) {
        upsert({
          id: contact.id,
          name: contact.name || contact.pushname,
          type: 'contact',
          score: Math.max(score(contact.name), score(contact.pushname)),
        });
      }
      for (const chat of dir.chats) {
        const lastTs = chat.timestamp ?? chat.lastMessage?.timestamp;
        upsert({
          id: chat.id,
          name: chat.name,
          type: chat.isGroup || chat.id.endsWith('@g.us') ? 'group' : 'chat',
          lastActivity: lastTs ? formatTime(lastTs) : undefined,
          score: score(chat.name),
        });
      }

      const ranked = [...matches.values()].sort((a, b) => b.score - a.score).slice(0, limit);
      if (ranked.length === 0) {
        return `No matches for "${query}". Check the spelling, or browse with waha_get_contacts.`;
      }
      const lines = ranked.map(({ score: _score, ...rest }) => compactJson(rest));
      return `${lines.join('\n')}\n--\n${ranked.length} matches (best first).`;
    },
  });

  // ---------- waha_reply ----------

  defineTool(server, {
    name: 'waha_reply',
    description:
      'Preferred way to answer a person — marks seen, shows typing, then sends. Use replyToMessageId when answering a specific message (mandatory courtesy in groups). chatId like 123@c.us / 123@g.us.',
    schema: {
      chatId: z.string().describe('Chat ID, e.g. 123@c.us or 123@g.us'),
      text: z.string().describe('Message text to send'),
      session: sessionParam(),
      replyToMessageId: z.string().optional().describe('Message ID to quote-reply to'),
      markSeenFirst: z.boolean().default(true).describe('Mark the chat as seen before typing (human-like)'),
    },
    handler: async ({ chatId, text, session, replyToMessageId, markSeenFirst }) => {
      // Steps before the send are best-effort humanization — never block the send.
      // After the first failure, skip the remaining steps: if WAHA is unreachable,
      // burning further timeouts here would push the real sendText error past the
      // MCP client's tool deadline.
      let humanize = true;
      if (markSeenFirst) {
        try {
          await client.post('/api/sendSeen', { session, chatId });
        } catch {
          humanize = false;
        }
      }
      if (humanize) {
        try {
          await client.post('/api/startTyping', { session, chatId });
          await sleep(Math.min(500 + text.length * 40, 5000));
          await client.post('/api/stopTyping', { session, chatId });
        } catch { /* best-effort */ }
      }

      await throttleSend(chatId);
      const result = await client.post<SendResult>('/api/sendText', {
        session,
        chatId,
        text,
        ...(replyToMessageId ? { reply_to: replyToMessageId } : {}),
      });
      return `Sent. id=${messageIdOf(result)}`;
    },
  });

  // ---------- waha_get_chat_context ----------

  defineTool(server, {
    name: 'waha_get_chat_context',
    description:
      "PRIMARY tool for 'read what X wrote': returns the conversation rendered for reading — names resolved, voice notes transcribed inline, media summarized. Prefer this over waha_get_messages. chatId like 123@c.us / 123@g.us.",
    schema: {
      chatId: z.string().describe('Chat ID, e.g. 123@c.us or 123@g.us'),
      session: sessionParam(),
      limit: z.number().int().min(1).max(100).default(30).describe('Max messages to fetch'),
      sinceTimestamp: z.number().int().optional().describe('Only messages at/after this unix timestamp (seconds)'),
      transcribeVoice: z.boolean().default(true).describe('Transcribe voice notes inline (requires SONIOX_API_KEY)'),
    },
    annotations: { readOnlyHint: true },
    handler: async ({ chatId, session, limit, sinceTimestamp, transcribeVoice }) => {
      // No server-side timestamp filter: filter.timestamp.gte 500s on the
      // WEBJS engine — fetch and filter client-side.
      let messages = await client.get<WAMessage[]>(
        `/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(chatId)}/messages`,
        { limit, downloadMedia: true },
      );
      if (sinceTimestamp !== undefined) {
        messages = messages.filter((m) => m.timestamp >= sinceTimestamp);
      }
      if (messages.length === 0) {
        return `No messages found in ${chatId}${sinceTimestamp ? ` since ${formatTime(sinceTimestamp)}` : ''}.`;
      }
      messages.sort((a, b) => a.timestamp - b.timestamp);

      // Name resolution — best-effort: a directory failure must not block reading.
      let nameMap = new Map<string, string>();
      try {
        nameMap = buildNameMap(await getDirectory(client, session));
      } catch { /* fall back to raw ids */ }

      const isGroup = chatId.endsWith('@g.us');
      const senderNameCache = new Map<string, string>();
      const senderName = async (msg: WAMessage): Promise<string> => {
        if (msg.fromMe) return 'me';
        const rawId = (isGroup ? msg.participant ?? msg.from : msg.from) ?? msg.from;
        const cached = senderNameCache.get(rawId);
        if (cached) return cached;
        let name = nameMap.get(rawId);
        if (!name && rawId.endsWith('@lid')) {
          const pn = await resolveLid(client, session, rawId);
          if (pn) name = nameMap.get(pn) ?? pn;
        }
        const resolved = name ?? rawId;
        senderNameCache.set(rawId, resolved);
        return resolved;
      };

      // Pre-transcribe voice notes with concurrency 2 (notes are short).
      const voiceLines = new Map<string, string>();
      const voiceMessages = messages.filter((m) => m.hasMedia && m.media?.mimetype?.startsWith('audio/'));
      if (voiceMessages.length > 0 && transcribeVoice && sonioxConfigured()) {
        const queue = [...voiceMessages];
        const worker = async (): Promise<void> => {
          for (let msg = queue.shift(); msg; msg = queue.shift()) {
            const current = msg;
            try {
              const url = current.media?.url;
              if (!url) throw new Error('no media URL (it may have expired)');
              const transcript = await transcribeWithCache(
                current.id,
                async () => (await downloadMedia(client, url)).data,
              );
              voiceLines.set(current.id, `[voice 🎤]: ${transcript || '(empty transcript)'}`);
            } catch (error) {
              voiceLines.set(current.id, `[voice — transcription failed: ${(error as Error).message}]`);
            }
          }
        };
        await Promise.all([worker(), worker()]);
      }

      const renderContent = (msg: WAMessage): string => {
        if (msg.hasMedia) {
          const mimetype = msg.media?.mimetype ?? 'unknown';
          const caption = msg.body || msg.media?.filename;
          if (mimetype.startsWith('audio/')) {
            const transcribed = voiceLines.get(msg.id);
            if (transcribed) return transcribed;
            if (!sonioxConfigured()) return '[voice message — set SONIOX_API_KEY for transcription]';
            return `[voice message] (id=${msg.id} — use waha_transcribe_message)`;
          }
          if (mimetype.startsWith('image/')) {
            return `[image: ${caption ?? 'no caption'}] (id=${msg.id} — use waha_get_media to view)`;
          }
          if (mimetype.startsWith('video/')) {
            return `[video (${mimetype}): ${caption ?? 'no caption'}] (id=${msg.id} — use waha_get_media)`;
          }
          return `[file (${mimetype}): ${caption ?? 'unnamed'}] (id=${msg.id} — use waha_get_media)`;
        }
        return msg.body || '(empty message)';
      };

      const lines: string[] = [];
      for (const msg of messages) {
        const prefix = msg.replyTo ? '↳ ' : '';
        lines.push(`${prefix}[${shortTime(msg.timestamp)}] ${await senderName(msg)}: ${renderContent(msg)}`);
      }

      // Unanswered = incoming messages after my last outgoing one.
      const lastFromMe = messages.map((m) => m.fromMe).lastIndexOf(true);
      const unanswered = messages.slice(lastFromMe + 1).filter((m) => !m.fromMe).length;

      const chatName = nameMap.get(chatId) ?? chatId;
      const range = `${formatTime(messages[0].timestamp)} → ${formatTime(messages[messages.length - 1].timestamp)}`;
      const footer = `Chat: ${chatName} (${chatId}) | ${messages.length} messages | ${range} | ${unanswered} unanswered since my last message`;
      return `${lines.join('\n')}\n--\n${footer}`;
    },
  });
}
