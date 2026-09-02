// workday.js — WHICH WORKING DAY an instant belongs to, and the RUNS of days a
// piece of work spans. One copy, loaded by the server (chatfeed.js's work log)
// and served to the page at /workday.js — the pause-plan.js pattern.
//
// THE DAY TURNS OVER AT 5AM PACIFIC (2026-08-28, Sophie: "5am pst cut off").
// She works past midnight, so a reply at 2am belongs to the day she is still
// having. Read through the IANA zone, never a fixed -8: she says PST and it is
// PDT half the year. chats.html carries its own copy of this rule (dayKey);
// the two are pinned equal by scripts/test-worklog-page.js.
//
// A RUN is consecutive days of work with at most ONE quiet day inside it — a
// day off does not end a stretch, two do (2026-09-02, the work log's lumps:
// "some of them start and stop").
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.__workday = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  var TZ = 'America/Los_Angeles', CUT_H = 5, JOIN_GAP = 1;
  var _fmt = null;
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(iso) {
    var d = new Date(iso); if (!iso || isNaN(d.getTime())) return null;
    try {
      if (!_fmt) _fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ,
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
      var p = {}; _fmt.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      return { y: +p.year, m: +p.month, d: +p.day, h: (+p.hour) % 24 };
    } catch (e) { return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), h: d.getHours() }; }
  }
  function keyOfUTC(t) { var q = new Date(t); return q.getUTCFullYear() + '-' + pad2(q.getUTCMonth() + 1) + '-' + pad2(q.getUTCDate()); }
  // 'YYYY-MM-DD' of the working day an instant falls in.
  function dayKey(iso) {
    var p = stamp(iso); if (!p) return '';
    var t = Date.UTC(p.y, p.m - 1, p.d);
    if (p.h < CUT_H) t -= 86400000;
    return keyOfUTC(t);
  }
  function keyDate(key) { return Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)); }
  function addDays(key, n) { return keyOfUTC(keyDate(key) + n * 86400000); }
  function daysBetween(a, b) { return Math.round((keyDate(b) - keyDate(a)) / 86400000); }
  function today() { return dayKey(new Date().toISOString()); }
  function fmt(key, opt) {
    opt.timeZone = 'UTC';
    try { return new Intl.DateTimeFormat('en-US', opt).format(new Date(keyDate(key))); } catch (e) { return key; }
  }
  // Today · Yesterday · Tue, Aug 26 (the year only when it is not this one).
  function dayLabel(key) {
    var t = today();
    if (key === t) return 'Today';
    if (key === addDays(t, -1)) return 'Yesterday';
    var opt = { weekday: 'short', month: 'short', day: 'numeric' };
    if (key.slice(0, 4) !== t.slice(0, 4)) opt.year = 'numeric';
    return fmt(key, opt);
  }
  function shortDay(key) { return fmt(key, { month: 'short', day: 'numeric' }); }
  function monthLabel(key) { return fmt(key, { month: 'long', year: 'numeric' }); }
  function monthShort(key) { return fmt(key, { month: 'short' }); }
  // Sorted day keys → runs [{from, to, days:[keys]}], a gap of more than
  // JOIN_GAP quiet days starting a new one.
  function runsOf(keys) {
    var ks = (keys || []).slice().sort(), out = [], cur = null;
    ks.forEach(function (k) {
      if (cur && daysBetween(cur.to, k) <= JOIN_GAP + 1) { cur.to = k; cur.days.push(k); return; }
      cur = { from: k, to: k, days: [k] }; out.push(cur);
    });
    return out;
  }
  return { TZ: TZ, CUT_H: CUT_H, JOIN_GAP: JOIN_GAP, dayKey: dayKey, addDays: addDays,
    daysBetween: daysBetween, today: today, dayLabel: dayLabel, shortDay: shortDay,
    monthLabel: monthLabel, monthShort: monthShort, runsOf: runsOf };
}));
