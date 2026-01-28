# Claude Code Instructions - WAHA MCP

## 🤖 For AI Assistants Using This MCP Server

When working on tasks that require user input or clarification, **DO NOT** stop and wait for manual input. Instead, use the `ask_user_via_whatsapp` tool to ask questions and continue working.

---

## 🎯 Default Behavior for Questions

**ALWAYS use this workflow when you need user input:**

```typescript
// ❌ WRONG - Don't do this:
// "I need to know which API to use. Please tell me and I'll continue."

// ✅ RIGHT - Do this instead:
const chatId = "1234567890@c.us"; // User's WhatsApp number

const answer = await ask_user_via_whatsapp({
  question: "Should I use REST or GraphQL for this API?",
  chatId: chatId,
  timeoutMinutes: 30
});

// Continue working with the answer
if (answer.includes("GraphQL")) {
  // Implement GraphQL solution
} else {
  // Implement REST solution
}
```

---

## 📋 When to Use `ask_user_via_whatsapp`

Use this tool whenever you encounter:

1. **Architectural decisions** - "Should I use X or Y approach?"
2. **Missing requirements** - "What should the error message say?"
3. **Ambiguous specifications** - "Should this button be blue or green?"
4. **API keys or credentials** - "What's the API endpoint URL?"
5. **Preference questions** - "Do you want verbose logging?"
6. **ANY question that would normally block your progress**

---

## 🚀 Workflow Example

```typescript
// You're building a feature and hit a question
console.log("Building user authentication system...");

// Ask the question via WhatsApp
const authMethod = await ask_user_via_whatsapp({
  question: "Which authentication method should I implement?\n1. JWT\n2. Session-based\n3. OAuth2",
  chatId: "1234567890@c.us",
  timeoutMinutes: 15
});

// Parse and continue
if (authMethod.includes("JWT")) {
  // Implement JWT auth
  console.log("Implementing JWT authentication...");
  // ... continue working
} else if (authMethod.includes("Session")) {
  // Implement session-based
  console.log("Implementing session-based auth...");
  // ... continue working
}

// Keep working autonomously
console.log("Adding password hashing...");
// ...
```

---

## ⚙️ Tool Parameters

```typescript
ask_user_via_whatsapp({
  question: string,           // The question to ask
  chatId: string,             // User's WhatsApp ID (format: "1234567890@c.us")
  session?: string,           // Session name (default: "default")
  timeoutMinutes?: number,    // How long to wait (default: 60)
  pollIntervalSeconds?: number // Check interval (default: 5)
})
```

---

## 🎨 Best Practices

### ✅ DO:
- Ask clear, specific questions with numbered options when possible
- Include context in your question: "For the login page, should I..."
- Use reasonable timeouts (15-30 minutes for urgent, 60+ for non-urgent)
- Continue working after getting the answer
- Ask multiple questions in sequence if needed

### ❌ DON'T:
- Don't stop and wait for manual console input
- Don't ask open-ended questions without context
- Don't use extremely short timeouts (< 5 minutes)
- Don't ask the same question multiple times
- Don't halt progress when you can ask via WhatsApp

---

## 🔧 Configuration

The user's WhatsApp chat ID should be stored in your working directory as `.whatsapp-chat-id`:

```bash
echo "1234567890@c.us" > .whatsapp-chat-id
```

Then read it in your code:

```typescript
const chatId = fs.readFileSync('.whatsapp-chat-id', 'utf8').trim();
```

---

## 📱 User Experience

When you call `ask_user_via_whatsapp`, the user receives:

```
🤖 Question from Claude Code:

Should I use REST or GraphQL for this API?

(Waiting for your reply...)
```

They reply from their phone, and you continue working. Simple!

---

## 🎯 Example Session

```typescript
// Starting work on a new feature
console.log("Creating API endpoints for user management...");

// Hit a question - ask via WhatsApp
const response = await ask_user_via_whatsapp({
  question: "Should the user list endpoint support pagination? (yes/no)",
  chatId: "1234567890@c.us",
  timeoutMinutes: 20
});

if (response.toLowerCase().includes("yes")) {
  console.log("Adding pagination support...");
  // Implement pagination
  // Add page and limit query parameters
  // Update documentation
} else {
  console.log("Skipping pagination...");
  // Simple list implementation
}

// Continue with next task
console.log("Adding user search functionality...");
// ... keep working
```

---

## 💡 Pro Tips

1. **Batch questions:** If you have multiple questions, ask them in one message with numbered options
2. **Provide defaults:** "Should X be Y or Z? (default: Y if no answer in 10 minutes)"
3. **Context matters:** Always explain WHY you're asking
4. **Keep working:** Don't let questions block unrelated tasks
5. **Parse flexibly:** Accept variations like "yes", "y", "Yes", "YES", etc.

---

## 🚨 Important Notes

- This tool is **blocking** - execution waits for the reply
- Default timeout is 60 minutes (configurable)
- Works even when the user is not at their computer
- The user gets a mobile notification and can reply from anywhere
- If timeout is reached, you'll get an error - handle it gracefully

---

**Remember:** The goal is to maintain momentum. When you hit a question, use WhatsApp to ask it and keep working on other parts while waiting, or wait for the answer and continue immediately when received.

This is what makes AI-powered development truly autonomous! 🚀
