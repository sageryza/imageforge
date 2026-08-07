#!/bin/bash
# Auto-post this chat's finished reply to the DeckFactory Chats feed, and file
# its image deliverables into the iOS "My Creations" gallery — zero model
# tokens, nothing to remember. Runs as a Stop hook after every reply.
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
import json, sys, os
path = sys.argv[1]
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
                # same turn boundary the final parser uses: ANY non-tool-result
                # user record starts a new segment, and its uuid is the key the
                # Stop post will carry — that's what lands both on ONE doc
                turnkey = r.get('uuid'); parts = []
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
  ( post "$FEED/working" "$(jq -nc --arg c "$name" --arg s "$session_key" '{chat:$c, session:$s}')" ) >/dev/null 2>&1 &
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
NOISE = re.compile(r'''(?is)^\s*(\[Request interrupted|\[SYSTEM NOTIFICATION'''
                   r'''|<task-notification|<github-webhook-activity|<command-name'''
                   r'''|<local-command-stdout|Caveat: The messages below)''')
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
    global cur_parts, cur_mid
    txt = "\n\n".join(cur_parts).strip()
    if txt and cur_mid:
        turns.append({'text': txt, 'mid': cur_mid, 'turn': cur_turnkey})
    cur_parts = []; cur_mid = None

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
                    queued.append({'uuid': 'q:' + r['timestamp'], 'text': qt,
                                   'at': r['timestamp']})
            continue
        role = (r.get('message') or {}).get('role')
        if role == 'user':
            if not any(isinstance(b, dict) and b.get('type') == 'tool_result' for b in blocks(r)):
                flush()           # end of the previous assistant turn
                cur_turnkey = r.get('uuid')
                last_user = idx
                raw_since = []
                mine = her_words(r, gettext(r))
                if mine and r.get('uuid'):
                    users.append({'uuid': r['uuid'], 'text': mine,
                                  'at': r.get('timestamp') or ''})
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
        for b in blocks(r):
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
    from collections import Counter
    def _norm(s):
        return ' '.join((s or '').split()).lower()[:160]
    have = Counter(_norm(u['text']) for u in users)
    for q in queued:
        k = _norm(q['text'])
        if have.get(k):
            have[k] -= 1
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
    if first_u:
        for u in users[:-1]:
            new_useen.add(u['uuid'])
    for u in users:
        if u['uuid'] in new_useen:
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
if first_feed:
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
    # the turn key (no `working`) finalizes any live draft this turn posted:
    # the server lands this on the SAME message doc and clears the marker
    if tn.get('turn'):
        out["turn"] = tn['turn']
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
    feeds.append(out)
    new_posted.add(tn['mid'])
os.makedirs(os.path.dirname(sf), exist_ok=True)
open(sf, 'w').write('\n'.join(sorted(new_posted)))

for fp in feeds:
    print('F\t' + json.dumps(fp))
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
# backfilling ones the hook missed)
printf '%s\n' "$out" | sed -n 's/^F\t//p' | while IFS= read -r fp; do
  [ -n "$fp" ] && post "$FEED" "$fp"
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
