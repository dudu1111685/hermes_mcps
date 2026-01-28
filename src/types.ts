// WAHA API Types

export interface WAHAConfig {
  baseUrl: string;
  apiKey: string;
}

// Session types
export type SessionStatus = 'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED';

export interface SessionInfo {
  name: string;
  status: SessionStatus;
  config?: SessionConfig;
  me?: SessionMe;
  engine?: string;
}

export interface SessionMe {
  id: string;
  pushName?: string;
}

export interface SessionConfig {
  debug?: boolean;
  webhooks?: WebhookConfig[];
  noweb?: { store?: { enabled?: boolean; fullSync?: boolean } };
  proxy?: { server: string; username?: string; password?: string };
}

export interface WebhookConfig {
  url: string;
  events?: string[];
  hmac?: { key: string };
  customHeaders?: Array<{ name: string; value: string }>;
  retries?: { policy: string; delaySeconds: number; attempts: number };
}

// Chat ID formats
// User: 123456789@c.us
// Group: 123456789@g.us
// Channel: 123456789@newsletter

// Message types
export interface MessageFile {
  mimetype?: string;
  url?: string;
  data?: string;
  filename?: string;
}

export interface WAMessage {
  id: string;
  timestamp: number;
  from: string;
  fromMe: boolean;
  to: string;
  body: string;
  hasMedia: boolean;
  media?: {
    url: string;
    mimetype: string;
    filename?: string;
  };
  ack: number;
  ackName: string;
  replyTo?: string;
}

export interface SendResult {
  id: string;
  timestamp?: number;
}

// Chat types
export interface ChatInfo {
  id: string;
  name?: string;
  timestamp?: number;
  unreadCount?: number;
  isGroup?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  isPinned?: boolean;
}

// Contact types
export interface ContactInfo {
  id: string;
  name?: string;
  pushname?: string;
  shortName?: string;
  isBlocked?: boolean;
  isMe?: boolean;
  isBusiness?: boolean;
}

export interface ContactExistsResult {
  chatId: string;
  numberExists: boolean;
}

// Group types
export interface GroupInfo {
  id: string;
  subject: string;
  description?: string;
  invite?: string;
  participants?: GroupParticipant[];
  membersCanSendMessages?: boolean;
  membersCanAddNewMember?: boolean;
  newMembersApprovalRequired?: boolean;
}

export interface GroupParticipant {
  id: string;
  role: 'participant' | 'admin' | 'superadmin' | 'left';
}

// Label types
export interface Label {
  id: string;
  name: string;
  color?: number;
  colorHex?: string;
}

// Presence types
export type PresenceStatus = 'online' | 'offline' | 'typing' | 'recording';

export interface PresenceData {
  id: string;
  participant?: string;
  lastKnownPresence?: string;
  lastSeen?: number;
}

// API Error
export interface WAHAError {
  statusCode: number;
  message: string;
  error?: string;
}
