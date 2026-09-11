'use strict';
// clip-diff.js — WHAT CHANGED BETWEEN TWO CLIPS, the ONE rule.
//
// 2026-09-11, Sophie: "is there an easy way I can diff video clips like I
// can't remember what I changed for example sometimes it's a single line or
// a reference for the model the timing etc … It's always been Sophie clips
// since they're pretty similar. I can't remember what I was trying to fix."
//
// Every clip on the log already carries the exact prompt, the model, the
// seconds, the resolution, the shape, the seed and every reference url — so
// a diff is a READ of two cards and nothing new is stored. What this file
// adds is the comparison: a word-level diff of the two prompts (her Sophie
// clips share ~90% of their words, so a plain side-by-side hides the one
// line), one row per SETTING that moved, and the references matched slot by
// slot so a swapped picture reads as "swapped", not as two url changes.
//
// A REFERENCE IS NAMED, NEVER SHOWN AS A HASH. The caller hands in a resolver
// (the page builds one off the cast library — "sophie · the blue pajamas"),
// then the ref's own `name`, then the url's filename; a Storage filename is a
// random id and the diff says `[Image2]` beside the thumb instead.
//
// Pure: no network, no DOM. Loaded on the server (tests) and served to the
// footage page at /clip-diff.js (the pause-plan.js pattern), so the panel on
// the page and the test drive the identical arithmetic.
// Test: node scripts/test-clip-diff.js

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.__clipDiff = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  // ── WORDS ────────────────────────────────────────────────────────────────
  // Tokens are runs of non-space and runs of whitespace, so the diff can be
  // re-joined byte for byte: `same` tokens print as they were, and a newline
  // she put between two lines survives as a newline.
  function tokens(s) {
    return String(s == null ? '' : s).match(/\s+|[^\s]+/g) || [];
  }
  // LCS over words. Two prompts here are a few hundred words each, so the
  // table is small; past MAX the tail is compared as one block rather than
  // letting a pasted scene build a 10-million-cell table on a phone.
  var MAX = 1500;
  function wordDiff(a, b) {
    var A = tokens(a), B = tokens(b);
    if (A.length > MAX || B.length > MAX) {
      return [{ op: 'del', t: A.join('') }, { op: 'add', t: B.join('') }];
    }
    var n = A.length, m = B.length, i, j;
    var L = new Array(n + 1);
    for (i = 0; i <= n; i++) { L[i] = new Uint16Array(m + 1); }
    for (i = n - 1; i >= 0; i--) {
      for (j = m - 1; j >= 0; j--) {
        L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      }
    }
    var out = [];
    i = 0; j = 0;
    function push(op, t) {
      var last = out[out.length - 1];
      if (last && last.op === op) last.t += t; else out.push({ op: op, t: t });
    }
    while (i < n && j < m) {
      if (A[i] === B[j]) { push('same', A[i]); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { push('del', A[i]); i++; }
      else { push('add', B[j]); j++; }
    }
    while (i < n) { push('del', A[i++]); }
    while (j < m) { push('add', B[j++]); }
    // whitespace that only sits between two changed runs reads better as part
    // of the change than as a "same" island — merge a same-run that is blank
    // when it is flanked by changes on both sides
    var merged = [];
    for (var k = 0; k < out.length; k++) {
      var t = out[k];
      var prev = merged[merged.length - 1], next = out[k + 1];
      if (t.op === 'same' && !t.t.trim() && prev && prev.op !== 'same' && next && next.op !== 'same') {
        prev.t += t.t; continue;
      }
      if (prev && prev.op === t.op) prev.t += t.t; else merged.push({ op: t.op, t: t.t });
    }
    return merged;
  }
  function changedWords(d) {
    return d.reduce(function (n, t) { return n + (t.op === 'same' ? 0 : tokens(t.t).filter(function (x) { return x.trim(); }).length); }, 0);
  }

  // ── SETTINGS ─────────────────────────────────────────────────────────────
  // One row per field that MOVED. The words are the card's own (a model's
  // label, `480p`, `3:4`), so the panel reads like the tags line she already
  // knows. `sound` is left off — every clip drawn here has it — and a field
  // absent on BOTH sides says nothing.
  var FIELDS = [
    ['model', 'model', function (j) { return j.modelLabel || j.model || ''; }],
    ['seconds', 'seconds', function (j) { return j.seconds != null ? j.seconds + 's' : ''; }],
    ['resolution', 'size', function (j) { return j.resolution || ''; }],
    ['ratio', 'shape', function (j) { return j.ratio || ''; }],
    ['seed', 'seed', function (j) { return j.seed != null ? String(j.seed) : ''; }],
    ['door', 'door', function (j) { return j.door || ''; }],
    ['project', 'project', function (j) { return j.project || ''; }],
  ];
  function settingsDiff(a, b) {
    var out = [];
    FIELDS.forEach(function (f) {
      var va = f[2](a || {}), vb = f[2](b || {});
      if (va === vb) return;
      if (!va && !vb) return;
      out.push({ key: f[0], label: f[1], from: va, to: vb });
    });
    return out;
  }

  // ── REFERENCES ───────────────────────────────────────────────────────────
  // Matched SLOT BY SLOT in the doors' order (images, then videos, then
  // audio), the numbering the prompt names them by — so `[Image2]` on clip A
  // is compared against `[Image2]` on clip B. The keyframes (first/last) are
  // their own lane. Each row is `same` · `swapped` (a different picture in
  // that slot) · `added` (B has a slot A did not) · `removed`.
  var ORDER = { image: 0, video: 1, audio: 2 };
  var WORD = { image: 'Image', video: 'Video', audio: 'Audio' };
  function kindOf(r) {
    var k = String((r && r.kind) || '').toLowerCase();
    if (k === 'video' || k === 'audio' || k === 'image') return k;
    var u = String((r && r.url) || '').toLowerCase().split('?')[0];
    if (/\.(mp4|mov|webm|m4v)$/.test(u)) return 'video';
    if (/\.(m4a|mp3|wav|aac|ogg)$/.test(u)) return 'audio';
    return 'image';
  }
  function lanes(refs) {
    var slots = [], frames = { first: null, last: null };
    var n = { image: 0, video: 0, audio: 0 };
    (refs || []).map(function (r) { return { url: String(r.url || ''), kind: kindOf(r), poster: r.poster || '', name: r.name || '', role: r.role || '' }; })
      .filter(function (r) { return r.url; })
      .sort(function (a, b) { return ORDER[a.kind] - ORDER[b.kind]; })
      .forEach(function (r) {
        if (r.role === 'first' || r.role === 'last') { frames[r.role] = r; return; }
        n[r.kind] += 1;
        r.slot = '[' + WORD[r.kind] + n[r.kind] + ']';
        slots.push(r);
      });
    return { slots: slots, frames: frames };
  }
  // the filename with its extension off, or '' for a Storage id (long hex /
  // random) that would say nothing — the panel then shows the slot alone
  function tail(url) {
    var f = String(url || '').split('?')[0].split('/').pop() || '';
    try { f = decodeURIComponent(f); } catch (e) { /* keep as is */ }
    f = f.replace(/\.[a-z0-9]{2,5}$/i, '');
    if (!f || /^[a-f0-9-]{16,}$/i.test(f) || /^[A-Za-z0-9_-]{20,}$/.test(f)) return '';
    return f.slice(0, 40);
  }
  function nameOf(r, resolve) {
    if (!r) return '';
    var n = '';
    try { n = resolve ? String(resolve(r.url) || '') : ''; } catch (e) { n = ''; }
    return n || r.name || tail(r.url) || '';
  }
  function refsDiff(a, b, resolve) {
    var A = lanes(a && a.refs), B = lanes(b && b.refs);
    var rows = [];
    var byKind = { image: [[], []], video: [[], []], audio: [[], []] };
    A.slots.forEach(function (r) { byKind[r.kind][0].push(r); });
    B.slots.forEach(function (r) { byKind[r.kind][1].push(r); });
    ['image', 'video', 'audio'].forEach(function (k) {
      var la = byKind[k][0], lb = byKind[k][1];
      var len = Math.max(la.length, lb.length);
      for (var i = 0; i < len; i++) {
        var ra = la[i] || null, rb = lb[i] || null;
        var slot = (ra || rb).slot;
        var op = !ra ? 'added' : !rb ? 'removed' : ra.url === rb.url ? 'same' : 'swapped';
        rows.push({ slot: slot, kind: k, op: op, from: ra, to: rb,
          fromName: nameOf(ra, resolve), toName: nameOf(rb, resolve) });
      }
    });
    ['first', 'last'].forEach(function (role) {
      var ra = A.frames[role], rb = B.frames[role];
      if (!ra && !rb) return;
      var op = !ra ? 'added' : !rb ? 'removed' : ra.url === rb.url ? 'same' : 'swapped';
      rows.push({ slot: role + ' frame', kind: 'image', op: op, role: role, from: ra, to: rb,
        fromName: nameOf(ra, resolve), toName: nameOf(rb, resolve) });
    });
    return rows;
  }

  // ── THE WHOLE COMPARISON ─────────────────────────────────────────────────
  //   diff(older, newer, { resolve }) → { prompt, words, settings, refs, changed }
  // A is the OLDER clip and B the newer, so an `add` is what she put in.
  function diff(a, b, opts) {
    opts = opts || {};
    var prompt = wordDiff((a && a.prompt) || '', (b && b.prompt) || '');
    var settings = settingsDiff(a, b);
    var refs = refsDiff(a, b, opts.resolve);
    var words = changedWords(prompt);
    var refsMoved = refs.filter(function (r) { return r.op !== 'same'; }).length;
    return { prompt: prompt, words: words, settings: settings, refs: refs, refsMoved: refsMoved,
      changed: words > 0 || settings.length > 0 || refsMoved > 0 };
  }

  // A one-line account, in her words — what the panel's heading says and what
  // a chat can print: "3 words · seconds 8s → 12s · [Image2] swapped".
  function summary(d) {
    var parts = [];
    if (d.words) parts.push(d.words + (d.words === 1 ? ' word' : ' words'));
    d.settings.forEach(function (s) { parts.push(s.label + ' ' + (s.from || '—') + ' → ' + (s.to || '—')); });
    d.refs.forEach(function (r) { if (r.op !== 'same') parts.push(r.slot + ' ' + r.op); });
    return parts.length ? parts.join(' · ') : 'identical';
  }

  // THE CLIP BEFORE THIS ONE — the next older clip in the same project (a
  // clip with no project sits with the other unfiled ones), by sentAt. Most
  // redos are one clip chained off the last, so this is the default other
  // side; nothing older on hand answers null and the page asks the server.
  function previousOf(j, jobs) {
    if (!j) return null;
    var at = String(j.sentAt || '');
    var best = null;
    (jobs || []).forEach(function (o) {
      if (!o || o.id === j.id) return;
      if ((o.project || '') !== (j.project || '')) return;
      var oat = String(o.sentAt || '');
      if (!oat || oat >= at) return;
      if (!best || oat > String(best.sentAt || '')) best = o;
    });
    return best;
  }

  // NAMES OFF THE CAST LIBRARY — url → "character · look" over the shelf's
  // entries, the one place a reference has a name she gave it. A url on two
  // looks keeps the first; a wardrobe worn by several patients names the
  // wardrobe entry itself (the pajamas), which is what she would call it.
  function castNames(entries) {
    var by = {};
    (entries || []).forEach(function (e) {
      var looks = (e && e.looks) || [];
      looks.forEach(function (l) {
        (l.refs || []).forEach(function (r) {
          if (!r || !r.url || by[r.url]) return;
          var nm = String(e.name || e.slug || '');
          if (looks.length > 1 && l.name) nm += ' · ' + l.name;
          by[r.url] = nm;
        });
      });
    });
    return function (url) { return by[url] || ''; };
  }

  return { tokens: tokens, wordDiff: wordDiff, changedWords: changedWords, settingsDiff: settingsDiff,
    refsDiff: refsDiff, lanes: lanes, tail: tail, diff: diff, summary: summary, previousOf: previousOf, castNames: castNames };
}));
