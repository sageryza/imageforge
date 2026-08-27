#!/usr/bin/env node
// ONE STORY BECOMES TWO — pad-duplicate.js, pure, no node_modules needed.
// (Sophie, 2026-08-27: "can u duplicate the hate of the game story room story
// so i can do my own pictures name one (mine) and the other (claude) as
// suffix".)
//
// The three rules a duplicate lives or dies by:
//   1. every beat gets a FRESH id — a shared id is a beat that belongs to two
//      stories, and /text, /image, /color, /remove and the Story Link's join
//      all find a beat by id,
//   2. it is a DENY-list — a field a chat adds next month rides along by
//      itself, while the other version's renders never do,
//   3. art:false leaves the WORDS and takes the PICTURES — emptied through
//      scratchpad.js's own SLOT_KEYS, never by wiping the beat, because the
//      words, the colour, her voice takes and the chunk link live at the
//      beat root and belong to both sides.
//
//   node scripts/test-pad-duplicate.js
const { dupPad } = require('../pad-duplicate');

// The real lists scratchpad.js passes in.
const STYLES = ['watercolor', 'dreamy', 'pastel'];
const SLOT_KEYS = ['url', 'src', 'gen', 'imageHistory', 'kind', 'poster', 'seconds', 'title', 'clipId'];

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

let n = 0;
const opts = (extra) => Object.assign({
  styles: STYLES, slotKeys: SLOT_KEYS, now: 1000, mkId: () => `new${++n}`,
}, extra || {});

const story = () => ({
  title: 'For the Hate of the Game',
  style: 'watercolor',
  category: 'lessons',
  folder: 'Lessons',
  pinned: true,
  cover: 'https://x/ht-veil.png',
  description: 'what it was about',
  descriptionAudio: 'https://x/hate.m4a',
  voiceover: { url: 'https://x/hate.m4a', source: 'her read-aloud' },
  inbox: [{ url: 'https://x/ht-grace.png', prompt: 'a circle of people' }],
  inboxHidden: ['https://x/gone.png'],
  uploads: [{ url: 'https://x/phone.jpg' }],
  audios: [{ src: 'memo-1' }],
  characters: [{ name: 'her' }],
  sources: ['memo-1'],
  episodes: [{ id: 'ep1' }],
  film: 'https://x/film.mp4',
  films: [{ url: 'https://x/film.mp4' }],
  updatedAt: 5,
  beats: [
    {
      id: 'beatA', text: 'the veil lifts', color: 'blue', prompt: 'a dark starry night',
      addedAt: 3, ttsUrl: 'https://x/tts.mp3', ttsHash: 'abc', clipId: null,
      url: 'https://x/ht-veil.png', src: { runId: 'r1' }, gen: { job: 'running' },
      imageHistory: [{ url: 'https://x/older.png', at: 2 }],
      alt: { dreamy: { url: 'https://x/dreamy.png', off: true, gen: { job: 'x' } } },
    },
    { id: 'beatB', text: 'it fades', off: true },
  ],
});

// ── the default: her words, a blank canvas ──────────────────────────
{
  const d = dupPad(story(), opts({ title: 'For the Hate of the Game (mine)' }));
  ok(d.title === 'For the Hate of the Game (mine)', 'it takes the title it is given');
  ok(d.beats.length === 2, 'every beat comes across');
  ok(d.beats[0].id === 'new1' && d.beats[1].id === 'new2', 'each beat gets a FRESH id');
  ok(d.beats[0].text === 'the veil lifts' && d.beats[1].text === 'it fades', 'the words come across');
  ok(d.beats[0].color === 'blue', 'the frame colour comes across');
  ok(d.beats[0].prompt === 'a dark starry night', 'the drawing prompt comes across');
  ok(d.beats[0].url === undefined && d.beats[0].src === undefined, 'the picture does NOT');
  ok(d.beats[0].imageHistory === undefined, 'and neither do its past pictures');
  ok(d.beats[0].alt.dreamy.url === undefined, 'the dreamy side is blank too');
  ok(d.beats[0].alt.dreamy.off === undefined && d.beats[1].off === undefined,
    'a side she had deleted the beat from starts drawable — that was about the other version');
  ok(d.beats[0].ttsUrl === 'https://x/tts.mp3', 'her voice take is kept — it belongs to the WORDS, not a side');
  ok(d.cover === undefined, 'the pinned shelf face is dropped — it is the other version\'s picture');
  ok(d.inbox.length === 1 && d.inbox[0].url === 'https://x/ht-grace.png',
    'the story\'s own inbox comes across — the pictures are one tap away, not gone');
  ok(d.inboxHidden.length === 1, 'and what she took out of it stays out');
}

// ── what must never travel ──────────────────────────────────────────
{
  const d = dupPad(story(), opts());
  ok(d.film === undefined && d.films === undefined, 'the other version\'s renders do not travel');
  ok(d.episodes === undefined, 'nor its episodes');
  ok(d.pinned === undefined, 'nor its place on the shelf');
  ok(d.updatedAt === 1000, 'the copy is stamped now');
  ok(d.beats[0].gen === undefined && d.beats[0].alt.dreamy.gen === undefined,
    'a running draw marker is dropped — a copy of one waits forever for a job nobody started');
}

// ── it is a deny-list: an unknown field rides along ─────────────────
{
  const src = story();
  src.somethingAChatAddsNextMonth = { keep: true };
  src.beats[0].newBeatField = 'kept';
  const d = dupPad(src, opts());
  ok(d.somethingAChatAddsNextMonth.keep === true, 'a field nobody here knows about is copied, not silently dropped');
  ok(d.beats[0].newBeatField === 'kept', 'same on a beat');
}

// ── art:true is a faithful clone ────────────────────────────────────
{
  const d = dupPad(story(), opts({ art: true }));
  ok(d.beats[0].url === 'https://x/ht-veil.png', 'the picture comes across');
  ok(d.beats[0].imageHistory.length === 1, 'with its past pictures');
  ok(d.beats[0].alt.dreamy.url === 'https://x/dreamy.png', 'and the other side');
  ok(d.beats[0].alt.dreamy.off === true, 'a side she deleted the beat from is kept — the art is here too');
  ok(d.cover === 'https://x/ht-veil.png', 'and the shelf face still points at a picture this story has');
  ok(d.beats[0].gen === undefined, 'the running draw marker is STILL dropped');
}

// ── nothing is shared with the original ─────────────────────────────
{
  const src = story();
  const d = dupPad(src, opts({ art: true }));
  d.beats[0].text = 'changed';
  d.inbox[0].prompt = 'changed';
  ok(src.beats[0].text === 'the veil lifts', 'editing the copy cannot reach the original\'s beats');
  ok(src.inbox[0].prompt === 'a circle of people', 'nor its inbox');
  ok(src.beats[0].id === 'beatA', 'and the original keeps its own beat ids');
}

// ── a story with nothing in it ──────────────────────────────────────
{
  const d = dupPad({}, opts({ title: 'Empty' }));
  ok(Array.isArray(d.beats) && d.beats.length === 0, 'an empty story duplicates to an empty story');
  ok(d.title === 'Empty', 'and still takes its name');
}

console.log(failures ? '\n' + failures + ' FAILED' : '\nall good');
process.exit(failures ? 1 : 0);
