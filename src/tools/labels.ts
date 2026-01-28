import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WAHAClient } from '../client.js';
import { Label } from '../types.js';

export function registerLabelTools(server: McpServer, client: WAHAClient): void {
  server.tool(
    'waha_get_labels',
    'Get all labels/categories in a WhatsApp session',
    {
      session: z.string().default('default').describe('Session name'),
    },
    async ({ session }) => {
      try {
        const labels = await client.get<Label[]>(
          `/api/${encodeURIComponent(session)}/labels`,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(labels, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting labels: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_create_label',
    'Create a new label',
    {
      name: z.string().describe('Label name'),
      color: z.number().optional().describe('Label color index'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ name, color, session }) => {
      try {
        const body: Record<string, unknown> = { name };
        if (color !== undefined) body.color = color;

        const result = await client.post<Label>(
          `/api/${encodeURIComponent(session)}/labels`,
          body,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error creating label: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_delete_label',
    'Delete a label',
    {
      labelId: z.string().describe('Label ID'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ labelId, session }) => {
      try {
        await client.delete(
          `/api/${encodeURIComponent(session)}/labels/${encodeURIComponent(labelId)}`,
        );
        return {
          content: [{ type: 'text', text: `Label ${labelId} deleted successfully.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error deleting label: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_add_label_to_chat',
    'Add a label to a chat',
    {
      labelId: z.string().describe('Label ID'),
      chatId: z.string().describe('Chat ID to label'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ labelId, chatId, session }) => {
      try {
        await client.post(
          `/api/${encodeURIComponent(session)}/labels/${encodeURIComponent(labelId)}/chats/${encodeURIComponent(chatId)}`,
        );
        return {
          content: [{ type: 'text', text: `Label ${labelId} added to chat ${chatId}.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error adding label to chat: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_remove_label_from_chat',
    'Remove a label from a chat',
    {
      labelId: z.string().describe('Label ID'),
      chatId: z.string().describe('Chat ID'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ labelId, chatId, session }) => {
      try {
        await client.delete(
          `/api/${encodeURIComponent(session)}/labels/${encodeURIComponent(labelId)}/chats/${encodeURIComponent(chatId)}`,
        );
        return {
          content: [{ type: 'text', text: `Label ${labelId} removed from chat ${chatId}.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error removing label from chat: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
