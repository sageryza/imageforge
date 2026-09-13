#!/usr/bin/env node
/* THE COMMERCIAL CONCEPTS PAGE — every idea she described, in her own words,
 * as plain text she can copy, edit, or split into blocks (2026-09-13, Sophie:
 * "i'm looking for commercial concepts that i forgot about … search my
 * messages … put in compare tab, but not the tinder template just basically
 * plain text that i can copy, edit, or split into blocks").
 *
 * HER WORDS ARE NEVER COMMITTED. This repo is public, so
 * docs/commercial-concepts/sources.json holds only WHERE each block comes
 * from — a chat message by {chat, at} or a voice memo by {memo} — and the
 * text is resolved LIVE at build time out of `forge-chat-feed` and the memo
 * manifest. It lands on the Compare page and nowhere else.
 *
 * TWO KEY NAMESPACES ON ONE SHEET, and they must not touch (2026-09-07):
 *   <cid>           her NOTE thread on that concept (__compareNotes owns it)
 *   ord-<cid>       the block order, JSON array of block keys
 *   <cid>.<bk>      the text of one block
 * A page that saved its own text under the data-item id lost her scene edit
 * to her own note; that is why the text rides its own key here.
 *
 *   node scripts/commercial-concepts-page.js            # dry — writes the html
 *   node scripts/commercial-concepts-page.js --go       # posts it
 *   node scripts/commercial-concepts-page.js --go --supersede <pageId>
 */
'use strict';
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const B = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const args = process.argv.slice(2);
const GO = args.includes('--go');
const OUT = (() => { const i = args.indexOf('--out'); return i >= 0 ? args[i + 1] : null; })();
const SUP = (() => { const i = args.indexOf('--supersede'); return i >= 0 ? args[i + 1] : null; })();
const TITLE = (() => { const i = args.indexOf('--title'); return i >= 0 ? args[i + 1] : 'Commercial concepts — everything you described (v1)'; })();

const SRC = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'commercial-concepts', 'sources.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');

// ---- the two live sources ---------------------------------------------------
async function feed() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set — the page cannot be built without it');
  const app = admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) }, 'feed-' + Date.now());
  const snap = await app.firestore().collection('forge-chat-feed').where('from', '==', 'sophie').get();
  const rows = snap.docs.map((d) => { const x = d.data(); return { chat: x.chat, created: x.created || '', text: x.text || '' }; });
  rows.sort((a, b) => (a.created < b.created ? -1 : 1));
  return rows;
}
async function memos() {
  const raw = process.env.STORY_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('STORY_FIREBASE_SERVICE_ACCOUNT is not set');
  const sa = JSON.parse(raw);
  const app = admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: sa.project_id + '.firebasestorage.app' }, 'memo-' + Date.now());
  const [buf] = await app.storage().bucket().file('memo-audio/manifest.json').download();
  const m = JSON.parse(buf.toString());
  const by = {};
  m.memos.forEach((x) => { by[x.id] = x; });
  return by;
}

// A BLOCK RESOLVES TO EXACTLY ONE SOURCE OR THE BUILD FAILS. A near-miss on a
// timestamp would silently drop one of her ideas off the page, and nothing on
// the page would say so.
function resolve(block, rows, mem) {
  if (block.memo) {
    const x = mem[block.memo];
    if (!x) throw new Error('memo not found: ' + block.memo);
    const t = String(x.transcript || '').trim();
    if (!t) throw new Error('memo has no transcript: ' + block.memo);
    return { text: t, from: 'voice memo · ' + String(x.date || '').slice(0, 10) + (x.title ? ' · ' + x.title : ''), link: null };
  }
  let hits = rows.filter((r) => r.chat === block.chat && r.created.startsWith(block.at));
  if (block.contains) hits = hits.filter((r) => r.text.includes(block.contains));
  if (hits.length !== 1) throw new Error(block.chat + ' @ ' + block.at + (block.contains ? ' ~ "' + block.contains + '"' : '') + ' → matched ' + hits.length);
  return { text: hits[0].text.trim(), from: hits[0].created.slice(0, 10) + ' · ' + block.chat, link: block.chat };
}

// ---- the page ---------------------------------------------------------------
function build(resolved) {
  const secs = resolved.map((c) => {
    const blocks = c.blocks.map((b, i) => `      <div class="blk" data-k="b${i}">
        <div class="src">${esc(b.from)}${b.link ? ` · <a href="/chats?chat=${attr(b.link)}">open the chat</a>` : ''}</div>
        <textarea class="p" data-key="${attr(c.id)}.b${i}" spellcheck="false">${esc(b.text)}</textarea>
        <div class="row"><button class="cp">copy</button><button class="dv">divide here</button><button class="jn" hidden>join up</button><span class="sv"></span></div>
      </div>`).join('\n');
    return `  <div class="card" data-item="${attr(c.id)}" data-cid="${attr(c.id)}">
    <h2>${esc(c.title)}</h2>
    <div class="blks">
${blocks}
    </div>
${c.also ? `    <div class="also">${esc(c.also)}</div>` : ''}
  </div>`;
  }).join('\n\n');

  const leads = (SRC.leads || []).map((l) => `<li>${esc(l)}</li>`).join('');

  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(TITLE)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  /* THE PILL OWNS THE TOP-RIGHT CORNER, and compare.js hangs the "?" off the
     end of the title — 64px, never 56 (measured: the pill's left edge is x=326
     at 390pt, so a 56 reserve ends at 334 and the last 8px is dead). */
  .wrap > h1{padding-right:64px}
  .blk{margin:0 0 14px}
  .src{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink2);margin:0 0 4px}
  .src a{color:var(--ink2)}
  textarea.p{width:100%;box-sizing:border-box;display:block;background:var(--paper);color:var(--ink);
    border:1px solid var(--line);border-radius:6px;padding:10px 12px;font-family:inherit;font-size:16px;line-height:1.55;
    resize:none;overflow:hidden;min-height:0}
  .row{display:flex;gap:8px;align-items:center;margin:5px 0 0}
  .row button{font-size:12px;padding:4px 9px;border-radius:6px;border:1px solid var(--line);
    background:transparent;color:var(--ink);cursor:pointer}
  .row .sv{font-size:11px;color:var(--ink2)}
  .row .sv.bad{color:#b0342c}
  .also{font-size:12px;color:var(--ink2);margin:2px 0 0;line-height:1.5}
  .leads{font-size:13px;color:var(--ink2);line-height:1.6}
  [hidden]{display:none !important}
</style>

<div class="wrap">
  <h1>${esc(TITLE)}</h1>

${secs}

  <div class="card" data-item="leads">
    <h2>Leads — described somewhere other than a message</h2>
    <ul class="leads">${leads}</ul>
  </div>
</div>

<script src="/compare.js"></script>
<script>
(function () {
  var CHAT = ${JSON.stringify(SRC.chat)}, SHEET = ${JSON.stringify(SRC.sheet)}, LIMIT = 8000;

  function post(body){ return fetch('/api/chatfeed/verdict',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify(body)}); }
  function sheet(){ return fetch('/api/chatfeed/verdict?chat='+encodeURIComponent(CHAT)+'&sheet='+encodeURIComponent(SHEET))
    .then(function(r){return r.json();}); }

  function fit(ta){ ta.style.height='auto'; ta.style.height=(ta.scrollHeight+(ta.offsetHeight-ta.clientHeight))+'px'; }

  // A SAVE IS READ BACK, NEVER TRUSTED (2026-09-08, Sophie, after a scene lost
  // its tail to a silent slice: "a stupid error that's gonna lose my edits").
  // Nothing is cut on the way out; over LIMIT the box refuses and says by how
  // much; after every save the sheet is re-read and the box says so if the
  // server kept less than it was sent.
  function bad(sv,m){ sv.textContent=m; sv.classList.add('bad'); }
  function good(sv,m){ sv.textContent=m; sv.classList.remove('bad'); }
  function save(key, t, sv){
    if(t.length>LIMIT){ bad(sv,'NOT SAVED — '+(t.length-LIMIT)+' characters over the box limit of '+LIMIT); return Promise.resolve(false); }
    return post({chat:CHAT,sheet:SHEET,item:key,text:t}).then(function(r){return r.json();}).then(function(j){
      if(j && j.chars!=null && j.chars<t.length) throw new Error('short');
      return sheet().then(function(d){ var kept=(d.texts||{})[key];
        if(typeof kept==='string' && kept.length<t.length) throw new Error('short');
        good(sv,'saved'); return true; });
    }).catch(function(e){
      bad(sv, e && e.message==='short'
        ? 'NOT SAVED WHOLE — the server kept less than you typed; copy your text somewhere safe'
        : 'not saved'); return false; });
  }
  function saveOrder(cid, keys){ return post({chat:CHAT,sheet:SHEET,item:'ord-'+cid,text:JSON.stringify(keys)}); }

  function keysOf(card){ return [].map.call(card.querySelectorAll('.blk'), function(b){ return b.dataset.k; }); }
  function nextKey(card){
    var n=0; keysOf(card).forEach(function(k){ var m=/^b(\\d+)$/.exec(k); if(m) n=Math.max(n, +m[1]+1); });
    return 'b'+n;
  }
  function paintJoin(card){
    [].forEach.call(card.querySelectorAll('.blk'), function(b,i){ b.querySelector('.jn').hidden = (i===0); });
  }

  function wire(blk){
    var card=blk.closest('.card'), cid=card.dataset.cid;
    var ta=blk.querySelector('textarea'), sv=blk.querySelector('.sv'), timer=null;
    fit(ta);
    ta.addEventListener('input',function(){ fit(ta); sv.textContent='…';
      clearTimeout(timer); timer=setTimeout(function(){ save(ta.dataset.key, ta.value, sv); },700); });

    blk.querySelector('.cp').addEventListener('click',function(e){
      e.preventDefault();
      var t=ta.value;
      var done=function(){ good(sv,'copied'); };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(t).then(done,function(){ ta.focus(); ta.select(); good(sv,'selected — hold and Copy'); });
      } else { ta.focus(); ta.select(); good(sv,'selected — hold and Copy'); }
    });

    // DIVIDE AT THE CURSOR — footage's own gesture. Nothing is lost: the tail
    // becomes a new block right under this one, and "join up" puts it back.
    blk.querySelector('.dv').addEventListener('click',function(e){
      e.preventDefault();
      var at=(ta.selectionStart==null?ta.value.length:ta.selectionStart);
      var head=ta.value.slice(0,at).replace(/\\s+$/,''), tail=ta.value.slice(at).replace(/^\\s+/,'');
      if(!tail){ bad(sv,'put the cursor where you want the split'); return; }
      var k=nextKey(card);
      var nb=blk.cloneNode(true);
      nb.dataset.k=k;
      var nta=nb.querySelector('textarea'); nta.dataset.key=cid+'.'+k; nta.value=tail;
      nb.querySelector('.src').innerHTML=blk.querySelector('.src').innerHTML;
      nb.querySelector('.sv').textContent=''; nb.querySelector('.sv').classList.remove('bad');
      blk.parentNode.insertBefore(nb,blk.nextSibling);
      ta.value=head; fit(ta); wire(nb); paintJoin(card);
      save(ta.dataset.key,head,sv);
      save(nta.dataset.key,tail,nb.querySelector('.sv'));
      saveOrder(cid,keysOf(card));
    });

    blk.querySelector('.jn').addEventListener('click',function(e){
      e.preventDefault();
      var prev=blk.previousElementSibling;
      if(!prev || !prev.classList.contains('blk')) return;
      var pta=prev.querySelector('textarea');
      pta.value=(pta.value.replace(/\\s+$/,'')+'\\n\\n'+ta.value.replace(/^\\s+/,''));
      fit(pta);
      save(ta.dataset.key,'',sv);
      blk.remove();
      save(pta.dataset.key,pta.value,prev.querySelector('.sv'));
      saveOrder(cid,keysOf(card)); paintJoin(card);
    });
  }

  // HER SAVED VERSION WINS OVER THE SEED, and a saved ORDER rebuilds the
  // blocks she divided. A concept with nothing saved is byte-for-byte what
  // this build put there.
  function restore(d){
    var texts=(d && d.texts) || {};
    [].forEach.call(document.querySelectorAll('.card[data-cid]'), function(card){
      var cid=card.dataset.cid, host=card.querySelector('.blks');
      var ord=null;
      try { var raw=texts['ord-'+cid]; if(raw) ord=JSON.parse(raw); } catch(_){}
      if(Array.isArray(ord) && ord.length){
        var seeds={}; [].forEach.call(card.querySelectorAll('.blk'), function(b){ seeds[b.dataset.k]=b; });
        var proto=card.querySelector('.blk');
        ord.forEach(function(k){
          var b=seeds[k];
          if(!b){
            b=proto.cloneNode(true); b.dataset.k=k;
            b.querySelector('textarea').dataset.key=cid+'.'+k;
            b.querySelector('.sv').textContent='';
          }
          var t=texts[cid+'.'+k];
          if(typeof t==='string') b.querySelector('textarea').value=t;
          host.appendChild(b);
          delete seeds[k];
        });
        Object.keys(seeds).forEach(function(k){ seeds[k].remove(); });
      } else {
        [].forEach.call(card.querySelectorAll('.blk'), function(b){
          var t=texts[cid+'.'+b.dataset.k];
          if(typeof t==='string' && t) b.querySelector('textarea').value=t;
        });
      }
      [].forEach.call(card.querySelectorAll('.blk'), wire);
      paintJoin(card);
    });
  }

  [].forEach.call(document.querySelectorAll('.blk'), function(b){ fit(b.querySelector('textarea')); });
  sheet().then(restore, function(){ restore(null); });

  // A tap inside a box must not toggle the reading autoscroll.
  document.addEventListener('pointerdown', function(e){
    if(e.target.closest('textarea, .row')) e.stopPropagation();
  }, true);

  window.__compareNotes({ chat: CHAT, sheet: SHEET });
  window.__compareHelp({ html:
    '<p>Every commercial or film idea you described, in your own words, pulled out of your messages and your voice memos.</p>'
    + '<p><b>copy</b> puts that block on the clipboard. Type in a box to edit it \\u2014 it saves itself. <b>divide here</b> splits a block at the cursor into two; <b>join up</b> puts it back.</p>'
    + '<p>The small + in a corner is a note to Claude, kept separately from the text.</p>' });
})();
</script>
`;
}

(async () => {
  const [rows, mem] = await Promise.all([feed(), memos()]);
  const resolved = SRC.concepts.map((c) => ({
    id: c.id, title: c.title, also: c.also || '',
    blocks: c.blocks.map((b) => resolve(b, rows, mem)),
  }));
  const html = build(resolved);
  const words = resolved.reduce((n, c) => n + c.blocks.reduce((m, b) => m + b.text.length, 0), 0);
  console.log(resolved.length + ' concepts, ' + resolved.reduce((n, c) => n + c.blocks.length, 0) + ' blocks, ' + words + ' characters of her words');
  const out = OUT || path.join(require('os').tmpdir(), 'commercial-concepts.html');
  fs.writeFileSync(out, html);
  console.log('html → ' + out + ' (' + html.length + ' bytes)');
  if (!GO) { console.log('dry — pass --go to post'); return; }
  const r = await fetch(B + '/api/chatfeed/page', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat: SRC.chat, title: TITLE, html }),
  });
  const j = await r.json();
  console.log(JSON.stringify(j, null, 2));
  if (SUP && j.id) {
    const s = await fetch(B + '/api/chatfeed/page/' + SUP + '/supersede', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    console.log('superseded ' + SUP + ': ' + s.status);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
