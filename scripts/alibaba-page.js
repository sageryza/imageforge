#!/usr/bin/env node
/*
 * alibaba-page.js — post /alibaba into her Chats app as a COMPARE PAGE, so a
 * new version needs NO DEPLOY (2026-09-15, Sophie: "can work not on render").
 *
 * The Head Games rule, applied to a tool: the live server serves a posted page
 * out of storage, and because it runs on the SAME ORIGIN its /tool.css and
 * /house.css load exactly as they do on the route. The page is pure
 * client-side canvas — no API, no money — so nothing else about it needs the
 * server at all.
 *
 * The route at /alibaba stays; this is the door that moves without a deploy.
 * A change to the page is: edit public/alibaba.html, run the test, run this
 * with --go, then --supersede <old id>.
 *
 *   node scripts/alibaba-page.js            # dry — prints what it would post
 *   node scripts/alibaba-page.js --go
 *   node scripts/alibaba-page.js --go --supersede <pageId>
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'alibaba-chat-generator';
const LEDGER = path.join(__dirname, '..', 'docs', 'alibaba-page-versions');

const args = process.argv.slice(2);
const go = args.includes('--go');
const si = args.indexOf('--supersede');
const supersede = si >= 0 && args[si + 1] && !args[si + 1].startsWith('--') ? args[si + 1] : null;

let html = fs.readFileSync(path.join(__dirname, '..', 'public', 'alibaba.html'), 'utf8');
// The posted page is not served by serveGated, so nothing injects the back
// chevron — and the eyebrow IS the page's title here rather than a repeat of a
// native bar's. Both are true of every tool page posted this way.

let n = 1;
try { n = fs.readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean).length + 1; } catch (e) {}
const title = 'Alibaba chat v' + n;

(async () => {
  if (!go) {
    console.log('dry run — would post "' + title + '" to ' + CHAT + ' (' + html.length + ' bytes)');
    if (supersede) console.log('  and supersede ' + supersede);
    return;
  }
  const r = await fetch(BASE + '/api/chatfeed/page', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title, html }),
  });
  const j = await r.json();
  if (!j.id) { console.error('post failed', j); process.exit(1); }
  const url = BASE + '/api/chatfeed/page/' + j.id;
  console.log(title + ' → ' + url);
  if (j.warnings && j.warnings.length) console.log('  warnings: ' + j.warnings.join(' · '));
  fs.appendFileSync(LEDGER, [title, j.id, new Date().toISOString()].join('\t') + '\n');

  if (supersede) {
    const s = await fetch(BASE + '/api/chatfeed/page/' + supersede + '/supersede', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ by: j.id }),
    });
    console.log('superseded ' + supersede + ': ' + s.status);
  }
})();
