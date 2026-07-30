// Upload the master journal PDF to Firebase — NO keys needed.
//
//     node push-journal.mjs "~/Downloads/whatever it's called.pdf"
//
// The file goes straight from this Mac to Google's storage; the app server
// only hands out the upload session and records the result, so a gigabyte
// never has to squeeze through it.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PassThrough } from 'node:stream';

const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf('--' + n); return i < 0 ? d : (argv[i + 1] || true); };
const BASE = String(flag('base', process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com')).replace(/\/$/, '');

let file = argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--base');
if (!file) {
  // Nothing passed — look for the biggest PDF in Downloads, which is what a
  // 2,300-page scan will be.
  const dl = path.join(os.homedir(), 'Downloads');
  try {
    const pdfs = fs.readdirSync(dl).filter(f => /\.pdf$/i.test(f))
      .map(f => ({ f, p: path.join(dl, f), s: fs.statSync(path.join(dl, f)).size }))
      .sort((a, b) => b.s - a.s);
    if (pdfs.length) {
      file = pdfs[0].p;
      console.log(`No file given — using the largest PDF in Downloads:\n  ${pdfs[0].f}  (${(pdfs[0].s / 1e6).toFixed(0)}MB)\n`);
    }
  } catch { /* no Downloads folder */ }
}
if (!file) { console.error('Give me the PDF:  node push-journal.mjs "/path/to/journal.pdf"'); process.exit(1); }
file = file.replace(/^~/, os.homedir());
if (!fs.existsSync(file)) { console.error('❌ No file at: ' + file); process.exit(1); }

const name = path.basename(file);
const size = fs.statSync(file).size;
console.log(`Uploading: ${name}`);
console.log(`Size:      ${(size / 1e6).toFixed(0)} MB`);
console.log(`To:        ${BASE}\n`);

const ask = await fetch(`${BASE}/api/journal/upload-url`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, contentType: 'application/pdf' }),
});
if (!ask.ok) { console.error('❌ Could not start the upload: ' + ask.status + ' ' + (await ask.text()).slice(0, 300)); process.exit(1); }
const { uploadUrl, objectPath } = await ask.json();

// Stream it up, reporting progress — this takes a while at a gigabyte.
// The counting has to happen on a PassThrough the file is PIPED into: hanging
// a 'data' listener straight on the read stream and also handing that stream
// to fetch drains it out from under the request, and the upload dies on a
// content-length mismatch.
let sent = 0, lastPct = -1;
const stream = new PassThrough();
fs.createReadStream(file)
  .on('data', (c) => {
    sent += c.length;
    const pct = Math.floor(sent / size * 100);
    if (pct !== lastPct && pct % 5 === 0) { lastPct = pct; process.stdout.write(`  ${pct}%  (${(sent / 1e6).toFixed(0)}/${(size / 1e6).toFixed(0)} MB)\n`); }
  })
  .pipe(stream);

const put = await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(size) },
  body: stream,
  duplex: 'half',
});
if (!put.ok && put.status !== 200 && put.status !== 201) {
  console.error('\n❌ Upload failed: ' + put.status + ' ' + (await put.text()).slice(0, 300));
  process.exit(1);
}
console.log('\n✓ uploaded to ' + objectPath);

const reg = await fetch(`${BASE}/api/journal/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name }),
});
const out = await reg.json().catch(() => ({}));
if (!reg.ok || !out.ok) console.log('⚠️  Uploaded, but recording it failed: ' + (out.error || reg.status) + '\n   Tell Claude — the file is safely up.');
else console.log(`✅ Done. ${name} is in Firebase.\n\nTell Claude it finished.`);
