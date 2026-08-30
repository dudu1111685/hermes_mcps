#!/usr/bin/env node

import { PubSub, Message } from '@google-cloud/pubsub';
import { GwsClient } from './gws.js';
import { processGmailHistory } from './processor.js';
import { GmailWatchStore } from './store.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface WorkerConfig {
  project?: string;
  subscription?: string;
  topic?: string;
  labels: string[];
  reconcileInterval: number;
  renewalCheckInterval: number;
}

function config(): WorkerConfig {
  return {
    project: process.env.GMAIL_PUBSUB_PROJECT,
    subscription: process.env.GMAIL_PUBSUB_SUBSCRIPTION,
    topic: process.env.GMAIL_PUBSUB_TOPIC,
    labels: (process.env.GMAIL_WATCH_LABEL_IDS || 'INBOX').split(',').map((item) => item.trim()).filter(Boolean),
    reconcileInterval: Number(process.env.GMAIL_RECONCILE_SECONDS || 900),
    renewalCheckInterval: Number(process.env.GMAIL_RENEWAL_CHECK_SECONDS || 3600),
  };
}

async function ensureAccount(client: GwsClient, store: GmailWatchStore, cfg: WorkerConfig): Promise<void> {
  const profile = await client.profile();
  const accountId = process.env.GMAIL_ACCOUNT_ID || 'default';
  const current = await store.account();
  if (current && current.accountId !== accountId) {
    throw new Error(`Gmail account ID mismatch: stored=${current.accountId} configured=${accountId}`);
  }
  if (current && current.emailAddress.toLowerCase() !== profile.emailAddress.toLowerCase()) {
    throw new Error(`Gmail identity mismatch: stored=${current.emailAddress} live=${profile.emailAddress}`);
  }
  await store.updateAccount({
    accountId,
    emailAddress: profile.emailAddress,
    historyId: current?.historyId || profile.historyId,
    watchExpiration: current?.watchExpiration,
    topicName: cfg.topic || current?.topicName,
    subscriptionName: cfg.subscription || current?.subscriptionName,
    status: current?.status || 'configured',
    updatedAt: new Date().toISOString(),
  });
}

async function renewWatch(client: GwsClient, store: GmailWatchStore, cfg: WorkerConfig): Promise<void> {
  const account = await store.account();
  if (!account) throw new Error('Gmail account state is missing');
  const topicName = cfg.topic || account.topicName;
  if (!topicName) throw new Error('Set GMAIL_PUBSUB_TOPIC before starting the Gmail worker');
  const expiration = Number(account.watchExpiration || 0);
  if (expiration > Date.now() + 24 * 60 * 60 * 1000) return;
  const renewed = await client.raw(['users', 'watch'], { userId: 'me' }, {
    topicName,
    labelIds: cfg.labels,
    labelFilterBehavior: 'include',
  });
  // Renewal's historyId is a notification baseline, not permission to move the
  // durable processed cursor forward. Preserve the current cursor.
  await store.updateAccount({
    ...account,
    topicName,
    watchExpiration: renewed.expiration,
    status: 'ready',
    updatedAt: new Date().toISOString(),
  });
}

function maxHistoryId(values: string[]): string | undefined {
  return values.reduce<string | undefined>((max, item) => (!max || BigInt(item) > BigInt(max) ? item : max), undefined);
}

async function processRange(client: GwsClient, store: GmailWatchStore, targetHistoryId?: string): Promise<void> {
  const account = await store.account();
  if (!account) throw new Error('Gmail account state is not initialized');
  let result;
  try {
    result = await processGmailHistory({
      client,
      store,
      accountId: account.accountId,
      accountEmail: account.emailAddress,
      startHistoryId: account.historyId,
    });
  } catch (error) {
    const text = (error as Error).message.toLowerCase();
    if (text.includes('404') || text.includes('starthistoryid') || text.includes('history id')) {
      await store.updateAccount({ ...account, status: 'resync_required', updatedAt: new Date().toISOString() });
      throw new Error(`Gmail History cursor is stale; bounded full resync is required before advancing. ${(error as Error).message}`);
    }
    throw error;
  }
  if (result.deliveries.some((item) => !item.ok)) {
    throw new Error(`One or more Hermes wake deliveries failed: ${JSON.stringify(result.deliveries)}`);
  }
  const next = maxHistoryId([result.nextHistoryId, targetHistoryId || '0']) || result.nextHistoryId;
  await store.updateAccount({ ...account, historyId: next, status: 'ready', updatedAt: new Date().toISOString() });
}

function decodeNotification(message: Message): { emailAddress?: string; historyId?: string } {
  try {
    return JSON.parse(message.data.toString('utf8')) as { emailAddress?: string; historyId?: string };
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  const cfg = config();
  if (!cfg.project || !cfg.subscription) {
    throw new Error('Set GMAIL_PUBSUB_PROJECT and GMAIL_PUBSUB_SUBSCRIPTION. Pub/Sub uses dedicated Cloud credentials/ADC.');
  }
  const client = new GwsClient();
  const store = new GmailWatchStore();
  await ensureAccount(client, store, cfg);
  await renewWatch(client, store, cfg);

  const pubsub = new PubSub({ projectId: cfg.project });
  const subscription = pubsub.subscription(cfg.subscription, {
    flowControl: { maxMessages: 1, allowExcessMessages: false },
  });
  let processing: Promise<void> = Promise.resolve();
  let lastReconcile = 0;
  let stopping = false;

  const onMessage = (message: Message): void => {
    processing = processing.then(async () => {
      const notification = decodeNotification(message);
      const account = await store.account();
      if (!notification.historyId || !account || notification.emailAddress?.toLowerCase() !== account.emailAddress.toLowerCase()) {
        message.ack();
        return;
      }
      try {
        await processRange(client, store, notification.historyId);
        message.ack();
      } catch (error) {
        console.error('Gmail notification processing failed; nacking for retry:', error);
        message.nack();
      }
    });
  };
  const onError = (error: Error): void => console.error('Gmail Pub/Sub subscriber error:', error);
  subscription.on('message', onMessage);
  subscription.on('error', onError);
  console.error(`Gmail watch worker listening on ${cfg.subscription}`);

  const maintenance = (async () => {
    while (!stopping) {
      try {
        const now = Date.now();
        await ensureAccount(client, store, cfg);
        await renewWatch(client, store, cfg);
        if (now - lastReconcile >= cfg.reconcileInterval * 1000) {
          await processing;
          await processRange(client, store);
          lastReconcile = now;
        }
      } catch (error) {
        console.error('Gmail maintenance iteration failed:', error);
      }
      await sleep(cfg.renewalCheckInterval * 1000);
    }
  })();

  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    subscription.removeListener('message', onMessage);
    subscription.removeListener('error', onError);
    await processing;
    await subscription.close();
    await pubsub.close();
  };
  process.once('SIGINT', () => void shutdown().then(() => process.exit(0)));
  process.once('SIGTERM', () => void shutdown().then(() => process.exit(0)));
  await maintenance;
}

main().catch((error) => {
  console.error('Fatal Gmail watch worker error:', error);
  process.exit(1);
});
