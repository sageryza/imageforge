#!/usr/bin/env node
/* THE THREE SCENES-INDEX PAGES, LEVEL (2026-09-10, Sophie: "add send to
 * footage button · and chapter buttons etc · so light blue ward, nautch and
 * ticky tack all have all features").
 *
 * Three pages, three chats, three copies of one builder — so each feature
 * landed on exactly one of them:
 *
 *   The ward film — the scenes       ward-film-page-duplicate    footage only
 *   The Nautchaug Boyfriend's        new-script-draft            fold + rail
 *   … the same page, posted twice    icon-styling-beige-3d       fold + rail
 *   Ticky Tack — the scenes          ticky-tack-film-page-dupe   neither
 *
 * A POSTED PAGE IS FROZEN and two of the three builders live in another
 * chat's container, so this does NOT rebuild them — a rebuild loses whatever
 * that chat has that this repo does not (the belt repair measured 9 stills, a
 * video and seven reference-line edits lost that way). It adds ONE LINE to the
 * posted html:
 *
 *   <script src="/scene-index.js"></script>
 *
 * and re-posts it as the next version, superseding the old. Everything else
 * is byte for byte what it was. The behaviours themselves live in the served
 * file, so the NEXT fix reaches all three with nothing re-posted — which is
 * the half that stops this drifting again.
 *
 *   node scripts/level-scene-pages.js            # dry — says what it would do
 *   node scripts/level-scene-pages.js --go       # posts
 *   node scripts/level-scene-pages.js --chat <slug> [--go]
 *   node scripts/level-scene-pages.js --out /tmp/pages   # the patched html, unposted
 *   node scripts/level-scene-pages.js --file scripts/ticky-tack/scenes.html
 *
 * It refuses a page that is not a scenes index, one that already links the
 * file, and one whose scripts would not parse after the edit.
 */
'use strict';
const B = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHATS = [
  'ward-film-page-duplicate',
  'new-script-draft',
  'icon-styling-beige-3d',
  'ticky-tack-film-page-dupe',
];

const args = process.argv.slice(2);
const GO = args.includes('--go');
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const only = arg('--chat');
const OUT = arg('--out');
const FILE = arg('--file');

const TAG = '<script src="/scene-index.js"></script>';
const AFTER = '<script src="/compare.js"></script>';

// A scenes index is the wall of little keys: a .grid holding chapter headings
// and anchors whose href is a card on a belt page. A belt page, a deck or an
// ordinary Compare page is none of those and is left alone.
function isSceneIndex(html) {
  return /class="grid"/.test(html)
    && /class="ep"/.test(html)
    && /<a class="b"[^>]*href="\/api\/chatfeed\/page\/[A-Za-z0-9_-]+#j-/.test(html);
}

function patch(html) {
  if (html.includes('/scene-index.js')) throw new Error('already links the kit');
  if (!isSceneIndex(html)) throw new Error('not a scenes index');
  const hits = html.split(AFTER).length - 1;
  if (hits !== 1) throw new Error('compare.js is linked ' + hits + ' times, expected once');
  const out = html.replace(AFTER, AFTER + '\n' + TAG);
  // it has to parse, or the page loses its help card and its own wiring
  (out.match(/<script>([\s\S]*?)<\/script>/g) || []).forEach((b, i) => {
    const js = b.replace(/^<script>/, '').replace(/<\/script>$/, '');
    try { new Function(js); } catch (e) { throw new Error('script ' + i + ' would not parse: ' + e.message); }
  });
  if (!out.includes(TAG)) throw new Error('the tag did not land');
  return out;
}

// what the page is short of, so the dry run says why it is being touched
function missing(html) {
  const out = [];
  if (!/class="ff"/.test(html)) out.push('footage keys');
  if (!/<button class="ep"/.test(html)) out.push('the chapter fold');
  if (!/className='rail'|class="rail"/.test(html)) out.push('the chapter rail');
  return out.length ? out.join(', ') : 'nothing — it links the kit for the next fix';
}

const getJSON = async (p) => (await (await fetch(B + p)).json());
const getText = async (p) => (await (await fetch(B + p)).text());
const post = async (p, body) => (await (await fetch(B + p, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})).json());

const bump = (title) => (/\bv(\d+)(\s*\(.*\))?\s*$/.test(title)
  ? title.replace(/\bv(\d+)/, (_, n) => 'v' + (Number(n) + 1))
  : title + ' v2');

if (FILE) {
  const fs = require('fs');
  const html = patch(fs.readFileSync(FILE, 'utf8'));
  if (GO) fs.writeFileSync(FILE, html);
  console.log((GO ? 'PATCHED  ' : 'WOULD PATCH  ') + FILE);
  return;
}

(async () => {
  let done = 0, skipped = 0;
  for (const chat of (only ? [only] : CHATS)) {
    const d = await getJSON('/api/chatfeed/pages?chat=' + encodeURIComponent(chat));
    const pages = Array.isArray(d) ? d : (d.pages || []);
    for (const p of pages) {
      if (p.superseded) continue;
      const html = await getText('/api/chatfeed/page/' + p.id);
      if (!isSceneIndex(html)) continue;
      let out;
      try { out = patch(html); } catch (e) { console.log('SKIP     ' + chat + ' · ' + p.title + ' — ' + e.message); skipped += 1; continue; }
      const title = bump(p.title);
      console.log((GO ? 'LEVELS   ' : 'WOULD    ') + chat + ' · ' + p.title + ' → ' + title
        + '\n           gains: ' + missing(html));
      done += 1;
      if (OUT) {
        const f = require('path').join(OUT, p.id + '.html');
        require('fs').writeFileSync(f, out);
        console.log('           wrote ' + f);
      }
      if (!GO) continue;
      const r = await post('/api/chatfeed/page', { chat, title, html: out });
      if (!r || !r.id) { console.log('  !! the post came back without an id: ' + JSON.stringify(r).slice(0, 200)); continue; }
      await post('/api/chatfeed/page/' + p.id + '/supersede', { superseded: true });
      const back = await getText('/api/chatfeed/page/' + r.id);
      console.log('           posted ' + r.id
        + (back.includes('/scene-index.js') ? '  · links the kit' : '  !! THE TAG IS NOT THERE')
        + (r.warnings && r.warnings.length ? '  · warnings: ' + r.warnings.join(' | ') : ''));
    }
  }
  console.log('\n' + (GO ? 'levelled ' : 'would level ') + done + ' page(s); ' + skipped + ' skipped.');
})();
