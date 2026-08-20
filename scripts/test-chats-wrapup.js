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
// `admin` is stubbed so a deleted field is a value the test can recognise —
// the freeze CLEARS an answer it does not have rather than writing "".
const DEL = '<<delete>>';
const frozenWrapUp = new Function(
  'const admin={firestore:{FieldValue:{delete:()=>' + JSON.stringify(DEL) + '}}};'
  + 'const wrapLineOf=(s)=>String(s||"").replace(/\\s+/g," ").trim().slice(0,200);'
  + 'const wrapTextOf=(s)=>String(s||"").replace(/[ \\t]+/g," ").trim().slice(0,2000);'
  + 'const wrapPartOf=(s)=>String(s||"").replace(/\\s+/g," ").trim().slice(0,200);'
  + 'const wrapProse=(a,d,n)=>wrapTextOf([a,d,n].map((s)=>String(s||"").trim())'
  + '.filter(Boolean).join(" "));'
  + lift('frozenWrapUp') + ' return frozenWrapUp;')();

console.log('freezing the Update card on the way into the archive');
{
  const r = {
    updAsked: 'Fix the hook so turns post',
    updDid: 'Shipped v14 and cleaned the feed',
    updNext: 'Watch whether the old chats heal',
  };
  const w = frozenWrapUp(r);
  ok('a chat with an Update card gets a wrap-up', !!w);
  ok('the row line is what it DID, not what she asked',
    w.wrapLine === 'Shipped v14 and cleaned the feed', w && w.wrapLine);
  // THE SUMMARY IS THE UPDATE CARD'S THREE QUESTIONS (Aug 2026, Sophie: "what
  // I really wanted was the what you asked, what I did, and next steps … chat
  // already answered those three questions"). So the freeze is a copy, not a
  // translation — nothing is rephrased on the way in.
  ok('what she asked is copied across verbatim', w.wrapAsked === r.updAsked, w.wrapAsked);
  ok('…and what it did', w.wrapDid === r.updDid, w.wrapDid);
  ok('…and what is next', w.wrapNext === r.updNext, w.wrapNext);
  ok('the prose mirror carries all three, for an older cached page',
    w.wrapUp.indexOf('Fix the hook') > -1 && w.wrapUp.indexOf('Shipped v14') > -1
    && w.wrapUp.indexOf('Watch whether') > -1, w.wrapUp);
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
  // A status line says what the chat was in the middle of — that is the
  // what-it-did answer and nothing else, so the other two stay empty rather
  // than being filled with the same sentence under a different question.
  ok('it lands under what it did', w.wrapDid === 'six lesson cards, drawing now', w.wrapDid);
  ok('nothing is invented for what she asked', w.wrapAsked === DEL, String(w.wrapAsked));
  ok('…nor for what is next', w.wrapNext === DEL, String(w.wrapNext));
}

console.log('caps');
{
  const w = frozenWrapUp({ updDid: 'x'.repeat(500) });
  ok('the row line is capped at 200', w.wrapLine.length === 200, String(w.wrapLine.length));
  ok('each answer is capped too', w.wrapDid.length === 200, String(w.wrapDid.length));
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

// ── the page's own reading of the three answers ────────────────────────────
// The summary she opens IS the three questions now, and where a chat never
// wrote a wrap-up it falls back to the Update card it already posts — the same
// three answers, which is exactly what she pointed at ("chat already answered
// those three questions").
const wrapParts = new Function(liftHtml('wrapParts') + ' return wrapParts;')();
const wrapLine = new Function('wrapParts', liftHtml('wrapLineOf') + ' return wrapLineOf;')(wrapParts);

console.log('what the summary reads');
{
  const p = wrapParts({ wrapAsked: 'a', wrapDid: 'b', wrapNext: 'c', updDid: 'the last turn' });
  ok('the wrap-up answers win over the live Update card', p && p.did === 'b', p && p.did);

  const old = wrapParts({ wrapUp: 'A prose summary from before this shape.', updDid: 'the last turn' });
  ok('a prose wrap-up written before this shape still reads as itself', old === null);

  const upd = wrapParts({ updAsked: 'fix the hook', updDid: 'shipped v14', updNext: 'watch it' });
  ok('a chat with no wrap-up falls back to its Update card', !!upd && upd.asked === 'fix the hook');

  ok('a chat with neither has no summary', wrapParts({ statusNeed: 'pick a palette' }) === null);
  ok('an empty Update card is not a summary',
    wrapParts({ updAsked: '  ', updDid: '' }) === null);

  ok('the line is the summary line when there is one',
    wrapLine({ wrapLine: 'built the cutter', wrapDid: 'shipped it' }) === 'built the cutter');
  ok('…else what it DID, so an Update card alone still shows a line',
    wrapLine({ updAsked: 'fix the hook', updDid: 'shipped v14' }) === 'shipped v14');
  ok('…and nothing to say draws nothing', wrapLine({}) === '');
}

// ── THE THREE QUESTIONS, and the loose ends folded into the third ──────────
// Sophie, 2026-08-20: "what I really wanted was the what you asked, what I did,
// and next steps … could you just switch the summary for that" — and shorter,
// "each of the three sections is about two sentences that's six sentences in
// total. I'd prefer to be about three sentences."
//
// Her earlier ask is still answered, in the third one: "a quick summary of what
// we accomplished in that chat, and if there were still any questions that were
// open". Those open questions are DERIVED from the thread (questions.js pairs
// every question she asked with the reply that followed) and handed to the
// model as fact, so `next` names loose ends that provably exist.
console.log('the three questions');
{
  const route = src.slice(src.indexOf("router.post('/wrapup/write'"));
  ok('the summary is asked for as her three questions',
     /"asked":/.test(WRAP_SYS_TEXT()) && /"did":/.test(WRAP_SYS_TEXT())
     && /"next":/.test(WRAP_SYS_TEXT()));
  ok('…and a `long` one behind them', /"long":/.test(WRAP_SYS_TEXT()));
  // THREE SENTENCES IN TOTAL, one per answer — the prose summary before this
  // ran two sentences a section, which is the six she asked to be rid of. Each
  // is capped in CHARACTERS as well, the lesson the old short summary taught:
  // a sentence count alone came back at 374 characters.
  ok('the whole summary is three sentences, one per answer',
     /ONE SENTENCE EACH, three sentences in total/.test(WRAP_SYS_TEXT()));
  ok('…stated as a hard limit, not a target',
     /hard limit, not a target/.test(WRAP_SYS_TEXT()));
  ok('…and each answer is capped in characters too',
     (WRAP_SYS_TEXT().match(/ONE SENTENCE, under 140 characters/g) || []).length === 3);
  ok('the answers are asked for BEFORE the long one, so a cut loses the long one',
     WRAP_SYS_TEXT().indexOf('"next":') < WRAP_SYS_TEXT().indexOf('"long":'));
  ok('a small chat may have no long version at all',
     /let the three sentences be the whole answer/.test(WRAP_SYS_TEXT()));
  ok('the answer never repeats its own question back',
     /Do not repeat the question inside its own answer/.test(WRAP_SYS_TEXT()));
  ok('and tells it to leave `next` empty rather than invent a loose end',
     /EMPTY STRING when the chat genuinely ended settled/.test(WRAP_SYS_TEXT()));
  ok('the unanswered questions are derived, not read out of the digest',
     /buildQuestions\(msgs\)\.filter\(\(q\) => !q\.answer\)/.test(route));
  ok('they are handed over as facts, labelled',
     /Questions Sophie asked that nobody ever answered/.test(route));
  // `next` IS the loose-ends line now, so the old field is cleared outright —
  // two fields answering one question would show her the same unfinished
  // business twice under different headings.
  ok('a rewrite CLEARS the old separate open field', /wrapOpen: del,/.test(route));
  ok('a long version identical to the short one is not stored twice',
     /wrapLong: \(long && long !== prose\)/.test(route));
  ok('the prose mirror is still written for an older cached page',
     /wrapUp: prose,/.test(route));

  // BULLETS (Aug 2026, Sophie: "I would like bullet points especially for the
  // long summary … the long summary is one block of text would be great to see
  // them separated"). The model is asked for an ARRAY, and the array is what
  // makes the split reliable — re-splitting a paragraph on punctuation breaks
  // on every abbreviation and file name. Stored newline-joined so the field
  // stays a plain string and the one already written as a paragraph still reads.
  ok('the long one is asked for as an ARRAY of points',
     /"long": AN ARRAY OF SHORT POINTS/.test(WRAP_SYS_TEXT()));
  ok('…one point per distinct thing that happened',
     /One point per distinct thing that happened/.test(WRAP_SYS_TEXT()));
  ok('…and it must not chop one thought up to fill a list',
     /SPLIT ONLY WHERE THE WORK ACTUALLY SPLIT/.test(WRAP_SYS_TEXT()));
  ok('a small chat returns an empty array rather than padding one',
     /return an empty array/.test(WRAP_SYS_TEXT()));
  ok('the array is stored newline-joined, so the field stays a plain string',
     /Array\.isArray\(out && out\.long\)/.test(route) && /\.join\('\\n'\)/.test(route));
  ok('a truncated answer trims the long half as well as the short one',
     /out\.text = backToSentence\(out\.text\)/.test(route)
     && /out\.long = Array\.isArray\(out\.long\)/.test(route)
     && /backToSentence\(out\.long\)/.test(route));
  // Each answer is ONE sentence, so there is nothing to trim it back TO — a
  // rescued half-sentence is dropped whole rather than shown ending mid-word.
  ok('a half-written answer is dropped rather than trimmed',
     /\['asked', 'did', 'next'\]\.forEach/.test(route));

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
  // The long half is a list of points now, so a cut lands mid-POINT: the
  // finished ones are kept and the half-written one is dropped by the route,
  // rather than showing her a bullet that stops mid-word.
  {
    const cut = salvageJson('{"line":"a","long":["Built the thing.","Cost about a ce');
    const kept = (cut.long || []).filter((x) => /[.!?]\s*$/.test(String(x || '').trim()));
    ok('a list cut mid-point keeps the points that finished',
      JSON.stringify(kept) === '["Built the thing."]', JSON.stringify(cut.long));
  }
  ok('a refusal with no JSON in it rescues NOTHING rather than inventing',
    salvageJson('I cannot summarise that') === null);
  ok('and the cap has real headroom now', /maxTokens: 1500/.test(src));
}

function WRAP_SYS_TEXT() {
  const i = src.indexOf('const WRAP_SYS =');
  return src.slice(i, src.indexOf('`;', i));
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
