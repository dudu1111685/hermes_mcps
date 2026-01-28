import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WAHAClient } from '../client.js';
import { ContactInfo, ContactExistsResult } from '../types.js';

export function registerContactTools(server: McpServer, client: WAHAClient): void {
  server.tool(
    'waha_get_contacts',
    'Get all contacts from a WhatsApp session',
    {
      session: z.string().default('default').describe('Session name'),
    },
    async ({ session }) => {
      try {
        const contacts = await client.get<ContactInfo[]>('/api/contacts/all', { session });
        return {
          content: [{ type: 'text', text: JSON.stringify(contacts, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting contacts: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_get_contact',
    'Get info about a specific contact',
    {
      contactId: z.string().describe('Contact ID (e.g. "1234567890@c.us")'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ contactId, session }) => {
      try {
        const contact = await client.get<ContactInfo>(
          `/api/contacts/${encodeURIComponent(contactId)}`,
          { session },
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(contact, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting contact: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_check_number_exists',
    'Check if a phone number is registered on WhatsApp',
    {
      phone: z.string().describe('Phone number to check (e.g. "1234567890" without + or country prefix variation)'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ phone, session }) => {
      try {
        const result = await client.get<ContactExistsResult>(
          '/api/contacts/check-exists',
          { session, phone },
        );
        const status = result.numberExists ? 'exists on WhatsApp' : 'does NOT exist on WhatsApp';
        let text = `Number ${phone} ${status}.`;
        if (result.chatId) text += `\nChat ID: ${result.chatId}`;
        return {
          content: [{ type: 'text', text }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error checking number: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_block_contact',
    'Block or unblock a contact',
    {
      contactId: z.string().describe('Contact ID (e.g. "1234567890@c.us")'),
      block: z.boolean().default(true).describe('true to block, false to unblock'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ contactId, block, session }) => {
      try {
        const action = block ? 'block' : 'unblock';
        await client.post(
          `/api/${encodeURIComponent(session)}/contacts/${encodeURIComponent(contactId)}/${action}`,
        );
        return {
          content: [{ type: 'text', text: `Contact ${contactId} ${block ? 'blocked' : 'unblocked'} successfully.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error ${block ? 'blocking' : 'unblocking'} contact: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_get_profile_picture',
    'Get the profile picture URL of a contact or group',
    {
      contactId: z.string().describe('Contact or group ID'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ contactId, session }) => {
      try {
        const result = await client.get<{ url: string }>(
          '/api/contacts/profile-picture',
          { session, contactId },
        );
        return {
          content: [{ type: 'text', text: `Profile picture URL for ${contactId}:\n${result.url}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting profile picture: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
