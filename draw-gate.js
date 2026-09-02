'use strict';
// HOW MANY gpt-image DRAWS MAY BE IN FLIGHT AT ONCE — decided by the memory
// this box actually has left, never by a fixed number. Pure, so the rule has
// a test that needs no server.
//
// THE CASE (2026-09-02, 9:58pm Pacific, Sophie's first {curly-bracket} run):
// the permutation expanded to four prompts and the page fired all four at
// once, which is right — the draw happens on OpenAI's hardware. But each of
// the four was an EDIT carrying the 8.5MB `sage-sandy-mirror.png` reference
// in its multipart body, and the box was idling at 427MB of its 512 (fresh
// boot is ~190; it had crept up over 35 minutes with nothing running).
// Render's own event: `server_failed … oomKilled {memoryLimit: 512Mi}`, two
// seconds after the batch started. Four paid draws died with the process.
//
// So a draw is ADMITTED, not merely started: while the box has room, any
// number run together; as it fills, they go through one or two at a time.
// The floor is ONE — she must always be able to draw — so a box that sits
// high forever still drains, serially, instead of refusing her.
//
// The numbers: `perDraw` is the transient a single-picture edit costs — the
// body, the ~1.4MB base64 answer parsed to JSON, the decoded Buffer, the
// upload — measured only as "four of them took 427MB past 512"; 25MB apiece
// is that observation with a margin, not a probe. `reserve` is headroom left
// for everything else the process does in the same second (a thumb, a feed
// read). `cap` is the most that will ever run at once even on an empty box,
// so a 12-prompt permutation cannot become 12 bodies in flight.
const LIMIT_MB = 512;
const RESERVE_MB = 40;
const PER_DRAW_MB = 25;
const CAP = 6;
const MB = 1024 * 1024;

function slotsFor(rssBytes, o) {
  const opt = o || {};
  const limit = (opt.limitMB || LIMIT_MB) * MB;
  const reserve = (opt.reserveMB || RESERVE_MB) * MB;
  const per = (opt.perDrawMB || PER_DRAW_MB) * MB;
  const cap = opt.cap || CAP;
  const rss = Number(rssBytes) || 0;
  const room = limit - reserve - rss;
  return Math.max(1, Math.min(cap, Math.floor(room / per)));
}

// The runner. `rss()` is asked on every check so the answer follows the
// box, not the moment the draw was queued; `wait(ms)` is injectable for the
// test. A draw that cannot be admitted polls — never a queue that promises
// order, because the slot count moves and a strict FIFO would hold a small
// draw behind a big one for no reason.
function makeGate(o) {
  const opt = o || {};
  const rss = opt.rss || (() => process.memoryUsage().rss);
  const wait = opt.wait || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const tick = opt.tickMs || 500;
  const active = new Set();
  async function run(id, fn) {
    // FIRST-COME: a draw that arrived earlier is not made to wait behind a
    // later one — `waiting` is the order they asked in, and a draw only
    // takes a slot when it is at the front. Without this, a burst of four
    // polls in lockstep and whichever timer fires first wins.
    const me = Symbol(id);
    waiting.push(me);
    try {
      while (waiting[0] !== me || active.size >= slotsFor(rss(), opt)) await wait(tick);
    } finally { waiting.shift(); }
    active.add(id);
    try { return await fn(); } finally { active.delete(id); }
  }
  const waiting = [];
  return { run, active, slots: () => slotsFor(rss(), opt), waiting: () => waiting.length };
}

module.exports = { slotsFor, makeGate, LIMIT_MB, RESERVE_MB, PER_DRAW_MB, CAP };
