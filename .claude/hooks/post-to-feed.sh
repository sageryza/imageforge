#!/bin/bash
# Auto-post this chat's finished reply to the DeckFactory Chats feed, and file
# its image deliverables into the iOS "My Creations" gallery — zero model
# tokens, nothing to remember. Runs as a Stop hook after every reply.
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
[ -n "$name" ] || name="chat-$(printf '%s' "$sid" | cut -c1-8)"

claude_url=""
if [ -n "${CLAUDE_CODE_REMOTE_SESSION_ID:-}" ]; then
  claude_url="https://claude.ai/code/session_${CLAUDE_CODE_REMOTE_SESSION_ID#cse_}"
fi

state="$HOME/.claude/forge-feed-${sid}.posted"
gstate="$HOME/.claude/forge-gallery-${sid}.done"

# One transcript pass emits: one "F<TAB>{...}" line per feed post to make (every
# turn not yet in the posted-set — usually just the latest, more when catching
# up missed ones), then one "G<TAB>{...}" line per NEW image deliverable —
# Firebase image URLs in the final reply, plus image files the chat sent via
# SendUserFile (files sent before this hook existed are baselined on first run).
out=$(NAME="$name" CLAUDE_URL="$claude_url" STATEFILE="$state" GSTATE="$gstate" \
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
turns = []
cur_parts = []; cur_mid = None
sends = []; idx = 0; last_user = -1
raw_since = []  # raw records of the CURRENT (latest) turn — for wip gallery

def flush():
    global cur_parts, cur_mid
    txt = "\n\n".join(cur_parts).strip()
    if txt and cur_mid:
        turns.append({'text': txt, 'mid': cur_mid})
    cur_parts = []; cur_mid = None

with open(path, encoding='utf-8') as f:
    for ln in f:
        try:
            r = json.loads(ln)
        except Exception:
            continue
        idx += 1
        role = (r.get('message') or {}).get('role')
        if role == 'user':
            if not any(isinstance(b, dict) and b.get('type') == 'tool_result' for b in blocks(r)):
                flush()           # end of the previous assistant turn
                last_user = idx
                raw_since = []
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
    if os.environ.get('CLAUDE_URL'):
        out["url"] = os.environ['CLAUDE_URL']
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

post () {  # $1 = url, $2 = json body (retries once; long timeout for cold starts)
  curl -s -m 75 -X POST "$1" -H "Content-Type: application/json" \
    ${STUDIO_TOKEN:+-H "x-studio-token: $STUDIO_TOKEN"} -d "$2" >/dev/null 2>&1 \
  || curl -s -m 75 -X POST "$1" -H "Content-Type: application/json" \
    ${STUDIO_TOKEN:+-H "x-studio-token: $STUDIO_TOKEN"} -d "$2" >/dev/null 2>&1 || true
}

# post each un-posted turn (oldest first — usually just the latest, more when
# backfilling ones the hook missed)
printf '%s\n' "$out" | sed -n 's/^F\t//p' | while IFS= read -r fp; do
  [ -n "$fp" ] && post "$FEED" "$fp"
done

# file each new image deliverable into the gallery
nowms=$(date +%s%3N 2>/dev/null || echo $(($(date +%s)*1000)))
pj=$(printf 'from %s' "$name" | jq -Rs .)
printf '%s\n' "$out" | sed -n 's/^G\t//p' | while IFS= read -r g; do
  [ -n "$g" ] || continue
  u=$(printf '%s' "$g" | jq -r '.url // empty')
  f=$(printf '%s' "$g" | jq -r '.file // empty')
  w=$(printf '%s' "$g" | jq -r '.wip // empty')
  cj=$(printf '%s' "$name" | jq -Rs .)
  # what the reply called this image, when it named it — shown as the caption
  dj=$(printf '%s' "$g" | jq -r 'if .desc then ",\"description\":" + (.desc|tostring|@json) else "" end')
  if [ -n "$u" ]; then
    post "$GALLERY" "{\"url\":$(printf '%s' "$u" | jq -Rs .),\"prompt\":$pj,\"created\":$nowms,\"chat\":$cj$dj}"
  elif [ -n "$w" ]; then
    post "$GALLERY" "{\"url\":$(printf '%s' "$w" | jq -Rs .),\"prompt\":$pj,\"created\":$nowms,\"chat\":$cj,\"assetsOnly\":true$dj}"
  elif [ -n "$f" ] && [ -f "$f" ] && [ "$(stat -c%s "$f" 2>/dev/null || echo 99999999)" -lt 9000000 ]; then
    case "${f##*.}" in
      png) mime=image/png;; webp) mime=image/webp;; gif) mime=image/gif;; *) mime=image/jpeg;;
    esac
    tmp=$(mktemp)
    printf '{"image":"data:%s;base64,' "$mime" > "$tmp"
    base64 -w0 "$f" >> "$tmp" 2>/dev/null || base64 "$f" | tr -d '\n' >> "$tmp"
    printf '","prompt":%s,"created":%s,"chat":%s%s}' "$pj" "$nowms" "$cj" "$dj" >> "$tmp"
    curl -s -m 120 -X POST "$GALLERY" -H "Content-Type: application/json" \
      ${STUDIO_TOKEN:+-H "x-studio-token: $STUDIO_TOKEN"} -d @"$tmp" >/dev/null 2>&1 || true
    rm -f "$tmp"
  fi
done

exit 0
