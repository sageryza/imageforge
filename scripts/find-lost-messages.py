#!/usr/bin/env python3
"""Find (and optionally backfill) Sophie's messages that never reached the Chats app.

WHY THIS EXISTS
A message Sophie sends WHILE Claude is still working is queued, and a queued
message is written to the transcript ONLY as a `queue-operation`/`enqueue`
record — it never becomes a `user` record. The Chats hook only read `user`
records until 2026-08-07, so every mid-turn message she ever sent reached
Claude but silently never reached the Chats app. The hook is fixed now, but
hooks only load at session start, so:

  - sessions started BEFORE the fix keep dropping them until they restart, and
  - everything already lost stays lost until someone backfills it.

This script reads THIS session's own transcript (a chat can only see its own),
diffs it against what the feed actually holds, and reports/backfills the gap.

USAGE (from any chat, in its own session)
    python3 scripts/find-lost-messages.py                 # report only
    python3 scripts/find-lost-messages.py --apply         # post what's missing
    python3 scripts/find-lost-messages.py --chat my-slug  # override the slug
    python3 scripts/find-lost-messages.py --json          # machine-readable

Stdlib only. Needs no keys: the feed routes are open (x-studio-token is sent
when STUDIO_TOKEN is set, for a gated server).
"""
import argparse
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request

BASE = os.environ.get('FORGE_BASE', 'https://imageforge-q125.onrender.com').rstrip('/')

# The same filters the hook applies, so this agrees with it about what counts
# as a real message from her rather than machinery that also arrives as one.
REMINDER = re.compile(r'(?is)<system-reminder>.*?</system-reminder>')
NOISE = re.compile(r'''(?is)^\s*(\[Request interrupted|\[SYSTEM NOTIFICATION'''
                   r'''|<task-notification|<github-webhook-activity|<command-name'''
                   r'''|<local-command-stdout|Caveat: The messages below)''')


def her_words(rec, txt):
    if rec.get('isMeta'):
        return ''
    t = REMINDER.sub('', txt or '').strip()
    if not t or NOISE.match(t) or t == 'Continue from where you left off.':
        return ''
    return t


def gettext(rec):
    c = (rec.get('message') or {}).get('content')
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return ''.join(p.get('text', '') for p in c
                       if isinstance(p, dict) and p.get('type') == 'text')
    return ''


def blocks(rec):
    c = (rec.get('message') or {}).get('content')
    return c if isinstance(c, list) else []


def find_transcript():
    """This session's transcript. Prefer the one named for the session id."""
    root = os.path.expanduser('~/.claude/projects')
    found = []
    for dirpath, _dirs, files in os.walk(root):
        for f in files:
            if f.endswith('.jsonl'):
                found.append(os.path.join(dirpath, f))
    if not found:
        return None
    sid = os.environ.get('CLAUDE_SESSION_ID', '')
    for p in found:
        if sid and sid in p:
            return p
    return max(found, key=os.path.getmtime)


def branch_slug():
    """The same slug the hook derives from a repo's claude/<name> branch."""
    for d in sorted(os.listdir('/home/user')):
        path = os.path.join('/home/user', d)
        if not os.path.isdir(path):
            continue
        try:
            b = subprocess.run(['git', '-C', path, 'branch', '--show-current'],
                               capture_output=True, text=True, timeout=10).stdout.strip()
        except Exception:
            continue
        if b.startswith('claude/'):
            return re.sub(r'-[a-z0-9]{6}$', '', b[len('claude/'):])
    return ''


def api(path, body=None):
    req = urllib.request.Request(BASE + path)
    tok = os.environ.get('STUDIO_TOKEN')
    if tok:
        req.add_header('x-studio-token', tok)
    if body is not None:
        req.add_header('Content-Type', 'application/json')
        req.data = json.dumps(body).encode()
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def norm(s):
    return ' '.join((s or '').split()).lower()[:160]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--chat', default='', help='chat slug (default: resolved from the git branch)')
    ap.add_argument('--apply', action='store_true', help='actually post the missing messages')
    ap.add_argument('--json', action='store_true', help='machine-readable output')
    args = ap.parse_args()

    tr = find_transcript()
    if not tr:
        print('no transcript found under ~/.claude/projects', file=sys.stderr)
        return 2

    # Every message she sent, from BOTH record shapes.
    users, queued = [], []
    with open(tr, encoding='utf-8') as f:
        for ln in f:
            try:
                r = json.loads(ln)
            except Exception:
                continue
            if r.get('type') == 'queue-operation':
                if r.get('operation') == 'enqueue' and r.get('timestamp'):
                    t = her_words(r, r.get('content') or '')
                    if t:
                        queued.append({'text': t, 'at': r['timestamp']})
                continue
            if (r.get('message') or {}).get('role') != 'user':
                continue
            if any(isinstance(b, dict) and b.get('type') == 'tool_result' for b in blocks(r)):
                continue
            t = her_words(r, gettext(r))
            if t:
                users.append({'text': t, 'at': r.get('timestamp') or ''})

    # Union: a queued entry is a DISTINCT message only when no user record
    # carries the same words (every message is enqueued, not just mid-turn
    # ones). Multiset, so a repeated phrase can't let the first swallow it.
    from collections import Counter
    have = Counter(norm(u['text']) for u in users)
    every = list(users)
    for q in queued:
        k = norm(q['text'])
        if have.get(k):
            have[k] -= 1
            continue
        every.append(q)
    every.sort(key=lambda m: m['at'])

    # What the feed actually holds for this chat.
    slug = args.chat or branch_slug()
    sid = re.sub(r'^cse_', '', os.environ.get('CLAUDE_CODE_REMOTE_SESSION_ID', ''))
    if slug and sid:
        try:
            slug = api('/api/chatfeed/name?chat=%s&session=%s'
                       % (urllib.parse.quote(slug), urllib.parse.quote(sid))).get('chat') or slug
        except Exception:
            pass
    if not slug:
        print('could not work out the chat slug — pass --chat', file=sys.stderr)
        return 2

    thread = api('/api/chatfeed/thread?chat=%s&limit=1000' % urllib.parse.quote(slug))
    msgs = thread.get('messages') or thread.get('items') or []
    posted = Counter(norm(m.get('text')) for m in msgs if m.get('from') == 'sophie')

    missing = []
    for m in every:
        k = norm(m['text'])
        if posted.get(k):
            posted[k] -= 1
            continue
        missing.append(m)

    if args.json:
        print(json.dumps({'chat': slug, 'total': len(every), 'missing': missing}, indent=1))
    else:
        print('chat:          %s' % slug)
        print('her messages:  %d in the transcript' % len(every))
        print('missing:       %d' % len(missing))
        for m in missing:
            print('  --- %s' % m['at'])
            print('      %r' % m['text'][:200])

    if missing and args.apply:
        done = 0
        for m in missing:
            try:
                api('/api/chatfeed/reply', {'chat': slug, 'session': sid, 'from': 'sophie',
                                            'text': m['text'][:8000], 'created': m['at']})
                done += 1
            except Exception as e:
                print('  post failed (%s): %s' % (m['at'], e), file=sys.stderr)
        print('backfilled: %d of %d' % (done, len(missing)))
    elif missing:
        print('\nre-run with --apply to post these into the chat')
    return 0


if __name__ == '__main__':
    sys.exit(main())
