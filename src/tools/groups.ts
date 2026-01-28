import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WAHAClient } from '../client.js';
import { GroupInfo, GroupParticipant } from '../types.js';

export function registerGroupTools(server: McpServer, client: WAHAClient): void {
  server.tool(
    'waha_create_group',
    'Create a new WhatsApp group',
    {
      name: z.string().describe('Group name/subject'),
      participants: z.array(z.string()).describe('Participant IDs to add (e.g. ["1234567890@c.us"])'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ name, participants, session }) => {
      try {
        const result = await client.post<GroupInfo>(
          `/api/${encodeURIComponent(session)}/groups`,
          {
            name,
            participants: participants.map(id => ({ id })),
          },
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error creating group: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_list_groups',
    'List all WhatsApp groups',
    {
      session: z.string().default('default').describe('Session name'),
      limit: z.number().default(50).describe('Number of groups to retrieve'),
      offset: z.number().default(0).describe('Offset for pagination'),
    },
    async ({ session, limit, offset }) => {
      try {
        const groups = await client.get<GroupInfo[]>(
          `/api/${encodeURIComponent(session)}/groups`,
          { limit, offset },
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(groups, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error listing groups: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_get_group',
    'Get detailed info about a specific group',
    {
      groupId: z.string().describe('Group ID (e.g. "1234567890@g.us")'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ groupId, session }) => {
      try {
        const group = await client.get<GroupInfo>(
          `/api/${encodeURIComponent(session)}/groups/${encodeURIComponent(groupId)}`,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(group, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting group: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_get_group_participants',
    'List all participants in a group',
    {
      groupId: z.string().describe('Group ID'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ groupId, session }) => {
      try {
        const participants = await client.get<GroupParticipant[]>(
          `/api/${encodeURIComponent(session)}/groups/${encodeURIComponent(groupId)}/participants`,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(participants, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting participants: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_add_group_participants',
    'Add participants to a group',
    {
      groupId: z.string().describe('Group ID'),
      participants: z.array(z.string()).describe('Participant IDs to add (e.g. ["1234567890@c.us"])'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ groupId, participants, session }) => {
      try {
        await client.post(
          `/api/${encodeURIComponent(session)}/groups/${encodeURIComponent(groupId)}/participants/add`,
          { participants: participants.map(id => ({ id })) },
        );
        return {
          content: [{ type: 'text', text: `Added ${participants.length} participant(s) to group ${groupId}.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error adding participants: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_remove_group_participants',
    'Remove participants from a group',
    {
      groupId: z.string().describe('Group ID'),
      participants: z.array(z.string()).describe('Participant IDs to remove'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ groupId, participants, session }) => {
      try {
        await client.post(
          `/api/${encodeURIComponent(session)}/groups/${encodeURIComponent(groupId)}/participants/remove`,
          { participants: participants.map(id => ({ id })) },
        );
        return {
          content: [{ type: 'text', text: `Removed ${participants.length} participant(s) from group ${groupId}.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error removing participants: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_promote_group_participant',
    'Promote participant(s) to group admin',
    {
      groupId: z.string().describe('Group ID'),
      participants: z.array(z.string()).describe('Participant IDs to promote'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ groupId, participants, session }) => {
      try {
        await client.post(
          `/api/${encodeURIComponent(session)}/groups/${encodeURIComponent(groupId)}/admin/promote`,
          { participants: participants.map(id => ({ id })) },
        );
        return {
          content: [{ type: 'text', text: `Promoted ${participants.length} participant(s) to admin in group ${groupId}.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error promoting participants: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_demote_group_participant',
    'Demote admin(s) to regular participant in a group',
    {
      groupId: z.string().describe('Group ID'),
      participants: z.array(z.string()).describe('Participant IDs to demote'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ groupId, participants, session }) => {
      try {
        await client.post(
          `/api/${encodeURIComponent(session)}/groups/${encodeURIComponent(groupId)}/admin/demote`,
          { participants: participants.map(id => ({ id })) },
        );
        return {
          content: [{ type: 'text', text: `Demoted ${participants.length} participant(s) in group ${groupId}.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error demoting participants: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_update_group_subject',
    'Update the name/subject of a group',
    {
      groupId: z.string().describe('Group ID'),
      subject: z.string().describe('New group name'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ groupId, subject, session }) => {
      try {
        await client.put(
          `/api/${encodeURIComponent(session)}/groups/${encodeURIComponent(groupId)}/subject`,
          { subject },
        );
        return {
          content: [{ type: 'text', text: `Group ${groupId} name updated to "${subject}".` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error updating group subject: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_update_group_description',
    'Update the description of a group',
    {
      groupId: z.string().describe('Group ID'),
      description: z.string().describe('New group description'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ groupId, description, session }) => {
      try {
        await client.put(
          `/api/${encodeURIComponent(session)}/groups/${encodeURIComponent(groupId)}/description`,
          { description },
        );
        return {
          content: [{ type: 'text', text: `Group ${groupId} description updated.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error updating group description: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_update_group_picture',
    'Set the profile picture of a group',
    {
      groupId: z.string().describe('Group ID'),
      imageUrl: z.string().describe('URL of the image to set as group picture'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ groupId, imageUrl, session }) => {
      try {
        await client.put(
          `/api/${encodeURIComponent(session)}/groups/${encodeURIComponent(groupId)}/picture`,
          { file: { url: imageUrl } },
        );
        return {
          content: [{ type: 'text', text: `Group ${groupId} picture updated.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error updating group picture: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_leave_group',
    'Leave a WhatsApp group',
    {
      groupId: z.string().describe('Group ID'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ groupId, session }) => {
      try {
        await client.post(
          `/api/${encodeURIComponent(session)}/groups/${encodeURIComponent(groupId)}/leave`,
        );
        return {
          content: [{ type: 'text', text: `Left group ${groupId} successfully.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error leaving group: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_get_group_invite_code',
    'Get the invite link/code for a group',
    {
      groupId: z.string().describe('Group ID'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ groupId, session }) => {
      try {
        const code = await client.get<string>(
          `/api/${encodeURIComponent(session)}/groups/${encodeURIComponent(groupId)}/invite-code`,
        );
        return {
          content: [{
            type: 'text',
            text: `Group invite code: ${code}\nInvite link: https://chat.whatsapp.com/${code}`,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting invite code: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_revoke_group_invite',
    'Revoke the current invite link and generate a new one',
    {
      groupId: z.string().describe('Group ID'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ groupId, session }) => {
      try {
        await client.post(
          `/api/${encodeURIComponent(session)}/groups/${encodeURIComponent(groupId)}/invite-code/revoke`,
        );
        return {
          content: [{ type: 'text', text: `Invite code for group ${groupId} revoked. Use waha_get_group_invite_code to get the new code.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error revoking invite: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
