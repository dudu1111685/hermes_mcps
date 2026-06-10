<div align="center">
  <img src=".github/logo.png" alt="WAHA MCP Logo" width="200"/>
  
  # WAHA MCP Server
  
  **WhatsApp HTTP API integration for Claude Desktop & MCP-compatible clients**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
  [![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
  
  [Documentation](./docs/README.md) • [Installation](#installation) • [Configuration](#configuration) • [🤖 Agent Setup](./AGENT_SETUP.md) • [🪽 Hermes Setup](./HERMES_SETUP.md) • [Tools Reference](#tools-reference)
</div>

---

## 🚀 What is WAHA MCP?

WAHA MCP Server bridges the powerful [WAHA (WhatsApp HTTP API)](https://waha.devlike.pro/) with AI assistants like Claude Desktop, enabling seamless WhatsApp automation through the Model Context Protocol (MCP).

### ✨ Key Features

- 📱 **Complete WhatsApp Control** - Send/receive messages, manage chats, create groups
- 🎯 **84 Tools** - Comprehensive API coverage for sessions, messaging, contacts, groups, status, labels, and interactive workflows
- 🧠 **Agent-Grade Compound Tools** - `waha_inbox` (triage), `waha_find_chat` (name → chatId), `waha_reply` (human-like answering), `waha_get_chat_context` (LLM-ready conversation rendering)
- 🎙️ **Voice Transcription** - Incoming voice notes transcribed automatically via [Soniox](https://soniox.com) (Hebrew + 60 languages, OGG/Opus native) — verified end-to-end on real speech
- 🔄 **Smart Media Handling** - Auto-conversion for voice/video, URLs & local files, inline image viewing for vision models
- 🤖 **AI-Native** - Token-efficient compact responses, MCP tool annotations (read-only/destructive hints)
- 🔒 **Secure** - Environment-based API key management, optional local-file sandbox (`WAHA_MCP_FILES_DIR`)
- ⚡ **Fast & Reliable** - TypeScript-powered, request timeouts, typed errors, vitest suite

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **WAHA Plus** on the **GOWS** engine, running in Docker - required for media
  (the basis of transcription & image viewing) and for connection stability.
  **[Full server setup → `docs/waha-server-setup.md`](./docs/waha-server-setup.md)**
- **WAHA API Key** - any strong secret you set via `WHATSAPP_API_KEY`
- *(optional)* **Soniox API key** - enables voice-note transcription
  ([soniox.com](https://soniox.com); Hebrew + 60 languages)

> **Why Plus + GOWS?** Core can't download incoming media (no voice
> transcription, no image viewing). NOWEB/WEBJS get the device force-unlinked
> or break on WhatsApp updates. The setup guide explains the tradeoffs and the
> anti-ban configuration in detail.

---

## 🛠️ Installation

### 1. Clone & Install

```bash
git clone https://github.com/dudu1111685/waha-mcp.git
cd waha-mcp
npm install
npm run build
```

### 2. Set Environment Variables

Create a `.env` file or export variables:

```bash
export WAHA_API_KEY="your-api-key-here"
export WAHA_URL="http://localhost:3001"      # Optional, defaults to localhost:3001
export SONIOX_API_KEY="your-soniox-key"      # Optional — enables voice note transcription
export WAHA_TIMEOUT_MS="30000"               # Optional — WAHA request timeout
export WAHA_MCP_FILES_DIR="/tmp/waha-mcp"    # Optional — restrict local-file reads to this dir
```

---

## ⚙️ Configuration

### Claude Desktop

Add to `claude_desktop_config.json`:

**Linux:** `~/.config/claude/claude_desktop_config.json`  
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "waha": {
      "command": "node",
      "args": ["/absolute/path/to/waha-mcp/dist/index.js"],
      "env": {
        "WAHA_API_KEY": "your-api-key-here",
        "WAHA_URL": "http://localhost:3001"
      }
    }
  }
}
```

### Cline / VS Code

Add to your Cline MCP settings (`~/.vscode/mcp.json` or workspace settings):

```json
{
  "mcpServers": {
    "waha": {
      "command": "node",
      "args": ["/absolute/path/to/waha-mcp/dist/index.js"],
      "env": {
        "WAHA_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### AI Agents (hermes-agent, Claude Code, and more)

**🤖 Enable truly autonomous AI workflows:**

Instead of the agent stopping when it needs user input, it can ask questions via WhatsApp and continue working!

**🚀 Setup guides:** **[`AGENT_SETUP.md`](./AGENT_SETUP.md)** (Claude Code / generic MCP) • **[`HERMES_SETUP.md`](./HERMES_SETUP.md)** (hermes-agent)

**Quick config example:**
```json
{
  "mcpServers": {
    "waha": {
      "command": "node",
      "args": ["/path/to/waha-mcp/dist/index.js"],
      "env": {
        "WAHA_API_KEY": "your-key",
        "USER_WHATSAPP_CHAT_ID": "1234567890@c.us"
      }
    }
  },
  "globalInstructions": "When you need user input during development, send the question with waha_ask_user and poll waha_check_replies every ~30-60s until answered. Never stop and wait for manual console input."
}
```

**How it works:**
1. Claude hits a question → asks via WhatsApp
2. You reply from your phone
3. Claude continues working immediately
4. Zero downtime! ⚡

**📖 See also:**
- [`AGENT_SETUP.md`](./AGENT_SETUP.md) - Setup + the ask/check-replies pattern for any MCP agent
- [`HERMES_SETUP.md`](./HERMES_SETUP.md) - hermes-agent: config.yaml, tool selection, autonomy patterns
- [`skills/whatsapp-assistant/`](./skills/whatsapp-assistant/SKILL.md) - Behavioral playbook skill (agentskills.io format)

### Other MCP Clients

Use the `mcporter` CLI for quick testing:

```bash
mcporter call 'waha-mcp.waha_list_sessions()'
mcporter call 'waha-mcp.waha_send_text(chatId: "1234567890@c.us", text: "Hello from MCP!")'
```

---

## 🧰 Tools Reference

### 📂 Categories

<details open>
<summary><b>🧠 Agent-Grade Compound Tools (4 tools) — start here</b></summary>

| Tool | Description |
|------|-------------|
| `waha_inbox` | **Triage first.** Chats sorted by recent activity with last-message previews — "what needs attention?" |
| `waha_find_chat` | Resolve a person/group **name** to a chatId (fuzzy, ranked). Use before any send/read when you only have a name |
| `waha_get_chat_context` | **Primary reading tool.** LLM-ready conversation rendering: names resolved, voice notes transcribed inline (Soniox), media summarized |
| `waha_reply` | Human-like answering: mark seen → typing indicator → proportional delay → send (anti-ban sequence in one call) |

</details>

<details>
<summary><b>🎙️ Media & Transcription (3 tools)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_transcribe_message` | Transcribe a specific voice message via Soniox (`SONIOX_API_KEY` required; Hebrew + 60 languages) |
| `waha_get_media` | Download incoming media — images returned inline so vision models can see them, larger files saved to a temp path |
| `waha_get_message` | Fetch a single message (quoted-message resolution, fresh media URLs) |

</details>

<details>
<summary><b>Session Management (9 tools)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_list_sessions` | List all sessions and their statuses |
| `waha_get_session` | Get detailed info about a session |
| `waha_create_session` | Create a new session |
| `waha_start_session` | Start a stopped session |
| `waha_stop_session` | Stop a running session |
| `waha_restart_session` | Restart a session |
| `waha_delete_session` | Delete a session permanently |
| `waha_logout_session` | Disconnect WhatsApp account from session |
| `waha_screenshot` | Visual debug — screenshot of the WhatsApp Web screen (returned as an image) |

</details>

<details>
<summary><b>Authentication (3 tools)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_get_qr_code` | Get QR code for WhatsApp authentication |
| `waha_request_pairing_code` | Request phone number pairing code |
| `waha_check_auth_status` | Check session authentication status |

</details>

<details>
<summary><b>Messaging (17 tools)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_send_text` | Send a text message (mentions, reply-to, link preview) |
| `waha_send_image` | Send an image (local file or URL) |
| `waha_send_video` | Send a video with auto-conversion |
| `waha_send_voice` | Send a voice message with auto-conversion |
| `waha_send_file` | Send any document/file |
| `waha_send_location` | Send a location pin |
| `waha_send_contact` | Send a contact vCard |
| `waha_send_poll` | Create and send a poll |
| `waha_react_to_message` | React with emoji 👍❤️😂 |
| `waha_forward_message` | Forward a message to another chat |
| `waha_get_messages` | Get messages with pagination + timestamp/ack filters |
| `waha_delete_message` | Delete a message |
| `waha_edit_message` | Edit a sent message |
| `waha_mark_as_read` | Mark messages as read |
| `waha_star_message` | Star/unstar a message |
| `waha_pin_message` / `waha_unpin_message` | Pin a message for 24h/7d/30d |

**📤 Media Upload Features:**
- ✅ Local files & URLs supported
- ✅ Auto MIME type detection
- ✅ Auto video/voice conversion to WhatsApp format
- ✅ 50+ file types supported
- ✅ Base64 encoding handled automatically

</details>

<details>
<summary><b>Chat Management (6 tools)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_list_chats` | List all chats (sortable, paginated) |
| `waha_get_chat` | Get chat info (via overview lookup) |
| `waha_archive_chat` | Archive/unarchive a chat |
| `waha_mark_unread` | Mark a chat unread for human follow-up |
| `waha_delete_chat` | Delete a chat |
| `waha_clear_chat` | Clear all messages in a chat |

> Note: WAHA has no chat-level pin/mute endpoints, so no pin/mute chat tools are exposed (message pinning is available via `waha_pin_message`).

</details>

<details>
<summary><b>Contacts (7 tools)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_get_contacts` | Get contacts (paginated, sortable) |
| `waha_get_contact` | Get info about a contact |
| `waha_get_contact_about` | Get a contact's "about" status text |
| `waha_check_number_exists` | Check if number is on WhatsApp (verify before first-time sends!) |
| `waha_update_contact` | Save/edit a contact's name |
| `waha_block_contact` | Block/unblock a contact |
| `waha_get_profile_picture` | Get profile picture URL |

</details>

<details>
<summary><b>Groups (17 tools)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_create_group` | Create a new group |
| `waha_list_groups` | List all groups (lean payload by default) |
| `waha_get_group` | Get detailed group info |
| `waha_get_group_participants` | List group participants |
| `waha_add_group_participants` | Add participants |
| `waha_remove_group_participants` | Remove participants |
| `waha_promote_group_participant` | Promote to admin |
| `waha_demote_group_participant` | Demote from admin |
| `waha_update_group_subject` | Update group name |
| `waha_update_group_description` | Update group description |
| `waha_update_group_picture` | Set group picture (local file or URL) |
| `waha_join_group` | Join a group via invite link/code |
| `waha_preview_group_invite` | Preview a group before joining |
| `waha_group_security_settings` | Admin-only messages/info settings |
| `waha_leave_group` | Leave a group |
| `waha_get_group_invite_code` | Get invite link |
| `waha_revoke_group_invite` | Revoke & regenerate link |

</details>

<details>
<summary><b>Presence (6 tools)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_set_presence` | Set online/offline status |
| `waha_get_presence` | Get contact's presence (last seen) |
| `waha_subscribe_presence` | Subscribe to a contact's presence updates |
| `waha_start_typing` | Show typing indicator |
| `waha_stop_typing` | Stop typing indicator |
| `waha_mark_as_read` | Send read receipts (see Messaging) |

</details>

<details>
<summary><b>Status / Stories (4 tools, WAHA Plus)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_send_text_status` | Post a text status (background color, font) |
| `waha_send_image_status` | Post an image status (local file or URL) |
| `waha_send_voice_status` | Post a voice status (auto-converted to Opus) |
| `waha_delete_status` | Delete a posted status |

</details>

<details>
<summary><b>Labels (7 tools, WhatsApp Business)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_get_labels` | Get all labels |
| `waha_create_label` | Create a new label |
| `waha_update_label` | Rename/recolor a label |
| `waha_delete_label` | Delete a label |
| `waha_get_chat_labels` | Get labels of a chat |
| `waha_set_chat_labels` | Replace a chat's label set |
| `waha_get_chats_by_label` | Find all chats with a label (triage loop) |

</details>

<details>
<summary><b>🆕 Interactive Workflows (2 tools)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_ask_user` | Send a question via WhatsApp, return immediately with tracking info (non-blocking) |
| `waha_check_replies` | Check for replies since the question was sent — single quick poll, the agent manages its own waiting loop |

**Use Case Example:**
```typescript
// Claude Code is building a feature and needs clarification
const q = await waha_ask_user({
  question: "Should I use REST or GraphQL for the API?",
  chatId: "1234567890@c.us"
});
// ...continue other work, then periodically:
const replies = await waha_check_replies({
  chatId: "1234567890@c.us",
  sinceTimestamp: q.sinceTimestamp,
  questionMessageId: q.questionMessageId
});
// User replied from phone: "Use GraphQL" → continue with GraphQL
```

**Why non-blocking?** The old blocking design waited up to 60 minutes inside one tool call — every MCP client times out long before that. The new pair lets the agent keep working and poll on its own schedule. Quoted replies to the question are detected reliably (including in groups via the `fromUser` filter).

</details>

---

## 🔒 Security Note: Local File Access

Send tools that accept a local file path (`waha_send_image`, `waha_send_file`, `waha_send_voice`, status tools, etc.) can read any file the server process can access. Since chat content (including voice transcripts) from other people reaches the agent, a prompt-injected instruction could try to exfiltrate local files (e.g. SSH keys) by "sending" them.

To restrict reads to a single directory, set the `WAHA_MCP_FILES_DIR` environment variable (e.g. to `/tmp/waha-mcp`, where `waha_get_media` saves downloads). Paths outside it are then rejected. When unset, any local path is allowed.

---

## 📚 Chat ID Formats

Understanding WhatsApp ID formats:

| Type | Format | Example |
|------|--------|---------|
| **User** | `{phone}@c.us` | `1234567890@c.us` |
| **Group** | `{id}@g.us` | `1234567890-1234567890@g.us` |
| **Channel** | `{id}@newsletter` | `1234567890@newsletter` |
| **Status** | `status@broadcast` | `status@broadcast` |

> **Note:** Phone numbers should exclude the `+` prefix.

---

## 🎯 Quick Examples

### Send a Text Message

```bash
mcporter call 'waha-mcp.waha_send_text(
  chatId: "1234567890@c.us",
  text: "Hello from WAHA MCP!"
)'
```

### Send an Image from URL

```bash
mcporter call 'waha-mcp.waha_send_image(
  chatId: "1234567890@c.us",
  imageUrl: "https://example.com/photo.jpg",
  caption: "Check this out!"
)'
```

### Create a Group & Add Participants

```bash
# Create group
mcporter call 'waha-mcp.waha_create_group(
  name: "Team Chat",
  participants: ["1111111111@c.us", "2222222222@c.us"]
)'

# Add more participants
mcporter call 'waha-mcp.waha_add_group_participants(
  chatId: "{group_id}@g.us",
  participants: ["3333333333@c.us"]
)'
```

### List All Chats

```bash
mcporter call 'waha-mcp.waha_list_chats()'
```

---

## 🧪 Development

### Run in Watch Mode

```bash
npm run dev  # Recompiles on file changes
```

### Run Tests

```bash
npm test
```

### Build for Production

```bash
npm run build
```

---

## 📖 Documentation

For detailed documentation, see the [docs](./docs/README.md) folder:

- [Session Management](./docs/01-sessions.md)
- [Messaging Guide](./docs/02-messaging.md)
- [Group Management](./docs/03-groups.md)
- [Media Handling](./docs/04-media.md)
- [Troubleshooting](./docs/05-troubleshooting.md)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [WAHA (WhatsApp HTTP API)](https://waha.devlike.pro/) - The backbone of this integration
- [Model Context Protocol](https://modelcontextprotocol.io/) - Enabling AI-native tool integration
- [Anthropic](https://www.anthropic.com/) - For Claude Desktop and MCP SDK

---

<div align="center">
  
  **Built with ❤️ for the MCP community**
  
  [⭐ Star this repo](https://github.com/dudu1111685/waha-mcp) • [🐛 Report Bug](https://github.com/dudu1111685/waha-mcp/issues) • [💡 Request Feature](https://github.com/dudu1111685/waha-mcp/issues)
  
</div>
