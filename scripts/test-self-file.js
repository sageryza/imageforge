#!/usr/bin/env node
// A CHAT FILES ITSELF — the decision table, pure, no network.
// Sophie 2026-09-01: "chats choose their own" · "have them check in
// periodically in case the subject changes". This reverses the standing
// do-NOT-post-a-category rule, so every guardrail the paid sorter obeyed has
// to be re-proved on this path: her filing is final, triage is off limits, an
// unknown word is dropped rather than invented, "none" is a normal answer, and
// a chat's OWN earlier answer never locks it out (a research chat that becomes
// a request has to be able to re-file).
const cs = require('../chat-sort');
let n = 0; const bad = [];
const is = (label, got, want) => {
  n++; const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) bad.push(`${label}\n    got  ${g}\n    want ${w}`);
};
const CATS = ['witch', 'story', 'bug fix', 'new feature', 'research', 'look at', 'come back to'];
const plan = (reg, labels) => cs.selfFilePlan({ reg, cats: CATS, labels });

// 1. the ordinary file
is('files a known word', plan({}, ['bug fix']).labels, ['bug fix']);
is('several at once', plan({}, ['witch', 'bug fix']).labels, ['witch', 'bug fix']);
is('case and spacing are hers, not the chat\'s',
  plan({}, ['  Bug Fix  ']).labels, ['bug fix']);
is('a word twice is one word', plan({}, ['witch', 'WITCH']).labels, ['witch']);

// 2. HER FILING IS FINAL — the rule the whole reversal turns on
is('refuses a chat she filed', plan({ category: 'witch', catBy: 'sophie' }, ['story']).why, 'hers');
is('refuses her leave-it-unfiled', plan({ catNone: true }, ['story']).why, 'hers-unfiled');
is('a refusal writes nothing', plan({ catBy: 'sophie' }, ['story']).ok, false);
is('the auto-sorter does NOT lock it out',
  plan({ category: 'witch', catBy: 'auto' }, ['bug fix']).labels, ['bug fix']);
is('nor does its own earlier answer — re-filing is the point',
  plan({ category: 'research', catBy: 'chat' }, ['new feature']).labels, ['new feature']);

// 3. IT NEVER INVENTS A FOLDER
is('an unknown word is dropped', plan({}, ['triangles']).labels, []);
is('…and is NAMED in the answer', plan({}, ['triangles']).dropped, ['triangles']);
is('a known word survives beside an unknown one',
  plan({}, ['triangles', 'witch']).labels, ['witch']);

// 4. TRIAGE IS OFF LIMITS
['look at', 'come back to', 'waiting for a response', 'to be reviewed'].forEach((t) => {
  is(`triage refused: ${t}`, plan({}, [t]).labels, []);
});

// 5. "NONE" IS A NORMAL ANSWER
is('nothing asked for is ok, not an error', plan({}, []).ok, true);
is('…and says none', plan({}, []).why, 'none');
is('an all-dropped set is none too', plan({}, ['triangles']).why, 'none');

// 6. a deleted chat is not filed
is('deleted refuses', plan({ deletedAt: 'x' }, ['witch']).why, 'deleted');

// 7. the paid sorter stands down for a chat-filed chat — the saving itself
const gate = (reg) => cs.shouldAutoSort(reg, { messages: 99 });
is('chat-filed skips the paid call',
  gate({ category: 'witch', catBy: 'chat' }), { sort: false, why: 'chat-filed' });
is('hers still skips it', gate({ category: 'witch', catBy: 'sophie' }).why, 'hers');
is('an unfiled chat is still the fallback', gate({}).sort, true);

if (bad.length) { console.error(`self-file: ${bad.length} of ${n} FAILED\n  ` + bad.join('\n  ')); process.exit(1); }
console.log(`self-file: ${n} checks passed`);
