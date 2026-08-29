---
name: event-driven-whatsapp-watches
description: Use when a Hermes agent must monitor a specific WhatsApp chat without polling and resume the exact session that opened the watch.
version: 1.2.0
metadata:
  hermes:
    tags: [whatsapp, waha, webhook, session, automation]
    category: messaging
---

# Event-Driven WhatsApp Watches

Use this skill when the owner delegates a bounded WhatsApp conversation and wants Hermes to wake only when a matching incoming message arrives. This replaces frequent cron polling.

## Required architecture

```text
Hermes session calls waha_watch_chat
  -> native MCP boundary injects the current Hermes origin
  -> MCP stores watch + origin in a private shared store
  -> MCP preserves existing WAHA config and adds listener webhook
incoming WhatsApp message
  -> WAHA message + message.any webhooks
  -> listener normalizes GOWS JIDs, filters/deduplicates
  -> signed Hermes webhook V2 request
  -> webhook route validates origin/session identity
  -> gateway.wake.deliver_wake resumes exact opening session
```

The watch origin includes platform, chat ID/type, thread ID, user/profile/scope, durable session ID, and session key. A webhook event must not create a separate one-shot webhook conversation.

## Tools

- `waha_send_text`: sends a normal message without opening a watch.
- `waha_send_text_and_watch`: sends a text and opens the watch in one race-safe call. Prefer this when waiting for a reply, so a fast reply cannot arrive between separate send and watch calls.
- `waha_watch_chat`: opens a watch without sending any message and captures the opening Hermes session automatically.
- `waha_list_chat_watches`: reads active/closed watches without secrets.
- `waha_update_chat_watch`: changes bounded scope or expiry.
- `waha_close_chat_watch`: explicitly closes the watch when the conversation is complete. Receiving one message never closes it automatically.

Never pass `_hermesOrigin` manually. Hermes injects it at the native MCP boundary.

Choose exactly the simplest matching mode:

1. **Send only:** `waha_send_text` or the normal humanized `waha_reply`; no watch is created.
2. **Send and await replies:** `waha_send_text_and_watch`; it creates the watch before sending and closes the new watch automatically if sending fails.
3. **Watch only:** `waha_watch_chat`; no outbound WhatsApp message is sent.
4. **Stop:** `waha_close_chat_watch` once the sender appears finished and the objective is clear.

## Creating a watch

1. Resolve the exact WhatsApp chat ID.
2. Define a bounded objective and explicit stopping condition.
3. Define only the permitted actions.
4. For groups, set exact allowed senders. For direct chats, the listener resolves GOWS `SenderAlt` from `@s.whatsapp.net` to the stable `@c.us` peer.
5. Call `waha_watch_chat`.
6. Read back the watch and WAHA session config. Require:
   - active watch contains the opening session origin;
   - WAHA remains `WORKING`;
   - every pre-existing webhook remains present;
   - listener webhook is present.

## Multi-message conversations

People commonly split one thought across several WhatsApp messages. Every wake payload therefore includes `watch_control` with the active state, the exact close tool and arguments, and an instruction to continue listening by default.

- Do not close a watch merely because one message arrived.
- If the message looks partial, ambiguous, or likely to be followed by more context, leave the watch active. No tool call is needed to continue listening.
- Each later message wakes the same opening Hermes session again.
- Close only when the sender appears finished and the objective is sufficiently clear, by calling `waha_close_chat_watch` with the supplied `watchId`.
- A closed or expired watch never wakes again.

## WAHA session-update contract

On the production WAHA GOWS build, update a session with:

```json
{
  "config": {
    "...all existing config": "preserved",
    "webhooks": ["all existing entries", "listener entry"]
  }
}
```

Do not send config fields flat. WAHA may return HTTP 200 while replacing the live config with `{}`, silently disabling every webhook. Regression-test the wrapper and preservation behavior.

## Hermes webhook route

The route must be HMAC-authenticated and include:

```yaml
wake_origin_session: true
```

The gateway validates:

- the platform is a connected native adapter;
- platform/chat/thread recompute to the stored session key;
- the stored session ID still belongs to that key;
- webhook/local/API-server origins cannot be used as arbitrary wake targets.

The listener sends `X-Webhook-Signature-V2`, `X-Webhook-Timestamp`, and stable `X-Request-ID=<watch-id>:<WAHA-message-id>`. Duplicate `message` / `message.any` deliveries must result in one agent turn.

## Runtime requirements

- MCP and listener share the same absolute `WAHA_WATCH_STORE` path.
- Do not leave literal `${WAHA_WATCH_STORE}` placeholders in the MCP subprocess environment. Hermes config interpolation must be verified from `/proc/<mcp-pid>/environ` after restart.
- The listener must be reachable from the WAHA container. If UFW defaults to deny, allow only the WAHA Docker bridge interface and listener port.
- Verify health from both host and WAHA container.
- The gateway must be fully ready, including the target platform adapter, before firing a post-restart test event.

## Live verification

A complete test requires a genuinely new incoming WhatsApp message:

1. Create a fresh watch from the intended Telegram/Discord/etc. session.
2. Verify watch origin and all live WAHA webhooks.
3. Ask the contact to send a new message.
4. Require listener log `wake_outcome` with `status=202` and response mode `origin_session`.
5. Confirm the report appears in the opening session and no new webhook session was created.
6. Confirm the second WAHA event is `duplicate`.
7. Send a second distinct incoming message and confirm the same active watch wakes the same opening session again.
8. Close the watch explicitly and verify a later message no longer wakes Hermes.
9. Do not send an automatic WhatsApp reply unless explicitly delegated.

## Failure diagnosis

- **No listener log and no WAHA POST:** WAHA session webhooks are absent or the event did not fire.
- **WAHA POST 200 but no wake:** inspect listener response/reason (`no_watch`, `unresolved_identity`, `from_me`).
- **`Invalid URL`:** unresolved environment placeholder reached Node's URL parser.
- **`Invalid signature`:** live gateway route secret and watch secret differ, or an unresolved placeholder became the literal secret.
- **`origin adapter not connected`:** test fired before Telegram/other adapter completed startup.
- **`origin session moved`:** user reset/resumed to a different session after opening the watch; fail closed and create a new watch.
- **MCP writes to `${WAHA_WATCH_STORE}`:** gateway was not restarted after config correction, or config contains a literal placeholder. Fix config, restart fully, and inspect the live process environment.

## Completion rule

Do not call the feature working from unit tests, a manually injected payload, or a generic webhook `202` alone. Completion requires multiple real WAHA messages waking the same origin session, duplicate suppression, explicit closure, and proof that a post-close message does not wake.