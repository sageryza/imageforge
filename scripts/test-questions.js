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

console.log('\npulling questions out of a real message');
// Her actual message, 2026-08-14 — voice-to-text, and the question in it has NO
// question mark anywhere. That is the case the whole detector exists for.
const real = "so basically, I have this idea that sometimes like I ask questions to chat and "
  + "then it's hard to find the answer cause it's buried under other stuff so I'm thinking I "
  + "want something where my question is repeated verbatim and bold and then the answer is "
  + "right underneath it not bold. I'm wondering if this should be part of the message or "
  + "should be filed separately into a little hidden away tab called questions within each chat area.";
const found = Q.findQuestions(real);
eq('one question found', found.length, 1);
ok('it is her sentence, verbatim', found[0].indexOf("I'm wondering if this should be part of the message") === 0, found[0]);

console.log('\nmultiple questions in one message');
const two = Q.findQuestions('Does the button go under the header? And what colour should it be?');
eq('both found', two.length, 2);

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
  { id: 'a', from: 'sophie', text: 'Should the button go underneath?', created: '2026-08-14T10:00:00Z' },
  { id: 'b', from: 'claude', text: '**Should the button go underneath?**\n\nYes, under the header.', tldr: 'Under the header.', created: '2026-08-14T10:01:00Z' },
  { id: 'c', from: 'sophie', text: 'Merge it when CI is green.', created: '2026-08-14T10:05:00Z' },
  { id: 'd', from: 'claude', text: 'Merged.', tldr: 'Merged.', created: '2026-08-14T10:06:00Z' },
  { id: 'e', from: 'sophie', text: 'What did that cost?', created: '2026-08-14T10:10:00Z' },
];
const built = Q.buildQuestions(msgs);
eq('two questions, the instruction ignored', built.length, 2);
eq('newest first', built[0].question, 'What did that cost?');
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
  { id: 's1', from: 'sophie', text: 'oh yeah also, can you make sure you’re posting the chats up?', created: '2026-08-14T10:00:00Z' },
  { id: 's2', from: 'sophie', text: 'Who would do, like, just the vertical and horizontal?', created: '2026-08-14T10:01:00Z' },
  { id: 's3', from: 'sophie', text: 'And then the other one I was thinking, was there another one?', created: '2026-08-14T10:02:00Z' },
  { id: 'r1', from: 'claude', text: runReply, tldr: runReply, created: '2026-08-14T10:03:00Z' },
];
const collapsed = Q.buildQuestions(run);
eq('three questions become one row', collapsed.length, 1);
ok(/posting the chats up/.test(collapsed[0].question),
   'and it keeps the one the answer is actually about: ' + collapsed[0].question);

// A reply written to the house rule gives each question its OWN answer, so
// nothing collapses.
const perQuestion = [
  { id: 's1', from: 'sophie', text: 'Should the button go underneath?', created: '2026-08-14T11:00:00Z' },
  { id: 's2', from: 'sophie', text: 'What colour should it be?', created: '2026-08-14T11:01:00Z' },
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
