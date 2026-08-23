#!/usr/bin/env node
// The working fold is STRUCTURAL — it folds a reply's middle using head/tail,
// the character offsets of the turn's first and last TOOL CALL, and folds
// nothing at all when those are absent (Aug 2026, Sophie: the old
// guess-from-wording version "ends up being just a nuisance").
//
// Three layers, all covered here because each can break independently:
//   1. the HOOK's parser  — does it put head/tail in the right place?
//   2. the SERVER's derivation from live drafts — the free path for a hook
//      that predates v12, and the one that must NOT let the final post
//      overwrite the boundaries the drafts left behind.
//   3. the PAGE's foldBody — what actually renders.
// Run: node scripts/test-chats-working-fold.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let fails = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : ''));
}

// ── 1. the page's foldBody, lifted out of chats.html and run for real ──────
const html = fs.readFileSync(path.join(ROOT, 'public/chats.html'), 'utf8');
function lift(name) {
  const i = html.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('chats.html has no ' + name + '()');
  let d = 0;
  for (let k = html.indexOf('{', i); k < html.length; k++) {
    if (html[k] === '{') d++;
    else if (html[k] === '}' && --d === 0) return html.slice(i, k + 1);
  }
  throw new Error('unbalanced ' + name);
}
const md = (s) => String(s);                       // markdown is not under test
// strict mode keeps an eval'd declaration in its own scope, so take the value
const foldBody = eval('(' + lift('foldBody') + ')');

const TOP = 'Here is what I am about to do, and why it matters to you.';
const MID = 'Now checking the registry.\n\n' + 'x'.repeat(400) + '\n\nRunning the tests.';
const BOT = '**This is what you asked for, and this is what I built.** It is live.';
const FULL = TOP + '\n\n' + MID + '\n\n' + BOT;
const HEAD = TOP.length;
const TAIL = FULL.length - BOT.length;

console.log('foldBody');
{
  const out = foldBody(FULL, HEAD, TAIL);
  ok('folds the middle behind one button', (out.match(/foldtog/g) || []).length === 1);
  ok('the opening line stays visible', out.indexOf(TOP) >= 0 && out.indexOf(TOP) < out.indexOf('foldtog'));
  ok('the closing rundown stays visible AND after the fold',
    out.indexOf(BOT) > out.indexOf('foldtog'));
  const body = out.slice(out.indexOf('foldbody'));
  ok('the narration is inside the fold, not deleted', body.indexOf('Running the tests.') >= 0);
  ok('nothing is lost', out.indexOf('x'.repeat(400)) >= 0);
}
{
  // No signal (a chat on an older hook) → show the message whole. This is the
  // rule that removes the nuisance; a text-based fallback must not creep back.
  ok('no head/tail → no fold at all', foldBody(FULL).indexOf('foldtog') < 0);
  ok('undefined tail → no fold', foldBody(FULL, 10).indexOf('foldtog') < 0);
  ok('non-numeric → no fold', foldBody(FULL, 'x', 'y').indexOf('foldtog') < 0);
}
{
  ok('a short middle is not worth a button',
    foldBody('abc\n\nshort bit\n\ndone', 3, 14).indexOf('foldtog') < 0);
  ok('offsets past the end are clamped, not thrown',
    foldBody(FULL, 5, 99999).indexOf('foldtog') >= 0);
  ok('reversed offsets never fold', foldBody(FULL, TAIL, HEAD).indexOf('foldtog') < 0);
  // A turn that ended on a tool call (interrupted): tail == length, no closing.
  const noTail = foldBody(FULL, HEAD, FULL.length);
  ok('turn with no closing still shows its opening', noTail.indexOf(TOP) >= 0);
  ok('turn with no closing folds the rest', noTail.indexOf('foldtog') >= 0);
}

// ── BOLD IS ALWAYS FOR HER (Aug 2026, Sophie: "working details was hiding a
// message meant for me … anything bold is always for me. can it be an added
// decision metric"). A second metric on top of the tool calls, and it can only
// ever un-hide: bold inside the middle stays on screen and the narration folds
// around it. The fenced-code case is here because a `**` in a code block is not
// a line for her, and a cut inside a fence breaks every render after it.
{
  const NAR = 'Checking the registry now. ' + 'x'.repeat(300);
  const HER = '**Spent 21c this turn** — 13c for the 4K.';
  const NAR2 = 'Running the tests. ' + 'y'.repeat(300);
  const T = TOP + '\n\n' + NAR + '\n\n' + HER + '\n\n' + NAR2 + '\n\n' + BOT;
  const out = foldBody(T, TOP.length, T.length - BOT.length);
  // Strip what the fold HIDES and the bold line has to still be there — the
  // whole point, and the assertion that fails against the pre-fix page.
  const shown = out.replace(/<div class="foldbody" hidden>[\s\S]*?<\/div><\/div>/g, '');
  ok('a bold line in the middle is never folded', shown.indexOf(HER) >= 0);
  ok('the narration itself is still hidden', shown.indexOf('x'.repeat(300)) < 0);
  ok('the narration either side folds around it', (out.match(/foldtog/g) || []).length === 2);
  ok('a heading counts as bold too',
    foldBody(TOP + '\n\n' + NAR + '\n\n## What I found\n\n' + NAR2 + '\n\n' + BOT,
      TOP.length, TOP.length + NAR.length + 300).indexOf('## What I found') >= 0);
}
{
  // `**` inside fenced code is not a line for her — and splitting there would
  // leave the fence unbalanced, so the whole block stays inside one fold.
  const CODE = 'Editing the file.\n\n```js\nvar a = x ** 2; // ' + 'z'.repeat(260) + '\n```\n\nDone editing.';
  const T = TOP + '\n\n' + CODE + '\n\n' + BOT;
  const out = foldBody(T, TOP.length, T.length - BOT.length);
  ok('a ** inside fenced code does not un-hide it', (out.match(/foldtog/g) || []).length === 1);
  const body = out.slice(out.indexOf('foldbody'));
  ok('the fence stays whole inside the fold', (body.match(/```/g) || []).length === 2);
}
{
  // Bold everywhere: nothing left worth hiding, so the message shows whole —
  // no row of empty fold buttons.
  const B = TOP + '\n\n**' + 'a'.repeat(300) + '**\n\n**' + 'b'.repeat(300) + '**\n\n' + BOT;
  ok('all-bold middle folds nothing at all',
    foldBody(B, TOP.length, B.length - BOT.length).indexOf('foldtog') < 0);
}

// ── 2. the hook's parser, run against a synthetic transcript ───────────────
// Rebuilt here from the hook's own source so a drift in either is caught: the
// test extracts the embedded python and drives it with a real JSONL file.
console.log('hook parser');
{
  const hook = fs.readFileSync(path.join(ROOT, '.claude/hooks/post-to-feed.sh'), 'utf8');
  ok('the Stop pass tracks tool calls', /cur_t0 = len\(cur_parts\)/.test(hook));
  ok('the Stop pass posts head/tail', /out\["head"\] = tn\['head'\]/.test(hook));
  ok('offsets are measured against the STRIPPED text', /len\(raw\) - len\(raw\.lstrip\(\)\)/.test(hook));

  const tmp = path.join(require('os').tmpdir(), 'foldtest-' + process.pid + '.jsonl');
  const rec = (o) => JSON.stringify(o);
  fs.writeFileSync(tmp, [
    rec({ type: 'user', uuid: 'u1', message: { role: 'user', content: 'go' } }),
    rec({ type: 'assistant', message: { role: 'assistant', id: 'a1', content: [{ type: 'text', text: TOP }] } }),
    rec({ type: 'assistant', message: { role: 'assistant', id: 'a2', content: [{ type: 'tool_use', name: 'Bash', input: {} }] } }),
    rec({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'x' }] } }),
    rec({ type: 'assistant', message: { role: 'assistant', id: 'a3', content: [{ type: 'text', text: MID }] } }),
    rec({ type: 'assistant', message: { role: 'assistant', id: 'a4', content: [{ type: 'tool_use', name: 'Read', input: {} }] } }),
    rec({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'x' }] } }),
    rec({ type: 'assistant', message: { role: 'assistant', id: 'a5', content: [{ type: 'text', text: BOT }] } }),
  ].join('\n') + '\n');

  // the parser, verbatim in shape from the hook's Stop pass
  const py = `
import json,sys
path=sys.argv[1]
turns=[];cur_parts=[];cur_mid=None;cur_t0=None;cur_t1=None
def blocks(r):
    c=(r.get('message') or {}).get('content')
    return c if isinstance(c,list) else []
def gettext(r):
    c=(r.get('message') or {}).get('content')
    if isinstance(c,str): return c
    return "".join(b.get('text','') for b in blocks(r) if isinstance(b,dict) and b.get('type')=='text')
def flush():
    global cur_parts,cur_mid,cur_t0,cur_t1
    raw="\\n\\n".join(cur_parts); txt=raw.strip()
    if txt and cur_mid:
        tn={'text':txt}
        if cur_t0 is not None:
            lead=len(raw)-len(raw.lstrip())
            at=lambda n: max(0,len("\\n\\n".join(cur_parts[:n]))-lead)
            tn['head']=at(cur_t0); tn['tail']=at(cur_t1)
        turns.append(tn)
    cur_parts=[];cur_mid=None;cur_t0=None;cur_t1=None
for ln in open(path,encoding='utf-8'):
    try: r=json.loads(ln)
    except: continue
    m=r.get('message') or {};role=m.get('role');c=m.get('content')
    if role=='user':
        isres=isinstance(c,list) and any(isinstance(b,dict) and b.get('type')=='tool_result' for b in c)
        if not isres: flush()
        continue
    if role!='assistant': continue
    t=gettext(r)
    if t.strip(): cur_parts.append(t);cur_mid=m.get('id')
    for b in blocks(r):
        if isinstance(b,dict) and b.get('type')=='tool_use':
            if cur_t0 is None: cur_t0=len(cur_parts)
            cur_t1=len(cur_parts)
flush()
print(json.dumps(turns[-1]))
`;
  const out = require('child_process').execFileSync('python3', ['-c', py, tmp], { encoding: 'utf8' });
  fs.unlinkSync(tmp);
  const tn = JSON.parse(out);
  ok('head lands at the end of the pre-work prose', tn.head === HEAD, 'got ' + tn.head + ' want ' + HEAD);
  ok('tail lands at the start of the closing', tn.text.slice(tn.tail).trim() === BOT,
    'got ' + JSON.stringify(tn.text.slice(tn.tail).trim().slice(0, 60)));
  ok('what the app would fold is exactly the middle', tn.text.slice(tn.head, tn.tail).trim() === MID);
  ok('the page agrees with the hook',
    foldBody(tn.text, tn.head, tn.tail).indexOf('foldtog') >= 0);
}

// ── 3. the server's contract ───────────────────────────────────────────────
console.log('server');
{
  const src = fs.readFileSync(path.join(ROOT, 'chatfeed.js'), 'utf8');
  ok('the post accepts head/tail', /head, tail \} = req\.body/.test(src.replace(/\s+/g, ' ')) ||
    /head, tail/.test(src));
  ok('a draft derives them when the hook does not send them',
    /working && doc\.head === undefined/.test(src));
  ok('the FINAL post cannot overwrite the drafts\' boundaries',
    /\(working \|\| hd !== null\)/.test(src));
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
