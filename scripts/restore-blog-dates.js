#!/usr/bin/env node
/**
 * Restore the on-site blog's BACKDATES from the Shopify articles they came from.
 *
 * WHY THIS EXISTS. The 38 blog posts were deliberately backdated on the Shopify
 * blog — roughly one every ten days from April 2025 to May 2026 — so the blog
 * reads as one that has been running steadily for two years instead of one that
 * appeared in an afternoon. When the apex domain moved off the Shopify
 * storefront and onto the witch app, the posts were re-published to the on-site
 * blog (`forge-blog` docs, rendered by blog-public.js) and `publish-site` stamps
 * `sitePublishedAt` with `serverTimestamp()`. Nothing carried the original date
 * across, so all 30 site posts ended up published within the same five seconds
 * of 2026-07-25 — the backdating was silently undone, and "the newest post" on
 * the app's Home screen became meaningless.
 *
 * The originals are still on Shopify (`published_at` per article), so this reads
 * them back and writes them onto the matching site docs.
 *
 * MATCHING is by Shopify handle first, then by title similarity for the posts
 * whose slug drifted between the two systems (`best-tarot-cards-for-beginners`
 * on the site is `best-tarot-decks-for-beginners` on Shopify, and six others
 * like it). A fuzzy match under MIN_SCORE is reported and skipped rather than
 * guessed — a wrong date is worse than a missing one, so those get fixed by
 * hand. --dry-run prints every pairing and writes nothing; run it first.
 *
 *   node scripts/restore-blog-dates.js --dry-run
 *   node scripts/restore-blog-dates.js
 *
 * Needs FIREBASE_SERVICE_ACCOUNT (Deck Factory — `forge-blog` and the stored
 * Shopify OAuth token both live there). Idempotent: re-running rewrites the
 * same dates.
 */
const admin = require('firebase-admin');

const BLOG_ID = process.env.SHOPIFY_BLOG_ID || '51506020432';   // "Secretly A Witch"
const STORE = process.env.SHOPIFY_STORE || 'cod-god-inc.myshopify.com';
const API = process.env.SHOPIFY_API_VERSION || '2025-01';
const MIN_SCORE = 0.5;
const DRY = process.argv.includes('--dry-run');

// Slug/title similarity that ignores the filler words these titles are made of,
// so "How to Cleanse Your Crystals Under the Full Moon" still recognises
// "How to Cleanse Crystals Under Moonlight" without matching everything else.
const STOP = /\b(a|an|the|your|guide|to|for|of|and|with|simple|beginners?|how|ideas|complete|friendly|personal)\b/g;
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(STOP, ' ').replace(/\s+/g, ' ').trim();
function score(a, b) {
  const A = new Set(norm(a).split(' ').filter(Boolean));
  const B = new Set(norm(b).split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  A.forEach((w) => { if (B.has(w)) hit++; });
  return hit / Math.max(A.size, B.size);
}

async function main() {
  if (!admin.apps.length) {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT is required (Deck Factory)');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(key)) });
  }
  const store = admin.firestore();

  const tok = await store.doc(process.env.SHOPIFY_TOKENS_DOC || 'config/shopify-tokens').get();
  const access = tok.exists && (tok.data().access_token || tok.data().token);
  if (!access) throw new Error('No Shopify token at config/shopify-tokens — reconnect at /api/shopify/connect');

  const url = `https://${STORE}/admin/api/${API}/blogs/${BLOG_ID}/articles.json?limit=250&fields=id,title,handle,published_at`;
  const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': access } });
  if (!res.ok) throw new Error(`Shopify ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const articles = (await res.json()).articles.filter((a) => a.published_at);
  console.log(`Shopify: ${articles.length} published articles on blog ${BLOG_ID}`);

  const snap = await store.collection('forge-blog').where('site', '==', true).limit(200).get();
  console.log(`Site: ${snap.size} posts\n`);

  const writes = [];
  const skipped = [];
  for (const doc of snap.docs) {
    const v = doc.data();
    const slug = v.siteSlug || v.slug || doc.id;
    let art = articles.find((a) => a.handle === slug);
    let how = 'handle';
    if (!art) {
      let best = null, bestScore = 0;
      for (const a of articles) {
        const s = Math.max(score(a.title, v.title), score(a.handle, slug));
        if (s > bestScore) { bestScore = s; best = a; }
      }
      if (best && bestScore >= MIN_SCORE) { art = best; how = `title ${bestScore.toFixed(2)}`; }
      else { skipped.push({ slug, best: best && best.handle, score: bestScore }); continue; }
    }
    const when = new Date(art.published_at);
    const had = v.sitePublishedAt && v.sitePublishedAt.toDate ? v.sitePublishedAt.toDate() : null;
    const same = had && Math.abs(had.getTime() - when.getTime()) < 1000;
    writes.push({ ref: doc.ref, slug, when, how, from: art.handle, same });
  }

  writes.sort((a, b) => a.when - b.when);
  for (const w of writes) {
    const note = w.how === 'handle' ? '' : `  ← ${w.from} (${w.how})`;
    console.log(`${w.same ? ' =' : DRY ? ' →' : ' ✓'} ${w.when.toISOString().slice(0, 10)}  ${w.slug}${note}`);
  }
  for (const s of skipped) {
    console.log(` !  NO MATCH  ${s.slug}   (closest: ${s.best || '—'} @ ${s.score.toFixed(2)})`);
  }

  const todo = writes.filter((w) => !w.same);
  console.log(`\n${writes.length} matched, ${todo.length} to update, ${skipped.length} unmatched`);
  if (DRY) { console.log('(dry run — nothing written)'); return; }
  if (!todo.length) { console.log('Nothing to do.'); return; }

  // sitePublishedAt only. siteUpdatedAt is left alone: it records when the
  // CONTENT last changed, and restoring a date is not a content edit.
  let batch = store.batch(), n = 0;
  for (const w of todo) {
    batch.update(w.ref, { sitePublishedAt: admin.firestore.Timestamp.fromDate(w.when) });
    if (++n % 400 === 0) { await batch.commit(); batch = store.batch(); }
  }
  await batch.commit();
  console.log(`Wrote ${todo.length} dates. The blog caches posts for 5 minutes — /api/blog/publish-site busts it, or just wait.`);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
