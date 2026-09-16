#!/usr/bin/env node
/**
 * bank-story-data.js — back the gitignored story data up to membry Storage.
 *
 * docs/marla/ and docs/storybooks/ are gitignored on purpose: this repo is
 * public and Sophie's unpublished fiction is not ours to publish. The cost of
 * that is real — those files hold every rewritten scene and every character
 * brief, and a cloud container is ephemeral, so an un-banked edit dies with the
 * session. .gitignore has always SAID they are banked to Storage; nothing
 * actually did it. This does.
 *
 *   node scripts/bank-story-data.js            # upload anything that changed
 *   node scripts/bank-story-data.js --restore  # pull them back into a fresh box
 *   node scripts/bank-story-data.js --dry-run
 *
 * Objects are PRIVATE (never makePublic) and land at story-data/<path>.
 * Every upload also writes a timestamped copy under story-data/_history/, so a
 * bad overwrite is always recoverable.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

const ROOT = path.join(__dirname, '..');
const DIRS = ['docs/marla', 'docs/storybooks'];
const PREFIX = 'story-data/';
const DRY = process.argv.includes('--dry-run');
const RESTORE = process.argv.includes('--restore');

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.STORY_FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('No STORY_FIREBASE_SERVICE_ACCOUNT / FIREBASE_SERVICE_ACCOUNT.');
  const pid = JSON.parse(raw).project_id;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)), storageBucket: `${pid}.firebasestorage.app` });
}
const walk = (dir) => fs.existsSync(dir)
  ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])
  : [];
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');

(async () => {
  initAdmin();
  const bucket = admin.storage().bucket();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  if (RESTORE) {
    const [objs] = await bucket.getFiles({ prefix: PREFIX });
    let n = 0;
    for (const o of objs) {
      const rel = o.name.slice(PREFIX.length);
      if (!rel || rel.startsWith('_history/')) continue;
      const dest = path.join(ROOT, rel);
      console.log(`${DRY ? 'would restore' : 'restore'} ${rel}`);
      if (DRY) { n++; continue; }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, (await o.download())[0]);
      n++;
    }
    console.log(`${n} file(s)`);
    return;
  }

  let up = 0, same = 0;
  for (const dir of DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const rel = path.relative(ROOT, file);
      const buf = fs.readFileSync(file);
      const remote = bucket.file(PREFIX + rel);
      // skip an unchanged file: the object's own md5 costs one metadata read
      const [exists] = await remote.exists();
      if (exists) {
        const [meta] = await remote.getMetadata();
        if (meta.md5Hash && Buffer.from(meta.md5Hash, 'base64').toString('hex') === md5(buf)) { same++; continue; }
      }
      console.log(`${DRY ? 'would bank' : 'bank'} ${rel} (${buf.length} bytes)`);
      if (DRY) { up++; continue; }
      const tmp = path.join(os.tmpdir(), 'bank-' + path.basename(file));
      fs.writeFileSync(tmp, buf);
      await bucket.upload(tmp, { destination: PREFIX + rel, metadata: { contentType: 'application/json' } });
      await bucket.upload(tmp, { destination: `${PREFIX}_history/${stamp}/${rel}`, metadata: { contentType: 'application/json' } });
      fs.unlink(tmp, () => {});
      up++;
    }
  }
  console.log(`${up} banked, ${same} unchanged`);
})().catch((e) => { console.error(e.message); process.exit(1); });
