# WAHA - WhatsApp HTTP API Overview

## Introduction
WAHA is a self-hosted WhatsApp API that you can install on your own server and run in less than 5 minutes.

**⚠️ Important Disclaimer:**
- This project is NOT affiliated with WhatsApp
- NOT officially endorsed by WhatsApp
- Using unofficial clients may risk your account
- For critical business applications, use official WhatsApp Business API

## Quick Start Summary
1. **Requirements:** Docker
2. **Download:** `docker pull devlikeapro/waha`
3. **Init:** Generate credentials with `docker run --rm -v "$(pwd)":/app/env devlikeapro/waha init-waha /app/env`
4. **Run:** `docker run -it --env-file "$(pwd)/.env" -v "$(pwd)/sessions:/app/.sessions" --rm -p 3000:3000 --name waha devlikeapro/waha`
5. **Start Session:** Create & start session via API
6. **QR Scan:** Get QR code and scan with WhatsApp
7. **Send Messages:** Use HTTP API

## Key Features
- ✅ Send & receive text, media (images, video, voice, files)
- ✅ Groups management (create, add/remove participants, admin rights)
- ✅ Contacts management
- ✅ Labels
- ✅ Presence (typing, online/offline)
- ✅ Polls (create & receive votes)
- ✅ Status/Stories
- ✅ Channels
- ✅ Reactions
- ✅ Message editing & deletion
- ✅ Webhooks & Websockets for events
- ✅ Multiple sessions (WAHA Plus)

## Versions
- **Core:** Free, open source, basic features
- **Plus:** Advanced features (multimedia, security, multiple sessions)
- **PRO:** Plus + source code access

## System Requirements (per engine)
### WEBJS
- 1 session: 0.3 CPU / 400MB RAM
- 10 sessions: 3 CPU / 2.5GB RAM
- 50 sessions: 15 CPU / 20GB RAM

### NOWEB (More efficient)
- 1 session: 0.1 CPU / 200MB RAM
- 10 sessions: 1 CPU / 2GB RAM
- 100 sessions: 4 CPU / 8GB RAM

### GOWS (Most efficient)
- 1 session: 0.1 CPU / 200MB RAM
- 10 sessions: 0.5 CPU / 1GB RAM
- 500 sessions: 5-8 CPU / 25GB RAM
