# WAHA MCP - Media Enhancement Task

## Goal
Improve the WAHA MCP server to support sending local files (images, videos, audio, documents) easily, in addition to URLs.

## Current State
- `src/tools/messages.ts` has functions for sending media
- Currently only supports URLs (`imageUrl`, `videoUrl`, etc.)
- Has basic `send_file` with data URL support, but not well documented

## Required Changes

### 1. Add File Path Support
Update these functions to accept EITHER a file path OR a URL:
- `waha_send_image` - add `imagePath` parameter (alternative to `imageUrl`)
- `waha_send_video` - add `videoPath` parameter (alternative to `videoUrl`)
- `waha_send_voice` - add `audioPath` parameter (alternative to `audioUrl`)
- `waha_send_file` - add `filePath` parameter (alternative to `fileUrl`)

### 2. File Reading & Encoding
Create a utility function in `src/utils/file-utils.ts`:
```typescript
import { readFile } from 'fs/promises';
import { basename } from 'path';

export async function fileToBase64(filePath: string): Promise<{ data: string; mimetype: string; filename: string }> {
  const buffer = await readFile(filePath);
  const base64 = buffer.toString('base64');
  
  // Auto-detect mimetype based on extension
  const ext = filePath.split('.').pop()?.toLowerCase();
  const mimetypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'mp3': 'audio/mpeg',
    'opus': 'audio/ogg; codecs=opus',
    'ogg': 'audio/ogg',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'txt': 'text/plain',
    'zip': 'application/zip',
  };
  
  const mimetype = mimetypes[ext || ''] || 'application/octet-stream';
  const filename = basename(filePath);
  
  return { data: base64, mimetype, filename };
}
```

### 3. Update Message Tools
For each media sending function, add logic like:
```typescript
let fileObj: Record<string, unknown>;

if (imagePath) {
  // Read local file and convert to base64
  const { data, mimetype, filename } = await fileToBase64(imagePath);
  fileObj = { data, mimetype, filename };
} else if (imageUrl) {
  // Use URL (existing behavior)
  fileObj = { url: imageUrl, mimetype: 'image/jpeg' };
} else {
  throw new Error('Either imagePath or imageUrl must be provided');
}
```

### 4. Update Zod Schemas
Make parameters mutually exclusive but require one:
```typescript
{
  chatId: z.string().describe('Chat ID'),
  imagePath: z.string().optional().describe('Local file path to image (e.g., "/tmp/photo.jpg")'),
  imageUrl: z.string().optional().describe('URL of the image to send'),
  caption: z.string().optional().describe('Image caption'),
  session: z.string().default('default').describe('Session name'),
}
```

Add validation in the handler:
```typescript
if (!imagePath && !imageUrl) {
  throw new Error('Either imagePath or imageUrl must be provided');
}
if (imagePath && imageUrl) {
  throw new Error('Provide either imagePath OR imageUrl, not both');
}
```

### 5. Update Documentation
Update `README.md` with examples:
```markdown
## Send Image (from local file)
mcporter call 'waha-mcp.waha_send_image(chatId: "123@c.us", imagePath: "/tmp/photo.jpg", caption: "Check this out!")'

## Send Image (from URL)
mcporter call 'waha-mcp.waha_send_image(chatId: "123@c.us", imageUrl: "https://example.com/image.jpg", caption: "Check this out!")'

## Send Video
mcporter call 'waha-mcp.waha_send_video(chatId: "123@c.us", videoPath: "/tmp/video.mp4", caption: "Cool video")'

## Send Voice Message
mcporter call 'waha-mcp.waha_send_voice(chatId: "123@c.us", audioPath: "/tmp/voice.mp3")'
# Note: WAHA Plus will auto-convert MP3 to Opus if convert=true is set

## Send Any File
mcporter call 'waha-mcp.waha_send_file(chatId: "123@c.us", filePath: "/tmp/document.pdf", caption: "Here is the report")'
```

### 6. Add Convert Option for Voice/Video
Add `convert: boolean` parameter to `waha_send_voice` and `waha_send_video`:
```typescript
convert: z.boolean().default(true).describe('Auto-convert to WhatsApp format (MP3→Opus, etc.)')
```

Pass it to the API:
```typescript
const body = {
  session,
  chatId,
  file: fileObj,
  convert, // <-- add this
};
```

## Testing
After implementing, test with:
```bash
cd /home/shlomo/clawd/projects/waha-mcp
npm run build
mcporter call 'waha-mcp.waha_send_image(chatId: "120363424918086938@g.us", imagePath: "/tmp/waha-test.png", caption: "Test from local file!")'
```

## Notes
- WAHA Plus has a limit on base64 size (~10MB typically). For larger files, use URLs.
- Always enable `convert: true` for voice messages (MP3→Opus conversion)
- Make sure to handle errors gracefully (file not found, encoding errors, etc.)

## Files to Modify
1. `src/utils/file-utils.ts` (create new)
2. `src/tools/messages.ts` (update all media functions)
3. `README.md` (update with examples)
4. `package.json` (ensure fs/promises is available - it's built-in)

## Expected Outcome
Users can send media easily from local files:
```bash
mcporter call 'waha-mcp.waha_send_image(chatId: "123@c.us", imagePath: "/tmp/photo.jpg")'
```

Instead of having to host files on a web server first.
