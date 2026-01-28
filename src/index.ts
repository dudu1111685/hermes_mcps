#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WAHAClient } from './client.js';
import { registerSessionTools } from './tools/sessions.js';
import { registerAuthTools } from './tools/auth.js';
import { registerMessageTools } from './tools/messages.js';
import { registerChatTools } from './tools/chats.js';
import { registerContactTools } from './tools/contacts.js';
import { registerGroupTools } from './tools/groups.js';
import { registerPresenceTools } from './tools/presence.js';
import { registerLabelTools } from './tools/labels.js';

const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3001';
const WAHA_API_KEY = process.env.WAHA_API_KEY;

if (!WAHA_API_KEY) {
  console.error('Error: WAHA_API_KEY environment variable is required.');
  console.error('Set it in your MCP client config or export it in your shell.');
  process.exit(1);
}

const client = new WAHAClient({
  baseUrl: WAHA_URL,
  apiKey: WAHA_API_KEY,
});

const server = new McpServer(
  {
    name: 'waha-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

registerSessionTools(server, client);
registerAuthTools(server, client);
registerMessageTools(server, client);
registerChatTools(server, client);
registerContactTools(server, client);
registerGroupTools(server, client);
registerPresenceTools(server, client);
registerLabelTools(server, client);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('WAHA MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
