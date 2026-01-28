# WAHA MCP Server Project

## Goal
Build a comprehensive, production-grade MCP (Model Context Protocol) server for WAHA (WhatsApp HTTP API).

## Requirements

### Must Have (Priority 1)
1. **Session Management**
   - Create/start/stop/restart sessions
   - Get session status and info
   - List all sessions
   - Delete sessions
   - Logout

2. **Authentication**
   - Request pairing code (phone number auth)
   - Get QR code (both PNG and raw)
   - Check authentication status

3. **Messaging**
   - Send text messages
   - Send media (images, videos, audio, documents)
   - Send location
   - Send contacts
   - Send polls
   - Reply to messages
   - React to messages
   - Forward messages

4. **Message Management**
   - Get messages (with pagination)
   - Get message by ID
   - Delete messages
   - Edit messages
   - Mark as read/unread
   - Star/unstar messages

5. **Chats Management**
   - List chats
   - Get chat info
   - Archive/unarchive chats
   - Pin/unpin chats
   - Mute/unmute chats
   - Delete chats
   - Clear chat history

6. **Contacts**
   - Get contacts
   - Get contact info
   - Check if number exists on WhatsApp
   - Block/unblock contacts
   - Get profile picture

7. **Groups**
   - Create groups
   - Get group info
   - List group participants
   - Add/remove participants
   - Update group settings (name, description, picture)
   - Leave group
   - Promote/demote admins
   - Update group invite link

8. **Presence & Status**
   - Get presence (online/offline/typing)
   - Set presence
   - Get status/stories
   - Post status

9. **Labels & Categories**
   - Get labels
   - Create/delete labels
   - Add/remove labels from chats

### Nice to Have (Priority 2)
- Channels support
- Communities support
- Webhooks configuration
- Media conversion
- Bulk operations
- Advanced search

## Technical Requirements

### MCP Server Specs
- **Language:** TypeScript (Node.js)
- **MCP SDK:** @modelcontextprotocol/sdk
- **Transport:** stdio (for use with Claude Desktop, Cline, etc.)
- **Configuration:** Should be easy to add to MCP client configs

### Code Quality
- Clean, readable TypeScript code
- Proper error handling (try/catch, meaningful error messages)
- Type safety (use TypeScript types, avoid `any`)
- JSDoc comments for all tools
- Input validation for all parameters

### Project Structure
```
waha-mcp/
├── src/
│   ├── index.ts           # Main entry point
│   ├── types.ts           # TypeScript types
│   ├── client.ts          # WAHA API client wrapper
│   └── tools/
│       ├── sessions.ts    # Session management tools
│       ├── auth.ts        # Authentication tools
│       ├── messages.ts    # Messaging tools
│       ├── chats.ts       # Chat management tools
│       ├── contacts.ts    # Contact management tools
│       ├── groups.ts      # Group management tools
│       ├── presence.ts    # Presence & status tools
│       └── labels.ts      # Labels & categories tools
├── package.json
├── tsconfig.json
├── README.md             # Setup & usage guide
└── docs/                 # WAHA documentation (already provided)
```

### Configuration
The MCP server should read WAHA connection details from environment variables:
- `WAHA_URL` (default: http://localhost:3001)
- `WAHA_API_KEY` (required)

### Tool Design Principles
1. **One tool = one action** (don't create mega-tools)
2. **Clear, descriptive names** (e.g., `waha_send_text`, `waha_create_session`)
3. **Required vs optional params** - mark clearly
4. **Default session** - allow `session` param to default to "default"
5. **Pagination support** - for list operations (limit, offset)
6. **Rich responses** - return full objects, not just success/fail

### Error Handling
- Catch HTTP errors and return user-friendly messages
- Validate inputs before making API calls
- Handle WAHA-specific errors (session not found, not authenticated, etc.)

## Documentation Available

Check `./docs/` folder for:
- `waha/01-overview.md` - WAHA intro & concepts
- `waha/02-sessions.md` - Sessions API
- `waha/03-messages.md` - Messaging API
- `waha/04-groups.md` - Groups API
- `waha/05-engines.md` - Engines comparison
- `waha/06-security.md` - Security best practices
- `waha/README.md` - Full docs index
- `waha-setup.md` - WAHA setup guide with examples

## API Examples

### Base URL & Auth
```typescript
const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3001';
const API_KEY = process.env.WAHA_API_KEY;

// All requests need header:
headers: {
  'X-Api-Key': API_KEY,
  'Content-Type': 'application/json'
}
```

### Session Management
```bash
# Create session
POST /api/sessions
{"name": "default", "config": {...}}

# Start session
POST /api/sessions/{name}/start

# Get session info
GET /api/sessions/{name}

# List sessions
GET /api/sessions
```

### Authentication
```bash
# Request pairing code
POST /api/{session}/auth/request-code
{"phoneNumber": "1234567890"}

# Get QR code
GET /api/{session}/auth/qr          # PNG image
GET /api/{session}/auth/qr?format=raw  # Raw string
```

### Messaging
```bash
# Send text
POST /api/sendText
{"session": "default", "chatId": "1234567890@c.us", "text": "Hello!"}

# Send image
POST /api/sendImage
{"session": "default", "chatId": "...", "file": {...}, "caption": "Photo"}

# Get messages
GET /api/{session}/chats/{chatId}/messages?limit=100
```

### Groups
```bash
# Create group
POST /api/{session}/groups
{"name": "My Group", "participants": ["1234567890@c.us"]}

# Get group info
GET /api/{session}/groups/{groupId}

# Add participant
POST /api/{session}/groups/{groupId}/participants
{"participants": ["1234567890@c.us"]}
```

## Testing Plan

After building:
1. Test session creation & start
2. Test pairing code request (don't actually pair - just check response)
3. Test sending a text message to yourself
4. Test getting messages
5. Test group creation
6. Test error handling (invalid session, missing params, etc.)

## Deliverables

1. ✅ Working MCP server (TypeScript + Node.js)
2. ✅ All Priority 1 tools implemented
3. ✅ README with setup instructions
4. ✅ Example MCP client config (for Claude Desktop)
5. ✅ Basic tests (at least smoke tests)

## Notes

- WAHA is already running on localhost:3001
- API Key: ee4a3cbb6f374de9a98c28df22a787b5
- Session "default" is already created and authenticated
- You can test against the live WAHA instance

## Success Criteria

The MCP server is complete when:
1. It can be added to Claude Desktop/Cline config
2. All Priority 1 tools work correctly
3. Error handling is solid (no crashes)
4. README is clear and complete
5. You can demo: create session → send message → get messages

---

**Start here:** Read all the docs in `./docs/`, understand the WAHA API structure, then build the MCP server step by step. Use the examples above as reference.

Good luck! 🚀
