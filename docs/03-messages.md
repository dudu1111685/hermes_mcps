# Messages - Send & Receive

## Send Messages

### Text Message
```bash
POST /api/sendText
{
  "session": "default",
  "chatId": "12132132130@c.us",
  "text": "Hi there!",
  "linkPreview": true,
  "mentions": ["2132132130@c.us"],  # @mention in groups
  "reply_to": "false_11111111111@c.us_AAAAA"  # Reply to message
}
```

### Mentions
Mention user in text + mentions array:
```json
{
  "text": "Hi @2132132130!",
  "mentions": ["2132132130@c.us"]
}
```
Mention all in group: `"mentions": ["all"]`

### Send Image
```bash
POST /api/sendImage
{
  "session": "default",
  "chatId": "11111111111@c.us",
  "file": {
    "mimetype": "image/jpeg",
    "url": "https://example.com/image.jpg"
    # OR "data": "base64..." OR "filename": "local-file.jpg"
  },
  "caption": "Check this out!"
}
```

**Format:** JPEG only (use ffmpeg to convert PNG/WebP → JPG)

### Send Voice
```bash
POST /api/sendVoice
{
  "session": "default",
  "chatId": "11111111111@c.us",
  "file": {
    "mimetype": "audio/ogg; codecs=opus",
    "url": "https://example.com/voice.opus"
  },
  "convert": false  # Set true for auto-conversion
}
```

**Format:** OGG/Opus only
```bash
# Convert with ffmpeg
ffmpeg -i input.mp3 -c:a libopus -b:a 32k -ar 48000 -ac 1 output.opus
```

### Send Video
```bash
POST /api/sendVideo
{
  "session": "default",
  "chatId": "11111111111@c.us",
  "file": {
    "mimetype": "video/mp4",
    "url": "https://example.com/video.mp4"
  },
  "convert": false
}
```

**Format:** MP4 with libx264
```bash
# Convert with ffmpeg
ffmpeg -i input.avi -c:v libx264 -map 0 -movflags +faststart output.mp4
```

### Send File
```bash
POST /api/sendFile
{
  "session": "default",
  "chatId": "11111111111@c.us",
  "file": {
    "mimetype": "application/pdf",
    "url": "https://example.com/document.pdf"
  }
}
```

### Send Poll
```bash
POST /api/sendPoll
{
  "session": "default",
  "chatId": "11111111111@c.us",
  "poll": {
    "name": "What's your favorite?",
    "options": ["Option 1", "Option 2", "Option 3"],
    "multipleAnswers": false
  }
}
```

### Send Location
```bash
POST /api/sendLocation
{
  "session": "default",
  "chatId": "11111111111@c.us",
  "latitude": 37.422,
  "longitude": -122.084,
  "title": "Google HQ"
}
```

### Send Contact (vCard)
```bash
POST /api/sendContactVcard
{
  "session": "default",
  "chatId": "11111111111@c.us",
  "contactsId": ["11111111111@c.us"]
}
```

### Send Seen (Read Message)
```bash
POST /api/sendSeen
{
  "session": "default",
  "chatId": "11111111111@c.us",
  "messageIds": ["false_11111111111@c.us_AAAAA"]  # Optional
}
```

### Typing Indicators
```bash
POST /api/startTyping
{ "session": "default", "chatId": "11111111111@c.us" }

POST /api/stopTyping
{ "session": "default", "chatId": "11111111111@c.us" }
```

## Receive Messages

### Webhook Events
Configure webhooks in session config:
```json
{
  "webhooks": [{
    "url": "https://your-webhook.com",
    "events": ["message", "message.reaction", "message.ack"]
  }]
}
```

### message Event
```json
{
  "event": "message",
  "session": "default",
  "payload": {
    "id": "true_11111111111@c.us_AAAAA",
    "timestamp": 1667561485,
    "from": "11111111111@c.us",
    "fromMe": false,
    "to": "11111111111@c.us",
    "body": "Hi there!",
    "hasMedia": true,
    "media": {
      "url": "http://localhost:3000/api/files/xxx.jpg",
      "mimetype": "image/jpeg",
      "filename": "image.jpg"
    },
    "ack": 1,
    "ackName": "SERVER",
    "replyTo": "false_22222222@c.us_BBBB",
    "source": "app"
  }
}
```

### message.reaction
```json
{
  "event": "message.reaction",
  "payload": {
    "id": "false_79111111@c.us_11111",
    "reaction": {
      "text": "🙏",  # Empty string = removed
      "messageId": "true_79111111@c.us_22222"
    }
  }
}
```

### message.ack
Track delivery/read status:
```json
{
  "event": "message.ack",
  "payload": {
    "id": "true_11111111111@c.us_AAAAA",
    "ack": 3,
    "ackName": "READ"
  }
}
```

**ACK Values:**
- `-1` ERROR
- `0` PENDING
- `1` SERVER (sent)
- `2` DEVICE (delivered)
- `3` READ
- `4` PLAYED

### message.revoked
```json
{
  "event": "message.revoked",
  "payload": {
    "after": { "id": "false_1231243123@c.us_BBBB", ... },
    "revokedMessageId": "AAAAAAAAAAAAAAAA",
    "before": null
  }
}
```

### message.edited
```json
{
  "event": "message.edited",
  "payload": {
    "id": "false_1231243123@c.us_BBBB",
    "editedMessageId": "AAAAAAAAAAAAAAAA",
    "body": "New text"
  }
}
```

## Chat IDs Format
- **User:** `123123123@c.us` (phone without +)
- **Group:** `12312312123133@g.us`
- **Channel:** `12312312123133@newsletter`
- **Status:** `status@broadcast`
- **LID (hidden):** `123123123@lid`

## Media Files
- Downloaded automatically to storage
- URL: `http://localhost:3000/api/files/{messageId}.jpg`
- Configure lifetime & types via env vars
- Disable auth: `WHATSAPP_API_KEY_EXCLUDE_PATH=api/files/(.*)`

## Get Messages from History
```bash
GET /api/{session}/chats/{chatId}/messages?limit=100&offset=0

# Filters:
# - downloadMedia=true
# - filter.timestamp.gte=1727745026
# - filter.fromMe=false
# - filter.ack=READ
```

## Message Actions
```bash
# Edit message
PUT /api/{session}/chats/{chatId}/messages/{messageId}
{ "text": "New text" }

# Delete message
DELETE /api/{session}/chats/{chatId}/messages/{messageId}

# Pin/Unpin
POST /api/{session}/chats/{chatId}/messages/{messageId}/pin
{ "duration": 86400 }  # 24h/7d/30d
POST /api/{session}/chats/{chatId}/messages/{messageId}/unpin

# React
POST /api/reaction
{ "messageId": "xxx", "reaction": "❤️" }
```

## Best Practices
1. **Always send `sendSeen`** before replying (avoid blocking)
2. **Use `startTyping`** before `sendText` (emulate real user)
3. **Media formats:** Validate before sending or use `convert: true`
4. **Rate limiting:** Don't spam (risk of ban)
5. **File names:** Random UUIDs make them hard to guess
