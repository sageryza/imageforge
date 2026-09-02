#!/usr/bin/env node
// scripts/alibaba-quotes.js — sort a pile of Alibaba supplier quotes into a
// swipe deck in her Chats app. The module is ../alibaba-quotes.js; this is the
// doors in and the one door out.
//
//   node scripts/alibaba-quotes.js --album "alibaba quotes" --qty 500 --chat <slug>
//   node scripts/alibaba-quotes.js --image ./q1.png --image https://…/q2.jpg --dry
//   node scripts/alibaba-quotes.js --text quotes.txt          # quotes separated by a --- line
//   node scripts/alibaba-quotes.js --from quotes.json --qty 1000 --chat <slug>   # re-post, no model call
//
//   --album <name>     a Dump album (her Photos album sent through the Dump tile)
//   --image <url|file> one screenshot; repeat it
//   --text <file>      pasted quotes, one per block, blocks separated by a line of ---
//   --qty <n>          her order quantity — the rank is the unit price at that size
//   --product <words>  what she is buying, for the title
//   --chat <slug>      the chat whose Compare tab gets the deck (default: the branch)
//   --out <file>       save the extracted quotes as JSON (free to re-post from)
//   --from <file>      skip extraction, build from a saved JSON
//   --dry              print the deck, post nothing
//
// COSTS ~3¢ A QUOTE (one claude-opus-5 call per screenshot); --from and --dry
// with --from cost nothing. Needs FIREBASE_SERVICE_ACCOUNT to hydrate the
// Claude key from Firestore when ANTHROPIC_API_KEY is not in the environment.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const admin = require('firebase-admin');
const { loadConfig } = require('../config-loader');
const aq = require('../alibaba-quotes');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : ''; };
const opts = (k) => args.map((a, i) => (a === k ? args[i + 1] : null)).filter(Boolean);

function branchChat() {
  if (process.env.FORGE_CHAT) return process.env.FORGE_CHAT;
  try {
    const b = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    return b.replace(/^claude\//, '').replace(/-[a-z0-9]{6}$/, '');
  } catch { return ''; }
}

async function albumFiles(name) {
  const res = await fetch(`${BASE}/api/drop/bundles`);
  const j = await res.json();
  const want = String(name).trim().toLowerCase();
  const b = (j.bundles || []).find((x) => String(x.bundleName || '').trim().toLowerCase() === want)
    || (j.bundles || []).find((x) => String(x.bundle || '').toLowerCase() === want.replace(/[^a-z0-9]+/g, '-'));
  if (!b) throw new Error(`no Dump album called "${name}" — albums: ${(j.bundles || []).slice(0, 12).map((x) => x.bundleName || x.bundle).join(' · ')}`);
  const files = b.files.filter((f) => (f.media || 'image') === 'image').sort((a, c) => (a.photoIndex || 0) - (c.photoIndex || 0));
  if (!files.length) throw new Error(`album "${name}" holds no pictures`);
  return files.map((f, i) => ({ url: f.url, name: `${b.bundleName || b.bundle} ${i + 1}` }));
}

function imageSrc(x) {
  if (/^https?:\/\//i.test(x)) return { url: x, name: x.split('/').pop() };
  const bytes = fs.readFileSync(x);
  const ext = path.extname(x).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/png';
  return { bytes, mime, name: path.basename(x) };
}

async function ensureKey() {
  if (process.env.ANTHROPIC_API_KEY) return;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('ANTHROPIC_API_KEY not set and no FIREBASE_SERVICE_ACCOUNT to hydrate it from');
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  await loadConfig();
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('config/anthropic has no key');
}

(async () => {
  const qty = opt('--qty') ? Number(opt('--qty')) : null;
  const product = opt('--product');
  const chat = opt('--chat') || branchChat();
  let quotes;
  if (opt('--from')) {
    quotes = JSON.parse(fs.readFileSync(opt('--from'), 'utf8'));
  } else {
    const srcs = [];
    if (opt('--album')) srcs.push(...await albumFiles(opt('--album')));
    for (const x of opts('--image')) srcs.push(imageSrc(x));
    if (opt('--text')) {
      fs.readFileSync(opt('--text'), 'utf8').split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean)
        .forEach((text, i) => srcs.push({ text, name: `text ${i + 1}` }));
    }
    if (!srcs.length) { console.error('nothing to read — give --album, --image or --text'); process.exit(2); }
    await ensureKey();
    console.error(`reading ${srcs.length} quote(s) with ${aq.MODEL}…`);
    // All at once — the calls run on Anthropic's box, nothing here to pace.
    quotes = await Promise.all(srcs.map(async (s) => {
      try { const q = await aq.extractQuote(s); console.error(`  ✓ ${s.name}: ${q.vendor || '(no vendor name)'} — ${q.tiers.length} tier(s)`); return q; }
      catch (e) { console.error(`  ✗ ${s.name}: ${e.message}`); return null; }
    }));
    quotes = quotes.filter(Boolean);
    if (!quotes.length) { console.error('nothing could be read'); process.exit(1); }
    if (opt('--out')) fs.writeFileSync(opt('--out'), JSON.stringify(quotes, null, 2));
  }
  const data = aq.buildDeck(quotes, { qty, product });
  const title = opt('--title') || aq.deckTitle(quotes, { qty, product });
  if (flag('--dry')) { console.log(JSON.stringify({ chat, title, template: 'deck', data }, null, 2)); return; }
  if (!chat) { console.error('no --chat and no branch to name one from'); process.exit(2); }
  const res = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat, title, template: 'deck', data }),
  });
  const j = await res.json();
  if (!res.ok || !j.ok) { console.error('post failed:', JSON.stringify(j)); process.exit(1); }
  console.log(JSON.stringify({ ok: true, id: j.id, sheet: j.sheet, items: j.items, warnings: j.warnings || [],
    url: `${BASE}/api/chatfeed/page/${j.id}`, chat: `${BASE}/chats?chat=${chat}` }, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
