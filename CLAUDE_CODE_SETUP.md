# Claude Code Setup - Complete Guide

## 🚀 Quick Setup for Autonomous AI Development

This guide shows you how to configure Claude Code (or any MCP-compatible AI) to automatically use WhatsApp for questions instead of stopping work.

---

## 📋 Prerequisites

1. **WAHA MCP Server installed** (see main README)
2. **Your WhatsApp number** in format: `1234567890@c.us`
3. **Claude Code or Claude Desktop** installed

---

## ⚙️ Configuration

### Step 1: Add to Claude Desktop Config

**File location:**
- **Linux:** `~/.config/claude/claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Add this:**

```json
{
  "mcpServers": {
    "waha": {
      "command": "node",
      "args": ["/absolute/path/to/waha-mcp/dist/index.js"],
      "env": {
        "WAHA_API_KEY": "your-api-key-here",
        "WAHA_URL": "http://localhost:3001",
        "USER_WHATSAPP_CHAT_ID": "YOUR_PHONE@c.us"
      }
    }
  },
  "globalInstructions": "When you need user input, approval, or clarification during development, ALWAYS use the ask_user_via_whatsapp tool instead of stopping work. Send your question via WhatsApp and wait for the reply. The user will respond from their phone, and you continue working immediately. Use the USER_WHATSAPP_CHAT_ID environment variable for the chatId parameter."
}
```

**Important:**
- Replace `/absolute/path/to/waha-mcp` with your actual path
- Replace `your-api-key-here` with your WAHA API key
- Replace `YOUR_PHONE@c.us` with your WhatsApp number

---

### Step 2: Set Your WhatsApp Chat ID

The simplest way is to use the environment variable from the config above. The tool will read `USER_WHATSAPP_CHAT_ID` automatically.

**Alternative:** Create a file in your project:

```bash
echo "1234567890@c.us" > .whatsapp-chat-id
```

Then read it in your project setup.

---

### Step 3: Restart Claude Desktop/Code

After updating the config:
1. Quit Claude completely
2. Restart it
3. Open a new chat
4. Verify the MCP server is connected (check for WAHA tools)

---

## ✅ Verify Setup

Test the connection:

1. Ask Claude: "List available WAHA tools"
2. You should see `ask_user_via_whatsapp` in the list
3. Ask Claude to send you a test WhatsApp message
4. Verify you receive it on your phone

---

## 🎯 How It Works in Practice

### Without This Setup:
```
You: "Build a REST API"
Claude: "Should I use Express or Fastify? Please tell me."
[Waits... does nothing... blocked]
```

### With This Setup:
```
You: "Build a REST API"
Claude: [uses ask_user_via_whatsapp]
  → Sends WhatsApp: "Should I use Express or Fastify?"
  → You reply from phone: "Express"
  → Claude continues building with Express
[Work never stops!]
```

---

## 📱 User Experience

When Claude asks a question:

**Your Phone:**
```
🤖 Question from Claude Code:

Should I use Express or Fastify for the REST API?

(Waiting for your reply...)
```

**You reply:** "Express"

**Claude:** Continues working immediately with your answer!

---

## 🔧 Advanced Configuration

### Custom Instructions Per Project

Add a `.clauderc` file in your project:

```json
{
  "instructions": "For this project, use ask_user_via_whatsapp for any architecture decisions. Default chatId: 1234567890@c.us. Timeout: 30 minutes for urgent questions."
}
```

### Multiple Users

If multiple people work on the project:

```json
{
  "mcpServers": {
    "waha": {
      "env": {
        "TEAM_CHAT_ID": "group-id@g.us"
      }
    }
  }
}
```

Then Claude can ask questions in a team group chat!

---

## 🎨 Workflow Examples

### Example 1: Database Schema Design
```
Claude: Building user authentication...
[Asks via WhatsApp]: "Should user passwords be hashed with bcrypt or argon2?"
You: "Argon2"
Claude: Implements argon2, continues with migrations
```

### Example 2: API Design
```
Claude: Creating API endpoints...
[Asks via WhatsApp]: "REST pagination: limit/offset or cursor-based?"
You: "Cursor"
Claude: Implements cursor pagination, updates docs
```

### Example 3: Missing Config
```
Claude: Setting up payment integration...
[Asks via WhatsApp]: "What's the Stripe API key?"
You: "sk_test_abc123..."
Claude: Configures Stripe, continues integration
```

---

## 🚨 Troubleshooting

### Claude doesn't use the tool:
1. Check `globalInstructions` is in config
2. Restart Claude completely
3. Try explicitly: "Use ask_user_via_whatsapp to ask me"

### Tool not found:
1. Verify WAHA MCP server is running: `node dist/index.js`
2. Check path in config is correct
3. Look at Claude logs for MCP connection errors

### Messages not sending:
1. Verify WAHA instance is running
2. Check WAHA_API_KEY is correct
3. Test with: `mcporter call 'waha-mcp.waha_list_sessions()'`

### Timeout too short:
1. Increase `timeoutMinutes` in questions
2. Or set default in project `.clauderc`

---

## 💡 Pro Tips

1. **Start with high timeouts** (30-60 min) while testing
2. **Use numbered options** in questions for clearer parsing
3. **Batch related questions** when possible
4. **Monitor notifications** - Claude might ask while you're away
5. **Reply quickly** to keep momentum going

---

## 🎯 Result

With this setup:
- ✅ Claude never stops for questions
- ✅ You answer from anywhere (phone, tablet, etc.)
- ✅ Development continues 24/7 autonomously
- ✅ No manual console input needed
- ✅ True AI-powered autonomous development

---

**You're now ready for autonomous AI development!** 🚀

When you leave Claude working and go for coffee, it'll just WhatsApp you any questions and keep building. Welcome to the future of software development!
