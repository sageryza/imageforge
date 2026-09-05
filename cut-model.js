// cut-model.js — THE ONE SHAPE OF A FILM EDITOR CUT, shared by the server and
// the page (served at /cut-model.js the way pause-plan.js is).
//
// Sophie, 2026-09-02: "while they edit, also have it in the film editor that
// was made, clips laid out exactly the same so we can both edit in parallel …
// i need to be able to move the sound around. that's literally what i can't
// describe to the chat." So a cut is TWO LANES of pieces, and both are hers:
//
//   PICTURE lane — `clips`: an ordered list. Each piece is a reference into a
//     source (url + in/out); a STILL (`kind:'image'`) is a picture held for
//     `out` seconds (in is always 0 — a picture has no source time). Pieces
//     butt up against each other; a piece's timeline START is the sum of the
//     ones before it (`starts`).
//   SOUND lane — `sounds`: any number, free to overlap (voice + cello +
//     screams at once). Each is a reference into a source (url + in/out, out
//     null = to the end) placed at a timeline second `at`, with a level in dB,
//     a fade in/out, mute — and optionally an ANCHOR: `{piece, offset}` means
//     "start `offset` seconds after THAT shot starts, wherever the shot goes",
//     so ant screams follow the horror clip when she moves it. `at` is always
//     kept as the RESOLVED value (`normalize`), so a reader that knows nothing
//     about anchors still lands the sound in the right place.
//
// A gain RIDE (the cello: quiet entrance, climax, dry middle, warm swell) is
// not a curve she has to drag: it is the bed SPLIT into sound pieces, each
// with its own level and fades — the same split/trim/move/level tools as a
// clip, on the other lane. One vocabulary, deliberately.
//
// Nothing in here touches the network or ffmpeg. It cleans, resolves, and
// DIFFS (the words a chat reads back to her: "horror clip earlier by 4.0s").
// The legacy single `audio` track is read as the first sound and mirrored
// back for a page cached on her phone. Tests: node scripts/test-cut-model.js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CutModel = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_PIECES = 80;      // splits multiply — roomier than assembly's 60
  var MAX_SOUNDS = 40;
  var MIN_PIECE = 0.1;      // shorter than this is a mis-tap, refused
  var STILL_DEFAULT = 4;    // assembly's HOLD_DEFAULT
  var STILL_MIN = 0.5;
  var STILL_MAX = 60;       // a still's preview proxy is baked this long
  var GAIN_MIN = -40, GAIN_MAX = 12;   // dB
  var FADE_MAX = 10;                   // seconds
  var ANCHOR_MIN = -30, ANCHOR_MAX = 600;
  var MOVE_EPS = 0.05;      // a change smaller than this is not a move

  function num(v) { var n = Number(v); return Number.isFinite(n) ? n : null; }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function str(v, n) { return String(v == null ? '' : v).slice(0, n); }
  function https(u) { return /^https:\/\//.test(String(u || '')); }
  function db2lin(db) { return Math.pow(10, (Number(db) || 0) / 20); }

  // ── PICTURE lane ─────────────────────────────────────────────────────────
  function cleanPiece(c) {
    c = c || {};
    var kind = c.kind === 'image' ? 'image' : 'video';
    var out = {
      key: str(c.key, 40),
      kind: kind,
      url: str(c.url, 500),
      title: str(c.title, 200),
      poster: c.poster ? str(c.poster, 500) : null,
      seconds: null, in: 0, out: 0,
      mute: Boolean(c.mute),
      gain: 0,
    };
    var g = num(c.gain); if (g != null && g !== 0) out.gain = r1(clamp(g, GAIN_MIN, GAIN_MAX));
    if (kind === 'image') {
      // a still: `out` IS the hold; `hold` is accepted as an alias on the way in
      var h = num(c.out); if (h == null || h <= 0) h = num(c.hold);
      if (h == null || h <= 0) h = STILL_DEFAULT;
      out.out = r3(clamp(h, STILL_MIN, STILL_MAX));
      out.mute = true;   // a picture has no sound of its own
      return out;
    }
    var seconds = num(c.seconds);
    out.seconds = (seconds != null && seconds > 0) ? r3(seconds) : null;
    var tIn = num(c.in), tOut = num(c.out);
    if (tIn == null || tIn < 0) tIn = 0;
    if (tOut == null || tOut <= 0) tOut = out.seconds != null ? out.seconds : 0;
    if (out.seconds != null) { tIn = Math.min(tIn, out.seconds); tOut = Math.min(tOut, out.seconds); }
    out.in = r3(tIn); out.out = r3(tOut);
    return out;
  }
  function cleanPieces(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, MAX_PIECES).map(cleanPiece)
      .filter(function (c) { return c.key && https(c.url) && c.out - c.in >= MIN_PIECE; });
  }
  function pieceSeconds(c) { return Math.max(0, (Number(c && c.out) || 0) - (Number(c && c.in) || 0)); }
  // [{ key, start, dur, piece }] — where every shot sits on the timeline
  function starts(clips) {
    var t = 0;
    return (clips || []).map(function (c) {
      var s = { key: c.key, start: r3(t), dur: pieceSeconds(c), piece: c };
      t += s.dur;
      return s;
    });
  }
  function totalSeconds(clips) { return r3((clips || []).reduce(function (a, c) { return a + pieceSeconds(c); }, 0)); }
  function shotAt(clips, t) {
    var ss = starts(clips);
    for (var i = 0; i < ss.length; i++) if (t < ss[i].start + ss[i].dur - 1e-4) return ss[i];
    return ss[ss.length - 1] || null;
  }
  // Split a piece at `offset` seconds into ITS span → two references into the
  // same source, or null when the cut would leave a sliver. A STILL splits
  // into two stills whose holds add up (in stays 0 — a picture has no source
  // time); a clip's second half starts where the first ends. The server and
  // the page used to keep a copy each of this rule (filmeditor.js /
  // filmeditor.html); this is the one.
  function splitPiece(piece, offset, newKey) {
    var dur = pieceSeconds(piece);
    if (!(offset >= MIN_PIECE && offset <= dur - MIN_PIECE)) return null;
    var a = {}, b = {}, k;
    for (k in piece) { a[k] = piece[k]; b[k] = piece[k]; }
    b.key = str(newKey, 40);
    if (piece.kind === 'image') {
      a.out = r3(offset);
      b.in = 0; b.out = r3(dur - offset);
      return [a, b];
    }
    var cut = r3(piece.in + offset);
    a.out = cut;
    b.in = cut;
    return [a, b];
  }

  // ── SOUND lane ───────────────────────────────────────────────────────────
  function cleanAnchor(a) {
    if (!a || typeof a !== 'object') return null;
    var piece = str(a.piece, 40);
    var off = num(a.offset);
    if (!piece) return null;
    return { piece: piece, offset: r3(clamp(off == null ? 0 : off, ANCHOR_MIN, ANCHOR_MAX)) };
  }
  function cleanSound(s) {
    s = s || {};
    var seconds = num(s.seconds);
    var out = {
      key: str(s.key, 40),
      url: str(s.url, 500),
      name: str(s.name, 200),
      seconds: (seconds != null && seconds > 0) ? r3(seconds) : null,
      in: 0, out: null,
      at: 0,
      gain: 0, fadeIn: 0, fadeOut: 0,
      mute: Boolean(s.mute),
      anchor: cleanAnchor(s.anchor),
    };
    var tIn = num(s.in); if (tIn != null && tIn > 0) out.in = r3(tIn);
    var tOut = num(s.out); if (tOut != null && tOut > out.in) out.out = r3(tOut);
    if (out.seconds != null) {
      out.in = Math.min(out.in, out.seconds);
      if (out.out == null || out.out > out.seconds) out.out = out.seconds;
    }
    var at = num(s.at); if (at == null) at = num(s.offset);   // legacy name
    if (at != null && at > 0) out.at = r3(clamp(at, 0, ANCHOR_MAX));
    var g = num(s.gain); if (g != null) out.gain = r1(clamp(g, GAIN_MIN, GAIN_MAX));
    var fi = num(s.fadeIn); if (fi != null && fi > 0) out.fadeIn = r1(clamp(fi, 0, FADE_MAX));
    var fo = num(s.fadeOut); if (fo != null && fo > 0) out.fadeOut = r1(clamp(fo, 0, FADE_MAX));
    return out;
  }
  function cleanSounds(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, MAX_SOUNDS).map(cleanSound)
      .filter(function (s) { return s.key && https(s.url) && (s.out == null || s.out - s.in >= MIN_PIECE); });
  }
  // how long a sound plays: null when the source length is not known yet
  function soundSeconds(s) {
    if (!s) return null;
    if (s.out != null) return r3(Math.max(0, s.out - s.in));
    if (s.seconds != null) return r3(Math.max(0, s.seconds - s.in));
    return null;
  }
  // where a sound really starts: its anchor's shot when that shot exists,
  // else its own clock time
  function soundStart(sound, clips) {
    if (sound && sound.anchor) {
      var ss = starts(clips);
      for (var i = 0; i < ss.length; i++) {
        if (ss[i].key === sound.anchor.piece) return r3(Math.max(0, ss[i].start + sound.anchor.offset));
      }
    }
    return r3(Number(sound && sound.at) || 0);
  }
  // `at` rewritten to the resolved value on every sound (call on every save)
  function normalize(clips, sounds) {
    return (sounds || []).map(function (s) {
      var n = {}; for (var k in s) n[k] = s[k];
      n.at = soundStart(s, clips);
      if (n.anchor && !starts(clips).some(function (x) { return x.key === n.anchor.piece; })) n.anchor = null;
      return n;
    });
  }
  // she moved a sound to `newAt`: an anchored one stays on its shot with a
  // new offset (still rides), a free one just moves
  function moveSound(sound, clips, newAt) {
    var n = {}; for (var k in sound) n[k] = sound[k];
    newAt = r3(clamp(Number(newAt) || 0, 0, ANCHOR_MAX));
    if (n.anchor) {
      var ss = starts(clips);
      for (var i = 0; i < ss.length; i++) {
        if (ss[i].key === n.anchor.piece) {
          n.anchor = { piece: n.anchor.piece, offset: r3(clamp(newAt - ss[i].start, ANCHOR_MIN, ANCHOR_MAX)) };
          n.at = newAt;
          return n;
        }
      }
      n.anchor = null;
    }
    n.at = newAt;
    return n;
  }
  // "ride this shot": anchor a sound to the shot under its start
  function anchorToShot(sound, clips) {
    var n = {}; for (var k in sound) n[k] = sound[k];
    var at = soundStart(n, clips);
    var shot = shotAt(clips, at);
    if (!shot) { n.anchor = null; return n; }
    n.anchor = { piece: shot.key, offset: r3(at - shot.start) };
    n.at = at;
    return n;
  }
  function splitSound(sound, offset, newKey) {
    var dur = soundSeconds(sound);
    if (dur == null || !(offset >= MIN_PIECE && offset <= dur - MIN_PIECE)) return null;
    var a = {}, b = {}, k;
    for (k in sound) { a[k] = sound[k]; b[k] = sound[k]; }
    a.out = r3(sound.in + offset); a.fadeOut = 0;
    b.key = str(newKey, 40); b.in = r3(sound.in + offset); b.fadeIn = 0;
    b.at = r3(sound.at + offset);
    if (b.anchor) b.anchor = { piece: b.anchor.piece, offset: r3(b.anchor.offset + offset) };
    return [a, b];
  }

  // ── LENGTHS ARE FACTS, NOT EDITS (2026-09-05) ────────────────────────────
  // A chat's cut.json carried every sound with `seconds:null`; on open the
  // page learned the lengths from loadedmetadata and saved them as HER edit,
  // which bumped updatedAt — so the chat's next save 409'd and its "same
  // lanes?" check read the filled seconds as her change and stopped with
  // "STALE — she changed the cut" when she had touched nothing. A length
  // (and a poster) is a fact about the FILE; only in/out/order/level/anchor
  // are edits. Two pure rules, shared by the server's save and filmcut.js:
  //
  // carrySeconds: a writer that does not know a source's length must not
  // erase one the doc already learned (matched by key AND url — a
  // re-pointed piece is a different file); the item is re-cleaned so its
  // open end fills in exactly as the page's own save would have.
  function carrySeconds(next, cur, clean) {
    var known = {};
    (cur || []).forEach(function (c) { if (c && c.seconds != null) known[c.key + '\n' + c.url] = c.seconds; });
    return (next || []).map(function (n) {
      if (!n || n.seconds != null || n.kind === 'image') return n;
      var s = known[n.key + '\n' + n.url];
      if (s == null) return n;
      var m = {}; for (var k in n) m[k] = n[k];
      m.seconds = s;
      return clean(m);
    });
  }
  // lanesDiffer: did anything MOVE between two docs, ignoring `seconds` and
  // `poster`? An `out` that sits on its own known end against an open end
  // (or a request at or past it) is a length that was learned, not a trim —
  // cleanSound writes out = seconds the moment seconds is known, and
  // cleanPiece clamps a request past the end. An anchored sound is judged by
  // its anchor, never by the `at` derived from it.
  function sameEnd(p, q) {
    if (p.out == null && q.out == null) return true;
    if (p.out != null && q.out != null && Math.abs(p.out - q.out) <= MOVE_EPS) return true;
    var toEnd = function (x, y) {
      return x.seconds != null && x.out != null && Math.abs(x.out - x.seconds) <= MOVE_EPS
        && (y.out == null || y.out >= x.out - MOVE_EPS);
    };
    return toEnd(p, q) || toEnd(q, p);
  }
  function samePiece(p, q) {
    if (p.key !== q.key || p.kind !== q.kind || p.url !== q.url || p.title !== q.title) return false;
    if (p.mute !== q.mute || p.gain !== q.gain) return false;
    if (Math.abs(p.in - q.in) > MOVE_EPS) return false;
    return sameEnd(p, q);
  }
  function sameSound(p, q) {
    if (p.key !== q.key || p.url !== q.url || p.name !== q.name) return false;
    if (p.mute !== q.mute || p.gain !== q.gain || p.fadeIn !== q.fadeIn || p.fadeOut !== q.fadeOut) return false;
    if (Boolean(p.anchor) !== Boolean(q.anchor)) return false;
    if (p.anchor && (p.anchor.piece !== q.anchor.piece || Math.abs(p.anchor.offset - q.anchor.offset) > MOVE_EPS)) return false;
    if (!p.anchor && Math.abs(p.at - q.at) > MOVE_EPS) return false;
    if (Math.abs(p.in - q.in) > MOVE_EPS) return false;
    return sameEnd(p, q);
  }
  function lanesDiffer(a, b) {
    var x = readDoc(a), y = readDoc(b), i;
    if (x.clips.length !== y.clips.length || x.sounds.length !== y.sounds.length) return true;
    for (i = 0; i < x.clips.length; i++) if (!samePiece(x.clips[i], y.clips[i])) return true;
    for (i = 0; i < x.sounds.length; i++) if (!sameSound(x.sounds[i], y.sounds[i])) return true;
    return false;
  }

  // ── LEGACY: the one `audio` track ────────────────────────────────────────
  function soundsFromAudio(audio) {
    if (!audio || !https(audio.url)) return [];
    return cleanSounds([{ key: 'audio', url: audio.url, name: audio.name || '', at: audio.offset || 0 }]);
  }
  function audioMirror(sounds) {
    var s = (sounds || [])[0];
    return s ? { url: s.url, name: s.name || '', offset: s.at || 0 } : null;
  }
  // what a doc holds, whichever shape it was written in
  function readDoc(doc) {
    doc = doc || {};
    var clips = cleanPieces(doc.clips);
    var sounds = Array.isArray(doc.sounds) ? cleanSounds(doc.sounds) : soundsFromAudio(doc.audio);
    return { clips: clips, sounds: normalize(clips, sounds) };
  }

  // ── DIFF: what moved, in words ───────────────────────────────────────────
  function name(p) { return (p && (p.title || p.name)) || 'a piece'; }
  function secs(x) { return (Math.round(x * 10) / 10) + 's'; }
  function byKey(list) { var m = {}; (list || []).forEach(function (x) { m[x.key] = x; }); return m; }
  function diffCut(before, after) {
    var out = [];
    var b = readDoc(before), a = readDoc(after);
    var bs = starts(b.clips), as = starts(a.clips);
    var bk = byKey(b.clips), ak = byKey(a.clips);
    var i, k, p, q;
    for (i = 0; i < a.clips.length; i++) {
      p = a.clips[i]; q = bk[p.key];
      if (!q) { out.push({ kind: 'added', lane: 'picture', key: p.key, text: name(p) + ' added at ' + secs(as[i].start) }); continue; }
      var bi = b.clips.indexOf(q);
      if (bi !== i) out.push({ kind: 'moved', lane: 'picture', key: p.key, text: name(p) + (i < bi ? ' earlier' : ' later') + ' (now at ' + secs(as[i].start) + ', was ' + secs(bs[bi].start) + ')' });
      if (Math.abs(p.in - q.in) > MOVE_EPS || Math.abs(p.out - q.out) > MOVE_EPS) {
        out.push({ kind: 'trimmed', lane: 'picture', key: p.key, text: name(p) + (p.kind === 'image' ? ' held ' + secs(p.out) + ' (was ' + secs(q.out) + ')' : ' trimmed to ' + secs(p.in) + '–' + secs(p.out) + ' (was ' + secs(q.in) + '–' + secs(q.out) + ')') });
      }
      if (p.mute !== q.mute && p.kind !== 'image') out.push({ kind: 'mute', lane: 'picture', key: p.key, text: name(p) + (p.mute ? ' muted' : ' unmuted') });
      if (p.gain !== q.gain) out.push({ kind: 'level', lane: 'picture', key: p.key, text: name(p) + ' level ' + (p.gain > 0 ? '+' : '') + p.gain + 'dB' });
    }
    for (k in bk) if (!ak[k]) out.push({ kind: 'removed', lane: 'picture', key: k, text: name(bk[k]) + ' removed' });
    var bsk = byKey(b.sounds), ask = byKey(a.sounds);
    for (i = 0; i < a.sounds.length; i++) {
      p = a.sounds[i]; q = bsk[p.key];
      var pAt = soundStart(p, a.clips);
      if (!q) { out.push({ kind: 'added', lane: 'sound', key: p.key, text: name(p) + ' sound added at ' + secs(pAt) }); continue; }
      var qAt = soundStart(q, b.clips);
      if (Math.abs(pAt - qAt) > MOVE_EPS) out.push({ kind: 'moved', lane: 'sound', key: p.key, text: name(p) + ' sound ' + (pAt < qAt ? 'earlier' : 'later') + ' to ' + secs(pAt) + ' (was ' + secs(qAt) + ')' });
      if (Math.abs(p.in - q.in) > MOVE_EPS || (p.out || 0) !== (q.out || 0) && Math.abs((p.out || 0) - (q.out || 0)) > MOVE_EPS) out.push({ kind: 'trimmed', lane: 'sound', key: p.key, text: name(p) + ' sound trimmed to ' + secs(p.in) + '–' + (p.out == null ? 'end' : secs(p.out)) });
      if (p.gain !== q.gain) out.push({ kind: 'level', lane: 'sound', key: p.key, text: name(p) + ' sound level ' + (p.gain > 0 ? '+' : '') + p.gain + 'dB (was ' + (q.gain > 0 ? '+' : '') + q.gain + ')' });
      if (p.fadeIn !== q.fadeIn || p.fadeOut !== q.fadeOut) out.push({ kind: 'fade', lane: 'sound', key: p.key, text: name(p) + ' sound fades ' + secs(p.fadeIn) + ' in, ' + secs(p.fadeOut) + ' out' });
      if (p.mute !== q.mute) out.push({ kind: 'mute', lane: 'sound', key: p.key, text: name(p) + ' sound ' + (p.mute ? 'muted' : 'unmuted') });
      var pa = p.anchor ? p.anchor.piece : null, qa = q.anchor ? q.anchor.piece : null;
      if (pa !== qa) out.push({ kind: 'anchor', lane: 'sound', key: p.key, text: name(p) + ' sound ' + (pa ? 'now rides ' + name(ak[pa]) : 'no longer rides a shot') });
    }
    for (k in bsk) if (!ask[k]) out.push({ kind: 'removed', lane: 'sound', key: k, text: name(bsk[k]) + ' sound removed' });
    return out;
  }
  function describeDiff(changes) {
    return (changes || []).length ? changes.map(function (c) { return c.text; }).join('\n') : 'nothing changed';
  }

  return {
    MAX_PIECES: MAX_PIECES, MAX_SOUNDS: MAX_SOUNDS, MIN_PIECE: MIN_PIECE,
    STILL_DEFAULT: STILL_DEFAULT, STILL_MIN: STILL_MIN, STILL_MAX: STILL_MAX,
    GAIN_MIN: GAIN_MIN, GAIN_MAX: GAIN_MAX, FADE_MAX: FADE_MAX, MOVE_EPS: MOVE_EPS,
    cleanPiece: cleanPiece, cleanPieces: cleanPieces, pieceSeconds: pieceSeconds,
    starts: starts, totalSeconds: totalSeconds, shotAt: shotAt, splitPiece: splitPiece,
    cleanSound: cleanSound, cleanSounds: cleanSounds, soundSeconds: soundSeconds,
    soundStart: soundStart, normalize: normalize, moveSound: moveSound,
    anchorToShot: anchorToShot, splitSound: splitSound,
    soundsFromAudio: soundsFromAudio, audioMirror: audioMirror, readDoc: readDoc,
    carrySeconds: carrySeconds, lanesDiffer: lanesDiffer,
    diffCut: diffCut, describeDiff: describeDiff, db2lin: db2lin,
  };
}));
