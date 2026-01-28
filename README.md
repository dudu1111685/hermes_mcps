# WAHA MCP Server

An MCP (Model Context Protocol) server for [WAHA (WhatsApp HTTP API)](https://waha.devlike.pro/). Lets you control WhatsApp through Claude Desktop, Cline, or any MCP-compatible client.

## Prerequisites

- Node.js 18+
- A running [WAHA](https://waha.devlike.pro/) instance
- A WAHA API key

## Setup

```bash
# Clone and install
git clone <repo-url>
cd waha-mcp
npm install

# Build
npm run build
```

## Configuration

Set two environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WAHA_API_KEY` | Yes | - | Your WAHA API key |
| `WAHA_URL` | No | `http://localhost:3001` | WAHA instance URL |

## Usage with Claude Desktop

Add to your Claude Desktop config (`~/.config/claude/claude_desktop_config.json` on Linux, `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

## Usage with Cline / VS Code

Add to your Cline MCP settings:

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

## Available Tools

### Session Management
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

### Authentication
| Tool | Description |
|------|-------------|
| `waha_get_qr_code` | Get QR code for WhatsApp authentication |
| `waha_request_pairing_code` | Request phone number pairing code |
| `waha_check_auth_status` | Check session authentication status |

### Messaging
| Tool | Description |
|------|-------------|
| `waha_send_text` | Send a text message |
| `waha_send_image` | Send an image |
| `waha_send_video` | Send a video |
| `waha_send_voice` | Send a voice message |
| `waha_send_file` | Send a document/file |
| `waha_send_location` | Send a location |
| `waha_send_contact` | Send a contact card (vCard) |
| `waha_send_poll` | Create and send a poll |
| `waha_react_to_message` | React to a message with an emoji |
| `waha_forward_message` | Forward a message to another chat |
| `waha_get_messages` | Get messages from a chat (with pagination) |
| `waha_delete_message` | Delete a message |
| `waha_edit_message` | Edit a sent message |
| `waha_mark_as_read` | Mark messages as read |
| `waha_star_message` | Star or unstar a message |

### Chat Management
| Tool | Description |
|------|-------------|
| `waha_list_chats` | List all chats |
| `waha_get_chat` | Get detailed chat info |
| `waha_archive_chat` | Archive or unarchive a chat |
| `waha_pin_chat` | Pin or unpin a chat |
| `waha_mute_chat` | Mute or unmute a chat |
| `waha_delete_chat` | Delete a chat |
| `waha_clear_chat` | Clear all messages in a chat |

### Contacts
| Tool | Description |
|------|-------------|
| `waha_get_contacts` | Get all contacts |
| `waha_get_contact` | Get info about a specific contact |
| `waha_check_number_exists` | Check if a phone number is on WhatsApp |
| `waha_block_contact` | Block or unblock a contact |
| `waha_get_profile_picture` | Get contact's profile picture URL |

### Groups
| Tool | Description |
|------|-------------|
| `waha_create_group` | Create a new group |
| `waha_list_groups` | List all groups |
| `waha_get_group` | Get detailed group info |
| `waha_get_group_participants` | List group participants |
| `waha_add_group_participants` | Add participants to a group |
| `waha_remove_group_participants` | Remove participants from a group |
| `waha_promote_group_participant` | Promote to admin |
| `waha_demote_group_participant` | Demote from admin |
| `waha_update_group_subject` | Update group name |
| `waha_update_group_description` | Update group description |
| `waha_update_group_picture` | Set group profile picture |
| `waha_leave_group` | Leave a group |
| `waha_get_group_invite_code` | Get group invite link |
| `waha_revoke_group_invite` | Revoke and regenerate invite link |

### Presence & Status
| Tool | Description |
|------|-------------|
| `waha_set_presence` | Set online/offline status |
| `waha_get_presence` | Get a contact's presence |
| `waha_start_typing` | Show typing indicator |
| `waha_stop_typing` | Stop typing indicator |
| `waha_send_status` | Post a text status/story |

### Labels
| Tool | Description |
|------|-------------|
| `waha_get_labels` | Get all labels |
| `waha_create_label` | Create a new label |
| `waha_delete_label` | Delete a label |
| `waha_add_label_to_chat` | Add a label to a chat |
| `waha_remove_label_from_chat` | Remove a label from a chat |

## Chat ID Formats

- **User:** `1234567890@c.us` (phone number without `+`)
- **Group:** `1234567890@g.us`
- **Channel:** `1234567890@newsletter`
- **Status:** `status@broadcast`

## Development

```bash
# Watch mode (recompile on changes)
npm run dev

# Run tests
npm test
```

## License

MIT
