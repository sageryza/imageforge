#!/usr/bin/env node
/**
 * File a Darius film's art into the chat's Assets tab: upload, label, caption
 * and — for every single picture — the EXACT prompt that made it.
 *
 *   node scripts/darius-file-art.js <heart|proof> [--dry-run]
 *
 * Reads the renderer's own prompts.json out of each output directory, so the
 * style half filed here is the literal text sent to gpt-image-2, never a
 * reconstruction (CLAUDE.md: never paraphrase a prompt, and file nothing rather
 * than guess). The renderer joins its prompt as
 *   <style sentence>\n\n[<likeness sentence>\n\n]Draw: <scene>
 * so the seam is exact: everything before "Draw: " is the style half plus the
 * attached references, and the scene is the content half.
 *
 * Needs FIREBASE_SERVICE_ACCOUNT (deckfactory) for the upload.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'darius-interview-videos';
const SET = process.argv.find((a) => a === 'heart' || a === 'proof') || 'heart';
const DIRS = {
  heart: ['/home/user/out/darius-heart-medium', '/home/user/out/darius-heart-medium-2'],
  proof: ['/home/user/out/darius-proof-medium'],
}[SET];
const DRY = process.argv.includes('--dry-run');
const LABELS = require(`./nde-watercolor/darius-${SET}-labels.json`);

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  storageBucket: 'deckfactory-43176.firebasestorage.app',
});
const bucket = admin.storage().bucket();

/* Split the renderer's prompt at its own seam. The style half keeps the style
   sentence and the likeness sentence exactly as sent, and names the attachments
   after it — which is what the PROMPT overlay's style side is for. */
function split(rec) {
  const i = rec.prompt.indexOf('Draw: ');
  if (i < 0) throw new Error('no "Draw: " seam in ' + rec.id);
  const style = rec.prompt.slice(0, i).trim();
  const content = rec.prompt.slice(i + 6).trim();
  const refs = (rec.refs || []).map((r) => path.basename(String(r).split('?')[0]));
  const tail = `\n\nAttached, in order: ${refs.join(', ')}. gpt-image-2 edits · ${rec.size} · quality ${rec.quality}.`;
  return { style: style + '\n\n[content]' + tail, content };
}

(async () => {
  const recs = [];
  for (const dir of DIRS) {
    const f = path.join(dir, 'prompts.json');
    if (!fs.existsSync(f)) { console.log('no prompts.json in', dir); continue; }
    for (const r of JSON.parse(fs.readFileSync(f, 'utf8'))) if (r.file) recs.push(r);
  }
  console.log(recs.length, 'pictures');

  const items = [];
  for (const r of recs) {
    const key = r.id.replace(/-m$/, '');
    const label = LABELS[key];
    if (!label) { console.log('  NO LABEL', r.id, '— skipped, an unlabelled tile is worse than none'); continue; }
    const dest = `darius-${SET}/${r.id}.webp`;
    const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    if (DRY) { console.log('  would file', r.id, '·', label); items.push({ url, ...split(r) }); continue; }

    await bucket.upload(r.file, { destination: dest, metadata: { contentType: 'image/webp', cacheControl: 'public,max-age=31536000,immutable' } });
    await bucket.file(dest).makePublic();

    const g = await fetch(BASE + '/api/gallery', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assetsOnly: true, chat: CHAT, url, description: label, prompt: `gpt-image-2 · ${r.quality}` }),
    }).then((x) => x.json());
    console.log(' ', g.ok ? 'filed' : 'FAILED', r.id, '·', label.slice(0, 56));
    items.push({ url, ...split(r) });
  }

  if (DRY) return console.log('\ndry run — nothing written');
  // One call carries every split; the route answers ok/error per item.
  const p = await fetch(BASE + '/api/gallery/assets/prompt', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, items }),
  }).then((x) => x.json());
  const bad = (p.results || []).filter((x) => !x.ok);
  console.log(`\nprompts filed for ${items.length - bad.length}/${items.length}`);
  bad.forEach((x) => console.log('  ', x.error));
})().catch((e) => { console.error(e.message); process.exit(1); });
