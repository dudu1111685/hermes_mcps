export type WatchStatus = 'active' | 'closed';

export interface WatchOrigin {
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

export interface ChatWatch {
  id: string;
  session: string;
  chatId: string;
  objective: string;
  allowedSenders: string[];
  permissions: string[];
  origin: WatchOrigin;
  wakeUrl: string;
  wakeSecret: string;
  expiresAt?: string;
  status: WatchStatus;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface WatchStoreDocument {
  version: 1;
  watches: ChatWatch[];
}

export interface WahaWebhookMessage {
  id?: string;
  timestamp?: number;
  from?: string;
  to?: string;
  fromMe?: boolean;
  participant?: string;
  body?: string;
  hasMedia?: boolean;
  media?: {
    url?: string;
    mimetype?: string;
    filename?: string;
  };
  replyTo?: unknown;
  [key: string]: unknown;
}

export interface WahaWebhookBody {
  event?: string;
  session?: string;
  payload?: WahaWebhookMessage;
  [key: string]: unknown;
}

export interface WakePayload {
  event_type: 'waha.chat_watch.message';
  watch: Omit<ChatWatch, 'wakeSecret'>;
  watch_control: {
    status: 'active';
    defaultAction: 'continue_listening';
    continueListening: true;
    closeTool: 'waha_close_chat_watch';
    closeArgs: { watchId: string };
    instruction: string;
  };
  whatsapp: {
    event: string;
    session: string;
    chatId: string;
    senderId: string;
    message: WahaWebhookMessage;
  };
}
