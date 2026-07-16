#!/bin/bash
# Auto-post this chat's reply to the DeckFactory Chats feed when the turn ends,
# so the Chats app (/chats) stays current with ZERO model tokens and nothing to
# remember. A Stop hook runs this after every reply; it reads the reply that was
# ALREADY written to the transcript and POSTs it. Modeled on the environment's
# existing ~/.claude/stop-hook-git-check.sh (same stdin/JSON handling).
#
# Registered in .claude/settings.json under hooks.Stop. Never blocks a turn
# (always exit 0). Needs jq + python3 + curl (all present in the environment).

input=$(cat)

# NOTE: no stop_hook_active bail — another Stop hook (the git checker) interrupts
# finishes constantly during active work (exit 2 on uncommitted changes), and
# bailing on stop_hook_active silently dropped those turns' posts (verified
# live 2026-07-15). The per-message state file below already prevents
# double-posting, and this hook never blocks a stop, so it cannot loop itself.

FEED="${FORGE_FEED_URL:-https://imageforge-q125.onrender.com/api/chatfeed}"

transcript=$(printf '%s' "$input" | jq -r '.transcript_path // empty')
[ -n "$transcript" ] || exit 0
[ -f "$transcript" ] || exit 0

sid=$(printf '%s' "$input" | jq -r '.session_id // empty')
[ -n "$sid" ] || sid="${CLAUDE_CODE_SESSION_ID:-x}"

# Chat name (per chat): FORGE_CHAT env wins; else a slug of a repo's claude/<name>
# branch (drops the random 6-char suffix); else a short session id.
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

# "Open in Claude" URL: cse_XXX -> https://claude.ai/code/session_XXX
claude_url=""
if [ -n "${CLAUDE_CODE_REMOTE_SESSION_ID:-}" ]; then
  claude_url="https://claude.ai/code/session_${CLAUDE_CODE_REMOTE_SESSION_ID#cse_}"
fi

state="$HOME/.claude/forge-feed-${sid}.last"

# Build the JSON payload from the transcript (last assistant text + its TL;DR).
# De-dupes on the assistant message id so repeated Stop fires post once.
payload=$(NAME="$name" CLAUDE_URL="$claude_url" STATEFILE="$state" \
  python3 - "$transcript" 2>/dev/null <<'PY'
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
        sys.exit(0)   # already posted this reply
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

curl -s -m 75 -X POST "$FEED" \
  -H "Content-Type: application/json" \
  ${STUDIO_TOKEN:+-H "x-studio-token: $STUDIO_TOKEN"} \
  -d "$payload" >/dev/null 2>&1 \
|| curl -s -m 75 -X POST "$FEED" \
  -H "Content-Type: application/json" \
  ${STUDIO_TOKEN:+-H "x-studio-token: $STUDIO_TOKEN"} \
  -d "$payload" >/dev/null 2>&1 || true

exit 0
