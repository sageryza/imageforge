#!/usr/bin/env node
/* THE BELTS THAT STILL CUT HER SCENE AT 1,900 CHARACTERS (2026-09-08).
 *
 * The read-back saver — "A SAVE IS READ BACK, NEVER TRUSTED", written the day
 * a 2,343-character scene lost its tail ("a stupid error that's gonna lose my
 * edits") — landed in the belt builders the soap and rough-cut chats were
 * running and in NO OTHER COPY. Three belt pages she is still typing in were
 * measured the next day silently slicing every save to 1,900 characters:
 *
 *   hospital-night-film            Her scenes — the belt v9
 *   climax-dissociation-accounts   The climax — her scenes v1
 *   severance-api-multiple-frames  Her scenes — the belt v5
 *
 * A POSTED PAGE IS FROZEN, so fixing the builder cannot reach them — and
 * REBUILDING them from this repo would lose real work: measured against the
 * live v9, a rebuild from the committed jobs-md.json drops 9 stills, a video
 * and seven of her reference-line edits, because the chat that posted it has
 * newer job data in its own container. So this repairs the LIVE PAGE ITSELF:
 * the posted html, byte for byte, with only the saver swapped, re-posted as
 * the next version and the old one superseded. Her edits live on the verdict
 * sheet and are never touched.
 *
 *   node scripts/fix-belt-truncation.js            # dry — says what it would do
 *   node scripts/fix-belt-truncation.js --go       # posts
 *   node scripts/fix-belt-truncation.js --chat <slug> [--go]
 *   node scripts/fix-belt-truncation.js --out /tmp/pages   # the patched html, unposted
 *   node scripts/fix-belt-truncation.js --file docs/…/belt-md.html   # a snapshot in place
 *
 * It refuses to post a page whose script does not parse, and refuses any page
 * where a replacement did not apply exactly once — a half-patched saver is
 * worse than the truncation it replaces.
 */
'use strict';
const B = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHATS = ['hospital-night-film', 'climax-dissociation-accounts', 'severance-api-multiple-frames',
  'hospital-severance-rough-cut', 'soap-pill-scene'];

const args = process.argv.slice(2);
const GO = args.includes('--go');
const only = (() => { const i = args.indexOf('--chat'); return i >= 0 ? args[i + 1] : null; })();
// --out <dir> writes the patched page beside the dry run, so it can be driven
// in a browser before anything is posted
const OUT = (() => { const i = args.indexOf('--out'); return i >= 0 ? args[i + 1] : null; })();

const get = async (p) => {
  const r = await fetch(B + p);
  if (!r.ok) throw new Error(p + ' → ' + r.status);
  return r.headers.get('content-type') || ''.includes('json') ? r : r;
};
const getJSON = async (p) => (await (await fetch(B + p)).json());
const getText = async (p) => (await (await fetch(B + p)).text());
const post = async (p, body) => (await (await fetch(B + p, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})).json());

// the settled saver — the soap belt's, verbatim in behaviour: nothing is cut on
// the way out, an over-long box refuses and says by how much, and every save is
// read back off the sheet
const SAVER = (key) => `  function pieces(t){ var n=t.split(/\\r?\\n/).filter(function(l){return /^[ \\t]*cut[ \\t.!:]*$/i.test(l);}).length; return n?(' · '+(n+1)+' pieces'):''; }
  // A SAVE IS READ BACK, NEVER TRUSTED (2026-09-08, Sophie, after a 2,343-character scene lost its tail to a silent slice: "a stupid error that's gonna lose my edits"). Nothing is cut on the way out; over LIMIT the box refuses and says by how much; after every save the sheet is re-read and the box says so if the server kept less than it was sent.
  function bad(m){ sv.textContent=m; sv.classList.add('bad'); } function good(m){ sv.textContent=m; sv.classList.remove('bad'); }
  function save(t){ if(t.length>LIMIT){ bad('NOT SAVED — '+(t.length-LIMIT)+' characters over the box limit of '+LIMIT); return; }
    post({chat:CHAT,sheet:SHEET,item:${key},text:t}).then(function(r){return r.json();}).then(function(j){ if(j.chars!=null && j.chars<t.length) throw new Error('short');
      return fetch('/api/chatfeed/verdict?chat='+encodeURIComponent(CHAT)+'&sheet='+encodeURIComponent(SHEET)).then(function(r){return r.json();}).then(function(d){ var kept=(d.texts||{})[${key}]; if(typeof kept==='string' && kept.length<t.length) throw new Error('short'); good('saved'+pieces(t)); });
    }).catch(function(e){ bad(e && e.message==='short' ? 'NOT SAVED WHOLE — the server kept less than you typed; copy your text somewhere safe' : 'not saved'); }); }
  ta.addEventListener('input',function(){ fit(); var t=ta.value; sv.textContent='…'+pieces(t); clearTimeout(timer); timer=setTimeout(function(){ save(t); },700); });`;

function patch(html) {
  const notes = [];
  let out = html;
  const once = (re, to, what) => {
    // COUNT WITH A GLOBAL COPY. `String.match` on a non-global regex answers
    // the CAPTURES, so a one-hit replacement with two groups reads as three.
    const hits = out.match(new RegExp(re.source, 'g'));
    if (!hits || hits.length !== 1) throw new Error(what + ': matched ' + (hits ? hits.length : 0) + ' times');
    out = out.replace(re, to);
    notes.push(what);
  };
  // the key expression this page saves under, taken from its own handler
  const m = out.match(/ta\.addEventListener\('input'[^\n]*item:(k\+'\.'\+f|k\+'\.p'|k)\s*,text:t\.slice\(0,1900\)[^\n]*\n/);
  if (!m) throw new Error('no truncating input handler');
  const key = m[1];
  once(/var CHAT=('[^']*'), SHEET=('[^']*');/, "var CHAT=$1, SHEET=$2, LIMIT=8000;", 'the limit');
  out = out.replace(m[0], SAVER(key) + '\n');
  notes.push('the saver');
  const beacons = out.split('text:ta.value.slice(0,1900)').length - 1;
  if (!beacons) throw new Error('no beacon to widen');
  out = out.split('text:ta.value.slice(0,1900)').join('text:ta.value.slice(0,LIMIT)');
  notes.push('the beacon x' + beacons);
  if (!/\.saved\.bad\{/.test(out)) {
    once(/\.saved\{font-size:11px;color:#8a8176;min-height:14px;margin-top:3px\}/,
      '.saved{font-size:11px;color:#8a8176;min-height:14px;margin-top:3px} .saved.bad{color:#b5473c;font-weight:600}',
      'the refusal\'s colour');
  }
  if (out.includes('slice(0,1900)')) throw new Error('a truncation survived the patch');
  // it has to parse, or the page loses its saving, its pager and its help card
  const blocks = out.match(/<script>([\s\S]*?)<\/script>/g) || [];
  blocks.forEach((b, i) => {
    const js = b.replace(/^<script>/, '').replace(/<\/script>$/, '');
    try { new Function(js); } catch (e) { throw new Error('script ' + i + ' would not parse: ' + e.message); }
  });
  return { html: out, notes };
}

const bump = (title) => (/\bv(\d+)\s*$/.test(title)
  ? title.replace(/\bv(\d+)\s*$/, (_, n) => 'v' + (Number(n) + 1))
  : title + ' v2');

// a committed page SNAPSHOT (a builder's own output) is patched in place, so
// the record in the repo says what the live page now says
const FILE = (() => { const i = args.indexOf('--file'); return i >= 0 ? args[i + 1] : null; })();
if (FILE) {
  const fs2 = require('fs');
  const res = patch(fs2.readFileSync(FILE, 'utf8'));
  if (GO) fs2.writeFileSync(FILE, res.html);
  console.log((GO ? 'PATCHED  ' : 'WOULD PATCH  ') + FILE + '  (' + res.notes.join(', ') + ')');
  return;
}

(async () => {
  let fixed = 0, clean = 0;
  for (const chat of (only ? [only] : CHATS)) {
    const d = await getJSON('/api/chatfeed/pages?chat=' + encodeURIComponent(chat));
    const pages = Array.isArray(d) ? d : (d.pages || []);
    for (const p of pages) {
      if (p.superseded) continue;
      const html = await getText('/api/chatfeed/page/' + p.id);
      if (!html.includes('slice(0,1900)')) { if (html.includes('<textarea')) clean += 1; continue; }
      let res;
      try { res = patch(html); } catch (e) { console.log('REFUSED  ' + chat + ' · ' + p.title + ' — ' + e.message); continue; }
      const title = bump(p.title);
      console.log((GO ? 'FIXING   ' : 'WOULD FIX') + '  ' + chat + ' · ' + p.title + ' → ' + title
        + '  (' + res.notes.join(', ') + ')');
      fixed += 1;
      if (OUT) {
        require('fs').writeFileSync(require('path').join(OUT, p.id + '.html'), res.html);
        console.log('  wrote ' + require('path').join(OUT, p.id + '.html'));
      }
      if (!GO) continue;
      const r = await post('/api/chatfeed/page', { chat, title, html: res.html });
      if (!r || !r.id) { console.log('  !! the post came back without an id: ' + JSON.stringify(r).slice(0, 200)); continue; }
      await post('/api/chatfeed/page/' + p.id + '/supersede', { superseded: true });
      // the page really is fixed on the way back, not merely posted
      const back = await getText('/api/chatfeed/page/' + r.id);
      console.log('  posted ' + r.id + (back.includes('slice(0,1900)') ? '  !! STILL TRUNCATES' : '  · reads back whole')
        + (r.warnings && r.warnings.length ? '  · warnings: ' + r.warnings.join(' | ') : ''));
    }
  }
  console.log('\n' + (GO ? 'fixed ' : 'would fix ') + fixed + ' page(s); ' + clean + ' already save whole.');
})();
