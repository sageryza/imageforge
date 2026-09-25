#!/usr/bin/env node
// projects-mockup.js — PROJECTS AS ICONS, a Compare-page mockup (2026-09-25,
// Sophie: "we shud organize my projects as icons · ex the triangles project -
// they are clogging up my playground history · the animal fruit poster bed
// spread pattern maker would be nice to have in one spot" → "i want you to
// file · propose projects · make a mockup · icons like apple home screen ·
// four per row").
//
// Reads the LIVE registry (the one feed read chats.html already takes) and
// files every live chat into a proposed project by a keyword table below,
// then draws the projects as an iPhone home screen — four icons a row, each
// icon the pastel chat drawing of the project's newest chat, the name under
// it, a badge with how many chats are in it. A tap opens what is filed there
// (the chats, newest first, and how many Playground pictures match).
//
// Nothing is written anywhere: it is a page. `--go` posts it (and
// `--supersede <id>` retires the old version in the same call); without
// `--go` it writes docs/projects/projects-mockup.html and stops.
//
// The Playground counts come from GET /api/promptlab?q= (a prompt-text
// search), so they are only shown where the word is unambiguous — "dream"
// and "evan" are style names and would count every Dreamy picture.
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'project-icons-organization';
const SHEET = 'projects-mockup-v1';
const BRIEF_SHEET = 'projects-brief';   // her edits to a brief live here, <id>.goal · .done · .stuck · .fix
const BRIEFS = require('../docs/projects/briefs.json');
const args = process.argv.slice(2);
const GO = args.includes('--go');
const SUP = args.includes('--supersede') ? args[args.indexOf('--supersede') + 1] : '';

// name · the words that file a chat here (matched over slug + display name +
// filed project, lowercase) · the chat whose icon the project wears · the
// Playground search word (or none).
const PROJECTS = [
  // "see my mail moon movie" (2026-09-25) — her I-caught-the-moon film, one
  // chat with no drawn icon yet, so the icon is the film's own last frame
  // (Atlas files it) cropped to the moon in the window pane, in the Dump
  // under `projects-mockup`.
  { name: 'Caught the moon', kw: ['moon-panes', 'moon-pane', 'caught-the-moon', 'moon-in-my-pocket'], icon: 'moon-panes-zoom-video',
    img: 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/drops/_/168b446f4a27558a97ed00831585489e.png', crop: 'photo' },
  // Her worked example of a brief (2026-09-25): "legal posters were having
  // trouble getting spacing right … the spacer thing was too complicated".
  { name: 'Posters', kw: ['poster', 'posters', 'physical-posters'], icon: 'minimal-animal-fruit-posters', live: ['/etsy'] },
  { name: 'Similitude', kw: ['triset', 'triangle', 'triangles', 'similitude', 'dominoes', 'peacock-set'], icon: 'peacock-set-placement', pl: 'triangle', live: ['/similitude', '/dominoes'] },
  { name: 'Pattern maker', kw: ['animal-fruit', 'fruit-veg', 'animal-deck', 'fruits-vegetables', 'animal-card', 'fruit-repeating', 'repeating-patterns', 'seamless', 'wallpaper', 'patterns-google', 'animal-fruit-pattern'], icon: 'animal-fruit-pattern-tool', pl: 'animal' },
  { name: 'Ward film', kw: ['hospital', 'ward', 'francesca', 'soap-pill', 'belt', 'reshoots', 'reshoot', 'seedance', 'continuity', 'anastasia'], icon: 'hospital-night-reshoots', pl: 'hospital' },
  { name: 'Nautchaug', kw: ['nautch'], icon: 'new-script-draft' },
  { name: 'Ticky Tack', kw: ['ticky'], icon: 'ticky-tack-film-page-dupe' },
  { name: 'Christmas', kw: ['christmas', 'saturnalia'], icon: 'christmas-scripts-saturnalia', pl: 'christmas' },
  { name: 'Witch', kw: ['witch', 'witchcraft', 'secretly', 'tarot', 'blog', 'spell', 'miracle', 'astrology', 'horoscope'], icon: 'witch-reels-final', pl: 'witch', live: ['/witch', '/blog'] },
  { name: 'Dreams', kw: ['dream', 'dreams', 'dreamfeed', 'dreamy'], icon: 'dream-feed-monkey-compare', live: ['/dreamfeed'] },
  { name: 'Dating book', kw: ['dating', 'date-moments', 'date-illustration', 'sophie-experiment', 'date-card'], icon: 'dating-book-design', live: ['/writing'] },
  { name: 'Xi', kw: ['xi'], icon: 'xi-chsts-meta-prompt' },
  { name: 'Evan', kw: ['evan'], icon: 'evan-film-collected' },
  { name: 'NDE', kw: ['nde', 'chene', 'near-death'], icon: 'anthony-chene-nde-pipeline' },
  { name: 'Stories', kw: ['moon-milk', 'moon milk', 'jonas', 'charlie', 'wormsicle', 'meteorite', 'own-destiny', 'soul-leaves'], icon: 'moon-milk-meta', live: ['/storyroom'] },
  { name: "Mom's Etsy", kw: ['jewelry', 'crystal', 'crystals', 'lightroom'], icon: 'jewelry-upload-website', live: ['/jewelry', '/lightroom', '/crystalsplit'] },
  { name: 'Hats', kw: ['hat-store', 'hats', 'hat'], icon: 'hat-store-friend', pl: 'hat', live: ['/hats'] },
  { name: 'Head Games', kw: ['mental-games', 'head-games', 'headgames'], icon: 'mental-games-instrumental-beliefs' },
  { name: 'Hoonies', kw: ['hoonie', 'hoonies'], icon: 'chat-decision-toggle-hoonies' },
  { name: 'PWC reels', kw: ['pwc'], icon: 'pwc-reels-update-page' },
  { name: 'Fruit poll', kw: ['favorite-fruit', 'fruit-chart', 'fruit-poll'], icon: 'favorite-fruit-chart', live: ['/fruit', '/fruitchart'] },
  { name: 'Opinions', kw: ['opinion', 'opinions'], icon: 'opinions-app-commercial', live: ['/opinions'] },
];

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, (r) => { let b = ''; r.on('data', (c) => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej);
  });
}
function post(url, body) {
  return new Promise((res, rej) => {
    const u = new URL(url); const data = JSON.stringify(body);
    const q = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (r) => { let b = ''; r.on('data', (c) => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { res({ raw: b }); } }); });
    q.on('error', rej); q.end(data);
  });
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// One rule for which project a chat is in: the FIRST project in the table
// whose word appears — so a "triangle-playground-style" chat is Similitude,
// never Playground (a tool is not a project here).
function fileChat(slug, reg) {
  const t = (slug + ' ' + (reg.displayName || '') + ' ' + (reg.project || '')).toLowerCase();
  // WHOLE WORDS ONLY — measured on the first cut: "hats" filed every "chats"
  // chat, "nde" every "render" and "calendar", "ward" every "forward".
  const has = (k) => new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(t);
  for (const p of PROJECTS) if (p.kw.some(has)) return p;
  return null;
}

async function main() {
  const feed = await get(BASE + '/api/chatfeed?limit=1');
  const chats = feed.chats || {};
  const filed = new Map(PROJECTS.map((p) => [p.name, []]));
  Object.keys(chats).forEach((slug) => {
    const reg = chats[slug];
    if (reg.deletedAt || reg.movedTo) return;
    const p = fileChat(slug, reg);
    if (p) filed.get(p.name).push({ slug, name: reg.displayName || slug.replace(/-/g, ' '), at: (reg.lastSeen || reg.startedAt || '').slice(0, 10), icon: reg.icon || '', archived: !!reg.archived });
  });
  const pics = {};
  for (const p of PROJECTS) {
    if (!p.pl) continue;
    const r = await get(BASE + '/api/promptlab?q=' + encodeURIComponent(p.pl) + '&limit=1');
    pics[p.name] = r.matched || 0;
  }
  // The project's live Compare pages — every chat's un-superseded pages, newest
  // first. One read per chat; a project with thirty chats is thirty reads.
  const pagesOf = async (list) => {
    const out = [];
    for (const c of list) {
      const r = await get(BASE + '/api/chatfeed/pages?chat=' + encodeURIComponent(c.slug)).catch(() => ({}));
      (r.pages || []).filter((pg) => !pg.superseded).forEach((pg) => out.push({ title: pg.title, url: BASE + '/api/chatfeed/page/' + pg.id, at: pg.at || pg.createdAt || c.at }));
    }
    return out.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 6);
  };
  const rows = [];
  for (const p of PROJECTS) {
    const list = filed.get(p.name).sort((a, b) => b.at.localeCompare(a.at));
    const pages = await pagesOf(list);
    const links = (p.live || []).map((u) => ({ title: u, url: BASE + u }))
      .concat(list.map((c) => chats[c.slug].pinned).filter((x) => x && x.kind !== 'video' && x.url).map((x) => ({ title: x.title, url: x.url })))
      .concat(pages);
    const seen = {}; const uniq = links.filter((l) => !seen[l.url] && (seen[l.url] = 1));
    const films = list.map((c) => chats[c.slug].pinned).filter((x) => x && x.kind === 'video');
    const iconReg = chats[p.icon];
    rows.push({ ...p, chats: list, icon: p.img || (iconReg && iconReg.icon) || (list.find((c) => c.icon) || {}).icon || '', pics: pics[p.name] || 0, films, links: uniq, brief: BRIEFS[p.name] || {} });
  }
  const id = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const tiles = rows.map((p) => `
    <figure class="app" data-item="${id(p.name)}" data-p="${id(p.name)}">
      <span class="ic"><i class="in"><img src="${esc(p.icon)}" alt="${esc(p.name)}"${p.crop ? ' class="photo"' : ''}></i>${p.chats.length ? `<b class="badge">${p.chats.length}</b>` : ''}</span>
      <figcaption>${esc(p.name)}</figcaption>
    </figure>`).join('');
  const sheets = rows.map((p) => `
    <section class="sheet" id="s-${id(p.name)}" hidden>
      <h2>${esc(p.name)}</h2>
      <div class="brief">${['goal', 'done', 'stuck', 'fix'].map((k) => `<div class="bl" data-k="${k}"><b>${{ goal: 'Where it is going', done: 'Finished when', stuck: 'Where it ran out of steam', fix: 'Ways back in' }[k]}</b><p data-k="${k}">${esc(p.brief[k] || '')}</p></div>`).join('')}</div>
      ${p.links.length ? `<div class="links">${p.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a>`).join('')}</div>` : ''}
      <div class="mini">${p.chats.length} chat${p.chats.length === 1 ? '' : 's'}${p.pics ? ` · ${p.pics} Playground picture${p.pics === 1 ? '' : 's'}` : ''}</div>
      ${p.films.map((f) => `<div class="film" data-url="${esc(f.url)}" data-label="${esc(f.title)}"></div>`).join('')}
      <ul>${p.chats.map((c) => `<li data-slug="${esc(c.slug)}">${c.icon ? `<img src="${esc(c.icon)}" alt="">` : '<i></i>'}<span>${esc(c.name)}${c.archived ? ' <em>archived</em>' : ''}</span><time>${esc(c.at)}</time></li>`).join('')}</ul>
    </section>`).join('');
  const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'projects', 'projects-mockup.tpl.html'), 'utf8')
    .replace('{{TILES}}', tiles).replace('{{SHEETS}}', sheets)
    .replace(/\{\{CHAT\}\}/g, CHAT).replace(/\{\{SHEET\}\}/g, SHEET).replace(/\{\{BRIEF_SHEET\}\}/g, BRIEF_SHEET);
  const out = path.join(__dirname, '..', 'docs', 'projects', 'projects-mockup.html');
  fs.writeFileSync(out, html);
  const summary = rows.map((p) => `${p.name}: ${p.chats.length} chats${p.pics ? ', ' + p.pics + ' pictures' : ''}`).join('\n');
  console.log(summary);
  console.log('wrote', out);
  if (!GO) return;
  const r = await post(BASE + '/api/chatfeed/page', { chat: CHAT, title: 'Projects — home screen mockup v5, with briefs', html });
  console.log('posted', JSON.stringify(r));
  if (SUP && r.id) console.log('superseded', JSON.stringify(await post(BASE + '/api/chatfeed/page/' + SUP + '/supersede', {})));
}
module.exports = { PROJECTS, fileChat };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
