# Agent Setup — Connecting AI Agents to waha-mcp

waha-mcp is a standard MCP server (stdio). Any MCP-compatible agent can use it:
**hermes-agent**, **Claude Code / Claude Desktop**, Cline, or anything else that
speaks MCP.

> First set up the WAHA server it talks to — **WAHA Plus on the GOWS engine**:
> see **[docs/waha-server-setup.md](./docs/waha-server-setup.md)**. That choice
> (Plus for media, GOWS for stability) is what makes transcription work and
> keeps the linked device from being unlinked.

## Choose your agent

| Agent | Guide |
|-------|-------|
| **hermes-agent** (recommended for a 24/7 WhatsApp assistant) | [HERMES_SETUP.md](./HERMES_SETUP.md) |
| **Claude Code / Claude Desktop** | below |
| Other MCP clients | below ("Generic MCP") |

In all cases, also give your agent the behavioral playbook: the
[`whatsapp-assistant` skill](./skills/whatsapp-assistant/SKILL.md) (standard
agentskills.io format — works as a Hermes skill, a Claude Code skill, or pasted
into any agent's standing instructions).

---

## Claude Code / Claude Desktop

**Config file:**
- Linux: `~/.config/claude/claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Claude Code: `.mcp.json` in the project, or `claude mcp add`

```json
{
  "mcpServers": {
    "waha": {
      "command": "node",
      "args": ["/absolute/path/to/waha-mcp/dist/index.js"],
      "env": {
        "WAHA_API_KEY": "your-api-key-here",
        "WAHA_URL": "http://localhost:3001",
        "SONIOX_API_KEY": "your-soniox-key",
        "USER_WHATSAPP_CHAT_ID": "1234567890@c.us"
      }
    }
  }
}
```

Restart the client after editing, then verify: ask for the WAHA tool list and
send yourself a test message.

## Generic MCP

Launch command: `node /path/to/waha-mcp/dist/index.js` over stdio.
Required env: `WAHA_API_KEY`. Optional: `WAHA_URL` (default
`http://localhost:3001`), `SONIOX_API_KEY` (voice transcription),
`WAHA_TIMEOUT_MS`, `WAHA_MCP_FILES_DIR` (sandbox for local-file reads),
`USER_WHATSAPP_CHAT_ID` (owner's chat for agent-initiated questions).

---

## Asking the user questions mid-task (any agent)

The killer feature for autonomous work: instead of stopping when input is
needed, the agent asks via WhatsApp and keeps working.

**Non-blocking two-tool pattern:**

```typescript
// 1. Ask — returns IMMEDIATELY
const ask = await waha_ask_user({
  question: "Should I use REST or GraphQL for this API?",
  chatId: "1234567890@c.us"          // = USER_WHATSAPP_CHAT_ID
});
// → { questionMessageId, sinceTimestamp, chatId, session }

// 2. Keep working on independent tasks, then poll every ~30-60s
const replies = await waha_check_replies({
  chatId: ask.chatId,
  session: ask.session,
  sinceTimestamp: ask.sinceTimestamp,
  questionMessageId: ask.questionMessageId
});
// "No reply yet — check again later." is a NORMAL result — poll again later.

// 3. Continue with the answer
```

**Rules of thumb:**
- Poll every 30–60 seconds between other work — never a tight loop.
- In group chats also pass `fromUser` so other participants aren't matched.
- Ask specific questions with numbered options; state a default
  ("default: Y if no answer in 10 minutes") and proceed with it gracefully
  when no reply arrives.
- The user replies from their phone; quoting the question helps matching.

**Standing instruction for your agent** (CLAUDE.md / AGENTS.md / global config):

> When you need user input, approval, or clarification during work, ALWAYS use
> waha_ask_user instead of stopping. Keep working on independent tasks and poll
> waha_check_replies (with the exact sinceTimestamp + questionMessageId it
> returned) every 30-60 seconds. "No reply yet" is normal — poll again. Use
> USER_WHATSAPP_CHAT_ID as the chatId.

## Troubleshooting

- **Agent doesn't use the tools** → standing instruction missing; restart the
  client after config changes; try explicitly "use waha_ask_user to ask me".
- **Tool not found** → check the `dist/index.js` path and that `npm run build`
  ran; check client logs for MCP connection errors.
- **Messages not sending** → WAHA instance down or wrong `WAHA_API_KEY`; test
  with `waha_check_auth_status` (expect `WORKING`).
- **Replies not found** → pass the exact `sinceTimestamp` and
  `questionMessageId` from `waha_ask_user`; in groups add `fromUser`.
