import { describe, it, expect } from 'vitest';
import {
  formatTime,
  truncate,
  listResponse,
  projectMessage,
  projectChat,
  projectContact,
} from '../utils/format.js';
import type { ChatInfo, ContactInfo, WAMessage } from '../types.js';

describe('formatTime', () => {
  it('returns empty string for undefined', () => {
    expect(formatTime(undefined)).toBe('');
  });

  it('returns empty string for 0', () => {
    expect(formatTime(0)).toBe('');
  });

  it('formats unix seconds as "YYYY-MM-DD HH:mm" in local time', () => {
    // Construct in local time so the assertion is timezone-independent.
    const local = new Date(2026, 5, 10, 14, 32, 59); // 2026-06-10 14:32:59 local
    const unixSeconds = Math.floor(local.getTime() / 1000);
    expect(formatTime(unixSeconds)).toBe('2026-06-10 14:32');
  });

  it('zero-pads single-digit components', () => {
    const local = new Date(2026, 0, 5, 7, 8, 0); // 2026-01-05 07:08 local
    const unixSeconds = Math.floor(local.getTime() / 1000);
    expect(formatTime(unixSeconds)).toBe('2026-01-05 07:08');
  });
});

describe('truncate', () => {
  it('returns the text unchanged when within the limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns the text unchanged when exactly at the limit', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates over-limit text to max chars ending with an ellipsis', () => {
    const result = truncate('hello world', 8);
    expect(result).toBe('hello w…');
    expect(result.length).toBe(8);
  });
});

describe('listResponse', () => {
  const map = (n: number) => ({ n });

  it('reports empty list without offset', () => {
    expect(listResponse([], { map, label: 'chats' })).toBe('No chats found.');
  });

  it('reports empty list with offset', () => {
    expect(listResponse([], { map, label: 'chats', offset: 5 })).toBe(
      'No chats found at offset 5.',
    );
  });

  it('renders compact JSON lines with a plain footer when no offset/limit', () => {
    const out = listResponse([1, 2], { map, label: 'chats' });
    expect(out).toBe('{"n":1}\n{"n":2}\n--\n2 chats');
  });

  it('adds hasMore footer when items.length >= limit', () => {
    const out = listResponse([1, 2], { map, label: 'messages', limit: 2 });
    expect(out).toContain('2 messages (offset 0)');
    expect(out).toContain('More may exist — repeat with offset=2.');
  });

  it('includes offset in footer and computes next offset from it', () => {
    const out = listResponse([1, 2, 3], { map, label: 'messages', offset: 10, limit: 3 });
    expect(out).toContain('3 messages (offset 10)');
    expect(out).toContain('repeat with offset=13.');
  });

  it('does not add hasMore footer when items.length < limit', () => {
    const out = listResponse([1], { map, label: 'messages', limit: 5 });
    expect(out).not.toContain('More may exist');
  });
});

function makeMessage(overrides: Partial<WAMessage> = {}): WAMessage {
  return {
    id: 'msg1',
    timestamp: Math.floor(new Date(2026, 5, 10, 9, 30).getTime() / 1000),
    from: '972500000001@c.us',
    fromMe: false,
    to: 'me@c.us',
    body: 'hi there',
    hasMedia: false,
    ack: 1,
    ackName: 'SERVER',
    ...overrides,
  };
}

describe('projectMessage', () => {
  it('projects a plain incoming message', () => {
    const out = projectMessage(makeMessage());
    expect(out).toEqual({
      id: 'msg1',
      time: '2026-06-10 09:30',
      from: '972500000001@c.us',
      body: 'hi there',
    });
  });

  it('uses "me" as from for own messages and includes ack', () => {
    const out = projectMessage(makeMessage({ fromMe: true, ackName: 'READ' }));
    expect(out.from).toBe('me');
    expect(out.ack).toBe('READ');
  });

  it('omits ack for incoming messages even when ackName is set', () => {
    const out = projectMessage(makeMessage({ fromMe: false, ackName: 'READ' }));
    expect(out).not.toHaveProperty('ack');
  });

  it('projects media details when media metadata exists', () => {
    const out = projectMessage(
      makeMessage({
        hasMedia: true,
        media: { url: 'http://x/file.ogg', mimetype: 'audio/ogg', filename: 'v.ogg' },
      }),
    );
    expect(out.media).toEqual({ mimetype: 'audio/ogg', url: 'http://x/file.ogg', filename: 'v.ogg' });
  });

  it('sets media=true when hasMedia but no media metadata', () => {
    const out = projectMessage(makeMessage({ hasMedia: true, media: undefined }));
    expect(out.media).toBe(true);
  });

  it('projects only lean replyTo fields (id + truncated body), never _data', () => {
    const raw = {
      id: 'msg0',
      participant: '972500000002@c.us',
      body: 'x'.repeat(100),
      _data: { huge: 'raw engine blob' },
    } as WAMessage['replyTo'];
    const out = projectMessage(makeMessage({ replyTo: raw }));
    expect(out.replyTo).toEqual({ id: 'msg0', body: `${'x'.repeat(79)}…` });
  });

  it('includes participant for incoming group messages', () => {
    const out = projectMessage(
      makeMessage({ from: '123@g.us', participant: '972500000002@c.us' }),
    );
    expect(out.participant).toBe('972500000002@c.us');
  });

  it('omits participant for own messages', () => {
    const out = projectMessage(
      makeMessage({ fromMe: true, from: '123@g.us', participant: '972500000002@c.us' }),
    );
    expect(out).not.toHaveProperty('participant');
  });

  it('maps empty body to undefined', () => {
    const out = projectMessage(makeMessage({ body: '' }));
    expect(out.body).toBeUndefined();
  });
});

describe('projectChat', () => {
  it('projects minimal chat with only id and name', () => {
    const chat: ChatInfo = { id: 'c1@c.us', name: 'Alice' };
    expect(projectChat(chat)).toEqual({ id: 'c1@c.us', name: 'Alice' });
  });

  it('includes optional flags only when truthy', () => {
    const ts = Math.floor(new Date(2026, 5, 9, 20, 0).getTime() / 1000);
    const chat: ChatInfo = {
      id: 'g1@g.us',
      name: 'Group',
      unreadCount: 3,
      timestamp: ts,
      isGroup: true,
      isMuted: true,
      isArchived: true,
      isPinned: true,
    };
    expect(projectChat(chat)).toEqual({
      id: 'g1@g.us',
      name: 'Group',
      unread: 3,
      lastActivity: '2026-06-09 20:00',
      group: true,
      muted: true,
      archived: true,
      pinned: true,
    });
  });

  it('omits unread when 0 and maps missing name to undefined', () => {
    const out = projectChat({ id: 'c2@c.us', unreadCount: 0 });
    expect(out).toEqual({ id: 'c2@c.us', name: undefined });
    expect(out).not.toHaveProperty('unread');
  });
});

describe('projectContact', () => {
  it('prefers name over pushname', () => {
    const c: ContactInfo = { id: '1@c.us', name: 'Real Name', pushname: 'Nick' };
    const out = projectContact(c);
    expect(out.name).toBe('Real Name');
    expect(out.pushname).toBe('Nick');
  });

  it('does not duplicate pushname when equal to name', () => {
    const c: ContactInfo = { id: '1@c.us', name: 'Same', pushname: 'Same' };
    expect(projectContact(c)).not.toHaveProperty('pushname');
  });

  it('falls back to pushname when no name', () => {
    const c: ContactInfo = { id: '1@c.us', pushname: 'Nick' };
    const out = projectContact(c);
    expect(out.name).toBe('Nick');
    expect(out).not.toHaveProperty('pushname');
  });

  it('includes blocked and business flags when true', () => {
    const c: ContactInfo = { id: '1@c.us', isBlocked: true, isBusiness: true };
    const out = projectContact(c);
    expect(out.blocked).toBe(true);
    expect(out.business).toBe(true);
  });

  it('omits blocked and business flags when falsy', () => {
    const out = projectContact({ id: '1@c.us', isBlocked: false });
    expect(out).not.toHaveProperty('blocked');
    expect(out).not.toHaveProperty('business');
  });
});
