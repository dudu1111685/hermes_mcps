import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WAHAClient } from '../client.js';
import { SessionInfo } from '../types.js';

export function registerSessionTools(server: McpServer, client: WAHAClient): void {
  server.tool(
    'waha_list_sessions',
    'List all WhatsApp sessions and their statuses',
    {},
    async () => {
      try {
        const sessions = await client.get<SessionInfo[]>('/api/sessions');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(sessions, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error listing sessions: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_get_session',
    'Get detailed info about a specific WhatsApp session',
    {
      session: z.string().default('default').describe('Session name'),
    },
    async ({ session }) => {
      try {
        const info = await client.get<SessionInfo>(`/api/sessions/${encodeURIComponent(session)}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(info, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting session: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_create_session',
    'Create a new WhatsApp session',
    {
      name: z.string().default('default').describe('Session name'),
      webhookUrl: z.string().optional().describe('Webhook URL for events'),
      webhookEvents: z.array(z.string()).optional().describe('Events to subscribe to (e.g. ["message", "session.status"])'),
      enableStore: z.boolean().optional().describe('Enable NOWEB store for chats/contacts/messages history'),
      fullSync: z.boolean().optional().describe('Full sync (1 year history) vs partial (3 months)'),
    },
    async ({ name, webhookUrl, webhookEvents, enableStore, fullSync }) => {
      try {
        const config: Record<string, unknown> = {};

        if (webhookUrl) {
          config.webhooks = [{
            url: webhookUrl,
            events: webhookEvents ?? ['message', 'session.status'],
          }];
        }

        if (enableStore !== undefined) {
          config.noweb = {
            store: {
              enabled: enableStore,
              fullSync: fullSync ?? false,
            },
          };
        }

        const result = await client.post<SessionInfo>('/api/sessions', {
          name,
          config: Object.keys(config).length > 0 ? config : undefined,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error creating session: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_start_session',
    'Start a stopped WhatsApp session',
    {
      session: z.string().default('default').describe('Session name'),
    },
    async ({ session }) => {
      try {
        const result = await client.post<SessionInfo>(`/api/sessions/${encodeURIComponent(session)}/start`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error starting session: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_stop_session',
    'Stop a running WhatsApp session',
    {
      session: z.string().default('default').describe('Session name'),
    },
    async ({ session }) => {
      try {
        const result = await client.post<SessionInfo>(`/api/sessions/${encodeURIComponent(session)}/stop`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error stopping session: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_restart_session',
    'Restart a WhatsApp session',
    {
      session: z.string().default('default').describe('Session name'),
    },
    async ({ session }) => {
      try {
        const result = await client.post<SessionInfo>(`/api/sessions/${encodeURIComponent(session)}/restart`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error restarting session: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_delete_session',
    'Delete a WhatsApp session permanently',
    {
      session: z.string().default('default').describe('Session name'),
    },
    async ({ session }) => {
      try {
        await client.delete(`/api/sessions/${encodeURIComponent(session)}`);
        return {
          content: [{ type: 'text', text: `Session "${session}" deleted successfully.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error deleting session: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_logout_session',
    'Logout from a WhatsApp session (keeps session but disconnects WhatsApp account)',
    {
      session: z.string().default('default').describe('Session name'),
    },
    async ({ session }) => {
      try {
        await client.post(`/api/sessions/${encodeURIComponent(session)}/logout`);
        return {
          content: [{ type: 'text', text: `Session "${session}" logged out successfully.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error logging out: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
