# Sessions Management

## What is a Session?
A Session represents a WhatsApp Account (Phone Number) connected to WAHA.

## Session Status
- `STOPPED` - session is stopped
- `STARTING` - session is starting
- `SCAN_QR_CODE` - needs QR scan (QR expires: first 60s, then 20s×6 times)
- `WORKING` - ready to use
- `FAILED` - needs restart or re-authentication

## Core Endpoints

### Create Session
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

### Start/Stop/Restart Session
```bash
POST /api/sessions/{name}/start
POST /api/sessions/{name}/stop
POST /api/sessions/{name}/restart
```

### Get QR Code
```bash
GET /api/{session}/auth/qr          # Binary PNG
GET /api/{session}/auth/qr?format=raw  # Raw value
```

### Pairing Code (Phone number auth)
```bash
POST /api/{session}/auth/request-code
{ "phoneNumber": "12132132130" }
```

### Get Session Info
```bash
GET /api/sessions          # List all
GET /api/sessions/{name}   # Get specific
```

### Delete Session
```bash
DELETE /api/sessions/{name}
```

### Logout
```bash
POST /api/sessions/{name}/logout
```

## Session Configuration

### Full Config Example
```json
{
  "name": "default",
  "config": {
    "debug": false,
    "client": {
      "deviceName": "My Bot",
      "browserName": "Chrome"
    },
    "metadata": {
      "user.id": "123",
      "user.email": "user@example.com"
    },
    "webhooks": [{
      "url": "https://webhook.site/xxxxx",
      "events": ["message"],
      "hmac": { "key": "secret" },
      "customHeaders": [{ "name": "X-Custom", "value": "value" }],
      "retries": {
        "policy": "exponential",
        "delaySeconds": 2,
        "attempts": 15
      }
    }],
    "ignore": {
      "status": false,
      "groups": false,
      "channels": false,
      "broadcast": false
    },
    "proxy": {
      "server": "proxy.example.com:3128",
      "username": "user",
      "password": "pass"
    },
    "noweb": {
      "store": {
        "enabled": true,
        "fullSync": false
      }
    }
  }
}
```

### Metadata
- Store custom key-value data with sessions
- Available in all events and API responses
- Use for linking to your system's IDs

### Webhooks
- **URL:** Where to send events
- **Events:** Filter which events to receive
- **HMAC:** Authenticate webhook sender (sha512)
- **Retries:** Configure retry policy (constant/linear/exponential)
- **Custom Headers:** Add headers to webhook requests

### Ignore Chats
Filter events & storage at source:
- `status: true` - ignore Status/Stories
- `groups: true` - ignore Groups
- `channels: true` - ignore Channels
- `broadcast: true` - ignore Broadcasts

### Proxy
Configure per-session or globally:
```json
{
  "proxy": {
    "server": "localhost:3128",
    "username": "optional",
    "password": "optional"
  }
}
```

### NOWEB Store
Enable to save chats/contacts/messages:
```json
{
  "noweb": {
    "store": {
      "enabled": true,
      "fullSync": false  // false=3 months, true=1 year history
    }
  }
}
```

## Events
Subscribe to session events via webhooks:

### session.status
```json
{
  "event": "session.status",
  "session": "default",
  "payload": {
    "status": "WORKING",
    "statuses": [
      { "status": "STOPPED", "timestamp": 1700000001000 },
      { "status": "STARTING", "timestamp": 1700000002000 },
      { "status": "WORKING", "timestamp": 1700000003000 }
    ]
  }
}
```

## Best Practices
1. **QR Refresh:** Auto-refresh QR on `SCAN_QR_CODE` event
2. **Persistent Sessions:** Mount `.sessions` volume
3. **Autostart:** WAHA restarts sessions after container restart
4. **Multiple Sessions:** Use WAHA Plus for >1 session
5. **Device Name:** Use real browser names (Chrome, Firefox, Safari)
6. **Pairing Code:** Always have QR fallback (not always reliable)
