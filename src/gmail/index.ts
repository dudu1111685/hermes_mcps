#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerGmailTools } from './tools.js';

const server = new McpServer(
  { name: 'gmail-watch-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
);
registerGmailTools(server);

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  console.error('Gmail Watch MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal Gmail MCP error:', error);
  process.exit(1);
});
