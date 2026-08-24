#!/usr/bin/env node
// Tests for questions.js — the derived Questions list. No network, no Firestore:
// the whole thing is pure functions over fixture messages.
//
//   node scripts/test-questions.js

const Q = require('../questions');

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : '')); }
}
function eq(name, got, want) { ok(name, got === want, 'got: ' + JSON.stringify(got) + '\n       want: ' + JSON.stringify(want)); }

console.log('\nis it a question?');
ok('plain question mark', Q.isQuestion('Should this be a tab?'));
ok('mid-sentence dictation with no mark', Q.isQuestion("I'm wondering if this should be part of the message"));
ok('auxiliary lead, no mark', Q.isQuestion('Should we do the blue one'));
ok('another auxiliary lead', Q.isQuestion('Can you make the dashes at the top pink'));
ok('and another', Q.isQuestion('do we have a synchronicity lesson in the witch school'));
// The false positives that made the word-count floor and the apostrophe
// lookahead necessary — her messages are full of these.
ok('short assertion is not a question', !Q.isQuestion('Should be fine.'));
ok('contraction is not a question', !Q.isQuestion("Can't wait to see it."));
ok('plain instruction is not a question', !Q.isQuestion('Let us just try it and I will give you feedback.'));
ok('statement is not a question', !Q.isQuestion('There is hardly any room on that screen.'));

console.log('\na wh-word with no question mark is a RELATIVE CLAUSE, not a question');
// Both of these were sitting in her list, straight out of dictated transcript
// (measured 2026-08-14).
ok('"which I could illustrate…" is not a question',
   !Q.isQuestion('which I could illustrate, like, a pretty big spider creeping up onto this'));
ok('"Which he goaded himself into…" is not a question',
   !Q.isQuestion('Which he goaded himself into, but, um'));
ok('but a wh-question WITH the mark still counts',
   Q.isQuestion('Who would do, like, just the vertical and horizontal?'));
ok('and so does an unmarked wondering', Q.isQuestion("I'm wondering if that would work"));

console.log('\ncode and fragments are not questions');
// Eight of these were listed under one answer in the Story Room chat.
ok('a bare mark', !Q.isQuestion('?'));
ok('two tokens', !Q.isQuestion('char ?'));
ok('a field name', !Q.isQuestion(', imageHistory?'));
ok('an assignment', !Q.isQuestion('textContent = on ?'));
ok('a backticked line', !Q.isQuestion('page api() helper auto-injects `pad` into bodies / ?'));
ok('a bulleted shape', !Q.isQuestion('- Beat shape: {id, url|null, color, src, text?'));
ok('real prose with punctuation in it survives',
   Q.isQuestion('So, like, what did I think of as the first time he said it?'));

console.log('\nSHE FLAGS IT WITH THE WORD "QUESTION" — nothing else reaches the tab');
// 2026-08-23: "it ONLY applies if i use the word question in my text". The
// three shapes she named, plus the plural and the bare word.
ok('"I have a question"', Q.flagsQuestion('I have a question about the tabs'));
ok('"my question is:"', Q.flagsQuestion('my question is: should the tabs be pink'));
ok('"quick question"', Q.flagsQuestion('quick question — is it merged'));
ok('the plural counts', Q.flagsQuestion('two questions for you'));
ok('a plain ask does NOT', !Q.flagsQuestion('Should the button go underneath?'));
ok('an unmarked wondering does NOT', !Q.flagsQuestion("I'm wondering if that would work"));
ok('"questionable" is not the word', !Q.flagsQuestion('that colour is questionable'));

// 2026-08-24 — SHE HAS TO BE ASKING, NOT TALKING ABOUT ASKING. These three are
// the ACTUAL rows that were sitting in this chat's own Questions tab the day
// she asked "is that cuz ur rules are out of date?": all three false, none of
// them a question she had marked. The bare word `question` anywhere was the
// old gate, and it is what put them there.
ok('describing the format is not asking',
   !Q.flagsQuestion("i noticed ur still structuring ur response w bold questions"));
ok('complaining about an answer is not asking',
   !Q.flagsQuestion("did u check the answer? it didn't actually answer the question"));
ok('specifying the feature is not asking',
   !Q.flagsQuestion('it ONLY applies if i use the word question in my text'));
ok('talking about asking is not asking',
   !Q.flagsQuestion('sometimes like I ask questions to chat and it gets buried'));

// The shapes her real feed actually carries, all of which must survive.
ok('"Last question:"', Q.flagsQuestion('Last question: is the deploy live'));
ok('"One more question —"', Q.flagsQuestion('One more question — did it merge'));
ok('"A question:"', Q.flagsQuestion('A question: should the button go underneath'));
ok('a bare count is framing too', Q.flagsQuestion('Two questions. Is it live? And is it merged?'));
ok('and so is a bare "Questions:"', Q.flagsQuestion('Questions: is it live'));

// A CONTEXT-COMPACTION SUMMARY IS NOT HER MESSAGE. The harness hands it over
// as a USER turn, so the hook files it as hers — and it QUOTES everything,
// including the trigger phrases as examples, so every gate above fires on it.
// Measured over her 120 recent chats: 4 of 408 of her messages, but 5 of the
// 35 rows.
const compacted = 'This session is being continued from a previous conversation that ran out '
  + 'of context. The summary below covers the earlier portion of the conversation. '
  + 'Summary: she said "it ONLY applies if i use the word question in my text eg i '
  + 'have a question, or my question is:". Quick question. Is that right?';
ok('a compaction summary is not hers', !Q.flagsQuestion(compacted));
eq('and it files nothing', Q.findQuestions(compacted).length, 0);
// ANCHORED AT THE START — a message that merely talks about compaction is hers.
ok('talking about it is untouched',
   Q.flagsQuestion('quick question, what happens when this session is being continued after a compaction'));

console.log('\nthe code word files on purpose');
// HER IDEA (2026-08-24): "maybe a code word that triggers the chat to file the
// answer intentionally?" — it files an exchange that was never shaped like a
// question at all, which no phrase rule can reach.
ok('"file this"', Q.filesOnPurpose('that explanation is great, file this'));
ok('"save that answer"', Q.filesOnPurpose('save that answer, i will want it back'));
ok('"for the questions tab"', Q.filesOnPurpose('grab that for the questions tab'));
ok('ordinary filing talk is not the code word',
   !Q.filesOnPurpose('file the prompt on the asset'));

// A SMALL VOCABULARY, NOT ONE MAGIC STRING — she dictates and paraphrases, so
// "file this" and "file that" have to be the same intent.
ok('"file that" is the same intent', Q.filesOnPurpose('file that, it is worth keeping'));

const filed = Q.findQuestions('so that is why the tiers are continuous. file this one');
eq('the code word files a row', filed.length, 1);
ok('and the row is her own sentence, minus the instruction',
   filed[0].indexOf('so that is why the tiers are continuous') === 0, filed[0]);

// It runs FIRST and then falls through, so a message carrying both still picks
// the real ask rather than stopping at the code word.
const both = Q.findQuestions('file this. my question is whether the tabs should be pink or tan');
ok('a marked ask in the same message is still found',
   both.indexOf('my question is whether the tabs should be pink or tan') >= 0, both.join(' | '));

// The whole point of the gate: these all pass `isQuestion`, and none of them
// reaches the list any more, because she did not mark the message.
eq('an unflagged question mark yields nothing',
  Q.findQuestions('Does the button go under the header?').length, 0);
eq('an unflagged auxiliary lead yields nothing',
  Q.findQuestions('Can you make the dashes at the top pink').length, 0);
eq('an unflagged wondering yields nothing',
  Q.findQuestions("I'm wondering if this should be part of the message").length, 0);

console.log('\npicking the ask out of a flagged message');
// The ask rides the framing sentence.
const inline = Q.findQuestions('my question is whether the tabs should be pink or tan');
eq('one question found', inline.length, 1);
eq('and it is her sentence, verbatim', inline[0],
  'my question is whether the tabs should be pink or tan');

// Bare framing hands the row to the sentence after it — "I have a question." is
// a heading, not a question, and filing it would put a heading in her list.
const framed = Q.findQuestions('I have a question. Should the button go underneath?');
eq('the framing sentence is not the row', framed.length, 1);
eq('the sentence after it is', framed[0], 'Should the button go underneath?');

// Her commonest dictated shape: no mark, opens on a noun, so every heuristic in
// this file misses it and only her own word finds it.
const quick = Q.findQuestions('quick question, can you make the dashes at the top pink');
eq('a "quick question" with no mark is found', quick.length, 1);

// The sentence after bare framing is taken WHATEVER it looks like — she has just
// said in her own words that a question follows.
const plain = Q.findQuestions('Quick question. The dashes at the top, pink or tan.');
eq('an unmarked ask after framing is still the row', plain.length, 1);
eq('and it reads as she said it', plain[0], 'The dashes at the top, pink or tan.');

console.log('\nmultiple questions in one flagged message');
const two = Q.findQuestions('Two questions. Does the button go under the header? And what colour should it be?');
eq('both found', two.length, 2);
ok('the framing sentence is not one of them', two.indexOf('Two questions.') < 0, two.join(' | '));

console.log('\ninside a flagged message the old heuristics still pick the sentence');
// Her actual message, 2026-08-14 — voice-to-text, and the ask in it has NO
// question mark anywhere, opens on a pronoun, and would be missed by every
// heuristic in this file. Only her own framing finds it.
//
// AS SHE ACTUALLY SENT IT, it is a message ABOUT asking ("I ask questions to
// chat") and files NOTHING — that is the 2026-08-24 tightening, and this is the
// live shape it turns off.
const real = "so basically, I have this idea that sometimes like I ask questions to chat and "
  + "then it's hard to find the answer cause it's buried under other stuff. "
  + "I'm wondering if this should be part of the message or "
  + "should be filed separately into a little hidden away tab called questions within each chat area.";
eq('talking about asking files nothing', Q.findQuestions(real).length, 0);

// Marked, the same message files, and the wondering is still the sentence that
// gets the row — the heuristics below the gate are untouched.
const found = Q.findQuestions('Quick question. ' + real);
eq('one question found', found.length, 1);
ok('it is her sentence, verbatim',
   found[0].indexOf("I'm wondering if this should be part of the message") === 0, found[0]);

console.log('\nanswer comes from the bold block that matches');
const reply = [
  'TLDR: both, sort of.',
  '',
  '**Should the questions live in a tab?**',
  '',
  'Yes — a derived one, so nobody has to file anything.',
  '',
  '**What colour should the button be?**',
  '',
  'The same tan as the rest of the row.',
].join('\n');
eq('matched the right block', Q.answerFor(reply, 'both, sort of.', 'What colour should the button be?'),
  'The same tan as the rest of the row.');
eq('matched the other block', Q.answerFor(reply, 'both, sort of.', 'Should the questions live in a tab?'),
  'Yes — a derived one, so nobody has to file anything.');
eq('unrelated question falls back to the tldr',
  Q.answerFor(reply, 'both, sort of.', 'How much did the render cost'), 'both, sort of.');
eq('no tldr and no block falls back to the first paragraph',
  Q.answerFor('It cost about four cents.\n\nMore detail after.', '', 'How much did it cost'),
  'It cost about four cents.');

console.log('\nTHE ANSWER CAN LIVE ANYWHERE IN THE REPLY — bestParagraph digs it out');
// A condensed version of the real reply that earned this (2026-08-23, Sophie:
// "did u check the answer? it didn't actually answer the question. ull have to
// be smarter about this whole thing"): the answer to each question is a
// MIDDLE paragraph, the opening is progress lines, and there is no TLDR.
const sizesReply = [
  'Now the size tiers on the server:',
  '',
  '**Spent $2.35 this turn** — measuring the real price of every new size at every quality.',
  '',
  "**2K and 4K are not the only sizes — it's continuous.** Any canvas up to 3840px on the",
  'long edge, with both edges a multiple of 16. Nothing between them is special.',
  '',
  "**Legal paper at 1024x1536: soft, and you'd see it.** Legal is 8.5x14 and your image is",
  "2:3 — printed inside margins you're at roughly 137 dpi. At reading distance it reads mushy.",
].join('\n');
ok('a short question finds its middle paragraph',
   /not the only sizes/.test(Q.answerFor(sizesReply, '', "are 2k and 4k the only sizes or are there in between sizes?")),
   Q.answerFor(sizesReply, '', 'x'));
// Her dictated questions run LONG — the denominator cap is what lets a real
// 4-word match survive 13 words of framing.
ok('a long dictated question still finds its paragraph',
   /Legal paper/.test(Q.answerFor(sizesReply, '',
     "Last question: if I were to print one of the normal images at the original size 1500 or whatever, let's say I printed it on legalize paper, how soft would it be")),
   Q.answerFor(sizesReply, '', 'long'));
// The stem must land singular and plural on the same root — her "images"
// against the reply's "image" is exactly the hit the old stem lost.
ok('singular and plural stem to the same root',
   Q.matchBlock([{ q: 'the image sizes', body: 'yes' }], 'are the sizes of the images right') !== null);
// Two shared words is a coincidence, not an answer — the floor is 3 distinct
// hits, so "answer" + "question" appearing together cannot hijack a row.
ok('two shared words do not pick a paragraph',
   Q.bestParagraph('Here is context.\n\nI will answer your question soon.\n\nDone.', '',
     "u didn't answer my question") === null);
// The TLDR competes as a candidate — a summary that really is the answer wins.
eq('a tldr that scores wins as the answer',
  Q.bestParagraph('Unrelated opening.\n\nMore prose.', 'The witch lesson cards render at medium quality now.',
    'what quality do the witch lesson cards render at'),
  'The witch lesson cards render at medium quality now.');
// Below the bar it stays out of the way entirely.
ok('nothing scoring → null, the old chain runs',
   Q.bestParagraph(sizesReply, '', 'how do I repoint the DNS at Hover') === null);

console.log('\na paragraph ending in a colon is an introduction, not an answer');
// Both of these were live rows in her Questions tab, 2026-08-23, on
// playground-image-resolution — a fragment that answered nothing, because the
// answer was in the paragraph the colon was introducing.
const leadIn = "Sorry — here's the straight answer. Yes, there are more differences we never "
  + 'considered. The bigger one I skipped is the difference between **ChatGPT the app** and what we call:'
  + '\n\n**The app thinks before it draws.** ChatGPT runs a reasoning pass first.';
ok('it reads on past the colon',
   /reasoning pass/.test(Q.answerFor(leadIn, '', "u didn't answer my question")),
   Q.answerFor(leadIn, '', 'x'));

// Two colon-ended progress lines, then the real reply.
const narrated = 'Now the size tiers on the server:\n\nNow the docs, then commit and merge:'
  + '\n\n**Spent $2.35 this turn** — measuring the real price of every size.';
ok('and past two of them', /Spent \$2\.35/.test(Q.answerFor(narrated, '', 'how soft would it be')),
   Q.answerFor(narrated, '', 'x'));

// It only ever reads FURTHER — a real lead-in keeps its own words.
ok('the lead-in itself is kept, never dropped',
   Q.answerFor('Two things:\n\nThe first one. The second one.', '', 'what changed')
     .indexOf('Two things:') === 0);

// THREE is the stop, so a reply that is nothing but headings cannot swallow
// itself whole.
eq('it stops after three paragraphs',
  Q.answerFor('One:\n\nTwo:\n\nThree:\n\nFour:\n\nFive:', '', 'what changed'),
  'One:\n\nTwo:\n\nThree:');

// A paragraph that ends normally still stops at one, exactly as before.
eq('a normal opening is still one paragraph',
  Q.answerFor('It cost four cents.\n\nAnd here is why.', '', 'how much'),
  'It cost four cents.');

// Straight off her real threads, 2026-08-14: the stored TLDR had lost the words
// its opening ** belonged to, so five answers in one chat began with literal
// asterisks.
eq('an orphaned bold marker is dropped',
  Q.answerFor('', '** — vegetables are done and you were right', 'How did the vegetables go'),
  '— vegetables are done and you were right');
eq('real bold inside an answer is left alone',
  Q.answerFor('', 'the **blue** one won', 'Which one won'), 'the **blue** one won');

console.log('\nthe whole list');
const msgs = [
  { id: 'a', from: 'sophie', text: 'Quick question. Should the button go underneath?', created: '2026-08-14T10:00:00Z' },
  { id: 'b', from: 'claude', text: '**Should the button go underneath?**\n\nYes, under the header.', tldr: 'Under the header.', created: '2026-08-14T10:01:00Z' },
  { id: 'c', from: 'sophie', text: 'Merge it when CI is green.', created: '2026-08-14T10:05:00Z' },
  { id: 'd', from: 'claude', text: 'Merged.', tldr: 'Merged.', created: '2026-08-14T10:06:00Z' },
  { id: 'e', from: 'sophie', text: 'One more question — what did that cost?', created: '2026-08-14T10:10:00Z' },
];
const built = Q.buildQuestions(msgs);
eq('two questions, the instruction ignored', built.length, 2);
eq('newest first', built[0].question, 'One more question — what did that cost?');
eq('an unanswered question is still listed', built[0].answer, '');
eq('the answered one carries its block', built[1].answer, 'Yes, under the header.');
eq('it points at her message', built[1].id, 'a');
eq('and at the reply', built[1].replyId, 'b');

console.log('\nunanswered questions are not shown');
// "it shouldn't have questions that haven't been answered yet" — she opens the
// list to find an answer, and the commonest open one is the question in the
// message she just sent.
const open = Q.answeredOnly(built);
eq('the open one is dropped', open.length, 1);
eq('the answered one stays', open[0].question, 'Should the button go underneath?');
eq('buildQuestions itself still reports both', built.length, 2);

console.log('\none answer, one row');
// Her real shape: a run of messages, then one reply for all of them. Ten rows
// of the same paragraph is what she saw. Straight off the voice-memo-ideas
// chat, 2026-08-14.
const runReply = 'You’re right, and it’s worse than intermittent — no turn from this repo has '
  + 'ever posted. The hook is installed and healthy; it just never loaded.';
const run = [
  { id: 's1', from: 'sophie', text: 'Quick question. oh yeah also, can you make sure you’re posting the chats up?', created: '2026-08-14T10:00:00Z' },
  { id: 's2', from: 'sophie', text: 'Another question. Who would do the vertical and horizontal ones?', created: '2026-08-14T10:01:00Z' },
  { id: 's3', from: 'sophie', text: 'One more question — was there another one I was thinking of?', created: '2026-08-14T10:02:00Z' },
  { id: 'r1', from: 'claude', text: runReply, tldr: runReply, created: '2026-08-14T10:03:00Z' },
];
const collapsed = Q.buildQuestions(run);
eq('three questions become one row', collapsed.length, 1);
// THIS ASSERTION USED TO PASS ITS CONDITION AS THE NAME — `ok(name, cond)` — so
// it printed "ok false" and tested nothing, and the fixture under it did not
// actually hold: s2 read "Who would do, like, just the vertical and horizontal?"
// and the word `just` also appears in the answer ("it just never loaded"), so a
// filler word beat the real ask 0.167 to 0.143. The filler is gone from s2, so
// the group now turns on the words that mean something.
ok('and it keeps the one the answer is actually about',
   /posting the chats up/.test(collapsed[0].question), collapsed[0].question);

// A reply written to the house rule — each FLAGGED question repeated in bold
// with its answer under it — gives every question its OWN answer, so nothing
// collapses. That is the shape the bold echo exists for.
const perQuestion = [
  { id: 's1', from: 'sophie', text: 'A question: should the button go underneath?', created: '2026-08-14T11:00:00Z' },
  { id: 's2', from: 'sophie', text: 'Second question. What colour should it be?', created: '2026-08-14T11:01:00Z' },
  { id: 'r1', from: 'claude', created: '2026-08-14T11:02:00Z', tldr: 'both',
    text: '**Should the button go underneath?**\n\nYes, under the header.\n\n'
        + '**What colour should it be?**\n\nThe same tan as the row.' },
];
const kept = Q.buildQuestions(perQuestion);
eq('bold blocks keep both rows', kept.length, 2);
eq('each with its own answer', kept[0].answer, 'The same tan as the row.');
eq('and the other one', kept[1].answer, 'Yes, under the header.');

console.log('\nout-of-order input is sorted before pairing');
const shuffled = Q.buildQuestions([msgs[1], msgs[4], msgs[0], msgs[3], msgs[2]]);
eq('same result', shuffled.length, 2);
eq('still paired correctly', shuffled[1].answer, 'Yes, under the header.');

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
