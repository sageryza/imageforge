// Find EVERY take of every script line in her recording.
// Sliding-window match over the word stream: for each line, score every window
// whose length is near the line's, keep the local best ones above a floor.
const fs = require('fs');
// BOTH recordings — the goblin sheet's three reasons live only in the second.
const SRCS = [
  { key: 'vo',  file: 'assets/water-reel/sophie-vo.m4a',           words: '/tmp/takes/words.json' },
  { key: 'vo2', file: 'assets/water-reel/sophie-goblin-sheet.m4a', words: '/tmp/takes/words2.json' },
].filter((s) => fs.existsSync(s.words));
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
const streams = SRCS.map((s) => ({
  ...s,
  W: JSON.parse(fs.readFileSync(s.words, 'utf8'))
    .map((w) => ({ t0: w.start != null ? w.start : w.t0, t1: w.end != null ? w.end : w.t1, w: norm(w.word || w.w)[0] || '' }))
    .filter((x) => x.w),
}));

// every phrase in the spec, with the shot that uses it
const LINES = [];
for (const sh of spec.shots) {
  // an `extra` carries its OWN source — c1's "Than ever before" is her separate
  // pickup out of `c1c`, not out of the shot's primary slice
  const ph = [
    ...(sh.phrases || []).map((p) => ({ p, source: sh.source })),
    ...((sh.extra || []).map((e) => ({ p: e.phrase, source: e.source || sh.source }))),
  ].filter((x) => x.p);
  for (const x of ph) LINES.push({ shot: sh.id, source: x.source, text: x.p });
}

// A LINE IS FOUND BY ITS DISTINCTIVE WORDS, NOT BY ITS SCORE ALONE. Her sheets
// say near-identical things — "water flushes out the tiny greetings that live
// in your EARS" against "water flush out the ghosts that live in your SPINE"
// shares 8 of 12 words, so a plain ratio matched the wrong line four times over
// and would have filed another shot's takes under this one. `rare` is the words
// this line does not share with two or more others; a window must carry most of
// them before its score counts at all.
const df = {};
for (const L of LINES) for (const w of new Set(norm(L.text))) df[w] = (df[w] || 0) + 1;

function findTakes(text, W) {
  const q = norm(text);
  if (q.length < 3) return [];
  const n = q.length;
  const rare = [...new Set(q)].filter((w) => df[w] <= 2);
  const hits = [];
  for (let i = 0; i + Math.floor(n * 0.6) <= W.length; i++) {
    // window length flexes with the line's length (she restarts, adds words)
    for (const len of [n, Math.round(n * 0.8), Math.round(n * 1.2)]) {
      if (i + len > W.length) continue;
      const win = W.slice(i, i + len).map((x) => x.w);
      // in-order LCS ratio against the query
      const dp = Array.from({ length: q.length + 1 }, () => new Uint16Array(win.length + 1));
      for (let a = 1; a <= q.length; a++) for (let b = 1; b <= win.length; b++)
        dp[a][b] = q[a - 1] === win[b - 1] ? dp[a - 1][b - 1] + 1 : Math.max(dp[a - 1][b], dp[a][b - 1]);
      const score = dp[q.length][win.length] / q.length;
      if (score < 0.70) continue;
      const have = new Set(win);
      const rareHit = rare.length ? rare.filter((w) => have.has(w)).length / rare.length : 1;
      if (rareHit < 0.6) continue;
      hits.push({ i, len, score, rareHit, t0: W[i].t0, t1: W[i + len - 1].t1 });
    }
  }
  // collapse overlapping hits, keeping the best-scoring window of each cluster
  hits.sort((a, b) => (b.score + b.rareHit) - (a.score + a.rareHit) || (a.t1 - a.t0) - (b.t1 - b.t0));
  const kept = [];
  for (const h of hits) {
    if (kept.some((k) => h.t0 < k.t1 + 0.4 && h.t1 > k.t0 - 0.4)) continue;
    kept.push(h);
  }
  return kept.sort((a, b) => a.t0 - b.t0);
}

const out = LINES.map((L) => ({
  ...L,
  takes: streams.flatMap((s) => findTakes(L.text, s.W).map((t) => ({ ...t, src: s.key, file: s.file }))),
}));
fs.writeFileSync('/tmp/takes/takes.json', JSON.stringify(out, null, 1));
let tot = 0;
for (const L of out) {
  tot += L.takes.length;
  console.log(String(L.takes.length).padStart(2), L.shot.padEnd(5), L.text.slice(0, 52).padEnd(54),
    L.takes.map((t) => `${t.src}@${t.t0.toFixed(0)}`).join(' '));
}
console.log('lines', out.length, 'takes', tot);
