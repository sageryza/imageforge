#!/usr/bin/env node
// test-ytdl.js — the grab module's decisions, pure and offline by default.
//
// The pure half needs no network, no Firebase and no yt-dlp: it pins the url
// rules, the id that makes "grab this twice" one doc, the format strings, and
// the error reading that tells a bot-block apart from an ordinary failure.
//
// `--live` adds the one measurement no unit test can stand in for: fetch the
// real yt-dlp and pull a real video from whatever IP this is running on. Run it
// on the box you are asking about — the answer is only ever about that box.

const assert = require('assert');
const ytdl = require('../ytdl.js');

let pass = 0; let failed = 0;
const queue = [];
function t(name, fn) {
  queue.push(async () => {
    try { await fn(); pass++; console.log(`  ok  ${name}`); }
    catch (e) { failed++; console.log(`FAIL  ${name}\n      ${e.message}`); }
  });
}
async function drain() { for (const q of queue.splice(0)) await q(); }

console.log('\nthe source url');
t('a plain youtube url is fine', () => {
  assert.ok(ytdl.checkSource('https://www.youtube.com/watch?v=abc123'));
});
t('a bare word is not a url', () => {
  assert.throws(() => ytdl.checkSource('wilco being there'), /not a url/);
});
t('empty is refused by name', () => {
  assert.throws(() => ytdl.checkSource(''), /url required/);
});
t('file:// is refused — http(s) only', () => {
  assert.throws(() => ytdl.checkSource('file:///etc/passwd'), /http\(s\)/);
});
// A route that fetches a url on the server's behalf must never be a way to read
// the inside of our own network back out.
for (const bad of ['http://localhost:3001/api/status', 'http://127.0.0.1/', 'http://10.0.0.5/',
  'http://192.168.1.1/', 'http://169.254.169.254/latest/meta-data/', 'http://172.16.0.9/']) {
  t(`private address refused: ${bad}`, () => {
    assert.throws(() => ytdl.checkSource(bad), /not reachable/);
  });
}
t('a public non-youtube url is allowed (yt-dlp handles a thousand sites)', () => {
  assert.ok(ytdl.checkSource('https://vimeo.com/12345'));
});

console.log('\nthe video id — six spellings, one video');
const ID = 'dQw4w9WgXcQ';
for (const [label, url] of [
  ['watch?v=', `https://www.youtube.com/watch?v=${ID}`],
  ['youtu.be', `https://youtu.be/${ID}`],
  ['shorts', `https://www.youtube.com/shorts/${ID}`],
  ['embed', `https://www.youtube.com/embed/${ID}`],
  ['live', `https://www.youtube.com/live/${ID}`],
  ['nocookie', `https://www.youtube-nocookie.com/embed/${ID}`],
  ['with a timestamp', `https://youtu.be/${ID}?t=90`],
  ['with a playlist tail', `https://www.youtube.com/watch?v=${ID}&list=PL123&index=4`],
  ['m. subdomain', `https://m.youtube.com/watch?v=${ID}`],
]) {
  t(`reads the id from ${label}`, () => assert.strictEqual(ytdl.youtubeId(url), ID));
}
t('a non-youtube url has no youtube id', () => {
  assert.strictEqual(ytdl.youtubeId('https://vimeo.com/12345'), null);
});

console.log('\nthe doc id — asking twice must be one doc');
t('the same video spelled two ways is ONE grab', () => {
  assert.strictEqual(
    ytdl.grabId(`https://www.youtube.com/watch?v=${ID}&t=30`, 'video', '720'),
    ytdl.grabId(`https://youtu.be/${ID}`, 'video', '720'),
  );
});
t('audio and video of one song are DIFFERENT grabs', () => {
  assert.notStrictEqual(
    ytdl.grabId(`https://youtu.be/${ID}`, 'audio', '720'),
    ytdl.grabId(`https://youtu.be/${ID}`, 'video', '720'),
  );
});
t('two qualities are different grabs', () => {
  assert.notStrictEqual(
    ytdl.grabId(`https://youtu.be/${ID}`, 'video', '480'),
    ytdl.grabId(`https://youtu.be/${ID}`, 'video', '1080'),
  );
});
t('a non-youtube url falls back to the whole url', () => {
  assert.strictEqual(
    ytdl.grabId('https://vimeo.com/12345', 'video', '720'),
    ytdl.grabId('https://vimeo.com/12345', 'video', '720'),
  );
});
t('the id is a short hex string, safe as a doc id', () => {
  assert.match(ytdl.grabId('https://youtu.be/x', 'video', '720'), /^[0-9a-f]{20}$/);
});

console.log('\nthe format string');
t('audio never asks for a video stream', () => {
  assert.ok(!/bestvideo/.test(ytdl.formatFor('audio', '720')));
});
t('video honours the height cap', () => {
  assert.ok(ytdl.formatFor('video', '480').includes('height<=480'));
});
t('an unknown quality falls back to 720, never to unbounded', () => {
  assert.ok(ytdl.formatFor('video', '4321').includes('height<=720'));
});
t('every video format ends in a plain fallback, so a weird source still works', () => {
  assert.ok(ytdl.formatFor('video', '720').split('/').pop() === 'best');
});

console.log('\nreading a failure');
t('the last ERROR line wins, warnings are dropped', () => {
  const err = ['WARNING: something cosmetic', 'ERROR: Video unavailable', ''].join('\n');
  assert.strictEqual(ytdl.cleanErr(err), 'Video unavailable');
});
t('a message with no ERROR line still says something', () => {
  assert.strictEqual(ytdl.cleanErr('everything is on fire'), 'everything is on fire');
});
t('the bot-block is recognised', () => {
  assert.ok(ytdl.isBlocked('ERROR: Sign in to confirm you are not a bot'));
  assert.ok(ytdl.isBlocked('HTTP Error 429: Too Many Requests'));
});
t('an ordinary failure is NOT called a block', () => {
  // This matters: `blocked` is what would send her to the desktop queue, and
  // sending her there for a typo'd url would be a wasted trip to her computer.
  assert.ok(!ytdl.isBlocked('Video unavailable'));
  assert.ok(!ytdl.isBlocked('nothing downloaded — the file is probably over the cap'));
});

console.log('\nwhere an unspecified grab goes');
// The asymmetry this encodes: a song transcribed into her voice-memo archive
// has to be hunted down and deleted; an interview she has to ask to transcribe
// costs one more sentence. So the cheap mistake is the default.
t('audio does NOT default into the transcribing library', () => {
  assert.strictEqual(ytdl.defaultTo('audio'), 'none');
});
t('video defaults to the Dump, where video is looked for', () => {
  assert.strictEqual(ytdl.defaultTo('video'), 'dump');
});

console.log('\nthe bot-block is answered by changing client');
// Measured 2026-08-27: a refusal is per PLAYER CLIENT. The android family
// answers where the web/tv clients are refused, on the same box in the same
// second — so waiting alone left real grabs failing while the probe passed.
t('default asks for no extractor-args at all', () => {
  assert.deepStrictEqual(ytdl.clientArgs('default'), []);
  assert.deepStrictEqual(ytdl.clientArgs(''), []);
});
t('a named client becomes a real yt-dlp flag', () => {
  assert.deepStrictEqual(ytdl.clientArgs('android_vr'),
    ['--extractor-args', 'youtube:player_client=android_vr']);
});
t('no web or tv client is in the ladder — every one was refused', () => {
  const bad = ytdl.CLIENTS.filter((c) => /^(web|tv|mweb|ios)$|^web_|^tv_/.test(c));
  assert.deepStrictEqual(bad, [], `refused clients in the ladder: ${bad}`);
});
t('a refusal moves to the NEXT client, and the winner is reported', async () => {
  const tried = [];
  const got = await ytdl.pastTheBlock('x', (c) => {
    tried.push(c);
    if (c !== 'android') throw new Error('Sign in to confirm you are not a bot');
    return 'the file';
  }, async () => {}, [1]);
  assert.strictEqual(got.value, 'the file');
  assert.strictEqual(got.client, 'android');
  assert.deepStrictEqual(tried, ['default', 'android_vr', 'android']);
});
t('an ordinary failure is NOT retried on any client', async () => {
  let n = 0;
  await assert.rejects(() => ytdl.pastTheBlock('x', () => {
    n++; throw new Error('Video unavailable');
  }, async () => {}, [1]));
  assert.strictEqual(n, 1, `retried ${n} times`);
});
t('every client refusing IS reported, after the whole ladder', async () => {
  let n = 0;
  await assert.rejects(() => ytdl.pastTheBlock('x', () => {
    n++; throw new Error('Sign in to confirm you are not a bot');
  }, async () => {}, [1]), /not a bot/);
  assert.strictEqual(n, ytdl.CLIENTS.length * ytdl.BLOCK_ROUNDS);
});
t('the caller can put its own client first', async () => {
  const tried = [];
  await ytdl.pastTheBlock('x', (c) => { tried.push(c); return 1; },
    async () => {}, [1], ['ios_music', 'default']);
  assert.deepStrictEqual(tried, ['ios_music']);
});

console.log('\ncontent types');
t('mp4 is video', () => assert.strictEqual(ytdl.ctFor('mp4'), 'video/mp4'));
t('m4a is audio, not video', () => assert.strictEqual(ytdl.ctFor('m4a'), 'audio/mp4'));
t('an unknown extension is octet-stream, never a guess', () => {
  assert.strictEqual(ytdl.ctFor('xyz'), 'application/octet-stream');
});

/* ── the live half ───────────────────────────────────────────────────────── */

async function live() {
  console.log('\nLIVE — measuring THIS box, on THIS IP');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { ytdlp, readMeta, download } = ytdl._internals;
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  let bin;
  try {
    const t0 = Date.now();
    bin = await ytdlp();
    pass++;
    console.log(`  ok  yt-dlp is here (${Date.now() - t0}ms) — ${bin}`);
  } catch (e) {
    failed++; console.log(`FAIL  no yt-dlp — ${e.message}`); return;
  }

  let meta;
  try {
    meta = await readMeta(bin, url);
    assert.ok(meta.title, 'no title came back');
    assert.ok(meta.seconds > 0, 'no duration came back');
    pass++;
    console.log(`  ok  YouTube answers this IP — "${meta.title}" (${meta.seconds}s)`);
  } catch (e) {
    failed++;
    console.log(`FAIL  YouTube refused this IP${ytdl.isBlocked(e.message) ? ' (BOT-BLOCKED)' : ''}`);
    console.log(`      ${e.message}`);
    return;
  }

  // The real argv, on the real network, all the way to a file on disk. This is
  // the step that a unit test cannot stand in for: the format string, the
  // ffmpeg location and the progress parsing are only ever exercised here.
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ytdl-test-'));
  try {
    let sawProgress = false;
    const t0 = Date.now();
    const got = await download(bin, url, 'audio', '720', dir,
      (d, tot, label) => { if (label === 'downloading' && d > 0) sawProgress = true; });
    assert.ok(got.size > 100000, `suspiciously small file: ${got.size} bytes`);
    pass++;
    console.log(`  ok  a real download landed — ${(got.size / 1048576).toFixed(1)}MB `
      + `${path.extname(got.f)} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    if (sawProgress) { pass++; console.log('  ok  progress lines parsed'); }
    else { failed++; console.log('FAIL  no progress was ever reported'); }
  } catch (e) {
    failed++; console.log(`FAIL  the download failed — ${e.message}`);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

(async () => {
  await drain();
  if (process.argv.includes('--live')) await live();
  console.log(`\n${pass} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
})();
