# Chats app — wake-up doorbell (design notes)

Goal: let Sophie message a chat directly from the Chats app (`/chats`) and have
that chat wake up and answer, instead of waiting until she next messages it on
claude.ai.

## Findings from live tests (2026-07-31, chats-app-messaging chat)

Routine/trigger fires (`claude-code-remote` MCP + the public
`POST /v1/claude_code/routines/:id/fire` API):

- A fire **with a `text` payload always spawns a brand-new session** — it never
  re-enters the bound session.
- A fire **without `text` re-enters the session the trigger is bound to** (the
  message arrives inside the existing conversation). Verified live via MCP
  `fire_trigger`.
- Freshly spawned sessions do NOT get the `claude-code-remote` trigger tools,
  so a spawned "dispatcher" session cannot poke other chats awake — the relay
  design is dead.
- Scheduled one-shot fires (`send_later`) re-enter bound sessions reliably (long
  proven).

## Candidate designs

1. **Per-chat routine tokens.** Each chat creates a poke routine bound to its
   session; Sophie generates an API token per routine in the claude.ai routines
   UI (must be logged into THAT chat's account); server stores tokens and fires
   with an empty body on send. Friction: one manual token step per chat, tokens
   live per-account, daily routine-run caps, beta API.

2. **GitHub doorbell (this PR is the live test).** Each chat keeps a draft
   "mailbox" PR it subscribes to (`subscribe_pr_activity`); the server posts a
   doorbell comment on it when Sophie sends a message in the Chats app; the
   webhook wakes the chat in place within seconds. Friction: one GitHub token on
   the server (one-time); a long-lived draft PR per chat. Account-agnostic —
   works the same for chats on either Claude account.

This file exists so the mailbox PR has a diff; full design discussion lives in
the chats-app-messaging chat.
