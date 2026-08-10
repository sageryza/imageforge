#!/usr/bin/env node
/**
 * Put the hero images onto the on-site blog posts — as webp, with a focal point.
 *
 * THE BACKGROUND. 38 hero illustrations were generated for the blog in two
 * formats: a 1024x1024 SQUARE set and a 1536x1024 LANDSCAPE set, and the choice
 * between them was never finished, so every post on secretlyawitch.com/blog has
 * been running with no picture at all. The decision is now moot: a FOCAL POINT
 * (what Shopify calls it; plain CSS `object-position` underneath) lets one
 * square fill a wide slot without eating the subject, so the squares are used
 * everywhere and the landscape set is left as history.
 *
 * TWO RULES THIS OBEYS.
 *  1. Never serve a raw generated PNG to a page. The squares are ~1.5MB each —
 *     thirty of those on the blog index is ~45MB on a phone. Each is converted
 *     to webp (~40x smaller, no resize, nothing lost) and uploaded beside the
 *     original at blog-heroes/webp/<key>.webp with a one-year immutable cache
 *     header. The PNGs are never touched; they stay as the masters.
 *  2. The mapping is EXPLICIT, not fuzzy. Hero keys (b01..c18) and site slugs
 *     were named by different passes and two pairs are genuine ties that a
 *     similarity score gets wrong — "The Best Crystals for Beginners" (c04) vs
 *     "Crystals for Beginners Guide" (b05), and "Best Tarot Cards" on the site
 *     vs "Best Tarot Decks" (c05) in the hero set. So every pairing below was
 *     checked by hand once and written down, rather than re-derived on each run.
 *
 * FOCAL POINT. `siteFocal` is a CSS object-position string ("50% 35%" = keep
 * the point 35% down the image centred in the crop). Default is dead centre;
 * FOCAL below overrides the ones that need it. Squares crop badly by default in
 * a wide slot precisely because these illustrations put faces high in the frame
 * — that is the "tops of heads get eaten" problem the landscape set was made to
 * solve, and a lower Y percentage is the fix.
 *
 *   node scripts/assign-blog-heroes.js --dry-run
 *   node scripts/assign-blog-heroes.js
 *   node scripts/assign-blog-heroes.js --only c04,b12 --force
 *   node scripts/assign-blog-heroes.js --focal-only     # re-write focals, skip images
 *
 * Needs STORY_FIREBASE_SERVICE_ACCOUNT (membry — where the hero images live)
 * and FIREBASE_SERVICE_ACCOUNT (Deck Factory — where `forge-blog` lives).
 * Idempotent; re-running skips webp files that already exist unless --force.
 */
const admin = require('firebase-admin');
const sharp = require('sharp');

// hero key -> site slug. Checked by hand; see the header on why it is not fuzzy.
const MAP = {
  b09: 'how-to-make-a-spell-jar',
  b10: 'home-protection-magic-and-spells',
  b11: 'candle-magic-for-beginners',
  b12: 'how-to-start-a-book-of-shadows',
  b13: 'herbal-magic-for-beginners',
  b14: 'how-to-celebrate-samhain',
  b15: 'how-to-celebrate-yule-winter-solstice',
  b16: 'how-to-celebrate-ostara-spring-equinox',
  b17: 'how-to-cast-a-circle-for-beginners',
  b18: 'grounding-techniques-for-witches',
  b19: 'how-to-read-tea-leaves',
  b20: 'self-love-bath-ritual',
  c01: 'moon-water-recipes-for-rituals',
  c02: 'how-to-cleanse-crystals-under-moonlight',
  c03: 'how-to-cleanse-crystals-with-salt',
  c04: 'best-crystals-for-beginners',          // NOT b05 — see header
  c05: 'best-tarot-cards-for-beginners',       // hero set calls it "Decks"
  c06: 'simple-tarot-spreads-for-beginners',
  c07: 'candle-magic-color-meanings',
  c08: 'best-herbs-for-kitchen-witchcraft',
  c09: 'how-to-create-a-kitchen-altar',
  c10: 'new-moon-journal-prompts-for-intention',
  c11: 'best-crystals-for-home-protection',
  c12: 'book-of-shadows-page-ideas',
  c13: 'grounding-techniques-using-nature',
  c14: 'self-love-bath-salt-recipes',
  c15: 'simple-full-moon-rituals-for-beginners',
  c16: 'how-to-make-a-witch-simmer-pot',
  c17: 'herbs-for-protection-and-cleansing',
  c18: 'tea-leaf-reading-symbols-meaning',
};

// Per-hero focal point, set by looking at each image. Anything absent uses
// DEFAULT_FOCAL. Y is what matters: these are squares dropped into wide slots,
// so the crop keeps a horizontal band and Y chooses which one.
// Set by eye, one image at a time, checking the ACTUAL 16:9 crop each value
// produces. Two automated passes were tried and both failed in opposite
// directions, which is worth recording so nobody re-tries them: anchoring on
// the top of the subject cropped several posts down to a floating head with the
// crystals/cards/cauldron the illustration is ABOUT cut off, and anchoring on
// the ink centroid was dragged back to dead centre by the scattered herbs along
// the bottom edge — which is the head-eating crop this is meant to fix.
const DEFAULT_FOCAL = '50% 50%';
const FOCAL = {
  b09: '50% 50%',   // jars, no figure — centre is right
  b10: '50% 10%',   // tall door, arch at the top
  b11: '50% 25%',   // candle flames
  b12: '50% 40%',   // open book, low in frame
  b13: '50% 15%',   // hanging herbs above her
  b14: '50% 25%',   // photo frames
  b15: '50% 10%',
  b16: '50% 30%',
  b17: '50% 10%',   // standing figure, head high
  b18: '50% 10%',
  b19: '50% 20%',
  b20: '50% 30%',   // bath, her head upper right
  c01: '50% 15%',
  c02: '50% 10%',
  c03: '50% 15%',
  c04: '50% 20%',   // keep the crystal tray as well as her face
  c05: '50% 25%',   // keep the tarot spread on the table
  c06: '50% 15%',   // hands and cards, no face
  c07: '50% 20%',   // keep the candle row
  c08: '50% 10%',
  c09: '50% 30%',   // shelf above, cauldron below — no figure
  c10: '50% 10%',
  c11: '50% 20%',
  c12: '50% 20%',   // keep the pressed-flower book
  c13: '50% 15%',
  c14: '50% 20%',
  c15: '50% 20%',   // the moon over her raised hands is the picture
  c16: '50% 25%',   // keep the cauldron
  c17: '50% 20%',
  c18: '50% 20%',   // keep the teacup
};

const HERO_PREFIX = 'blog-heroes/';
const WEBP_PREFIX = 'blog-heroes/webp/';
const QUALITY = 84;
const CACHE = 'public, max-age=31536000, immutable';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const DRY = has('--dry-run'), FORCE = has('--force'), FOCAL_ONLY = has('--focal-only');
const ONLY = (val('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);

function apps() {
  const membryKey = process.env.STORY_FIREBASE_SERVICE_ACCOUNT;
  const dfKey = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!membryKey) throw new Error('STORY_FIREBASE_SERVICE_ACCOUNT is required (membry — the hero images)');
  if (!dfKey) throw new Error('FIREBASE_SERVICE_ACCOUNT is required (Deck Factory — forge-blog)');
  const membryCred = JSON.parse(membryKey);
  const membry = admin.initializeApp({
    credential: admin.credential.cert(membryCred),
    storageBucket: `${membryCred.project_id}.firebasestorage.app`,
  }, 'membry');
  const df = admin.initializeApp({ credential: admin.credential.cert(JSON.parse(dfKey)) }, 'deckfactory');
  return { bucket: membry.storage().bucket(), store: df.firestore() };
}

async function main() {
  const { bucket, store } = apps();

  const [files] = await bucket.getFiles({ prefix: HERO_PREFIX });
  // The square set is everything that is not the later `wide-` (landscape) roll
  // and not already a webp copy.
  const squares = new Map();
  for (const f of files) {
    const m = f.name.match(/^blog-heroes\/(?!webp\/)(?!wide-)\d+-([a-z]\d{2})\.png$/);
    if (m) squares.set(m[1], f);
  }
  const existing = new Set(files.filter((f) => f.name.startsWith(WEBP_PREFIX)).map((f) => f.name));

  const snap = await store.collection('forge-blog').where('site', '==', true).limit(200).get();
  const bySlug = new Map(snap.docs.map((d) => [d.data().siteSlug || d.data().slug || d.id, d]));

  const keys = Object.keys(MAP).filter((k) => !ONLY.length || ONLY.includes(k)).sort();
  let wrote = 0, converted = 0, missing = 0;

  for (const key of keys) {
    const slug = MAP[key];
    const doc = bySlug.get(slug);
    const src = squares.get(key);
    if (!doc) { console.log(` !  ${key}  no site post for "${slug}"`); missing++; continue; }
    if (!src && !FOCAL_ONLY) { console.log(` !  ${key}  no square image in Storage`); missing++; continue; }

    const dest = `${WEBP_PREFIX}${key}.webp`;
    const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    const focal = FOCAL[key] || DEFAULT_FOCAL;

    if (!FOCAL_ONLY && (FORCE || !existing.has(dest))) {
      if (DRY) {
        console.log(` →  ${key}  convert → ${dest}`);
      } else {
        const [buf] = await src.download();
        const out = await sharp(buf).webp({ quality: QUALITY }).toBuffer();
        await bucket.file(dest).save(out, {
          contentType: 'image/webp',
          metadata: { cacheControl: CACHE },
          resumable: false,
        });
        await bucket.file(dest).makePublic();
        const kb = (n) => Math.round(n / 1024);
        console.log(` ✓  ${key}  ${kb(buf.length)}KB png → ${kb(out.length)}KB webp`);
        converted++;
      }
    }

    if (DRY) {
      console.log(`    ${key} → ${slug}   focal ${focal}`);
    } else {
      await doc.ref.update({ siteImage: url, siteFocal: focal });
      wrote++;
    }
  }

  console.log(`\n${keys.length} heroes · ${converted} converted · ${wrote} posts updated · ${missing} problems`);
  if (DRY) console.log('(dry run — nothing written)');
  else console.log('The blog caches posts for 5 minutes; the app reads the same cache.');
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
