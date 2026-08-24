/* tritoggle.js — WHERE SHE TAPPED IS THE STOP SHE MEANT.
 *
 * 2026-08-24, Sophie: "when I click the low medium high toggle in playground,
 * it always goes to high from medium never low even if I click it on that
 * side". Correct, and it was true of every copy: the three-way toggle
 * (/tritoggle.css) had never read WHERE the tap landed. Each page's handler
 * was `next = (cur + 1) % count` — a CYCLE — so on medium every tap went to
 * high, including a tap on the L at the far left. Nothing about the control
 * says that: it is 78px wide with the value written on the knob and three
 * legible stops, so it reads as a thing you aim at, not a thing you advance.
 *
 * THE RULE, and it is the whole of it:
 *
 *   - a tap with a coordinate lands on the STOP UNDER THE THUMB (the track is
 *     divided into `count` equal zones — the same arithmetic the CSS uses to
 *     place the knob, so what she aims at and where the knob goes agree);
 *   - a tap with NO coordinate advances one stop. That is the KEYBOARD and
 *     nothing else: Enter/Space fire a click with `detail === 0` and clientX 0,
 *     and a control that did nothing there would be unreachable without a
 *     pointer.
 *
 * A TAP ON THE STOP SHE IS ALREADY ON DOES NOTHING, deliberately. Advancing
 * from there is exactly the surprise this file exists to remove — she aimed at
 * medium, so medium is the answer, not high.
 *
 * NO TOGGLE CYCLES ON A TAP — NOT ONE, INCLUDING THE BLANK-KNOB ONE
 * (2026-08-24, Sophie's second pass: "it also applies to the account thing
 * because none of them should cycle — that's a really stupid pattern ...
 * Cycling is a bad idea"). This file shipped hours earlier carving out the
 * account switcher in chats.html on the reasoning that a blank knob gives her
 * nothing to aim AT. That carve-out is gone: its stops are ordered 1·2·3 left
 * to right and the knob shows which one it is on, which is a target; and a
 * control where account 3 costs two taps from account 1 is the same complaint
 * she made about the Playground, in a narrower box. Its zones are 16px on a
 * 48px track — small, and worth widening if she ever asks — but small beats
 * unpredictable.
 *
 * A LABEL BESIDE A ROW IS NOT A THIRD BEHAVIOUR EITHER. The Chats search
 * filters spell their value out next to the knob; that word can't aim (it is
 * nowhere near the stop it names), so it CLEARS the filter back to its neutral
 * stop rather than stepping. See `buildFilters` in chats.html.
 *
 * `cur` may be -1 — every caller floors an unknown value's `indexOf`, so a
 * value the toggle has never heard of still has somewhere to go (the first
 * notch) rather than doing nothing at all.
 */
(function () {
  // The stop under a tap, or null when the event carries no usable position.
  function triStop(el, count, ev) {
    if (!el || !(count > 1)) return null;
    if (!ev || ev.detail === 0 || typeof ev.clientX !== 'number') return null;
    var r = el.getBoundingClientRect();
    if (!r.width) return null;
    var x = ev.clientX - r.left;
    if (x < 0 || x > r.width) return null;
    var i = Math.floor(x / (r.width / count));
    return Math.max(0, Math.min(count - 1, i));
  }

  // The stop a tap should leave the toggle on: the one under the thumb, or the
  // next one when the tap carries no position at all (the keyboard).
  function triNext(el, count, ev, cur) {
    var aimed = triStop(el, count, ev);
    if (aimed !== null) return aimed;
    return ((cur | 0) + 1 + count) % count;
  }

  window.triStop = triStop;
  window.triNext = triNext;
})();
