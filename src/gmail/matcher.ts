import { GmailMessage, GmailWatch } from './types.js';

export function header(message: GmailMessage, name: string): string {
  return message.payload?.headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

export function extractAddresses(value: string): string[] {
  const matches = value.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(matches.map((item) => item.toLowerCase()))];
}

export function matchesGmailWatch(watch: GmailWatch, message: GmailMessage): boolean {
  if (watch.status !== 'active') return false;
  if (watch.expiresAt && Date.parse(watch.expiresAt) <= Date.now()) return false;
  if (watch.matchMode === 'thread') {
    if (!watch.gmailThreadId || message.threadId !== watch.gmailThreadId) return false;
  } else {
    const from = extractAddresses(header(message, 'From'));
    const recipients = extractAddresses([header(message, 'To'), header(message, 'Cc')].join(','));
    const expected = new Set(watch.correspondents.map((item) => item.toLowerCase()));
    const fromMatch = from.some((item) => expected.has(item));
    const toMatch = recipients.some((item) => expected.has(item));
    if (watch.direction === 'from' && !fromMatch) return false;
    if (watch.direction === 'to' && !toMatch) return false;
    if (watch.direction === 'either' && !fromMatch && !toMatch) return false;
  }
  if (watch.subjectContains && !header(message, 'Subject').toLowerCase().includes(watch.subjectContains.toLowerCase())) return false;
  if (watch.labelIds.length > 0 && !watch.labelIds.some((label) => message.labelIds?.includes(label))) return false;
  return true;
}
