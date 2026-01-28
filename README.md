<div align="center">
  <img src=".github/logo.png" alt="WAHA MCP Logo" width="200"/>
  
  # WAHA MCP Server
  
  **WhatsApp HTTP API integration for Claude Desktop & MCP-compatible clients**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
  [![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
  
  [Documentation](./docs/README.md) • [Installation](#installation) • [Configuration](#configuration) • [Tools Reference](#tools-reference)
</div>

---

## 🚀 What is WAHA MCP?

WAHA MCP Server bridges the powerful [WAHA (WhatsApp HTTP API)](https://waha.devlike.pro/) with AI assistants like Claude Desktop, enabling seamless WhatsApp automation through the Model Context Protocol (MCP).

### ✨ Key Features

- 📱 **Complete WhatsApp Control** - Send/receive messages, manage chats, create groups
- 🎯 **63 Tools** - Comprehensive API coverage for sessions, messaging, contacts, groups, and interactive workflows
- 🔄 **Smart Media Handling** - Auto-conversion for voice/video, support for URLs & local files
- 🤖 **AI-Native** - Built specifically for LLM integration via MCP
- 🔒 **Secure** - Environment-based API key management
- ⚡ **Fast & Reliable** - TypeScript-powered with robust error handling

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **A running WAHA instance** - [Setup guide](https://waha.devlike.pro/docs/how-to/install/)
- **WAHA API Key** - Generated from your WAHA dashboard

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
export WAHA_URL="http://localhost:3001"  # Optional, defaults to localhost:3001
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

### Claude Code (Autonomous Development)

**🤖 For AI-powered development with automatic question handling:**

Claude Code and similar AI assistants can use the `ask_user_via_whatsapp` tool to ask questions and continue working autonomously.

**Setup:**
1. Configure MCP as shown above (same config as Claude Desktop)
2. Create a `.whatsapp-chat-id` file in your project:
   ```bash
   echo "YOUR_PHONE@c.us" > .whatsapp-chat-id
   ```
3. Claude Code will now ask questions via WhatsApp instead of stopping!

**📖 Read [`CLAUDE_CODE_INSTRUCTIONS.md`](./CLAUDE_CODE_INSTRUCTIONS.md) for detailed usage instructions.**

**Example workflow:**
```typescript
// Claude Code hits a question while building
const answer = await ask_user_via_whatsapp({
  question: "Should I use REST or GraphQL?",
  chatId: "1234567890@c.us",
  timeoutMinutes: 30
});
// You reply from your phone → Claude continues working
```

This enables truly autonomous AI development - Claude asks questions via WhatsApp, you answer from anywhere, work continues! 🚀

### Other MCP Clients

Use the `mcporter` CLI for quick testing:

```bash
mcporter call 'waha-mcp.waha_list_sessions()'
mcporter call 'waha-mcp.waha_send_text(chatId: "1234567890@c.us", text: "Hello from MCP!")'
```

---

## 🧰 Tools Reference

### 📂 Categories

<details>
<summary><b>Session Management (8 tools)</b></summary>

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
<summary><b>Messaging (14 tools)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_send_text` | Send a text message |
| `waha_send_image` | Send an image (local file or URL) |
| `waha_send_video` | Send a video with auto-conversion |
| `waha_send_voice` | Send a voice message with auto-conversion |
| `waha_send_file` | Send any document/file |
| `waha_send_location` | Send a location pin |
| `waha_send_contact` | Send a contact vCard |
| `waha_send_poll` | Create and send a poll |
| `waha_react_to_message` | React with emoji 👍❤️😂 |
| `waha_forward_message` | Forward a message |
| `waha_get_messages` | Get messages with pagination |
| `waha_delete_message` | Delete a message |
| `waha_edit_message` | Edit a sent message |
| `waha_mark_as_read` | Mark messages as read |
| `waha_star_message` | Star/unstar a message |

**📤 Media Upload Features:**
- ✅ Local files & URLs supported
- ✅ Auto MIME type detection
- ✅ Auto video/voice conversion to WhatsApp format
- ✅ 50+ file types supported
- ✅ Base64 encoding handled automatically

</details>

<details>
<summary><b>Chat Management (7 tools)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_list_chats` | List all chats |
| `waha_get_chat` | Get detailed chat info |
| `waha_archive_chat` | Archive/unarchive a chat |
| `waha_pin_chat` | Pin/unpin a chat |
| `waha_mute_chat` | Mute/unmute a chat |
| `waha_delete_chat` | Delete a chat |
| `waha_clear_chat` | Clear all messages |

</details>

<details>
<summary><b>Contacts (5 tools)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_get_contacts` | Get all contacts |
| `waha_get_contact` | Get info about a contact |
| `waha_check_number_exists` | Check if number is on WhatsApp |
| `waha_block_contact` | Block/unblock a contact |
| `waha_get_profile_picture` | Get profile picture URL |

</details>

<details>
<summary><b>Groups (13 tools)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_create_group` | Create a new group |
| `waha_list_groups` | List all groups |
| `waha_get_group` | Get detailed group info |
| `waha_get_group_participants` | List group participants |
| `waha_add_group_participants` | Add participants |
| `waha_remove_group_participants` | Remove participants |
| `waha_promote_group_participant` | Promote to admin |
| `waha_demote_group_participant` | Demote from admin |
| `waha_update_group_subject` | Update group name |
| `waha_update_group_description` | Update group description |
| `waha_update_group_picture` | Set group profile picture |
| `waha_leave_group` | Leave a group |
| `waha_get_group_invite_code` | Get invite link |
| `waha_revoke_group_invite` | Revoke & regenerate link |

</details>

<details>
<summary><b>Presence & Status (5 tools)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_set_presence` | Set online/offline status |
| `waha_get_presence` | Get contact's presence |
| `waha_start_typing` | Show typing indicator |
| `waha_stop_typing` | Stop typing indicator |
| `waha_send_status` | Post a text status/story |

</details>

<details>
<summary><b>Labels (5 tools)</b></summary>

| Tool | Description |
|------|-------------|
| `waha_get_labels` | Get all labels |
| `waha_create_label` | Create a new label |
| `waha_delete_label` | Delete a label |
| `waha_add_label_to_chat` | Add label to chat |
| `waha_remove_label_from_chat` | Remove label from chat |

</details>

<details>
<summary><b>🆕 Interactive Workflows (1 tool)</b></summary>

| Tool | Description |
|------|-------------|
| `ask_user_via_whatsapp` | **🚀 NEW!** Send a question and WAIT for user reply (blocking operation). Perfect for Claude Code workflows that need user input mid-execution. |

**Use Case Example:**
```typescript
// Claude Code is building a feature and needs clarification
const reply = await ask_user_via_whatsapp({
  question: "Should I use REST or GraphQL for the API?",
  chatId: "1234567890@c.us",
  timeoutMinutes: 30
});
// User replies from phone: "Use GraphQL"
// Claude Code continues with GraphQL implementation
```

**How it works:**
1. Sends your question via WhatsApp
2. Polls for new messages from the user
3. Returns the reply text when received
4. Includes timeout handling (default: 60 minutes)

**Perfect for:**
- 🤖 Claude Code asking questions mid-workflow
- 💡 Getting user input while you're away from the computer
- 🔄 Building truly interactive AI automations
- 📱 Answering from your phone while AI continues working

</details>

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
