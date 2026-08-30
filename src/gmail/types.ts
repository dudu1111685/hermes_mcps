export type GmailWatchStatus = 'active' | 'closed';
export type GmailMatchMode = 'thread' | 'correspondent';
export type GmailDirection = 'from' | 'to' | 'either';

export interface GmailWatchOrigin {
  platform: string;
  chatId: string;
  chatType: string;
  threadId?: string;
  userId?: string;
  userIdAlt?: string;
  profile?: string;
  scopeId?: string;
  sessionId?: string;
  sessionKey?: string;
}

export interface GmailWatch {
  id: string;
  accountId: string;
  accountEmail: string;
  matchMode: GmailMatchMode;
  gmailThreadId?: string;
  correspondents: string[];
  direction: GmailDirection;
  subjectContains?: string;
  labelIds: string[];
  objective: string;
  permissions: string[];
  origin: GmailWatchOrigin;
  wakeUrl: string;
  wakeSecret: string;
  status: GmailWatchStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  closedAt?: string;
  sentMessageId?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  historyId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: {
    headers?: Array<{ name?: string; value?: string }>;
    body?: { data?: string; size?: number };
    parts?: unknown[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface GmailWatchAccountState {
  accountId: string;
  emailAddress: string;
  historyId: string;
  watchExpiration?: string;
  topicName?: string;
  subscriptionName?: string;
  status: string;
  updatedAt: string;
}
