# Hermes Agent Setup

Connect hermes_mcps to [hermes-agent](https://github.com/NousResearch/hermes-agent) so Hermes can read, answer, and act on your personal WhatsApp **and Telegram** (Telegram: see section 6).

## Architecture: two different WhatsApp roles

Don't confuse these:

| | Hermes **gateway** WhatsApp adapter | **waha-mcp** (this project) |
|---|---|---|
| What it is | A channel for *you to talk to Hermes* | Tools for *Hermes to operate your WhatsApp account* |
| Direction | You → Hermes (commands, chat) | Hermes → your chats (read what X wrote, reply as you) |
| Voice notes | No transcription | Transcribed via Soniox (`SONIOX_API_KEY`) |

They complement each other: use the gateway as the command channel, waha-mcp as the action surface.

## 1. Prerequisites

- **WAHA Plus** running in Docker on the **GOWS** engine, session authenticated.
  Follow [docs/waha-server-setup.md](./docs/waha-server-setup.md) first — it
  covers why Plus + GOWS, the exact `docker run`, full-history sync, and
  anti-ban. **Do not skip it**; the engine and image choice are what keep the
  device from getting unlinked.
- waha-mcp built: `npm install && npm run build`
- hermes-agent installed (`~/.hermes/` exists after first run)
- Optional: a [Soniox](https://soniox.com) API key for voice-note transcription
  (Hebrew + 60 languages, verified end-to-end).

## 2. Register the MCP server

Edit `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  waha:
    command: "node"
    args: ["/home/shlomo/hermes_mcps/dist/index.js"]
    env:
      WAHA_API_KEY: "${WAHA_API_KEY}"
      WAHA_URL: "http://localhost:3001"
      WAHA_DEFAULT_SESSION: "default"
      SONIOX_API_KEY: "${SONIOX_API_KEY}"
      USER_WHATSAPP_CHAT_ID: "<your-number>@c.us"
```

Put the secrets in `~/.hermes/.env`:

```bash
WAHA_API_KEY=your-waha-key
SONIOX_API_KEY=your-soniox-key   # optional — enables voice transcription
```

Note: Hermes passes MCP servers only a safe baseline environment plus what you
declare in `env` — undeclared variables will NOT reach the server.

`WAHA_DEFAULT_SESSION` sets the session every tool defaults to. For a
single-account setup, set it to your session name (e.g. `default`). If you
connect multiple WhatsApp accounts and want each tool call to require an
explicit `session` parameter, omit it. Call `waha_list_sessions` to see which
sessions are available.

## 3. Trim the tool list (recommended)

waha-mcp exposes 84 tools. Hermes lets you pick per server:

```bash
hermes mcp configure waha
```

A good minimal set for the read→answer→act loop:
`waha_inbox`, `waha_find_chat`, `waha_get_chat_context`, `waha_reply`,
`waha_get_media`, `waha_transcribe_message`, `waha_send_text`,
`waha_send_image`, `waha_send_file`, `waha_ask_user`, `waha_check_replies`,
`waha_check_number_exists`, `waha_mark_unread`, `waha_get_messages`,
`waha_check_auth_status`.
Add groups/labels/status tools only if you actually use them.

## 4. Install the skill

The behavioral playbook (when to use which tool, anti-ban rules, triage
workflow) ships in this repo as a standard [agentskills.io](https://agentskills.io) skill:

```bash
mkdir -p ~/.hermes/skills/messaging
cp -r /home/shlomo/hermes_mcps/skills/whatsapp-assistant ~/.hermes/skills/messaging/
cp -r /home/shlomo/hermes_mcps/skills/telegram-assistant ~/.hermes/skills/messaging/
```

Or point Hermes at the repo copy via `config.yaml` so it stays in sync with git:

```yaml
skills:
  external_dirs:
    - /home/shlomo/hermes_mcps/skills
```

## 5. Verify

```
hermes
> list your waha tools
> check whatsapp auth status
> what's waiting in my whatsapp inbox?
```

Expected: tool list shows the selected `waha_*` tools; auth status `WORKING`;
inbox returns chats with previews.

## 6. Telegram (same repo, second server)

This repo also ships a **Telegram MTProto MCP server** (`dist/telegram/index.js`)
that gives Hermes the same powers over your personal **Telegram** account:
inbox digest, conversation reading with inline voice transcription, send/reply/
react/edit, media download, search. 15 tools, all prefixed `tg_`.

One-time setup:

1. Create API credentials at <https://my.telegram.org> → *API development tools*
   (any app name works; you get `api_id` + `api_hash`).
2. Sign in once and generate a session string:

   ```bash
   cd /home/shlomo/hermes_mcps
   npm run telegram:login
   ```

   It prompts for the phone number, the code Telegram sends to your app, and a
   2FA password if set — then writes `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`
   and `TELEGRAM_SESSION` into the repo `.env`.
3. Register the server in `~/.hermes/config.yaml`:

   ```yaml
   mcp_servers:
     telegram:
       command: "node"
       args: ["/home/shlomo/hermes_mcps/dist/telegram/index.js"]
       env:
         TELEGRAM_API_ID: "${TELEGRAM_API_ID}"
         TELEGRAM_API_HASH: "${TELEGRAM_API_HASH}"
         TELEGRAM_SESSION: "${TELEGRAM_SESSION}"
         SONIOX_API_KEY: "${SONIOX_API_KEY}"
   ```

   and add the three values to `~/.hermes/.env`. **`TELEGRAM_SESSION` is a
   full-account credential — treat it exactly like a password.**

Core loop tools: `tg_inbox` → `tg_get_chat_context` → `tg_send_text`
(+ `tg_find_chat`, `tg_transcribe_message`, `tg_get_media`, `tg_react`).

If login codes never arrive (a known Telegram quirk when the account is
logged in elsewhere), use the QR flow instead: `npm run telegram:login:qr` —
scan from the app via Settings → Devices → Link Desktop Device.

The behavioral playbook for Telegram ships as a skill too:
[`skills/telegram-assistant/`](./skills/telegram-assistant/SKILL.md)
(installed by the `cp -r` commands in section 4).

## 7. Autonomy patterns

- **Scheduled triage**: Hermes has a built-in `cronjob` tool — e.g. "every 30
  minutes run waha_inbox and message me if anything needs attention". Note:
  cron runs start fresh sessions with no chat context, so the skill +
  `USER_WHATSAPP_CHAT_ID` must carry all needed configuration.
- **Asking you questions**: if you chat with Hermes through the gateway, it can
  just ask you there. The `waha_ask_user` / `waha_check_replies` pair is for
  reaching people *outside* the current conversation.
- **Proactive messages**: Hermes's own `send_message` tool sends via connected
  gateway platforms; `waha_reply` / `waha_send_text` send from *your* WhatsApp
  account. Pick by whose identity should appear.

## Troubleshooting

- **Tools missing** → `hermes mcp` to check connection state; verify the
  `dist/index.js` path and that `npm run build` ran.
- **`WAHA_API_KEY environment variable is required`** → the variable isn't
  declared under the server's `env` block (Hermes filters everything else out).
- **Voice notes show `[voice message — set SONIOX_API_KEY ...]`** → key missing
  from the `env` block or from `~/.hermes/.env`.
- **A few tools return `501 not implemented by 'GOWS'`** → expected: GOWS
  doesn't support star/pin messages, get-contact-about, delete/clear chat. Not
  a bug; none are in the core loop.
- **Device keeps getting unlinked (`device_removed`)** → you're on NOWEB or an
  outdated image, or you re-scanned the QR too often. See the engine + anti-ban
  sections in [docs/waha-server-setup.md](./docs/waha-server-setup.md).
