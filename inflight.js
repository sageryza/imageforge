'use strict';
// ONE REGISTER OF WORK A RESTART WOULD KILL (2026-09-14, Sophie: "make sure
// the deploy guard waits for footage sends and anything else that would cause
// a problem").
//
// The deploy guard and the SIGTERM hold already read `drawingNow`/`cuttingNow`
// — the Playground's own two sets, living in server.js — so those were the
// only two kinds of work a deploy waited for. Everything else on this box was
// invisible to both: a FOOTAGE SEND above all (her money, at a door that has
// already charged her by the time the process dies, with nothing written
// down), and every ffmpeg render, bake and paid sweep beside it. A deploy
// landing inside one of those windows kills it, and the guard says "nothing
// drawing or cutting" while it does.
//
// So work registers itself here instead of each caller inventing a set, and
// the three readers — GET /api/promptlab/inflight, the guard, the SIGTERM
// hold — ask this one register. A new kind of work is ONE line at the place
// it starts (`inflight.track('name', fn)`), never a new counter to thread
// through server.js.
//
// THE COUNT IS IN MEMORY AND IS PER PROCESS, deliberately: the question both
// readers ask is "would killing THIS process lose something", which is a fact
// about this process and nothing else. A doc that says `running` may belong
// to an instance that is already gone (that is what every module's own stale
// sweep is for) — reading those back would hold a deploy for a job nobody is
// holding.
//
// IT CAN NEVER FAIL THE WORK IT WRAPS. `track` is transparent: it returns
// exactly what the function returns and rethrows exactly what it throws, and
// the register is decremented in a `finally`, so a throw can never leave a
// phantom holding the deploy forever.

const live = new Map();   // name -> count
let seq = 0;

function add(name) {
  const k = String(name || 'work');
  live.set(k, (live.get(k) || 0) + 1);
  seq++;
  return k;
}

function done(k) {
  const n = live.get(k) || 0;
  if (n <= 1) live.delete(k); else live.set(k, n - 1);
}

// Wrap one piece of work. Returns the function's own answer, untouched.
async function track(name, fn) {
  const k = add(name);
  try { return await fn(); } finally { done(k); }
}

// The manual form, for work whose start and end are not one call.
function begin(name) {
  const k = add(name);
  let over = false;
  return () => { if (!over) { over = true; done(k); } };
}

function counts() { return Object.fromEntries(live); }
function total() { let n = 0; for (const v of live.values()) n += v; return n; }
function names() { return Array.from(live.keys()).sort(); }

module.exports = { track, begin, counts, total, names };
