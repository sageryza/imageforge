#!/usr/bin/env node
// Build the "pick your own lines" working page for the Custodians 2 language
// passage — the grasshopper chat's word-picker, reused, with two changes:
//   * it LOADS saved picks on boot (the original started empty every time, so
//     a reload lost the marking), and
//   * my recommended additions are pre-marked, so Sophie adjusts rather than
//     starting from a blank passage.
// Words already used in film v1 are shaded so it's obvious what's spoken for.
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const SPAN = JSON.parse(fs.readFileSync('/tmp/claude-0/-home-user/f2896c89-febe-5a45-b7dd-d2f403c0f14e/scratchpad/span.json', 'utf8'));
const LINES = JSON.parse(fs.readFileSync(path.join(DIR, 'lines.local.json'), 'utf8'));
const CHAT = 'illustrated-cannon-passage';
const SHEET = 'language-passage-picks';

const WORDS = SPAN.text.split(' ').filter(Boolean);
const norm = w => w.toLowerCase().replace(/[^a-z0-9']/g, '');
const HAY = WORDS.map(norm);

// contiguous positional best-match slide — same rule as the narration cutter
function locate(phrase) {
  const t = phrase.split(/\s+/).map(norm).filter(Boolean);
  let best = { score: -1, a: 0, z: t.length - 1 };
  for (let len = Math.max(1, t.length - 2); len <= t.length + 2; len++) {
    for (let i = 0; i + len <= HAY.length; i++) {
      let hit = 0; const n = Math.min(len, t.length);
      for (let k = 0; k < n; k++) if (HAY[i + k] === t[k]) hit++;
      const score = hit / Math.max(len, t.length);
      if (score > best.score) best = { score, a: i, z: i + len - 1 };
    }
  }
  return best;
}

// already in film v1 (shots 12-19 all come from this passage)
const V1 = [12, 13, 14, 15, 16, 17, 18, 19].map(n => {
  const m = locate(LINES[n]);
  return { n, ...m };
});

// what I think should be added, in passage order
const ADD = [
  ['the setup — that we already do this without realising it',
    'He said we do the same thing without realizing it but we have not developed it to the point they have'],
  ['the list itself — what the one symbol actually unpacks into',
    'Christmas trees, decorations, presents, baby Jesus, nativity, Santa Claus, the colors red and green, bells, and on and on'],
  ['the closing — whole concepts in such a simple device',
    'incorporating whole concepts in such a simple device and often a lack of patience with our tedious methods of communicating in written and spoken language'],
].map(([why, phrase]) => ({ why, phrase, ...locate(phrase) }));

// offered but not recommended — she may want them
const MAYBE = [
  ['their symbols are written down too — on the craft walls and in books',
    'We use symbols to describe or give information either in mental communication or in writing'],
  ['she was shown a book of it and told she did understand, in a certain state of mind',
    'she was told that she did understand but only in a certain state of mind would she be able to interpret'],
].map(([why, phrase]) => ({ why, phrase, ...locate(phrase) }));

for (const r of [...V1, ...ADD, ...MAYBE]) {
  if (r.score < 0.8) console.error(`  LOW MATCH ${r.score.toFixed(2)}: ${(r.phrase || LINES[r.n]).slice(0, 60)}`);
}

const used = new Set();
for (const v of V1) for (let i = v.a; i <= v.z; i++) used.add(i);

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const wordHtml = WORDS.map((w, i) =>
  `<w${used.has(i) ? ' class="v1"' : ''}>${esc(w)}</w>`).join(' ');

const seed = [...ADD, ...MAYBE.slice(0, 0)].map(p => ({ a: p.a, z: p.z }));

// ── the Act 1 shots, so she can mark which alien examples to drop ────────────
const shots = JSON.parse(fs.readFileSync(path.join(DIR, 'shots.json'), 'utf8')).shots;
const stills = JSON.parse(fs.readFileSync(path.join(DIR, 'renders-medium.json'), 'utf8'));
const act1 = shots.filter(s => s.act === '1' && s.n !== 1);
const act1Html = act1.map(s => `
    <figure class="sh" data-item="shot-${s.n}">
      <img src="${stills[s.n].url}" alt="">
      <figcaption><b>${s.n}.</b> ${esc(LINES[s.n])}<br><span class="cite">${esc(s.cite)}</span></figcaption>
    </figure>`).join('');

const html = `<link rel="stylesheet" href="/compare.css">
<style>
  #read{font-size:1.06rem;line-height:2.05;margin:0 0 1.2rem}
  w{cursor:pointer;padding:1px 0;border-radius:3px}
  w.v1{background:rgba(0,0,0,.055)}
  w.pick{background:var(--rose);color:#fff}
  w.a{border-top-left-radius:6px;border-bottom-left-radius:6px;padding-left:3px}
  w.z{border-top-right-radius:6px;border-bottom-right-radius:6px;padding-right:3px}
  w.pend{outline:2px solid var(--rose);outline-offset:1px}
  .bar{position:sticky;top:0;z-index:5;background:var(--paper);border-bottom:1px solid var(--line);
       padding:.55rem 0;margin-bottom:.9rem;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;padding-right:56px}
  .bar button{border-radius:6px}
  .k{font-size:.82rem;color:var(--ink2)}
  .sh{margin:0}
  .sh img{width:100%;border-radius:6px;display:block}
  .sh figcaption{font-size:.84rem;line-height:1.45;margin-top:.35rem}
  .cite{color:var(--ink2);font-size:.76rem}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:.9rem}
  .rec{border-left:3px solid var(--rose);padding-left:.7rem;margin:.6rem 0}
  .rec p{margin:.2rem 0}
</style>

<div class="wrap">
  <div class="eyebrow">Cannon · language film</div>
  <h1>The whole passage</h1>
  <p class="sub">Custodians of the Universe 2, 5:23–5:30. Everything before, during and after
  the symbol passage and the Christmas example. Shaded words are already in v1.
  The rose ones are what I'd add.</p>

  <div class="bar">
    <button id="openlist">the list</button>
    <button id="undo" disabled>undo</button>
    <button id="clearpend" >cancel</button>
    <span class="k" id="cnt">no picks yet</span>
    <span class="k" id="saved"></span>
  </div>
  <p class="k" id="sub2">tap a first word to start</p>

  <div id="read">${wordHtml}</div>

  <div class="card">
    <h2>What I'd add, and why</h2>
    ${ADD.map(a => `<div class="rec"><p>${esc(a.why)}</p></div>`).join('')}
    <p class="k">Pre-marked in rose above. The two I'd offer but not push for:
    ${MAYBE.map(m => esc(m.why)).join('; ')}.</p>
  </div>

  <h2>Act 1 — which alien examples stay</h2>
  <p class="sub">The druid is already out. These are the seven that remain, in order.
  Mark the ones that don't feel necessary and I'll drop them.</p>
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
  var read=document.getElementById('read');
  var ws=[].slice.call(read.querySelectorAll('w'));
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
    var el=document.getElementById('list'); el.innerHTML='';
    var wc=0;
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

  // Load what was marked last time; fall back to my recommendations the first
  // time the page is opened. Without this a reload silently lost her marking.
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

const out = path.join(DIR, 'picker.html');
fs.writeFileSync(out, html);
console.log(`${WORDS.length} words · v1 spans ${V1.length} · pre-marked ${seed.length} · ${out}`);
V1.forEach(v => console.log(`  v1 shot ${String(v.n).padStart(2)} @ ${v.a}-${v.z} (${v.score.toFixed(2)})`));
ADD.forEach(a => console.log(`  ADD ${a.a}-${a.z} (${a.score.toFixed(2)}) ${a.why}`));
