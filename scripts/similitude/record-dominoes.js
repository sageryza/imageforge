#!/usr/bin/env node
/* Similitude Dominoes — screen-record a seeded game on the v4.1 prototype page for the commercial (2026-09-02).
   Needs scripts/similitude/dominoes-local.js running (serves the Compare page html from the scratchpad with
   /cuts/ proxied by curl and the verdict route STUBBED, so a recording never writes into her game record).
   Usage: node scripts/similitude/record-dominoes.js <outdir> <seed> <her moves> <deck.json>
   1080x2340 viewport with html zoom 1080/390 so the phone layout renders crisp; .wrap is pinned to 845px
   because 100vh under zoom is 2.77x too tall (the hand landed at y=6042). Seed 21 = hot spring opens,
   comet "a trail". Math.random is replaced by a seeded PRNG so the deal repeats. */
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2]; const SEED = +process.argv[3] || 21; const MOVES = +process.argv[4] || 2;
const DECK = require(process.argv[5]);
const WEAK = {}; ["animal","bird","insect","fish","cat","made thing","water","sky","tree","leaves","leaf","plant","fruit","flower","rock","green","brown","grey","blue","many","small","big","indoors","garden","forest","sea","field","wood","glass","window","pale","tiny","close-up","still","moving","hidden","round","dots","lines","pattern","far away","height","vertical","sand","snow","ice","cold","light","star","moon","cloud","wings","eyes"].forEach((w) => WEAK[w] = 1);
const RARITY = {}; DECK.forEach((c) => c.t.forEach((t) => { RARITY[t] = (RARITY[t] || 0) + 1; }));
const byKey = {}; DECK.forEach((c, i) => { byKey[c.k] = i; });
const shared = (a, b) => DECK[a].t.filter((t) => !WEAK[t] && DECK[b].t.includes(t)).sort((x, y) => RARITY[x] - RARITY[y]);
const Z = 1080 / 390;
const INIT = `(function(){ var seed=${SEED}; Math.random=function(){ var t=seed+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; };
document.addEventListener('DOMContentLoaded',function(){ document.documentElement.style.zoom='${Z}'; var w=document.createElement('style'); w.textContent='.wrap{height:845px!important}'; document.documentElement.appendChild(w); 
 var st=document.createElement('style'); st.textContent='.tapdot{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(43,38,34,.28);pointer-events:none;z-index:9999;animation:tap .55s ease-out forwards}@keyframes tap{from{transform:scale(.5);opacity:.9}to{transform:scale(1.6);opacity:0}}'; document.documentElement.appendChild(st);
 document.addEventListener('pointerdown',function(e){ var d=document.createElement('div'); d.className='tapdot'; d.style.left=(e.clientX/${Z})+'px'; d.style.top=(e.clientY/${Z})+'px'; document.body.appendChild(d); setTimeout(function(){ d.remove(); },600); },true); }); })();`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const centre = (pg, sel) => pg.$eval(sel, (e) => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
async function tap(pg, sel) { const r = await centre(pg, sel); await pg.mouse.click(r.x, r.y); }
// what is on the table and in her hand, read off the DOM (image hrefs carry the cut key)
async function state(pg) {
  return pg.evaluate(() => {
    const key = (el) => { const im = el.querySelector('image'); const h = im && (im.getAttribute('href') || im.getAttribute('xlink:href')); return h ? h.split('/').pop() : null; };
    const cells = {}; document.querySelectorAll('#felt [data-card]').forEach((el) => { cells[el.dataset.card] = key(el); });
    const slots = Array.from(document.querySelectorAll('#felt [data-slot]')).map((el) => el.dataset.slot);
    const hand = Array.from(document.querySelectorAll('#hand [data-k]')).map((el) => ({ k: el.dataset.k, key: key(el) }));
    return { cells, slots, hand, msg: document.getElementById('msg').textContent };
  });
}
const nbs = (u) => { const [r, c] = u.split(',').map(Number); const up = (((r + c) % 2) + 2) % 2 === 0; return [[r, c - 1], [r, c + 1], up ? [r + 1, c] : [r - 1, c]].map((p) => p.join(',')); };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1080, height: 2340 }, deviceScaleFactor: 1, hasTouch: true, recordVideo: { dir: OUT, size: { width: 1080, height: 2340 } } });
  const pg = await ctx.newPage(); await pg.addInitScript(INIT);
  await pg.goto('http://127.0.0.1:4748/dominoes', { waitUntil: 'networkidle' }); await sleep(2500);
  for (let m = 0; m < MOVES; m++) {
    const st = await state(pg); console.log('msg:', st.msg);
    if (!st.slots.length) { const fr = new Set(); Object.keys(st.cells).forEach((k) => nbs(k).forEach((u) => { if (!st.cells[u]) fr.add(u); })); st.slots = Array.from(fr); }
    // best (card, slot): most cards touched, every touch shareable, rarest words
    let best = null;
    for (const h of st.hand) { const card = byKey[h.key]; if (card == null) continue;
      for (const u of st.slots) { const others = nbs(u).filter((k) => st.cells[k]); const per = others.map((o) => shared(card, byKey[st.cells[o]]));
        if (per.some((p) => !p.length)) continue;
        let whys; if (others.length === 3) { const same = per[0].find((x) => per[1].includes(x) && per[2].includes(x)); if (same) whys = others.map(() => same); else { const a = per[0][0], bb = per[1].find((x) => x !== a), c = per[2].find((x) => x !== a && x !== bb); if (!bb || !c) continue; whys = [a, bb, c]; } } else whys = per.map((p) => p[0]);
        const score = others.length * 100 + whys.reduce((s, w) => s + (84 - RARITY[w]), 0);
        if (!best || score > best.score) best = { k: h.k, u, others, whys, score, name: DECK[card].n };
      } }
    if (!best) { console.log('no honest move'); break; }
    console.log('move', best.name, '→', best.u, best.others.map((o, i) => DECK[byKey[st.cells[o]]].n + ': ' + best.whys[i]).join(' · '));
    await tap(pg, `#hand [data-k="${best.k}"]`); await sleep(1300);
    await tap(pg, `#felt [data-slot="${best.u}"]`); await sleep(900);
    const ins = await pg.$$('#say input');
    for (let i = 0; i < ins.length; i++) { const r = await ins[i].boundingBox(); await pg.mouse.click(r.x + r.width / 2, r.y + r.height / 2); await sleep(350); await pg.keyboard.type(best.whys[i], { delay: 75 }); await sleep(400); }
    await sleep(600); await tap(pg, '#bLay'); await sleep(1500);
    console.log('after lay:', (await state(pg)).msg);
    await sleep(3200);   // it thinks and lays
    console.log('after it:', (await state(pg)).msg);
    await sleep(1200);
  }
  await sleep(2500);
  const v = pg.video(); await ctx.close(); await b.close();
  fs.renameSync(await v.path(), path.join(OUT, `dominoes-seed${SEED}.webm`)); console.log('recorded');
})();
