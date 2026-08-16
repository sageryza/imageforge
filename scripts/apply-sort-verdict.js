#!/usr/bin/env node
// apply-sort-verdict.js — file the chats Sophie ticked on the proposal page.
//
// The review page (gen-sort-proposal-page.js) writes her answer per chat into
// the chat's verdict doc: a folder name, or `none` for leave it unfiled. This
// reads those back and makes them real. It is the other half of the page —
// without it her ticks are a list nobody acts on.
//
//   node scripts/apply-sort-verdict.js --sheet sort-dryrun-86            # dry
//   node scripts/apply-sort-verdict.js --sheet sort-dryrun-86 --write
//
// EVERYTHING IT WRITES IS HERS. A folder goes through POST /category, which
// stamps `catBy: 'sophie'` — so the sorter never revisits it, and the chat
// becomes one of the EXAMPLES that teaches the folder to future runs. That is
// how "5 of these witch ones are really dream app" turns into a dream app
// folder the sorter can use, without anyone writing a description of it.
//
// A ROW SHE NEVER TOUCHED IS LEFT ALONE, deliberately: the page is long and she
// will not finish it in one sitting, so silence means "not yet", never "no".
// Re-running after another pass over the page picks up only what is new.

const fetch = globalThis.fetch || require('node-fetch');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'auto-sort-chats-category';
const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const WRITE = args.includes('--write');
const SHEET = val('--sheet', '');
if (!SHEET) { console.error('usage: apply-sort-verdict.js --sheet <sheet> [--write]'); process.exit(1); }

async function api(path, opts) {
  const res = await fetch(BASE + path, {
    ...opts, headers: { 'content-type': 'application/json', ...(opts && opts.headers) },
  });
  const data = await res.json();
  if (data.error) throw new Error(`${path}: ${data.error}`);
  return data;
}

(async () => {
  const v = await api(`/api/chatfeed/verdict?chat=${encodeURIComponent(CHAT)}&sheet=${encodeURIComponent(SHEET)}`);
  const items = (v && v.items) || {};
  const answered = Object.keys(items).filter((k) => typeof items[k] === 'string' && items[k]);
  if (!answered.length) { console.log('nothing ticked yet on ' + SHEET); return; }

  // One call per folder rather than one per chat: POST /category takes a whole
  // selection, which is what it was built for.
  const byFolder = {};
  const unfiled = [];
  answered.forEach((chat) => {
    const f = items[chat];
    if (f === 'none') unfiled.push(chat);
    else (byFolder[f] = byFolder[f] || []).push(chat);
  });

  Object.keys(byFolder).sort().forEach((f) => console.log(`${f} (${byFolder[f].length}): ${byFolder[f].join(', ')}`));
  if (unfiled.length) console.log(`leave unfiled (${unfiled.length}): ${unfiled.join(', ')}`);
  console.log(`\n${answered.length} answered of the whole sheet`
    + (WRITE ? ' — WRITING' : ' — dry run, nothing written'));
  if (!WRITE) { console.log('\nre-run with --write to file them'); return; }

  for (const f of Object.keys(byFolder)) {
    const out = await api('/api/chatfeed/category', {
      method: 'POST', body: JSON.stringify({ chats: byFolder[f], category: f }),
    });
    console.log(`filed ${out.chats.length} into ${f}`);
  }
  if (unfiled.length) {
    // "Leave unfiled" needs its own mark: an empty `category` is indistinguishable
    // from a chat nobody has looked at, so without this the sorter would file it
    // tomorrow anyway (chat-sort.js, `catNone`).
    const out = await api('/api/chatfeed/sort/none', {
      method: 'POST', body: JSON.stringify({ chats: unfiled }),
    });
    console.log(`marked ${out.chats.length} to stay unfiled`);
  }
})().catch((err) => { console.error(String(err.message || err)); process.exit(1); });
