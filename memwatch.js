/*
 * memwatch.js — the OOM tripwire (2026-08-25).
 *
 * The box has 512MB and the kernel's OOM kill is a SIGKILL: the process gets
 * no last word, Render's log line says only that memory ran out, and nothing
 * says WHICH REQUEST was in flight. That is exactly how the Panels cut
 * OOM-looped the site for half an hour with every chat diagnosing blind —
 * and the crashes continuing after that fix show something else still spikes.
 *
 * So the server watches itself: a ring of the last requests (path + time,
 * nothing private) and a 4s RSS check. Crossing the alert line (default
 * 400MB, MEM_ALERT_MB to move it) writes ONE snapshot — rss/heap/external +
 * the recent requests — to Firestore `forge-memwatch`, throttled to one
 * write per 5 minutes. The write happens BEFORE the kill can land, which is
 * the whole point: after the next mystery restart, the culprit's path is
 * sitting in a doc any chat can read.
 *
 * It never throws into a request and costs nothing measurable: one array
 * push per request, one memoryUsage() read per 4s, and a write only in the
 * minutes something is already going wrong.
 */
const RING_MAX = 40;
const ring = [];
let lastWrite = 0;

/*
 * GAUGES — the caches name themselves in every snapshot (2026-08-25, added
 * the morning after: a 2:04am OOM's snapshot showed heap at 244MB, up from
 * ~90MB two hours earlier, and NOTHING in the request ring or the sizable
 * known caches explained it — the chat search index measures only ~22MB.
 * A heap number without a suspect is half a snapshot). Any module holding a
 * long-lived in-memory structure registers a cheap size function here;
 * whichever count balloons alongside the heap is the leak, named.
 */
const gauges = {};
function gauge(name, fn) { gauges[name] = fn; }
function readGauges() {
  const out = {};
  for (const [name, fn] of Object.entries(gauges)) {
    try { out[name] = fn(); } catch (e) { /* a gauge must never hurt a snapshot */ }
  }
  return out;
}

function note(req) {
  ring.push({ t: Date.now(), m: req.method, p: String(req.originalUrl || req.url || '').slice(0, 120) });
  if (ring.length > RING_MAX) ring.shift();
}

function check(opts) {
  const mu = process.memoryUsage();
  if (mu.rss < opts.alertMb * 1048576) return null;
  const now = opts.now ? opts.now() : Date.now();
  if (now - lastWrite < opts.throttleMs) return null;
  lastWrite = now;
  return {
    at: now,
    rssMb: Math.round(mu.rss / 1048576),
    heapMb: Math.round(mu.heapUsed / 1048576),
    externalMb: Math.round(mu.external / 1048576),
    arrayBuffersMb: Math.round((mu.arrayBuffers || 0) / 1048576),
    upSec: Math.round(process.uptime()),
    gauges: readGauges(),
    recent: ring.slice(),
  };
}

function install(app, admin, opts = {}) {
  const o = {
    alertMb: Number(process.env.MEM_ALERT_MB) || opts.alertMb || 400,
    intervalMs: opts.intervalMs || 4000,
    throttleMs: opts.throttleMs || 5 * 60 * 1000,
    writer: opts.writer || ((snap) => {
      try {
        if (admin && admin.apps && admin.apps.length) {
          admin.firestore().collection('forge-memwatch').add(snap).catch(() => {});
        }
      } catch (e) { /* the tripwire must never hurt the server */ }
    }),
  };
  app.use((req, res, next) => { try { note(req); } catch (e) {} next(); });
  const timer = setInterval(() => {
    try {
      const snap = check(o);
      if (!snap) return;
      console.warn(`memwatch: RSS ${snap.rssMb}MB (heap ${snap.heapMb}, external ${snap.externalMb}) — snapshot filed`);
      o.writer(snap);
    } catch (e) { /* never throw from the watcher */ }
  }, o.intervalMs);
  timer.unref();
  return o;
}

// test hooks
function _reset() { ring.length = 0; lastWrite = 0; for (const k of Object.keys(gauges)) delete gauges[k]; }

module.exports = { install, note, check, gauge, ring, RING_MAX, _reset };
