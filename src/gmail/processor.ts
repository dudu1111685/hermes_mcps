import { GwsClient } from './gws.js';
import { matchesGmailWatch } from './matcher.js';
import { GmailWatchStore } from './store.js';
import { GmailMessage } from './types.js';
import { wakeGmailWatch } from './wake.js';

export interface GmailProcessResult {
  startHistoryId: string;
  nextHistoryId: string;
  messageIds: string[];
  deliveries: Array<{ watchId: string; messageId: string; ok: boolean; status: number; error?: string }>;
}

export async function collectHistoryMessages(client: GwsClient, startHistoryId: string): Promise<{ nextHistoryId: string; messages: GmailMessage[] }> {
  let pageToken: string | undefined;
  let nextHistoryId = startHistoryId;
  const ids = new Set<string>();
  do {
    const page = await client.history(startHistoryId, pageToken);
    nextHistoryId = page.historyId || nextHistoryId;
    for (const record of page.history ?? []) {
      for (const item of record.messagesAdded ?? []) if (item.message?.id) ids.add(item.message.id);
      // Some clients expose only history.messages even when historyTypes=messageAdded.
      for (const message of record.messages ?? []) if (message.id) ids.add(message.id);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  const messages = await Promise.all([...ids].map((id) => client.message(id, 'full')));
  return { nextHistoryId, messages };
}

export async function processGmailHistory(input: {
  client: GwsClient; store: GmailWatchStore; accountId: string; accountEmail: string;
  startHistoryId: string; wakeTimeoutMs?: number;
}): Promise<GmailProcessResult> {
  const { nextHistoryId, messages } = await collectHistoryMessages(input.client, input.startHistoryId);
  const watches = await input.store.list({ accountId: input.accountId });
  const deliveries: GmailProcessResult['deliveries'] = [];
  for (const message of messages) {
    for (const watch of watches) {
      if (watch.accountEmail.toLowerCase() !== input.accountEmail.toLowerCase()) continue;
      if (!matchesGmailWatch(watch, message)) continue;
      if (await input.store.wasProcessed(input.accountId, watch.id, message.id)) continue;
      try {
        const response = await wakeGmailWatch(watch, message, input.wakeTimeoutMs);
        deliveries.push({ watchId: watch.id, messageId: message.id, ok: response.ok, status: response.status });
        if (response.ok) await input.store.markProcessed(input.accountId, watch.id, message.id);
      } catch (error) {
        deliveries.push({ watchId: watch.id, messageId: message.id, ok: false, status: 0, error: (error as Error).message });
      }
    }
  }
  return { startHistoryId: input.startHistoryId, nextHistoryId, messageIds: messages.map((item) => item.id), deliveries };
}
