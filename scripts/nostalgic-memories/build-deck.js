#!/usr/bin/env node
// Nostalgic memory prompts -> a stock DECK page in the Chats app's Compare tab
// (Aug 2026, Sophie: "make these a tinder compare page i can swipe").
//
// Her list, verbatim, one prompt per card. The DATA is posted — never HTML —
// so the page rides the shared stock renderer (page-templates.js + judge.js)
// and picks up every fix to her deck chrome without being re-posted.
//
// Shape per card, and why:
//   label = the SECTION ("General" / "Specific"). On a stock deck the label is
//           HOISTED into the page's top chrome under Piles, in her rust caps —
//           which is exactly what it is: a category label over the moment.
//   text  = the phrase itself, verbatim, in the 21px Newsreader box that IS
//           her Decision Deck card. Her caps are kept; they are the list.
//
// THE IDS ARE SLUGGED FROM THE PHRASE, never from the index — a v2 rebuilt
// from an edited list keeps her verdicts pointed at the same card (the
// blocks-s96 lesson). Re-run and re-post as a NEW page for a new version;
// supersede the old one, never edit it.
//
//   node scripts/nostalgic-memories/build-deck.js            # print the body
//   node scripts/nostalgic-memories/build-deck.js --post     # post it
//
// Env: FORGE_CHAT (default nostalgic-memories-swipe), FORGE_SESSION,
//      FORGE_BASE (default the live app), FORGE_TITLE.

const fs = require('fs');
const path = require('path');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'nostalgic-memories-swipe';
const SESSION = process.env.FORGE_SESSION || '';
const TITLE = process.env.FORGE_TITLE || 'Nostalgic memories — swipe (v1, 67 prompts)';
const SECTIONS = new Set(['GENERAL', 'SPECIFIC']);

function buildItems(text) {
  const taken = new Set();
  const items = [];
  let section = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (SECTIONS.has(line)) { section = line[0] + line.slice(1).toLowerCase(); continue; }
    let base = line.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 48) || 'card';
    let id = base; let n = 2;
    while (taken.has(id)) { id = `${base}-${n}`; n += 1; }
    taken.add(id);
    items.push({ id, label: section, text: line });
  }
  return items;
}

async function main() {
  const src = fs.readFileSync(path.join(__dirname, 'memories.txt'), 'utf8');
  const items = buildItems(src);
  const body = {
    chat: CHAT,
    ...(SESSION ? { session: SESSION } : {}),
    title: TITLE,
    template: 'deck',
    // voice:true puts the tap-to-record mic on every card — these are memory
    // prompts, so what she has to say about one is the point of the card.
    data: { items, voice: true },
  };
  const counts = items.reduce((a, i) => ({ ...a, [i.label]: (a[i.label] || 0) + 1 }), {});
  console.error(`${items.length} cards`, counts);
  if (!process.argv.includes('--post')) { console.log(JSON.stringify(body, null, 2)); return; }
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  console.log(await r.text());
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { buildItems };
