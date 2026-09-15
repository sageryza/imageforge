#!/usr/bin/env node
/*
 * stupid-idea-storyboard.js — post the Stupid Idea Factory storyboard into
 * her Chats app as a Compare page (2026-09-15, Sophie: "i just want a
 * storyboard so we know whst shots we need" · "dont change my words!").
 *
 * The page is docs/stupid-idea-factory/storyboard.html; the Alibaba
 * escalation script (shot 10) is docs/stupid-idea-factory/alibaba-escalation.txt
 * and is inlined into the page at post time, so the file is the one copy.
 * A new version is a new page: edit, --go, --supersede <old id>.
 *
 *   node scripts/stupid-idea-storyboard.js            # dry
 *   node scripts/stupid-idea-storyboard.js --go [--supersede <pageId>]
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'stupid-idea-factory-storyboard';
const DIR = path.join(__dirname, '..', 'docs', 'stupid-idea-factory');
const LEDGER = path.join(DIR, 'VERSIONS');

const args = process.argv.slice(2);
// --seedance posts the Seedance script page (seedance-script.html, generated
// from seedance-script.txt) instead of the storyboard; its own ledger line.
const seedance = args.includes('--seedance');
const go = args.includes('--go');
const si = args.indexOf('--supersede');
const supersede = si >= 0 && args[si + 1] && !args[si + 1].startsWith('--') ? args[si + 1] : null;

function build() {
  const esc = fs.readFileSync(path.join(DIR, 'alibaba-escalation.txt'), 'utf8').trim();
  if (seedance) return fs.readFileSync(path.join(DIR, 'seedance-script.html'), 'utf8');
  return fs.readFileSync(path.join(DIR, 'storyboard.html'), 'utf8')
    .replace('__ESCALATION__', JSON.stringify(esc));
}

let n = 1;
try { n = fs.readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean).length + 1; } catch (e) {}
const KIND = seedance ? 'Seedance script' : 'storyboard';
try { n = fs.readFileSync(LEDGER, 'utf8').split('\n').filter(l => l.startsWith('Stupid Idea Factory — ' + KIND)).length + 1; } catch (e) {}
const title = 'Stupid Idea Factory — ' + KIND + ' v' + n;

(async () => {
  const html = build();
  if (!go) {
    console.log('dry run — would post "' + title + '" to ' + CHAT + ' (' + html.length + ' bytes)');
    if (supersede) console.log('  and supersede ' + supersede);
    return;
  }
  const r = await fetch(BASE + '/api/chatfeed/page', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title, html }),
  });
  const j = await r.json();
  if (!j.id) { console.error('post failed', j); process.exit(1); }
  console.log(title + ' → ' + BASE + '/api/chatfeed/page/' + j.id);
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
module.exports = { build };
