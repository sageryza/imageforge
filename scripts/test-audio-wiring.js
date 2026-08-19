#!/usr/bin/env node
// test-audio-wiring.js — the audio rooms pointing at each other (Aug 2026).
// Pure + static, no network, no Firebase.
//
// What it pins, and why each one earned a test:
//   nextLineId       — a line handed into Blocks from outside (the Voice
//                      Studio) must mint an id the PAGE can never mint again.
//                      The page derives its next number from what it drew, so
//                      the server scans every place an id can live (`added`,
//                      `ttsUrls`, `order`) — an id minted from `added` alone
//                      would collide with a line living only in `order`, and
//                      the collision silently overwrites her line.
//   the hand-off markup — each wired button/entry exists in the page it was
//                      built into. A refactor that drops one leaves a room a
//                      dead end again with every test still green; this is
//                      the cheap tripwire.
//   page scripts parse — every touched page's inline script still parses.
//                      The injected autoscroll pill dies at PARSE time when a
//                      page script breaks (house gotcha), so a syntax slip
//                      here takes the pill down with it.
//
// Run: node scripts/test-audio-wiring.js

const fs = require('fs');
const path = require('path');
const blocks = require('../blocks');
const audioProject = require('../audioproject');

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass += 1; console.log(`  ok  ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ''}`); }
}
function eq(name, got, want) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}
const page = (name) => fs.readFileSync(path.join(__dirname, '..', 'public', name), 'utf8');

console.log('nextLineId');
{
  eq('a fresh doc starts at n0', blocks.nextLineId({}, {}, []), 'n0');
  eq('undefined maps are a fresh doc too', blocks.nextLineId(undefined, undefined, undefined), 'n0');
  eq('steps past added', blocks.nextLineId({ n0: 'a', n2: 'b' }, {}, []), 'n3');
  eq('steps past ttsUrls alone', blocks.nextLineId({}, { n5: 'u' }, []), 'n6');
  eq('steps past an id living only in order', blocks.nextLineId({}, {}, ['b00', 'n7', 'b01']), 'n8');
  eq('takes the max across all three', blocks.nextLineId({ n1: 'a' }, { n4: 'u' }, ['n2']), 'n5');
  eq('block ids are not line ids', blocks.nextLineId({}, {}, ['b00', 'b12']), 'n0');
}

console.log('the walk (buildIndex + walkFrom)');
{
  // The chain a real piece of work walks: a recording opened in Blocks, its
  // cut nudged in Cut Marks, that cut polished in the Cutting Room — plus a
  // Voice Studio render as an unrelated origin. Every join is a render url
  // becoming the next room's source url; that is the whole mechanism.
  const SRC = 'https://s/rec.m4a';
  const R1 = 'https://s/blocks-cut.mp3';
  const R2 = 'https://s/marks-cut.mp3';
  const R3 = 'https://s/polished.mp3';
  const V = 'https://s/voice-line.mp3';
  const idx = audioProject.buildIndex([
    { room: 'blocks', docId: 'b1', title: 'the talk', ins: [SRC], outs: [R1] },
    { room: 'cutmarks', docId: 'm1', title: 'the talk — cut', ins: [R1], outs: [R2] },
    { room: 'cutroom', docId: 'c1', title: 'the talk — cut', ins: [R2], outs: [R3] },
    { room: 'voice', docId: 'v1', title: 'a line', ins: [], outs: [V] },
  ]);

  const atSrc = audioProject.walkFrom(idx, SRC);
  eq('at the source: here is the blocks doc', atSrc.here.map((e) => e.docId), ['b1']);
  eq('at the source: nothing upstream', atSrc.up, []);
  eq('at the source: downstream walks the whole chain', atSrc.down.map((e) => e.docId), ['m1', 'c1']);

  const atR1 = audioProject.walkFrom(idx, R1);
  eq('mid-chain: here is the consumer', atR1.here.map((e) => e.docId), ['m1']);
  eq('mid-chain: up is the maker', atR1.up.map((e) => e.docId), ['b1']);
  eq('mid-chain: down continues through the consumer', atR1.down.map((e) => e.docId), ['c1']);

  const atEnd = audioProject.walkFrom(idx, R3);
  eq('at the finished cut: the whole chain is upstream, nearest first',
    atEnd.up.map((e) => e.docId), ['c1', 'm1', 'b1']);
  eq('at the finished cut: nothing downstream', atEnd.down, []);

  const atVoice = audioProject.walkFrom(idx, V);
  eq('a voice render knows its maker', atVoice.up.map((e) => e.room), ['voice']);
  eq('and is otherwise unconnected', [atVoice.here.length, atVoice.down.length], [0, 0]);
}

console.log('the hand-off markup');
{
  const cutmarks = page('cutmarks.html');
  ok('cut marks: has the hand-off entry (?url=)', /hand-off in: \/cutmarks\?url=/.test(cutmarks));
  ok('cut marks: hand-off strips the param once used', /history\.replaceState\(null, '', location\.pathname\)/.test(cutmarks));
  ok('cut marks: a render row sends on to the Cutting Room', /class="tool pol"/.test(cutmarks) && /\/cuttingroom\?url=/.test(cutmarks));
  ok('cut marks: video renders get no Cutting Room button', /doc\.kind !== 'video'\s*\n?\s*\? '<button class="tool pol"/.test(cutmarks.replace(/\n\s+/g, ' ')) || cutmarks.includes("doc.kind !== 'video'"));

  const editor = page('editor.html');
  ok('editor: a render row hands to Cut Marks', /data-cutmarks=/.test(editor) && /\/cutmarks\?url=/.test(editor));
  ok('editor: the Cutting Room button survived beside it', /data-cutroom=/.test(editor) && /\/cuttingroom\?url=/.test(editor));

  const blocksPage = page('blocks.html');
  ok('blocks: a render row hands to Cut Marks', /data-cm=/.test(blocksPage) && /\/cutmarks\?url=/.test(blocksPage));
  ok('blocks: a render row hands to the Cutting Room', /data-cr=/.test(blocksPage) && /\/cuttingroom\?url=/.test(blocksPage));

  const voice = page('voice.html');
  ok('voice: a finished render carries the Blocks button', /class="toblocks"/.test(voice));
  ok('voice: the button lands the line via /api/blocks/:id/line', /\/api\/blocks\/'\s*\+\s*pid\s*\+\s*'\/line/.test(voice.replace(/\n/g, ' ')) || voice.includes("'/api/blocks/'+pid+'/line'"));
}

console.log('the project threading');
{
  const cutmarks = page('cutmarks.html');
  ok('cut marks: hand-off entry passes the project in', /q\.get\('project'\)/.test(cutmarks));
  ok('cut marks: the Cutting Room hand-off carries it out', /doc\.project \? '&project='/.test(cutmarks));
  ok('cut marks: the walk strip exists', /id="lineage"/.test(cutmarks) && /audioproject\/walk/.test(cutmarks));

  const cutroom = page('cuttingroom.html');
  ok('cutting room: hand-off entry passes the project in', /hq\.get\('project'\)/.test(cutroom));
  ok('cutting room: the walk strip exists', /id="lineage"/.test(cutroom) && /audioproject\/walk/.test(cutroom));

  const blocksPage = page('blocks.html');
  ok('blocks: has its own ?url= hand-off entry', /hand-off in: \/blocks\?url=/.test(blocksPage));
  ok('blocks: render hand-offs carry the project', /projParam\(\)/.test(blocksPage));
  ok('blocks: the walk strip exists', /id="lineage"/.test(blocksPage) && /audioproject\/walk/.test(blocksPage));

  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  ok('server: /api/audioproject is mounted', /app\.use\('\/api\/audioproject'/.test(server));
}

console.log('page scripts parse');
{
  ['cutmarks.html', 'editor.html', 'blocks.html', 'voice.html'].forEach((name) => {
    const html = page(name);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    ok(`${name} has inline script`, scripts.length >= 1);
    scripts.forEach((src, i) => {
      let err = null;
      try { new Function(src); } catch (e) { err = e; }
      ok(`${name} script #${i} parses`, !err, err && err.message);
    });
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
