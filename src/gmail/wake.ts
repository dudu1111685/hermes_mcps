import { createHmac } from 'node:crypto';
import { GmailMessage, GmailWatch } from './types.js';
import { header } from './matcher.js';

function signatureHeaders(body: Buffer, secret: string, requestId: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');
  return {
    'Content-Type': 'application/json',
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Signature-V2': signature,
    'X-Request-ID': requestId,
  };
}

export async function wakeGmailWatch(watch: GmailWatch, message: GmailMessage, timeoutMs = 30_000): Promise<Response> {
  const safeWatch = { ...watch } as Partial<GmailWatch>;
  delete safeWatch.wakeSecret;
  const payload = {
    event_type: 'gmail.logical_watch.message',
    watch: safeWatch,
    watch_control: {
      status: 'active', defaultAction: 'continue_listening', continueListening: true,
      closeTool: 'gmail_close_watch', closeArgs: { watchId: watch.id },
      instruction: `This Gmail watch remains active. Continue listening unless the sender appears finished and the objective is clear. Then call gmail_close_watch with watchId ${watch.id}.`,
    },
    gmail: {
      accountId: watch.accountId,
      accountEmail: watch.accountEmail,
      message: {
        id: message.id,
        threadId: message.threadId,
        labelIds: message.labelIds ?? [],
        historyId: message.historyId,
        internalDate: message.internalDate,
        snippet: message.snippet,
        from: header(message, 'From'),
        to: header(message, 'To'),
        cc: header(message, 'Cc'),
        subject: header(message, 'Subject'),
        date: header(message, 'Date'),
      },
    },
  };
  const bytes = Buffer.from(JSON.stringify(payload));
  return fetch(watch.wakeUrl, {
    method: 'POST', headers: signatureHeaders(bytes, watch.wakeSecret, `${watch.id}:${message.id}`),
    body: bytes, signal: AbortSignal.timeout(timeoutMs),
  });
}
