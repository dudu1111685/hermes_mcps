import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool } from '../utils/define-tool.js';
import { compactJson, listResponse } from '../utils/format.js';
import { GwsClient } from './gws.js';
import { GmailWatchStore } from './store.js';
import { GmailWatch, GmailWatchOrigin } from './types.js';

const originSchema = z.object({
  platform: z.string().min(1), chatId: z.string().min(1), chatType: z.string().min(1),
  threadId: z.string().optional(), userId: z.string().optional(), userIdAlt: z.string().optional(),
  profile: z.string().optional(), scopeId: z.string().optional(), sessionId: z.string().optional(), sessionKey: z.string().optional(),
});

function accountId(): string { return process.env.GMAIL_ACCOUNT_ID || 'default'; }
function wakeUrl(): string | undefined { return process.env.GMAIL_WATCH_DEFAULT_WAKE_URL; }
function wakeSecret(): string | undefined { return process.env.GMAIL_WATCH_DEFAULT_WAKE_SECRET; }
function safe(watch: GmailWatch): Record<string, unknown> { const { wakeSecret: _secret, ...rest } = watch; return rest; }
function validateOrigin(origin?: GmailWatchOrigin): GmailWatchOrigin {
  if (!origin) throw new Error('Gmail watches must be created from a live Hermes gateway session.');
  return origin;
}

const commonWatchSchema = {
  matchMode: z.enum(['thread', 'correspondent']),
  gmailThreadId: z.string().optional().describe('Required for matchMode=thread'),
  correspondents: z.array(z.string().email()).default([]).describe('Required for matchMode=correspondent; exact email addresses'),
  direction: z.enum(['from', 'to', 'either']).default('from'),
  subjectContains: z.string().optional(),
  labelIds: z.array(z.string()).default([]),
  objective: z.string().min(1),
  permissions: z.array(z.string()).default([]),
  expiresAt: z.string().optional(),
  _hermesOrigin: originSchema.optional().describe('Reserved Hermes return address, injected automatically'),
};

function validateScope(args: { matchMode: string; gmailThreadId?: string; correspondents: string[] }): void {
  if (args.matchMode === 'thread' && !args.gmailThreadId) throw new Error('gmailThreadId is required for matchMode=thread');
  if (args.matchMode === 'correspondent' && args.correspondents.length === 0) throw new Error('At least one correspondent is required for matchMode=correspondent');
}

async function create(store: GmailWatchStore, client: GwsClient, args: any): Promise<GmailWatch> {
  validateScope(args);
  const profile = await client.profile();
  const url = wakeUrl(); const secret = wakeSecret();
  if (!url || !secret) throw new Error('Set GMAIL_WATCH_DEFAULT_WAKE_URL and GMAIL_WATCH_DEFAULT_WAKE_SECRET.');
  return store.create({
    accountId: accountId(), accountEmail: profile.emailAddress, matchMode: args.matchMode,
    gmailThreadId: args.gmailThreadId, correspondents: args.correspondents, direction: args.direction,
    subjectContains: args.subjectContains, labelIds: args.labelIds, objective: args.objective,
    permissions: args.permissions, expiresAt: args.expiresAt, origin: validateOrigin(args._hermesOrigin),
    wakeUrl: url, wakeSecret: secret,
  });
}

export function registerGmailTools(server: McpServer, client = new GwsClient(), store = new GmailWatchStore()): void {
  defineTool(server, {
    name: 'gmail_profile', description: 'Read the Gmail account identity used by this MCP.', schema: {},
    annotations: { readOnlyHint: true }, handler: async () => compactJson(await client.profile()),
  });

  defineTool(server, {
    name: 'gmail_send', description: 'Send a normal email without opening a watch.',
    schema: { to: z.array(z.string().email()).min(1), subject: z.string(), body: z.string(), cc: z.array(z.string().email()).default([]), bcc: z.array(z.string().email()).default([]) },
    handler: async (args) => `Sent without watch. ${compactJson(await client.sendText(args))}`,
  });

  defineTool(server, {
    name: 'gmail_watch', description: 'Open a persistent logical Gmail watch without sending email. Match one Gmail thread or exact correspondent addresses. The infrastructure mailbox watch remains independent.',
    schema: commonWatchSchema, annotations: { idempotentHint: false },
    handler: async (args) => `Watch opened without sending. ${compactJson(safe(await create(store, client, args)))}`,
  });

  defineTool(server, {
    name: 'gmail_send_and_watch', description: 'Open a logical watch and send an email in one race-safe workflow. The watch is created before send and linked to the returned Gmail thread. If sending fails, the new watch is closed.',
    schema: {
      to: z.array(z.string().email()).min(1), subject: z.string(), body: z.string(),
      cc: z.array(z.string().email()).default([]), bcc: z.array(z.string().email()).default([]),
      correspondents: z.array(z.string().email()).default([]), objective: z.string().min(1), permissions: z.array(z.string()).default([]),
      direction: z.enum(['from', 'to', 'either']).default('from'), subjectContains: z.string().optional(), labelIds: z.array(z.string()).default([]),
      expiresAt: z.string().optional(), _hermesOrigin: originSchema.optional(),
    }, annotations: { idempotentHint: false },
    handler: async (args) => {
      const profile = await client.profile(); const url = wakeUrl(); const secret = wakeSecret();
      if (!url || !secret) throw new Error('Set GMAIL_WATCH_DEFAULT_WAKE_URL and GMAIL_WATCH_DEFAULT_WAKE_SECRET.');
      const watch = await store.create({
        accountId: accountId(), accountEmail: profile.emailAddress, matchMode: 'correspondent',
        correspondents: args.correspondents.length ? args.correspondents : args.to, direction: args.direction,
        subjectContains: args.subjectContains, labelIds: args.labelIds, objective: args.objective, permissions: args.permissions,
        expiresAt: args.expiresAt, origin: validateOrigin(args._hermesOrigin), wakeUrl: url, wakeSecret: secret,
      });
      try {
        const sent = await client.sendText(args);
        const linked = await store.update(watch.id, {
          matchMode: 'thread', gmailThreadId: sent.threadId, sentMessageId: sent.id,
        });
        return `Sent and watch active. messageId=${sent.id} threadId=${sent.threadId}. ${compactJson(safe(linked))}`;
      } catch (error) {
        await store.close(watch.id);
        throw new Error(`Email send failed; new watch was closed. ${(error as Error).message}`);
      }
    },
  });

  defineTool(server, {
    name: 'gmail_list_watches', description: 'List Gmail logical watches without secrets.',
    schema: { includeClosed: z.boolean().default(false) }, annotations: { readOnlyHint: true },
    handler: async ({ includeClosed }) => listResponse(await store.list({ includeClosed, accountId: accountId() }), { map: safe, label: 'gmail watches' }),
  });

  defineTool(server, {
    name: 'gmail_update_watch', description: 'Update an active Gmail logical watch.',
    schema: { watchId: z.string(), objective: z.string().optional(), permissions: z.array(z.string()).optional(), expiresAt: z.string().optional(), subjectContains: z.string().optional(), labelIds: z.array(z.string()).optional() },
    annotations: { idempotentHint: true }, handler: async ({ watchId, ...changes }) => `Watch updated. ${compactJson(safe(await store.update(watchId, changes)))}`,
  });

  defineTool(server, {
    name: 'gmail_close_watch', description: 'Explicitly close a Gmail logical watch when the sender appears finished and the objective is clear. Does not stop the mailbox-level Gmail users.watch infrastructure.',
    schema: { watchId: z.string() }, annotations: { idempotentHint: true },
    handler: async ({ watchId }) => `Watch closed. ${compactJson(safe(await store.close(watchId)))}`,
  });
}
