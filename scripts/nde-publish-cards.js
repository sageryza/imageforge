#!/usr/bin/env node
/**
 * Publish the nine settled NDE character cards to a stable, discoverable place.
 *
 *   node scripts/nde-publish-cards.js [--dry-run]
 *
 * Copies each chosen card to Storage `nde-refs/cards/<surname>.webp` — deliberately
 * beside `nde-refs/people/<surname>.jpg`, the photo it was drawn from, so the pairing
 * is obvious to anyone browsing — and writes `nde-refs/cards/manifest.json` carrying
 * every card's full name, both URLs, and the EXACT prompt that made it.
 *
 * The manifest is also committed to the repo at docs/nde-character-cards.json.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const BUCKET = 'deckfactory-43176.firebasestorage.app';
const SRC = 'nde-watercolor/cards';       // where this chat rendered them
const DEST = 'nde-refs/cards';            // where everyone should look
const DRY = process.argv.includes('--dry-run');

// The chosen card per person: the v6 set, all rendered on one identical recipe.
const PEOPLE = [
  ['hugenot', 'Dr. Alan Hugenot', 'hugenot.jpg', true],
  ['wittbrodt', 'Penny Wittbrodt', 'wittbrodt.jpg', false],
  ['wright', 'Darius J. Wright', 'wright.jpg', false],
  ['barker', 'Tricia Barker', 'barker.png', false],
  ['hensley', 'Dr. Mary Helen Hensley', 'hensley.jpg', false],
  ['rynes', 'Nancy Rynes', 'rynes.jpg', false],
  ['dennis', 'Landon Dennis', 'dennis.png', false],
  ['nair', 'Malcolm Nair', 'nair.jpg', false],
  ['anthony', 'Peter Anthony', 'anthony.jpg', false],
];

const STYLE = 'Use the FIRST attached image as a style reference. Only use its style, not its '
  + 'content — do not copy anything depicted in it. You do not have to copy its colors.';
const LIKENESS = 'The SECOND attached image is a photograph of the person to draw.';
const SCENE = 'a head-and-shoulders portrait of that person, facing the viewer, on a white '
  + 'background. No text or lettering anywhere.';
const SCENE_HUGENOT = 'a head-and-shoulders portrait of that person drawn as he was at '
  + 'seventeen, a teenage boy, facing the viewer, on a white background. No text or lettering '
  + 'anywhere.';

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  storageBucket: BUCKET,
});

const url = (p) => `https://storage.googleapis.com/${BUCKET}/${p}`;

(async () => {
  const bucket = admin.storage().bucket();
  const cards = [];

  for (const [key, name, photo, teen] of PEOPLE) {
    const from = `${SRC}/card-${key}-v6.webp`;
    const to = `${DEST}/${key}.webp`;
    if (!DRY) {
      await bucket.file(from).copy(bucket.file(to));
      await bucket.file(to).setMetadata({
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000, immutable',
      });
      await bucket.file(to).makePublic();
    }
    cards.push({
      key, name, card: url(to), photo: url(`nde-refs/people/${photo}`),
      note: teen ? 'Photo is him at ~80; his story is from age 17, so the card is drawn young.'
                 : undefined,
      promptSent: `${STYLE}\n\n${LIKENESS}\n\nDraw: ${teen ? SCENE_HUGENOT : SCENE}`,
    });
    console.log(`  ${name} → ${url(to)}`);
  }

  const manifest = {
    what: 'Watercolour character cards for the nine Anthony Chene NDE experiencers.',
    howToUse: 'Attach refs/sage-sandy-mirror.png FIRST as the style reference, then this '
      + "person's card as the character reference, then draw the scene. Restate nothing about "
      + 'the face — a preserve-list over-weights it. See docs/nde-watercolor.md.',
    recipe: {
      model: 'gpt-image-2', endpoint: 'images/edits',
      styleRef: 'refs/sage-sandy-mirror.png', quality: 'medium', size: '1024x1536',
      noStyleDescription: 'Never write one. Every style block tested made it worse.',
    },
    builtAt: new Date().toISOString(),
    cards,
  };

  const local = path.join(__dirname, '..', 'docs', 'nde-character-cards.json');
  fs.writeFileSync(local, JSON.stringify(manifest, null, 1) + '\n');
  console.log(`\nmanifest → ${local}`);

  if (!DRY) {
    const mf = bucket.file(`${DEST}/manifest.json`);
    await mf.save(JSON.stringify(manifest, null, 1), {
      contentType: 'application/json',
      metadata: { cacheControl: 'public, max-age=300' },
    });
    await mf.makePublic();
    console.log(`manifest → ${url(`${DEST}/manifest.json`)}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
