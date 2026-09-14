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
  function words(s) {
    return String(s == null ? '' : s).toLowerCase().match(/[a-z0-9\[\]']+/g) || [];
  }
  // HOW ALIKE TWO TEXTS ARE — the share of distinct words they have in common
  // (Jaccard). 1 is the same words, 0 is nothing shared. It is what decides
  // whether two lines are worth word-diffing against each other at all, and
  // whether an older clip is a REDO of this one or a different shot.
  function similarity(a, b) {
    var A = {}, B = {}, n = 0, u = 0;
    words(a).forEach(function (w) { A[w] = 1; });
    words(b).forEach(function (w) { B[w] = 1; });
    Object.keys(A).forEach(function (w) { u += 1; if (B[w]) n += 1; });
    Object.keys(B).forEach(function (w) { if (!A[w]) u += 1; });
    return u ? n / u : 1;
  }
  // generic LCS over two arrays with an equality test → ops of same/del/add
  var MAX = 1500;
  function lcs(A, B, eq) {
    var n = A.length, m = B.length, i, j;
    if (n > MAX || m > MAX) {
      return A.map(function (x, i) { return { op: 'del', v: x, i: i }; }).concat(B.map(function (x, j) { return { op: 'add', v: x, j: j }; }));
    }
    var L = new Array(n + 1);
    for (i = 0; i <= n; i++) { L[i] = new Uint16Array(m + 1); }
    for (i = n - 1; i >= 0; i--) {
      for (j = m - 1; j >= 0; j--) {
        L[i][j] = eq(A[i], B[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      }
    }
    var out = [];
    i = 0; j = 0;
    while (i < n && j < m) {
      if (eq(A[i], B[j])) { out.push({ op: 'same', v: A[i], w: B[j], i: i, j: j }); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { out.push({ op: 'del', v: A[i], i: i }); i++; }
      else { out.push({ op: 'add', v: B[j], j: j }); j++; }
    }
    while (i < n) { out.push({ op: 'del', v: A[i], i: i }); i++; }
    while (j < m) { out.push({ op: 'add', v: B[j], j: j }); j++; }
    return out;
  }
  function push(out, op, t) {
    if (!t) return;
    var last = out[out.length - 1];
    if (last && last.op === op) last.t += t; else out.push({ op: op, t: t });
  }
  // WORD DIFF OF ONE LINE AGAINST ONE LINE — only ever called on two lines
  // that are near-twins, which is what keeps "the" in one paragraph from
  // being lined up with "the" in an unrelated one.
  function wordDiffLine(a, b) {
    var out = [];
    lcs(tokens(a), tokens(b), function (x, y) { return x === y; }).forEach(function (o) {
      push(out, o.op, o.v);
    });
    // whitespace sitting between two changed runs reads as part of the change
    var merged = [];
    for (var k = 0; k < out.length; k++) {
      var t = out[k], prev = merged[merged.length - 1], next = out[k + 1];
      if (t.op === 'same' && !t.t.trim() && prev && prev.op !== 'same' && next && next.op !== 'same') { prev.t += t.t; continue; }
      if (prev && prev.op === t.op) prev.t += t.t; else merged.push({ op: t.op, t: t.t });
    }
    return merged;
  }
  // LINES FIRST, WORDS SECOND (2026-09-11, her screenshot: a whole-prompt word
  // LCS over two unrelated clips lined up every "the" and "a" and painted
  // the rest as a hash of green and rose — "text looks wrong. It should call
  // out exactly what changed"). So the prompt is diffed as LINES: a line
  // that is the same is same; a line that was REPLACED by a near-twin (over
  // LINE_TWIN alike) is word-diffed against its twin so the one changed word
  // lights up; anything else is a whole line out or a whole line in. A
  // reworded sentence reads as "these words changed"; a new paragraph reads
  // as a new paragraph.
  var LINE_TWIN = 0.5;
  function wordDiff(a, b) {
    var A = String(a == null ? '' : a).split('\n'), B = String(b == null ? '' : b).split('\n');
    var ops = lcs(A, B, function (x, y) { return x === y; });
    var out = [];
    // THE NEWLINE AFTER A LINE BELONGS TO THE SIDE THAT HAS A LINE AFTER IT —
    // that is what lets the diff re-join byte for byte to BOTH prompts: a
    // paragraph added at the end brings its own break in as an add, and the
    // last line of either side carries none.
    function br(i, j) {
      var na = i != null && i < A.length - 1, nb = j != null && j < B.length - 1;
      if (na && nb) push(out, 'same', '\n');
      else if (na) push(out, 'del', '\n');
      else if (nb) push(out, 'add', '\n');
    }
    var k = 0;
    while (k < ops.length) {
      var o = ops[k];
      if (o.op === 'same') { push(out, 'same', o.v); br(o.i, o.j); k++; continue; }
      // gather the run of dels then adds, pair them in order by similarity
      var dels = [], adds = [];
      while (k < ops.length && ops[k].op !== 'same') { (ops[k].op === 'del' ? dels : adds).push(ops[k]); k++; }
      var di = 0, ai = 0;
      while (di < dels.length || ai < adds.length) {
        var d = di < dels.length ? dels[di] : null, ad = ai < adds.length ? adds[ai] : null;
        if (d && ad && d.v.trim() && ad.v.trim() && similarity(d.v, ad.v) >= LINE_TWIN) {
          wordDiffLine(d.v, ad.v).forEach(function (t) { push(out, t.op, t.t); });
          br(d.i, ad.j); di++; ai++;
        } else if (d) {
          push(out, 'del', d.v); br(d.i, null); di++;
        } else {
          push(out, 'add', ad.v); br(null, ad.j); ai++;
        }
      }
    }
    return out;
  }
  function changedWords(d) {
    return d.reduce(function (n, t) { return n + (t.op === 'same' ? 0 : tokens(t.t).filter(function (x) { return x.trim(); }).length); }, 0);
  }

  // ── ONLY WHAT MOVED ──────────────────────────────────────────────────────
  // 2026-09-14, Sophie: "default ONLY shows diff - expand button to see whole
  // prompt". The diff re-joins byte for byte, so it can be cut back into
  // LINES with each line carrying its own ops — and a line holding nothing
  // but `same` is a line she did not touch. The panel draws the changed lines
  // and puts the whole prompt behind an opener.
  //
  // A LINE IS MARKED BY ITS OWN TEXT, NEVER BY THE BREAK THAT ENDS IT. An
  // added paragraph brings its own newline in as an `add`, and that newline
  // sits at the END of the line before it — so counting the break would light
  // the untouched line above every paragraph she ever added.
  function promptLines(d) {
    var lines = [{ ops: [], changed: false }];
    (d || []).forEach(function (t) {
      String(t.t).split('\n').forEach(function (p, i) {
        if (i) lines.push({ ops: [], changed: false });
        if (!p) return;
        var cur = lines[lines.length - 1];
        cur.ops.push({ op: t.op, t: p });
        if (t.op !== 'same') cur.changed = true;
      });
    });
    return lines;
  }
  function changedLines(d) {
    return promptLines(d).filter(function (l) { return l.changed; });
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
    // a HASH is one unbroken run of letters and digits; a readable name has
    // separators in it — `sophie-blue-pajamas-front` is not a hash however
    // long it is (2026-09-14; the old rule blanked any name over 20 characters)
    if (!f || /^[a-f0-9-]{16,}$/i.test(f) || /^[A-Za-z0-9]{20,}$/.test(f)) return '';
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
      kin: isKin(a, b), alike: similarity(a && a.prompt, b && b.prompt),
      changed: words > 0 || settings.length > 0 || refsMoved > 0 };
  }

  // A one-line account, in her words — what the panel's heading says and what
  // a chat can print: "3 words · seconds 8s → 12s · [Image2] swapped".
  function summary(d) {
    var parts = [];
    if (d.kin === false && d.words) parts.push('a different prompt');
    else if (d.words) parts.push(d.words + (d.words === 1 ? ' word' : ' words'));
    d.settings.forEach(function (s) { parts.push(s.label + ' ' + (s.from || '—') + ' → ' + (s.to || '—')); });
    d.refs.forEach(function (r) { if (r.op !== 'same') parts.push(r.slot + ' ' + r.op); });
    return parts.length ? parts.join(' · ') : 'identical';
  }

  // THE CLIP BEFORE THIS ONE — the nearest OLDER clip in the same project
  // whose prompt is a near-twin of this one (over KIN alike): a redo, which
  // is what "what did I change" is about. The clip immediately before it in
  // time is often a different shot altogether (her screenshot: a 4s failed
  // 3:4 clip before a 15s 9:16 one), and a diff against that is noise. With
  // no twin on hand it answers the plain previous clip, marked `kin:false`,
  // so the panel can say so rather than word-diff two unrelated prompts.
  var KIN = 0.4;
  function older(j, jobs) {
    var at = String(j.sentAt || '');
    return (jobs || []).filter(function (o) {
      // never a clip she put away, and never one that did not draw — a refused
      // twin of the same words is a perfect kin and the panel would open on a
      // clip that never existed saying "nothing changed" (2026-09-14)
      return o && o.id !== j.id && !o.hidden && o.status !== 'failed'
        && (o.project || '') === (j.project || '') && String(o.sentAt || '') && String(o.sentAt || '') < at;
    }).sort(function (a, b) { return String(b.sentAt || '').localeCompare(String(a.sentAt || '')); });
  }
  function kinOf(j, jobs) {
    if (!j) return null;
    var list = older(j, jobs);
    for (var i = 0; i < list.length; i++) {
      if (similarity(j.prompt, list[i].prompt) >= KIN) return { job: list[i], kin: true, back: i + 1 };
    }
    return list.length ? { job: list[0], kin: false, back: 1 } : null;
  }
  function previousOf(j, jobs) {
    var k = kinOf(j, jobs);
    return k ? k.job : null;
  }
  function isKin(a, b) { return similarity(a && a.prompt, b && b.prompt) >= KIN; }

  // ── EVERY CLIP LIKE THIS ONE ─────────────────────────────────────────────
  // 2026-09-14, Sophie: "shows ALL clips with similar prompt, including parts
  // of it". `kinOf` answers ONE clip — the nearest older twin — which is the
  // right thing to OPEN on and the wrong answer to "which other clips are
  // this shot". A relative is measured two ways and the better number counts:
  //   · `alike` — the whole prompt's Jaccard: a redo of the same words.
  //   · `part`  — the share of THIS clip's WORDS sitting in a line the other
  //     clip also carries. That is what finds a clip holding one paragraph of
  //     it ("including parts of it"), where the whole-prompt number is far
  //     under any bar worth setting.
  // `part` IS WEIGHTED BY EACH LINE'S LENGTH, deliberately. Every clip in a
  // film shares the boilerplate ("camera at eye level", "no text on screen"),
  // so counting LINES would put a quarter score on every unrelated clip in
  // the project and the list would be the project.
  var PART = 0.25;
  function lineList(s) {
    return String(s == null ? '' : s).split('\n').map(function (l) { return l.trim(); })
      .filter(function (l) { return words(l).length >= 2; });
  }
  // A LINE EVERY CLIP CARRIES SAYS NOTHING. Every ward prompt ends "camera at
  // eye level"; weighing lines by their words alone makes that line a quarter
  // of a short prompt, so every unrelated clip in the film clears the bar and
  // the list IS the project. So a line's weight is its words discounted by how
  // much of the pool carries it (plain IDF over the candidates themselves) —
  // a line on all of them is worth nothing, one on a couple is worth its
  // words. Under four candidates there is no corpus to measure and the raw
  // word count stands.
  function lineWeights(prompt, jobs) {
    var A = lineList(prompt);
    var pool = (jobs || []).filter(function (o) { return o && o.prompt; });
    return A.map(function (l) {
      var w = words(l).length;
      if (pool.length < 4) return { line: l, w: w };
      var n = 0;
      pool.forEach(function (o) {
        var B = lineList(o.prompt);
        for (var i = 0; i < B.length; i++) { if (similarity(l, B[i]) >= LINE_TWIN) { n += 1; return; } }
      });
      return { line: l, w: w * (1 - n / pool.length) };
    });
  }
  function shareOf(a, b, weights) {
    var A = weights || lineWeights(a, null), B = lineList(b), hit = 0, all = 0, n = 0;
    A.forEach(function (e) {
      all += e.w;
      for (var i = 0; i < B.length; i++) {
        if (similarity(e.line, B[i]) >= LINE_TWIN) { hit += e.w; n += 1; return; }
      }
    });
    return { shared: n, lines: A.length, part: all ? hit / all : 0 };
  }
  function related(a, b, weights) {
    // AN EMPTY PROMPT IS NOT LIKE ANYTHING. `similarity('','')` is 1 by its
    // own arithmetic (nothing differs), which would file two promptless clips
    // as "the same words".
    if (!words(a && a.prompt).length || !words(b && b.prompt).length) {
      return { alike: 0, part: 0, shared: 0, lines: 0, score: 0, kin: false };
    }
    var alike = similarity(a.prompt, b.prompt);
    var s = shareOf(a.prompt, b.prompt, weights);
    return { alike: alike, part: s.part, shared: s.shared, lines: s.lines,
      score: Math.max(alike, s.part), kin: alike >= KIN };
  }
  // HOW MUCH OF IT, in a word — what the tile under the pair says.
  // THE WORD COMES OFF `alike`, NEVER OFF THE RANKING SCORE. `part` saturates
  // at 1 for any redo — every line of a clip with one word changed still has
  // its twin — so a score-read word called every redo "the same words".
  function shareWord(r) {
    if (!r) return '';
    if (r.alike >= 0.98) return 'the same words';
    if (r.alike >= 0.8) return 'nearly all of it';
    if (r.alike >= 0.55) return 'most of it';
    return 'part of it';
  }
  // Every clip in `j`'s project over the bar, best first. NEWER ONES ARE IN
  // TOO — "all clips with similar prompt" is not a walk backwards, and she
  // may be standing on an older clip asking what it became. A clip she put
  // away stays away; a REFUSED one is listed (it never drew, so it is a bad
  // thing to open on by default — `kinOf` still skips it — but "what did I
  // change since the one that came back refused" is the question).
  function relatives(j, jobs, opts) {
    opts = opts || {};
    var min = opts.min != null ? opts.min : PART;
    var out = [];
    if (!j) return out;
    var pool = (jobs || []).filter(function (o) {
      return o && o.id && o.id !== j.id && !o.hidden && (o.project || '') === (j.project || '');
    });
    var weights = lineWeights(j.prompt, pool);
    pool.forEach(function (o) {
      var r = related(j, o, weights);
      // EITHER BAR, NEVER THE BETTER NUMBER AGAINST ONE BAR. The whole-prompt
      // Jaccard carries the boilerplate too — a clip sharing only "camera at
      // eye level, no text on screen" reads ~0.36 alike against a short
      // prompt — so one bar over `max(alike, part)` lists the project again
      // however well `part` is weighted. A relative is a REDO (alike over
      // KIN) or a clip carrying a real PART of it (part over PART, where
      // boilerplate is already discounted to nothing). The score is still the
      // better of the two: that is the ranking, not the gate.
      if (!(r.alike >= KIN || r.part >= min)) return;
      r.job = o;
      r.older = String(o.sentAt || '') < String(j.sentAt || '');
      r.word = shareWord(r);
      out.push(r);
    });
    out.sort(function (x, y) {
      return y.score - x.score || String(y.job.sentAt || '').localeCompare(String(x.job.sentAt || ''));
    });
    return opts.limit ? out.slice(0, opts.limit) : out;
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

  return { tokens: tokens, words: words, similarity: similarity, wordDiffLine: wordDiffLine, wordDiff: wordDiff, changedWords: changedWords, kinOf: kinOf, isKin: isKin, KIN: KIN, LINE_TWIN: LINE_TWIN, PART: PART, settingsDiff: settingsDiff,
    refsDiff: refsDiff, lanes: lanes, tail: tail, diff: diff, summary: summary, previousOf: previousOf, castNames: castNames,
    promptLines: promptLines, changedLines: changedLines, shareOf: shareOf, lineWeights: lineWeights, related: related, shareWord: shareWord, relatives: relatives };
}));
