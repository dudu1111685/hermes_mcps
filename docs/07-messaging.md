# Messaging Guide

Complete guide to sending and managing messages with WAHA MCP.

## Sending Messages

### Text Messages

Send a simple text message:

```bash
mcporter call 'waha-mcp.waha_send_text(
  chatId: "1234567890@c.us",
  text: "Hello from WAHA MCP!"
)'
```

#### With Mentions

Tag users in groups:

```bash
mcporter call 'waha-mcp.waha_send_text(
  chatId: "1234567890-1234567890@g.us",
  text: "@1234567890 Hello there!",
  mentions: ["1234567890@c.us"]
)'
```

#### Rich Formatting

WhatsApp supports basic formatting:

```bash
mcporter call 'waha-mcp.waha_send_text(
  chatId: "1234567890@c.us",
  text: "*Bold* _Italic_ ~Strike~ ```Monospace```"
)'
```

---

## Media Messages

### Images

Send images from local files or URLs:

**From URL:**
```bash
mcporter call 'waha-mcp.waha_send_image(
  chatId: "1234567890@c.us",
  imageUrl: "https://example.com/photo.jpg",
  caption: "Beautiful sunset!"
)'
```

**From Local File:**
```bash
mcporter call 'waha-mcp.waha_send_image(
  chatId: "1234567890@c.us",
  imagePath: "/path/to/photo.jpg",
  caption: "Check this out"
)'
```

### Videos

Send videos with auto-conversion to WhatsApp format:

```bash
mcporter call 'waha-mcp.waha_send_video(
  chatId: "1234567890@c.us",
  videoPath: "/path/to/video.mp4",
  caption: "Amazing moment!"
)'
```

Disable auto-conversion:
```bash
mcporter call 'waha-mcp.waha_send_video(
  chatId: "1234567890@c.us",
  videoPath: "/path/to/video.mp4",
  convert: false
)'
```

### Voice Messages

Send voice notes (auto-converts audio files):

```bash
mcporter call 'waha-mcp.waha_send_voice(
  chatId: "1234567890@c.us",
  audioPath: "/path/to/audio.mp3"
)'
```

### Documents/Files

Send any file type:

```bash
mcporter call 'waha-mcp.waha_send_file(
  chatId: "1234567890@c.us",
  filePath: "/path/to/document.pdf",
  caption: "Here's the report"
)'
```

Supported file types: PDF, DOCX, XLSX, ZIP, and 50+ more.

---

## Location Sharing

Send a location pin:

```bash
mcporter call 'waha-mcp.waha_send_location(
  chatId: "1234567890@c.us",
  latitude: 31.7683,
  longitude: 35.2137,
  name: "Jerusalem"
)'
```

---

## Contact Cards

Send a contact vCard:

```bash
mcporter call 'waha-mcp.waha_send_contact(
  chatId: "1234567890@c.us",
  contactId: "9876543210@c.us"
)'
```

Or send multiple contacts:
```bash
mcporter call 'waha-mcp.waha_send_contact(
  chatId: "1234567890@c.us",
  contactIds: ["111@c.us", "222@c.us", "333@c.us"]
)'
```

---

## Polls

Create interactive polls:

```bash
mcporter call 'waha-mcp.waha_send_poll(
  chatId: "1234567890@g.us",
  question: "What should we do this weekend?",
  options: ["Beach", "Mountains", "City Tour", "Stay Home"]
)'
```

Multiple choice poll:
```bash
mcporter call 'waha-mcp.waha_send_poll(
  chatId: "1234567890@g.us",
  question: "Which toppings do you want?",
  options: ["Cheese", "Pepperoni", "Mushrooms", "Olives"],
  multipleChoice: true
)'
```

---

## Reactions

React to messages with emojis:

```bash
mcporter call 'waha-mcp.waha_react_to_message(
  chatId: "1234567890@c.us",
  messageId: "3EB0...",
  reaction: "👍"
)'
```

Popular reactions: 👍 ❤️ 😂 😮 😢 🙏

Remove a reaction:
```bash
mcporter call 'waha-mcp.waha_react_to_message(
  chatId: "1234567890@c.us",
  messageId: "3EB0...",
  reaction: ""
)'
```

---

## Message Management

### Retrieve Messages

Get recent messages from a chat:

```bash
mcporter call 'waha-mcp.waha_get_messages(
  chatId: "1234567890@c.us",
  limit: 50
)'
```

With pagination:
```bash
mcporter call 'waha-mcp.waha_get_messages(
  chatId: "1234567890@c.us",
  limit: 20,
  offset: 40
)'
```

### Edit Messages

Edit a sent message (within 15 minutes):

```bash
mcporter call 'waha-mcp.waha_edit_message(
  chatId: "1234567890@c.us",
  messageId: "3EB0...",
  text: "Updated message text"
)'
```

### Delete Messages

Delete a message for everyone:

```bash
mcporter call 'waha-mcp.waha_delete_message(
  chatId: "1234567890@c.us",
  messageId: "3EB0..."
)'
```

### Forward Messages

Forward a message to another chat:

```bash
mcporter call 'waha-mcp.waha_forward_message(
  chatId: "1234567890@c.us",
  messageId: "3EB0...",
  toChatId: "9876543210@c.us"
)'
```

### Mark as Read

Mark messages as read:

```bash
mcporter call 'waha-mcp.waha_mark_as_read(
  chatId: "1234567890@c.us",
  messageIds: ["3EB0...", "3EB1..."]
)'
```

### Star Messages

Star important messages:

```bash
mcporter call 'waha-mcp.waha_star_message(
  chatId: "1234567890@c.us",
  messageId: "3EB0...",
  star: true
)'
```

Unstar:
```bash
mcporter call 'waha-mcp.waha_star_message(
  chatId: "1234567890@c.us",
  messageId: "3EB0...",
  star: false
)'
```

---

## Best Practices

### Rate Limiting

- **Don't spam:** Wait 1-2 seconds between messages
- **Batch operations:** Use bulk methods when available
- **Monitor responses:** Check for rate limit errors

### Message Formatting

- **Keep it clean:** Avoid excessive emojis in business contexts
- **Use mentions wisely:** Only tag when necessary
- **Test formatting:** Verify how special characters appear

### Media Guidelines

- **Image:** Max 5MB, JPG/PNG recommended
- **Video:** Max 16MB, MP4 recommended
- **Voice:** Auto-converts to OGG Opus
- **Files:** Max 100MB

---

## Troubleshooting

### "Message not sent" Error

1. Verify chat ID format
2. Check session is authenticated
3. Ensure recipient exists on WhatsApp

### Media Upload Fails

1. Check file size limits
2. Verify file path is absolute
3. Ensure file is readable

### Reactions Not Showing

1. Only works on recent messages
2. Some emojis may not be supported
3. Check recipient's WhatsApp version

See [Complete Troubleshooting Guide](./15-troubleshooting.md).

---

## Next Steps

- [Learn about Media Handling](./08-media.md)
- [Explore Group Management](./09-groups.md)
- [View Examples Collection](./18-examples.md)
