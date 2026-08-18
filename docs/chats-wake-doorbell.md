# The wake doorbell — messaging a chat from the Chats app

Sophie's ask (July 2026): "In my Chats app right now, it's read only. I'm
wondering if there's a way I could actually ping the chats to wake up so I
could message them directly from the Chats app." This doc is the design that
shipped, and the measured findings that forced its shape. The code is
`chat-wake.js` (server), the composer in `public/chats.html` (app), and the
self-registration rule in `CLAUDE.md`.

## The findings (all measured live in the chats-app-messaging chat)

Everything below was TESTED, not reasoned out — per the house rule. Dates
matter: the trigger machinery is a research preview and can change under us.

1. **A routine fire WITHOUT text re-enters the session the routine is bound
   to** (2026-07-31, via MCP `fire_trigger` on a self-bound routine: the fire
   response named the bound session and the prompt arrived inside that
   conversation).
2. **A fire WITH a `text` payload always spawns a brand-new session**
   (2026-07-31, three separate fires — with an API token attached, without
   one, and as a control after a no-text success). Never attach text to a
   wake. The message itself rides the feed; the ping is contentless.
3. **Freshly spawned sessions do NOT get the claude-code-remote trigger
   tools** (2026-07-31, the "RELAY FAIL: no trigger tools in fired session"
   probe). So a throwaway "dispatcher" session can wake nobody — the
   switchboard must be a persistent chat.
4. **Scheduled one-shot fires re-enter bound sessions reliably** (long proven
   by every send_later self-check-in).
5. **Cross-session messaging (ListAgents / SendMessage, Claude Code
   v2.1.224, Aug 2026) reaches only sessions that are AWAKE** — "a listed
   peer is alive". It's the fast lane once something is up, never the
   doorbell for something asleep. (Sophie has seen chat→chat messages work
   live; this chat's own ListAgents showed empty with every sibling asleep.)
6. **The public Routines API can fire a routine from any server**:
   `POST https://api.anthropic.com/v1/claude_code/routines/<trig_id>/fire`
   with `Authorization: Bearer <token>`, `anthropic-beta:
   experimental-cc-routine-2026-04-01`, `anthropic-version: 2023-06-01`.
   Tokens are minted ONLY in the claude.ai routines UI (per routine, shown
   once) — which is why per-chat tokens would cost Sophie a manual step per
   chat, and the switchboard exists.
7. **Routine fires count against a per-account daily run cap**, and a wake
   burns a routine run plus two short session turns. Fine for "answer my
   question"; wrong for high-frequency pinging — hence the 90s debounce and
   the app's honest status line instead of a retry loop.

## How a wake travels

1. Sophie writes in the thread's composer → the page `POST /api/chatfeed/reply`
   (her message, exactly as the hook would file it) then
   `POST /api/chatfeed/wake {chat}`.
2. The server queues the wake (`forge-wake-queue`, one doc per chat) and
   fires the SWITCHBOARD routine for that chat's account — empty body.
3. The switchboard chat wakes inside its own conversation, reads
   `GET /wake-queue?account=<its account>`, and delivers each entry:
   - target listed in ListAgents (awake) → SendMessage: "Sophie messaged you
     in the Chats app — sweep your feed replies";
   - else → `fire_trigger` on the entry's `triggerId`, NO text;
   - the entry is itself (Sophie messaged the switchboard's own chat) → just
     handle the message directly, no self-fire;
   then `POST /wake-done {chat}` per entry.
4. The woken chat sweeps its feed replies/notes/votes (the standing rule),
   answers, and its reply auto-clears any still-pending queue entry
   (`noteReply` in chat-wake.js) — so a crashed switchboard can't strand
   "waking…" forever.

Round trip in practice: one to three minutes (fire → switchboard turn →
fire → target turn), plus however long the actual answer takes.

## The pieces

- **Chats register themselves** (no Sophie steps, no tokens): once per
  session, a chat creates a no-schedule self-bound trigger with its own MCP
  tools and `POST /wake-register {chat, session, triggerId, account}`. The
  registration lands session-first like every other post. Fields written on
  the registry doc: `wakeTriggerId`, `wakeAccount`, `wakeAt`.
- **One switchboard per Claude account**, each a persistent chat with a
  self-bound routine + an API token Sophie minted once:
  - Account 2: the chats-app-messaging chat, trigger
    `trig_01JWxYFQzEJVRxToP6EdDbmR` (committed default in chat-wake.js),
    token minted 2026-07-31 → Render env `WAKE_FIRE_TOKEN_2`.
  - Account 1: not built yet. Any account-1 chat can become it: create the
    self-bound trigger, Sophie adds an API trigger + token in that account's
    routines UI, set `WAKE_TRIGGER_1` + `WAKE_FIRE_TOKEN_1`.
- **Env/config** (config-loader MANAGED_KEYS; Render env wins): trigger ids
  `WAKE_TRIGGER_1/2` (not credentials), tokens `WAKE_FIRE_TOKEN_1/2`
  (credentials — Render env or the Firestore config doc, never the repo).
- **Routes** (all on `/api/chatfeed`, same gate as the rest):
  `POST /wake-register`, `GET /wake-registry?account=` (public to chats — the
  morning fan-out chat reads it to wake siblings itself), `POST /wake`,
  `GET /wake-queue?account=`, `POST /wake-done`.
- **The composer** (thread view, Chat tab): textarea + Send. Send = reply
  then wake, and the status line says honestly what happened — "waking them
  up…", "a wake is already on its way", "isn't wakeable yet", "waking isn't
  set up for this account yet". The message is safe in the feed in every one
  of those cases.

## Chat→chat fan-out (the morning-ideas use case)

Sophie's planned flow: one chat reads her morning ideas and sends tasks off
to the right chats. That chat doesn't need the server hop at all for
same-account siblings: post the task as a feed reply addressed to the target
chat, look the target up in `GET /wake-registry`, and `fire_trigger` its
`triggerId` directly (NO text) with its own MCP tools. Cross-account targets
go through `POST /wake` like the app does. Awake targets can take a direct
SendMessage instead.

## Failure honesty

- No registered trigger → `not-wakeable`, nothing queued (nothing could ever
  drain it), the chat reads the message whenever it's next up. Same as the
  app's whole pre-doorbell behavior.
- No token configured for the account → `no-switchboard`, same soft landing.
- Fire fails (API down, token revoked, cap hit) → entry stays `queued`; the
  next send or any switchboard wake drains it. The reply itself never
  depends on the wake.
- The `/fire` endpoint is a research preview behind a dated beta header —
  if wakes stop landing, check the header version first, then whether the
  routine still exists and its token wasn't revoked
  (`list_triggers` from the switchboard chat; the routine also shows at
  claude.ai/code/routines on that account).
- The account-2 switchboard routine carries a placeholder one-shot
  `run_once_at` of 2027-06-01 (it had to look "active" for the routines UI
  to show it so Sophie could mint the token — a no-schedule routine was
  invisible there, measured 2026-07-31). **When that fires (June 2027) the
  routine self-disables**: the switchboard chat must re-arm it
  (`update_trigger` with a new far-future `run_once_at` + `enabled:true`) or
  account-2 wakes die. The CLAUDE.md switchboard section carries this too.

## Tests

- `node scripts/test-chat-wake.js` — the decision table, pure.
- `node scripts/test-chats-composer.js` — the real page headless: composer
  exists, reply-then-wake order, optimistic paint, honest status lines,
  tappability.
