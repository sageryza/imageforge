#!/usr/bin/env node
// WHAT A FAILED PLAYGROUND RUN SAYS TO SOPHIE — render-fail.js, pure, no
// node_modules and no network. (2026-08-27, from her screenshot of the
// Playground list: a run reading "every gpt-image-2 render failed — see the
// server log", which is an instruction she cannot follow.)
//
// The rules:
//   1. the API's own sentence leads, VERBATIM — it is the answer, and it is
//      what tells her whether to tap Generate again or change the prompt,
//   2. identical errors collapse and the COUNT rides behind them ("3 of 4"
//      is the difference between a bad prompt and a bad minute); a lone
//      render says its sentence alone, with no "1 of 1" in front of it,
//   3. different errors are all carried — losing one is how a run reads as
//      a mystery,
//   4. a run that genuinely said nothing falls back, and the fallback NEVER
//      points her at the server log,
//   5. and the wiring: server.js's gpt job asks this rather than throwing a
//      hardcoded sentence — pinned against the source, or the log line can
//      quietly come back.
//
//   node scripts/test-render-fail.js
const fs = require('fs');
const path = require('path');
const { renderFailMessage, MAX } = require('../render-fail');

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

// ── 1. the sentence leads, verbatim ─────────────────────────────────
const REFUSAL = 'Your request was rejected as a result of our safety system.';
ok(renderFailMessage([REFUSAL], 1) === REFUSAL,
  'one render, one error: OpenAI\'s own sentence, alone and unchanged');
ok(!/1 of 1/.test(renderFailMessage([REFUSAL], 1)),
  'no "1 of 1" in front of the only line that matters');
ok(renderFailMessage(['socket hang up'], 1) === 'socket hang up',
  'a timeout reads as a timeout — she can tell that apart from a refusal');

// ── 2. identical errors collapse, and the count rides behind ────────
const four = renderFailMessage([REFUSAL, REFUSAL, REFUSAL, REFUSAL], 4);
ok(four.startsWith(REFUSAL), 'four identical refusals still lead with the sentence');
ok(four.indexOf(REFUSAL, 1) === -1, 'said once, not four times');
ok(/\(4 of 4 renders\)/.test(four), 'and the count says all four went');
const partial = renderFailMessage([REFUSAL, REFUSAL], 4);
ok(/\(2 of 4 renders\)/.test(partial),
  'a partial count is honest about how many of the asked-for renders died');

// ── 3. different errors are all carried ─────────────────────────────
const mixed = renderFailMessage([REFUSAL, 'socket hang up'], 2);
ok(mixed.startsWith(REFUSAL) && /socket hang up/.test(mixed),
  'two different failures both survive — neither is dropped');

// ── 4. the fallback never sends her to a log ────────────────────────
for (const empty of [[], null, undefined, [''], ['   ', null]]) {
  const m = renderFailMessage(empty, 1);
  ok(!!m && !/server log/i.test(m),
    `nothing to say (${JSON.stringify(empty)}) → a plain sentence, never "see the server log"`);
}

// ── 5. it stays readable on the card ────────────────────────────────
const long = renderFailMessage(['x'.repeat(900)], 1);
ok(long.length <= MAX, `a very long API error is capped at ${MAX} chars`);
ok(long.endsWith('…'), 'and says it was cut');
ok(/^a b c$/.test(renderFailMessage(['  a\n b\t\tc  '], 1)),
  'newlines and runs of whitespace are flattened — one line under the prompt');

// ── 6. the wiring: server.js asks this ──────────────────────────────
const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
ok(/require\(['"]\.\/render-fail['"]\)/.test(src),
  'server.js requires render-fail.js');
ok(/if \(!images\.length\) throw new Error\(renderFailMessage\(/.test(src),
  'the gpt job throws the real message, not a hardcoded one');
ok(!/every gpt-image-2 render failed — see the server log/.test(src),
  'and the "see the server log" sentence is gone from server.js');
ok(/errs\.push\(/.test(src),
  'the per-render catch keeps the error instead of only warning about it');

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
