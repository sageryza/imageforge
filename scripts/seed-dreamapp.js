#!/usr/bin/env node
// Seed the dream app's feed with SAMPLE dreams so it can be looked at full.
//
//   node scripts/seed-dreamapp.js            # add the samples
//   node scripts/seed-dreamapp.js --draw     # …and illustrate the ones marked
//   node scripts/seed-dreamapp.js --clear    # remove every sample again
//   node scripts/seed-dreamapp.js --list     # show what's in the feed
//
// TWO sources, both real:
//   • `archive` — Sophie's own dreams, read live from /api/dream-archive (the
//     same text and the same illustrations that pipeline already drew).
//   • `journal` — entries from the shared Google Doc "Our dream journal",
//     transcribed below. These are her friends' dreams, and they are here
//     because she asked for them ("if you want to use real dreams, you can use
//     our dream journal document").
//
// ATTRIBUTION — how the friends' entries were told apart, since the doc has no
// bylines: an entry that mentions "Sage" in the third person cannot be hers,
// and the ones that do split into two voices by the pronoun they use for her —
// one says she/her, the other says they/them. The she/her voice also names Evan
// in the third person (so it isn't his), and the they/them voice names Maddie
// in the third person (so it isn't hers). That gives the two groups below. It
// is inference, not a byline: the two names may be swapped.
//
// Every doc carries `sample: true` and NOTHING else does, so --clear can never
// touch a real dream someone wrote in the app.
//
// Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory) in the environment. Talks to
// Firestore over REST, so it needs no node_modules.

const crypto = require('crypto');

const BASE_URL = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const ARCHIVE = `${BASE_URL}/api/dream-archive/data`;
const DRAW = `${BASE_URL}/api/dreamdraw`;
const COLLECTION = 'forge-dreamapp';
const COMMENTS = 'forge-dreamapp-comments';

// ── the friends' dreams, transcribed from the shared doc ────────────────────
const JOURNAL = {
  superbowl: {
    title: 'The Stadium in the Grass',
    text: `I dreamt I had just arrived in a large, grassy city with Sage to watch the Superbowl. We searched a map for the stadium and found it right near us - sure enough we glanced northward and there it was, recessed into the ground with the highest seats just below the level of the grass. As I stared I noticed the slope inward was very steep, and began sliding down. I caught myself but was stuck, not wanting to tumble into the stadium where I wouldn't be allowed, but unable to climb back up. I thought of reaching for Sage to help me up but didn't want to pull her down with me. Eventually I scooted my way back up with relief. Sage and I began searching online for a cheap hotel that was near the stadium. I got up to find some food and saw a popular-looking spot where a friendly man was serving up fries (two sizes, thin cut and wedge style) and collared greens. He also had a pair of scissors and would offer beard clips to passing customers, stylishly darting his shears up and down their faces with a grin, deftly snipping a section here and there to tidy up their look. I stared into a deep frier and watched the sizzling oil before waking.`,
  },
  nursery: {
    title: 'Prettier Girls, Better Artists',
    text: `For no reason I'm a ball of insecurity the whole dream. I'm at Sage's apartment but it's completely different. She has me help draw for a painting but I'm frustrated that my drawing isn't very good. At some point other girls are over to model & draw and they are prettier and better artists and probably cooler than me. Later Sage is gone and I'm with…. Kevin? Sean? We're at her apartment still and I show them the paintings and the prettier girls. Kevin-or-Sean relate to my insecurity and we walk to a nearby nursery with pretty fountains and statues, and reflect and relax.`,
  },
  elevator: {
    title: 'The Time-Traveling Elevator',
    text: `Sage and I keep ending up in a time-traveling elevator & it showed us scenes from their childhood with their mom, specifically one I remember is their mom talking to them as a three-year-old at another child's birthday party.

Also there was a groundskeeper character who looked like Danny Trejo from a previous dream who we visited, who lived in a cute farm house with a lot of earth-toned & handmade tchotchkes, and I was cat-sitting for him.`,
  },
  mathgames: {
    title: "My Mom's Secret Career",
    text: `I dreamt Sage & I didn't know each other as well as we do now as of March 2022 & they had heard my mom's name before because she had invented some math game that got popular

And it turned out she had this whole secret career inventing like educational flash/board games that were semi famous to like teachers and math students

Honestly sounds real`,
  },
  gastank: {
    title: 'The Man and the Gas Tank',
    text: `I dreamt a long grey hair dude was trying to gain full access to my car while I wasn't driving it & I wouldn't let him & he kept trying to pretend to lock the door so he could get in still we both got so mad about it we physically fought and then he went away but eventually i found he had peed into my gas tank and it melted from the pee & then he won't leave me alone he keeps fighting me & then tries to keep following me when I chase him into the house & Sage is there but had gone to bed since the 1st part of the dream & then we go to the back of the house to hide from windows and lock all the doors we can & then we hid under bed and I woke up`,
  },
};

// Who posts what, and on which day. `slot` orders a day (0 = latest).
// Two entries sharing a name AND a day are the pair that groups in the feed.
const CAST = [
  // today — three dreamers, and Sophie's two from the one night
  { archive: 'Bus Ride with Shayna',    name: 'sage',   day: 0, slot: 0, felt: 12 },
  { archive: "Ian's Barn Project",      name: 'sage',   day: 0, slot: 1, felt: 5 },
  { journal: 'elevator',                name: 'evan',   day: 0, slot: 2, felt: 14, draw: true },
  { journal: 'superbowl',               name: 'maddie', day: 0, slot: 3, felt: 9,  draw: true },
  // yesterday — Evan's two, plus one of hers
  { journal: 'mathgames',               name: 'evan',   day: 1, slot: 0, felt: 7 },
  { journal: 'gastank',                 name: 'evan',   day: 1, slot: 1, felt: 4 },
  { archive: 'Choosing a Kitten',       name: 'sage',   day: 1, slot: 2, felt: 17 },
  { journal: 'nursery',                 name: 'maddie', day: 1, slot: 3, felt: 11 },
  // further back
  { archive: 'PCH Hotel and Cousins',   name: 'sage',   day: 2, slot: 0, felt: 9 },
  { archive: 'Coins for Sandwiches',    name: 'moth',   day: 2, slot: 1, felt: 14 },
  { archive: "Claude's Tiny Spaceship", name: 'sage',   day: 3, slot: 0, felt: 8 },
  { archive: 'Restaurant Conversation', name: 'moth',   day: 3, slot: 1, felt: 6 },
  { archive: 'Sweet Lady Jane',         name: 'sage',   day: 4, slot: 0, felt: 11 },
  { archive: 'Killer Noodle Delivery',  name: 'moth',   day: 5, slot: 0, felt: 19 },
];

// A few threads so the comment button isn't empty everywhere. Keyed by the
// same title/slug the cast entry uses.
const TALK = [
  { on: 'Bus Ride with Shayna', from: 'maddie', text: 'the part where the bus keeps going is so you' },
  { on: 'Bus Ride with Shayna', from: 'evan',   text: 'did you ever actually get off it' },
  { on: 'elevator',             from: 'sage',   text: 'the groundskeeper is from YOUR dream, I remember you telling me' },
  { on: 'superbowl',            from: 'evan',   text: 'the beard clipping guy!!' },
  { on: 'gastank',              from: 'sage',   text: 'I was asleep for the whole second half of this apparently' },
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function samples(tok, collection) {
  const q = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: { fieldFilter: { field: { fieldPath: 'sample' }, op: 'EQUAL', value: { booleanValue: true } } },
    },
  };
  const r = await fetch(`${BASE}:runQuery`, {
    method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: JSON.stringify(q),
  });
  return (await r.json()).filter((row) => row.document).map((row) => row.document.name);
}

// The public dream illustrator draws a sample that has no art of its own.
// Background job + poll, same as the app: ~2c a page at low quality.
async function illustrate(text) {
  const start = await fetch(DRAW, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, quality: 'low' }),
  });
  const job = await start.json();
  if (!start.ok || !job.id) throw new Error(job.error || 'the drawing would not start');
  for (let i = 0; i < 120; i++) {
    await sleep(5000);
    const r = await fetch(`${DRAW}/${job.id}`);
    const d = await r.json();
    if (d.status === 'done') return d.pages || [];
    if (d.status === 'failed') throw new Error(d.error || 'the drawing failed');
  }
  throw new Error('the drawing timed out');
}

(async () => {
  const tok = await token();
  const arg = process.argv[2];
  const wantDraw = process.argv.includes('--draw');

  if (arg === '--clear') {
    let gone = 0;
    for (const collection of [COLLECTION, COMMENTS]) {
      for (const name of await samples(tok, collection)) {
        await fetch(`https://firestore.googleapis.com/v1/${name}`, {
          method: 'DELETE', headers: { authorization: `Bearer ${tok}` },
        });
        gone++;
      }
    }
    console.log(`removed ${gone} sample doc(s)`);
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
        (f.name?.stringValue || '?').padEnd(8),
        `${(f.panels?.arrayValue?.values || []).length}p`,
        `${f.commentCount?.integerValue || 0}c`,
        f.title?.stringValue || '(unnamed)',
      ].join(' '));
    }
    console.log(`${docs.length} dream(s) total`);
    return;
  }

  const existing = await samples(tok, COLLECTION);
  if (existing.length) {
    console.log(`${existing.length} sample dream(s) already there — run --clear first to reseed`);
    return;
  }

  console.log('reading the dream archive…');
  const archive = await (await fetch(ARCHIVE)).json();
  const byTitle = new Map();
  for (const d of archive.dreams || []) if (d.title && !byTitle.has(d.title)) byTitle.set(d.title, d);

  const idFor = (key) => 'sample-' + crypto.createHash('sha1').update(key).digest('hex').slice(0, 12);
  const madeIds = new Map(); // cast key -> dream id, so comments can find them

  let made = 0;
  for (const entry of CAST) {
    const key = entry.archive || entry.journal;
    let text; let title; let panels = [];

    if (entry.archive) {
      const src = byTitle.get(entry.archive);
      if (!src) { console.log(`  skipped "${entry.archive}" — not in the archive`); continue; }
      text = String(src.text || '').trim().slice(0, 4000);
      title = entry.archive;
      panels = (src.illustrations || []).map((url, i) => ({ i, url, captions: [], promptUsed: '', public: true }));
    } else {
      const src = JOURNAL[entry.journal];
      if (!src) { console.log(`  skipped "${entry.journal}" — no such journal entry`); continue; }
      text = src.text.trim();
      title = src.title;
      if (entry.draw && wantDraw) {
        try {
          console.log(`  drawing "${title}"…`);
          panels = (await illustrate(text)).map((p, i) => ({
            i, url: p.url, captions: p.captions || [], promptUsed: p.promptUsed || '', public: true,
          }));
        } catch (e) { console.log(`    no art (${e.message}) — it goes in as words`); }
      }
    }

    // The day is fixed on `publicOn`; `createdAt` only has to order the day.
    const dayBase = new Date(Date.now() - entry.day * 86400000);
    const when = new Date(dayBase.getTime() - entry.slot * 25 * 60000);
    const id = idFor(key);
    const doc = {
      id, uid: 'sample-' + entry.name, name: entry.name,
      text, title,
      createdAt: when.toISOString(),
      publicOn: pacificDay(dayBase),
      wordsPublic: true,
      panels,
      drawJob: null,
      drawnAt: panels.length ? when.toISOString() : null,
      feltCount: entry.felt,
      commentCount: TALK.filter((t) => t.on === key).length,
      sample: true,
    };
    const r = await fetch(`${BASE}/${COLLECTION}?documentId=${id}`, {
      method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
      body: JSON.stringify({ fields: fields(doc) }),
    });
    if (!r.ok) { console.log(`  FAILED "${title}": ${(await r.text()).slice(0, 160)}`); continue; }
    madeIds.set(key, id);
    console.log(`  ${entry.name.padEnd(8)} d${entry.day} ${String(panels.length).padStart(2)}p  ${title}`);
    made++;
  }

  let talked = 0;
  for (const [i, t] of TALK.entries()) {
    const dreamId = madeIds.get(t.on);
    if (!dreamId) continue;
    const id = idFor(`comment:${t.on}:${i}`);
    const comment = {
      id, dreamId, uid: 'sample-' + t.from, name: t.from, text: t.text,
      at: new Date(Date.now() - (TALK.length - i) * 47 * 60000).toISOString(),
      sample: true,
    };
    const r = await fetch(`${BASE}/${COMMENTS}?documentId=${id}`, {
      method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
      body: JSON.stringify({ fields: fields(comment) }),
    });
    if (r.ok) talked++;
  }

  console.log(`seeded ${made} sample dream(s) and ${talked} comment(s) — remove them with --clear`);
})().catch((e) => { console.error(e.message); process.exit(1); });
