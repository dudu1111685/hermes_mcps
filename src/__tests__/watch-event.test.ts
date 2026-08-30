import { describe, expect, it } from 'vitest';
import { matchesWatch, resolveChatId, resolveSenderId } from '../watch/event.js';
import { ChatWatch, WahaWebhookBody } from '../watch/types.js';

const watch: ChatWatch = {
  id: 'watch-1', session: 'default', chatId: '123@c.us', objective: 'finish',
  allowedSenders: [], permissions: [], wakeUrl: 'http://localhost/hook', wakeSecret: 'secret',
  status: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};

const event = (over: Partial<WahaWebhookBody> = {}): WahaWebhookBody => ({
  event: 'message',
  session: 'default',
  payload: {
    id: 'm1', timestamp: 1, from: '123@c.us', to: 'me@c.us', fromMe: false,
    body: 'hello', hasMedia: false,
  },
  ...over,
});

describe('watch event matching', () => {
  it('matches incoming direct messages and resolves identities', () => {
    const body = event();
    expect(resolveChatId(body)).toBe('123@c.us');
    expect(resolveSenderId(body)).toBe('123@c.us');
    expect(matchesWatch(watch, body)).toBe(true);
  });

  it('ignores outgoing messages and unrelated chats', () => {
    expect(matchesWatch(watch, event({ payload: { ...event().payload!, fromMe: true } }))).toBe(false);
    expect(matchesWatch(watch, event({ payload: { ...event().payload!, from: '999@c.us' } }))).toBe(false);
  });

  it('uses GOWS SenderAlt to map an incoming LID back to the stable direct-chat JID', () => {
    const body = event({
      payload: {
        ...event().payload!,
        from: '205699606958104@lid',
        _data: {
          Info: {
            Chat: '205699606958104@lid',
            Sender: '205699606958104@lid',
            SenderAlt: '123@s.whatsapp.net',
          },
        },
      },
    });
    expect(resolveChatId(body)).toBe('123@c.us');
    expect(resolveSenderId(body)).toBe('123@c.us');
    expect(matchesWatch({ ...watch, allowedSenders: ['123@c.us'] }, body)).toBe(true);
  });

  it('matches a direct watch stored as LID when SenderAlt normalizes the event to c.us', () => {
    const body = event({
      payload: {
        ...event().payload!,
        from: '205699606958104@lid',
        hasMedia: true,
        media: { mimetype: 'audio/ogg; codecs=opus', url: 'http://waha/file.oga' },
        _data: {
          Info: {
            Chat: '205699606958104@lid',
            Sender: '205699606958104@lid',
            SenderAlt: '123@s.whatsapp.net',
            MediaType: 'ptt',
          },
        },
      },
    });
    const lidWatch = { ...watch, chatId: '205699606958104@lid', allowedSenders: ['123@c.us'] };
    expect(resolveChatId(body)).toBe('123@c.us');
    expect(matchesWatch(lidWatch, body)).toBe(true);
  });

  it('uses participant as sender for group messages without relaxing sender scope', () => {
    const groupWatch = { ...watch, chatId: '120363@g.us', allowedSenders: ['555@c.us'] };
    const body = event({ payload: { ...event().payload!, from: '120363@g.us', participant: '555@c.us' } });
    expect(resolveChatId(body)).toBe('120363@g.us');
    expect(resolveSenderId(body)).toBe('555@c.us');
    expect(matchesWatch(groupWatch, body)).toBe(true);
    expect(matchesWatch(groupWatch, event({
      payload: { ...event().payload!, from: '120363@g.us', participant: '999@lid' },
    }))).toBe(false);
  });

  it('does not mistake group SenderAlt for the chat ID', () => {
    const groupWatch = { ...watch, chatId: '120363@g.us', allowedSenders: ['555@c.us'] };
    const body = event({ payload: {
      ...event().payload!, from: '120363@g.us', participant: '555@c.us',
      _data: { Info: {
        Chat: '120363@g.us', Sender: '999@lid', SenderAlt: '555@s.whatsapp.net',
        IsGroup: true,
      } },
    } });
    expect(resolveChatId(body)).toBe('120363@g.us');
    expect(resolveSenderId(body)).toBe('555@c.us');
    expect(matchesWatch(groupWatch, body)).toBe(true);
  });
});
