// day-cut.js — WHICH WORKING DAY an instant belongs to, by Sophie's clock.
//
// Her day turns over at 5AM PACIFIC, not midnight (2026-08-28, Sophie:
// "separate chats by date" · "5am pst cut off"): she works past midnight, so
// a reply at 2am belongs to the day she is still having. The Chats page has
// carried this rule since the date headings shipped (`dayKey` in chats.html);
// this file is the same rule for the SERVER, so anything the server files
// under a day — the tray, first — lands on the day her headings will draw it
// under. Both copies are pinned to the same instants by tests
// (`test-day-cut.js` here, `test-chats-day-rules.js` for the page).
//
// Read through the IANA zone, never a fixed -8: she says PST and it is PDT
// half the year. The hour is asked in WALL-CLOCK terms — the hour as Los
// Angeles reads it — rather than by shifting the instant five hours, so it
// lands on 5am on a DST day too.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.__dayCut = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  var CUT_H = 5;
  var TZ = 'America/Los_Angeles';
  var fmt = null;
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function laStamp(iso) {
    var d = new Date(iso);
    if (!iso || isNaN(d.getTime())) return null;
    if (!fmt) fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
    var p = {};
    fmt.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    return { y: +p.year, m: +p.month, d: +p.day, h: (+p.hour) % 24 };
  }
  // 'YYYY-MM-DD' of the WORKING day an instant falls in. Anything before 5am
  // carries back to the day before. '' for an unreadable instant.
  function dayKey(iso) {
    var p = laStamp(iso);
    if (!p) return '';
    var t = Date.UTC(p.y, p.m - 1, p.d);
    if (p.h < CUT_H) t -= 86400000;
    var q = new Date(t);
    return q.getUTCFullYear() + '-' + pad2(q.getUTCMonth() + 1) + '-' + pad2(q.getUTCDate());
  }
  function today(now) { return dayKey(now || new Date().toISOString()); }
  return { dayKey: dayKey, today: today, CUT_H: CUT_H, TZ: TZ };
}));
