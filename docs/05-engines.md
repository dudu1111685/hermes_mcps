# Engines Comparison

WAHA supports 3 engines under the hood. Choose based on your needs.

## Engines Overview

### WEBJS (Default)
- **Tech:** Puppeteer + Chrome browser
- **Stability:** ⭐⭐⭐⭐⭐ Stable & reliable
- **Performance:** 🐌 Heavy (Chrome overhead)
- **Memory:** 400MB per session
- **Use Case:** Small scale (1-10 sessions)

### NOWEB
- **Tech:** WebSocket (no browser)
- **Stability:** ⭐⭐⭐⭐ Good
- **Performance:** 🚀 Fast & lightweight
- **Memory:** 200MB per session
- **Use Case:** Medium scale (10-100 sessions)
- **Special:** Requires Store for chats/contacts

### GOWS (Golang)
- **Tech:** Golang WebSocket
- **Stability:** ⭐⭐⭐⭐⭐ Very stable
- **Performance:** 🚀🚀 Fastest
- **Memory:** 200MB per session
- **Use Case:** Large scale (100-500 sessions)

## Feature Matrix

| Feature | WEBJS | NOWEB | GOWS |
|---------|-------|-------|------|
| Text Messages | ✔️ | ✔️ | ✔️ |
| Media (Image/Video) | ✔️ | ✔️ | ✔️ |
| Voice Messages | ✔️ | ✔️ | ✔️ |
| Groups | ✔️ | ✔️ | ✔️ |
| Contacts | ✔️ | ✔️* | ✔️ |
| Polls | ✔️ | ✔️ | ✔️ |
| Reactions | ✔️ | ✔️ | ✔️ |
| Status/Stories | ✔️ | ✔️ | ✔️ |
| Channels | ✔️ | ✔️ | ✔️ |
| Presence | ✔️ | ✔️ | ✔️ |
| Labels | ✔️ | ✔️ | ✔️ |
| Pairing Code | ➕ | ✔️ | ✔️ |

*NOWEB requires Store enabled

## Set Engine

### Docker
```bash
# WEBJS (default)
docker run -e "WHATSAPP_DEFAULT_ENGINE=WEBJS" devlikeapro/waha-plus

# NOWEB
docker run -e "WHATSAPP_DEFAULT_ENGINE=NOWEB" devlikeapro/waha-plus

# GOWS
docker run -e "WHATSAPP_DEFAULT_ENGINE=GOWS" devlikeapro/waha-plus
```

### Per Session
You can't change engine per session - it's set globally.

## WEBJS Configuration

### Session Config
```json
{
  "config": {
    "webjs": {
      "tagsEventsOn": false  # Enable for presence.update/message.ack
    }
  }
}
```

⚠️ `tagsEventsOn` impacts performance - use with caution

### Global Config
```bash
WAHA_WEBJS_PUPPETER_ARGS=--single-process
```

## NOWEB Configuration

### Enable Store (Required!)
```json
{
  "config": {
    "noweb": {
      "store": {
        "enabled": true,
        "fullSync": false  # false=3mo, true=1yr history
      },
      "markOnline": true  # Send online when session starts
    }
  }
}
```

**Without Store:**
- No contacts API
- No chats list
- No message history
- Good for "send-only" bots

**With Store:**
- Stores in SQLite (file) or MongoDB
- Access to history
- Reactions in `_data.reactions`
- Poll votes in `_data.pollUpdates`

### Storage
- **File:** `.sessions/noweb/{sessionName}/store.sqlite3`
- **MongoDB:** `waha_noweb_{sessionName}` collections

⚠️ Don't write to store manually!

## GOWS Configuration
Similar to NOWEB. Golang-based for maximum performance.

## Resource Comparison

| Sessions | WEBJS | NOWEB | GOWS |
|----------|-------|-------|------|
| 1 | 0.3CPU/400MB | 0.1CPU/200MB | 0.1CPU/200MB |
| 10 | 3CPU/2.5GB | 1CPU/2GB | 0.5CPU/1GB |
| 50 | 15CPU/20GB | 2CPU/4GB | 1.5CPU/3GB |
| 100 | N/A | 4CPU/8GB | 3-5CPU/5GB |
| 500 | N/A | N/A | 5-8CPU/25GB |

## Choosing an Engine

### Use WEBJS if:
- Starting small (1-10 sessions)
- Need maximum stability
- Don't mind resource usage
- **Default choice** for beginners

### Use NOWEB if:
- Medium scale (10-100 sessions)
- Want lighter resource usage
- Don't need browser overhead
- Can handle rare edge cases

### Use GOWS if:
- Large scale (100-500 sessions)
- Need absolute best performance
- Golang-based infrastructure
- Maximum sessions per server

## Switching Engines
⚠️ **Cannot switch without data loss!**
- Stop all sessions
- Change `WHATSAPP_DEFAULT_ENGINE`
- Re-authenticate all sessions
- Session data NOT portable between engines

## Best Practices
1. **Start with WEBJS** - most stable
2. **Scale to NOWEB/GOWS** when needed
3. **Enable Store** on NOWEB/GOWS
4. **Monitor resources** per session
5. **Test engine** before production
