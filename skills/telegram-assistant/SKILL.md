---
name: telegram-assistant
description: Operate the owner's personal Telegram account through the tg_* MCP tools — triage unread chats, read conversations with voice notes transcribed, send and reply, react, edit, search across the whole account, and handle media. Use this skill whenever the user mentions Telegram, asks to read or answer Telegram messages, asks "what did X write on Telegram", wants to send a Telegram message or file, or asks to check, summarize, or monitor Telegram chats — even if they never say the word "Telegram" but tg_* tools are available.
version: 1.0.0
metadata:
  hermes:
    tags: [telegram, messaging, mtproto, assistant]
    category: messaging
---

# Telegram Assistant (hermes_mcps)

You control the owner's **personal Telegram account** via the `telegram` MCP
server (MTProto user session, not a bot). Everything you send appears as if
the owner sent it — sound human and be careful with anything outgoing.
Telegram is far more automation-tolerant than WhatsApp (no ban paranoia), but
rate limits exist: if a tool answers `Telegram rate limit: wait Ns`, do other
work and retry after that time — never hammer.

## Identifiers — different from WhatsApp

- **Chats**: numeric ids (channels/supergroups use a `-100…` form), or
  `@username`, or `+phone` (contacts only), or `me` = the owner's Saved
  Messages. Always prefer the exact id/username that `tg_list_chats` /
  `tg_find_chat` returned.
- **Messages**: ids are **per-chat integers**, shown as `#123` in
  `tg_get_chat_context`. A message id from one chat means nothing in another.

## Tool selection at a glance

| Intent | Tool | Not |
|---|---|---|
| "What's new on Telegram?" | `tg_inbox` | `tg_list_chats` + per-chat reads |
| "Read what X wrote" | `tg_find_chat` → `tg_get_chat_context` | guessing chat ids |
| Answer someone | `tg_send_text` with `replyTo` in groups/channels | bare sends in busy groups (nobody knows what you answer) |
| Quick acknowledgement | `tg_react` (👍 ❤️ …) | sending "ok" messages for everything |
| Fix a typo in something you sent | `tg_edit_message` | sending a correction message |
| "Where did we talk about X?" | `tg_search_messages` (global without `chat`) | reading whole histories |
| Look at an image someone sent | `tg_get_media` with the id from context | guessing from the caption |
| Transcribe one voice note | `tg_transcribe_message` | — (context transcribes automatically) |
| Send a local file | `tg_send_file` | — |

## Core loop: read → answer → act

1. **Triage**: `tg_inbox` shows unread chats with recent messages. Muted chats
   are excluded by default — that's usually what the owner wants.
2. **Resolve names**: `tg_find_chat` maps "X" to an id/username (recent chats
   + address-book contacts, ranked). Never ask the owner for an id a name
   lookup can find.
3. **Read**: `tg_get_chat_context` renders the conversation — sender names,
   `#id` markers, `↳#id` reply links, voice notes transcribed inline (when
   `SONIOX_API_KEY` is configured), media summarized with retrievable ids.
   Small `limit` (15–30) first; paginate back with `beforeId` only when needed.
4. **Answer**: `tg_send_text`. In groups/channels pass `replyTo` so the answer
   is anchored. Basic markdown (**bold**, `code`) renders.
5. **Act & report**: do what the message requires, then tell the owner what
   was done on their behalf.

## Safety rules

- **Confirmation gate**: drafting is autonomous; *sending* to anyone other
  than the owner (`me`) requires that the owner asked for this send or
  pre-approved this kind of reply for this chat. Unsure → show the draft
  first. The account speaks in the owner's name.
- **Privacy**: never quote or forward content from one chat into another
  without explicit permission.
- **Pace**: one message per chat per turn unless asked otherwise; no mass
  sends. On `FLOOD_WAIT` errors, wait the stated seconds.
- **Destructive tools**: `tg_delete_message` with `revoke=true` deletes for
  *everyone* — only on explicit instruction. Never delete messages the owner
  didn't ask you to touch.
- **Session hygiene**: the MTProto session (`TELEGRAM_SESSION`) is a
  full-account credential. Never print it, never write it anywhere outside
  the configured environment. If tools answer "session is no longer valid",
  tell the owner to run `npm run telegram:login:qr` — do not improvise
  re-authentication.

## Media & voice

- Voice notes are transcribed automatically inside `tg_get_chat_context`.
  If transcription is unavailable (no `SONIOX_API_KEY`), say so plainly —
  never infer what a voice note "probably" says.
- Images appear in context as `[photo: …]`. To actually see one, call
  `tg_get_media` with the message id — small images return inline for vision,
  larger files are saved to a temp path.
- Video notes (round videos) are treated like voice notes.

## Triage workflow for "handle my Telegram"

1. `tg_inbox` → pick the chats that need attention.
2. Per chat: `tg_get_chat_context` (limit ~15) → decide:
   - trivial and pre-approved → `tg_send_text` (with `replyTo` in groups);
   - just acknowledge → `tg_react`;
   - needs the owner → leave unread, collect it.
3. Send the owner ONE summary listing what needs them — not one message per
   chat. `tg_mark_read` only chats you actually handled.
