import { ChatWatch, WahaWebhookBody, WahaWebhookMessage } from './types.js';

function validChatId(value: unknown): value is string {
  return typeof value === 'string' && /@(c\.us|g\.us|lid|s\.whatsapp\.net)$/.test(value);
}

function normalizeJid(value: string): string {
  return value.endsWith('@s.whatsapp.net')
    ? `${value.slice(0, -'@s.whatsapp.net'.length).split(':')[0]}@c.us`
    : value;
}

function info(payload: WahaWebhookMessage): Record<string, unknown> {
  const raw = payload._data;
  if (!raw || typeof raw !== 'object') return {};
  const candidate = (raw as Record<string, unknown>).Info;
  return candidate && typeof candidate === 'object' ? candidate as Record<string, unknown> : {};
}

function rawChatIds(body: WahaWebhookBody): string[] {
  const payload = body.payload;
  if (!payload) return [];
  const metadata = info(payload);
  return [metadata.Chat, payload.from, payload.to]
    .filter(validChatId)
    .map((value) => normalizeJid(value));
}

export function watchChatMatches(watch: ChatWatch, body: WahaWebhookBody): boolean {
  const resolved = resolveChatId(body);
  if (resolved === watch.chatId) return true;
  // A direct chat can be stored as its GOWS @lid while incoming events also
  // expose SenderAlt as the stable phone-number @c.us JID. Preserve the raw
  // LID as a valid alias for that same direct conversation. Groups remain
  // exact-match only because participant identity is security-sensitive.
  return watch.chatId.endsWith('@lid') && rawChatIds(body).includes(watch.chatId);
}

export function resolveChatId(body: WahaWebhookBody): string | undefined {
  const payload = body.payload;
  if (!payload) return undefined;
  const metadata = info(payload);
  // In groups SenderAlt identifies the participant, not the chat. Always keep
  // the @g.us conversation as the chat boundary before considering direct-chat
  // aliases. For DMs, prefer SenderAlt/RecipientAlt to normalize LID to c.us.
  const rawChat = [metadata.Chat, payload.from, payload.to]
    .find((value) => typeof value === 'string' && value.endsWith('@g.us'));
  if (typeof rawChat === 'string') return rawChat;
  const directCandidates = payload.fromMe
    ? [metadata.RecipientAlt, metadata.Chat, payload.to, payload.from]
    : [metadata.SenderAlt, metadata.Chat, payload.from, payload.to];
  const candidate = directCandidates.find(validChatId);
  return candidate ? normalizeJid(candidate) : undefined;
}

export function resolveSenderId(body: WahaWebhookBody): string | undefined {
  const payload = body.payload;
  if (!payload || payload.fromMe) return undefined;
  const metadata = info(payload);
  const candidates = [payload.participant, metadata.SenderAlt, metadata.Sender, payload.from];
  const candidate = candidates.find(validChatId);
  return candidate ? normalizeJid(candidate) : undefined;
}

function senderAllowed(watch: ChatWatch, senderId: string): boolean {
  if (watch.allowedSenders.length === 0 || watch.allowedSenders.includes(senderId)) return true;
  // GOWS commonly identifies an incoming direct-message sender by @lid while
  // the stable watched chat ID is the contact's @c.us JID. For a private chat,
  // the chat match already proves which conversation produced the event, so an
  // incoming @lid is a valid alias for that one watched peer. Do not apply this
  // relaxation to groups, where participant identity remains security-relevant.
  return watch.chatId.endsWith('@c.us') && senderId.endsWith('@lid');
}

export function matchesWatch(watch: ChatWatch, body: WahaWebhookBody): boolean {
  if (body.event !== 'message' && body.event !== 'message.any') return false;
  if (!body.payload || body.payload.fromMe) return false;
  if (body.session !== watch.session) return false;
  if (!watchChatMatches(watch, body)) return false;
  const sender = resolveSenderId(body);
  if (!sender) return false;
  return senderAllowed(watch, sender);
}
