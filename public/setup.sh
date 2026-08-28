#!/bin/bash
# Deck Factory Chats auto-filer — the cloud environment's Setup script fetches
# this from /setup.sh (curl | bash). Claude Code loads project settings from the
# folder the session STARTS in, so this writes /home/user/.claude/settings.json
# for sessions that start at /home/user (the folder holding the repos).
# **IT IS NOT THE WHOLE STORY, and the sentence that used to sit here — "a
# repo-committed hook never loads (verified live 2026-07-15)" — was a
# measurement of ONE layout that later stopped being the only one.** Web
# sessions on a single repo start INSIDE it (/home/user/<repo>), one level down,
# where this file is not the project settings file and registers nothing: found
# live 2026-08-14, memory-library-react had NEVER posted a single turn, and the
# quoted sentence is why nobody looked there for a year. So each repo ALSO
# commits its own `.claude/settings.json` registering the same hook — imageforge
# since #1069, memory-library-react since #316 — and belt-and-braces is correct
# here, because double registration is harmless (the server upserts on
# sha1(session|turn), so two firings land on one message). A repo whose sessions
# start inside it and which commits no settings file posts nothing at all, and
# that failure is SILENT. This writes the hook to
# /home/user/.claude/ before Claude Code launches; the environment snapshot
# carries it into every future session. v3: also files image deliverables
# into the iOS gallery via POST /api/gallery. v4: tags each post with the
# environment's FORGE_ACCOUNT so Open buttons route app-vs-browser. v5: resolves
# the slug per SESSION via /api/chatfeed/resolve so a reused branch name can
# never file two sessions into one chat. v6: every post carries the session
# id, so the SERVER routes it session-first — a chat keeps one identity for
# the whole session even if the slug cache here goes stale or a thread is
# re-bound/merged later. v7: LIVE DRAFTS — also registered on PostToolUse, so
# the prose a chat writes before/between tool calls reaches the Chats app
# while the turn is still running ("still writing…"), and the finished reply
# finalizes the same message. v9: symlinks the imageforge repo's
# .claude/skills into /home/user/.claude/skills, so the repo's skills load in
# EVERY session from the first turn — a subrepo's skills are otherwise only
# discovered once a chat is already working in that repo (the same
# starting-folder gotcha as the hook itself). v10: a turn goes into the
# posted-ledger only AFTER the server confirms the post — the sandbox egress
# filter answers some payloads with a 403 block page and curl exit 0, and the
# old record-first order stranded a full reply as its partial draft.
# Source of truth for the hook body: imageforge/.claude/hooks/post-to-feed.sh
# (this file is REBUILT from it by scripts in that repo — don't hand-edit the
# hook body here).

mkdir -p /home/user/.claude/hooks

cat > /home/user/.claude/hooks/post-to-feed.sh << 'HOOK'
#!/bin/bash
# Auto-post this chat's finished reply to the DeckFactory Chats feed, and file
# its image deliverables into the iOS "My Creations" gallery — zero model
# tokens, nothing to remember. Runs as a Stop hook after every reply.
#
# v18 (2026-08-27) — …AND IT NO LONGER LANDS TWICE. The harness JOINS messages
# she sent back to back into ONE user record, separated by a blank line
# (measured in this fix's own transcript: the queue record held her first
# message, the user record held the first AND the second joined). The queue
# reconciliation matched on WHOLE text only, so the queue entry found no home,
# posted as a message of its own, and her first message landed twice — once
# alone and once inside the joined record. 12 such pairs across her 3,768
# messages the day it was found. A queue entry is matched against a record's
# SEGMENTS as a fallback now, and one record can absorb several of them.
# Whole-text still wins first, so nothing about the old matching moved.
# Test: scripts/test-chats-first-message.js.
#
# v16 (2026-08-26) — TWO MESSAGES IN A ROW: THE FIRST NO LONGER VANISHES.
# Sophie: "my first message is missing from this chat. I sent two messages in a
# row." Her half baselined `users[:-1]` on a session's first firing, which is
# harmless when that firing is the first UserPromptSubmit (one message, nothing
# dropped) and destructive when two of her messages already exist — she sends a
# second one into the queue while the first turn runs, the Stop at the end of
# that turn is the first firing, and her REAL request is marked posted without
# ever being sent. The transcript is the only copy. The reply half has always
# baselined all but the latest TURN; her half does the same now. See the note
# on `first_u` below. Test: scripts/test-chats-first-message.js.
#
# v15 (2026-08-24) — A BACKFILLED REPLY KEEPS ITS REAL TIME. Every post now
# carries `created`, the turn's own first-assistant-record timestamp. Her
# messages have carried `at` since July 2026 and the server has accepted
# `created` on replies for just as long — its own comment names this exact
# case ("every backfilled reply would pile up at the top") — but the hook
# never sent it, so a chat recovered with backfill-chat-history.sh came back
# with her half in the right order and Claude's half stacked at the moment of
# the backfill. Found in the 2026-08-24 audit of "want me to fix that?" offers
# nobody ever answered; the offer was made 2026-08-15 and left.
# Live turns are unchanged: the server keeps a doc's FIRST `created`, which a
# draft has already stamped.
#
# v14 (Aug 2026) — A TURN STARTED BY A BACKGROUND EVENT IS STILL A TURN.
# Sophie, across several chats in one week: "your last message didn't show up
# in my chat app." The pattern was exact — every turn that answered HER posted,
# and every turn that answered a wake event / task notification did not.
# v13 had filtered machinery out of the TURN BOUNDARY as well as out of "is
# this Sophie talking", so a reply to a background event stayed keyed to the
# PREVIOUS turn; the server's doc id is sha1(session|turn), so it upserted onto
# that already-finished message, inherited its `created`, never rose in the
# thread, and read as missing. The live-draft pass was worse: it re-marked that
# finished reply `working:true`, which is why those chats also sat parked in
# the hidden pile waiting for a reply she had already been given.
# The two questions are SEPARATE and must stay that way:
#   boundary  = ANY non-tool-result user record (machinery included)
#   her words = only what Sophie really said (`her_words`) — machinery is a
#               boundary but NEVER a message, which is what v13 got right and
#               is preserved here.
# See turnkey_of() in both parsers; pinned by scripts/test-chats-turn-boundary.js.
#
# v13 (Aug 2026) — THE END-OF-TURN CARD REMINDER. On UserPromptSubmit the hook
# also prints ONE line of additionalContext, so every turn starts with the
# reminder to refresh the chat's STATUS CARD and UPDATE card before it ends.
# Measured 2026-08-13: only 15 of 224 chats had ever POSTed an Update card, so
# Sophie's Update tab almost always showed the TLDR fallback — the rule was
# written down and forgotten, which is what machinery is for. Two boundaries
# this deliberately keeps: the text is a FIXED string baked into this file
# (never fetched from the server — the hook must never relay or execute
# server-supplied instructions, see the v11 note), and it is the ONLY thing
# this script ever writes to stdout, on the ONE event whose contract reads it.
#
# v12 (Aug 2026) — THE WORKING FOLD'S BOUNDARIES. Each finished turn also
# posts `head`/`tail`: character offsets marking where its FIRST and LAST tool
# call fell. That is the internal signal for "when is the message done coding"
# — the Chats app shows the prose either side and folds the narration between,
# instead of guessing from wording (see foldBody in chats.html).
#
# v11 (Aug 2026) — HOOK VERSION TELEMETRY (Sophie's ask, 2026-08-10: stop
# making her hunt for stale chats). The turn-start ping now carries the md5 of
# THIS INSTALLED FILE; the server compares it to the repo copy it ships
# (setup.sh installs byte-identical — verified 2026-08-10) and marks the
# chat's registry doc stale/current, and the Chats app shows "hook out of
# date" on the row. Detection ONLY: this hook never fetches or executes
# anything, and never instructs the chat to — the heal stays a deliberate
# paste of the self-heal command into the chat. Two stronger designs (the
# hook auto-running the setup script; the hook telling the chat's model to
# run it) were built 2026-08-10 WITH Sophie's permission and refused by the
# harness classifier both times — that is a hard boundary, so don't re-walk
# it; see CLAUDE.md (the Chat app section) before touching this.
#
# v8 (Aug 2026) — TURN-START PING: UserPromptSubmit tells the feed the chat is
# working (POST /working), so the Chats app can tint it until the reply lands.
#
# v7 (Aug 2026) — LIVE DRAFTS: also registered on PostToolUse, so the prose a
# chat writes BEFORE and BETWEEN tool calls reaches the Chats app while the
# turn is still running, instead of only when it stops (a long coding turn
# used to mean silence until the very end). The draft pass posts the turn's
# text-so-far with { turn, working:true }; the server upserts ONE message per
# turn (keyed session|turn), the app shows it as "still writing…", and the
# normal Stop post finalizes the SAME message — never a duplicate. The whole
# draft pass runs in a BACKGROUND subshell (exit 0 immediately), so it adds
# zero latency to the tool call it rides on; a duplicate racing post converges
# onto the same doc server-side, so the race is harmless.
#
# NOTE: no stop_hook_active bail — another Stop hook (the git checker)
# interrupts finishes constantly during active work (exit 2 on uncommitted
# changes), and bailing on stop_hook_active silently dropped those turns'
# posts (verified live 2026-07-15). The per-message/per-item state files below
# already prevent double-posting, and this hook never blocks a stop (exit 0
# always), so it cannot loop itself.
#
# BACKFILL (2026-07): the feed de-dupe tracks a SET of already-posted turn ids
# (forge-feed-<sid>.posted), not just the last one — so if a turn is missed
# (interrupted / cold-start post failure), the NEXT firing posts every turn
# that hasn't gone out yet, oldest first. On a brand-new session the whole
# history is baselined silently (only the latest turn posts), so backfill
# never floods the feed with old messages.

input=$(cat)

FEED="${FORGE_FEED_URL:-https://imageforge-q125.onrender.com/api/chatfeed}"
GALLERY="${FORGE_GALLERY_URL:-https://imageforge-q125.onrender.com/api/gallery}"

# v13: the one line of context this hook injects, at the START of every turn
# (UserPromptSubmit). Static and versioned ON PURPOSE — a hook that fetched its
# own instructions would be the server telling every chat what to do, which is
# the boundary the v11 note describes. Keep it to ONE line: it is paid for by
# every turn in every session.
REMINDER="[chats] Before ending a turn that changed your state: refresh your status card and Update card — POST /api/chatfeed/status and /api/chatfeed/update (see CLAUDE.md 'STATUS CARDS' and 'UPDATE'). Update card: asked = what she wanted in her terms, did = what changed, next = optional; never paste your reply verbatim."

transcript=$(printf '%s' "$input" | jq -r '.transcript_path // empty')
[ -n "$transcript" ] && [ -f "$transcript" ] || exit 0
sid=$(printf '%s' "$input" | jq -r '.session_id // empty')
[ -n "$sid" ] || sid="${CLAUDE_CODE_SESSION_ID:-x}"
event=$(printf '%s' "$input" | jq -r '.hook_event_name // empty')

# Chat name: FORGE_CHAT env wins; else a slug of a repo's claude/<name> branch
# (random 6-char suffix dropped); else a short session id.
name="${FORGE_CHAT:-}"
if [ -z "$name" ]; then
  for d in /home/user/*/; do
    b=$(git -C "$d" branch --show-current 2>/dev/null)
    case "$b" in
      claude/*) name=$(printf '%s' "${b#claude/}" | sed -E 's/-[a-z0-9]{6}$//'); break;;
    esac
  done
fi
# An unnamed session's branch is claude/new-session-<random> — stripping the
# suffix collapsed EVERY unnamed session into one chat called "new-session"
# (verified live 2026-07-31: four sessions' feeds merged). The slug must stay
# unique per session, so generic names keep a stable per-session tail.
case "$name" in
  new-session|session|untitled) name="${name}-$(printf '%s' "$sid" | tr -dc 'a-z0-9' | cut -c1-6)";;
esac
[ -n "$name" ] || name="chat-$(printf '%s' "$sid" | cut -c1-8)"

rsid="${CLAUDE_CODE_REMOTE_SESSION_ID:-$sid}"; rsid="${rsid#cse_}"

claude_url=""
if [ -n "${CLAUDE_CODE_REMOTE_SESSION_ID:-}" ]; then
  claude_url="https://claude.ai/code/session_${CLAUDE_CODE_REMOTE_SESSION_ID#cse_}"
fi

post () {  # $1 = url, $2 = json body (retries once; long timeout for cold starts)
  curl -s -m 75 -X POST "$1" -H "Content-Type: application/json" \
    ${STUDIO_TOKEN:+-H "x-studio-token: $STUDIO_TOKEN"} -d "$2" >/dev/null 2>&1 \
  || curl -s -m 75 -X POST "$1" -H "Content-Type: application/json" \
    ${STUDIO_TOKEN:+-H "x-studio-token: $STUDIO_TOKEN"} -d "$2" >/dev/null 2>&1 || true
}

post_ok () {  # like post, but ECHOES the server's response so the caller can
              # tell a real {"ok":true} from a failure. curl exits 0 on an
              # HTTP error, so the exit code alone says nothing — the sandbox
              # egress filter answers 403 with an HTML block page and exit 0
              # (2026-08-10, live: a reply carrying the setup.sh one-liner).
  curl -s -m 75 -X POST "$1" -H "Content-Type: application/json" \
    ${STUDIO_TOKEN:+-H "x-studio-token: $STUDIO_TOKEN"} -d "$2" 2>/dev/null \
  || curl -s -m 75 -X POST "$1" -H "Content-Type: application/json" \
    ${STUDIO_TOKEN:+-H "x-studio-token: $STUDIO_TOKEN"} -d "$2" 2>/dev/null || true
}

# One chat per SESSION (Aug 2026): a chat's identity is the SESSION, not the
# branch-derived slug — branch names get reused and naming conventions change,
# and both merged or split threads for real (the "Imprint" collision, then its
# orphaning). The server resolves session-first: a session that already owns a
# chat posts there forever; a brand-new session keeps the pretty slug if it's
# free, else forks to <name>-<sid6>. Resolved once per session per name and
# cached — the cache is only a HINT, because every post below also carries the
# session id and the server re-resolves authoritatively (so a re-bound or
# merged chat heals even while this cache is stale). An explicit FORGE_CHAT is
# deliberate (possibly shared across sessions on purpose): it is never forked,
# and posts are tagged explicit so the server never re-keys them either.
# Sets: name, session_key, explicit. The network hit happens only on a cache
# miss, which is why the draft pass calls this INSIDE its background subshell.
resolve_name () {
  session_key=""; explicit=""
  if [ -z "${FORGE_CHAT:-}" ]; then
    session_key="$rsid"
    rstate="$HOME/.claude/forge-slug-${sid}-$(printf '%s' "$name" | cksum | cut -d' ' -f1)"
    rname=""
    if [ -f "$rstate" ]; then
      rname=$(cat "$rstate" 2>/dev/null)
    else
      rname=$(curl -s -m 20 ${STUDIO_TOKEN:+-H "x-studio-token: $STUDIO_TOKEN"} \
        "$FEED/resolve?chat=$(printf '%s' "$name" | jq -sRr @uri)&session=$(printf '%s' "$rsid" | jq -sRr @uri)" \
        | jq -r '.chat // empty' 2>/dev/null)
      [ -n "$rname" ] && printf '%s' "$rname" > "$rstate"
    fi
    # accept any sane slug — session-first resolution may legitimately return a
    # chat that shares nothing with the branch name (a re-bound thread)
    case "$rname" in
      ""|*[!a-z0-9._-]*) :;;
      *) name="$rname";;
    esac
  else
    explicit="1"
  fi
}

# ── LIVE DRAFT pass (PostToolUse) ──────────────────────────────────────────
# Post the current turn's text-so-far as a growing draft. Everything —
# resolution, transcript parse, the POST — runs detached so the tool call this
# event rides on is never delayed. State: forge-draft-<sid> holds
# "turnkey<TAB>chars-posted"; the parse exits silently unless the turn's text
# GREW past what's already out (so a burst of tool calls with no new prose
# costs no network at all).
if [ "$event" = "PostToolUse" ]; then
  (
    resolve_name
    dp=$(NAME="$name" CLAUDE_URL="$claude_url" SESSION_KEY="$session_key" EXPLICIT="$explicit" \
      DSTATE="$HOME/.claude/forge-draft-${sid}" \
      python3 - "$transcript" 2>/dev/null << 'PYDRAFT'
import json, sys, os, re
path = sys.argv[1]
# EVERY non-tool-result user record starts a new assistant turn — machinery
# (wake events, task notifications, webhook activity) included, because a wake
# really does begin a turn and that turn's reply is a message of its own.
#
# This is deliberately NOT the same question as "is this Sophie talking". Those
# two were conflated once and each half broke the feed in its own way: filtering
# machinery out of the BOUNDARY left the reply keyed to the PREVIOUS turn, so it
# upserted onto that finished message (same key → same deterministic doc id),
# kept its old `created`, never rose in the thread, and read as simply missing.
# Filtering it nowhere posted the wake envelope as one of HER messages. So the
# boundary takes everything and `her_words` (final parser) decides what is hers.
def turnkey_of(rec):
    # Stable across re-parses: the hook re-reads the whole transcript on every
    # event, so a key derived from anything volatile would fork the turn's doc.
    if rec.get('uuid'):
        return rec['uuid']
    if rec.get('timestamp'):
        return 'w:' + str(rec['timestamp'])
    return None
turnkey = None; parts = []
with open(path, encoding='utf-8') as f:
    for ln in f:
        try:
            r = json.loads(ln)
        except Exception:
            continue
        m = r.get('message') or {}
        role = m.get('role')
        c = m.get('content')
        if role == 'user':
            isres = isinstance(c, list) and any(
                isinstance(b, dict) and b.get('type') == 'tool_result' for b in c)
            if not isres:
                # same turn boundary the final parser uses, so the draft and the
                # end-of-turn post carry the SAME key and land on ONE doc. A key
                # we can't derive stably leaves turnkey None, which exits below
                # rather than letting this turn's draft overwrite the previous
                # turn's finished message and re-mark it "still writing".
                turnkey = turnkey_of(r); parts = []
            continue
        if role != 'assistant':
            continue
        if isinstance(c, str):
            t = c
        else:
            t = "".join(b.get('text', '') for b in (c or [])
                        if isinstance(b, dict) and b.get('type') == 'text')
        if t.strip():
            parts.append(t)
text = "\n\n".join(parts).strip()
# below 60 chars there's nothing worth reading early — those turns just post
# normally when they finish
if not turnkey or len(text) < 60:
    sys.exit(0)
st = os.environ.get('DSTATE', '')
prev_key = ''; prev_len = 0
try:
    a = open(st).read().split('\t')
    prev_key = a[0]; prev_len = int(a[1])
except Exception:
    pass
if prev_key == turnkey and len(text) <= prev_len:
    sys.exit(0)
out = {"chat": os.environ['NAME'], "text": text[:20000],
       "turn": turnkey, "working": True}
if os.environ.get('CLAUDE_URL'):
    out["url"] = os.environ['CLAUDE_URL']
if os.environ.get('SESSION_KEY'):
    out["session"] = os.environ['SESSION_KEY']
if os.environ.get('EXPLICIT'):
    out["explicit"] = True
if os.environ.get('FORGE_ACCOUNT', '').strip():
    out["account"] = os.environ['FORGE_ACCOUNT'].strip()[:20]
os.makedirs(os.path.dirname(st), exist_ok=True)
open(st, 'w').write(turnkey + '\t' + str(len(text)))
print(json.dumps(out))
PYDRAFT
)
    [ -n "$dp" ] && post "$FEED" "$dp"
  ) >/dev/null 2>&1 &
  exit 0
fi

# ── FINAL pass (Stop / UserPromptSubmit) ───────────────────────────────────
resolve_name

# TURN STARTED (v8, Aug 2026) — tell the feed this chat is now working, so the
# Chats app can tint it pink until the reply lands. This is a separate one-line
# ping rather than a side effect of posting her message, because HER MESSAGE IS
# NOT IN THE TRANSCRIPT YET at UserPromptSubmit: the parse below can only lift
# it at the END of the turn, and measured live her messages' postedAt lands ~1s
# before the reply's, every time. So "newest message is hers" was true for about
# one second and the tint never showed. This needs no transcript at all — just
# the chat — so it can fire the moment she sends. Backgrounded: a hook must
# never make her wait, and a lost ping only costs one tint.
if [ "$event" = "UserPromptSubmit" ]; then
  # v11: the ping also carries this installed file's md5, so the server can
  # mark the chat stale/current and the app can show it. Telemetry only —
  # nothing here fetches, executes, or instructs (see the v11 header note).
  hook_v=$(md5sum "$HOME/.claude/hooks/post-to-feed.sh" 2>/dev/null | cut -d' ' -f1)
  # v17: the ping carries FORGE_ACCOUNT too. `account` used to be stamped ONLY
  # by a finished reply, so a chat whose turn never posted one carried no tag —
  # and the app then fired its "Open in Claude" link blind into whichever
  # account it was on, dead-ending on the wrong one (Sophie, 2026-08-26: "they
  # seem to exist, but their button takes me nowhere"). The variable is already
  # in this environment; it was simply never sent. Empty when unset, and the
  # server ignores an empty one.
  ( post "$FEED/working" "$(jq -nc --arg c "$name" --arg s "$session_key" --arg v "$hook_v" --arg a "${FORGE_ACCOUNT:-}" '{chat:$c, session:$s, v:$v} + (if $a == "" then {} else {account:$a} end)')" ) >/dev/null 2>&1 &

  # v13: the card reminder, as UserPromptSubmit's additionalContext. This is
  # the ONLY write to stdout anywhere in this script — every other path pipes,
  # captures or discards — and Claude Code parses a UserPromptSubmit hook's
  # stdout as JSON, so anything else printed after this would corrupt it. If
  # jq is missing the substitution is empty and nothing is printed, which is
  # the pre-v13 behaviour: silence, never a broken half-line.
  jq -nc --arg t "$REMINDER" \
    '{hookSpecificOutput:{hookEventName:"UserPromptSubmit", additionalContext:$t}}' 2>/dev/null
fi

state="$HOME/.claude/forge-feed-${sid}.posted"
gstate="$HOME/.claude/forge-gallery-${sid}.done"
ustate="$HOME/.claude/forge-user-${sid}.posted"

# One transcript pass emits: one "F<TAB>{...}" line per feed post to make (every
# turn not yet in the posted-set — usually just the latest, more when catching
# up missed ones), then one "G<TAB>{...}" line per NEW image deliverable —
# Firebase image URLs in the final reply, plus image files the chat sent via
# SendUserFile (files sent before this hook existed are baselined on first run).
out=$(NAME="$name" CLAUDE_URL="$claude_url" STATEFILE="$state" GSTATE="$gstate" USTATE="$ustate" \
  SESSION_KEY="$session_key" EXPLICIT="$explicit" \
  python3 - "$transcript" 2>/dev/null << 'PY'
import json, sys, os, re
path = sys.argv[1]
def blocks(rec):
    m = rec.get('message') or {}
    c = m.get('content')
    return c if isinstance(c, list) else []
def gettext(rec):
    m = rec.get('message') or {}
    c = m.get('content')
    if isinstance(c, str):
        return c
    return "".join(b.get('text', '') for b in blocks(rec)
                   if isinstance(b, dict) and b.get('type') == 'text')
IMG = re.compile(r'\.(?:png|jpe?g|webp|gif)$', re.I)
FIRE = re.compile(r'''https://(?:storage|firebasestorage)\.googleapis\.com/[^\s)\]"'<>]+?\.(?:png|jpe?g|webp|gif)''', re.I)
# A reply that writes an image as [Penny — the blue Kleenex](https://…/p02.webp)
# is naming what the picture IS, so that text becomes the asset's description
# in the Chats app (also matches the alt of ![alt](url)). Bare urls, filenames
# and one-word slot codes ("p01", "p01-penny") are labels, not descriptions.
MDLINK = re.compile(r'''\[([^\]\n]{1,300})\]\(\s*(https://(?:storage|firebasestorage)\.googleapis\.com/[^\s)]+?\.(?:png|jpe?g|webp|gif))[^)]*\)''', re.I)
GENERIC = {'here', 'link', 'image', 'img', 'photo', 'picture', 'view', 'open',
           'download', 'this', 'this one', 'full size', 'full-size', 'preview'}
def gooddesc(t):
    t = (t or '').strip()
    if not t or re.match(r'^\w+://', t):          # link text that IS a url
        return ''
    if t.lower() in GENERIC:
        return ''
    if ' ' not in t and (len(t) <= 16 or IMG.search(t)):   # p01 / p01-penny / a filename
        return ''
    return t[:300]

# Split the transcript into TURNS (one assistant reply per real user turn), in
# order. Each turn = the joined text of every assistant text block in it, keyed
# by the last text message's id (stable per turn, used for the posted-set).
# Each also carries the uuid of the user record that STARTED it — the same key
# the live-draft pass posts with, so the final post lands on the draft's doc.
turns = []
cur_parts = []; cur_mid = None; cur_turnkey = None
# When this turn STARTED — the first assistant record's own timestamp. It is
# posted as `created`, which is what keeps a BACKFILLED thread in order: the
# server stamps NOW when nothing is sent, so every recovered reply used to pile
# up at the moment of the backfill while her own messages (which have always
# carried `at`) sat at their real times. The server has accepted `created`
# since July 2026 and its own comment names this exact case; only the hook
# never sent it (found in the 2026-08-24 audit of unanswered fix offers).
# The turn's START rather than its end, deliberately: `bornAt` on the server
# is documented as the turn's start so that a turn ALREADY RUNNING when she
# sent a message loses the push gate's comparison.
cur_at = None
# THE WORKING FOLD (Aug 2026, Sophie: "it's supposed to find when the message
# is done coding … unless there's some internal signal, that would be the
# best"). There is one: the turn's TOOL CALLS. cur_t0/cur_t1 count how many
# text parts had been written when the FIRST and LAST tool call of the turn
# fired, which flush() turns into character offsets (`head`/`tail`) into the
# posted text. The app shows the prose before head and after tail — the plan
# and the closing rundown — and folds the narration between them. A turn with
# no tool calls sends neither, so nothing folds.
cur_t0 = None; cur_t1 = None
sends = []; idx = 0; last_user = -1
raw_since = []  # raw records of the CURRENT (latest) turn — for wip gallery
users = []      # Sophie's OWN messages, so the feed reads as a conversation
queued = []     # …and the ones she sent MID-TURN, which arrive a different way

# What Sophie actually typed/said, as opposed to the machinery that arrives as a
# "user" record too: task notifications, webhook activity, slash-command echoes,
# the harness's "Continue from where you left off" (isMeta), interrupt markers.
# system-reminder blocks ride along inside her real messages, so they're cut out
# rather than used to reject the message.
REMINDER = re.compile(r'(?is)<system-reminder>.*?</system-reminder>')
# How the harness joins messages she sent back to back into one user record.
SPLITMSG = re.compile(r'\n\s*\n')
NOISE = re.compile(r'''(?is)^\s*(\[Request interrupted|\[SYSTEM NOTIFICATION'''
                   r'''|<task-notification|<github-webhook-activity|<command-name'''
                   r'''|<wake\s|<wake>'''
                   r'''|<local-command-stdout|Caveat: The messages below)''')
# Kept in step with the draft parser's copy — the two must agree on a turn's
# key or the draft and the final post land on two different docs.
def turnkey_of(rec):
    if rec.get('uuid'):
        return rec['uuid']
    if rec.get('timestamp'):
        return 'w:' + str(rec['timestamp'])
    return None

def her_words(rec, txt):
    if rec.get('isMeta'):
        return ''
    t = REMINDER.sub('', txt or '').strip()
    if not t or NOISE.match(t):
        return ''
    if t == 'Continue from where you left off.':
        return ''
    return t

def flush():
    global cur_parts, cur_mid, cur_t0, cur_t1, cur_at
    raw = "\n\n".join(cur_parts)
    txt = raw.strip()
    if txt and cur_mid:
        tn = {'text': txt, 'mid': cur_mid, 'turn': cur_turnkey}
        if cur_at:
            tn['at'] = cur_at
        # Offsets are measured in the STRIPPED text the post carries, so a
        # leading blank line can't shift them by two characters.
        if cur_t0 is not None:
            lead = len(raw) - len(raw.lstrip())
            def at(n):
                return max(0, len("\n\n".join(cur_parts[:n])) - lead)
            tn['head'] = at(cur_t0)
            tn['tail'] = at(cur_t1)
        turns.append(tn)
    cur_parts = []; cur_mid = None; cur_t0 = None; cur_t1 = None; cur_at = None

with open(path, encoding='utf-8') as f:
    for ln in f:
        try:
            r = json.loads(ln)
        except Exception:
            continue
        idx += 1
        # A message sent while Claude is still working is QUEUED, and a queued
        # message is only ever written as a queue-operation record — it never
        # becomes a "user" record, so everything below would miss it and it
        # would never reach the app (verified live 2026-08-07). Collect it here
        # and reconcile against the real user records after the loop.
        if r.get('type') == 'queue-operation':
            if r.get('operation') == 'enqueue' and r.get('timestamp'):
                qt = her_words(r, r.get('content') or '')
                if qt:
                    # A still-queued message has no user record yet, so it is by
                    # definition newer than every one that has one — `i` = INF
                    # keeps it out of the first-run baseline below.
                    queued.append({'uuid': 'q:' + r['timestamp'], 'text': qt,
                                   'at': r['timestamp'], 'i': float('inf')})
            continue
        role = (r.get('message') or {}).get('role')
        if role == 'user':
            if not any(isinstance(b, dict) and b.get('type') == 'tool_result' for b in blocks(r)):
                # ANY non-tool-result user record ends the previous turn — a
                # wake event or a task notification begins a real turn whose
                # reply deserves its own message. Skipping the boundary for
                # machinery is what silently merged that reply into the message
                # above it (see the note on turnkey_of in the draft parser).
                # Whether it was HER talking is a separate question, answered by
                # her_words below — machinery is a boundary but never a message.
                flush()           # end of the previous assistant turn
                cur_turnkey = turnkey_of(r)
                last_user = idx
                raw_since = []
                mine = her_words(r, gettext(r))
                if mine and r.get('uuid'):
                    # `i` = where this record sits in the transcript, kept so the
                    # first-run baseline below can ask which messages belong to
                    # the LATEST turn instead of keeping only the last one.
                    users.append({'uuid': r['uuid'], 'text': mine,
                                  'at': r.get('timestamp') or '', 'i': idx})
                continue
            raw_since.append(ln)
            continue
        if role != 'assistant':
            continue
        raw_since.append(ln)
        t = gettext(r)
        if t.strip():
            cur_parts.append(t)
            cur_mid = (r.get('message') or {}).get('id')
            if cur_at is None:
                cur_at = r.get('timestamp') or None
        for b in blocks(r):
            if isinstance(b, dict) and b.get('type') == 'tool_use':
                # text blocks of this record were appended above, so the count
                # of parts right now IS "everything said before this tool call"
                if cur_t0 is None:
                    cur_t0 = len(cur_parts)
                cur_t1 = len(cur_parts)
            if isinstance(b, dict) and b.get('type') == 'tool_use' and b.get('name') == 'SendUserFile':
                for p in ((b.get('input') or {}).get('files') or []):
                    if isinstance(p, str) and IMG.search(p):
                        sends.append((idx, p))
flush()  # the final (current) turn

# EVERY message is enqueued, but only the mid-turn ones fail to also land as a
# user record — so a queued entry counts only when no user record carries the
# same words. Matched as a multiset, so sending the same short phrase twice
# can't let the first one swallow the second.
if queued:
    def _norm(s):
        return ' '.join((s or '').split()).lower()[:160]
    # A mid-turn message exists TWICE in the transcript over its lifetime: as a
    # queue record while Claude is still working, and as an ordinary user record
    # once the turn ends. They carry DIFFERENT ids, so posting it early under
    # `q:<timestamp>` and then meeting it again as a uuid posted it a SECOND
    # time — every mid-turn message she sent landed in the thread twice (found
    # live 2026-08-08 in her own feed; the state file held the q: key while the
    # duplicate went out under the uuid). So a swallowed queue entry HANDS ITS
    # KEY to the record that replaced it, and the poster below treats either id
    # as proof it already went out. Still a multiset — one queue entry is
    # consumed per matching record — so repeating a short phrase can't let the
    # first swallow the second.
    #
    # AND THE HARNESS JOINS BACK-TO-BACK MESSAGES INTO ONE USER RECORD,
    # separated by a blank line (measured 2026-08-27 in this chat's own
    # transcript: the queue record held her first message, the user record held
    # the first AND the second joined by \n\n). Matching on the WHOLE text
    # alone therefore missed, so the queue entry was posted as a message of its
    # own AND again inside the joined record — her first message twice. Live
    # count that day: 12 such pairs across 3,768 of her messages. So a queue
    # entry is matched against a record's SEGMENTS as well as its whole text,
    # and one record can absorb several of them.
    # WHOLE TEXT FIRST, SEGMENTS ONLY AS THE FALLBACK — two passes, so the
    # matching every mid-turn message has always relied on is untouched and a
    # joined record can never out-bid the plain record that really is that
    # message.
    whole = {}
    for u in users:
        whole.setdefault(_norm(u['text']), []).append(u)
    segcells = {}   # id(record) -> [[normalised segment, taken?], …]
    for u in users:
        segs = [x for x in SPLITMSG.split(u['text']) if x.strip()]
        segcells[id(u)] = [[_norm(x), False] for x in segs] if len(segs) > 1 else []
    def _take(q):
        n = _norm(q['text'])
        for u in whole.get(n) or []:
            if not u.get('aliases'):
                return u
        for u in users:
            # `.get`, NOT `[]` — an unmatched queue entry is APPENDED to `users`
            # below, so the next _take walks a record segcells has never seen and
            # the whole parser dies with a KeyError. The hook then prints NOTHING
            # and exits 0, so the session posts no replies and none of her
            # messages, silently, forever (found live 2026-08-28: a chat with one
            # mangled message in the app and 11 turns in its transcript). An
            # appended entry has no segments to donate, so empty is the right
            # answer as well as the safe one.
            for cell in segcells.get(id(u)) or ():
                if not cell[1] and cell[0] == n:
                    cell[1] = True
                    return u
        return None
    for q in queued:
        target = _take(q)
        if target is not None:
            target.setdefault('aliases', []).append(q['uuid'])
            continue
        users.append(q)
    users.sort(key=lambda u: u.get('at') or '')

# ── Sophie's own messages ──────────────────────────────────────────────────
# Posted to /reply as from:"sophie" so a thread in the Chats app reads as the
# conversation it was, not a monologue. Keyed by the transcript's per-record
# uuid; her real send time rides along so her message sorts ABOVE the reply it
# prompted. Same first-run policy as the replies above: baseline the history and
# post only her latest, so installing this never floods a live feed.
uf = os.environ.get('USTATE', '')
if uf and users:
    first_u = not os.path.exists(uf)
    useen = set()
    if not first_u:
        try:
            useen = set(x for x in open(uf).read().split('\n') if x)
        except Exception:
            pass
    new_useen = set(useen)
    # …and her own messages baseline with them (same flag, same reason: a
    # backfilled thread that carried only the replies would read as a monologue)
    #
    # HER FIRST MESSAGE WENT MISSING WHENEVER SHE SENT TWO IN A ROW (found live
    # 2026-08-26 in panels-playground-parity: she sent the work request and then
    # "thank you", the session's FIRST hook firing was the Stop at the end of
    # that long turn, and `users[:-1]` silently marked the real request posted
    # while only "thank you" went out — the thread opens on a reply answering a
    # question nobody can see, and the transcript is the only copy).
    # The feed side above baselines all but the LATEST TURN, not the last
    # reply; this is the same rule for her half. Everything from the turn's
    # own user record onward is kept (`i >= last_user`), plus anything still
    # QUEUED (`i` = INF), plus — belt and braces — her newest message, which
    # is all the old rule ever kept. So this can only ever post MORE than
    # before, never fewer, and a mid-life self-heal still posts 1-2 messages
    # rather than flooding her feed with a week of history.
    if first_u and not os.environ.get('FORGE_BACKFILL', '').strip():
        keep = {users[-1]['uuid']}
        for u in users:
            if u.get('i', 0) >= last_user:
                keep.add(u['uuid'])
        for u in users:
            if u['uuid'] not in keep:
                new_useen.add(u['uuid'])
    for u in users:
        # ANY of these ids counts as already-posted: the queue record's key and
        # the user record's uuid are the SAME message, and a joined record
        # carries one key per message it swallowed (see the alias pass above)
        al = u.get('aliases') or []
        if u['uuid'] in new_useen or any(a in new_useen for a in al):
            new_useen.add(u['uuid'])          # remember them all, so next run is a fast skip
            new_useen.update(al)
            continue
        mine = {"chat": os.environ['NAME'], "text": u['text'][:8000]}
        if u['at']:
            mine["created"] = u['at']
        # the server routes session-first off this, so her message lands in the
        # same chat as the reply it prompted even if NAME above is stale
        if os.environ.get('SESSION_KEY'):
            mine["session"] = os.environ['SESSION_KEY']
        if os.environ.get('EXPLICIT'):
            mine["explicit"] = True
        print('U\t' + json.dumps(mine))
        new_useen.add(u['uuid'])
        new_useen.update(u.get('aliases') or [])
    os.makedirs(os.path.dirname(uf), exist_ok=True)
    open(uf, 'w').write('\n'.join(sorted(new_useen)))

if not turns:
    sys.exit(0)
text = turns[-1]['text']  # latest turn — the gallery scans this

# ── gallery items (independent of the feed de-dupe) ──
gf = os.environ['GSTATE']
first = not os.path.exists(gf)
done = set()
if not first:
    try:
        done = set(x for x in open(gf).read().split('\n') if x)
    except Exception:
        pass
gallery = []
descs = {}             # url -> what the reply called it (markdown link text)
for m in MDLINK.finditer(text):
    d = gooddesc(m.group(1))
    if d:
        descs.setdefault(m.group(2), d)
finished_urls = set()  # URLs shown to Sophie in the reply → the finished gallery
for u in FIRE.findall(text):
    finished_urls.add(u)
    k = 'u:' + u
    d = descs.get(u, '')
    if k not in done:
        done.add(k)
        g = {'url': u}
        if d:
            done.add('d:' + u); g['desc'] = d
        gallery.append(g)
    elif d and ('d:' + u) not in done:
        # already filed (often as a work-in-progress) and NOW named — re-post so
        # the server de-dupes onto the same asset and just sets the description
        done.add('d:' + u)
        gallery.append({'url': u, 'desc': d})
for i, p in sends:
    k = 'f:' + p
    if k in done:
        continue
    done.add(k)
    if not first or i > last_user:
        gallery.append({'file': p})
if not first:
    blob = ''.join(raw_since)
    wip_n = 0
    for u in FIRE.findall(blob):
        if u in finished_urls:
            continue
        if ('u:' + u in done) or ('w:' + u in done):
            continue
        done.add('w:' + u)
        gallery.append({'wip': u})
        wip_n += 1
        if wip_n >= 60:
            break
else:
    for u in FIRE.findall(''.join(raw_since)):
        done.add('w:' + u)
os.makedirs(os.path.dirname(gf), exist_ok=True)
open(gf, 'w').write('\n'.join(sorted(done)))

# ── feed payloads (every turn not yet posted; backfills missed ones) ──
sf = os.environ['STATEFILE']
first_feed = not os.path.exists(sf)
posted = set()
if not first_feed:
    try:
        posted = set(x for x in open(sf).read().split('\n') if x)
    except Exception:
        pass
new_posted = set(posted)
# THE BASELINE IS WHAT MAKES A CHAT'S PAST UNRECOVERABLE, and that is normally
# right: a session healing its hook mid-life must not dump a week of replies
# into the feed. But it also means a chat that NEVER posted (a whole account
# whose environment was missing the domain, the setup script, or FORGE_ACCOUNT
# — account 3, measured 2026-08-22: zero chats ever tagged "3") can never be
# recovered afterwards, because the first firing of a healed hook silently
# marks its whole history as already-posted. FORGE_BACKFILL=1 is the deliberate
# opt-out, set only by scripts/backfill-chat-history.sh — never by an
# environment, or every new session would flood the feed on its first turn.
if first_feed and not os.environ.get('FORGE_BACKFILL', '').strip():
    # brand-new session: baseline the whole history, post only the latest turn,
    # so upgrading the hook (or a fresh sandbox) never floods with old messages
    for tn in turns[:-1]:
        new_posted.add(tn['mid'])

def tldr_of(t):
    m = re.search(r'(?is)\bTL;?DR\b[:\s]*(.+)', t)
    return m.group(1).strip().split('\n')[0][:1000] if m else ""

feeds = []
for tn in turns:
    if tn['mid'] in new_posted:
        continue
    out = {"chat": os.environ['NAME'], "text": tn['text'][:20000], "tldr": tldr_of(tn['text'])}
    # when the reply was actually written (see cur_at above) — the server keeps
    # a doc's FIRST `created`, so on a live turn this changes nothing a draft
    # has already stamped, and on a backfill it is the whole point
    if tn.get('at'):
        out["created"] = tn['at']
    # the turn key (no `working`) finalizes any live draft this turn posted:
    # the server lands this on the SAME message doc and clears the marker
    if tn.get('turn'):
        out["turn"] = tn['turn']
    # where the working middle starts and ends (see the fold note above)
    if 'head' in tn:
        out["head"] = tn['head']; out["tail"] = tn['tail']
    if os.environ.get('CLAUDE_URL'):
        out["url"] = os.environ['CLAUDE_URL']
    if os.environ.get('SESSION_KEY'):
        out["session"] = os.environ['SESSION_KEY']
    if os.environ.get('EXPLICIT'):
        out["explicit"] = True
    # Which Claude account this session runs under (FORGE_ACCOUNT env var set
    # on the cloud environment: "1" or "2"). The Chats app routes each chat's
    # Open button — Claude app vs browser — off this tag.
    if os.environ.get('FORGE_ACCOUNT', '').strip():
        out["account"] = os.environ['FORGE_ACCOUNT'].strip()[:20]
    feeds.append((tn['mid'], out))
# The ledger records a turn ONLY AFTER its post is confirmed — the bash side
# appends each mid when the server really answers {"ok":true}. It used to
# record BEFORE posting, so one failed POST (the egress filter's block page
# arrives as a 403 with curl exit 0) marked a reply posted forever while the
# feed never received it — found live 2026-08-10, a full reply stranded as
# its 570-char draft.
os.makedirs(os.path.dirname(sf), exist_ok=True)
# trailing newline matters: the bash side APPENDS confirmed ids, and without
# it the first append fuses with the last id into one corrupted line
open(sf, 'w').write('\n'.join(sorted(new_posted)) + ('\n' if new_posted else ''))

for mid, fp in feeds:
    print('F\t' + mid + '\t' + json.dumps(fp))
for g in gallery:
    print('G\t' + json.dumps(g))
PY
)

# Sophie's own messages FIRST, so hers is in the feed before the reply it
# prompted (they carry her real send time, so the order holds either way).
printf '%s\n' "$out" | sed -n 's/^U\t//p' | while IFS= read -r up; do
  [ -n "$up" ] && post "$FEED/reply" "$up"
done

# post each un-posted turn (oldest first — usually just the latest, more when
# backfilling ones the hook missed). Its id goes into the posted-ledger ONLY
# when the server really answered ok — a blocked or failed post stays
# un-recorded, so the next event RETRIES it instead of losing it silently.
printf '%s\n' "$out" | sed -n 's/^F\t//p' | while IFS= read -r line; do
  [ -n "$line" ] || continue
  mid=${line%%$'\t'*}
  fp=${line#*$'\t'}
  resp=$(post_ok "$FEED" "$fp")
  case "$resp" in
    *'"ok":true'*) printf '%s\n' "$mid" >> "$state" ;;
  esac
done

# file each new image deliverable into the gallery
nowms=$(date +%s%3N 2>/dev/null || echo $(($(date +%s)*1000)))
pj=$(printf 'from %s' "$name" | jq -Rs .)
# session tag → the server files the image session-first, same as feed posts
sj=""
[ -n "$session_key" ] && sj=",\"session\":$(printf '%s' "$session_key" | jq -Rs .)"
[ -n "$explicit" ] && sj=",\"explicit\":true"
printf '%s\n' "$out" | sed -n 's/^G\t//p' | while IFS= read -r g; do
  [ -n "$g" ] || continue
  u=$(printf '%s' "$g" | jq -r '.url // empty')
  f=$(printf '%s' "$g" | jq -r '.file // empty')
  w=$(printf '%s' "$g" | jq -r '.wip // empty')
  cj=$(printf '%s' "$name" | jq -Rs .)
  # what the reply called this image, when it named it — shown as the caption
  dj=$(printf '%s' "$g" | jq -r 'if .desc then ",\"description\":" + (.desc|tostring|@json) else "" end')
  if [ -n "$u" ]; then
    post "$GALLERY" "{\"url\":$(printf '%s' "$u" | jq -Rs .),\"prompt\":$pj,\"created\":$nowms,\"chat\":$cj$dj$sj}"
  elif [ -n "$w" ]; then
    post "$GALLERY" "{\"url\":$(printf '%s' "$w" | jq -Rs .),\"prompt\":$pj,\"created\":$nowms,\"chat\":$cj,\"assetsOnly\":true$dj$sj}"
  elif [ -n "$f" ] && [ -f "$f" ] && [ "$(stat -c%s "$f" 2>/dev/null || echo 99999999)" -lt 9000000 ]; then
    case "${f##*.}" in
      png) mime=image/png;; webp) mime=image/webp;; gif) mime=image/gif;; *) mime=image/jpeg;;
    esac
    tmp=$(mktemp)
    printf '{"image":"data:%s;base64,' "$mime" > "$tmp"
    base64 -w0 "$f" >> "$tmp" 2>/dev/null || base64 "$f" | tr -d '\n' >> "$tmp"
    printf '","prompt":%s,"created":%s,"chat":%s%s%s}' "$pj" "$nowms" "$cj" "$dj" "$sj" >> "$tmp"
    curl -s -m 120 -X POST "$GALLERY" -H "Content-Type: application/json" \
      ${STUDIO_TOKEN:+-H "x-studio-token: $STUDIO_TOKEN"} -d @"$tmp" >/dev/null 2>&1 || true
    rm -f "$tmp"
  fi
done

exit 0
HOOK
chmod +x /home/user/.claude/hooks/post-to-feed.sh

# Register the hook as PROJECT settings for /home/user (the session's
# starting folder). Merge-safe: keeps anything already in the file.
python3 - << 'PY_SETTINGS' || true
import json, os
p = '/home/user/.claude/settings.json'
try:
    s = json.load(open(p))
except Exception:
    s = {}
entry = {"hooks": [{"type": "command",
         "command": "bash /home/user/.claude/hooks/post-to-feed.sh"}]}
# Register on THREE events. Stop fires when a reply finishes cleanly.
# UserPromptSubmit fires when Sophie sends her next message — it sweeps up
# INTERRUPTED replies: an interrupted turn skips the Stop hook, but the partial
# reply is already in the transcript by the time the next prompt lands, so
# UserPromptSubmit posts it (and finalizes any live draft the turn left
# behind). PostToolUse fires after every tool call — that's the LIVE DRAFT
# pass: the prose written so far posts as a growing "still writing…" message
# the moment the chat starts coding, instead of only when the whole turn ends.
# The per-message/per-draft state files make all three idempotent — whichever
# fires first posts, the others are no-ops. Existing environments pick the new
# event up automatically: this setup script re-runs at every session start and
# the registration below appends any event still missing.
for event in ('Stop', 'UserPromptSubmit', 'PostToolUse'):
    arr = s.setdefault('hooks', {}).setdefault(event, [])
    if not any('post-to-feed' in json.dumps(x) for x in arr):
        arr.append(entry)
# The /concise output style — Sophie's ask (Aug 2026): every chat leads with
# the result and keeps replies short. setdefault, so an explicit choice already
# in the file is never overwritten. Read at session START only, so it reaches
# NEW sessions; both repos also commit the same key in their own
# .claude/settings.json for sessions that start inside a repo, where this file
# is not the project settings file.
s.setdefault('outputStyle', 'Concise')
json.dump(s, open(p, 'w'), indent=2)
print('chats auto-filer registered (Stop + UserPromptSubmit + PostToolUse)')
PY_SETTINGS

# The repo's skills, loading in EVERY session (v9). ONE directory SYMLINK —
# never a copy, which would freeze the skills at whenever this script last
# ran; the link always reads whatever is on the imageforge clone today, and
# it is safe to make even before the clone exists (it resolves at read time,
# and dangles harmlessly in a session with no imageforge checkout). If
# something real already sits at that path, leave it alone.
if [ ! -e /home/user/.claude/skills ] && [ ! -L /home/user/.claude/skills ]; then
  ln -s /home/user/imageforge/.claude/skills /home/user/.claude/skills
  echo 'skills symlinked: /home/user/.claude/skills -> imageforge/.claude/skills'
fi

true
