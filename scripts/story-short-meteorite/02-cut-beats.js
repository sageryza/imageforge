// Pass 2: the precise cutter — a faithful port of the NDE pipeline
// (docs/nde-precise-cutting.md / editor.js) pointed at Sophie's Story Room
// recording. Per span: locate the exact words in the full-file whisper words
// (occurrence-safe fuzzy match), re-listen to an ~100s window around the
// anchor with fresh whisper word timestamps (short windows drift far less
// than one 17-minute pass), then phraseSpan → clampBounds (gap-aware pad,
// never past the silence midpoint) → snapToSilence (end forward-only, capped
// at the next word) → micro-fades. Beat audio = its spans joined with 0.3s
// of silence. Ends with the verification pass: every beat wav is re-whispered
// and compared against the words it is supposed to contain.
const fs = require('fs');
const { execFile, execFileSync } = require('child_process');
const FFMPEG = require('ffmpeg-static');
const FFPROBE = require('ffprobe-static').path;
const { OUT, BEATS } = require('./beats');

const VO = OUT + '/vo.m4a';
const full = require(OUT + '/vo-words.json');

// ─── difflib SequenceMatcher port (verbatim from editor.js) ─────────
function matchingBlocks(a, b) {
  const b2j = new Map();
  b.forEach((w, j) => { if (!b2j.has(w)) b2j.set(w, []); b2j.get(w).push(j); });
  function longestMatch(alo, ahi, blo, bhi) {
    let besti = alo, bestj = blo, bestsize = 0;
    let j2len = new Map();
    for (let i = alo; i < ahi; i++) {
      const next = new Map();
      const js = b2j.get(a[i]);
      if (js) {
        for (const j of js) {
          if (j < blo) continue;
          if (j >= bhi) break;
          const k = (j2len.get(j - 1) || 0) + 1;
          next.set(j, k);
          if (k > bestsize) { besti = i - k + 1; bestj = j - k + 1; bestsize = k; }
        }
      }
      j2len = next;
    }
    return [besti, bestj, bestsize];
  }
  const queue = [[0, a.length, 0, b.length]];
  const blocks = [];
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.pop();
    const [i, j, k] = longestMatch(alo, ahi, blo, bhi);
    if (!k) continue;
    blocks.push([i, j, k]);
    if (alo < i && blo < j) queue.push([alo, i, blo, j]);
    if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
  }
  // This sort was MISSING from this copy even though the header above claims
  // it is verbatim from editor.js (Aug 2026). The queue is LIFO, so blocks
  // come out in recursion order, not left-to-right. Nothing noticed because
  // ratio() only SUMS block sizes, which is order-independent — but anything
  // that reads blocks[0] / the last block (the edge snap below) gets a
  // scrambled span from it.
  blocks.sort((x, y) => (x[0] - y[0]) || (x[1] - y[1]));
  return blocks;
}
function ratio(a, b) {
  const total = a.length + b.length;
  if (!total) return 1;
  let matched = 0;
  for (const blk of matchingBlocks(a, b)) matched += blk[2];
  return (2 * matched) / total;
}
function normWords(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
}

// ─── cutting logic (ported from editor.js / nde-supercut-precise.py) ─
function phraseSpan(words, phrase) {
  if (!words.length) return null;
  const ww = words.map(w => (normWords(w.word)[0] || ''));
  const pw = normWords(phrase);
  if (!pw.length) return null;
  const n = pw.length;
  let best = null;
  for (let L = n; L < n + 4; L++) {
    const last = Math.max(1, ww.length - L + 1);
    for (let i = 0; i < last; i++) {
      const win = ww.slice(i, i + L);
      if (!win.length) continue;
      const r = ratio(pw, win);
      if (!best || r > best[0]) best = [r, i, L];
    }
  }
  if (!best || best[0] < 0.5) return null;
  // Snap the edges to the words that actually MATCHED — see editor.js's
  // phraseSpan (the live copy). Without this a phrase word the audio never
  // says ("uh") lets a window shifted one word early tie with the true one,
  // and the tie above keeps the earlier start, so the cut opens on a stray
  // word from the previous sentence.
  const [score, i0, L] = best;
  let start = i0;
  let end = Math.min(i0 + L - 1, words.length - 1);
  const blocks = matchingBlocks(pw, ww.slice(i0, i0 + L));
  if (blocks.length) {
    const last = blocks[blocks.length - 1];
    start = i0 + blocks[0][1];
    end = Math.min(i0 + last[1] + last[2] - 1, words.length - 1);
  }
  return { start, end, score };
}
function clampBounds(words, i0, i1) {
  let t0 = words[i0].start;
  if (i0 > 0) {
    const gap = t0 - words[i0 - 1].end;
    t0 -= Math.min(0.15, Math.max(0.02, gap * 0.5));
  } else t0 -= 0.15;
  let t1 = words[i1].end;
  if (i1 < words.length - 1) {
    const gap = words[i1 + 1].start - t1;
    t1 += Math.min(0.30, Math.max(0.03, gap * 0.5));
  } else t1 += 0.30;
  return [Math.max(0, t0), t1];
}
function detectSilences(file) {
  return new Promise((resolve) => {
    execFile(FFMPEG, ['-i', file, '-af', 'silencedetect=noise=-32dB:d=0.2', '-f', 'null', '-'],
      { timeout: 180000 }, (err, stdout, stderr) => {
        const s = String(stderr || '');
        const starts = [...s.matchAll(/silence_start: ([\d.]+)/g)].map(m => parseFloat(m[1]));
        const ends = [...s.matchAll(/silence_end: ([\d.]+)/g)].map(m => parseFloat(m[1]));
        const sil = [];
        let ei = 0;
        for (const st of starts) {
          while (ei < ends.length && ends[ei] <= st) ei++;
          sil.push([st, ei < ends.length ? ends[ei] : st + 0.5]);
        }
        resolve(sil);
      });
  });
}
function snapToSilence(rs, re, silences, maxEnd) {
  let re2 = re;
  for (const [s, e] of silences) {
    if (s >= re - 0.05 && s <= re + 1.0) {
      if (maxEnd != null && s >= maxEnd) break;
      re2 = s + Math.min(0.18, Math.max(0.05, (e - s) * 0.4));
      break;
    }
  }
  let rs2 = rs;
  let cand = null;
  for (const [s, e] of silences) {
    if (e >= rs - 0.35 && e <= rs + 0.15) cand = [s, e];
  }
  if (cand) {
    const [s, e] = cand;
    rs2 = Math.max(s, e - Math.min(0.15, Math.max(0.04, (e - s) * 0.4)));
  }
  if (re2 <= rs2 + 0.4) return [rs, re];
  return [rs2, re2];
}

// ─── full-file occurrence locate (coarse prefilter + exact ratio) ───
// The 17-minute word list is too big for the O(N·L) phraseSpan slide, so a
// cheap bag-of-words scan nominates candidate starts and the real ratio()
// only runs there. Repeated takes are separated by the full-span ratio —
// the longer span text always disambiguates the take.
function locateInFull(words, phrase) {
  const ww = words.map(w => (normWords(w.word)[0] || ''));
  const pw = normWords(phrase);
  const n = pw.length;
  const bag = new Map();
  pw.forEach(t => bag.set(t, (bag.get(t) || 0) + 1));
  const scores = [];
  for (let i = 0; i + n <= ww.length; i++) {
    const need = new Map(bag);
    let hit = 0;
    for (let k = 0; k < n; k++) {
      const t = ww[i + k];
      const c = need.get(t);
      if (c) { hit++; need.set(t, c - 1); }
    }
    if (hit / n >= 0.5) scores.push([hit / n, i]);
  }
  scores.sort((a, b) => b[0] - a[0]);
  let best = null;
  for (const [, s] of scores.slice(0, 60)) {
    for (let L = n; L < n + 4; L++) {
      for (let i = Math.max(0, s - 2); i <= s + 2 && i + 1 <= ww.length; i++) {
        const win = ww.slice(i, Math.min(i + L, ww.length));
        const r = ratio(pw, win);
        if (!best || r > best[0]) best = [r, i, Math.min(i + L - 1, words.length - 1)];
      }
    }
  }
  if (!best || best[0] < 0.6) return null;
  return { start: best[1], end: best[2], score: best[0] };
}

// Extract a span's audio from the original recording with micro-fades
// (~30ms in / ~100ms out), 44.1k mono — re-run whenever bounds change.
function extractSpan(sp) {
  const d = sp.cutEnd - sp.cutStart;
  const dest = `${OUT}/span-${sp.beat}-${sp.si}.wav`;
  execFileSync(FFMPEG, ['-y', '-i', VO, '-filter_complex',
    `[0:a]atrim=start=${sp.cutStart.toFixed(3)}:end=${sp.cutEnd.toFixed(3)},asetpts=PTS-STARTPTS,` +
    `afade=t=in:st=0:d=0.03,afade=t=out:st=${Math.max(0, d - 0.1).toFixed(3)}:d=0.1,` +
    `aformat=sample_rates=44100:channel_layouts=mono[out]`,
    '-map', '[out]', dest], { stdio: 'pipe' });
}

async function whisperFile(file) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'audio/wav' }), 'w.wav');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

(async () => {
  // 1. Locate every span in the full-file words → absolute anchor times.
  const spans = [];
  BEATS.forEach((b, bi) => b.spans.forEach((text, si) => spans.push({ beat: bi, si, text })));
  for (const sp of spans) {
    const loc = locateInFull(full.words, sp.text);
    if (!loc) throw new Error(`span not found: [b${sp.beat}] "${sp.text.slice(0, 50)}…"`);
    sp.anchorStart = full.words[loc.start].start;
    sp.anchorEnd = full.words[loc.end].end;
    sp.fullScore = loc.score;
    console.log(`b${sp.beat}.${sp.si} @ ${sp.anchorStart.toFixed(1)}-${sp.anchorEnd.toFixed(1)}s (score ${loc.score.toFixed(3)}): "${full.words.slice(loc.start, loc.start + 6).map(w => w.word.trim()).join(' ')} … ${full.words.slice(Math.max(loc.start, loc.end - 4), loc.end + 1).map(w => w.word.trim()).join(' ')}"`);
  }

  // 2. Group nearby spans into re-listen windows (fresh short-window whisper
  //    = far less timestamp drift than the one long pass; editor.js fallback).
  const sorted = [...spans].sort((a, b) => a.anchorStart - b.anchorStart);
  const MARGIN = 12, MAXWIN = 110;
  const windows = [];
  for (const sp of sorted) {
    const w = windows[windows.length - 1];
    if (w && sp.anchorEnd + MARGIN - w.from <= MAXWIN) { w.to = Math.max(w.to, sp.anchorEnd + MARGIN); w.spans.push(sp); }
    else windows.push({ from: Math.max(0, sp.anchorStart - MARGIN), to: sp.anchorEnd + MARGIN, spans: [sp] });
  }
  console.log(`\n${windows.length} re-listen windows for ${spans.length} spans`);

  // 3. Whisper each window + silences, then cut every span precisely.
  for (let wi = 0; wi < windows.length; wi++) {
    const w = windows[wi];
    const wwav = `${OUT}/win-${wi}.wav`;
    const wjson = `${OUT}/win-${wi}.json`;
    execFileSync(FFMPEG, ['-y', '-ss', w.from.toFixed(3), '-t', (w.to - w.from).toFixed(3), '-i', VO,
      '-ac', '1', '-ar', '16000', wwav], { stdio: 'pipe' });
    let tr;
    if (fs.existsSync(wjson)) tr = JSON.parse(fs.readFileSync(wjson, 'utf8'));
    else { tr = await whisperFile(wwav); fs.writeFileSync(wjson, JSON.stringify(tr)); }
    const silences = await detectSilences(wwav);
    console.log(`window ${wi} [${w.from.toFixed(1)}-${w.to.toFixed(1)}s]: ${tr.words.length} words, ${silences.length} silences`);
    for (const sp of w.spans) {
      const loc = phraseSpan(tr.words, sp.text);
      if (!loc || loc.score < 0.7) throw new Error(`window re-locate failed (b${sp.beat}.${sp.si}, score ${loc && loc.score})`);
      // Anchor the matched BOUNDARIES to the expected first/last words. The
      // NDE editor never needs this (its snippets are copied from the same
      // transcript), but here the fuzzy match can start a filler word early
      // ("well," / "yeah,") or end on a trailing "um" — and unlike the
      // editor we know the exact word each span must start and end on.
      const ww = tr.words.map(x => (normWords(x.word)[0] || ''));
      const pw = normWords(sp.text);
      let i0 = loc.start, i1 = loc.end;
      if (ww[i0] !== pw[0]) {
        let hit = -1;
        for (let k = 1; k <= 6 && i0 + k <= i1; k++) if (ww[i0 + k] === pw[0]) { hit = i0 + k; break; }
        if (hit < 0) for (let k = 1; k <= 2 && i0 - k >= 0; k++) if (ww[i0 - k] === pw[0]) { hit = i0 - k; break; }
        if (hit >= 0) { console.log(`    b${sp.beat}.${sp.si}: start anchored ${i0}→${hit} (dropped "${ww.slice(Math.min(i0, hit), Math.max(i0, hit)).join(' ')}")`); i0 = hit; }
        else console.warn(`    b${sp.beat}.${sp.si}: WARN start word "${pw[0]}" not found near match (have "${ww[i0]}")`);
      }
      const pl = pw[pw.length - 1];
      if (ww[i1] !== pl) {
        let hit = -1;
        for (let k = 1; k <= 6 && i1 - k >= i0; k++) if (ww[i1 - k] === pl) { hit = i1 - k; break; }
        if (hit < 0) for (let k = 1; k <= 2 && i1 + k < ww.length; k++) if (ww[i1 + k] === pl) { hit = i1 + k; break; }
        if (hit >= 0) { console.log(`    b${sp.beat}.${sp.si}: end anchored ${i1}→${hit} (dropped "${ww.slice(Math.min(i1, hit) + 1, Math.max(i1, hit) + 1).join(' ')}")`); i1 = hit; }
        else console.warn(`    b${sp.beat}.${sp.si}: WARN end word "${pl}" not found near match (have "${ww[i1]}")`);
      }
      let [rs, re] = clampBounds(tr.words, i0, i1);
      const maxEnd = i1 < tr.words.length - 1 ? tr.words[i1 + 1].start : null;
      [rs, re] = snapToSilence(rs, re, silences, maxEnd);
      sp.cutStart = w.from + rs;
      sp.cutEnd = w.from + re;
      sp.winScore = loc.score;
      extractSpan(sp);
      console.log(`  b${sp.beat}.${sp.si}: cut ${sp.cutStart.toFixed(2)}-${sp.cutEnd.toFixed(2)}s (${(re - rs).toFixed(2)}s, score ${loc.score.toFixed(3)})`);
    }
  }

  // 3.5 Per-span verify + boundary nudge. Whisper's word edges are fuzzy by
  // ±100-200ms, and where Sophie's filler chains leave NO silence between
  // words ("well,I've" / "yeah,so" / "rituals,um") the silence snap has
  // nothing to snap to and a neighbor syllable bleeds into the cut. So each
  // span is re-listened to ALONE and the offending boundary micro-shifted
  // (70ms steps, ≤6 tries) until whisper hears exactly the right first and
  // last words — grown when a word got clipped, shrunk when a stray rode in.
  for (const sp of spans) {
    const pw = normWords(sp.text);
    const p0 = pw[0], pl = pw[pw.length - 1];
    for (let attempt = 0; attempt < 6; attempt++) {
      const tr = await whisperFile(`${OUT}/span-${sp.beat}-${sp.si}.wav`);
      const h = normWords(tr.text);
      sp.heard = tr.text;
      const startOK = h[0] === p0, endOK = h[h.length - 1] === pl;
      if (startOK && endOK) { if (attempt) console.log(`  b${sp.beat}.${sp.si}: clean after ${attempt} nudge(s) → ${sp.cutStart.toFixed(2)}-${sp.cutEnd.toFixed(2)}s`); break; }
      if (attempt === 5) { console.warn(`  b${sp.beat}.${sp.si}: WARN still unclean after nudging (heard "${(tr.text || '').slice(0, 60)}…")`); break; }
      if (!startOK) {
        const idx = h.indexOf(p0);
        sp.cutStart += (idx > 0 ? 0.07 : -0.07); // stray words before → shrink; first word clipped → grow
      }
      if (!endOK) {
        const idx = h.lastIndexOf(pl);
        sp.cutEnd += (idx >= 0 && idx < h.length - 1 ? -0.07 : 0.07); // stray after → shrink; clipped → grow
      }
      if (sp.cutEnd - sp.cutStart < 0.4) { console.warn(`  b${sp.beat}.${sp.si}: WARN nudge floor hit`); break; }
      extractSpan(sp);
      console.log(`  b${sp.beat}.${sp.si}: nudged → ${sp.cutStart.toFixed(2)}-${sp.cutEnd.toFixed(2)}s (start:${startOK ? 'ok' : 'adjusting'} end:${endOK ? 'ok' : 'adjusting'})`);
    }
  }

  // 4. Per-beat concat (0.3s breath between spans) + timing.json.
  const GAP = 0.3;
  const timing = [];
  for (let bi = 0; bi < BEATS.length; bi++) {
    const bspans = spans.filter(s => s.beat === bi).sort((a, b) => a.si - b.si);
    const parts = [], inputs = [], args = ['-y'];
    bspans.forEach((sp, i) => { args.push('-i', `${OUT}/span-${bi}-${sp.si}.wav`); });
    bspans.forEach((sp, i) => {
      parts.push(`[${i}:a]asetpts=PTS-STARTPTS[s${i}]`);
      inputs.push(`[s${i}]`);
      if (i < bspans.length - 1) {
        parts.push(`anullsrc=r=44100:cl=mono,atrim=duration=${GAP}[g${i}]`);
        inputs.push(`[g${i}]`);
      }
    });
    const filter = parts.join(';') + `;${inputs.join('')}concat=n=${inputs.length}:v=0:a=1[out]`;
    const dest = `${OUT}/beat-${bi}.wav`;
    execFileSync(FFMPEG, [...args, '-filter_complex', filter, '-map', '[out]', dest], { stdio: 'pipe' });
    const dur = parseFloat(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dest]).toString());
    timing.push({ beat: bi, duration: dur, spans: bspans.map(sp => ({ si: sp.si, text: sp.text, cutStart: sp.cutStart, cutEnd: sp.cutEnd, score: sp.winScore })) });
    console.log(`beat ${bi}: ${dur.toFixed(2)}s (${bspans.length} spans)`);
  }
  fs.writeFileSync(OUT + '/timing.json', JSON.stringify(timing, null, 2));
  console.log('total speech:', timing.reduce((a, t) => a + t.duration, 0).toFixed(1), 's');

  // 5. Verification (the nde-verify-cuts step): re-whisper every beat wav and
  //    compare against the words it is supposed to contain.
  const report = [];
  let bad = 0;
  for (const t of timing) {
    const tr = await whisperFile(`${OUT}/beat-${t.beat}.wav`);
    const heard = normWords(tr.text);
    const expected = normWords(BEATS[t.beat].spans.join(' '));
    const r = ratio(expected, heard);
    const firstOK = heard[0] === expected[0];
    const lastOK = heard[heard.length - 1] === expected[expected.length - 1];
    const ok = r >= 0.8 && firstOK && lastOK;
    if (!ok) bad++;
    report.push({ beat: t.beat, ratio: +r.toFixed(3), firstOK, lastOK, heard: tr.text });
    console.log(`verify beat ${t.beat}: ratio ${r.toFixed(3)} first:${firstOK ? 'ok' : 'BAD(' + heard[0] + '≠' + expected[0] + ')'} last:${lastOK ? 'ok' : 'BAD(' + heard[heard.length - 1] + '≠' + expected[expected.length - 1] + ')'}`);
  }
  fs.writeFileSync(OUT + '/cut-report.json', JSON.stringify(report, null, 2));
  if (bad) { console.error(`${bad} beats FAILED verification — inspect cut-report.json`); process.exit(2); }
  console.log('ALL BEATS VERIFIED');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
