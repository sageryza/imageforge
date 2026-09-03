#!/usr/bin/env node
// forgotten-projects.js — THE CATALOG OF PROJECTS SHE FORGOT ABOUT
//
// (2026-09-03, Sophie: "can u make me a catalog of all the projects i forgot
// about".) One grid page in the forgotten-projects-catalog chat: a chapter per
// area, a tile per project, the chat's own icon as the picture, what it was
// and where it stopped under it, and a link back to the chat.
//
// HOW A PROJECT GOT IN — measured off the live registry, then curated by hand.
// The sweep (`--sweep` prints it) takes every live chat (not archived, not
// trashed) whose newest message is 7+ days old, where the CHAT spoke last and
// nothing of hers came after, and whose own cards left something open (a
// status `need`, a wrap-up `next`/`open`, an Update `next`, a waiting-for).
// That answered 131 chats on 2026-09-03. The catalog below is the ~75 of them
// that are PROJECTS — things she was making — plus three sources no chat
// carries: the story pads still empty since the migration
// (docs/story-room-unported.md), the tools she built and never opened, and
// the desktop queue (docs/desktop-tasks.md, OPEN). Chats-app plumbing,
// Playground features and bug fixes are left out on purpose: they are on the
// Update tab already and none of them is a project.
//
// Dry by default (prints the plan). `--go` posts the page; `--supersede <id>`
// retires the last version first. A new version is a new page (the title
// carries the date), never an edit — a posted page is frozen.
'use strict';
const https = require('https');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'forgotten-projects-catalog';
const SESSION = (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, '');

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method,
      headers: Object.assign({ 'content-type': 'application/json' }, data ? { 'content-length': Buffer.byteLength(data) } : {}) },
    (res) => { let s = ''; res.on('data', (c) => { s += c; }); res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(new Error(s.slice(0, 200))); } }); });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}

// ---- THE CATALOG — slug → what it was · where it stopped (her words where we have them)
// [chapter, slug, title, what it was, where it stopped]
const CHATS = [
  // Stories & films
  ['Stories & films', 'soul-movie-concept', 'Soul through the trap door', 'The dream app\'s home-screen film: a soul sneaking out of a sleeping body.', 'v5 with the golden ear-door hatch was still rendering — never confirmed as the one.'],
  ['Stories & films', 'blog-readalouds-shorts', 'Animal Magic — the short', 'A 13-scene flat-line-art short with voiceover, off the blog post.', 'The finished film was never confirmed rendered or sent.'],
  ['Stories & films', 'new-house-story-illustrations', 'Controlling My Own Destiny — animated', 'The 1:23 pastel vertical short.', 'Moon Milk was going to be next to animate. Never started.'],
  ['Stories & films', 'bath-thought-experiment', 'The bath thought experiment', 'Voiceover cut, panels drawn, a draft film stitched.', 'The supermarket stretch still has no real panels, and the animation pass never began.'],
  ['Stories & films', 'meteorite-story-prompts', 'The Meteorite', 'The narrated meteorite story, with watercolor prompts written for its animation.', 'You never said whether the v2 prompts were right.'],
  ['Stories & films', 'films-pipeline-progressive-choices', 'Controlling destiny — the witch transformation', 'The voice memo turned into a witch-transformation film through the Films pipeline.', 'The transformation image that replaces the failed morph was never drawn.'],
  ['Stories & films', 'dolores-cannon-memo-illustrations', 'The grasshopper being', 'Dolores Cannon\'s grasshopper passage, illustrated, with a click-to-pick compare page.', 'Was the passage the book\'s words or the memo\'s? Never settled.'],
  ['Stories & films', 'dolores-cannon-time', 'Time — Dolores Cannon', 'Passages on getting lost in time, cut from the audio.', 'The "everything is simultaneous" passage is found but not cut; the reorder page is waiting on your arrangement.'],
  ['Stories & films', 'mason-noise-art-summary', 'Mason — the shape', 'The noise-art shape story built from the source recordings.', 'Listen to film v2 and note the beats.'],
  ['Stories & films', 'darius-interview-videos', 'Darius — the three videos', 'Two illustrated videos from the Darius J. Wright interviews: the heart, the field, thought forms.', 'Pick a Darius card — 11 to choose from.'],
  ['Stories & films', 'hospital-story-images', 'In the Hospital', 'A 101-shot watercolor short film plan with character refs and your narration.', 'Redo the childhood photo with WTR img2img, or keep the redraw? Undecided.'],
  ['Stories & films', 'el-salvador-bar-conversation', 'The bar in El Salvador', 'Watercolor movie frames of the bar scene with your brother.', 'Back to the bar scene when the photos arrive.'],
  ['Stories & films', 'evan-film-local', 'Evan — the beat images', 'Twelve beat images, the girl locked to the braids reference.', 'Look at v1 vs v2.'],
  ['Stories & films', 'time-travel-class-illustrations', 'The time-travel class', 'The passage found and illustrated in sage sandy mirror watercolor, for a film.', 'Eight storyboard frames waiting for ♥/✕.'],
  ['Stories & films', 'child-pov-play-place', 'Child\'s-eye play place', 'A POV video of an indoor play place: tunnels, slide, ball pit.', 'Watch the fast slide clip — fold it into the film?'],
  ['Stories & films', 'new-session-e0f161', 'The Universe reel', 'The shot list, images first, clips after.', 'Review the 16 stills, then pick an animation tier.'],
  ['Stories & films', 'marlas-eyes-fishbowl-storybook', 'Eyes as Wide as a Fishbowl', 'A 36-page illustrated storybook.', '25 pages still have no pick — heart the ones you want.'],
  ['Stories & films', 'spellcasting-voiceover-beats', 'Spellcasting — with your voice', 'The spellcasting story with images and your real voice.', 'Watch v2, note the beats to redo.'],
  ['Stories & films', 'nde-reels-status', 'PROOF — the reel', 'The panels with the voice, no animation, as an actual movie.', 'Watch reel v1 and mark the panels to swap.'],
  ['Stories & films', 'story-beats-nine-panels', 'The glove and the accidental dance', 'Both stories cut into 9-beat sheets and illustrated.', 'One film or two? Your call.'],
  ['Stories & films', 'bath-experiment-missing-voices', 'Charlie — two versions', 'Charlie split into as-it-is-now and as-it-used-to-be, in one bucket.', 'Look at the Charlie stack and tap either version.'],
  ['Stories & films', 'mason-story-descriptions', 'Mason — the descriptions', 'The eight Mason descriptions from one day, checked.', 'Two memos have no beats — say if I write them.'],
  ['Stories & films', 'video-search-jesus-rules', 'Jesus rules', 'The recording found, a model-comparison page for the rules images.', 'Two rules images (Sabbath, shellfish) still to make; the $39 APIFRAME question is open.'],
  ['Stories & films', 'house-story-beats-room', 'The house', 'The story timeline put into the Story Room, one beat per section.', 'Art per beat, whenever you want it.'],
  ['Stories & films', 'dating-reel-visuals', 'The dating reel', 'The on-screen visuals you described, made for real.', 'Watch the overlay and say what\'s off.'],
  // Commercials & reels
  ['Commercials & reels', 'dream-feed-commercials', 'The morphing-in-dreams spot', 'Evaporation and Night Gallery liked; a spot on people morphing in dreams.', 'Pick a morph take from the round-2 deck.'],
  ['Commercials & reels', 'fictional-pill-commercial-01ufbk', 'Thresholdyn — the next spot', 'The fake pill commercial, plus five more ideas to shoot from.', 'Pick the next spot, or say all five.'],
  ['Commercials & reels', 'fictional-pill-commercial', 'The bird reel — all your art', 'Your phone-screen story art animated into a video, panels popping up, texting sounds.', 'Watch the all-her-art bird reel, 45 seconds.'],
  ['Commercials & reels', 'dream-app-commercial', 'Gains boys', 'The dream-app commercial: four images and an iMessage-style video ad.', 'Two calls: protein vs fries, and the song.'],
  ['Commercials & reels', 'dream-app-commercials', 'Dream app — more ideas', 'Two idea decks for the next dream-app spots.', 'Swipe both decks, pick three or four.'],
  ['Commercials & reels', 'vibrilify-max-commercial', 'Vibrilify MAX', 'The parody drug ad, drawn cut and live-action cut, v3 from your notes.', 'Watch v3, 73 seconds.'],
  ['Commercials & reels', 'commercial-production-series', 'The street-interview ad', 'The greenlit queue after the witch reels.', 'Pick the street-interview question — it also unblocks XI\'s third Instagram tile.'],
  ['Commercials & reels', 'new-session-672695', 'The dinner party reel', 'Five cloned voices around a table, portrait, a shot of all of them.', 'Watch the reel and tell me what to change.'],
  // People Watching Club
  ['People Watching Club', 'people-watching-club-reel', 'PWC ep006 — the building across the street', 'Watching a building and seeing into every window.', 'Watch ep006, 41 seconds.'],
  ['People Watching Club', 'stock-footage-backstories', 'PWC ep005 — Chicago', 'Another episode on new footage: end-card font, a logo, a tagline.', 'Watch ep005, give the tagline a verdict.'],
  ['People Watching Club', 'people-watching-club-reels', 'The 1950s announcer', 'A 1950s-announcer voice on ElevenLabs for the PWC reels.', 'Pick a voice — two minutes of listening.'],
  ['People Watching Club', 'pwc-instagram-content', 'PWC Instagram — the final list', 'The list after your picks from the two decks.', 'The third panel pick is still open.'],
  ['People Watching Club', 'middle-one-goes-first', 'The hands reel', 'Black-and-white hand photos from the Dump.', 'Shoot or convert more if you want a longer reel — the candid albums are all colour.'],
  // Secretly a Witch
  ['Secretly a Witch', 'tarot-reveal-email', 'The tap-to-reveal tarot email', 'A CSS-only flip-the-card email through Brevo.', 'Does a card flip while logged out? You were about to test it.'],
  ['Secretly a Witch', 'deck-factory-inbox-review', 'Hoonies', 'The woodcut clipart set: contact sheet, loading gif, style ref, a house-style prompt.', 'The crowd-repetition rule, and shipping the revised prompt to the witch app — undecided.'],
  ['Secretly a Witch', 'deck-factory-story-room', 'Imprint — the 21 lessons', 'Every lesson deck rebuilt in your own words.', 'Open Lessons and read them.'],
  ['Secretly a Witch', 'witch-school-synchronicity-lesson', 'The synchronicity lesson', 'The lesson plus Wan/Kling tests for the suspicious-coincidence card.', 'Say go for the Kling 3s clip, about 35¢.'],
  ['Secretly a Witch', 'secretly-witch-instagram-content', 'Witch Instagram — the look', 'Three hearted images redone at high, and a style deck instead of more images.', 'Swipe the style deck, eyeball the three highs in Assets.'],
  ['Secretly a Witch', 'witch-school-lesson-topics', 'Nine random-fact lessons', 'All nine written with variable card counts; art held for your go-ahead.', 'Read the niche lessons v1, pick the art go-aheads.'],
  ['Secretly a Witch', 'witchcraft-reels-ideas', 'Witchcraft reel ideas', 'Funny and interesting reel ideas for the business.', 'Pick your favourites, 30 seconds.'],
  ['Secretly a Witch', 'witch-video-pipeline', 'Mom\'s review pipeline', 'Theo\'s ideas in, draft cuts to her phone, tap-to-pause notes straight back.', 'Text Mom her review link.'],
  ['Secretly a Witch', 'witchcraft-reels-panels', 'The crystal reel', 'The one with money in it, mini-TTS voice.', 'Record Mom\'s garnet story, 20 seconds.'],
  ['Secretly a Witch', 'witchcraft-blog-content', 'The 20 blog posts', 'All twenty Secretly a Witch posts, published, backdated, cross-linked.', 'Your square-vs-landscape picks are waiting in the Compare tab.'],
  // Dreams & journals
  ['Dreams & journals', 'dream-collection-consolidate', 'Journal PDF matching', 'All 2,336 scanned journal pages linked to the timeline.', 'STUDIO_TOKEN still needs setting in Render to lock the journal endpoint.'],
  ['Dreams & journals', 'dream-illustration-style-swap', 'Shlomo — the watercolor pages', 'Dream comic pages re-rendered in a new watercolor style.', 'The bug that draws Shlomo white instead of Moroccan is diagnosed, not fixed.'],
  ['Dreams & journals', 'journal-search-caption', 'JournalReader — Genius Scan', 'Caption search in the Drawings tab shipped.', 'The Genius Scan share-sheet was scoped and never built.'],
  ['Dreams & journals', 'journal-synchronicity-moments', '180 synchronicity moments', 'Pulled from 13 journals into a review page.', 'Tick or X down the page — no rush.'],
  ['Dreams & journals', 'hand-drawn-illustration-style', 'The synchronicity drawings', 'Why the drawing loses the coincidence, and the fix proven on real moments.', 'The fixed prompt was never applied to the live server.'],
  ['Dreams & journals', 'dream-journal-version-history', 'Whose dream is whose', 'Version-history screenshots matched to journal entries.', '55 entries still tied — want the voice pass?'],
  // Games & Xi
  ['Games & Xi', 'new-session-b5902a', 'XI — the dice game', 'The lost dice game from your Drive, rebuilt, with a Boggle spinoff.', 'Pick a coin-clink sound from the eight on the Compare page.'],
  ['Games & Xi', 'nyt-puzzle-website', 'The puzzles page', 'An NYT-style page with your Boggle and Set games.', 'Possible Worlds needs rebuilding from the real Drive docs now they are found.'],
  ['Games & Xi', 'xi-card-design', 'Xi — the memory-trigger cards', 'New card designs and the first vintage-style art tests.', 'Heart a style direction on the art grid.'],
  ['Games & Xi', 'ex-boyfriend-fighting-game', 'The ex-boyfriend fighting game', 'A bystander who provokes, not a fighter; your real exes.', 'Two calls: Sean in or out, and names in a public repo.'],
  ['Games & Xi', 'game-rules-concept', 'The secret-rule drawing game', 'Telephone Pictionary crossed with exquisite corpse, everyone following a rule.', 'Read the write-up and say what to fix.'],
  ['Games & Xi', 'weird-games-book-014adq', 'The weird games book', 'The game list, the art, a no-context zip export.', 'The marriage story, and go/no on the design handoff.'],
  ['Games & Xi', 'surgeon-tool-flatlay-image', 'The insane surgeon tools', 'A pastel flatlay of surgical tools.', 'The not-real-tools version you asked for last was never made.'],
  // The dating book
  ['The dating book', 'sophie-portland-dates-blake', 'Date moments — part two', 'The moments pass picked up at Blake, three dates a batch.', 'Swipe the moments page, 18 cards.'],
  ['The dating book', 'portland-dates-moments', 'Date moments — the drawings', 'The first ten yes-moments, illustrated.', 'Review the 11 drawings in the Assets tab.'],
  // Shops
  ['Shops', 'site-deploy-stripe', 'ShouldiMakeThis — payments', 'The site built and deployed on Firebase; Stripe chosen for preorders.', 'Stripe itself was never built.'],
  ['Shops', 'makethis-domain-setup', 'shouldimakethis.com', 'Pointing the domain at its site.', 'Three Hover records, and drop the domain off Render.'],
  ['Shops', 'crystals-etsy-listings', 'Mom\'s crystals', 'The splitter tool, Etsy drafts traced against the Dump photos.', 'The septarian split, and whether a "not a stone" tag is worth it.'],
  ['Shops', 'etsy-hat-business', 'The hat shop', 'Multi-shop Etsy support, a checklist, hat pricing and tags researched.', 'Make the hat Etsy account, send the sayings list.'],
  ['Shops', 'etsy-hat-shop-decision', 'New shop or old shop', 'Whether a new Etsy shop gets better treatment than an old one.', 'Try logging into an old shop, two minutes.'],
  ['Shops', 'etsy-jewelry-listing-automation', 'Mom\'s jewelry on Etsy', 'The machinery is ready; three setup questions asked.', 'Mom taps one link, then which Lightroom and what prices.'],
  ['Shops', 'deckfactory-etsy-pipeline', 'Playing cards for Etsy', 'The deck pipeline, with four animation models benchmarked after MJ-video went down.', 'No animator was chosen from the four clips.'],
  // Voice & the morning ideas
  ['Voice & the morning ideas', 'voice-clone-recording', 'Your voice clone v2', 'A stronger clone from twelve minutes of your storytelling.', 'Listen to v2 — better or worse than v1?'],
  ['Voice & the morning ideas', 'morning-ideas-voice-memos', 'Three months of morning ideas', '23 built, 51 slipped through the cracks.', 'Swipe the two slipped-through decks.'],
  ['Voice & the morning ideas', 'morning-ideas-workflow', 'Nine idea cards', 'Three morning recordings transcribed and split into ideas.', '♥/✕ each card, three minutes.'],
  ['Voice & the morning ideas', 'voice-memo-ideas', 'The ideas to-do list', 'Rebuilt through v3 after the 40-minute-memo bug.', 'Name the dump folder, pick a to-do.'],
  // Tools you built and never tried
  ['Tools built, never opened', 'self-care-app', 'Sticker Day', 'The self-care app: sticker passport, stamp generator, live.', 'Should your own stamps match the library\'s flat colour? Your call.'],
  ['Tools built, never opened', 'audio-editor-waveform-marking', 'The Cutting Room', 'Tap-only audio editing, plus a clip straight from a search hit.', 'Try it on the Search page.'],
  ['Tools built, never opened', 'imageforge-pausing-tool', 'Pausing', 'The pause-length tool, built for real.', 'Open a recording, set one pause, say how it sounds.'],
  ['Tools built, never opened', 'clip-assembly-timeline', 'Assembly', 'Tap-to-place timeline, stills, Dump import, one-tap upload.', 'Place the nine and bake your first film.'],
];

// Story pads left empty by the migration — hers to say go on (docs/story-room-unported.md)
const PADS = [
  ['Zc2Zm8A5eE4bTM0yQLOK', 'Jonas & the Cookie Crumbs', 'Its pictures are in the inbox; the narration never crossed.'],
  ['PA5flOgCGwLPsFjMqzsU', 'Moon Milk', 'Pictures in the inbox, nothing on the canvas. Was going to be the next film.'],
  ['nrMvcplBMW2CxOonO0yJ', 'The Meteorite', 'Two beats placed; the rest waits in the inbox.'],
  ['gykLsHZUaMvtdGIQANVg', 'My Own Destiny', 'Pictures in the inbox, an empty canvas.'],
  ['6XoBrCbRMUvRZbkhu43r', 'Soul Leaves the Body', 'Cover restored; no beats yet.'],
  ['ry3TNU2FxfALtr2dqnDn', 'Wormsicles', 'A 10-minute description recording and 3,900 words, no beats, no art.'],
  ['EvNYHxOGPKyFiCxFfi46', 'In the Hospital', 'The 101-shot plan lives in its chat; the pad is empty.'],
  ['sP7J662uffEJTghtfwFy', 'Tolle — believing the worst', 'An empty pad beside a finished short.'],
  ['8rEj94i5aTRuAU9NJe7Z', 'Lessons from Harry Potter', 'Empty pad, no cover.'],
  ['LtWc5CWPBPrcYOADjCvD', 'Astrology fable', 'Empty pad.'],
  ['9ZI7vAD9cjcuorQIvLN0', 'Time', 'The Dolores Cannon passages have a pad with nothing in it.'],
  ['6mmxfw99AUyGvBDCdVlO', 'The Exile (the grasshopper)', 'Empty pad; the illustrations are in the grasshopper chat.'],
  ['xlo6P2GPotPiF06l92J5', 'Darius — the heart and the field', 'Empty pad; eleven cards to pick from in the Darius chat.'],
];

// docs/desktop-tasks.md, OPEN — read live rather than retyped
const DESKTOP_DOC = 'https://imageforge-q125.onrender.com/desktop';

function padLink(id) { return BASE + '/storyroom?pad=' + id; }
function chatLink(slug) { return BASE + '/chats?chat=' + encodeURIComponent(slug); }
function fmtDay(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });
}

async function build() {
  const feed = await req('GET', '/api/chatfeed?limit=1');
  const reg = feed.chats || {};
  const pads = (await req('GET', '/api/scratchpad/pads')).pads || [];
  const padBy = {}; pads.forEach((p) => { padBy[p.id] = p; });
  const now = Date.now();

  const groups = [];
  const byChapter = {};
  function group(label) {
    if (!byChapter[label]) { byChapter[label] = { label, items: [] }; groups.push(byChapter[label]); }
    return byChapter[label];
  }
  const missing = [];
  for (const [chapter, slug, title, what, stopped] of CHATS) {
    const r = reg[slug];
    if (!r) { missing.push(slug); continue; }
    const last = r.lastSeen ? Date.parse(r.lastSeen) : 0;
    const days = last ? Math.round((now - last) / 864e5) : 0;
    const it = {
      id: slug.replace(/[^a-z0-9_-]/gi, '-').toLowerCase(),
      label: title,
      eyebrow: last ? `quiet ${days} days · last ${fmtDay(r.lastSeen)}` : 'quiet',
      text: what,
      sections: [{ label: 'Where it stopped', text: stopped }],
      link: { url: chatLink(slug), label: 'Open chat' },
      chat: slug,
    };
    if (r.icon) it.img = r.icon;
    group(chapter).items.push(it);
  }
  const gp = group('Stories with nothing on the canvas');
  for (const [id, title, note] of PADS) {
    const p = padBy[id] || {};
    const it = {
      id: 'pad-' + id.toLowerCase(),
      label: title,
      eyebrow: p.beats ? `${p.beats} beats` : 'no beats',
      text: 'A story pad the old Story Room migration left empty. Placing its pictures is your call, not a chat\'s.',
      sections: [{ label: 'Where it stopped', text: note }],
      link: { url: padLink(id), label: 'Open the story' },
    };
    if (p.cover) it.img = p.cover;
    gp.items.push(it);
  }
  group('Waiting on your Mac').items.push({
    id: 'desktop-queue',
    label: 'Seven desktop tasks',
    eyebrow: 'the desktop queue',
    text: 'Voice Memos full-disk access · four junk transcripts · the dream journal version-history screenshots · the ASC review-status scope · the derived-files check · the Wilco download · the newest Anthony Chene interview.',
    sections: [{ label: 'Where it stopped', text: 'Each one needs your Mac. Open docs/desktop-tasks.md there and run the queue.' }],
    link: { url: DESKTOP_DOC, label: 'See the queue' },
  });
  return { groups, missing };
}

async function main() {
  const args = process.argv.slice(2);
  const go = args.includes('--go');
  const supIdx = args.indexOf('--supersede');
  const supersede = supIdx >= 0 ? args[supIdx + 1] : '';
  const { groups, missing } = await build();
  const n = groups.reduce((a, g) => a + g.items.length, 0);
  console.log(`${groups.length} chapters, ${n} projects`);
  groups.forEach((g) => console.log(`  ${g.label}: ${g.items.length}`));
  if (missing.length) console.log('NOT IN THE REGISTRY (skipped):', missing.join(', '));
  const title = 'Forgotten projects — ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });
  const data = {
    groups,
    pace: 'labored',
    stamp: false,
    buttons: {
      yes: { label: 'Bring it back', icon: 'heart' },
      maybe: { label: 'Later', icon: 'maybe' },
      no: { label: 'Let it go', icon: 'x' },
    },
    help: 'Every project here has been quiet a week or more, the chat spoke last, and it left something open. '
      + 'Heart = bring it back, X = let it go, ? = later. A tap on the picture opens the chat. '
      + 'Chapters are the areas; the tools chapter is things you built and never opened.',
  };
  if (!go) { console.log('dry — pass --go to post'); return; }
  const ans = await req('POST', '/api/chatfeed/page', { chat: CHAT, session: SESSION, title, template: 'grid', data });
  console.log(JSON.stringify(ans, null, 1));
  if (supersede && ans && ans.ok) {
    const s = await req('POST', `/api/chatfeed/page/${supersede}/supersede`, { chat: CHAT, session: SESSION });
    console.log('superseded', supersede, JSON.stringify(s));
  }
}

module.exports = { build, CHATS, PADS };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
