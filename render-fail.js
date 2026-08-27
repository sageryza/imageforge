// WHAT A FAILED RUN SAYS TO SOPHIE (2026-08-27).
//
// A Playground run that drew nothing used to report the literal sentence
// "every gpt-image-2 render failed — see the server log" — an instruction she
// cannot follow, on the one card that exists to tell her what happened. The
// real reason (a moderation refusal, a timeout, a 500, a rate limit) was
// console.warn'd inside the per-render catch and then discarded, so the only
// fact worth having lived for the length of one request.
//
// Measured that day on her own failed run (HPpZc0SkXJtbj8Ukl1lN, 5:22am): the
// identical prompt, style reference and photo re-sent by hand came back with a
// picture, first try — so the failure was transient and she was right to tap
// Generate again. That is exactly the call this message has to let her make:
// tap again, or change the prompt. The two read completely differently and the
// old sentence said neither.
//
// Pure and dependency-free so it can be tested without a network or a server.
'use strict';

const MAX = 300;   // the card draws this under the prompt — long enough to
                   // carry OpenAI's own sentence, short enough to read.

// Everything about this is about NOT losing the sentence:
//  · the API's own words lead, verbatim, because they are the answer;
//  · identical errors collapse (four renders refused the same way is one
//    fact, not four), and the COUNT rides behind it — "3 of 4" is the
//    difference between a bad prompt and a bad minute;
//  · a run that genuinely said nothing falls back, without pointing her at a
//    log she has no way to open.
function renderFailMessage(errs, want = 1) {
  const clean = (Array.isArray(errs) ? errs : [])
    .map(e => String(e == null ? '' : e).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!clean.length) return cap('every gpt-image-2 render failed');
  const uniq = [...new Set(clean)];
  const n = Math.max(Number(want) || 1, clean.length);
  // One render asked for, one thing to say: the sentence alone. A count of
  // "1 of 1" is noise in front of the only line that matters.
  if (n <= 1 && uniq.length === 1) return cap(uniq[0]);
  const also = uniq.length > 1 ? ` · also: ${uniq.slice(1).join(' · ')}` : '';
  return cap(`${uniq[0]} (${clean.length} of ${n} renders)${also}`);
}

function cap(s) {
  return s.length <= MAX ? s : `${s.slice(0, MAX - 1).trimEnd()}…`;
}

module.exports = { renderFailMessage, MAX };
