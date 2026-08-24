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
 *   - a tap with NO coordinate cycles to the next stop. That is the keyboard
 *     (Enter/Space fire a click with `detail === 0` and clientX 0), and it is
 *     also the label beside a filter row, which is part of the control but is
 *     nowhere near the stop it names.
 *
 * A TAP ON THE STOP SHE IS ALREADY ON DOES NOTHING, deliberately. Advancing
 * from there is exactly the surprise this file exists to remove — she aimed at
 * medium, so medium is the answer, not high.
 *
 * A BLANK-KNOB TOGGLE KEEPS CYCLING, and that is not an oversight: the account
 * switcher in chats.html has no letter on its knob and no words beside it, so
 * there is nothing on screen to aim AT — it is a 48px control whose result is
 * named by a toast after the tap. Aim needs something legible to aim at. Any
 * toggle whose stops are readable (quality, size, the search filters) uses
 * `triNext`.
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
  // next one when the tap has no position (keyboard, a label beside the row).
  function triNext(el, count, ev, cur) {
    var aimed = triStop(el, count, ev);
    if (aimed !== null) return aimed;
    return ((cur | 0) + 1 + count) % count;
  }

  window.triStop = triStop;
  window.triNext = triNext;
})();
