'use strict';
// cast-line.js — WHAT A CHARACTER PUTS IN THE PROMPT, the ONE rule.
//
// 2026-09-11, Sophie: "we need a version of 'characters' for footage so i can
// click a button and it auto adds the line at the top, adding and referencing
// videos and stills · characters w multiple outfits will have ex, sophie w
// pajamas vs sophie street clothes".
//
// A LOOK is a character in one outfit: the references that carry that look
// (a clip, a still, several stills) and the ONE LINE her prompt opens with,
// which names each of them BY SLOT and says nothing else about them — the
// house rule (`her mother is the woman in [Image1].`, never a description).
//
// THE LINE IS STORED AS A TEMPLATE OVER THE LOOK'S OWN REFERENCES — `{1}`,
// `{2}` … — and NEVER as literal slot names, because a slot is decided by
// what else is already attached. Her real ward line
//
//   sophie is the woman in [Video1].  she wears the blue hospital pajamas in
//   [Image1], [Image2] and [Image3], NOT the dress in [Video1]
//
// is stored as `{1}` for the clip and `{2} {3} {4}` for the pajamas, and
// resolves to whatever slots those four land on when they are attached
// BESIDE a reference she had already put in the strip. A line holding a
// literal `[Video1]` would point at somebody else's clip the moment a second
// character rides along — which is the whole bug this file exists to stop.
//
// THE PAJAMAS FLOAT (her rule the same message: "these pajamas float w any
// patient so keep head off · ex francesca/anastasia gets pjs plus dance
// photo · same for mayra"). So a wardrobe entry is its OWN library entry with
// its own references, and a look WEARS it by slug: one copy of the pajama
// stills, worn by every patient, and swapping the pajama reference swaps it
// for all of them at once.
//
// SLOT ORDER IS THE DOORS' ORDER — images, then videos, then audio — which is
// what footage.js's `slotsOf` numbers and what the page's `orderedRefs`
// paints. This file computes the WHOLE strip after the attach and reads each
// slot off that, so the line and the strip can never disagree.
//
// Pure: no network, no Firestore, no DOM. Loaded by cast.js on the server AND
// served to the footage page at /cast-line.js (the pause-plan.js pattern), so
// the sheet shows the exact line the attach will insert.
// Test: node scripts/test-cast.js

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.__castLine = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  var KIND_ORDER = { image: 0, video: 1, audio: 2 };
  var KIND_WORD = { image: 'Image', video: 'Video', audio: 'Audio' };

  function slugify(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 60);
  }

  // The kind of a reference — declared if it says, else read off the url.
  // The same test footage.js applies, so a reference filed by the library
  // and one she uploaded on the page land in the same lane.
  function kindOf(r) {
    var k = String((r && r.kind) || '').toLowerCase();
    if (k === 'video' || k === 'audio' || k === 'image') return k;
    var u = String((r && r.url) || '').toLowerCase().split('?')[0];
    if (/\.(mp4|mov|webm|m4v)$/.test(u)) return 'video';
    if (/\.(m4a|mp3|wav|aac|ogg)$/.test(u)) return 'audio';
    return 'image';
  }

  function cleanRef(r) {
    if (!r || !/^https?:\/\//.test(String(r.url || ''))) return null;
    return { url: String(r.url), kind: kindOf(r),
      poster: r.poster ? String(r.poster) : '',
      name: r.name ? String(r.name).slice(0, 80) : '' };
  }

  // Every reference a look really sends: its own, then each wardrobe it
  // WEARS, in the order it names them. Deduped by url — a still that is both
  // the character's and the outfit's rides once and keeps ONE slot.
  function lookRefs(entry, look, byslug) {
    var out = [], seen = {};
    var push = function (r) {
      var c = cleanRef(r);
      if (!c || seen[c.url]) return;
      seen[c.url] = 1; out.push(c);
    };
    (look && look.refs ? look.refs : []).forEach(push);
    (look && look.wear ? look.wear : []).forEach(function (spec) {
      // A WARDROBE ENTRY'S FIRST LOOK IS THE OUTFIT, and a particular one is
      // named `slug:lookKey` — which is what lets the pajamas float
      // head-off by default while Sophie's own line, which counts three
      // pajama stills, points at the three-still look.
      var parts = String(spec).split(':');
      var w = byslug && byslug[parts[0]];
      if (!w) return;
      var wl = parts.length > 1 ? lookByKey(w, parts[1]) : (w.looks || [])[0];
      (wl && wl.refs ? wl.refs : (w.refs || [])).forEach(push);
    });
    return out;
  }
  function lookByKey(entry, key) {
    var ls = (entry && entry.looks) || [];
    for (var i = 0; i < ls.length; i++) if (ls[i].key === key) return ls[i];
    return null;
  }

  // THE ONE NUMBERING RULE — order the doors' way (images, then videos, then
  // audio) and count within kind. `names` is parallel to `refs`, so a caller
  // holding a POSITION (the strip's ✕, which indexes the row it drew) reads
  // its slot off the same arithmetic the attach reads off the url map.
  // The sort is stable, so two references of one kind keep the order she
  // added them in.
  function slotMap(list) {
    var next = (list || []).slice();
    next.sort(function (a, b) { return KIND_ORDER[a.kind] - KIND_ORDER[b.kind]; });
    var n = { image: 0, video: 0, audio: 0 }, slots = {}, names = [];
    next.forEach(function (r) {
      n[r.kind] += 1;
      var s = '[' + KIND_WORD[r.kind] + n[r.kind] + ']';
      names.push(s); slots[r.url] = s;
    });
    return { refs: next, names: names, slots: slots };
  }

  // The strip after the attach, in the doors' own order, and the slot each
  // url ends up with. `refs` is what is already there; `adding` is the look's.
  function stripAfter(refs, adding) {
    var next = [], seen = {};
    (refs || []).concat(adding || []).forEach(function (r) {
      var c = cleanRef(r);
      if (!c || seen[c.url]) return;
      seen[c.url] = 1; next.push(c);
    });
    return slotMap(next);
  }

  // `{1}` … `{n}` over the look's own reference list. A token pointing past
  // the end is LEFT AS IT IS rather than silently dropped — a line that lost
  // a reference should read wrong, not read fine and send one slot short.
  function resolveLine(line, refs, slots) {
    return String(line == null ? '' : line).replace(/\{(\d+)\}/g, function (m, d) {
      var r = refs[Number(d) - 1];
      return (r && slots[r.url]) || m;
    });
  }

  // NO LINE, NO INVENTED WORDING. A look she has not written a line for gets
  // the barest true sentence there is — the name, then the slots — because
  // anything fuller would be a description of a reference, which is the one
  // thing a prompt here must never carry.
  function defaultLine(entry, refs) {
    var name = String((entry && entry.name) || '').trim();
    if (!refs.length) return '';
    var toks = refs.map(function (r, i) { return '{' + (i + 1) + '}'; });
    var list = toks.length === 1 ? toks[0]
      : toks.slice(0, -1).join(', ') + ' and ' + toks[toks.length - 1];
    return (name ? name + ': ' : '') + list + '.';
  }

  // THE WHOLE TAP. Answers the strip it wants, the line to put at the top of
  // the prompt, and how many references are genuinely new — so the page can
  // say "attached 3" rather than claiming four when one was already there.
  //   plan({ refs, entry, look, byslug })
  function plan(opts) {
    opts = opts || {};
    var entry = opts.entry || {};
    var look = opts.look || (entry.looks || [])[0] || {};
    var have = (opts.refs || []).map(cleanRef).filter(Boolean);
    var mine = lookRefs(entry, look, opts.byslug || {});
    var after = stripAfter(have, mine);
    var had = {}; have.forEach(function (r) { had[r.url] = 1; });
    var tmpl = String(look.line || '').trim() || defaultLine(entry, mine);
    return {
      refs: after.refs,
      slots: after.slots,
      line: resolveLine(tmpl, mine, after.slots),
      template: tmpl,
      added: mine.filter(function (r) { return !had[r.url]; }).length,
      total: mine.length,
      empty: !mine.length,
    };
  }

  // ── TAKING A REFERENCE OFF ────────────────────────────────────────────────
  // 2026-09-11, Sophie: "if i delete an image, it shud remove the tags
  // associated w that image". The ✕ on the strip used to remove the reference
  // and leave her prompt alone, which is the same bug the `{1}` templates
  // above exist to stop, arriving from the other end: a slot is a POSITION,
  // so taking the second of three images off leaves `[Image2]` pointing at
  // nothing AND `[Image3]` pointing at a picture that is now `[Image2]` — the
  // clip still draws, of the wrong reference. So the names are rewritten with
  // the strip, in ONE pass.
  //
  // HER WORDS ARE NOT REWRITTEN — only the names. The slot names are the
  // page's own vocabulary (she taps them in, she never types them), and the
  // whitespace a name was standing in belongs to the name; everything else in
  // the sentence is hers, dangling commas included. A prompt that reads a
  // little wrong is hers to fix; a prompt that reads fine and names the wrong
  // picture is not.
  var SLOT_RE = /\[\s*(image|video|audio)\s*(\d+)\s*\]/gi;
  var HOLE = '\u0000';
  function canonSlot(word, num) { return '[' + KIND_WORD[String(word).toLowerCase()] + Number(num) + ']'; }

  // ONE pass over the prompt, so a rename can never land on a token another
  // rename is about to read — `[Image3]` → `[Image2]` beside `[Image2]` → gone
  // is exactly the ordinary case, and two sequential passes would eat it.
  // Matching is tolerant of her typing (`[image 1]`) and the replacement is
  // canonical; a token nothing maps is left VERBATIM, so a name she typed
  // that points past the end reads wrong rather than quietly changing.
  function rewriteSlots(prompt, gone, map) {
    var out = String(prompt == null ? '' : prompt).replace(SLOT_RE, function (m, w, d) {
      var c = canonSlot(w, d);
      if (gone && c === gone) return HOLE;
      return map[c] || m;
    });
    return out.replace(new RegExp('[ \\t]*' + HOLE + '[ \\t]*', 'g'), function (m, at, str) {
      var before = str.slice(0, at), after = str.slice(at + m.length);
      // the name took its own space with it: none at the start of a line, none
      // in front of punctuation, otherwise the one space between two words
      if (!before || /[\n(]$/.test(before)) return '';
      if (!after || /^[\n,.;:!?)]/.test(after)) return '';
      return ' ';
    });
  }

  // THE WHOLE ✕. Answers the strip that is left, her prompt with that
  // reference's name out of it and the rest renumbered, and what moved — so
  // the page can say so rather than changing her words silently.
  //   dropPlan({ refs, index | url, prompt })
  // BY POSITION when an index is given, because that is what the strip drew
  // (a copy-back makes NEW objects at the same urls, so an identity filter
  // removes nothing — footage.html's own finding).
  function dropPlan(opts) {
    opts = opts || {};
    var prompt = String(opts.prompt == null ? '' : opts.prompt);
    var m = slotMap((opts.refs || []).map(cleanRef).filter(Boolean));
    var i = opts.index == null || opts.index === '' ? -1 : Number(opts.index);
    if (!(i >= 0) && opts.url != null) {
      for (var k = 0; k < m.refs.length; k++) if (m.refs[k].url === String(opts.url)) { i = k; break; }
    }
    if (!(i >= 0 && i < m.refs.length)) {
      return { refs: m.refs, prompt: prompt, removed: '', slot: '', renamed: [], changed: false, ok: false };
    }
    var gone = m.names[i];
    var kept = m.refs.filter(function (r, k) { return k !== i; });
    var keptNames = m.names.filter(function (r, k) { return k !== i; });
    var after = slotMap(kept);
    var map = {}, renamed = [];
    after.names.forEach(function (nw, k) {
      if (keptNames[k] !== nw) { map[keptNames[k]] = nw; renamed.push({ from: keptNames[k], to: nw }); }
    });
    var out = rewriteSlots(prompt, gone, map);
    return { refs: after.refs, slots: after.slots, prompt: out, removed: m.refs[i].url,
      slot: gone, renamed: renamed, changed: out !== prompt, ok: true };
  }

  // Putting the line at the TOP of the prompt (her word: "auto adds the line
  // at the top"), never at the caret. A line already there is not added
  // twice — she taps a character, types, taps it again to check, and the
  // prompt must not grow a second copy of the same sentence.
  function withLine(prompt, line) {
    var p = String(prompt == null ? '' : prompt);
    var l = String(line || '').trim();
    if (!l) return p;
    if (p.indexOf(l) >= 0) return p;
    return p.trim() ? l + '\n\n' + p.replace(/^\s+/, '') : l;
  }

  return { slugify: slugify, kindOf: kindOf, cleanRef: cleanRef, lookRefs: lookRefs,
    lookByKey: lookByKey, slotMap: slotMap, stripAfter: stripAfter, resolveLine: resolveLine,
    defaultLine: defaultLine, plan: plan, withLine: withLine,
    rewriteSlots: rewriteSlots, dropPlan: dropPlan };
}));
