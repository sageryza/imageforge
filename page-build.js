'use strict';
// THE BUILD ID OF A SERVED PAGE — the content hash of exactly what serveGated
// sends: the page file, plus the shared autoscroll pill when the page carries
// one.
//
// DERIVED, NEVER A HAND-BUMPED CONST, and that is the whole reason this file
// exists. The Film Editor's self-heal keeps `var BUILD = 'fe-2026-08-23d'`
// inside its own html, so a chat that forgets to bump it ships a fix that can
// never reach her phone — the exact silent drift a self-heal exists to end. A
// hash cannot be forgotten.
//
// THE PILL IS FOLDED IN ON PURPOSE. It lives in a different file
// (public/pill-inject.html, generated from scripts/pill.py), and a pill change
// IS a page change from her side — the back-to-top arrow that started all this
// is a pill change and nothing else. Hashing the page alone would leave the
// self-heal blind to exactly the kind of edit it was built for.
//
// Cached per process: a file is fixed for the life of a deploy, so this hashes
// once and a deploy is what moves the answer.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUB = path.join(__dirname, 'public');
const PILL = 'pill-inject.html';
const cache = new Map();

function read(file) {
  try { return fs.readFileSync(path.join(PUB, file), 'utf8'); } catch (e) { return ''; }
}

/** The 12-char id for one gated page. `pill` = the page opts into the shared pill. */
function pageBuildId(file, pill) {
  const key = file + (pill ? '+pill' : '');
  if (!cache.has(key)) {
    cache.set(key, crypto.createHash('sha1')
      .update(read(file) + (pill ? read(PILL) : ''))
      .digest('hex').slice(0, 12));
  }
  return cache.get(key);
}

/** Drop the memo — for tests that edit a page file and ask again. */
function forget() { cache.clear(); }

module.exports = { pageBuildId, forget, PILL };
