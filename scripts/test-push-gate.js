#!/usr/bin/env node
// Tests for the push gate (push-gate.js) — pure, no network, no Firestore.
//
// The whole point of the gate is Sophie's sentence: "I don't need a
// notification when I send a message. I need a notification when they respond
// to my message." Each case below is one of the shapes that used to buzz her
// at the wrong moment, written as the timestamps the server really sees.
//
//   node scripts/test-push-gate.js

const { shouldPushReply, chatNotifies, needEscalates, pushAlert, pushBody } = require('../push-gate');

let pass = 0; const fails = [];
function is(name, got, want) {
  if (got === want) { pass++; return; }
  fails.push(`${name}\n    want ${want}\n    got  ${got}`);
}
// Readable clock: minutes past an arbitrary hour, as the ISO strings the
// registry and the message docs actually carry.
const t = (min, sec = 0) =>
  new Date(Date.UTC(2026, 7, 15, 20, min, sec)).toISOString();

// ── The ordinary case ───────────────────────────────────────────────────────
is('answers her → push',
  shouldPushReply({ working: false, replyCreated: t(34), lastHerAt: t(30), pushedAt: t(5) }).why,
  'answers-her');

// A live draft is never a buzz — unchanged, and the reason the app can show
// "still writing…" without waking her phone.
is('a draft never pushes',
  shouldPushReply({ working: true, replyCreated: t(34), lastHerAt: t(30), pushedAt: t(5) }).push,
  false);

// ── Shape 1: the catch-up post ──────────────────────────────────────────────
// The hook's final pass runs on UserPromptSubmit too, so a reply Stop failed
// to post lands the instant she sends her NEXT message. Its text predates the
// message she just sent, so it cannot be an answer to it.
is('a reply written before her newest message does not push',
  shouldPushReply({ working: false, replyCreated: t(31), lastHerAt: t(38), pushedAt: t(5) }).why,
  'predates-her-message');

// ── Shape 2: the queued message ─────────────────────────────────────────────
// She messages a chat that is mid-turn; the turn already running finishes
// seconds later. A real reply — to the message before hers.
is('the turn already running when she sent does not push',
  shouldPushReply({ working: false, replyCreated: t(20), lastHerAt: t(33, 40), pushedAt: t(5) }).push,
  false);

// ── Shape 3: a chat grinding on its own ─────────────────────────────────────
// Turn after turn nobody asked for. The first one answered her and pushed;
// everything after it is silent until she speaks again.
{
  const first = shouldPushReply({ working: false, replyCreated: t(34), lastHerAt: t(30), pushedAt: t(5) });
  is('first reply after her message pushes', first.why, 'answers-her');
  is('the next autonomous turn is silent',
    shouldPushReply({ working: false, replyCreated: t(48), lastHerAt: t(30), pushedAt: t(34) }).why,
    'already-answered');
  is('…and the one after that too',
    shouldPushReply({ working: false, replyCreated: t(59), lastHerAt: t(30), pushedAt: t(34) }).push,
    false);
  is('she speaks again → the answer pushes again',
    shouldPushReply({ working: false, replyCreated: t(59), lastHerAt: t(52), pushedAt: t(34) }).why,
    'answers-her');
}

// ── The four-minute follow-up the old 10-minute debounce swallowed ──────────
// Measured off her real threads: she messaged `update-tab-messaging` at 2:07pm
// and again at 2:11pm. The gate has no clock, so the second answer buzzes.
is('a follow-up four minutes later still pushes',
  shouldPushReply({ working: false, replyCreated: t(12), lastHerAt: t(11), pushedAt: t(7, 41) }).why,
  'answers-her');

// ── The safety net ──────────────────────────────────────────────────────────
// A session on an old enough hook never posts her messages at all, and that
// looks exactly like a chat she has never written to. Those keep the old
// behaviour rather than going quiet — a missed buzz is worse than a stray one.
is('a chat with no message from her on file still pushes',
  shouldPushReply({ working: false, replyCreated: t(34), lastHerAt: '', pushedAt: t(5) }).why,
  'no-message-on-file');
is('…even when it has pushed before',
  shouldPushReply({ working: false, replyCreated: t(34), lastHerAt: undefined, pushedAt: t(33) }).push,
  true);

// A chat that has never pushed and has heard from her: nothing to compare
// against, so her message arms it.
is('never pushed before → her message arms it',
  shouldPushReply({ working: false, replyCreated: t(34), lastHerAt: t(30), pushedAt: '' }).why,
  'answers-her');

// A reply landing in the same second she sent (an old hook posts her message
// ~1s before the reply it prompted — measured across her live threads, that
// is the normal shape, not an edge case).
is('the one-second gap an old hook produces still pushes',
  shouldPushReply({ working: false, replyCreated: t(34, 10), lastHerAt: t(34, 2), pushedAt: t(5) }).why,
  'answers-her');

// A finished reply carrying no `created` at all can't be judged; the honest
// answer is not to buzz for something we cannot place in time.
is('a reply with no timestamp does not push',
  shouldPushReply({ working: false, replyCreated: '', lastHerAt: t(30), pushedAt: t(5) }).push,
  false);

// ── THE BELL — which chats may buzz at all ──────────────────────────────────
// Sophie's whitelist (Aug 2026): "only the ones I clicked the bell on will
// notify me". Absent means SILENT, so every shape of missing has to read as
// off — a chat with no registry doc, a chat that predates the bell, and the
// two falsy-but-not-false values a hand-written POST could leave behind.
is('a belled chat may buzz', chatNotifies({ notify: true }), true);
is('a chat that has never been belled is silent', chatNotifies({}), false);
is('a chat with no registry doc at all is silent', chatNotifies(undefined), false);
is('an explicitly un-belled chat is silent', chatNotifies({ notify: false }), false);
// `notify` is compared to true, not merely truthy — a stray string on the doc
// must not be read as "she wants this one".
is('a non-boolean notify does not count as belled', chatNotifies({ notify: 'yes' }), false);
// The bell and the timing gate are INDEPENDENT: a chat can be belled and still
// have nothing worth buzzing about, and an answer to her is still silent
// without the bell. chatfeed.js asks the bell FIRST, so this pair is the whole
// decision.
{
  const answering = { working: false, replyCreated: t(34), lastHerAt: t(30), pushedAt: t(5) };
  is('belled + answering her = the one case that buzzes',
    chatNotifies({ notify: true }) && shouldPushReply(answering).push, true);
  is('belled but grinding on its own is still silent',
    chatNotifies({ notify: true })
      && shouldPushReply({ working: false, replyCreated: t(48), lastHerAt: t(30), pushedAt: t(34) }).push,
    false);
  is('answering her without the bell is silent',
    chatNotifies({ starred: true }) && shouldPushReply(answering).push, false);
}

// ── What the buzz SAYS ──────────────────────────────────────────────────────
// THE CASE FROM HER SCREENSHOT (2026-08-15, 3:01 pm). The reply opened with
// her question repeated verbatim in bold — the house *Answering a question*
// rule — and the push body was the reply's first line, so the banner read
// `**Can you give me a very brief rundown of how it works now?**`. Her own
// sentence, asterisks and all. Right timing, wrong words, and it is what she
// was reporting the whole time.
{
  const reply = [
    '**Can you give me a very brief rundown of how it works now?**',
    '',
    'When you message a chat, the server stamps that chat with your send time.',
    '',
    'That second half is what kills the send-time buzz.',
  ].join('\n');
  is('the bolded echo of her question is skipped',
    pushBody(reply, ''),
    'When you message a chat, the server stamps that chat with your send time.');
}

// Two questions answered in one reply — every bolded head is skipped, not
// just the first.
is('several bolded questions are all skipped',
  pushBody('**One?**\n**Two?**\nThe answer to both.', ''),
  'The answer to both.');

// A TLDR still wins, and it comes through as plain text.
is('a TLDR wins and loses its markdown',
  pushBody('**Her question?**\nbody', '**Shipped** the `push` gate'),
  'Shipped the push gate');

// A real opening line that merely CONTAINS bold is not an echo — bold plus
// ordinary text on the line is the shape of a normal sentence, not the
// question-repeat rule.
is('a line with bold plus text is kept',
  pushBody('**TLDR** — it is live now.\nmore', ''),
  'TLDR — it is live now.');

// Markdown that would otherwise show as literal characters on a lock screen.
is('links, headings, quotes and code are flattened',
  pushBody('## Done\n', ''),
  'Done');
is('a link is reduced to its text',
  pushBody('See [the PR](https://example.com/x) for the rest.', ''),
  'See the PR for the rest.');

// Degenerate replies must still say something rather than buzzing blank.
is('a reply that is nothing but a bolded question still says it',
  pushBody('**Only this?**', ''),
  'Only this?');
is('an empty reply is an empty body, not a crash',
  pushBody('', ''),
  '');


// ── A CHAT BLOCKED ON HER RINGS WITHOUT A BELL (2026-08-28, Sophie: "can u
// make chats bell themselves based on importance") ──────────────────────────
{
  const A = '2026-08-28T06:00:00.000Z';
  const B = '2026-08-28T07:00:00.000Z';
  is('no need at all → nothing to buzz about', needEscalates({}), false);
  is('a blank need is no need', needEscalates({ statusNeed: '  ', needSetAt: A }), false);
  // The whole point: a chat re-states its need at the end of EVERY turn, so
  // "a need exists" would buzz her on a loop for one ask.
  is('a need never stamped as changed → silent',
    needEscalates({ statusNeed: 'pick a take' }), false);
  is('a NEW ask → buzz',
    needEscalates({ statusNeed: 'pick a take', needSetAt: A }), true);
  is('the same ask, already buzzed → silent',
    needEscalates({ statusNeed: 'pick a take', needSetAt: A, needPushedAt: A }), false);
  is('a SECOND, different ask → buzz again',
    needEscalates({ statusNeed: 'now pick a cut', needSetAt: B, needPushedAt: A }), true);
  // Her bell is untouched: importance is a property of the moment, and a
  // self-set bell would stick forever and eat the whitelist.
  is('the escalation does not read her bell',
    needEscalates({ statusNeed: 'x', needSetAt: A, notify: false }), true);
  is('a missing registry is safe', needEscalates(null), false);
}

// ── WHAT THE BANNER SAYS (2026-08-28, Sophie: "and notification more
// informative") — the chat is always the title, the kind leads the body ─────
{
  const need = pushAlert('need', { chatName: 'Evan film', need: 'pick a take 1-4' });
  is('need: the chat is the title', need.title, 'Evan film');
  is('need: the ask leads the body', need.body, 'Needs you · pick a take 1-4');
  const film = pushAlert('video', { chatName: 'Evan film', title: 'Evan v18 (4:23)' });
  is('film: the chat is the title, not "New deliverable"', film.title, 'Evan film');
  is('film: the kind leads the body', film.body, 'New film · Evan v18 (4:23)');
  is('audio names itself',
    pushAlert('audio', { chatName: 'c', title: 'cut 3' }).body, 'New audio · cut 3');
  is('a page names itself',
    pushAlert('page', { chatName: 'c', title: 'Sheet v2' }).body, 'New page · Sheet v2');
  is('an unknown kind falls back rather than saying nothing',
    pushAlert('whatever', { chatName: 'c', title: 'x' }).body, 'New deliverable · x');
  is('an answer still leads with its TLDR',
    pushAlert('answer', { chatName: 'c', text: 'body', tldr: 'TLDR line' }).body, 'TLDR line');
  // The 2026-08-15 rule survives the move: a reply opening with her own
  // question in bold must never come back to her as the banner.
  is('and still skips her own bolded question',
    pushAlert('answer', { chatName: 'c', text: '**Can you fix it?**\nYes — done.' }).body,
    'Yes — done.');
  is('markdown is stripped from the name too',
    pushAlert('need', { chatName: '**Evan**', need: '`x`' }).title, 'Evan');
  is('a nameless chat still gets a title',
    pushAlert('need', { chatName: '', need: 'x' }).title, 'Deck Factory');
}

if (fails.length) {
  console.error(`\n${fails.length} FAILED (${pass} passed)\n`);
  for (const f of fails) console.error('  ✗ ' + f + '\n');
  process.exit(1);
}
console.log(`push gate: ${pass} checks passed`);
