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
    ['ADHD & Autism','wkAeaIbOHrrs1lfyiY2G','nd-web'],
    ['General Dysphoria','RlRnbsyCDrWFvgfjMMSH','gd-mask-v2'],
    ['Two Questions, Not One','CHWhYZyH5eTR2DTRNyGx','gx-field'],
    ['Inside & Outside Thoughts','c4WWSdgGZwKawuj8AJ1e','cv-vehicle'],
  ]},
  { cat:'Meaning & art', items:[
    ['The Metaphor Machine','XIulCQGAkr2IaHW79e9z','mm-machine'],
    ['Where Do You Crop Art?','u10reFkKkeV7DDLfwcsG','na-process'],
    ['Art Is Forgiving','zUiF9vF3v31tM9EHiX5E','af-garage-v2'],
  ]},
  { cat:'Magic & belief', items:[
    ['Astrology','pfkJX461R7lKDZN9rsiT','zw-cast'],
    ['Instrumentalism, Part I','V9n5OdTOVz2TsslNhBuz','in-secretcode'],
    ['Animal Magic','gDIYNqnLaODjlnWs6gzp','an-snake'],
    ['OCD & Witchcraft','lLLfRpf29cdGbInr0dIV','oc-witchkit'],
    ['God Only Works in Mysterious Ways','Y8kNK5EkTN0AFHGW6bDr','gm-constellation'],
  ]},
  { cat:'Life & culture', items:[
    ['Synthetic Learning Syndrome','CKttNQvZyt8y54vWg2MA','sl-donut'],
    ['For the Hate of the Game','zLN3YvU4Ad2klIS0bjpK','ht-loft-v2'],
    ['What Do You Want to Wake Up To?','zBftSk1m7zjU6jTPccXC','md-bubble'],
  ]},
  { cat:'Stories', items:[
    ['Valued Customer','YtPdWSAiIUT2ttey17ME',''],
  ]},
];
// series: connected paths.  [title, compare-page id, tile image id]
const SERIES = [
  { cat:'How to Read People', steps:[
    ['I. Actions & Intentions','Z1Swmoud4qxBNgQmKu8y','hr-scatter'],
    ['II. The Pattern Collector','2kBUIEuBEZzzb43GSNIE','hr-safespace-v2'],
    ['III. Expert Mode','Aefj0WBAVygRyWXXXjIQ',''],
  ]},
  { cat:'Manifestation', steps:[
    ['My Experiment with Manifestation','TYSnJ3xHQImDCgrQ1hFh','mf-bed'],
    ['In Case You’re Curious (Part II)','vmdVVWn0tHMSmtjS1My6','c2-herbalist-v2'],
  ]},
];

function tile(t){ const [title,id,img]=t; const bg=tileBg(img);
  const art = img ? `<img src="${A}${img}.png" alt="" loading="lazy">` : `<div class="noimg">✦</div>`;
  return `<a class="tile" href="${PAGE}${id}"><div class="thumb" style="background:${bg}">${art}</div><div class="tl">${title}</div></a>`;
}
function pathStep(t,last){ const [title,id,img]=t; const bg=tileBg(img);
  const art = img ? `<img src="${A}${img}.png" alt="" loading="lazy">` : `<div class="noimg">✦</div>`;
  return `<a class="pnode" href="${PAGE}${id}"><div class="thumb" style="background:${bg}">${art}</div><div class="tl">${title}</div></a>`
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
</style>
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
