#!/usr/bin/env node
/**
 * A turn STARTED BY A BACKGROUND EVENT must post as its own message.
 *
 *   node scripts/test-chats-turn-after-wake.js
 *
 * The bug this pins (measured 2026-08-14). The hook ends a turn only on
 * something Sophie actually said; a `<task-notification>` is deliberately not a
 * boundary, because treating one as a boundary mid-reply once re-keyed a turn
 * and merged it into the previous message. But when a background job finishes
 * and drives a whole new turn, refusing to break there is just as wrong the
 * other way: the new reply accumulates onto the previous turn's text and posts
 * under the previous turn's key, so the server UPSERTS it onto a message she
 * has already read. Her report was "your last message didn't show up" — and it
 * had not: it was sitting at character 4,862 of a 6,056-character message from
 * the day before. No new message, no unread dot, no push.
 *
 * The distinguishing signal is whether the reply above the machine record has
 * ALREADY BEEN POSTED. Mid-reply, it has not (the turn is still in flight).
 * When a background event starts a new turn, it has.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let bad = 0;
const ok = (name, cond) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) bad++; };

const hook = fs.readFileSync(path.join(ROOT, '.claude/hooks/post-to-feed.sh'), 'utf8');

console.log('the hook source');
ok('the posted set is read before the parse loop',
  hook.indexOf("posted = set(x for x in open(sf)") < hook.indexOf('sends = []; idx = 0'));
ok('a machine record breaks the turn once the reply above it is posted',
  /if cur_mid and cur_mid in posted:\s*\n\s*flush\(\)/.test(hook));
ok('it still refuses to break a turn that is in flight',
  /never re-keys a turn IN FLIGHT/.test(hook));

/* The boundary rule, run for real. Both variants share one transcript: an
   assistant reply that has already been posted, then a task notification, then
   a second reply. OLD welds them into one turn; NEW yields two. */
function turns(useFix, postedIds) {
  const py = `
import json,sys
rows=[json.loads(l) for l in open(sys.argv[1]) if l.strip()]
posted=set(${JSON.stringify([...postedIds])})
USE_FIX=${useFix ? 'True' : 'False'}
MACHINE=('<task-notification','[SYSTEM NOTIFICATION')
turns=[];cur=[];cur_mid=None;cur_key=None
def txt(r):
    c=(r.get('message') or {}).get('content')
    if isinstance(c,str): return c
    return ' '.join(b.get('text','') for b in (c or []) if isinstance(b,dict) and b.get('type')=='text')
def hers(r):
    t=txt(r).strip()
    return '' if (not t or t.startswith(MACHINE)) else t
def flush():
    global cur,cur_mid
    if cur and cur_mid: turns.append({'text':' '.join(cur),'mid':cur_mid,'turn':cur_key})
    cur=[];cur_mid=None
for r in rows:
    role=(r.get('message') or {}).get('role')
    if role=='user':
        c=(r.get('message') or {}).get('content')
        if isinstance(c,list) and any(isinstance(b,dict) and b.get('type')=='tool_result' for b in c): continue
        if not hers(r):
            if USE_FIX and cur_mid and cur_mid in posted:
                flush(); cur_key=r.get('uuid')
            continue
        flush(); cur_key=r.get('uuid'); continue
    if role!='assistant': continue
    t=txt(r)
    if t.strip():
        cur.append(t); cur_mid=(r.get('message') or {}).get('id')
flush()
print(json.dumps(turns))
`;
  const f = path.join(os.tmpdir(), `waketest-${process.pid}.jsonl`);
  const rec = (o) => JSON.stringify(o);
  fs.writeFileSync(f, [
    rec({ type: 'user', uuid: 'u1', message: { role: 'user', content: 'make the film' } }),
    rec({ type: 'assistant', message: { role: 'assistant', id: 'a1', content: [{ type: 'text', text: 'FIRST REPLY' }] } }),
    rec({ type: 'user', uuid: 'w1', message: { role: 'user', content: '<task-notification>job done</task-notification>' } }),
    rec({ type: 'assistant', message: { role: 'assistant', id: 'a2', content: [{ type: 'text', text: 'SECOND REPLY' }] } }),
  ].join('\n') + '\n');
  const r = spawnSync('python3', ['-c', py, f], { encoding: 'utf8' });
  fs.unlinkSync(f);
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
}

console.log('\nthe boundary rule');
const before = turns(false, ['a1']);
ok('WITHOUT the fix the two replies weld into one turn', before.length === 1);
ok('…and that one turn carries the second reply inside it',
  before.length === 1 && /FIRST REPLY SECOND REPLY/.test(before[0].text));

const after = turns(true, ['a1']);
ok('WITH the fix the background-started reply is its own turn', after.length === 2);
ok('…the first turn is untouched', after[0] && after[0].text === 'FIRST REPLY');
ok('…the second carries only the new reply', after[1] && after[1].text === 'SECOND REPLY');
ok('…and it is keyed to the event that started it, so it cannot upsert onto the old message',
  after[1] && after[1].turn === 'w1' && after[0].turn === 'u1');

const inflight = turns(true, []);   // nothing posted yet → the turn is still running
ok('a wake arriving MID-REPLY still does not split it', inflight.length === 1);

console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
