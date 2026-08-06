#!/usr/bin/env python3
# Rebuilds docs/chats-autopost-setup-script.sh (and its served copy
# public/setup.sh) from the source-of-truth hook body, so the three copies can
# never drift by hand-editing.
import os

ROOT = __import__('os').path.join(__import__('os').path.dirname(__file__), '..')
hook = open(os.path.join(ROOT, '.claude/hooks/post-to-feed.sh')).read().rstrip('\n')
assert '\nHOOK\n' not in hook and not hook.startswith('HOOK'), 'hook body would break the heredoc'

HEADER = '''#!/bin/bash
# Deck Factory Chats auto-filer — the cloud environment's Setup script fetches
# this from /setup.sh (curl | bash). Why not a repo hook: sessions start at
# /home/user (the folder HOLDING the four repos), and Claude Code only loads
# .claude/settings.json from the starting folder — so a repo-committed hook
# never loads (verified live 2026-07-15). This writes the hook to
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
# finalizes the same message.
# Source of truth for the hook body: imageforge/.claude/hooks/post-to-feed.sh
# (this file is REBUILT from it by scripts in that repo — don't hand-edit the
# hook body here).

mkdir -p /home/user/.claude/hooks

cat > /home/user/.claude/hooks/post-to-feed.sh << 'HOOK'
'''

FOOTER = '''HOOK
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
json.dump(s, open(p, 'w'), indent=2)
print('chats auto-filer registered (Stop + UserPromptSubmit + PostToolUse)')
PY_SETTINGS

true
'''

out = HEADER + hook + '\n' + FOOTER
for dest in ('docs/chats-autopost-setup-script.sh', 'public/setup.sh'):
    open(os.path.join(ROOT, dest), 'w').write(out)
    print('wrote', dest, len(out), 'bytes')
