#!/bin/bash
# Deck Factory Chats auto-filer — the cloud environment's Setup script fetches
# this from /setup.sh (curl | bash). Why not a repo hook: sessions start at
# /home/user (the folder HOLDING the four repos), and Claude Code only loads
# .claude/settings.json from the starting folder — so a repo-committed hook
# never loads (verified live 2026-07-15). This writes the hook to
# /home/user/.claude/ before Claude Code launches; the environment snapshot
# carries it into every future session. v3: also files image deliverables
# into the iOS gallery via POST /api/gallery.
# Source of truth for the hook body: imageforge/.claude/hooks/post-to-feed.sh.

mkdir -p /home/user/.claude/hooks

cat > /home/user/.claude/hooks/post-to-feed.sh << 'HOOK'
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

state="$HOME/.claude/forge-feed-${sid}.last"
gstate="$HOME/.claude/forge-gallery-${sid}.done"

# One transcript pass emits: line 1 = the feed payload (or empty if deduped),
# then one "G<TAB>{...}" line per NEW image deliverable — Firebase image URLs
# in the final reply, plus image files the chat sent via SendUserFile (files
# sent before this hook existed are baselined silently on the first run).
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
mid = None; text = None; sends = []; idx = 0; last_user = -1
with open(path, encoding='utf-8') as f:
    for ln in f:
        try:
            r = json.loads(ln)
        except Exception:
            continue
        idx += 1
        role = (r.get('message') or {}).get('role')
        if role == 'user':
            # a REAL user turn, not a tool-result envelope
            if not any(isinstance(b, dict) and b.get('type') == 'tool_result' for b in blocks(r)):
                last_user = idx
            continue
        if role != 'assistant':
            continue
        t = gettext(r)
        if t.strip():
            text = t
            mid = (r.get('message') or {}).get('id')
        for b in blocks(r):
            if isinstance(b, dict) and b.get('type') == 'tool_use' and b.get('name') == 'SendUserFile':
                for p in ((b.get('input') or {}).get('files') or []):
                    if isinstance(p, str) and IMG.search(p):
                        sends.append((idx, p))
if not text:
    sys.exit(0)

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
for u in re.findall(r'https://(?:storage|firebasestorage)\.googleapis\.com/[^\s)\]"\'<>]+?\.(?:png|jpe?g|webp|gif)', text, re.I):
    k = 'u:' + u
    if k not in done:
        done.add(k); gallery.append({'url': u})
for i, p in sends:
    k = 'f:' + p
    if k in done:
        continue
    done.add(k)
    # first run baselines HISTORY only — files sent during the current reply
    # (after the last real user turn) still post, so a brand-new chat's first
    # delivery isn't swallowed
    if not first or i > last_user:
        gallery.append({'file': p})
os.makedirs(os.path.dirname(gf), exist_ok=True)
open(gf, 'w').write('\n'.join(sorted(done)))

# ── feed payload (skipped if this reply already posted) ──
payload = ''
sf = os.environ['STATEFILE']
posted = ''
try:
    posted = open(sf).read().strip()
except FileNotFoundError:
    pass
if posted != (mid or ''):
    tldr = ""
    m = re.search(r'(?is)\bTL;?DR\b[:\s]*(.+)', text)
    if m:
        tldr = m.group(1).strip().split('\n')[0][:1000]
    out = {"chat": os.environ['NAME'], "text": text[:20000], "tldr": tldr}
    if os.environ.get('CLAUDE_URL'):
        out["url"] = os.environ['CLAUDE_URL']
    payload = json.dumps(out)
    open(sf, 'w').write(mid or '')
print(payload)
for g in gallery:
    print('G\t' + json.dumps(g))
PY
)

payload=$(printf '%s\n' "$out" | head -n1)
post () {  # $1 = url, $2 = json body (retries once; long timeout for cold starts)
  curl -s -m 75 -X POST "$1" -H "Content-Type: application/json" \
    ${STUDIO_TOKEN:+-H "x-studio-token: $STUDIO_TOKEN"} -d "$2" >/dev/null 2>&1 \
  || curl -s -m 75 -X POST "$1" -H "Content-Type: application/json" \
    ${STUDIO_TOKEN:+-H "x-studio-token: $STUDIO_TOKEN"} -d "$2" >/dev/null 2>&1 || true
}
[ -n "$payload" ] && post "$FEED" "$payload"

# file each new image deliverable into the gallery
nowms=$(date +%s%3N 2>/dev/null || echo $(($(date +%s)*1000)))
pj=$(printf 'from %s' "$name" | jq -Rs .)
printf '%s\n' "$out" | sed -n 's/^G\t//p' | while IFS= read -r g; do
  [ -n "$g" ] || continue
  u=$(printf '%s' "$g" | jq -r '.url // empty')
  f=$(printf '%s' "$g" | jq -r '.file // empty')
  cj=$(printf '%s' "$name" | jq -Rs .)
  if [ -n "$u" ]; then
    post "$GALLERY" "{\"url\":$(printf '%s' "$u" | jq -Rs .),\"prompt\":$pj,\"created\":$nowms,\"chat\":$cj}"
  elif [ -n "$f" ] && [ -f "$f" ] && [ "$(stat -c%s "$f" 2>/dev/null || echo 99999999)" -lt 9000000 ]; then
    case "${f##*.}" in
      png) mime=image/png;; webp) mime=image/webp;; gif) mime=image/gif;; *) mime=image/jpeg;;
    esac
    tmp=$(mktemp)
    printf '{"image":"data:%s;base64,' "$mime" > "$tmp"
    base64 -w0 "$f" >> "$tmp" 2>/dev/null || base64 "$f" | tr -d '\n' >> "$tmp"
    printf '","prompt":%s,"created":%s,"chat":%s}' "$pj" "$nowms" "$cj" >> "$tmp"
    curl -s -m 120 -X POST "$GALLERY" -H "Content-Type: application/json" \
      ${STUDIO_TOKEN:+-H "x-studio-token: $STUDIO_TOKEN"} -d @"$tmp" >/dev/null 2>&1 || true
    rm -f "$tmp"
  fi
done

exit 0
HOOK
chmod +x /home/user/.claude/hooks/post-to-feed.sh

# Register the Stop hook as PROJECT settings for /home/user (the session's
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
stops = s.setdefault('hooks', {}).setdefault('Stop', [])
if not any('post-to-feed' in json.dumps(x) for x in stops):
    stops.append(entry)
json.dump(s, open(p, 'w'), indent=2)
print('chats auto-filer registered')
PY_SETTINGS

true
