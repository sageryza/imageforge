#!/usr/bin/env node
/* CONTINUITY STILLS — screenshot a room the model invented, or a prop that comes
   back, out of a clip that has already been drawn.

   2026-09-11, Sophie: "we need to take screenshots of any rooms it invents or
   objects that repeat."

   Ten scenes drawn as ten separate clips means the model invents the apartment
   ten times over unless something carries it between them. The reference VIDEOS
   carry the two men; nothing carries the rooms. So: pull the frame, put it in
   the Dump, name it, and the belt rides it as a reference IMAGE on every later
   card that needs it.

   IT COSTS NOTHING — one download, one ffmpeg frame, one upload, all on our own
   box. No model call.

   NOTHING STANDS BETWEEN THE SOURCE AND THE OUTPUT: the frame is pulled at the
   clip's own resolution and never scaled, and the clip is never touched.

     node scripts/sean-jonathan/grab-still.js --list
     node scripts/sean-jonathan/grab-still.js --key kitchen --card sj-d --at 6.5
     node scripts/sean-jonathan/grab-still.js --key kitchen --card sj-d --at 6.5 --go
     node scripts/sean-jonathan/grab-still.js --key kitchen --url <mp4> --at 6.5 --go

   Dry by default: it pulls the frame, writes it to /tmp and prints the path so
   the frame can be LOOKED AT before it is uploaded and starts steering clips.
   `--go` uploads it and records it in docs/sean-jonathan/continuity.json. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const DOCS = path.join(ROOT, 'docs', 'sean-jonathan');
const CONT = path.join(DOCS, 'continuity.json');
const SHOT = path.join(DOCS, 'shot.json');
const BASE = 'https://imageforge-q125.onrender.com';
const FF = path.join(ROOT, 'node_modules', 'ffmpeg-static', 'ffmpeg');

const arg = (n, d) => {
  const i = process.argv.indexOf('--' + n);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : d;
};
const flag = (n) => process.argv.includes('--' + n);

const cont = () => JSON.parse(fs.readFileSync(CONT, 'utf8'));

// The clip a card was drawn into: shot.json for the two she drew before the
// belt existed, else the job log, which every /footage job files itself into.
async function clipFor(card) {
  const c = cont();
  const entry = (c.things || []).find((t) => t.establishedOn === card);
  const shot = JSON.parse(fs.readFileSync(SHOT, 'utf8')).shot;
  const byCard = { 'sj-a': shot[0], 'sj-b': shot[1] };
  if (byCard[card] && byCard[card].video) return byCard[card].video;
  const r = await fetch(BASE + '/api/footage/jobs?limit=60');
  const jobs = (await r.json()).jobs || [];
  const want = (entry && entry.jobId) || null;
  const j = jobs.find((x) => x.id === want) || jobs.find((x) => (x.title || '').includes(card));
  if (!j || !j.video) throw new Error('no drawn clip found for ' + card
    + ' — draw it first, or pass --url');
  return j.video;
}

(async () => {
  if (flag('list')) {
    const c = cont();
    for (const t of c.things) {
      console.log([
        t.still ? '✓' : '·',
        t.key.padEnd(11),
        t.name.padEnd(24),
        'from ' + t.establishedOn,
        '→ ' + ((t.neededBy || []).join(' ') || 'nothing — a record, never a reference'),
        t.still ? '' : '  (no still yet)',
      ].join('  '));
    }
    return;
  }

  const key = arg('key');
  if (!key) throw new Error('--key <name from --list>');
  const c = cont();
  const thing = c.things.find((t) => t.key === key);
  if (!thing) throw new Error('unknown key ' + key + ' — add it to continuity.json first');
  const at = Number(arg('at', thing.at || 0));
  const url = arg('url') || await clipFor(arg('card', thing.establishedOn));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sjstill-'));
  const clip = path.join(tmp, 'clip.mp4');
  const out = path.join(tmp, key + '.jpg');
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.writeFileSync(clip, buf);
  // the clip's OWN resolution, never scaled
  execFileSync(FF, ['-v', 'error', '-ss', String(at), '-i', clip,
    '-frames:v', '1', '-q:v', '2', out, '-y']);
  console.log('frame at ' + at + 's of ' + path.basename(url) + ' → ' + out
    + ' (' + Math.round(fs.statSync(out).size / 1024) + ' KB)');

  if (!flag('go')) {
    console.log('\nDRY — look at it, then re-run with --go to upload and file it.');
    return;
  }

  const q = new URLSearchParams({
    session: c.dumpSession || 'sean-jonathan-continuity',
    bundle: c.dumpBundle || 'Sean & Jonathan — continuity',
    filename: key + '.jpg',
  });
  const up = await fetch(BASE + '/api/drop/upload-file?' + q, {
    method: 'POST',
    headers: { 'content-type': 'image/jpeg' },
    body: fs.readFileSync(out),
  });
  const j = await up.json();
  // the Dump answers { ok, item:{ url, thumb, … } }; a re-upload of the same
  // bytes answers `duplicate:true` with the item it already had, which is why
  // re-running this is free and idempotent
  const item = (j && j.item) || {};
  const got = item.url || j.url;
  if (!got) throw new Error('upload failed: ' + JSON.stringify(j).slice(0, 300));
  thing.still = got;
  if (item.thumb) thing.thumb = item.thumb;
  thing.dumpId = item.id || '';
  thing.at = at;
  thing.from = url;
  thing.grabbedAt = new Date().toISOString();
  fs.writeFileSync(CONT, JSON.stringify(c, null, 1) + '\n');
  console.log('filed  ' + key + '  →  ' + got);
  console.log('\nnow rebuild the belt:  python3 scripts/sean-jonathan/belt.py --post --supersede <id>');
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
