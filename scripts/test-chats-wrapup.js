#!/usr/bin/env node
// THE ARCHIVE WRAP-UP (Aug 2026, Sophie: "whenever I'm about to archive a chat
// the last message of the chat is them explaining what the chat was about and
// what went down … and that could go into the note at the top").
//
// Measured the day she asked: 73 of her 88 archived chats showed nothing but a
// name. The obstacle is that a chat is ASLEEP by the time she archives it, so
// the wrap-up has to be written ahead and frozen on the way past.
//
// Two things this pins, because each breaks silently:
//   1. archiving freezes the Update card into a wrap-up — and NEVER invents one
//      or overwrites one the chat wrote itself;
//   2. her own note still wins the row line.
// Run: node scripts/test-chats-wrapup.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let fails = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : ''));
}

// ── the server's freeze rule, lifted out of chatfeed.js and run ─────────────
const src = fs.readFileSync(path.join(ROOT, 'chatfeed.js'), 'utf8');
function lift(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('chatfeed.js has no ' + name + '()');
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  throw new Error('unbalanced ' + name);
}
const frozenWrapUp = new Function(
  'const wrapLineOf=(s)=>String(s||"").replace(/\\s+/g," ").trim().slice(0,200);'
  + 'const wrapTextOf=(s)=>String(s||"").replace(/[ \\t]+/g," ").trim().slice(0,2000);'
  + lift('frozenWrapUp') + ' return frozenWrapUp;')();

console.log('freezing the Update card on the way into the archive');
{
  const r = { updAsked: 'Fix the hook so turns post', updDid: 'Shipped v14 and cleaned the feed' };
  const w = frozenWrapUp(r);
  ok('a chat with an Update card gets a wrap-up', !!w);
  ok('the row line is what it DID, not what she asked',
    w.wrapLine === 'Shipped v14 and cleaned the feed', w && w.wrapLine);
  ok('the full text carries both halves',
    w.wrapUp.indexOf('Fix the hook') > -1 && w.wrapUp.indexOf('Shipped v14') > -1);
  ok('it records where it came from', w.wrapFrom === 'update-card');
}

console.log('what it must NOT do');
{
  ok('a chat with nothing to say gets nothing invented',
    frozenWrapUp({}) === null);
  ok('…and neither does one with only empty strings',
    frozenWrapUp({ updAsked: '   ', updDid: '' }) === null);
  ok('a wrap-up the CHAT wrote is never overwritten',
    frozenWrapUp({ wrapUp: 'mine', updDid: 'something else' }) === null);
  ok('…nor is one that only has the line',
    frozenWrapUp({ wrapLine: 'mine', updDid: 'something else' }) === null);
  ok('a null registry doc is handled', frozenWrapUp(null) === null);
}

console.log('falling back to the status card');
{
  const w = frozenWrapUp({ statusDoing: 'six lesson cards, drawing now' });
  ok('a chat with only a status line still gets a wrap-up', !!w);
  ok('the line is that status', w.wrapLine === 'six lesson cards, drawing now');
  ok('the full text says it was mid-flight', w.wrapUp.indexOf('Was working on') === 0, w.wrapUp);
}

console.log('caps');
{
  const w = frozenWrapUp({ updDid: 'x'.repeat(500) });
  ok('the row line is capped at 200', w.wrapLine.length === 200, String(w.wrapLine.length));
  ok('the full text is kept whole up to its own cap', w.wrapUp.length > 200);
}

// ── the page's row line, lifted out of chats.html and run ──────────────────
const html = fs.readFileSync(path.join(ROOT, 'public/chats.html'), 'utf8');
function liftHtml(name) {
  const i = html.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('chats.html has no ' + name + '()');
  let d = 0;
  for (let k = html.indexOf('{', i); k < html.length; k++) {
    if (html[k] === '{') d++;
    else if (html[k] === '}' && --d === 0) return html.slice(i, k + 1);
  }
  throw new Error('unbalanced ' + name);
}
let chats = {};
const statusLines = new Function('getChats',
  'var chats;' + liftHtml('statusLines').replace(/chats\[name\]/g, 'getChats()[name]')
  + ' return statusLines;')(() => chats);
const pick = (n) => { const s = statusLines(n); return s.note || s.wrap || s.need || s.doing || ''; };

console.log('the row line');
{
  chats = { a: { wrapLine: 'built the cutter', statusNeed: 'pick a palette' } };
  ok('a wrap-up beats a live ask on an archived chat', pick('a') === 'built the cutter');
  chats = { a: { sophieNote: 'mine', wrapLine: 'built the cutter' } };
  ok('HER note still wins over the wrap-up', pick('a') === 'mine');
  chats = { a: { statusNeed: 'pick a palette' } };
  ok('a chat with no wrap-up is unchanged', pick('a') === 'pick a palette');
  chats = { a: {} };
  ok('nothing to say stays blank', pick('a') === '');
}

// ── what was still OPEN, the second half of her ask ────────────────────────
// Sophie, 2026-08-15: "a quick summary of what we accomplished in that chat,
// and if there were still any questions that were open". The open half is
// DERIVED from the thread (questions.js pairs every question she asked with the
// reply that followed) and handed to the model as fact, so the line names
// questions that provably went unanswered instead of plausible-sounding ones.
console.log('the open-questions half');
{
  const route = src.slice(src.indexOf("router.post('/wrapup/write'"));
  ok('the route asks for an `open` field', /"open":/.test(WRAP_SYS_TEXT()));
  ok('and tells it to leave that empty rather than invent a loose end',
     /Empty string when the chat genuinely ended settled/.test(WRAP_SYS_TEXT()));
  ok('the unanswered questions are derived, not read out of the digest',
     /buildQuestions\(msgs\)\.filter\(\(q\) => !q\.answer\)/.test(route));
  ok('they are handed over as facts, labelled',
     /Questions Sophie asked that nobody ever answered/.test(route));
  ok('a rewrite CLEARS a stale loose end instead of leaving it',
     /wrapOpen: open \|\| admin\.firestore\.FieldValue\.delete\(\)/.test(route));

  // The row line is untouched by it: `wrapOpen` lives behind the expander, so
  // her note and the summary line keep their old precedence exactly.
  chats = { a: { wrapLine: 'built the button', wrapOpen: 'which field it lands in' } };
  ok('the row line is still the summary, never the loose end', pick('a') === 'built the button');
  chats = { a: { sophieNote: 'mine', wrapLine: 'built the button', wrapOpen: 'x' } };
  ok('and HER note still wins over both', pick('a') === 'mine');
}
// ── the truncation rescue ──────────────────────────────────────────────────
// FOUND LIVE 2026-08-15, in her hands: the sheet answered "Claude did not
// return parseable JSON (got: {"line":"Built the Chunking clip-library tool and
// baked its first real clips from the movies","text":"Sophie wanted a li)".
// Nothing was wrong with the summary — max_tokens cut the JSON off mid-string,
// and an unclosed brace fails BOTH of parseJSON's attempts, so a finished line
// was thrown away with the unfinished sentence.
console.log('a summary that got cut off');
{
  const salvageJson = new Function(lift('salvageJson') + ' return salvageJson;')();
  const REAL = '{"line":"Built the Chunking clip-library tool and baked its first real'
    + ' clips from the movies","text":"Sophie wanted a li';
  const r = salvageJson(REAL);
  ok('her actual failed answer is rescued', !!r && !!r.line);
  ok('…with the line whole', r.line === 'Built the Chunking clip-library tool and'
    + ' baked its first real clips from the movies', String(r && r.line));
  ok('…and the half-written sentence kept for the route to trim', r.text === 'Sophie wanted a li');
  ok('cut off mid-KEY still yields the fields that finished',
    JSON.stringify(salvageJson('{"line":"a","tex')) === '{"line":"a"}');
  ok('cut off right after a comma', JSON.stringify(salvageJson('{"line":"a","text":"b",'))
    === '{"line":"a","text":"b"}');
  ok('an open ARRAY is closed as an array, not a brace',
    JSON.stringify(salvageJson('{"line":"a","l":[1,2')) === '{"line":"a","l":[1,2]}');
  ok('a whole answer is untouched', JSON.stringify(salvageJson('{"line":"a","text":"b"}'))
    === '{"line":"a","text":"b"}');
  ok('a refusal with no JSON in it rescues NOTHING rather than inventing',
    salvageJson('I cannot summarise that') === null);
  ok('and the cap has real headroom now', /maxTokens: 1200/.test(src));
}

function WRAP_SYS_TEXT() {
  const i = src.indexOf('const WRAP_SYS =');
  return src.slice(i, src.indexOf('`;', i));
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
