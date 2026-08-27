#!/usr/bin/env node
// Swap Sophie's own pictures into the reel where they apply, splitting the
// two beats that need an extra picture. Writes reel.json (the cut list the
// film renders from) and updates the Story Room pad.
//  --pad   also write to the pad (add the split beats, place every picture)
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const BASE = 'https://imageforge-q125.onrender.com';
const plan = JSON.parse(fs.readFileSync(path.join(HERE, 'beats.json'), 'utf8'));
const spans = JSON.parse(fs.readFileSync(path.join(HERE, 'spans.json'), 'utf8'));
const runs = JSON.parse(fs.readFileSync(path.join(HERE, 'runs.json'), 'utf8'));
const hers = JSON.parse(fs.readFileSync(path.join(HERE, 'hers.json'), 'utf8'));
const pad = JSON.parse(fs.readFileSync(path.join(HERE, 'pad.json'), 'utf8'));
const doPad = process.argv.includes('--pad');

const mine = {};            // beat n -> my panel url
for (const r of runs) r.beats.forEach((n, i) => { mine[n] = r.images[i]; });
const beatId = {};          // beat n -> pad beat id
for (const b of pad.beats) beatId[b.n] = b.id;
const spanOf = {};
for (const s of spans) spanOf[s.n] = s;
const H = hers.images;
const act = {};
for (const p of hers.plan) act[p.beat] = p;

// THE CUT LIST — one entry per picture on screen, in order.
const reel = [];
for (const b of plan.beats) {
  const s = spanOf[b.n];
  const a = act[b.n];
  const base = { key: String(b.n), beat: b.n, label: b.label, vo: b.vo, t0: s.t0, t1: s.t1 };
  if (!a) { reel.push({ ...base, img: mine[b.n], from: 'mine', padBeat: beatId[b.n] }); continue; }
  if (a.action === 'swap') {
    reel.push({ ...base, img: H[a.hers].url, from: 'hers', hersKey: a.hers,
      label: H[a.hers].label, padBeat: beatId[b.n], displaced: mine[b.n] });
    continue;
  }
  if (a.action === 'split') {
    // first half keeps this beat (with its own swap if named), second half is NEW
    const firstImg = a.swapFirst ? H[a.swapFirst].url : mine[b.n];
    reel.push({ ...base, key: `${b.n}a`, vo: a.voA, t1: a.at,
      img: firstImg, from: a.swapFirst ? 'hers' : 'mine', hersKey: a.swapFirst || null,
      label: a.swapFirst ? H[a.swapFirst].label : b.label,
      padBeat: beatId[b.n], displaced: a.swapFirst ? mine[b.n] : null });
    const k = a.hers[1];
    reel.push({ ...base, key: `${b.n}b`, vo: a.voB, t0: a.at,
      img: H[k].url, from: 'hers', hersKey: k, label: H[k].label, padBeat: null, isNew: true });
    continue;
  }
  if (a.action === 'split3') {
    const [k0, k1, k2] = a.hers;
    reel.push({ ...base, key: `${b.n}a`, vo: a.voA, t1: a.at[0],
      img: H[k0].url, from: 'hers', hersKey: k0, label: H[k0].label,
      padBeat: beatId[b.n], displaced: mine[b.n] });
    reel.push({ ...base, key: `${b.n}b`, vo: a.voB, t0: a.at[0], t1: a.at[1],
      img: H[k1].url, from: 'hers', hersKey: k1, label: H[k1].label, padBeat: null, isNew: true });
    reel.push({ ...base, key: `${b.n}c`, vo: a.voC, t0: a.at[1],
      img: H[k2].url, from: 'hers', hersKey: k2, label: H[k2].label, padBeat: null, isNew: true });
    continue;
  }
  throw new Error('unknown action ' + a.action);
}

// spans must still tile and stay in order
for (let i = 0; i < reel.length; i++) {
  const r = reel[i];
  if (!r.img) throw new Error(`no picture for ${r.key}`);
  if (r.t1 <= r.t0) throw new Error(`bad span on ${r.key}: ${r.t0}→${r.t1}`);
  if (i && Math.abs(reel[i - 1].t1 - r.t0) > 0.001) throw new Error(`gap before ${r.key}`);
}
fs.writeFileSync(path.join(HERE, 'reel.json'), JSON.stringify(reel, null, 1));
console.log(`reel: ${reel.length} pictures — ${reel.filter(r => r.from === 'hers').length} hers, ${reel.filter(r => r.from === 'mine').length} mine`);
for (const r of reel) {
  if (r.from === 'hers') console.log(`  ${r.key.padStart(3)} ${r.t0.toFixed(2)}→${r.t1.toFixed(2)} ${r.label}`);
}
if (!doPad) { console.log('\n(dry — pass --pad to write the Story Room pad)'); process.exit(0); }

async function j(url, body) {
  for (let a = 0; a < 5; a++) {
    try {
      const r = await fetch(BASE + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const out = JSON.parse(await r.text());
      if (out.error) throw new Error(out.error);
      return out;
    } catch (e) {
      if (a === 4) throw new Error(`${url}: ${e.message}`);
      await new Promise((res) => setTimeout(res, 3000 * (a + 1)));
    }
  }
}

(async () => {
  // Walk the reel in order; a NEW entry is inserted directly after the beat
  // it was split off, so the pad reads in the same order as the film.
  let at = 0;                       // index in the pad's beat array
  for (const r of reel) {
    if (r.isNew) {
      const made = await j('/api/scratchpad/add', { pad: pad.pad, style: 'dreamy', at });
      r.padBeat = made.beat.id;
      await j('/api/scratchpad/text', { pad: pad.pad, id: r.padBeat, text: r.vo });
      await j('/api/scratchpad/prompt', { pad: pad.pad, id: r.padBeat, prompt: H[r.hersKey].prompt });
      console.log(`+ new beat ${r.key} at ${at} — ${r.label}`);
    } else if (r.vo !== plan.beats.find((b) => b.n === r.beat).vo) {
      await j('/api/scratchpad/text', { pad: pad.pad, id: r.padBeat, text: r.vo });
    }
    if (r.from === 'hers') {
      await j('/api/scratchpad/image', {
        pad: pad.pad, id: r.padBeat, url: r.img, style: 'dreamy',
        src: { kind: 'promptlab', runId: H[r.hersKey].run, prompt: H[r.hersKey].prompt },
      });
      console.log(`  ${r.key} ← ${r.label}`);
    }
    at++;
  }
  fs.writeFileSync(path.join(HERE, 'reel.json'), JSON.stringify(reel, null, 1));
  console.log('pad updated');
})().catch((e) => { console.error(e.message); process.exit(1); });
