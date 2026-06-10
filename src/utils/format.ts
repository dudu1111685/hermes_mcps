import { ChatInfo, ContactInfo, GroupInfo, WAMessage } from '../types.js';

/** Compact JSON — no pretty-print indentation (halves token cost vs (null, 2)). */
export function compactJson(value: unknown): string {
  return JSON.stringify(value);
}

/** Unix seconds → "2026-06-10 14:32" (local time, no seconds/ms noise). */
export function formatTime(unixSeconds?: number): string {
  if (!unixSeconds) return '';
  const d = new Date(unixSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Standard list response: compact JSON lines + a summary footer the LLM can
 * use to decide whether to paginate further.
 */
export function listResponse<T, R>(
  items: T[],
  options: {
    map: (item: T) => R;
    offset?: number;
    limit?: number;
    label: string;
  },
): string {
  const { map, offset = 0, limit, label } = options;
  if (items.length === 0) {
    return `No ${label} found${offset > 0 ? ` at offset ${offset}` : ''}.`;
  }
  const lines = items.map((item) => compactJson(map(item)));
  const hasMore = limit !== undefined && items.length >= limit;
  let footer = `${items.length} ${label}`;
  if (offset > 0 || limit !== undefined) footer += ` (offset ${offset})`;
  if (hasMore) footer += `. More may exist — repeat with offset=${offset + items.length}.`;
  return `${lines.join('\n')}\n--\n${footer}`;
}

// ---------- Entity projections (lean fields only) ----------

export function projectMessage(m: WAMessage): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: m.id,
    time: formatTime(m.timestamp),
    from: m.fromMe ? 'me' : m.from,
    body: m.body || undefined,
  };
  if (m.hasMedia) {
    out.media = m.media
      ? { mimetype: m.media.mimetype, url: m.media.url, filename: m.media.filename }
      : true;
  }
  // Group messages: from is the group id — surface the actual sender.
  if (!m.fromMe && m.participant) out.participant = m.participant;
  if (m.replyTo) {
    // Project only the lean fields — engines attach the full raw quoted message in _data.
    out.replyTo = {
      id: m.replyTo.id,
      body: m.replyTo.body ? truncate(m.replyTo.body, 80) : undefined,
    };
  }
  if (m.fromMe && m.ackName) out.ack = m.ackName;
  return out;
}

export function projectChat(c: ChatInfo): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: c.id,
    name: c.name || undefined,
  };
  if (c.unreadCount) out.unread = c.unreadCount;
  if (c.timestamp) out.lastActivity = formatTime(c.timestamp);
  if (c.isGroup) out.group = true;
  if (c.isMuted) out.muted = true;
  if (c.isArchived) out.archived = true;
  if (c.isPinned) out.pinned = true;
  return out;
}

export function projectContact(c: ContactInfo): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: c.id,
    name: c.name || c.pushname || undefined,
  };
  if (c.name && c.pushname && c.name !== c.pushname) out.pushname = c.pushname;
  if (c.isBlocked) out.blocked = true;
  if (c.isBusiness) out.business = true;
  return out;
}

export function projectGroup(g: GroupInfo): Record<string, unknown> {
  return {
    id: g.id,
    subject: g.subject,
    description: g.description ? truncate(g.description, 120) : undefined,
    participants: g.participants?.length,
  };
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * Extract a usable message id from a send result. Engines disagree: WEBJS
 * returns id as an object ({ _serialized }), NOWEB sometimes returns the raw
 * Baileys message ({ key: { fromMe, remoteJid, id } }), others a plain string.
 * Normalizes to WAHA's canonical "fromMe_chatId_innerId" form.
 */
export function messageIdOf(result: unknown): string {
  const r = result as Record<string, unknown> | null | undefined;
  const key = r?.key as { fromMe?: boolean; remoteJid?: string; id?: string } | undefined;
  if (key?.id && key.remoteJid) {
    const chatId = key.remoteJid.replace('@s.whatsapp.net', '@c.us');
    return `${key.fromMe ? 'true' : 'false'}_${chatId}_${key.id}`;
  }
  const id = r?.id ?? result;
  if (typeof id === 'string') return id;
  if (id && typeof id === 'object') {
    const o = id as Record<string, unknown>;
    if (typeof o._serialized === 'string') return o._serialized;
    if (typeof o.id === 'string') return o.id;
  }
  return JSON.stringify(id);
}
