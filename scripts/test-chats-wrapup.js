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
// …and the one-line consts beside them, so the test runs the REAL rules rather
// than a second copy of them.
function liftLine(name) {
  const m = new RegExp('^const ' + name + ' = .*$', 'm').exec(src);
  if (!m) throw new Error('chatfeed.js has no const ' + name);
  return m[0] + '\n';
}
// `admin` is stubbed so a deleted field is a value the test can recognise —
// the freeze CLEARS an answer it does not have rather than writing "".
const DEL = '<<delete>>';
const frozenWrapUp = new Function(
  'const admin={firestore:{FieldValue:{delete:()=>' + JSON.stringify(DEL) + '}}};'
  + 'const wrapLineOf=(s)=>String(s||"").replace(/\\s+/g," ").trim().slice(0,200);'
  + 'const wrapTextOf=(s)=>String(s||"").replace(/[ \\t]+/g," ").trim().slice(0,2000);'
  + 'const WRAP_PART_MAX=200;' + lift('wrapPartOf')
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
  // 200 plus the ellipsis the cut adds — the cap is on the words, not the mark.
  ok('each answer is capped too', w.wrapDid.length === 201 && /…$/.test(w.wrapDid),
    String(w.wrapDid.length));
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
const onePart = new Function('var WRAP_PART_MAX=200;' + liftHtml('onePart')
  + ' return onePart;')();
const herAskPage = new Function('var HER_ASK_MAX=200;' + liftHtml('herAsk')
  + ' return herAsk;')();
const wrapParts = new Function('onePart', 'herAsk',
  liftHtml('wrapParts') + ' return wrapParts;')(onePart, herAskPage);
const wrapLine = new Function('wrapParts', liftHtml('wrapLineOf') + ' return wrapLineOf;')(wrapParts);
const wrapLineIsAsk = new Function('wrapParts',
  liftHtml('wrapLineIsAsk') + ' return wrapLineIsAsk;')(wrapParts);
const wrapHasMore = new Function('wrapParts', liftHtml('wrapHasMore') + ' return wrapHasMore;')(wrapParts);

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

  // THE LINE IS WHAT SHE ASKED FOR (Aug 2026, Sophie: "4 the default line just
  // use what you asked and then the arrow shows the next two bolded fields").
  // It used to be `wrapLine`, then what the chat DID — and on a chat with no
  // wrap-up that put the identical sentence on the line and under "What I did".
  ok('the line is what she ASKED for',
    wrapLine({ wrapLine: 'built the cutter', wrapAsked: 'a cutter for her tape',
      wrapDid: 'shipped it' }) === 'a cutter for her tape');
  ok('an Update card alone puts its ASKED on the line, not its did',
    wrapLine({ updAsked: 'fix the hook', updDid: 'shipped v14' }) === 'fix the hook');
  ok('no three answers → the summary line a chat wrote still holds',
    wrapLine({ wrapLine: 'built the cutter', wrapUp: 'A prose one.' }) === 'built the cutter');
  ok('…and nothing to say draws nothing', wrapLine({}) === '');
  // The line can never repeat what is behind the arrow.
  ok('asked alone opens onto nothing, so no arrow is drawn',
    wrapHasMore({ wrapAsked: 'a cutter for her tape' }) === false);
  ok('did or next is something to open',
    wrapHasMore({ wrapAsked: 'a', wrapDid: 'b' }) === true);
}

// ── ONE SENTENCE, CUT IN CODE (Aug 2026, Sophie: "I thought that each of the
// questions was supposed to be just one sentence but the middle question is
// longer" → "ok hard cap it"). WRAP_SYS has asked for one sentence since the
// shape was hers and the model still returns two — the same lesson the short
// summary learned. TWO copies exist by necessity (the server cuts a new
// wrap-up on the way in, the page cuts an old one and the live Update card on
// the way out), so they are run over the SAME cases here.
{
  const serverPart = new Function('const WRAP_PART_MAX=200;' + lift('wrapPartOf')
    + ' return wrapPartOf;')();
  const TWO = 'Drew 2336x3504 for 13c and a second 2K for 7.8c. Worked the print sizes: 2K is comfortable to 12x18.';
  const cases = [
    TWO,
    'One sentence only.',
    'Used e.g. a thing and shipped 12x18. and kept going.',
    'No full stop at all',
    'x'.repeat(260) + ' and more',
    '',
  ];
  cases.forEach((c, i) => ok('the two copies agree on case ' + i,
    serverPart(c) === onePart(c), JSON.stringify([serverPart(c), onePart(c)])));
  ok('a second sentence is cut',
    serverPart(TWO) === 'Drew 2336x3504 for 13c and a second 2K for 7.8c.', serverPart(TWO));
  ok('an abbreviation is not a sentence end',
    serverPart(cases[2]).indexOf('kept going') > 0);
  ok('over the cap it still ends on a whole word',
    /[^ ]…$/.test(serverPart(cases[4])) && serverPart(cases[4]).length <= 201);
  ok('the page cuts the live Update card too',
    wrapParts({ updDid: TWO }).did === 'Drew 2336x3504 for 13c and a second 2K for 7.8c.');
}

// ── WHAT SHE ASKED IS HER OWN SENTENCE (2026-08-24, Sophie: "right now the
// what I asked sentence is paraphrased. can you make it my exact sentence and
// just truncate it if it gets too long, so basically just the beginning of my
// last message. and have it say what I asked in bold above it, and then the see
// more is as it was"). Two copies again — the server lifts the opening off her
// last message, the page draws it — so they are run over the SAME cases.
console.log('her own sentence on the asked line');
{
  const herAskOf = new Function('const HER_ASK_MAX=200;' + lift('herAskOf')
    + ' return herAskOf;')();
  const herAskText = new Function('const isCompacted=(t)=>'
    + '/^\\s*\\[?\\s*this session is being continued from a previous conversation/i'
    + '.test(String(t||""));' + liftLine('SLASH_ONLY') + liftLine('isAskable')
    + lift('herAskText') + ' return herAskText;')();

  const LONG = 'can you make the dashes pink and also '.repeat(12);
  const cases = [
    'quick question, can you make the dashes pink',
    'I have a question. Can you make the dashes pink and the boxes rounded?',
    LONG,
    '   ',
    '',
  ];
  cases.forEach((c, i) => ok('the two copies agree on case ' + i,
    herAskOf(c) === herAskPage(c), JSON.stringify([herAskOf(c), herAskPage(c)])));

  // TRUNCATED, NOT CUT AT A SENTENCE — she dictates, so a sentence rule would
  // leave "I have a question." as the whole line, which is the one shape that
  // says nothing at all. This is what makes it different from `wrapPartOf`.
  ok('a dictated framing sentence does NOT end the line',
    herAskOf(cases[1]).indexOf('dashes pink') > 0, herAskOf(cases[1]));
  ok('a short message is her whole sentence, untouched',
    herAskOf(cases[0]) === cases[0], herAskOf(cases[0]));
  ok('a long one is truncated at a whole word',
    /[^ ]…$/.test(herAskOf(LONG)) && herAskOf(LONG).length <= 201,
    String(herAskOf(LONG).length));
  ok('nothing to lift stays empty', herAskOf('') === '' && herAskOf('  ') === '');

  // HER newest message, and nobody else's.
  const thread = [
    { from: 'sophie', text: 'the first thing I wanted' },
    { from: 'claude', text: 'done — here is what I did' },
    { from: 'sophie', text: 'now make the dashes pink' },
    { from: 'claude', text: 'shipped it' },
  ];
  ok('it reads HER newest message', herAskText(thread) === 'now make the dashes pink');
  ok('a reply is never mistaken for her', herAskText([{ from: 'claude', text: 'mine' }]) === '');
  ok('an empty thread yields nothing', herAskText([]) === '' && herAskText(null) === '');
  // A CONTEXT-COMPACTION SUMMARY IS NOT HER MESSAGE — the harness hands it over
  // as a user turn and the hook lifts it exactly like something she typed, so
  // it would file thousands of characters of recited rules as what she asked.
  ok('a compaction summary is skipped, and the real ask behind it wins',
    herAskText(thread.concat([{ from: 'sophie',
      text: 'This session is being continued from a previous conversation that ran out of context.' }]))
      === 'now make the dashes pink');

  // WHEN SHE SENDS SEVERAL IN A ROW, THE ASK IS THE FIRST OF THEM (2026-08-27,
  // Sophie: "multiple messages only log the last one in chats app" / "first
  // shud be under what i asked"). The request comes first and the
  // qualifications follow it, so reading her LAST message files the
  // afterthought — measured live: "pills", "view", "j".
  const run = [
    { from: 'claude', text: 'shipped the last thing' },
    { from: 'sophie', text: 'we made a couple panels yesterday and they never got cut' },
    { from: 'sophie', text: 'also the glove ones' },
    { from: 'sophie', text: 'pills' },
  ];
  ok('a run of hers files the FIRST message, not the last',
    herAskText(run) === 'we made a couple panels yesterday and they never got cut',
    herAskText(run));
  // The moment a reply lands the run ends, so an ordinary back-and-forth is
  // untouched — this can only ever reach back over messages nothing answered.
  ok('a reply ends the run', herAskText(run.concat([
    { from: 'claude', text: 'cut them, here they are' },
    { from: 'sophie', text: 'now do the dance ones' },
  ])) === 'now do the dance ones');
  ok('a run that reaches the top of the thread still starts at her first',
    herAskText(run.slice(1)) === 'we made a couple panels yesterday and they never got cut');
  // A compaction summary inside a run is machinery wearing her name: stepped
  // over, never treated as the ask and never as the boundary either.
  ok('a compaction summary does not break a run in half',
    herAskText([
      { from: 'claude', text: 'done' },
      { from: 'sophie', text: 'the real ask' },
      { from: 'sophie', text: 'This session is being continued from a previous conversation.' },
      { from: 'sophie', text: 'ok' },
    ]) === 'the real ask');

  // A SLASH COMMAND IS NOT AN ASK — she types `/concise` and the harness hands
  // it over as an ordinary user turn (found live on instagram-video-crop,
  // whose run opened on a bare `/concise`). Only a message that is NOTHING BUT
  // a command is skipped.
  ok('a bare slash command is never the asked line',
    herAskText([{ from: 'claude', text: 'done' }, { from: 'sophie', text: '/concise' },
      { from: 'sophie', text: 'add black bars to the top and bottom' }])
      === 'add black bars to the top and bottom');
  ok('…and one with arguments is skipped too',
    herAskText([{ from: 'sophie', text: '/loop 5m check the deploy' },
      { from: 'sophie', text: 'tell me when it is green' }])
      === 'tell me when it is green');
  ok('a message that merely mentions a command is HERS',
    herAskText([{ from: 'sophie', text: 'the /concise style is too short, undo it' }])
      === 'the /concise style is too short, undo it');
  ok('a run of nothing but commands leaves the line empty',
    herAskText([{ from: 'sophie', text: '/concise' }]) === '');

  // THE CUTOFF, for the backfill only (2026-08-24): a summary written on the
  // 20th must be paired with the question she was asking on the 20th. Taking
  // her newest message instead would file a question asked afterwards over
  // answers that predate it.
  const dated = [
    { from: 'sophie', created: '2026-08-18T10:00:00Z', text: 'the first thing I wanted' },
    { from: 'claude', created: '2026-08-18T10:05:00Z', text: 'done' },
    { from: 'sophie', created: '2026-08-20T09:00:00Z', text: 'now make the dashes pink' },
    { from: 'sophie', created: '2026-08-24T09:00:00Z', text: 'a whole new thing entirely' },
  ];
  // The last two of hers are a RUN — no reply between them — so the ask is the
  // first of the two, and the cutoff still reads the run as of that moment.
  ok('with no cutoff it is the start of her latest run',
    herAskText(dated) === 'now make the dashes pink', herAskText(dated));
  ok('a cutoff reads what she was asking THEN',
    herAskText(dated, '2026-08-20T20:00:00Z') === 'now make the dashes pink');
  ok('a cutoff before anything of hers yields nothing',
    herAskText(dated, '2026-08-01T00:00:00Z') === '');

  // The freeze prefers hers and keeps the Update card's paraphrase as the
  // fallback for a chat she never posted into.
  const w = frozenWrapUp({ updAsked: 'Fix the hook so turns post', updDid: 'Shipped v14' },
    'now make the dashes pink');
  ok('the freeze files HER sentence, not the paraphrase',
    w.wrapAsked === 'now make the dashes pink', w.wrapAsked);
  ok('…and marks it as hers so the page truncates rather than cutting a sentence',
    w.wrapAskedHers === true, String(w.wrapAskedHers));
  const noHer = frozenWrapUp({ updAsked: 'Fix the hook so turns post', updDid: 'Shipped v14' }, '');
  ok('with no message of hers the Update card still answers it',
    noHer.wrapAsked === 'Fix the hook so turns post', noHer.wrapAsked);
  ok('…and the flag is cleared rather than left true', noHer.wrapAskedHers === DEL);

  // THE PAGE: a verbatim asked answer is truncated, never sentence-cut.
  const hers = wrapParts({ wrapAsked: cases[1], wrapAskedHers: true, wrapDid: 'shipped it' });
  ok('the page keeps her whole opening', hers.asked.indexOf('dashes pink') > 0, hers.asked);
  const para = wrapParts({ wrapAsked: cases[1], wrapDid: 'shipped it' });
  ok('a written paraphrase is still cut at its first sentence',
    para.asked === 'I have a question.', para.asked);

  // THE BOLD QUESTION over the line — only when the line IS the asked answer.
  ok('the asked line earns its label',
    wrapLineIsAsk({ wrapAsked: 'a cutter for her tape', wrapDid: 'shipped it' }) === true);
  ok('a line that fell through to what it did does NOT',
    wrapLineIsAsk({ wrapDid: 'shipped it' }) === false);
  ok('…nor does an older prose summary',
    wrapLineIsAsk({ wrapLine: 'built the cutter', wrapUp: 'A prose one.' }) === false);
  ok('the thread draws that bold question over the line',
    /twq[\s\S]{0,400}UPD_LABELS\[0\]\[1\]/.test(html));
  ok('…and "See more…" is untouched, still inline on the line itself',
    /tog\.textContent='See more…'/.test(html));
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

// ── the cap is ENFORCED, not requested ─────────────────────────────────────
// Measured twice over her real summaries: "UNDER 180 CHARACTERS" in the prompt
// came back at a median of 223, and re-asking with it tightened to two
// sentences still left 169 of 317 over — the worst at 526. So the length is cut
// in code on the way in, and this pins the two things that make that safe:
// whole sentences only, and a first sentence already over the cap kept WHOLE.
console.log('the short summary is cut to three lines in code');
{
  const capShort = new Function('const SHORT_CAP=180;' + lift('capShort') + ' return capShort;')();
  const A = 'Sophie wanted the summaries shortened. Built the cap and ran it over every chat. '
    + 'It came in at a median of 183 characters afterwards, which is three lines on her phone.';
  const cut = capShort(A);
  ok('a summary over the cap loses its last sentence', cut.length <= 180 && cut.length > 60,
    String(cut.length));
  ok('…and keeps whole sentences, never a fragment', /[.!?]$/.test(cut), cut);
  ok('one already short enough is untouched', capShort('Short and done.') === 'Short and done.');
  const LONE = 'x'.repeat(300) + '.';
  ok('a first sentence longer than the cap is kept WHOLE, not cut mid-thought',
    capShort(LONE) === LONE);
  ok('nothing is ever lengthened', capShort('').length === 0);
  // It guards the FREE-TEXT paths only. The three-answer prose is derived from
  // three separately-capped sentences, and cutting THAT to three lines would
  // drop "what's next" — the half she reads for loose ends.
  ok('the free-text paths are capped',
    (src.match(/capShort\(wrapTextOf\(/g) || []).length === 2);
  ok('…and the three-answer prose is left whole',
    /three \? wrapProse\(asked, did, next\) : capShort\(wrapTextOf\(text\)\)/.test(src));
  ok('…and the trim pass skips a chat already on that shape',
    /if \(r\.wrapAsked \|\| r\.wrapDid \|\| r\.wrapNext\) return;/.test(src));
  ok('the free trim pass exists for the ones already stored',
    /router\.post\('\/wrapup\/trim'/.test(src));
  ok('…and it is DRY by default, like every other bulk operation here',
    /const dry = !\(req\.body && req\.body\.dry === false\)/.test(src));
  ok('…and it only ever shortens `wrapUp` — never rewrites the other fields',
    /set\(\{ wrapUp: h\.text \}, \{ merge: true \}\)/.test(src));
}

// THE BACKFILL — her own words onto the summaries written before #1631
// (2026-08-24, Sophie: "what I asked … is paraphrased. make it not paraphrase,
// just my actual words truncated"). The live paths were already right; a
// wrap-up is STORED, so 70 chats kept their paraphrase with nothing to rewrite
// them. Same shape as the trim pass: free, dry by default, narrow.
console.log('\nputting her words back on the ones already on file');
{
  ok('the pass exists', /router\.post\('\/wrapup\/rehers'/.test(src));
  const body = src.slice(src.indexOf("router.post('/wrapup/rehers'"),
    src.indexOf("router.post('/wrapup/write'"));
  ok('it is DRY by default, like every other bulk operation here',
    /const dry = !\(req\.body && req\.body\.dry === false\)/.test(body));
  ok('a summary already carrying her words is skipped unless `redo` reopens it',
    /if \(r\.wrapAskedHers === true && !redo\) return;/.test(body)
    && /const redo = !!\(req\.body && req\.body\.redo\)/.test(body));
  ok('a chat with no asked answer at all is left alone',
    /if \(!String\(r\.wrapAsked \|\| ''\)\.trim\(\)\) return;/.test(body));
  ok('it reads her message AS OF when the summary was written',
    /herAskText\(msgs, t\.r\.wrapUpAt\)/.test(body));
  ok('a chat she never posted into keeps its own answer, and is NAMED',
    /if \(!hers\) \{ noMessage\.push\(t\.chat\); continue; \}/.test(body)
    && /noMessageOfHers: noMessage/.test(body));
  ok('the patch touches only `wrapAsked`, its flag, and the old line it keeps',
    /const patch = \{ wrapAsked: hers, wrapAskedHers: true \};/.test(body));
  // A re-pointing pass must not overwrite the ORIGINAL paraphrase with the
  // sentence of hers it is replacing, or the undo stops being an undo.
  ok('…and the kept line is written once, never overwritten by a redo',
    /if \(!String\(t\.r\.wrapAskedWas \|\| ''\)\.trim\(\)\) patch\.wrapAskedWas = t\.r\.wrapAsked;/
      .test(body));
  ok('…so what the chat DID and what is NEXT are never reworded',
    !/patch\.wrapDid|patch\.wrapNext|patch\.wrapLine|patch\.wrapLong/.test(body));
  // NOTHING IS DESTROYED. Measured over the 62 this pass rewrites, ~6 come out
  // worse — a sign-off ("ok build is here now") or a machine-authored prompt the
  // hook lifted as hers. Her rule is applied everywhere rather than guessing at
  // a quality bar over her own words, so keeping the paraphrase is what makes
  // that call reversible instead of permanent.
  ok('the paraphrase is kept rather than overwritten',
    /patch\.wrapAskedWas = t\.r\.wrapAsked;/.test(body));
  ok('the prose mirror is rebuilt ONLY when it provably IS the three joined',
    /String\(t\.r\.wrapUp \|\| ''\)\.trim\(\) === mirror/.test(body));
  ok('it spends nothing — no model call in the pass',
    !/anthropic/.test(body));
}

function WRAP_SYS_TEXT() {
  const i = src.indexOf('const WRAP_SYS =');
  return src.slice(i, src.indexOf('`;', i));
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
