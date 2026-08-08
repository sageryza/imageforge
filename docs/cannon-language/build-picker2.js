#!/usr/bin/env node
// v2 of the word-picker: EVERY source passage in the film, not just the
// Custodians 2 one, each as its own clearly divided section.
//
// Three fixes over v1:
//  * ">>" is the auto-caption's SPEAKER-CHANGE marker. In v1 it rendered as a
//    tappable word, so 27 of them sat in the passage looking like errors and
//    could land inside a pick. It is now a real speaker break — which is also
//    the line break asked for between voices.
//  * #read reserves the pill's 56px column. Measured on a 390px viewport the
//    pill occupies x326-374 and words sat directly under and beside it, so a
//    tap aimed at a word near the top-right hit the pill's play button and
//    started the autoscroll instead of selecting.
//  * passages are separated by a titled rule, not run together.
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const TDIR = '/tmp/claude-0/-home-user/f2896c89-febe-5a45-b7dd-d2f403c0f14e/scratchpad/transcripts';
const LINES = JSON.parse(fs.readFileSync(path.join(DIR, 'lines.local.json'), 'utf8'));
const shots = JSON.parse(fs.readFileSync(path.join(DIR, 'shots.json'), 'utf8')).shots;
const stills = JSON.parse(fs.readFileSync(path.join(DIR, 'renders-medium.json'), 'utf8'));
const CHAT = 'illustrated-cannon-passage';
const SHEET = 'language-passage-picks-v2';

// One section per distinct source location. `pad` = seconds of context either
// side; the main passage gets its own wide window.
const SECTIONS = [
  { id: 'k1-chron', vid: 'VXO-C9w3TDw', book: 'Keepers of the Garden 1', at: 1585, pad: 70, shots: [2] },
  { id: 'c1-sound', vid: 'mMLQaQ7jsts', book: 'Custodians 1', at: 15306, pad: 70, shots: [3] },
  { id: 'k1-name', vid: 'VXO-C9w3TDw', book: 'Keepers of the Garden 1', at: 6894, pad: 70, shots: [4] },
  { id: 'k2-equiv', vid: 'rvfOUg4zVc0', book: 'Keepers of the Garden 2', at: 24391, pad: 70, shots: [5] },
  { id: 'c2-noword', vid: 'L0TSZDqQlnU', book: 'Custodians 2', at: 33060, pad: 70, shots: [6] },
  { id: 'k1-time', vid: 'VXO-C9w3TDw', book: 'Keepers of the Garden 1', at: 9166, pad: 70, shots: [7] },
  { id: 'k1-slav', vid: 'VXO-C9w3TDw', book: 'Keepers of the Garden 1', at: 5507, pad: 70, shots: [8] },
  { id: 'c1-peach', vid: 'mMLQaQ7jsts', book: 'Custodians 1', at: 1773, pad: 80, shots: [9, 20] },
  { id: 'k2-noconc', vid: 'rvfOUg4zVc0', book: 'Keepers of the Garden 2', at: 4841, pad: 70, shots: [10] },
  { id: 'k1-whole', vid: 'VXO-C9w3TDw', book: 'Keepers of the Garden 1', at: 12256, pad: 70, shots: [11] },
  { id: 'c2-main', vid: 'L0TSZDqQlnU', book: 'Custodians 2', at: 19590, pad: 215, shots: [12, 13, 14, 15, 16, 17, 18, 19],
    main: true },
];

const tx = {};
for (const s of SECTIONS) if (!tx[s.vid]) tx[s.vid] = JSON.parse(fs.readFileSync(`${TDIR}/${s.vid}.json`, 'utf8'));

const norm = w => w.toLowerCase().replace(/[^a-z0-9']/g, '');
const fmt = s => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ── build one global word array, remembering where each section starts ───────
// Tokens are either {w:'word'} or {brk:true} for a speaker change. Only words
// get an index in WORDS, so a pick can never contain a ">>".
const WORDS = [];
const tokensBySection = [];
for (const sec of SECTIONS) {
  const segs = tx[sec.vid].segments.filter(s => s.start >= sec.at - sec.pad && s.start <= sec.at + sec.pad);
  const raw = segs.map(s => s.text.replace(/\s+/g, ' ').trim()).join(' ').replace(/\s+/g, ' ').trim();
  const toks = [];
  for (const piece of raw.split(' ')) {
    if (!piece) continue;
    if (piece === '>>') { toks.push({ brk: true }); continue; }
    // a marker glued to a word ("»Yes,") — split it off rather than lose it
    const m = piece.match(/^>>(.+)$/);
    if (m) { toks.push({ brk: true }); toks.push({ w: m[1], i: WORDS.length }); WORDS.push(m[1]); continue; }
    toks.push({ w: piece, i: WORDS.length }); WORDS.push(piece);
  }
  sec.from = segs.length ? segs[0].start : sec.at;
  sec.to = segs.length ? segs[segs.length - 1].start : sec.at;
  tokensBySection.push(toks);
}

const HAY = WORDS.map(norm);
function locate(phrase, lo, hi) {
  const t = phrase.split(/\s+/).map(norm).filter(Boolean);
  let best = { score: -1, a: lo, z: lo };
  for (let len = Math.max(1, t.length - 2); len <= t.length + 2; len++) {
    for (let i = lo; i + len <= hi; i++) {
      let hit = 0; const n = Math.min(len, t.length);
      for (let k = 0; k < n; k++) if (HAY[i + k] === t[k]) hit++;
      const score = hit / Math.max(len, t.length);
      if (score > best.score) best = { score, a: i, z: i + len - 1 };
    }
  }
  return best;
}

// where each section's words live in the global array
SECTIONS.forEach((sec, k) => {
  const idxs = tokensBySection[k].filter(t => t.w !== undefined).map(t => t.i);
  sec.lo = idxs[0]; sec.hi = idxs[idxs.length - 1] + 1;
});

// v1 spans, resolved inside their own section
const used = new Set();
const V1 = [];
for (const sec of SECTIONS) for (const n of sec.shots) {
  const m = locate(LINES[n], sec.lo, sec.hi);
  V1.push({ n, ...m });
  for (let i = m.a; i <= m.z; i++) used.add(i);
  if (m.score < 0.65) console.error(`  LOW ${m.score.toFixed(2)} shot ${n}`);
}

const main = SECTIONS.find(s => s.main);
const ADD = [
  ['the setup — we already do this, just not as far',
    'He said we do the same thing without realizing it but we have not developed it to the point they have'],
  ['the list itself — what the one symbol unpacks into',
    'Christmas trees, decorations, presents, baby Jesus, nativity, Santa Claus, the colors red and green, bells, and on and on'],
  ['the closing — whole concepts in a simple device',
    'incorporating whole concepts in such a simple device and often a lack of patience with our tedious methods of communicating in written and spoken language'],
].map(([why, phrase]) => ({ why, phrase, ...locate(phrase, main.lo, main.hi) }));
ADD.forEach(a => { if (a.score < 0.9) console.error(`  LOW ADD ${a.score.toFixed(2)} ${a.why}`); });

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const sectionsHtml = SECTIONS.map((sec, k) => {
  const body = tokensBySection[k].map(t => t.brk
    ? '<b class="sp"></b>'
    : `<w${used.has(t.i) ? ' class="v1"' : ''}>${esc(t.w)}</w>`).join(' ');
  const holds = sec.shots.map(n => `shot ${n}`).join(', ');
  return `
  <section class="pas${sec.main ? ' main' : ''}">
    <div class="phead">
      <h2>${esc(sec.book)}</h2>
      <p class="k">${fmt(sec.from)} – ${fmt(sec.to)} · holds ${esc(holds)}${sec.main ? ' · the symbol passage and the Christmas example' : ''}</p>
    </div>
    <div class="ptext">${body}</div>
  </section>`;
}).join('\n<hr class="div">\n');

const act1 = shots.filter(s => s.act === '1' && s.n !== 1);
const act1Html = act1.map(s => `
    <figure class="sh" data-item="shot-${s.n}">
      <img src="${stills[s.n].url}" alt="">
      <figcaption><b>${s.n}.</b> ${esc(LINES[s.n])}<br><span class="k">${esc(s.cite)}</span></figcaption>
    </figure>`).join('');

const seed = ADD.map(p => ({ a: p.a, z: p.z }));

const html = `<link rel="stylesheet" href="/compare.css">
<style>
  /* Reserve the pill's column across ALL tappable text. Measured at 390px the
     pill sits x326-374, and words used to run under it, so a tap meant for a
     word hit the play button and started the autoscroll. */
  .ptext{padding-right:56px;font-size:1.06rem;line-height:2.0;margin:.3rem 0 0}
  w{cursor:pointer;padding:1px 0;border-radius:3px}
  w.v1{background:rgba(0,0,0,.055)}
  w.pick{background:var(--rose);color:#fff}
  w.a{border-top-left-radius:6px;border-bottom-left-radius:6px;padding-left:3px}
  w.z{border-top-right-radius:6px;border-bottom-right-radius:6px;padding-right:3px}
  w.pend{outline:2px solid var(--rose);outline-offset:1px}
  /* speaker change — a real break between voices, not a ">>" in the text */
  b.sp{display:block;height:0;margin:.55rem 0 0}
  b.sp::before{content:"";display:block;width:26px;border-top:1px solid var(--line);margin-bottom:.5rem}
  hr.div{border:0;border-top:2px solid var(--ink);opacity:.18;margin:2.4rem 0 0}
  .pas{padding:1.3rem 0 .4rem}
  .pas.main{background:rgba(0,0,0,.02);border-radius:8px;padding:1.3rem .8rem .8rem;margin-top:1rem}
  .phead h2{margin:0 0 .1rem;font-size:1.02rem}
  .bar{position:sticky;top:0;z-index:5;background:var(--paper);border-bottom:1px solid var(--line);
       padding:.55rem 0;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;padding-right:56px}
  .bar button{border-radius:6px}
  .k{font-size:.8rem;color:var(--ink2);margin:0}
  .sh{margin:0}.sh img{width:100%;border-radius:6px;display:block}
  .sh figcaption{font-size:.84rem;line-height:1.45;margin-top:.35rem}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:.9rem}
  .rec{border-left:3px solid var(--rose);padding-left:.7rem;margin:.5rem 0}
  .rec p{margin:.15rem 0}
</style>

<div class="wrap">
  <div class="eyebrow">Cannon · language film</div>
  <h1>Every passage — pick the cuts</h1>
  <p class="sub">All eleven source passages, each with a couple of minutes either side.
  Shaded words are already in the film. Rose is what I'd add. Tap a first word,
  then a last word.</p>

  <div class="bar">
    <button id="openlist">the list</button>
    <button id="undo" disabled>undo</button>
    <button id="clearpend">cancel</button>
    <span class="k" id="cnt">no picks yet</span>
    <span class="k" id="saved"></span>
  </div>
  <p class="k" id="sub2">tap a first word to start</p>

  ${sectionsHtml}

  <hr class="div">
  <div class="card">
    <h2>What I'd add to the Christmas passage</h2>
    ${ADD.map(a => `<div class="rec"><p>${esc(a.why)}</p></div>`).join('')}
    <p class="k">Pre-marked in rose. The short horizontal rules inside a passage
    are speaker changes — where the voice swaps between Dolores and whoever she
    is talking to.</p>
  </div>

  <h2>Act 1 — which alien examples stay</h2>
  <p class="sub">The druid is out. These seven remain, in order. Mark any that
  don't feel necessary.</p>
  <div class="grid2">${act1Html}</div>
</div>

<div id="sheet" class="sheet">
  <div class="sheethead"><b>Picks</b> <button id="closelist">close</button></div>
  <div id="list"></div>
  <p class="k" id="tot"></p>
</div>

<script src="/compare.js"></script>
<script>
(function(){
  var CHAT=${JSON.stringify(CHAT)}, SHEET=${JSON.stringify(SHEET)};
  var WORDS=${JSON.stringify(WORDS)};
  var SEED=${JSON.stringify(seed)};
  var ws=[].slice.call(document.querySelectorAll('.ptext w'));
  var picks=[], pend=null, undo=null, timer=null, loaded=false;

  function textOf(p){ var t=''; for(var i=p.a;i<=p.z;i++) t+=WORDS[i]+(i<p.z?' ':''); return t; }
  function inPick(i){ for(var k=0;k<picks.length;k++) if(i>=picks[k].a&&i<=picks[k].z) return k; return -1; }
  function paint(){
    ws.forEach(function(w){ w.classList.remove('pick','a','z','pend'); });
    picks.forEach(function(p){
      for(var i=p.a;i<=p.z;i++) if(ws[i]) ws[i].classList.add('pick');
      if(ws[p.a]) ws[p.a].classList.add('a');
      if(ws[p.z]) ws[p.z].classList.add('z');
    });
    if(pend!==null&&ws[pend]) ws[pend].classList.add('pend');
    var n=picks.length;
    document.getElementById('cnt').textContent=n?(n+(n===1?' pick':' picks')):'no picks yet';
    document.getElementById('sub2').textContent=pend!==null?'now tap the last word'
      :(n?'tap a first word to add another':'tap a first word to start');
    document.getElementById('undo').disabled=!undo;
  }
  function save(){
    if(!loaded) return;
    clearTimeout(timer);
    timer=setTimeout(function(){
      fetch('/api/chatfeed/verdict',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({chat:CHAT,sheet:SHEET,item:'picks',
          text:JSON.stringify(picks.map(function(p){return {a:p.a,z:p.z,text:textOf(p)};}))})})
        .then(function(){document.getElementById('saved').textContent='saved';})
        .catch(function(){document.getElementById('saved').textContent='not saved — try again';});
    },700);
  }
  function tap(i){
    if(window.__scrollStop) window.__scrollStop();
    if(pend===null){
      var k=inPick(i);
      if(k>=0){ undo=picks[k]; picks.splice(k,1); paint(); save(); return; }
      pend=i; paint(); return;
    }
    if(inPick(i)>=0){ pend=null; paint(); return; }
    var a=Math.min(pend,i), z=Math.max(pend,i);
    for(var j=a;j<=z;j++) if(inPick(j)>=0){ pend=null; paint(); return; }
    picks.push({a:a,z:z}); picks.sort(function(x,y){return x.a-y.a;});
    pend=null; paint(); save();
  }
  ws.forEach(function(w,i){ w.addEventListener('click',function(){ tap(i); }); });
  document.getElementById('clearpend').addEventListener('click',function(){ pend=null; paint(); });
  document.getElementById('undo').addEventListener('click',function(){
    if(!undo) return; picks.push(undo); picks.sort(function(x,y){return x.a-y.a;});
    undo=null; paint(); save();
  });

  function renderList(){
    var el=document.getElementById('list'); el.innerHTML=''; var wc=0;
    picks.forEach(function(p,n){
      wc+=(p.z-p.a+1);
      var d=document.createElement('div'); d.className='pk';
      var t=document.createElement('p'); t.textContent='\\u201C'+textOf(p)+'\\u201D';
      var row=document.createElement('div'); row.className='row';
      var jump=document.createElement('button'); jump.textContent='find it';
      jump.addEventListener('click',function(){ document.getElementById('sheet').classList.remove('on');
        if(window.__scrollStop) window.__scrollStop();
        ws[p.a].scrollIntoView({behavior:'smooth',block:'center'}); });
      var del=document.createElement('button'); del.textContent='remove';
      del.addEventListener('click',function(){ undo=picks[n]; picks.splice(n,1); paint(); save(); renderList(); });
      row.appendChild(jump); row.appendChild(del);
      d.appendChild(t); d.appendChild(row); el.appendChild(d);
    });
    document.getElementById('tot').textContent=picks.length
      ? picks.length+' picks, about '+wc+' words — roughly '+Math.round(wc/2.6)+' seconds read aloud.'
      : 'Nothing picked yet.';
  }
  document.getElementById('openlist').addEventListener('click',function(){ renderList();
    document.getElementById('sheet').classList.add('on'); });
  document.getElementById('closelist').addEventListener('click',function(){
    document.getElementById('sheet').classList.remove('on'); });

  fetch('/api/chatfeed/verdict?chat='+encodeURIComponent(CHAT)+'&sheet='+encodeURIComponent(SHEET))
    .then(function(r){ return r.json(); })
    .then(function(j){
      var raw=(j&&j.texts&&j.texts.picks)||null;
      if(raw){ try{ picks=JSON.parse(raw).map(function(p){return {a:p.a,z:p.z};}); }catch(e){ picks=SEED.slice(); } }
      else picks=SEED.slice();
    })
    .catch(function(){ picks=SEED.slice(); })
    .then(function(){ loaded=true; paint(); });

  if(window.__compareNotes) window.__compareNotes({chat:CHAT,sheet:SHEET});
})();
</script>`;

const out = path.join(DIR, 'picker2.html');
fs.writeFileSync(out, html);
console.log(`${SECTIONS.length} passages · ${WORDS.length} words · ${V1.length} v1 spans · ${seed.length} pre-marked`);
console.log(`speaker breaks: ${tokensBySection.reduce((a, t) => a + t.filter(x => x.brk).length, 0)}`);
console.log(out);
