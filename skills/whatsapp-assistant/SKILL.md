---
name: whatsapp-assistant
description: Operate the owner's personal WhatsApp account through the waha_* MCP tools — triage the inbox, read conversations with voice notes transcribed, reply like a human, send messages and media, and act on what people wrote. Use this skill whenever the user mentions WhatsApp, asks to read or answer messages from a person or group, asks "what did X write/say", wants to send someone a message or file, mentions voice notes, or asks to check, summarize, or monitor chats — even if they never say the word "WhatsApp" but waha tools are available.
version: 1.2.0
metadata:
  hermes:
    tags: [whatsapp, messaging, waha, assistant]
    category: messaging
---

# WhatsApp Assistant (waha-mcp)

You control the owner's **personal WhatsApp account** via the `waha` MCP server.
Everything you send appears as if the owner sent it, and WhatsApp aggressively
bans accounts that behave like bots. Both facts shape every rule below: sound
human, be careful, never spam.

The server runs on WAHA's **GOWS** engine. A handful of tools return a clean
`501 not implemented` there — **don't call them, they will fail**:
`waha_star_message`, `waha_pin_message`, `waha_get_contact_about`,
`waha_delete_chat`, `waha_clear_chat`. When asked to pin/star a message, go
straight to the working substitute — a 📌/⭐ `waha_react_to_message`, or flag
the chat with `waha_mark_unread` / a label — and tell the owner you did that
instead. Everything in the core loop below works, including voice-note
transcription (verified end-to-end on real Hebrew speech).

## Tool selection at a glance

| Intent | Tool | Not |
|---|---|---|
| "What's waiting / anything new?" | `waha_inbox` | `waha_list_chats` + per-chat reads |
| "Read what X wrote" | `waha_find_chat` → `waha_get_chat_context` | `waha_get_messages` (raw, no names, no transcripts) |
| Answer a person | `waha_reply` | `waha_send_text` (skips seen/typing — looks robotic) |
| Look at an image someone sent | `waha_get_media` with the id from context | guessing from the caption |
| Transcribe one voice note | `waha_transcribe_message` | — (context transcribes automatically) |
| Ask someone a question and await answer | `waha_ask_user` then `waha_check_replies` | blocking/waiting inside one step |
| First-ever message to a raw phone number | `waha_check_number_exists` first | sending blind (ban signal) |
| Flag a chat for the owner | `waha_mark_unread` / `waha_set_chat_labels` | leaving it untracked |

Session is `default` unless told otherwise. The owner's own chat ID comes from
the `USER_WHATSAPP_CHAT_ID` env var of the MCP server, or ask once and remember.

## Core loop: read → answer → act

1. **Triage**: `waha_inbox` shows chats by recent activity with unread counts
   and previews. Start here, not with contact dumps or full history reads.
2. **Resolve names**: people say "X", tools need `123@c.us` / `123@g.us`.
   `waha_find_chat` maps names to chat IDs (contacts + groups, ranked). Never
   ask the user for a chat ID if a name lookup can find it.
3. **Read**: `waha_get_chat_context` returns the conversation rendered for
   reading — sender names resolved, voice notes transcribed inline (when
   `SONIOX_API_KEY` is configured), media summarized with retrievable IDs.
   Use a small `limit` (15–30); raise it only when the task truly needs deep
   history.
4. **Answer**: `waha_reply` performs the human sequence (mark seen → typing →
   proportional pause → send). In groups always pass `replyToMessageId` —
   without it nobody knows who you're answering.
5. **Act & report**: do what the message requires, then tell the owner what
   was done on their behalf.

## Safety rules (each exists because of a real failure mode)

- **Confirmation gate**: drafting a reply is autonomous; *sending* to anyone
  other than the owner requires that the owner asked for this send or
  pre-approved this kind of reply for this chat. Unsure → show the draft
  first. (The account speaks in the owner's name; a wrong message damages
  their relationships, not yours.)
- **Unknown numbers**: verify with `waha_check_number_exists` before a
  first-time send. Messages to unregistered numbers are a known ban trigger.
- **Privacy**: never quote or forward content from one chat into another
  without explicit permission — conversation content is the owner's private
  data, and leaks are irreversible.
- **Pace**: one message per chat per turn unless asked otherwise; no mass
  sends. Bursts of messages are the clearest bot fingerprint there is.
  The MCP server enforces a throttle (3-8s jitter between sends, ≤8/min,
  group mutations ≥2min apart) — when a tool answers "Rate limit: wait Ns",
  do other work and retry later; never hammer.
- **Group operations are the riskiest calls**: WhatsApp tolerates roughly 2
  group mutations per 10 minutes. Never chain create+picture+invite+settings
  in one burst — that exact pattern gets the linked device removed.
- **Session hygiene**: never logout/delete/restart the WhatsApp session on
  your own initiative — repeated re-linking (more than ~once in 48h) raises
  WhatsApp's suspicion score and can block device linking entirely.
- **Destructive tools** (`waha_delete_*`, `waha_clear_chat`,
  `waha_leave_group`, `waha_logout_session`): only on explicit instruction,
  never as cleanup initiative.

## Media

- Voice notes are transcribed automatically inside `waha_get_chat_context`.
  If transcription is unavailable (no `SONIOX_API_KEY`), say so plainly —
  never infer what a voice note "probably" says.
- Images appear in context as `[image: …] (id=…)`. To actually see one, call
  `waha_get_media` with that id — it returns the image inline for vision.
- Group senders may appear as `…@lid` (WhatsApp hides some numbers). The
  context tool resolves what it can; present unresolved ones as "unknown
  participant", not as a phone number.

## Asking questions without blocking

`waha_ask_user` sends and returns immediately with `questionMessageId` +
`sinceTimestamp`. Poll `waha_check_replies` with those exact values every
~30–60s between other work. "No reply yet — check again later." is a normal
result. In groups add `fromUser` so other participants aren't mistaken for the
answer. No reply after a reasonable time → choose a sensible default, say so
in a follow-up message, and continue.

If the owner is already talking to you on a live channel (e.g. a gateway
chat), ask there directly — the tool pair is for reaching people *outside*
the current conversation.

## Triage workflow for "handle my inbox"

1. `waha_inbox` → pick the chats that need attention.
2. Per chat: `waha_get_chat_context` (limit ~15) → decide:
   - trivial and pre-approved → `waha_reply`;
   - needs the owner → `waha_mark_unread` (and/or a label), collect it.
3. Send the owner ONE summary message listing what needs them — not one
   message per chat.
4. Flagged chats are retrievable later via `waha_get_chats_by_label`.
