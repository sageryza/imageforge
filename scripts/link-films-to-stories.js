#!/usr/bin/env node
// Backfill: link existing films (forge-movies, Deck Factory) to their story
// (forge-story, membry) by writing `storyId` onto the movie doc — the field
// new movies now carry from creation. Films were made from a COPY of the
// story text, never a reference, so the match is best-guess: exact
// normalized-title match first, then story-text containment. Ambiguous or
// unmatched films are left alone (they live behind the Story Room's Films
// button until linked by hand via POST /api/movies/:id/story).
//
//   node scripts/link-films-to-stories.js --dry-run   # print the plan
//   node scripts/link-films-to-stories.js             # write the links
//   node scripts/link-films-to-stories.js --force     # re-match already-linked films too
//
// Needs BOTH service accounts in the environment:
//   FIREBASE_SERVICE_ACCOUNT        = deckfactory-43176 (forge-movies)
//   STORY_FIREBASE_SERVICE_ACCOUNT  = membry-df528      (forge-story)

const admin = require('firebase-admin');

const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

function initApp(envVar, name) {
  const raw = process.env[envVar];
  if (!raw) { console.error(`${envVar} not set`); process.exit(1); }
  const sa = JSON.parse(raw);
  return admin.initializeApp({ credential: admin.credential.cert(sa) }, name);
}

// Fold text to its comparable core: lowercase, letters/digits only, single
// spaces. Titles also lose a trailing style label ("(Pencil)") — sibling
// movies per style share a base title.
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const titleNorm = (s) => norm(String(s || '').replace(/\s*\([^)]{1,30}\)\s*$/, ''));

(async () => {
  const movDb = initApp('FIREBASE_SERVICE_ACCOUNT', 'movies').firestore();
  const stoDb = initApp('STORY_FIREBASE_SERVICE_ACCOUNT', 'stories').firestore();

  const stories = (await stoDb.collection('forge-story').get()).docs.map((d) => ({
    id: d.id,
    title: d.data().title || '',
    text: d.data().text || '',
  }));
  const movies = (await movDb.collection('forge-movies').get()).docs.map((d) => ({
    ref: d.ref,
    id: d.id,
    title: d.data().title || '',
    story: d.data().story || '',
    storyId: d.data().storyId || null,
  }));
  console.log(`${stories.length} stories, ${movies.length} films`);

  let linked = 0, skipped = 0, unmatched = 0;
  for (const m of movies) {
    if (m.storyId && !FORCE) { skipped++; continue; }

    // 1) title match (unique winner only)
    const mt = titleNorm(m.title);
    let candidates = mt ? stories.filter((s) => titleNorm(s.title) === mt) : [];

    // 2) text containment — the movie kept a copy of the story it was made
    // from, so compare its opening against each story's prose.
    if (candidates.length !== 1) {
      const mtext = norm(m.story);
      if (mtext.length >= 40) {
        const head = mtext.slice(0, 200);
        const byText = stories.filter((s) => {
          const st = norm(s.text);
          return st.length >= 40 && (st.includes(head) || mtext.includes(st.slice(0, 200)));
        });
        if (byText.length === 1) candidates = byText;
      }
    }

    if (candidates.length === 1) {
      const s = candidates[0];
      console.log(`${DRY ? '[dry] ' : ''}link  "${m.title}" (${m.id}) → "${s.title}" (${s.id})`);
      if (!DRY) await m.ref.set({ storyId: s.id }, { merge: true });
      linked++;
    } else {
      console.log(`      no match for "${m.title}" (${m.id})${candidates.length > 1 ? ` — ${candidates.length} title candidates, left alone` : ''}`);
      unmatched++;
    }
  }
  console.log(`\n${linked} linked${DRY ? ' (dry run — nothing written)' : ''}, ${skipped} already linked, ${unmatched} unmatched (stay behind the Films button)`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
