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
ok('lead word, long enough', Q.isQuestion('Should we do the blue one'));
ok('what/how lead', Q.isQuestion('How does the pairing actually work'));
// The false positives that made the word-count floor and the apostrophe
// lookahead necessary — her messages are full of these.
ok('short assertion is not a question', !Q.isQuestion('Should be fine.'));
ok('contraction is not a question', !Q.isQuestion("Can't wait to see it."));
ok('plain instruction is not a question', !Q.isQuestion('Let us just try it and I will give you feedback.'));
ok('statement is not a question', !Q.isQuestion('There is hardly any room on that screen.'));

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

console.log('\nout-of-order input is sorted before pairing');
const shuffled = Q.buildQuestions([msgs[1], msgs[4], msgs[0], msgs[3], msgs[2]]);
eq('same result', shuffled.length, 2);
eq('still paired correctly', shuffled[1].answer, 'Yes, under the header.');

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
