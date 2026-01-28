import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WAHAClient } from '../client.js';
import { SendResult, WAMessage } from '../types.js';
import { fileToBase64 } from '../utils/file-utils.js';

export function registerMessageTools(server: McpServer, client: WAHAClient): void {
  server.tool(
    'waha_send_text',
    'Send a text message to a WhatsApp chat',
    {
      chatId: z.string().describe('Chat ID (e.g. "1234567890@c.us" for users, "1234567890@g.us" for groups)'),
      text: z.string().describe('Message text'),
      session: z.string().default('default').describe('Session name'),
      replyTo: z.string().optional().describe('Message ID to reply to'),
      mentions: z.array(z.string()).optional().describe('User IDs to mention (e.g. ["1234567890@c.us"]) or ["all"] for everyone'),
      linkPreview: z.boolean().optional().describe('Enable link preview generation'),
    },
    async ({ chatId, text, session, replyTo, mentions, linkPreview }) => {
      try {
        // Auto-fix mentions: ensure phone numbers are in the text
        let finalText = text;
        if (mentions && mentions.length > 0 && !mentions.includes('all')) {
          const missingNumbers: string[] = [];
          
          for (const mention of mentions) {
            // Extract phone number from mention (e.g., "972516008000@c.us" -> "972516008000")
            const phoneMatch = mention.match(/^(\d+)@/);
            if (phoneMatch) {
              const phoneNumber = phoneMatch[1];
              const mentionTag = `@${phoneNumber}`;
              
              // Check if the text already contains this mention
              if (!finalText.includes(mentionTag)) {
                missingNumbers.push(mentionTag);
                console.warn(`[WAHA MCP] Mention missing in text: ${mentionTag} not found in "${text}"`);
              }
            }
          }
          
          // Auto-fix: append missing mentions to the text
          if (missingNumbers.length > 0) {
            finalText = `${text} ${missingNumbers.join(' ')}`.trim();
            console.warn(`[WAHA MCP] Auto-fixed text with missing mentions: "${finalText}"`);
          }
        }

        const body: Record<string, unknown> = { session, chatId, text: finalText };
        if (replyTo) body.reply_to = replyTo;
        if (mentions) body.mentions = mentions;
        if (linkPreview !== undefined) body.linkPreview = linkPreview;

        const result = await client.post<SendResult>('/api/sendText', body);
        return {
          content: [{ type: 'text', text: `Message sent successfully.\nMessage ID: ${result.id}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error sending message: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_send_image',
    'Send an image to a WhatsApp chat (from local file OR URL)',
    {
      chatId: z.string().describe('Chat ID'),
      imagePath: z.string().optional().describe('Local file path (e.g., "/tmp/photo.jpg")'),
      imageUrl: z.string().optional().describe('URL of the image to send'),
      caption: z.string().optional().describe('Image caption'),
      session: z.string().default('default').describe('Session name'),
      replyTo: z.string().optional().describe('Message ID to reply to'),
    },
    async ({ chatId, imagePath, imageUrl, caption, session, replyTo }) => {
      try {
        // Validate: require one of imagePath or imageUrl
        if (!imagePath && !imageUrl) {
          throw new Error('Either imagePath or imageUrl must be provided');
        }
        if (imagePath && imageUrl) {
          throw new Error('Provide either imagePath OR imageUrl, not both');
        }

        let fileObj: Record<string, unknown>;

        if (imagePath) {
          // Read local file and convert to base64
          const { data, mimetype, filename } = await fileToBase64(imagePath);
          fileObj = { data, mimetype, filename };
        } else {
          // Use URL (existing behavior)
          fileObj = { url: imageUrl, mimetype: 'image/jpeg' };
        }

        const body: Record<string, unknown> = { session, chatId, file: fileObj };
        if (caption) body.caption = caption;
        if (replyTo) body.reply_to = replyTo;

        const result = await client.post<SendResult>('/api/sendImage', body);
        return {
          content: [{ type: 'text', text: `Image sent successfully.\nMessage ID: ${result.id}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error sending image: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_send_video',
    'Send a video to a WhatsApp chat (from local file OR URL)',
    {
      chatId: z.string().describe('Chat ID'),
      videoPath: z.string().optional().describe('Local file path (e.g., "/tmp/video.mp4")'),
      videoUrl: z.string().optional().describe('URL of the video to send (MP4 format preferred)'),
      caption: z.string().optional().describe('Video caption'),
      convert: z.boolean().default(true).describe('Auto-convert to WhatsApp format'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, videoPath, videoUrl, caption, convert, session }) => {
      try {
        if (!videoPath && !videoUrl) {
          throw new Error('Either videoPath or videoUrl must be provided');
        }
        if (videoPath && videoUrl) {
          throw new Error('Provide either videoPath OR videoUrl, not both');
        }

        let fileObj: Record<string, unknown>;

        if (videoPath) {
          const { data, mimetype, filename } = await fileToBase64(videoPath);
          fileObj = { data, mimetype, filename };
        } else {
          fileObj = { url: videoUrl, mimetype: 'video/mp4' };
        }

        const body: Record<string, unknown> = { session, chatId, file: fileObj, convert };
        if (caption) body.caption = caption;

        const result = await client.post<SendResult>('/api/sendVideo', body);
        return {
          content: [{ type: 'text', text: `Video sent successfully.\nMessage ID: ${result.id}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error sending video: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_send_voice',
    'Send a voice message to a WhatsApp chat (from local file OR URL)',
    {
      chatId: z.string().describe('Chat ID'),
      audioPath: z.string().optional().describe('Local file path (e.g., "/tmp/voice.mp3")'),
      audioUrl: z.string().optional().describe('URL of the audio file (OGG/Opus format preferred)'),
      convert: z.boolean().default(true).describe('Auto-convert to Opus format (recommended for MP3/WAV)'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, audioPath, audioUrl, convert, session }) => {
      try {
        if (!audioPath && !audioUrl) {
          throw new Error('Either audioPath or audioUrl must be provided');
        }
        if (audioPath && audioUrl) {
          throw new Error('Provide either audioPath OR audioUrl, not both');
        }

        let fileObj: Record<string, unknown>;

        if (audioPath) {
          const { data, mimetype, filename } = await fileToBase64(audioPath);
          fileObj = { data, mimetype, filename };
        } else {
          fileObj = { url: audioUrl, mimetype: 'audio/ogg; codecs=opus' };
        }

        const result = await client.post<SendResult>('/api/sendVoice', {
          session,
          chatId,
          file: fileObj,
          convert,
        });
        return {
          content: [{ type: 'text', text: `Voice message sent successfully.\nMessage ID: ${result.id}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error sending voice: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_send_file',
    'Send a document/file to a WhatsApp chat (from local file OR URL)',
    {
      chatId: z.string().describe('Chat ID'),
      filePath: z.string().optional().describe('Local file path (e.g., "/tmp/document.pdf")'),
      fileUrl: z.string().optional().describe('URL of the file to send (can be HTTP URL or data: URL)'),
      mimetype: z.string().optional().describe('File MIME type (auto-detected if using filePath)'),
      filename: z.string().optional().describe('Display filename (auto-detected if using filePath)'),
      caption: z.string().optional().describe('File caption'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, filePath, fileUrl, mimetype, filename, caption, session }) => {
      try {
        if (!filePath && !fileUrl) {
          throw new Error('Either filePath or fileUrl must be provided');
        }
        if (filePath && fileUrl) {
          throw new Error('Provide either filePath OR fileUrl, not both');
        }

        let fileObj: Record<string, unknown>;

        if (filePath) {
          // Read local file and convert to base64
          const fileData = await fileToBase64(filePath);
          fileObj = { 
            data: fileData.data, 
            mimetype: mimetype || fileData.mimetype,
            filename: filename || fileData.filename,
          };
        } else if (fileUrl) {
          // Check if it's a data URL (data:mime;base64,...)
          if (fileUrl.startsWith('data:')) {
            // Extract the base64 part from data URL
            const base64Match = fileUrl.match(/^data:[^;]+;base64,(.+)$/);
            if (base64Match) {
              fileObj = { 
                data: base64Match[1], 
                mimetype: mimetype || 'application/octet-stream',
              };
            } else {
              fileObj = { url: fileUrl };
            }
          } else {
            // Regular HTTP(S) URL
            fileObj = { 
              url: fileUrl, 
              mimetype: mimetype || 'application/octet-stream',
            };
          }
          
          if (filename) fileObj.filename = filename;
        } else {
          throw new Error('No file source provided');
        }

        const body: Record<string, unknown> = { session, chatId, file: fileObj };
        if (caption) body.caption = caption;

        const result = await client.post<SendResult>('/api/sendFile', body);
        return {
          content: [{ type: 'text', text: `File sent successfully.\nMessage ID: ${result.id}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error sending file: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_send_location',
    'Send a location to a WhatsApp chat',
    {
      chatId: z.string().describe('Chat ID'),
      latitude: z.number().describe('Latitude coordinate'),
      longitude: z.number().describe('Longitude coordinate'),
      title: z.string().optional().describe('Location title/name'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, latitude, longitude, title, session }) => {
      try {
        const body: Record<string, unknown> = { session, chatId, latitude, longitude };
        if (title) body.title = title;

        const result = await client.post<SendResult>('/api/sendLocation', body);
        return {
          content: [{ type: 'text', text: `Location sent successfully.\nMessage ID: ${result.id}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error sending location: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_send_contact',
    'Send contact card(s) (vCard) to a WhatsApp chat',
    {
      chatId: z.string().describe('Chat ID'),
      contactsId: z.array(z.string()).describe('Contact IDs to share (e.g. ["1234567890@c.us"])'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, contactsId, session }) => {
      try {
        const result = await client.post<SendResult>('/api/sendContactVcard', {
          session,
          chatId,
          contactsId,
        });
        return {
          content: [{ type: 'text', text: `Contact(s) sent successfully.\nMessage ID: ${result.id}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error sending contact: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_send_poll',
    'Send a poll to a WhatsApp chat',
    {
      chatId: z.string().describe('Chat ID'),
      pollName: z.string().describe('Poll question'),
      options: z.array(z.string()).min(2).describe('Poll options (at least 2)'),
      multipleAnswers: z.boolean().default(false).describe('Allow multiple answers'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, pollName, options, multipleAnswers, session }) => {
      try {
        const result = await client.post<SendResult>('/api/sendPoll', {
          session,
          chatId,
          poll: { name: pollName, options, multipleAnswers },
        });
        return {
          content: [{ type: 'text', text: `Poll sent successfully.\nMessage ID: ${result.id}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error sending poll: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_react_to_message',
    'React to a message with an emoji',
    {
      messageId: z.string().describe('Message ID to react to'),
      reaction: z.string().describe('Emoji reaction (e.g. "❤️", "👍"). Empty string to remove reaction.'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ messageId, reaction, session }) => {
      try {
        await client.post('/api/reaction', { session, messageId, reaction });
        const action = reaction === '' ? 'removed' : `set to ${reaction}`;
        return {
          content: [{ type: 'text', text: `Reaction ${action} on message ${messageId}.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error reacting to message: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_get_messages',
    'Get messages from a WhatsApp chat with optional filters',
    {
      chatId: z.string().describe('Chat ID'),
      session: z.string().default('default').describe('Session name'),
      limit: z.number().default(20).describe('Number of messages to retrieve'),
      offset: z.number().default(0).describe('Offset for pagination'),
      downloadMedia: z.boolean().optional().describe('Include media download URLs'),
      fromMe: z.boolean().optional().describe('Filter: only messages sent by me (true) or received (false)'),
    },
    async ({ chatId, session, limit, offset, downloadMedia, fromMe }) => {
      try {
        const params: Record<string, string | number | boolean | undefined> = { limit, offset };
        if (downloadMedia !== undefined) params.downloadMedia = downloadMedia;
        if (fromMe !== undefined) params['filter.fromMe'] = fromMe;

        const messages = await client.get<WAMessage[]>(
          `/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(chatId)}/messages`,
          params,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(messages, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting messages: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_delete_message',
    'Delete a message from a WhatsApp chat',
    {
      chatId: z.string().describe('Chat ID'),
      messageId: z.string().describe('Message ID to delete'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, messageId, session }) => {
      try {
        await client.delete(
          `/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
        );
        return {
          content: [{ type: 'text', text: `Message ${messageId} deleted successfully.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error deleting message: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_edit_message',
    'Edit a previously sent message',
    {
      chatId: z.string().describe('Chat ID'),
      messageId: z.string().describe('Message ID to edit'),
      text: z.string().describe('New message text'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, messageId, text, session }) => {
      try {
        await client.put(
          `/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
          { text },
        );
        return {
          content: [{ type: 'text', text: `Message ${messageId} edited successfully.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error editing message: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_mark_as_read',
    'Mark messages in a chat as read (send seen)',
    {
      chatId: z.string().describe('Chat ID'),
      session: z.string().default('default').describe('Session name'),
      messageIds: z.array(z.string()).optional().describe('Specific message IDs to mark as read (optional, marks all if omitted)'),
    },
    async ({ chatId, session, messageIds }) => {
      try {
        const body: Record<string, unknown> = { session, chatId };
        if (messageIds) body.messageIds = messageIds;

        await client.post('/api/sendSeen', body);
        return {
          content: [{ type: 'text', text: `Messages in ${chatId} marked as read.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error marking as read: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_star_message',
    'Star or unstar a message',
    {
      chatId: z.string().describe('Chat ID'),
      messageId: z.string().describe('Message ID'),
      star: z.boolean().default(true).describe('true to star, false to unstar'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, messageId, star, session }) => {
      try {
        const action = star ? 'star' : 'unstar';
        await client.post(
          `/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/${action}`,
        );
        return {
          content: [{ type: 'text', text: `Message ${messageId} ${star ? 'starred' : 'unstarred'} successfully.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error starring message: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'waha_forward_message',
    'Forward a message to another chat',
    {
      chatId: z.string().describe('Source chat ID where the message is'),
      messageId: z.string().describe('Message ID to forward'),
      toChatId: z.string().describe('Destination chat ID'),
      session: z.string().default('default').describe('Session name'),
    },
    async ({ chatId, messageId, toChatId, session }) => {
      try {
        const result = await client.post<SendResult>('/api/forwardMessage', {
          session,
          chatId,
          messageId,
          to: toChatId,
        });
        return {
          content: [{ type: 'text', text: `Message forwarded successfully.\nNew message ID: ${result.id}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error forwarding message: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
