# WAHA Documentation - Complete Guide

Documentation downloaded and organized: 2026-01-27

## Files Overview

1. **01-overview.md** - Introduction, quick start, system requirements
2. **02-sessions.md** - Session management, QR/pairing, configuration
3. **03-messages.md** - Send & receive messages (text, media, polls, etc.)
4. **04-groups.md** - Groups management (create, participants, admin)
5. **05-engines.md** - WEBJS vs NOWEB vs GOWS comparison
6. **06-security.md** - API keys, HMAC, HTTPS, authentication

## What is WAHA?

WAHA (WhatsApp HTTP API) is a **self-hosted** WhatsApp API that you can run on your own server.

### Key Benefits
- ✅ **Self-hosted** - full control & privacy
- ✅ **No per-message fees** - unlimited usage
- ✅ **Multiple sessions** (WAHA Plus)
- ✅ **3 engines** - choose performance vs stability
- ✅ **REST API** - easy integration
- ✅ **Webhooks** - real-time events
- ✅ **Docker-based** - easy deployment

### Versions
- **Core:** Free, open source (basic features, 1 session)
- **Plus:** Paid ($49-199/month) - multimedia, multiple sessions, security
- **PRO:** Plus + source code access

## Quick Start

### 1. Install
```bash
docker pull devlikeapro/waha
docker run -it -p 3000:3000 devlikeapro/waha
```

### 2. Create Session
```bash
POST /api/sessions
{
  "name": "default",
  "config": {
    "webhooks": [{
      "url": "https://your-webhook.com",
      "events": ["message"]
    }]
  }
}
```

### 3. Get QR & Scan
```bash
GET /api/default/auth/qr
```
Scan with WhatsApp app

### 4. Send Message
```bash
POST /api/sendText
{
  "session": "default",
  "chatId": "123123123@c.us",
  "text": "Hello from WAHA!"
}
```

## Core Features

### ✅ Available
- Text messages
- Media (image, video, voice, files)
- Groups (create, manage, participants)
- Contacts
- Reactions
- Polls (create & receive votes)
- Status/Stories
- Channels
- Presence (typing, online/offline)
- Labels
- Message editing/deletion
- Webhooks & Websockets

### ❌ NOT Available (vs wacli)
Everything is available in WAHA! Much more powerful than wacli.

## Comparison: WAHA vs wacli

| Feature | wacli | WAHA |
|---------|-------|------|
| Send text | ✔️ | ✔️ |
| Send media | ✔️ | ✔️ |
| **Mentions (@tag)** | ❌ | ✔️ |
| **Polls** | ❌ | ✔️ |
| **Reactions** | ❌ | ✔️ |
| **Message editing** | ❌ | ✔️ |
| **Multiple sessions** | ❌ | ✔️ (Plus) |
| **REST API** | ❌ | ✔️ |
| **Webhooks** | ❌ | ✔️ |
| **Dashboard UI** | ❌ | ✔️ |
| Groups | Basic | Full |
| Architecture | CLI | Docker + HTTP API |
| Resource usage | Light | Medium-Heavy |

## Architecture

### Engine Options
1. **WEBJS** - Browser-based (stable, heavy)
2. **NOWEB** - WebSocket (fast, lighter)
3. **GOWS** - Golang (fastest, lightest)

### Storage
- **Sessions:** Persistent in `.sessions/` volume
- **Media:** Stored in configurable location
- **Database:** SQLite (file) or MongoDB (NOWEB/GOWS)

### Deployment Options
- Docker Compose
- Kubernetes
- EasyPanel (UI)
- Coolify (self-hosted UI)

## API Endpoints Summary

### Sessions
- `POST /api/sessions` - Create
- `GET /api/sessions` - List
- `POST /api/sessions/{name}/start` - Start
- `GET /api/{session}/auth/qr` - Get QR
- `POST /api/{session}/auth/request-code` - Pairing code

### Messages
- `POST /api/sendText` - Text
- `POST /api/sendImage` - Image
- `POST /api/sendVideo` - Video
- `POST /api/sendVoice` - Voice
- `POST /api/sendFile` - File
- `POST /api/sendPoll` - Poll
- `POST /api/sendSeen` - Mark as read
- `POST /api/reaction` - React to message

### Groups
- `POST /api/{session}/groups` - Create
- `GET /api/{session}/groups` - List
- `POST /api/{session}/groups/join` - Join
- `POST /api/{session}/groups/{id}/participants/add` - Add member
- `POST /api/{session}/groups/{id}/admin/promote` - Make admin

### Chats
- `GET /api/{session}/chats` - List chats
- `GET /api/{session}/chats/{chatId}/messages` - Get messages
- `POST /api/{session}/chats/{chatId}/archive` - Archive

### Contacts
- `GET /api/contacts/all` - List contacts
- `GET /api/contacts/check-exists` - Check if exists
- `GET /api/contacts/profile-picture` - Get profile pic

## Events (Webhooks)

### Message Events
- `message` - Incoming message
- `message.any` - All messages (incl. yours)
- `message.reaction` - Reactions
- `message.ack` - Delivery/read status
- `message.revoked` - Deleted messages
- `message.edited` - Edited messages

### Session Events
- `session.status` - Session status changes

### Group Events
- `group.v2.join` - Joined group
- `group.v2.leave` - Left group
- `group.v2.participants` - Participant changes
- `group.v2.update` - Group info updated

### Other Events
- `presence.update` - Typing/online status
- `poll.vote` - Poll votes
- `call.received` - Incoming calls
- `label.*` - Label changes

## Environment Variables (Key)

### Security
```bash
WAHA_API_KEY=yoursecretkey
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=password
```

### Engine
```bash
WHATSAPP_DEFAULT_ENGINE=NOWEB  # WEBJS|NOWEB|GOWS
```

### Webhooks (Global)
```bash
WHATSAPP_HOOK_URL=https://webhook.com
WHATSAPP_HOOK_EVENTS=message,session.status
```

### Media
```bash
WHATSAPP_FILES_FOLDER=./files
WHATSAPP_FILES_LIFETIME=180  # days
```

## Best Practices

### 1. Start with WEBJS
Most stable for beginners. Switch to NOWEB/GOWS later.

### 2. Enable Security
Always use API keys + HTTPS in production.

### 3. Configure Webhooks
Real-time events > polling.

### 4. Handle Rate Limits
Don't spam - risk of ban.

### 5. Media Formats
- Images: JPEG only
- Voice: OGG/Opus only
- Video: MP4/H264 only
Use `convert: true` or ffmpeg.

### 6. Persistent Sessions
Mount `.sessions` volume to avoid re-authentication.

### 7. NOWEB Store
Enable for chats/contacts/messages history.

### 8. Monitor Resources
Check CPU/RAM per session, scale accordingly.

### 9. Backup Sessions
Backup `.sessions/` folder regularly.

### 10. Update Regularly
Check for updates weekly (compatibility fixes).

## Common Issues

### Rate Overlimit
- Reduce API calls frequency
- Enable Store (NOWEB) before heavy ops
- Don't refresh groups/contacts too often

### QR Expired
- QR expires: 60s first, then 20s×6
- Auto-refresh on `SCAN_QR_CODE` event

### Session Failed
- Restart session first
- If fails again - logout & re-authenticate
- Check logs for errors

### Media Not Downloading
- Check `hasMedia: true` but `media: null`
- Enable media download in config
- Check storage permissions

### WhatsApp Ban
- Don't spam messages
- Always send `sendSeen` before reply
- Use `startTyping` before `sendText`
- Follow WhatsApp's ToS

## Resources

- **Official Site:** https://waha.devlike.pro
- **Documentation:** https://waha.devlike.pro/docs
- **GitHub:** https://github.com/devlikeapro/waha
- **Discord:** https://discord.gg/waha
- **Support:** https://www.patreon.com/wa-http-api

## Next Steps

1. **Read overview:** Start with `01-overview.md`
2. **Setup session:** Follow `02-sessions.md`
3. **Send messages:** Check `03-messages.md`
4. **Configure security:** Review `06-security.md`
5. **Choose engine:** Compare in `05-engines.md`

## Installation Guide

See official documentation for:
- Docker Compose setup
- Production deployment
- Nginx reverse proxy
- SSL/HTTPS configuration
- Environment variables
- Coolify/EasyPanel setup

---

**סוף ה-documentation. יש לך עכשיו הבנה מלאה של WAHA!** 🎉
