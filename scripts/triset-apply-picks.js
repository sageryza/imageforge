#!/usr/bin/env node
/* Her pick rule, applied (2026-08-31, Sophie: "if i wrote this one, the
   other one got retired / otherwise no"). A note reading "this one" on a
   generation KEEPS that one and retires the OTHER generations of the same
   subject; a subject she did not pick is left completely alone.

   Retiring is `hidden` — nothing is deleted, so every call here is one flag
   from undone. Dry by default (the house rule for a sweep that writes).
     node scripts/triset-apply-picks.js          names them, writes nothing
     node scripts/triset-apply-picks.js --go     applies
   Env: FIREBASE_SERVICE_ACCOUNT. Costs nothing. */
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const GO = process.argv.includes('--go');

// HER PHRASE, NOT A GUESS AT HER MEANING. "this one of either" is her saying
// either is fine, which is the opposite of a pick, so it is excluded rather
// than matched loosely; a bare "this" is reported apart and never acted on,
// because her rule names the words "this one".
const isPick = (t) => /^this one\b/i.test(String(t || '').trim()) && !/of either/i.test(t);
const isNearPick = (t) => !isPick(t) && /^this\b/i.test(String(t || '').trim());

(async () => {
  const cards = {};
  (await db.collection('forge-triset-cards').get()).forEach((d) => {
    const c = d.data() || {};
    if (!c.url) return;
    const m = String(c.url).match(/cards\/([a-z0-9]+)-(.+)\.webp$/);
    // `url` MUST live on the record: without it the sibling comparison below
    // is undefined !== undefined, which is false, and the sweep silently
    // finds nothing to do (it did, and only reading the picks caught it).
    cards[c.url] = { id: d.id, ref: d.ref, url: c.url, title: c.title || '', hidden: !!c.hidden,
      quality: c.quality || '', slug: m ? m[2] : String(c.url) };
  });
  const bySlug = {};
  Object.values(cards).forEach((c) => { (bySlug[c.slug] = bySlug[c.slug] || []).push(c); });

  const picks = [], near = [];
  (await db.collection('forge-asset-votes').get()).forEach((d) => {
    const v = d.data() || {};
    const card = cards[v.url];
    if (!card) return;
    const mine = (v.thread || []).filter((m) => m && m.from === 'sophie').map((m) => m.text);
    if (v.note && !mine.length) mine.push(String(v.note));
    if (mine.some(isPick)) picks.push(card);
    else if (mine.some(isNearPick)) near.push(card);
  });

  // A PICK IS THE KEEPER, WHICHEVER WAY ROUND IT SITS. Five of her nine
  // picks are on a generation the medium redraw had already retired, with
  // its sibling live — the exact inverse of the state. So the pick is
  // brought BACK and the others go away; anything else would quietly
  // overrule the choice she just made.
  const toHide = [], toShow = [];
  const picked = {};
  picks.forEach((p) => { picked[p.slug] = p; });
  Object.keys(picked).forEach((slug) => {
    const keep = picked[slug];
    if (keep.hidden) toShow.push(keep);
    (bySlug[slug] || []).forEach((c) => {
      if (c.url !== keep.url && !c.hidden) toHide.push({ c, keep });
    });
  });

  console.log(`${picks.length} picked · ${Object.keys(picked).length} subjects · `
    + `${toHide.length} to retire · ${toShow.length} to bring back`);
  toShow.forEach((c) => console.log(`  bring back ${c.quality.padEnd(6)} ${c.title.slice(0, 52)}`));
  toHide.forEach(({ c, keep }) => console.log(`  retire ${c.quality.padEnd(6)} ${c.title.slice(0, 52)}`
    + `   (you kept the ${keep.quality})`));
  if (near.length) {
    console.log(`\n${near.length} said "this" but not "this one" — left alone, yours to confirm:`);
    near.forEach((c) => console.log('  · ' + c.title.slice(0, 60)));
  }
  const alreadyRight = Object.keys(picked).length - new Set(toHide.map(x => x.keep.slug)).size;
  if (alreadyRight > 0) console.log(`\n${alreadyRight} subjects already had the other one retired.`);
  if (!GO) { console.log('\n(dry — pass --go to write)'); process.exit(0); }

  const writes = toShow.map((c) => ({ ref: c.ref, hidden: false }))
    .concat(toHide.map(({ c }) => ({ ref: c.ref, hidden: true })));
  for (let i = 0; i < writes.length; i += 400) {
    const b = db.batch();
    writes.slice(i, i + 400).forEach((w) => b.set(w.ref, { hidden: w.hidden }, { merge: true }));
    await b.commit();
  }
  console.log(`\ndone — ${toHide.length} retired, ${toShow.length} brought back (hidden, never deleted)`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
