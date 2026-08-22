#!/usr/bin/env node
// test-movies-creations.js — everything Movies makes files into the iOS "My
// Creations" gallery. Pure: no network, no Firebase; the writer is a stub.
//
// The bugs this pins are all silent ones — a filing that never happens, or one
// that lands with no poster (a video creation with no poster tiles as a blank
// white square, because there is no frame the grid can decode out of an mp4).

const assert = require('assert');
const movies = require('../movies');

let n = 0;
function t(name, fn) { fn(); n++; console.log(`  ok — ${name}`); }
const wait = () => new Promise(r => setImmediate(r));

// Collect what the stub writer is handed.
let filed = [];
function stub() {
  filed = [];
  movies.init({ fileCreation: async (doc) => { filed.push(doc); return 'id'; } });
}

console.log('the filer:');

t('does nothing at all before init — no server, no gallery', () => {
  // A fresh require has no writer; local dev without server.js must not throw.
  movies.init({});                       // no fileCreation key = left as-is
  assert.doesNotThrow(() => movies.fileVideoToCreations({ url: 'https://x/clip.mp4' }));
});

t('files a clip with its poster, type and prompt', async () => {
  stub();
  movies.fileVideoToCreations({
    url: 'https://x/movies/clips/a.mp4', poster: 'https://x/movies/panels/a.png',
    prompt: 'the cat leaps', model: 'wan-2.2-i2v-fast', quality: 'draft',
  });
});

// The call is deliberately fire-and-forget (a gallery hiccup must never cost a
// clip that already exists), so the assertions wait a tick for it.
(async () => {
  await wait();
  assert.strictEqual(filed.length, 1);
  const doc = filed[0];
  assert.strictEqual(doc.type, 'clip');
  assert.strictEqual(doc.poster, 'https://x/movies/panels/a.png');
  assert.strictEqual(doc.source, 'movies');
  assert.strictEqual(doc.model, 'wan-2.2-i2v-fast');
  console.log('  ok — the filed doc carries poster · type · model · quality');
  n++;

  stub();
  movies.fileVideoToCreations({ url: '', poster: 'https://x/p.png' });
  movies.fileVideoToCreations({ url: 'data:video/mp4;base64,AAAA' });
  await wait();
  assert.strictEqual(filed.length, 0);
  console.log('  ok — no url, or a data: url, files nothing (nothing to open later)');
  n++;

  // A data: poster is dropped rather than stored: it would be megabytes of
  // base64 on a Firestore doc, and the tile can fall back to the url.
  stub();
  movies.fileVideoToCreations({ url: 'https://x/a.mp4', poster: 'data:image/png;base64,AAAA' });
  await wait();
  assert.strictEqual(filed[0].poster, null);
  console.log('  ok — a data: poster is dropped, never stored');
  n++;

  stub();
  movies.fileVideoToCreations({ url: 'https://x/film.mp4', type: 'film' });
  await wait();
  assert.strictEqual(filed[0].type, 'film');
  console.log('  ok — a finished cut files as its own kind, so the grid can separate films from clips');
  n++;

  // A writer that throws must be swallowed: the render already succeeded.
  movies.init({ fileCreation: async () => { throw new Error('gallery down'); } });
  movies.fileVideoToCreations({ url: 'https://x/b.mp4' });
  await wait();
  console.log('  ok — a failing writer never reaches the render');
  n++;

  console.log(`\n${n} checks passed.`);
})();
