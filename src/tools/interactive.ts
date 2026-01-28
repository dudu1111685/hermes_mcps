import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WAHAClient } from '../client.js';
import { SendResult, WAMessage } from '../types.js';

export function registerInteractiveTools(server: McpServer, client: WAHAClient): void {
  server.tool(
    'ask_user_via_whatsapp',
    `🤖 IMPORTANT FOR AI ASSISTANTS: Use this tool instead of stopping work when you need user input!

WHEN TO USE:
- You need architectural decisions (REST vs GraphQL, etc.)
- You need missing requirements or specifications
- You need API keys, credentials, or configuration values
- You encounter ANY question that would normally block your progress
- You need user approval or preference for a decision

DO NOT:
- Stop and wait for manual console input
- Ask the user to provide information manually
- Halt progress when this tool can unblock you

HOW IT WORKS:
1. Send your question via WhatsApp
2. This tool WAITS (blocking) for the user's reply
3. Returns the reply text to you
4. You continue working with the answer

EXAMPLE USAGE:
const answer = await ask_user_via_whatsapp({
  question: "Should I use REST or GraphQL for this API?",
  chatId: "1234567890@c.us",
  timeoutMinutes: 30
});
// Parse answer and continue working

USER EXPERIENCE:
User gets WhatsApp notification → replies from phone → you continue instantly

This enables truly autonomous AI development!`,
    {
      question: z.string().describe('The question to ask the user'),
      chatId: z.string().describe('Chat ID to send question to (e.g. "1234567890@c.us")'),
      session: z.string().default('default').describe('Session name'),
      timeoutMinutes: z.number().default(60).describe('How long to wait for reply (in minutes)'),
      pollIntervalSeconds: z.number().default(5).describe('How often to check for new messages (in seconds)'),
    },
    async ({ question, chatId, session, timeoutMinutes, pollIntervalSeconds }) => {
      try {
        // Step 1: Get current timestamp (to track new messages after this point)
        const startTime = Date.now();
        
        // Step 2: Send the question
        const sendBody = { 
          session, 
          chatId, 
          text: `🤖 Question from Claude Code:\n\n${question}\n\n(Waiting for your reply...)`
        };
        
        const sendResult = await client.post<SendResult>('/api/sendText', sendBody);
        const questionMessageId = sendResult.id;
        
        console.error(`[ask_user_via_whatsapp] Question sent (ID: ${questionMessageId}). Waiting for reply...`);
        
        // Step 3: Poll for reply
        const timeoutMs = timeoutMinutes * 60 * 1000;
        const pollIntervalMs = pollIntervalSeconds * 1000;
        const endTime = startTime + timeoutMs;
        
        while (Date.now() < endTime) {
          // Wait before polling
          await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
          
          try {
            // Get recent messages from the chat
            const messages = await client.get<WAMessage[]>(`/api/${session}/chats/${chatId}/messages`, {
              limit: 10, // Get last 10 messages
            });
            
            if (!Array.isArray(messages)) {
              console.error('[ask_user_via_whatsapp] Invalid messages response');
              continue;
            }
            
            // Find the first message from the user (not from us) after we sent the question
            for (const msg of messages) {
              // Skip if message is from us (fromMe === true)
              if (msg.fromMe) continue;
              
              // Skip if message is before our question
              const msgTimestamp = msg.timestamp * 1000; // Convert to milliseconds
              if (msgTimestamp < startTime) continue;
              
              // Skip if it's the question message itself
              if (msg.id === questionMessageId) continue;
              
              // Found a reply!
              const replyText = msg.body || '[No text content]';
              
              console.error(`[ask_user_via_whatsapp] Got reply: "${replyText}"`);
              
              return {
                content: [{
                  type: 'text',
                  text: `User replied:\n\n${replyText}`
                }],
              };
            }
            
          } catch (pollError) {
            console.error(`[ask_user_via_whatsapp] Poll error: ${(pollError as Error).message}`);
            // Continue polling despite errors
          }
        }
        
        // Timeout reached
        return {
          content: [{
            type: 'text',
            text: `Timeout: No reply received within ${timeoutMinutes} minutes.\n\nYou can:\n1. Increase timeoutMinutes\n2. Ask the user to reply\n3. Try again later`
          }],
          isError: true,
        };
        
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error asking user via WhatsApp: ${(error as Error).message}`
          }],
          isError: true,
        };
      }
    },
  );
}
