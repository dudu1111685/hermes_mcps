#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GwsClient } from './gws.js';
import { processGmailHistory } from './processor.js';
import { GmailWatchStore } from './store.js';

const execFileAsync = promisify(execFile);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface WatchConfig {
  project?: string;
  subscription?: string;
  topic?: string;
  labels: string[];
  pollInterval: number;
  reconcileInterval: number;
}

function config(): WatchConfig {
  return {
    project: process.env.GMAIL_PUBSUB_PROJECT,
    subscription: process.env.GMAIL_PUBSUB_SUBSCRIPTION,
    topic: process.env.GMAIL_PUBSUB_TOPIC,
    labels: (process.env.GMAIL_WATCH_LABEL_IDS || 'INBOX').split(',').map((item) => item.trim()).filter(Boolean),
    pollInterval: Number(process.env.GMAIL_WORKER_POLL_SECONDS || 5),
    reconcileInterval: Number(process.env.GMAIL_RECONCILE_SECONDS || 900),
  };
}

async function runGws(args: string[], timeout = 120_000): Promise<string> {
  const binary = process.env.GMAIL_GWS_BIN || 'gws';
  const { stdout, stderr } = await execFileAsync(binary, args, {
    env: {
      ...process.env,
      GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND: process.env.GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND || 'file',
      ...(process.env.GMAIL_GWS_XDG_CONFIG_HOME ? { XDG_CONFIG_HOME: process.env.GMAIL_GWS_XDG_CONFIG_HOME } : {}),
    },
    timeout,
    maxBuffer: 20 * 1024 * 1024,
  });
  return `${stdout}\n${stderr}`;
}

function parseJsonLines(text: string): any[] {
  const values: any[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('{')) continue;
    try { values.push(JSON.parse(line)); } catch { /* ignore progress lines */ }
  }
  return values;
}

function historyIdsFromOutput(text: string): string[] {
  const ids: string[] = [];
  const visit = (value: any): void => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.historyId === 'string') ids.push(value.historyId);
    if (Array.isArray(value)) value.forEach(visit);
    else Object.values(value).forEach(visit);
  };
  parseJsonLines(text).forEach(visit);
  return ids;
}

async function ensureInfrastructure(client: GwsClient, store: GmailWatchStore, cfg: WatchConfig): Promise<string> {
  const profile = await client.profile();
  const current = await store.account();
  const subscription = cfg.subscription || current?.subscriptionName;
  const topic = cfg.topic || current?.topicName;
  const now = Date.now();
  const expiresSoon = !current?.watchExpiration || Number(current.watchExpiration) <= now + 24 * 60 * 60 * 1000;
  if (subscription && topic && expiresSoon) {
    const renewed = await client.raw(['users', 'watch'], { userId: 'me' }, {
      topicName: topic, labelIds: cfg.labels, labelFilterBehavior: 'INCLUDE',
    });
    await store.updateAccount({
      accountId: process.env.GMAIL_ACCOUNT_ID || 'default', emailAddress: profile.emailAddress,
      historyId: current?.historyId || profile.historyId, watchExpiration: renewed.expiration,
      topicName: topic, subscriptionName: subscription, status: 'ready', updatedAt: new Date().toISOString(),
    });
    return subscription;
  }
  const accountId = process.env.GMAIL_ACCOUNT_ID || 'default';
  if (subscription) {
    await store.updateAccount({
      accountId, emailAddress: profile.emailAddress, historyId: current?.historyId || profile.historyId,
      watchExpiration: current?.watchExpiration, topicName: cfg.topic || current?.topicName,
      subscriptionName: subscription, status: 'ready', updatedAt: new Date().toISOString(),
    });
    return subscription;
  }
  if (!cfg.project) throw new Error('Set GMAIL_PUBSUB_PROJECT or GMAIL_PUBSUB_SUBSCRIPTION.');
  const args = ['gmail', '+watch', '--project', cfg.project, '--once', '--label-ids', cfg.labels.join(',')];
  if (cfg.topic) args.push('--topic', cfg.topic);
  const output = await runGws(args, 180_000);
  const subscriptionMatch = output.match(/Pub\/Sub subscription:\s*(projects\/[^\s]+\/subscriptions\/[^\s]+)/)
    || output.match(/--subscription\s+(projects\/[^\s]+\/subscriptions\/[^\s]+)/);
  const topicMatch = output.match(/Pub\/Sub topic:\s*(projects\/[^\s]+\/topics\/[^\s]+)/);
  if (!subscriptionMatch) throw new Error(`gws created no discoverable subscription: ${output.slice(-1000)}`);
  const watchMatch = output.match(/historyId:\s*(\d+).*expires:\s*(\d+)/s);
  await store.updateAccount({
    accountId, emailAddress: profile.emailAddress, historyId: watchMatch?.[1] || profile.historyId,
    watchExpiration: watchMatch?.[2], topicName: topicMatch?.[1] || cfg.topic,
    subscriptionName: subscriptionMatch[1], status: 'ready', updatedAt: new Date().toISOString(),
  });
  return subscriptionMatch[1];
}

async function processOnce(client: GwsClient, store: GmailWatchStore, targetHistoryId?: string): Promise<void> {
  const account = await store.account();
  if (!account) throw new Error('Gmail account state is not initialized');
  const result = await processGmailHistory({
    client, store, accountId: account.accountId, accountEmail: account.emailAddress,
    startHistoryId: account.historyId,
  });
  if (result.deliveries.some((item) => !item.ok)) {
    throw new Error(`One or more Hermes wake deliveries failed: ${JSON.stringify(result.deliveries)}`);
  }
  const nextHistoryId = BigInt(targetHistoryId || '0') > BigInt(result.nextHistoryId || '0')
    ? targetHistoryId!
    : result.nextHistoryId;
  await store.updateAccount({ ...account, historyId: nextHistoryId, updatedAt: new Date().toISOString() });
}

async function pullOnce(subscription: string): Promise<{ hadNotification: boolean; maxHistoryId?: string }> {
  const output = await runGws(['gmail', '+watch', '--subscription', subscription, '--once']);
  const historyIds = historyIdsFromOutput(output);
  const maxHistoryId = historyIds.reduce<string | undefined>((max, item) => {
    if (!max || BigInt(item) > BigInt(max)) return item;
    return max;
  }, undefined);
  return { hadNotification: historyIds.length > 0, maxHistoryId };
}

async function main(): Promise<void> {
  const cfg = config();
  const client = new GwsClient();
  const store = new GmailWatchStore();
  const subscription = await ensureInfrastructure(client, store, cfg);
  let lastReconcile = 0;
  console.error(`Gmail watch worker using ${subscription}`);
  for (;;) {
    try {
      const pulled = await pullOnce(subscription);
      const now = Date.now();
      if (pulled.hadNotification || now - lastReconcile >= cfg.reconcileInterval * 1000) {
        await processOnce(client, store, pulled.maxHistoryId);
        lastReconcile = now;
      }
    } catch (error) {
      console.error('Gmail watch worker iteration failed:', error);
    }
    await sleep(cfg.pollInterval * 1000);
  }
}

main().catch((error) => {
  console.error('Fatal Gmail watch worker error:', error);
  process.exit(1);
});
