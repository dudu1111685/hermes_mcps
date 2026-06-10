# WAHA Server Setup (the engine behind waha-mcp)

waha-mcp talks to a WAHA server. This guide captures the configuration that
actually works in production, learned the hard way. Read it before wiring up
any agent.

## You need WAHA **Plus**, not Core

waha-mcp's whole value depends on media, and media is Plus-only:

| Capability | Core (free) | Plus |
|---|---|---|
| Send/receive text, reactions, chats, groups, webhooks | ✅ | ✅ |
| **Send media** (image/file/voice/video) | ❌ | ✅ |
| **Download incoming media** — the basis for voice transcription & viewing images | ❌ | ✅ |
| Status/Stories, Channels | ❌ | ✅ |
| Multiple sessions (several numbers) | 1 only | ✅ |

Without Plus you have a text-only bot — no "hear the voice note and reply",
no image viewing. **Plus is required.**

Get the image (subscribers only — [portal.devlike.pro](https://portal.devlike.pro)):

```bash
docker login -u devlikeapro -p <YOUR_DOCKER_KEY_FROM_PORTAL>
docker pull devlikeapro/waha-plus:latest
docker logout
```

> **Keep the image current.** WhatsApp breaks old clients every few months
> (you'll see `err-client-outdated` or endless reconnect loops). WAHA ships a
> release almost monthly to keep up. When connections suddenly stop working,
> the fix is almost always a fresh `docker pull` — not a config change.

## Use the **GOWS** engine

WAHA has several engines. For a 24/7 personal assistant, **GOWS** (Go /
whatsmeow) is the right choice:

| Engine | Verdict |
|---|---|
| **GOWS** ✅ | Stable across WhatsApp protocol updates, ~200MB RAM, full history sync. Our pick. |
| NOWEB (Baileys) | Same features, but the bundled Baileys had a handshake bug that got the device **force-unlinked within minutes** (`device_removed`). Avoid until WAHA ships a newer Baileys. |
| WEBJS | Runs a real Chromium — 2× the RAM and breaks every time WhatsApp updates its web bundle. Not for 24/7. |

**GOWS engine limits** — a few tools return a clean `501 not implemented`; none
are in the read→answer→act loop:
`waha_star_message`, `waha_pin_message`, `waha_get_contact_about`,
`waha_delete_chat`, `waha_clear_chat`.

## Run it

GOWS needs Redis for the MCP "Apps" feature; if you don't enable Apps you can
drop Redis and the `WAHA_APPS_ENABLED`/`REDIS_URL` lines.

```bash
# 1. Redis (only needed if WAHA_APPS_ENABLED=True)
docker network create waha-net
docker run -d --name waha-redis --restart unless-stopped --network waha-net \
  redis:7-alpine redis-server --requirepass redis

# 2. WAHA Plus on GOWS
docker run -d --name waha --restart unless-stopped --network waha-net \
  -p 3001:3000 \
  -v waha-sessions:/app/.sessions \
  -e WHATSAPP_API_KEY="$WAHA_API_KEY" \
  -e WAHA_API_KEY_PLAIN="$WAHA_API_KEY" \
  -e WHATSAPP_DEFAULT_ENGINE=GOWS \
  -e WHATSAPP_FILES_LIFETIME=0 \
  -e WAHA_PRESENCE_AUTO_ONLINE=False \
  -e WAHA_CLIENT_BROWSER_NAME=Chrome \
  -e WAHA_CLIENT_DEVICE_NAME=MacOS \
  -e WAHA_APPS_ENABLED=True \
  -e REDIS_URL="redis://:redis@waha-redis:6379" \
  devlikeapro/waha-plus:latest
```

Env notes:
- **`WHATSAPP_FILES_LIFETIME=0`** — never expire incoming media. WAHA's default
  is 180s, which makes transcription/download race against the clock.
- **`WAHA_API_KEY_PLAIN`** — required (alongside `WHATSAPP_API_KEY`) when
  `WAHA_APPS_ENABLED=True`; the container crash-loops without it.
- **`WAHA_PRESENCE_AUTO_ONLINE=False`** + browser/device overrides — reduce the
  bot fingerprint (see anti-ban below).
- The container listens on `3000` internally; we map host `3001`. The MCP
  server's `WAHA_URL` must be `http://localhost:3001`. (waha-mcp rewrites the
  media-URL origin automatically, so downloads work despite this mismatch.)

## Create the session — pull full history freely

```bash
curl -s -X POST -H "X-Api-Key: $WAHA_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"default","start":true}' \
  http://localhost:3001/api/sessions
```

Then fetch the QR and scan it from WhatsApp → **Linked devices → Link a device**:

```bash
curl -s -H "X-Api-Key: $WAHA_API_KEY" \
  "http://localhost:3001/api/default/auth/qr?format=image" -o qr.png
```

On GOWS, history syncs from the phone on link (HistorySync events) — you get
**months of history per chat for free**, no flag needed. (The `fullSync` toggle
is a NOWEB-only option; GOWS pulls history natively.) Contacts and chat **names**
sync in full via app-state regardless of message-history depth — so name
resolution works even for people you haven't messaged in years.

Wait for `WORKING`:

```bash
curl -s -H "X-Api-Key: $WAHA_API_KEY" http://localhost:3001/api/sessions/default
```

## Anti-ban: don't get the device unlinked

WhatsApp force-unlinks (and can eventually ban) devices that behave like
scripts. What we learned, the hard way:

- **Don't re-scan the QR repeatedly.** More than ~once per 48h raises a
  suspicion score; the sessions volume (`-v waha-sessions`) persists the link
  across container restarts so you rarely need to.
- **After `device_removed`, stop.** Wait 24–48h before re-linking; immediate
  retries escalate.
- **Group operations are the riskiest** — WhatsApp tolerates ~2 group mutations
  per 10 min. Never burst create+picture+invite+settings.
- **Pace messages** — bursts are the clearest bot signal.

waha-mcp **enforces these last two automatically** (a built-in throttle: 3–8s
jitter between sends, ≤8/min, group mutations ≥2min apart). When a tool answers
`Rate limit: wait Ns`, that's the throttle protecting the account — wait and
retry, don't hammer.

## Quick health check

```bash
# should print WORKING
curl -s -H "X-Api-Key: $WAHA_API_KEY" http://localhost:3001/api/sessions/default \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['status'])"
```
