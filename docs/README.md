# WAHA MCP Documentation

Welcome to the comprehensive documentation for WAHA MCP Server!

> **Start here:** [**WAHA Server Setup**](./waha-server-setup.md) — WAHA Plus +
> GOWS engine, full-history sync, and anti-ban config. The single most important
> page; everything else assumes the server is set up correctly.
>
> Then wire up your agent: [AGENT_SETUP.md](../AGENT_SETUP.md) (Claude Code /
> generic MCP) or [HERMES_SETUP.md](../HERMES_SETUP.md) (hermes-agent).

## 📚 Table of Contents

### Getting Started
- [Installation & Setup](./01-installation.md)
- [Configuration Guide](./02-configuration.md)
- [Quick Start Examples](./03-quickstart.md)

### Core Concepts
- [Understanding Sessions](./04-sessions.md)
- [Chat ID Formats](./05-chat-ids.md)
- [Authentication Flow](./06-authentication.md)

### Features
- [Messaging](./07-messaging.md)
- [Media Handling](./08-media.md)
- [Group Management](./09-groups.md)
- [Contact Management](./10-contacts.md)
- [Presence & Typing](./11-presence.md)
- [Labels & Organization](./12-labels.md)

### Advanced Usage
- [Error Handling](./13-errors.md)
- [Best Practices](./14-best-practices.md)
- [Troubleshooting](./15-troubleshooting.md)

### Reference
- [Complete Tools List](./16-tools-reference.md)
- [API Parameters](./17-api-parameters.md)
- [Examples Collection](./18-examples.md)

---

## 🎯 Quick Links

### Common Tasks

- **Send a message** → [Messaging Guide](./07-messaging.md#sending-text)
- **Upload media** → [Media Handling](./08-media.md)
- **Create a group** → [Group Management](./09-groups.md#creating-groups)
- **Authenticate a session** → [Authentication Flow](./06-authentication.md)
- **Fix connection issues** → [Troubleshooting](./15-troubleshooting.md)

### For Developers

- [Architecture Overview](./19-architecture.md)
- [Building from Source](./20-development.md)
- [Contributing Guide](../CONTRIBUTING.md)

---

## 💡 Need Help?

- 🐛 Found a bug? [Report it here](https://github.com/dudu1111685/waha-mcp/issues)
- 💬 Have questions? [Start a discussion](https://github.com/dudu1111685/waha-mcp/discussions)
- 📧 Email: [support@example.com](mailto:support@example.com)

---

## 🚀 Quick Example

Send your first message:

```bash
# List your sessions
mcporter call 'waha-mcp.waha_list_sessions()'

# Send a message
mcporter call 'waha-mcp.waha_send_text(
  chatId: "1234567890@c.us",
  text: "Hello from WAHA MCP!"
)'
```

See [Quick Start](./03-quickstart.md) for more examples.
