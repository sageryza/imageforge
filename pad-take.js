// pad-take.js — ONE TAKE OVER THE WHOLE STORY (2026-09-06, Sophie: "i wanna use
// the words i typed as voiceover … one continuous take · i want the pictures to
// show as a movie during that", then, on the Story Room's own film button
// reading every line separately: "yes my take").
//
// The pad film's shape is one shot per beat, each held for ITS OWN audio — a
// recording on the beat, else the line read aloud, else quiet. A story that
// carries a whole-take narration (pad.voiceover.url — her own recording, or
// one continuous TTS read) is the other shape: ONE audio track, and the
// pictures are cut TO THE WORDS — a shot starts where its line starts in the
// take, and runs until the next line starts. This file is the pure decision
// (which shot starts when), dependency-free so its test needs no node_modules;
// the ffmpeg half lives in scratchpad.js's runFilmJob.
//
// `beats` is the story's SHOTS in order ({text}); `words` is the take's word
// list ({word, start, end}, whisper-1 word timestamps). A beat's words are
// found in the take SEQUENTIALLY — never earlier than the beat before it —
// on its first three words (two of three, in order, with the first one
// present or the next two both present), which is what survives whisper
// mishearing one word and her adding a "the".
//
// Three shot kinds come out:
//   line   — its words were found; runs from (start − lead) to the next
//            found start, and the LAST line runs to the end of the take + tail.
//   shared — a beat with no words, or words the take never says, sitting
//            between two found lines: it splits the previous line's span
//            evenly with it (a picture with nothing said over it still shows,
//            without moving any later line off its words).
//   closer — a wordless beat AFTER the last line: held `closer` seconds each,
//            after the take has ended.
// Wordless beats BEFORE the first line hold `closer` each and DELAY the take
// (audioAt) — the one case where the audio moves, because there is nothing
// before the first word to share.
//
// Answers null when no beat's words are found at all — the caller falls back
// to the per-beat film rather than showing nine pictures over an unrelated take.
'use strict';

function norm(s) {
  return String(s || '').toLowerCase().replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

// Earliest word index ≥ from where the beat's opening tokens are said.
function findRun(W, toks, from) {
  const head = toks.slice(0, 3);
  for (let j = from; j < W.length; j++) {
    const a = W[j] === head[0];
    const b = head.length > 1 && W[j + 1] === head[1];
    const c = head.length > 2 && W[j + 2] === head[2];
    if (head.length === 1 ? a : (a && (b || c)) || (b && c)) return j;
  }
  return null;
}

function alignTake(beats, words, opts = {}) {
  const lead = opts.lead ?? 0.08;
  const closer = opts.closer ?? 2.0;
  const tail = opts.tail ?? 0.35;
  const W = (words || []).map((w) => norm(w.word).join(''));
  const starts = beats.map(() => null);
  let cursor = 0;
  beats.forEach((b, i) => {
    const toks = norm(b && b.text);
    if (!toks.length) return;
    const j = findRun(W, toks, cursor);
    if (j == null) return;
    starts[i] = Math.max(0, (Number(words[j].start) || 0) - lead);
    cursor = j + 1;
  });
  const found = starts.map((s, i) => (s == null ? -1 : i)).filter((i) => i >= 0);
  if (!found.length) return null;
  const takeEnd = words.reduce((m, w) => Math.max(m, Number(w.end) || 0), 0);
  const first = found[0], last = found[found.length - 1];

  // Leading wordless beats: `closer` each, and the take waits for them.
  const audioAt = first * closer;
  if (audioAt) found.forEach((i) => { starts[i] += audioAt; });
  const shots = beats.map((b, i) => ({ i, start: null, hold: 0, kind: null }));
  for (let i = 0; i < first; i++) { shots[i].start = i * closer; shots[i].hold = closer; shots[i].kind = 'closer'; }
  // Each found line's span runs to the next found start; the beats between
  // share it evenly with it.
  for (let k = 0; k < found.length; k++) {
    const i = found[k];
    const next = found[k + 1];
    const spanEnd = next != null ? starts[next] : takeEnd + audioAt + tail;
    const members = next != null ? next - i : (last === i ? 1 : 1);
    const trailing = next == null;
    const group = trailing ? [i] : Array.from({ length: members }, (_, m) => i + m);
    const each = (spanEnd - starts[i]) / group.length;
    group.forEach((g, m) => {
      shots[g].start = starts[i] + each * m;
      shots[g].hold = each;
      shots[g].kind = g === i ? 'line' : 'shared';
    });
  }
  // Trailing wordless beats after the last line: closers.
  let t = shots[last].start + shots[last].hold;
  for (let i = last + 1; i < beats.length; i++) {
    shots[i].start = t; shots[i].hold = closer; shots[i].kind = 'closer'; t += closer;
  }
  const total = shots.reduce((a, s) => a + s.hold, 0);
  return { shots, audioAt, total, takeEnd, matched: found.length, unmatched: shots.filter((s) => s.kind !== 'line').map((s) => s.i) };
}

module.exports = { alignTake, norm };
