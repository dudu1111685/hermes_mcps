# WAHA WhatsApp HTTP API

## 🚀 Quick Start

### Start WAHA
```bash
cd /home/shlomo/clawd/waha
docker-compose up -d
```

### Check Status
```bash
docker-compose logs -f
docker-compose ps
```

### Stop WAHA
```bash
docker-compose down
```

## 🔒 Security

### Access
- **ONLY accessible from localhost** (127.0.0.1:3001)
- **NOT accessible** from internet or other machines
- Use SSH tunnel to access remotely

### API Key
- Plain key in `.env` file
- Use in all API requests: `X-Api-Key: ee4a3cbb6f374de9a98c28df22a787b5`

### Credentials
See `.env` file for all passwords.

## 📡 Access Remotely (SSH Tunnel)

From your local machine:
```bash
ssh -L 3001:localhost:3001 shlomo@109.123.244.220
```

Then open: http://localhost:3001/dashboard

## 🔗 URLs (via SSH tunnel)

- **Dashboard:** http://localhost:3001/dashboard
- **Swagger API:** http://localhost:3001/
- **Health:** http://localhost:3001/health

## 📝 API Examples

### List Sessions
```bash
curl -H 'X-Api-Key: ee4a3cbb6f374de9a98c28df22a787b5' \
  http://localhost:3001/api/sessions
```

### Create Session
```bash
curl -X POST \
  -H 'X-Api-Key: ee4a3cbb6f374de9a98c28df22a787b5' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "default",
    "config": {
      "noweb": {
        "store": {
          "enabled": true,
          "fullSync": false
        }
      }
    }
  }' \
  http://localhost:3001/api/sessions
```

### Get QR Code
```bash
curl -H 'X-Api-Key: ee4a3cbb6f374de9a98c28df22a787b5' \
  http://localhost:3001/api/default/auth/qr \
  --output qr.png
```

### Send Message
```bash
curl -X POST \
  -H 'X-Api-Key: ee4a3cbb6f374de9a98c28df22a787b5' \
  -H 'Content-Type: application/json' \
  -d '{
    "session": "default",
    "chatId": "1234567890@c.us",
    "text": "Hello from WAHA!"
  }' \
  http://localhost:3001/api/sendText
```

## 📁 Folder Structure

```
waha/
├── docker-compose.yaml  # Docker configuration
├── .env                 # Credentials (SECRET!)
├── sessions/            # WhatsApp sessions (persistent)
├── media/               # Downloaded media files
└── README.md           # This file
```

## 🔧 Configuration

### Engine: NOWEB
- Lightweight (no browser)
- Fast & efficient
- Store enabled for chats/contacts/messages

### Storage
- Sessions: `./sessions` (persistent across restarts)
- Media: `./media` (180 days retention)

### Resources
- Memory: ~200MB per session
- CPU: ~0.1 CPU per session

## 🆘 Troubleshooting

### Check logs
```bash
docker-compose logs -f waha
```

### Restart
```bash
docker-compose restart
```

### Full reset (⚠️ loses sessions!)
```bash
docker-compose down
rm -rf sessions/*
docker-compose up -d
```

## 📚 Documentation

Full docs: `/home/shlomo/clawd/docs/waha/`

- `01-overview.md` - Introduction
- `02-sessions.md` - Session management
- `03-messages.md` - Send & receive messages
- `04-groups.md` - Groups
- `05-engines.md` - Engine comparison
- `06-security.md` - Security
