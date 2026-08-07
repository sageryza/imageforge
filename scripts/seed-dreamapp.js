#!/usr/bin/env node
// Seed the dream app's feed with SAMPLE dreams so it can be looked at full.
//
//   node scripts/seed-dreamapp.js            # add the samples
//   node scripts/seed-dreamapp.js --clear    # remove every sample again
//   node scripts/seed-dreamapp.js --list     # show what's in the feed
//
// The dreams are Sophie's REAL ones, read live from /api/dream-archive (the
// same text and the same illustrations that pipeline already drew), posted
// under assorted dreamer names so the feed reads as a group. Every doc carries
// `sample: true` and NOTHING else does, so --clear can never touch a real
// dream someone wrote in the app.
//
// Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory) in the environment. Talks to
// Firestore over REST, so it needs no node_modules.

const crypto = require('crypto');

const ARCHIVE = process.env.FORGE_BASE
  ? `${process.env.FORGE_BASE}/api/dream-archive/data`
  : 'https://imageforge-q125.onrender.com/api/dream-archive/data';
const COLLECTION = 'forge-dreamapp';

// Who each sample dream is posted as, and how many days back it sits. Titles
// are matched against the archive; a title that isn't found is skipped with a
// note rather than faked.
const CAST = [
  { title: 'Bus Ride with Shayna',     name: 'wren',      daysAgo: 0, felt: 12 },
  { title: 'Graduation and Miracles',  name: 'sage',      daysAgo: 0, felt: 21 },
  { title: "Ian's Barn Project",       name: 'felix',     daysAgo: 0, felt: 5 },
  { title: 'Choosing a Kitten',        name: 'juniper',   daysAgo: 1, felt: 17 },
  { title: 'PCH Hotel and Cousins',    name: 'clementine',daysAgo: 1, felt: 9 },
  { title: 'Coins for Sandwiches',     name: 'moth',      daysAgo: 2, felt: 14 },
  { title: "Claude's Tiny Spaceship",  name: 'sage',      daysAgo: 2, felt: 8 },
  { title: 'Restaurant Conversation',  name: 'marigold',  daysAgo: 3, felt: 6 },
  { title: 'Sweet Lady Jane',          name: 'wren',      daysAgo: 4, felt: 11 },
  { title: 'Killer Noodle Delivery',   name: 'felix',     daysAgo: 5, felt: 19 },
];

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || 'null');
if (!sa) { console.error('FIREBASE_SERVICE_ACCOUNT (Deck Factory) is required'); process.exit(1); }
const BASE = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
async function token() {
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  });
  const sig = crypto.createSign('RSA-SHA256').update(body).sign(sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + body + '.' + sig,
  });
  return (await r.json()).access_token;
}

// JS value -> Firestore REST typed value.
function val(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(val) } };
  if (typeof v === 'object') return { mapValue: { fields: fields(v) } };
  return { stringValue: String(v) };
}
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)]));

const pacificDay = (d) => d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

async function samples(tok) {
  const q = {
    structuredQuery: {
      from: [{ collectionId: COLLECTION }],
      where: { fieldFilter: { field: { fieldPath: 'sample' }, op: 'EQUAL', value: { booleanValue: true } } },
    },
  };
  const r = await fetch(`${BASE}:runQuery`, {
    method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: JSON.stringify(q),
  });
  return (await r.json()).filter((row) => row.document).map((row) => row.document.name);
}

(async () => {
  const tok = await token();
  const arg = process.argv[2];

  if (arg === '--clear') {
    const names = await samples(tok);
    for (const name of names) {
      await fetch(`https://firestore.googleapis.com/v1/${name}`, {
        method: 'DELETE', headers: { authorization: `Bearer ${tok}` },
      });
    }
    console.log(`removed ${names.length} sample dream(s)`);
    return;
  }

  if (arg === '--list') {
    const r = await fetch(`${BASE}/${COLLECTION}?pageSize=100`, { headers: { authorization: `Bearer ${tok}` } });
    const docs = (await r.json()).documents || [];
    for (const d of docs) {
      const f = d.fields || {};
      console.log([
        f.sample?.booleanValue ? 'sample' : 'real  ',
        (f.publicOn?.stringValue || 'private').padEnd(11),
        (f.name?.stringValue || '?').padEnd(11),
        `${(f.panels?.arrayValue?.values || []).length}p`,
        f.title?.stringValue || '(unnamed)',
      ].join(' '));
    }
    console.log(`${docs.length} dream(s) total`);
    return;
  }

  const existing = await samples(tok);
  if (existing.length) {
    console.log(`${existing.length} sample dream(s) already there — run --clear first to reseed`);
    return;
  }

  console.log('reading the dream archive…');
  const archive = await (await fetch(ARCHIVE)).json();
  const byTitle = new Map();
  for (const d of archive.dreams || []) if (d.title && !byTitle.has(d.title)) byTitle.set(d.title, d);

  let made = 0;
  for (const entry of CAST) {
    const src = byTitle.get(entry.title);
    if (!src) { console.log(`  skipped "${entry.title}" — not in the archive`); continue; }
    const when = new Date(Date.now() - entry.daysAgo * 86400000 - Math.random() * 6 * 3600000);
    const panels = (src.illustrations || []).map((url, i) => ({
      i, url, captions: [], promptUsed: '', public: true,
    }));
    const id = 'sample-' + crypto.createHash('sha1').update(entry.title).digest('hex').slice(0, 12);
    const doc = {
      id, uid: 'sample-' + entry.name, name: entry.name,
      text: String(src.text || '').trim().slice(0, 4000),
      title: entry.title,
      createdAt: when.toISOString(),
      publicOn: pacificDay(when),
      wordsPublic: true,
      panels,
      drawJob: null,
      drawnAt: panels.length ? when.toISOString() : null,
      feltCount: entry.felt,
      sample: true,
    };
    const r = await fetch(`${BASE}/${COLLECTION}?documentId=${id}`, {
      method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
      body: JSON.stringify({ fields: fields(doc) }),
    });
    if (!r.ok) { console.log(`  FAILED "${entry.title}": ${(await r.text()).slice(0, 160)}`); continue; }
    console.log(`  ${entry.name.padEnd(11)} ${String(panels.length).padStart(2)}p  ${entry.title}`);
    made++;
  }
  console.log(`seeded ${made} sample dream(s) — remove them with --clear`);
})().catch((e) => { console.error(e.message); process.exit(1); });
