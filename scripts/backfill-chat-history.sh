#!/bin/bash
# BACKFILL A CHAT'S WHOLE HISTORY INTO THE CHATS APP — and say why it never
# posted in the first place.
#
# WHY THIS EXISTS (2026-08-22). The auto-filer hook BASELINES: the first time it
# runs in a session it marks every turn but the latest as already-posted, so
# healing a hook mid-life never dumps a week of old replies into the feed. That
# is right for a chat that was posting and missed a few turns — and it is
# exactly what makes a chat that NEVER posted unrecoverable, because the first
# firing of the healed hook throws its whole history away silently.
# Measured that day against the live registry: 292 chats tagged account 1, 128
# tagged account 2, ZERO ever tagged account 3, and no untagged chat posting
# either — i.e. nothing on account 3 has ever reached the app.
#
# RUN IT INSIDE THE CHAT YOU WANT BACK. It reads that session's own transcript
# (nothing else can — a session's transcript lives only in its own container)
# and posts every turn it finds, plus Sophie's own messages, oldest first.
# Re-running is safe: the server upserts on sha1(session|turn), so a turn that
# already made it lands on the same message doc instead of a second one.
#
#   bash scripts/backfill-chat-history.sh                  # diagnose only
#   bash scripts/backfill-chat-history.sh --go             # post it
#   bash scripts/backfill-chat-history.sh --account 3 --go # …and tag the account
#
# --account N is for a session whose environment never set FORGE_ACCOUNT: the
# tag rides on the posts, so the chat lands on the right tab. It changes nothing
# for the environment itself — fix that in the environment's settings, or the
# NEXT session is silent again.
set -u

FEED="${FORGE_FEED_URL:-https://imageforge-q125.onrender.com/api/chatfeed}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
GO=""; ACCT="${FORGE_ACCOUNT:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --go) GO=1;;
    --account) shift; ACCT="${1:-}";;
    --account=*) ACCT="${1#*=}";;
    -h|--help) sed -n '2,30p' "$0"; exit 0;;
    *) echo "unknown argument: $1" >&2; exit 2;;
  esac
  shift
done

sid="${CLAUDE_CODE_SESSION_ID:-}"
# The hook body is the source of truth for how a transcript becomes messages —
# this script never parses one itself, so the two can never disagree about a
# turn's key (they would post the same reply twice under two ids). Prefer the
# repo's copy: an unhealed session's INSTALLED hook predates FORGE_BACKFILL and
# would baseline the history away instead of posting it.
HOOK="$HERE/.claude/hooks/post-to-feed.sh"
[ -f "$HOOK" ] || HOOK="$HOME/.claude/hooks/post-to-feed.sh"

# ── the transcript: this session's, by id; else the most recently written one ──
tr=""
if [ -n "$sid" ]; then
  tr=$(ls -1 "$HOME/.claude/projects"/*/"$sid".jsonl 2>/dev/null | head -1)
fi
[ -n "$tr" ] || tr=$(ls -1t "$HOME/.claude/projects"/*/*.jsonl 2>/dev/null | head -1)

echo "── this chat ──"
echo "session       : ${sid:-<unset>}   remote: ${CLAUDE_CODE_REMOTE_SESSION_ID:-<unset>}"
echo "FORGE_ACCOUNT : ${FORGE_ACCOUNT:-<unset>}${ACCT:+   (posting as: $ACCT)}"
echo "transcript    : ${tr:-<none found>}"
echo "hook body     : ${HOOK}$([ -f "$HOOK" ] && echo '' || echo '  <MISSING>')"
if grep -q FORGE_BACKFILL "$HOOK" 2>/dev/null; then echo "backfill flag : yes"
else echo "backfill flag : NO — this hook predates it; run from an imageforge checkout"; fi
led="$HOME/.claude/forge-feed-${sid:-x}.posted"
if [ -f "$led" ]; then echo "posted ledger : $(grep -c . "$led" 2>/dev/null) turns recorded"
else echo "posted ledger : none — this session has never posted a turn"; fi

# Is the app even reachable? A Trusted-level environment blocks this domain
# outright, and then NOTHING here can work — the hook fails the same way, which
# is the single most likely reason a whole account is silent.
code=$(curl -s -m 20 -o /dev/null -w '%{http_code}' "$FEED/widget" 2>/dev/null)
echo "feed reachable: ${code:-no answer} $([ "$code" = "200" ] && echo OK || echo '← blocked or down; fix Network access on this environment first')"

[ -f "$HOOK" ] || { echo; echo "No hook body to run — clone imageforge or reinstall the hook."; exit 1; }
[ -n "$tr" ] || { echo; echo "No transcript found — nothing to backfill."; exit 1; }

turns=$(python3 - "$tr" <<'PY'
import json,sys
n=0; open_turn=False
for ln in open(sys.argv[1],encoding='utf-8',errors='replace'):
    try: r=json.loads(ln)
    except Exception: continue
    m=r.get('message') or {}
    c=m.get('content'); bl=c if isinstance(c,list) else []
    if m.get('role')=='user':
        if not any(isinstance(b,dict) and b.get('type')=='tool_result' for b in bl):
            if open_turn: n+=1
            open_turn=False
    elif m.get('role')=='assistant':
        t=c if isinstance(c,str) else ''.join(b.get('text','') for b in bl if isinstance(b,dict) and b.get('type')=='text')
        if t.strip(): open_turn=True
if open_turn: n+=1
print(n)
PY
)
echo "turns in file : ${turns:-?}"

if [ -z "$GO" ]; then
  echo; echo "Dry run. Add --go to post them (safe to re-run — the server upserts by turn)."
  exit 0
fi

echo; echo "── posting ──"
FORGE_BACKFILL=1 ${ACCT:+FORGE_ACCOUNT="$ACCT"} \
  bash "$HOOK" <<EOF
{"session_id": $(printf '%s' "${sid:-x}" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))'), "transcript_path": $(printf '%s' "$tr" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))'), "hook_event_name": "Stop"}
EOF
echo "done — open the chat in the app and check the oldest message."
