// gen-lessons.js — builds public/lessons.html, the "Lessons" hub.
// An Imprint-style map of every finished lesson/story: a 2-wide grid of
// rounded-square tiles (icon + title), grouped into sections, plus connected
// "series" rendered as a dashed-arrow path ("leads into each other"). Each tile
// opens its lesson full-screen (the lesson lives as a Compare page whose id is
// stable). Served at /lessons (server.js), wrapped by the iOS "Lessons" tile.
//
// To add/reorder lessons: edit SECTIONS / SERIES below and re-run:
//   node scripts/gen-lessons.js
// Content ships with a Render deploy — no app build needed.
const fs = require('fs');

const A = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-school/assets/';
const PAGE = 'https://imageforge-q125.onrender.com/api/chatfeed/page/';
const VO = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/lessons-voices/';

// Lessons Sophie has read aloud (voice memos matched by transcript overlap,
// July 2026). Keyed by the lesson's exact title. `file` lives under
// lessons-voices/ in this project's Storage (public); `memo` is the source
// recording's id in the voice-memo archive; `confidence` marks how sure the
// match is. Rendered as a ▶ chip on the tile, and emitted to
// public/lessons-voices.json for the shorts pipeline.
const VOICES = {
  'Animal Magic':                      { file:'animal-magic.m4a', memo:'2026-05-25_1314_2026-05-25T20_14_45Z.m4a', date:'2026-05-25', min:4,  confidence:'confirmed' },
  'OCD & Witchcraft':                  { file:'ocd-witchcraft.m4a', memo:'2026-05-24_2122_2026-05-25T04_22_03Z.m4a', date:'2026-05-25', min:4,  confidence:'confirmed' },
  'Art Is Forgiving':                  { file:'art-is-forgiving.m4a', memo:'2026-05-26_2055_2026-05-27T03_55_13Z.m4a', date:'2026-05-27', min:6,  confidence:'confirmed' },
  'For the Hate of the Game':          { file:'hate-of-the-game.m4a', memo:'2026-05-25_2030_2026-05-26T03_30_31Z.m4a', date:'2026-05-26', min:8,  confidence:'confirmed' },
  'My Experiment with Manifestation':  { file:'manifestation-experiment.m4a', memo:'2026-05-27_1958_2026-05-28T02_58_27Z.m4a', date:'2026-05-28', min:9,  confidence:'confirmed' },
  'Instrumentalism, Part I':           { file:'instrumentalism-1.m4a', memo:'2026-05-28_1354_2026-05-28T20_54_21Z.m4a', date:'2026-05-28', min:2,  confidence:'confirmed',
                                         alt:{ file:'instrumentalism-deep.m4a', memo:'2024-02-24_1439_2024-02-24T22_39_26Z.m4a', date:'2024-02-24', min:23, note:'the long deep-dive version' } },
  'ADHD & Autism':                     { file:'adhd-autism.m4a', memo:'2026-07-28_1602_2026-07-28T23_02_34Z.m4a', date:'2026-07-28', min:4,  confidence:'probable' },
  'God Only Works in Mysterious Ways': { file:'mysterious-ways.m4a', memo:'2026-05-27_2026_2026-05-28T03_26_02Z.m4a', date:'2026-05-28', min:5,  confidence:'probable' },
  'II. The Pattern Collector':         { file:'pattern-collector.m4a', memo:'2024-04-09_1315_2024-04-09T20_15_25Z.m4a', date:'2024-04-09', min:22, confidence:'tentative — reads more like the idea than a clean take' },
};

// SOURCE recordings — where a lesson came from, not a read-aloud of it.
// EMPTY BY DESIGN: nothing goes in here until Sophie has approved the match
// in her Compare tab. A candidate found by matching is a suggestion, not a
// fact, and filing one on her behalf is exactly the thing she asked not to
// happen. Add an entry only after she says yes to that specific lesson.
const SOURCES = {};

// Per-tile background = the sampled off-white of that image (from the card
// generator's bg sampling). Baked in so the page is fully self-contained.
const BG = {
  'nd-web':'#fcf8f2','gd-mask-v2':'#fdf9f4','gx-field':'#fbf6f0','cv-vehicle':'#fdfcfb',
  'mm-machine':'#fefbf7','af-garage-v2':'#fdf8f3','zw-cast':'#fdf9f3','in-secretcode':'#fdf9f4',
  'an-snake':'#fbf4ec','oc-witchkit':'#f9f1e6','gm-constellation':'#fdf8f3','sl-donut':'#fdf7f1',
  'ht-loft-v2':'#fcf9f4','md-bubble':'#ffffff','hr-scatter':'#fdf6ed','hr-safespace-v2':'#fef8ef',
  'mf-bed':'#fdfaf5','c2-herbalist-v2':'#fdf9f5'
};
const tileBg = (img) => (img && BG[img]) ? BG[img] : '#efe9df';

// sections: standalone grids.  [title, compare-page id, tile image id]
const SECTIONS = [
  { cat:'Understanding yourself', items:[
    ['ADHD & Autism','ByXo6x0LfW00489NDQdo','nd-web'],
    ['General Dysphoria','Q3xwGW2fiQsAVrzggPGZ','gd-mask-v2'],
    ['Two Questions, Not One','SC69qxFZx0RDiq6KwTKB','gx-field'],
    ['Inside & Outside Thoughts','9E7N0EeYW5jgt2x5G7mv','cv-vehicle'],
  ]},
  { cat:'Meaning & art', items:[
    ['The Metaphor Machine','YIDcvSj3JuwVBkrwMjVz','mm-machine'],
    ['Where Do You Crop Art?','UuJEyuuwSCLDa1TCiXls','na-process'],
    ['Art Is Forgiving','mNNXWmK9vhpwOU4uEjql','af-garage-v2'],
  ]},
  { cat:'Magic & belief', items:[
    ['Astrology','JySQT9LBXLcoT7QKvUVR','zw-cast'],
    ['Instrumentalism, Part I','3cPVrYrQU0Qm5zAcRGSz','in-secretcode'],
    ['Animal Magic','NXBSZmtfTFK9IfrweazO','an-snake'],
    ['OCD & Witchcraft','SoIPg25agA0UpiV1Lw4z','oc-witchkit'],
    ['God Only Works in Mysterious Ways','lP9vCQrnuMuUSIU35rw2','gm-constellation'],
  ]},
  { cat:'Life & culture', items:[
    ['Synthetic Learning Syndrome','9JzrwsuJLoKdGdn81VAd','sl-donut'],
    ['For the Hate of the Game','4R00zgEqu61ZGHkjPBWs','ht-loft-v2'],
    ['What Do You Want to Wake Up To?','LeMPACG1D5PiXf8VfMqZ','md-bubble'],
  ]},
  { cat:'Stories', items:[
    ['Valued Customer','PRu8pIG8ghQDMeMlgEWH',''],
  ]},
];
// series: connected paths.  [title, compare-page id, tile image id]
const SERIES = [
  { cat:'How to Read People', steps:[
    ['I. Actions & Intentions','VaRqHn91AQtVB3Qp4EZ1','hr-scatter'],
    ['II. The Pattern Collector','QWCJgo1gWDjiCv7ECWcv','hr-safespace-v2'],
    ['III. Expert Mode','G5FKnJySIONoAlYiumra',''],
  ]},
  { cat:'Manifestation', steps:[
    ['My Experiment with Manifestation','aOjLrh2UHjHxaNaIY6xU','mf-bed'],
    ['In Case You’re Curious (Part II)','XIiEZIBn24YPVZJl4Yth','c2-herbalist-v2'],
  ]},
];

// The ▶ chip: only on lessons with a matched recording. Tapping plays her
// read-aloud right on the hub without opening the lesson (one shared player).
function voiceChip(title){
  const v = VOICES[title]; if (!v) return '';
  return `<button class="vc" data-vo="${VO}${v.file}" onclick="return playVoice(event,this)">▶ her voice · ${v.min} min</button>`;
}
function tile(t){ const [title,id,img]=t; const bg=tileBg(img);
  const art = img ? `<img src="${A}${img}.png" alt="" loading="lazy">` : `<div class="noimg">✦</div>`;
  return `<a class="tile" href="${PAGE}${id}"><div class="thumb" style="background:${bg}">${art}</div><div class="tl">${title}</div>${voiceChip(title)}</a>`;
}
function pathStep(t,last){ const [title,id,img]=t; const bg=tileBg(img);
  const art = img ? `<img src="${A}${img}.png" alt="" loading="lazy">` : `<div class="noimg">✦</div>`;
  return `<a class="pnode" href="${PAGE}${id}"><div class="thumb" style="background:${bg}">${art}</div><div class="tl">${title}</div>${voiceChip(title)}</a>`
    + (last?'':'<div class="connector"><svg viewBox="0 0 40 24" width="34" height="20"><path d="M2 12 h28 M24 6 l7 6 -7 6" fill="none" stroke="#b98bc9" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 4"/></svg></div>');
}

const TITLE='The Lessons';
const HTML=`<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>${TITLE}</title>
<style>
  :root{ --ink:#2a2620; --ink2:#8a8377; --line:#e2dccd; --accent:#a5586a; --gold:#c99a3a; }
  *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html,body{ margin:0; background:#fdf9f3; color:var(--ink);
    font-family:Georgia,'Times New Roman',serif; -webkit-text-size-adjust:100%; }
  .wrap{ max-width:640px; margin:0 auto; padding:calc(18px + env(safe-area-inset-top)) 16px calc(40px + env(safe-area-inset-bottom)); }
  h1{ font-size:1.9em; font-weight:500; margin:0 0 2px; }
  .sub{ font-family:-apple-system,sans-serif; font-size:12.5px; color:var(--ink2); margin-bottom:20px; }
  h2{ font-family:-apple-system,'Helvetica Neue',sans-serif; font-size:11px; letter-spacing:.2em;
    text-transform:uppercase; color:var(--accent); margin:26px 0 12px; font-weight:700; }
  .grid{ display:grid; grid-template-columns:1fr 1fr; gap:16px 14px; }
  .tile,.pnode{ text-decoration:none; color:inherit; display:block; }
  .thumb{ aspect-ratio:1/1; border-radius:16px; border:1px solid var(--line);
    display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .thumb img{ width:82%; height:82%; object-fit:contain; }
  .noimg{ font-size:2em; color:var(--gold); }
  .tl{ font-size:.98em; line-height:1.2; margin:8px 2px 0; }
  /* connected series: horizontal scroll of nodes with dashed arrows */
  .path{ display:flex; align-items:flex-start; gap:6px; overflow-x:auto; padding-bottom:6px; }
  .pnode{ flex:0 0 40%; max-width:180px; }
  .connector{ flex:0 0 auto; align-self:center; padding-top:6px; display:flex; align-items:center; }
  .seriestag{ font-family:-apple-system,sans-serif; font-size:10.5px; color:var(--ink2);
    margin:0 0 8px; font-style:normal; }
  .vc{ font-family:-apple-system,sans-serif; font-size:11px; color:var(--ink);
    border:1px solid var(--line); border-radius:6px; background:#fff;
    padding:4px 8px; margin:6px 2px 0; display:inline-block; }
  .vc.playing{ background:var(--accent); border-color:var(--accent); color:#fff; }
</style>
<script>
var _vo=null,_voBtn=null;
function playVoice(e,btn){
  e.preventDefault(); e.stopPropagation();
  if(_voBtn===btn && _vo && !_vo.paused){ _vo.pause(); btn.classList.remove('playing'); btn.textContent=btn.textContent.replace('❚❚','▶'); return false; }
  if(_vo){ _vo.pause(); if(_voBtn){ _voBtn.classList.remove('playing'); _voBtn.textContent=_voBtn.textContent.replace('❚❚','▶'); } }
  _vo=new Audio(btn.getAttribute('data-vo')); _voBtn=btn;
  _vo.onended=function(){ btn.classList.remove('playing'); btn.textContent=btn.textContent.replace('❚❚','▶'); };
  _vo.play(); btn.classList.add('playing'); btn.textContent=btn.textContent.replace('▶','❚❚');
  return false;
}
</script>
<div class="wrap">
  <h1>${TITLE}</h1>
  <div class="sub">Tap a tile to open the lesson. Connected lessons lead into each other &rsaquo;</div>
  ${SECTIONS.map(s=>`<h2>${s.cat}</h2><div class="grid">${s.items.map(tile).join('')}</div>`).join('')}
  ${SERIES.map(s=>`<h2>${s.cat}</h2><div class="seriestag">a series — start at the left</div><div class="path">${s.steps.map((st,i)=>pathStep(st,i===s.steps.length-1)).join('')}</div>`).join('')}
</div>
</html>`;

fs.writeFileSync(__dirname + '/../public/lessons.html', HTML);
const lessons = SECTIONS.reduce((n,s)=>n+s.items.length,0) + SERIES.reduce((n,s)=>n+s.steps.length,0);
console.log('wrote public/lessons.html —', lessons, 'lessons across', SECTIONS.length+SERIES.length, 'groups,', HTML.length, 'bytes');

// Machine manifest for the shorts pipeline: every lesson, its page, and its
// matched voice recording (when one exists). Served at /lessons-voices.json.
const allLessons = [
  ...SECTIONS.flatMap(s=>s.items.map(t=>({group:s.cat, t}))),
  ...SERIES.flatMap(s=>s.steps.map(t=>({group:s.cat+' (series)', t}))),
];
const voicesOut = allLessons.map(({group, t})=>{
  const [title,id,img]=t; const v=VOICES[title]; const s=SOURCES[title];
  return { title, group, page: PAGE+id, tileArt: img ? A+img+'.png' : null,
    voice: v ? { url: VO+v.file, sourceMemo: v.memo, recorded: v.date, minutes: v.min, confidence: v.confidence,
                 alt: v.alt ? { url: VO+v.alt.file, sourceMemo: v.alt.memo, recorded: v.alt.date, minutes: v.alt.min, note: v.alt.note } : undefined } : null,
    source: s ? { url: VO+s.file, recorded: s.date, minutes: s.min, note: s.note,
                  kind: 'her thinking the lesson up out loud — not a read-aloud of the written lesson' } : null };
});
fs.writeFileSync(__dirname + '/../public/lessons-voices.json', JSON.stringify({ updated: new Date().toISOString().slice(0,10), lessons: voicesOut }, null, 1));
console.log('wrote public/lessons-voices.json —', voicesOut.filter(l=>l.voice).length, 'of', voicesOut.length, 'lessons have a voice');
