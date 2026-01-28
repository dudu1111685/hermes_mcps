import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WAHAClient } from '../client.js';
import { PresenceData } from '../types.js';

export function registerPresenceTools(server: McpServer, client: WAHAClient): void {
  server.tool(
    'waha_set_presence',
    'Set your presence status (online/offline)',
    {
      presence: z.enum(['online', 'offline']).describe('Presence status to set'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ presence, session }) => {
      try {
        await client.post(`/api/${encodeURIComponent(session)}/presence`, { presence });
        return {
          content: [{ type: 'text', text: `Presence set to "${presence}".` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error setting presence: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_get_presence',
    'Get presence status of a contact (online/offline/typing)',
    {
      contactId: z.string().describe('Contact ID (e.g. "1234567890@c.us")'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ contactId, session }) => {
      try {
        const presence = await client.get<PresenceData[]>(
          `/api/${encodeURIComponent(session)}/presence/${encodeURIComponent(contactId)}`,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(presence, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting presence: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_start_typing',
    'Show typing indicator in a chat (simulates real user behavior)',
    {
      chatId: z.string().describe('Chat ID'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, session }) => {
      try {
        await client.post('/api/startTyping', { session, chatId });
        return {
          content: [{ type: 'text', text: `Typing indicator started in ${chatId}.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error starting typing: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_stop_typing',
    'Stop showing typing indicator in a chat',
    {
      chatId: z.string().describe('Chat ID'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, session }) => {
      try {
        await client.post('/api/stopTyping', { session, chatId });
        return {
          content: [{ type: 'text', text: `Typing indicator stopped in ${chatId}.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error stopping typing: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_send_status',
    'Post a text status/story update',
    {
      text: z.string().describe('Status text'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ text, session }) => {
      try {
        const result = await client.post<{ id: string }>('/api/sendText', {
          session,
          chatId: 'status@broadcast',
          text,
        });
        return {
          content: [{ type: 'text', text: `Status posted successfully.\nMessage ID: ${result.id}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error posting status: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
