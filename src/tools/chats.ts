import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WAHAClient } from '../client.js';
import { ChatInfo } from '../types.js';

export function registerChatTools(server: McpServer, client: WAHAClient): void {
  server.tool(
    'waha_list_chats',
    'List all chats in a WhatsApp session',
    {
      session: z.string().default('default').describe('Session name'),
      limit: z.number().default(50).describe('Number of chats to retrieve'),
      offset: z.number().default(0).describe('Offset for pagination'),
    },
    async ({ session, limit, offset }) => {
      try {
        const chats = await client.get<ChatInfo[]>(
          `/api/${encodeURIComponent(session)}/chats`,
          { limit, offset },
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(chats, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error listing chats: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_get_chat',
    'Get detailed info about a specific chat',
    {
      chatId: z.string().describe('Chat ID'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, session }) => {
      try {
        const chat = await client.get<ChatInfo>(
          `/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(chatId)}`,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(chat, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting chat: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_archive_chat',
    'Archive or unarchive a chat',
    {
      chatId: z.string().describe('Chat ID'),
      archive: z.boolean().default(true).describe('true to archive, false to unarchive'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, archive, session }) => {
      try {
        const action = archive ? 'archive' : 'unarchive';
        await client.post(
          `/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(chatId)}/${action}`,
        );
        return {
          content: [{ type: 'text', text: `Chat ${chatId} ${archive ? 'archived' : 'unarchived'} successfully.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error archiving chat: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_pin_chat',
    'Pin or unpin a chat',
    {
      chatId: z.string().describe('Chat ID'),
      pin: z.boolean().default(true).describe('true to pin, false to unpin'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, pin, session }) => {
      try {
        const action = pin ? 'pin' : 'unpin';
        await client.post(
          `/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(chatId)}/${action}`,
        );
        return {
          content: [{ type: 'text', text: `Chat ${chatId} ${pin ? 'pinned' : 'unpinned'} successfully.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error pinning chat: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_mute_chat',
    'Mute or unmute a chat',
    {
      chatId: z.string().describe('Chat ID'),
      mute: z.boolean().default(true).describe('true to mute, false to unmute'),
      duration: z.number().optional().describe('Mute duration in seconds (e.g. 86400 for 24h). Omit for indefinite.'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, mute, duration, session }) => {
      try {
        const action = mute ? 'mute' : 'unmute';
        const body: Record<string, unknown> = {};
        if (mute && duration) body.duration = duration;

        await client.post(
          `/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(chatId)}/${action}`,
          body,
        );
        return {
          content: [{ type: 'text', text: `Chat ${chatId} ${mute ? 'muted' : 'unmuted'} successfully.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error muting chat: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_delete_chat',
    'Delete a chat entirely',
    {
      chatId: z.string().describe('Chat ID'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, session }) => {
      try {
        await client.delete(
          `/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(chatId)}`,
        );
        return {
          content: [{ type: 'text', text: `Chat ${chatId} deleted successfully.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error deleting chat: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_clear_chat',
    'Clear all messages in a chat',
    {
      chatId: z.string().describe('Chat ID'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, session }) => {
      try {
        await client.post(
          `/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(chatId)}/clear`,
        );
        return {
          content: [{ type: 'text', text: `Chat ${chatId} cleared successfully.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error clearing chat: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
