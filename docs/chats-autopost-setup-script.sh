#!/bin/bash
# Deck Factory Chats auto-filer — paste this whole file into the CLOUD
# ENVIRONMENT'S "Setup script" field (environment settings dialog on
# claude.ai/code). Why here and not in a repo: these sessions start at
# /home/user (the folder HOLDING the four repos), and Claude Code only loads
# .claude/settings.json from the starting folder — so a repo-committed hook
# never loads (verified live 2026-07-15; docs: large-codebases.md). This
# script writes the hook to /home/user/.claude/ before Claude Code launches;
# the environment snapshot then carries it into every future session.
# Keep in sync with imageforge/.claude/hooks/post-to-feed.sh (the repo copy
# still covers single-repo sessions).

mkdir -p /home/user/.claude/hooks

cat > /home/user/.claude/hooks/post-to-feed.sh << 'HOOK'
#!/bin/bash
# Auto-post this chat's finished reply to the DeckFactory Chats feed
# (imageforge /api/chatfeed) — zero model tokens, nothing to remember.
input=$(cat)
if [ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi
FEED="${FORGE_FEED_URL:-https://imageforge-q125.onrender.com/api/chatfeed}"
transcript=$(printf '%s' "$input" | jq -r '.transcript_path // empty')
[ -n "$transcript" ] && [ -f "$transcript" ] || exit 0
sid=$(printf '%s' "$input" | jq -r '.session_id // empty')
[ -n "$sid" ] || sid="${CLAUDE_CODE_SESSION_ID:-x}"
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
payload=$(NAME="$name" CLAUDE_URL="$claude_url" STATEFILE="$state" \
  python3 - "$transcript" 2>/dev/null << 'PY'
import json, sys, os, re
path = sys.argv[1]
def gettext(rec):
    m = rec.get('message') or {}
    c = m.get('content')
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return "".join(b.get('text', '') for b in c
                       if isinstance(b, dict) and b.get('type') == 'text')
    return ""
mid = None; text = None
with open(path, encoding='utf-8') as f:
    for ln in f:
        try:
            r = json.loads(ln)
        except Exception:
            continue
        if (r.get('message') or {}).get('role') == 'assistant':
            t = gettext(r)
            if t.strip():
                text = t
                mid = (r.get('message') or {}).get('id')
if not text:
    sys.exit(0)
sf = os.environ['STATEFILE']
try:
    if open(sf).read().strip() == (mid or ''):
        sys.exit(0)
except FileNotFoundError:
    pass
tldr = ""
m = re.search(r'(?is)\bTL;?DR\b[:\s]*(.+)', text)
if m:
    tldr = m.group(1).strip().split('\n')[0][:1000]
out = {"chat": os.environ['NAME'], "text": text[:20000], "tldr": tldr}
if os.environ.get('CLAUDE_URL'):
    out["url"] = os.environ['CLAUDE_URL']
print(json.dumps(out))
os.makedirs(os.path.dirname(sf), exist_ok=True)
open(sf, 'w').write(mid or '')
PY
)
[ -n "$payload" ] || exit 0
curl -s -m 20 -X POST "$FEED" \
  -H "Content-Type: application/json" \
  ${STUDIO_TOKEN:+-H "x-studio-token: $STUDIO_TOKEN"} \
  -d "$payload" >/dev/null 2>&1 || true
exit 0
HOOK
chmod +x /home/user/.claude/hooks/post-to-feed.sh

# Register the Stop hook as PROJECT settings for /home/user (the session's
# starting folder). Merge-safe: keeps anything already in the file.
python3 - << 'PY' || true
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
PY

true
