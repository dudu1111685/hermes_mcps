import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WAHAClient } from '../client.js';

export function registerAuthTools(server: McpServer, client: WAHAClient): void {
  server.tool(
    'waha_get_qr_code',
    'Get QR code for WhatsApp authentication. Returns the raw QR string value that can be used to generate a scannable QR code.',
    {
      session: z.string().default('default').describe('Session name'),
    },
    async ({ session }) => {
      try {
        const qr = await client.get<string>(
          `/api/${encodeURIComponent(session)}/auth/qr`,
          { format: 'raw' },
        );
        return {
          content: [{ type: 'text', text: `QR Code value for session "${session}":\n${qr}` }],
        };
      } catch (error) {
        const msg = (error as Error).message;
        if (msg.includes('404') || msg.includes('not found')) {
          return {
            content: [{ type: 'text', text: `Session "${session}" is not in QR scan state. Check session status first.` }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: `Error getting QR code: ${msg}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_request_pairing_code',
    'Request a pairing code for phone number authentication (alternative to QR code). The user will receive a code on their phone to enter in WhatsApp.',
    {
      session: z.string().default('default').describe('Session name'),
      phoneNumber: z.string().describe('Phone number in international format without + (e.g. "12132132130")'),
    },
    async ({ session, phoneNumber }) => {
      try {
        const result = await client.post<{ code: string }>(
          `/api/${encodeURIComponent(session)}/auth/request-code`,
          { phoneNumber },
        );
        return {
          content: [{
            type: 'text',
            text: `Pairing code requested for ${phoneNumber} on session "${session}".\nCode: ${result.code}\nEnter this code in WhatsApp on your phone.`,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error requesting pairing code: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_check_auth_status',
    'Check the authentication status of a WhatsApp session',
    {
      session: z.string().default('default').describe('Session name'),
    },
    async ({ session }) => {
      try {
        const info = await client.get<{ status: string; me?: { id: string; pushName?: string } }>(
          `/api/sessions/${encodeURIComponent(session)}`,
        );
        const statusMessages: Record<string, string> = {
          STOPPED: 'Session is stopped. Start it first.',
          STARTING: 'Session is starting up...',
          SCAN_QR_CODE: 'Waiting for QR code scan. Use waha_get_qr_code or waha_request_pairing_code.',
          WORKING: 'Session is authenticated and working.',
          FAILED: 'Session has failed. Try restarting or re-authenticating.',
        };
        const description = statusMessages[info.status] ?? `Unknown status: ${info.status}`;
        let text = `Session: ${session}\nStatus: ${info.status}\n${description}`;
        if (info.me) {
          text += `\nAccount ID: ${info.me.id}`;
          if (info.me.pushName) text += `\nName: ${info.me.pushName}`;
        }
        return {
          content: [{ type: 'text', text }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error checking auth status: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
