#!/usr/bin/env node
// THE WORK LINE — v3 of the work log, as a COMPARE PAGE (2026-09-02, Sophie:
// "we don't need it on render · keep it as a compare page so it never
// requires deploys · v3: one single line, overlapping lumps · start w 20").
//
// ONE horizontal band, days running left to right, and every project's lumps
// laid over each other on it in that project's own colour, translucent, so an
// overlap shows both. A lump is one stretch of days the project was worked on
// (workday.js `runsOf`), its thickness on each day sqrt of how much was said.
// The project's name is written inside a lump wide enough to hold it; a tap on
// any lump opens the chats inside that stretch, each a link. The TOP 20
// projects by chat count (project-words.js, a chat's first project) are on
// the line; everything else is one grey band underneath.
//
// A posted page is FROZEN, so this is a snapshot — re-run to re-post a fresh
// one, which supersedes the last. No deploy, ever. It reads the registry off
// the live API and the feed's dates through the Deck Factory service account
// (FIREBASE_SERVICE_ACCOUNT), so it runs from any container.
//
//   node scripts/worklog-line.js                 # writes the html, posts nothing
//   node scripts/worklog-line.js --post          # posts it into this chat's Compare tab
//   node scripts/worklog-line.js --top 30        # how many projects get a colour
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const admin = require('firebase-admin');
const WD = require('../workday.js');
const PW = require('../project-words.js');
const { worklogRows } = require('../chatfeed.js');

const args = process.argv.slice(2);
const POST = args.includes('--post');
const TOP = (() => { const i = args.indexOf('--top'); return i >= 0 ? +args[i + 1] || 20 : 20; })();
const OUT = (() => { const i = args.indexOf('--out'); return i >= 0 ? args[i + 1] : path.join(__dirname, '..', 'docs', 'worklog', 'work-line.html'); })();
const CHAT = process.env.FORGE_CHAT || 'work-timeline-chronological';
const SESSION = String(process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, '');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const SUPERSEDE = (() => { const i = args.indexOf('--supersede'); return i >= 0 ? args[i + 1] : ''; })();
// v4 (2026-09-02, Sophie: "spread out much longer timeline w auto scroll three
// speeds"): --px widens a day (14 is the compact line, 40 the long one) and
// --auto adds the sideways autoscroll with its three-way speed toggle.
// v5 ("add in things like specific movies: ant, language, time, moon milk ·
// nyt puzzle website"): --named <json> adds the projects the slug rule cannot
// see, each its own lane, its chats pulled out of wherever the rule put them.
const PX = (() => { const i = args.indexOf('--px'); return i >= 0 ? +args[i + 1] || 14 : 14; })();
const AUTO = args.includes('--auto');
const NAMED = (() => { const i = args.indexOf('--named'); if (i < 0) return null; const f = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : path.join(__dirname, '..', 'docs', 'worklog', 'named-projects.json'); const j = JSON.parse(fs.readFileSync(f, 'utf8')); delete j._; return j; })();
const VER = (() => { const i = args.indexOf('--ver'); return i >= 0 ? args[i + 1] : (NAMED ? 'v5, named projects' : AUTO ? 'v4, the long line' : 'v3, one line'); })();

const PAD = 64, BAND = 210, GREYH = 44, AXIS = 30;
// Flat, distinct on cream, no gradients. Translucent on the line so overlaps
// show both — the multiply blend keeps them readable on the paper.
const PALETTE = ['#c85a54', '#d98a3a', '#b9962a', '#6f9a3c', '#3d8f7a', '#3f86b8', '#6b6fc4', '#9a5fb5', '#c4629a', '#8a6f4e',
  '#5a7d8c', '#b4472f', '#4f9d69', '#a07a2a', '#2f7f9e', '#7f5f9e', '#c07040', '#5f8f3f', '#a04f7f', '#6a8f8f',
  '#8c5a3c', '#3c7a5a', '#7a3c5a', '#5a3c7a', '#3c5a7a'];
const GREY = '#9a948a';

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => { let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } }); }).on('error', reject);
  });
}
function post(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = Buffer.from(JSON.stringify(body));
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': data.length } }, (r) => {
      let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { resolve({ raw: b }); } });
    });
    req.on('error', reject); req.write(data); req.end();
  });
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
function nameOf(r) {
  if (r.name) return r.name;
  const s = String(r.chat || '').replace(/-[0-9a-z]{6}$/, '').replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---- the data ------------------------------------------------------------
async function activeDays() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT (Deck Factory) is not set');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  const snap = await admin.firestore().collection('forge-chat-feed').select('chat', 'created').get();
  const days = {};
  snap.docs.forEach((d) => {
    const v = d.data() || {};
    if (!v.chat || !v.created) return;
    const k = WD.dayKey(v.created); if (!k) return;
    (days[v.chat] = days[v.chat] || {})[k] = (days[v.chat][k] || 0) + 1;
  });
  return days;
}
function build(chats, days, top) {
  const rows = worklogRows(chats).filter((r) => days[r.chat]);
  const v = PW.vocab(chats);
  const by = {};
  rows.forEach((r) => {
    r.days = days[r.chat];
    const ps = PW.projectsWithGroups(r.chat, chats, v);
    const k = ps.length ? ps[0].key : '';
    if (!by[k]) by[k] = { key: k, label: k ? cap((v[k] && v[k].spell) || k) : '', chats: [], days: {} };
    by[k].chats.push(r);
    Object.keys(r.days).forEach((d) => { by[k].days[d] = (by[k].days[d] || 0) + r.days[d]; });
  });
  // Named projects (v5): pulled out of whatever lane the word rule put them
  // in — a chat is in ONE lane — and always on the line, ahead of the count.
  const named = [];
  if (NAMED) {
    Object.keys(NAMED).forEach((label) => {
      const slugs = NAMED[label];
      const p = { key: 'named:' + label, label, chats: [], days: {}, named: true };
      slugs.forEach((slug) => {
        Object.values(by).forEach((lane) => {
          const i = lane.chats.findIndex((r) => r.chat === slug);
          if (i < 0) return;
          const r = lane.chats.splice(i, 1)[0];
          Object.keys(r.days).forEach((d) => { lane.days[d] -= r.days[d]; if (lane.days[d] <= 0) delete lane.days[d]; });
          p.chats.push(r);
          Object.keys(r.days).forEach((d) => { p.days[d] = (p.days[d] || 0) + r.days[d]; });
        });
      });
      if (p.chats.length) named.push(p); else console.warn('named project with no chats on file:', label, slugs.join(','));
    });
  }
  const all = Object.values(by).filter((p) => p.key && p.chats.length).sort((a, b) => b.chats.length - a.chats.length || a.key.localeCompare(b.key));
  const lanes = named.concat(all.slice(0, top));
  // …ordered by when each began, so the colours read left to right
  lanes.forEach((p) => { p.first = Object.keys(p.days).sort()[0]; p.chats.sort((a, b) => (Object.keys(a.days).sort()[0] < Object.keys(b.days).sort()[0] ? -1 : 1)); });
  lanes.sort((a, b) => (a.first < b.first ? -1 : a.first > b.first ? 1 : 0));
  lanes.forEach((p, i) => { p.color = PALETTE[i % PALETTE.length]; });
  const rest = { key: '', label: 'Everything else', color: GREY, chats: [], days: {} };
  all.slice(top).concat(by[''] ? [by['']] : []).forEach((p) => {
    p.chats.forEach((r) => rest.chats.push(r));
    Object.keys(p.days).forEach((d) => { rest.days[d] = (rest.days[d] || 0) + p.days[d]; });
  });
  rest.chats.sort((a, b) => (Object.keys(a.days).sort()[0] < Object.keys(b.days).sort()[0] ? -1 : 1));
  let x0 = '';
  rows.forEach((r) => { const f = Object.keys(r.days).sort()[0]; if (f && (!x0 || f < x0)) x0 = f; });
  const today = WD.today();
  const ndays = WD.daysBetween(x0, today) + 1;
  return { lanes, rest, x0, today, ndays, chatsOn: rows.length };
}

// ---- drawing ---------------------------------------------------------------
function smooth(pts) {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}
// A lump over a run: half-thickness per day grows with sqrt(messages), capped
// so the fattest day still sits inside the band; rounded caps either end.
function lump(run, days, x0, mid, capH, base, gain) {
  const top = [], bot = [];
  for (let d = run.from; ; d = WD.addDays(d, 1)) {
    const i = WD.daysBetween(x0, d), n = days[d] || 0;
    const h = n ? Math.min(capH, base + gain * Math.sqrt(n)) : Math.max(2, base * 0.6);
    const x = (i + 0.5) * PX;
    top.push([x, mid - h]); bot.push([x, mid + h]);
    if (d === run.to) break;
  }
  const l = top[0][0] - PX * 0.48, r = top[top.length - 1][0] + PX * 0.48;
  const f = top[0], g = top[top.length - 1], fb = bot[0], gb = bot[bot.length - 1];
  const P = (n) => n.toFixed(1);
  return `M${P(l)} ${P(mid)}C${P(l)} ${P(f[1])} ${P(f[0])} ${P(f[1])} ${P(f[0])} ${P(f[1])}${smooth(top)}`
    + `C${P(r)} ${P(g[1])} ${P(r)} ${P(gb[1])} ${P(r)} ${P(mid)}C${P(r)} ${P(gb[1])} ${P(gb[0])} ${P(gb[1])} ${P(gb[0])} ${P(gb[1])}${smooth(bot.slice().reverse())}`
    + `C${P(l)} ${P(fb[1])} ${P(l)} ${P(fb[1])} ${P(l)} ${P(mid)}Z`;
}
function html(D) {
  const W = D.ndays * PX + PAD;
  const H = AXIS + BAND + 8 + GREYH;
  const bandMid = AXIS + BAND / 2;
  let svg = `<svg class="line" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  // axis: month names, a number every 7 days, week lines down the band
  for (let i = 0; i < D.ndays; i++) {
    const d = WD.addDays(D.x0, i), x = i * PX;
    if (d.slice(8) === '01' || i === 0) svg += `<text class="mo" x="${x + 2}" y="12">${esc(WD.monthShort(d).toUpperCase())}</text>`;
    if (i % 7 === 0) {
      svg += `<text class="dn" x="${x + PX / 2}" y="26" text-anchor="middle">${+d.slice(8)}</text>`;
      svg += `<line class="wk" x1="${x}" y1="${AXIS}" x2="${x}" y2="${H}"/>`;
    } else if (PX >= 28) {
      // spread out, every day earns a number and a hairline
      svg += `<text class="dn dd" x="${x + PX / 2}" y="26" text-anchor="middle">${+d.slice(8)}</text>`;
      svg += `<line class="wk dd" x1="${x}" y1="${AXIS}" x2="${x}" y2="${AXIS + 6}"/>`;
    }
  }
  svg += `<line class="mid" x1="0" y1="${bandMid}" x2="${D.ndays * PX}" y2="${bandMid}"/>`;
  svg += `<line class="now" x1="${(D.ndays - 0.5) * PX}" y1="${AXIS}" x2="${(D.ndays - 0.5) * PX}" y2="${H}"/>`;
  // ONE LINE: every project's lumps over each other on the band. A small
  // per-project offset off the midline (three rungs) keeps two projects that
  // ran together from landing dead on top of each other, while it all still
  // reads as one line.
  const rungs = [0, -22, 22, -44, 44];
  const items = [];
  D.lanes.forEach((p, li) => {
    const mid = bandMid + rungs[li % rungs.length];
    WD.runsOf(Object.keys(p.days)).forEach((run) => {
      const id = items.length;
      items.push({ id, lane: li, run });
      svg += `<path class="lump" data-i="${id}" fill="${p.color}" d="${lump(run, p.days, D.x0, mid, BAND / 2 - 10, 5, 4.2)}"><title>${esc(p.label)} · ${esc(WD.shortDay(run.from))}${run.to !== run.from ? ' → ' + esc(WD.shortDay(run.to)) : ''}</title></path>`;
    });
  });
  // …names inside the lumps wide enough to hold them, drawn after every
  // lump so no later blob covers a word — and NEVER over another name
  // (PHOTO'd: "PDrgamound", two projects on one rung the same week). A word
  // that would land on a word already placed is left off; the key row and the
  // tap still say which lump it is. Widest runs claim their spot first.
  const placed = [];
  const wants = [];
  D.lanes.forEach((p, li) => {
    const mid = bandMid + rungs[li % rungs.length];
    WD.runsOf(Object.keys(p.days)).forEach((run) => {
      const wdays = WD.daysBetween(run.from, run.to) + 1;
      const w = wdays * PX, tw = p.label.length * 6.6 + 10;
      if (w < tw) return;
      const x = (WD.daysBetween(D.x0, run.from) + wdays / 2) * PX;
      wants.push({ x, y: mid, w: tw, label: p.label, wdays });
    });
  });
  wants.sort((a, b) => b.wdays - a.wdays).forEach((t) => {
    const box = { x1: t.x - t.w / 2, x2: t.x + t.w / 2, y1: t.y - 8, y2: t.y + 8 };
    if (placed.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1)) return;
    placed.push(box);
    svg += `<text class="nm" x="${t.x.toFixed(1)}" y="${t.y + 4}" text-anchor="middle">${esc(t.label)}</text>`;
  });
  // everything else, grey, underneath
  const gmid = AXIS + BAND + 8 + GREYH / 2;
  WD.runsOf(Object.keys(D.rest.days)).forEach((run) => {
    const id = items.length;
    items.push({ id, lane: -1, run });
    svg += `<path class="lump grey" data-i="${id}" fill="${GREY}" d="${lump(run, D.rest.days, D.x0, gmid, GREYH / 2 - 3, 2.5, 1.6)}"><title>Everything else · ${esc(WD.shortDay(run.from))}${run.to !== run.from ? ' → ' + esc(WD.shortDay(run.to)) : ''}</title></path>`;
  });
  svg += `<text class="gl" x="6" y="${gmid + 4}">everything else</text>`;
  svg += '</svg>';

  // what a tap needs: per item, the chats active inside that run
  const data = {
    lanes: D.lanes.map((p) => ({ label: p.label, color: p.color, n: p.chats.length })),
    rest: { label: 'Everything else', color: GREY, n: D.rest.chats.length },
    items: items.map((it) => {
      const p = it.lane >= 0 ? D.lanes[it.lane] : D.rest;
      const inRun = p.chats.filter((r) => Object.keys(r.days).some((d) => d >= it.run.from && d <= it.run.to));
      return { lane: it.lane, from: it.run.from, to: it.run.to, days: it.run.days.length,
        chats: inRun.map((r) => ({ chat: r.chat, name: nameOf(r), line: r.line || '', hers: !!r.hers })) };
    }),
    key: D.lanes.map((p) => `${p.label}`),
  };

  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>The work line</title>
<link rel="stylesheet" href="/compare.css">
${AUTO ? '<link rel="stylesheet" href="/tritoggle.css">' : ''}
<style>
  .line .dn.dd{ fill:var(--line2, #c9c2b6); }
  /* the sideways autoscroll: play/pause, and the house three-way toggle for
     the speed (never a cycle — a tap lands on the stop under it) */
  .auto{ display:flex; align-items:center; gap:12px; margin:8px 0 0; }
  .auto .play{ width:34px; height:34px; border-radius:6px; border:1px solid var(--ink); background:transparent; color:var(--ink);
    display:inline-flex; align-items:center; justify-content:center; padding:0; cursor:pointer; -webkit-tap-highlight-color:transparent; }
  .auto .play svg{ width:16px; height:16px; }
  .auto .tri{ --tri-track:#efe9dd; --tri-line:var(--ink); --tri-fill:transparent; --tri-knob:var(--ink); --tri-ink:var(--paper); --tri-w:78px; --tri-k:22px; }
  .auto .spd{ font-size:12px; color:var(--ink2); letter-spacing:.04em; text-transform:uppercase; }
  .board{ overflow-x:auto; -webkit-overflow-scrolling:touch; margin:6px -14px 0; padding:0 0 4px 14px; }
  .line{ display:block; }
  .line .mo{ font:600 11px/1 -apple-system,system-ui,sans-serif; letter-spacing:2px; fill:var(--ink); }
  .line .dn{ font:10px/1 -apple-system,system-ui,sans-serif; fill:var(--ink2); }
  .line .wk{ stroke:var(--line); stroke-width:1; }
  .line .mid{ stroke:var(--line); stroke-width:1; stroke-dasharray:2 4; }
  .line .now{ stroke:var(--chg); stroke-width:2; }
  .line .lump{ fill-opacity:.62; mix-blend-mode:multiply; cursor:pointer; }
  .line .lump.on{ fill-opacity:.95; }
  .line .lump.grey{ fill-opacity:.38; }
  .line .gl{ font:600 10px/1 -apple-system,system-ui,sans-serif; letter-spacing:1px; fill:var(--ink2); pointer-events:none; }
  .line .nm{ font:600 11px/1 -apple-system,system-ui,sans-serif; fill:var(--ink); pointer-events:none; }
  .key{ display:flex; flex-wrap:wrap; gap:4px 12px; margin:10px 0 0; font-size:12px; color:var(--ink2); }
  .key span{ display:inline-flex; align-items:center; gap:5px; }
  .key i{ width:10px; height:10px; border-radius:50%; display:inline-block; }
  .open{ margin-top:12px; }
  .open h3{ font-size:16px; display:flex; align-items:center; gap:8px; }
  .open h3 i{ width:12px; height:12px; border-radius:50%; display:inline-block; }
  .open .when{ font-size:12px; color:var(--ink2); margin:2px 0 8px; }
  .open a{ display:block; text-decoration:none; color:var(--ink); background:var(--paper2, #fffdf8); border:1px solid var(--line);
    border-radius:6px; padding:8px 11px; margin:0 0 6px; -webkit-tap-highlight-color:transparent; }
  .open a b{ display:block; font-size:14px; font-weight:600; }
  .open a span{ display:block; font-size:12.5px; color:var(--ink2); margin-top:2px; line-height:1.35; }
  .open a span.hers{ font-style:italic; color:var(--ink); }
</style>
<div class="wrap">
  <h1>The work line</h1>
  ${AUTO ? `<div class="auto" id="auto" data-nostop>
    <button class="play" id="play" type="button" aria-label="Scroll along the line"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M6 4l14 8-14 8z"/></svg></button>
    <button class="tri" id="spd" type="button" data-n="1" data-i="M" aria-label="Speed"></button>
    <span class="spd" id="spdw">Medium</span>
  </div>` : ''}
  <div class="board" id="board" data-nostop>${svg}</div>
  <div class="key" id="key"></div>
  <div class="open" id="open" hidden></div>
</div>
<script src="/compare.js"></script>
${AUTO ? '<script src="/tritoggle.js"></script>' : ''}
<script>
(function(){
  var D = ${JSON.stringify(data).replace(/</g, '\\u003c')};
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  var board = document.getElementById('board'), open = document.getElementById('open'), key = document.getElementById('key');
  key.innerHTML = D.lanes.map(function(p){ return '<span><i style="background:' + p.color + '"></i>' + esc(p.label) + ' ' + p.n + '</span>'; }).join('')
    + '<span><i style="background:' + D.rest.color + '"></i>' + esc(D.rest.label) + ' ' + D.rest.n + '</span>';
  function fmt(k){ var d = new Date(Date.UTC(+k.slice(0,4), +k.slice(5,7)-1, +k.slice(8,10))); return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'}).format(d); }
  function show(i){
    var it = D.items[i]; if (!it) return;
    var p = it.lane >= 0 ? D.lanes[it.lane] : D.rest;
    board.querySelectorAll('.lump.on').forEach(function(e){ e.classList.remove('on'); });
    var el = board.querySelector('.lump[data-i="' + i + '"]'); if (el) el.classList.add('on');
    open.innerHTML = '<h3><i style="background:' + p.color + '"></i>' + esc(p.label) + '</h3>'
      + '<div class="when">' + esc(fmt(it.from)) + (it.to !== it.from ? ' → ' + esc(fmt(it.to)) : '') + ' · ' + it.days + (it.days === 1 ? ' day' : ' days') + ' · ' + it.chats.length + (it.chats.length === 1 ? ' chat' : ' chats') + '</div>'
      + it.chats.map(function(c){ return '<a href="/chats?chat=' + encodeURIComponent(c.chat) + '" data-chat="' + esc(c.chat) + '"><b>' + esc(c.name) + '</b>' + (c.line ? '<span' + (c.hers ? ' class="hers"' : '') + '>' + esc(c.line) + '</span>' : '') + '</a>'; }).join('');
    open.hidden = false;
  }
  board.addEventListener('click', function(e){
    var l = e.target.closest && e.target.closest('.lump');
    if (l) { show(+l.dataset.i); return; }
    // any other tap on the board puts the list away
    board.querySelectorAll('.lump.on').forEach(function(x){ x.classList.remove('on'); });
    open.hidden = true;
  });
  /* Inside the Chats app this page runs in an IFRAME; a plain link there
     loads the whole app inside the viewer. The parent's bridge opens the
     thread instead; a browser follows the href. */
  open.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[data-chat]'); if (!a) return;
    try {
      if (window.parent && window.parent !== window && typeof window.parent.__openThread === 'function'
          && window.parent.__openThread(a.getAttribute('data-chat')) === true) e.preventDefault();
    } catch (err) { /* cross-origin parent — the href stands */ }
  });
  board.scrollLeft = ${AUTO ? '0' : 'board.scrollWidth'};   // ${AUTO ? 'the long line opens at the start and rolls toward today' : 'open on today'}
  ${AUTO ? `(function(){
    var play = document.getElementById('play'), spd = document.getElementById('spd'), spdw = document.getElementById('spdw');
    var SPEEDS = [[0.7,'S','Slow'],[1.8,'M','Medium'],[4,'F','Fast']], n = 1, on = false, raf = 0;
    var PLAY = play.innerHTML, PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    function setSpeed(k){ n = k; spd.dataset.n = String(k); spd.dataset.i = SPEEDS[k][1]; spdw.textContent = SPEEDS[k][2]; }
    function step(){
      if (!on) return;
      if (board.scrollLeft >= board.scrollWidth - board.clientWidth - 1) { stop(); return; }   // the end stops it
      board.scrollLeft += SPEEDS[n][0];
      raf = requestAnimationFrame(step);
    }
    function start(){ if (board.scrollLeft >= board.scrollWidth - board.clientWidth - 1) board.scrollLeft = 0; on = true; play.innerHTML = PAUSE; raf = requestAnimationFrame(step); }
    function stop(){ on = false; play.innerHTML = PLAY; cancelAnimationFrame(raf); }
    play.addEventListener('click', function(){ on ? stop() : start(); });
    spd.addEventListener('click', function(e){
      var next = window.triNext ? window.triNext(spd, 3, e, n) : (n + 1) % 3;   // the aim rule, cycle only as a floor
      if (next !== n) setSpeed(next);
    });
    // her finger on the board pauses it; a tap on a lump still opens it
    board.addEventListener('pointerdown', function(){ if (on) stop(); }, true);
    setSpeed(1);
  })();` : ''}
  if (window.__compareHelp) window.__compareHelp({ html: '<b>One line, every project on it.</b> Days run left to right — scroll sideways. '
    + 'Each colour is a project; a lump is a stretch you worked on it, thicker where more was said, and a gap is where it stopped. '
    + 'Where two overlap you see both. Tap a lump for the chats inside that stretch. The top ' + D.lanes.length + ' projects are on the line; everything else is the grey band underneath. '
    + 'This page is a snapshot — say the word and a fresh one is posted.' });
})();
</script>
`;
}

(async () => {
  const feed = await get(BASE + '/api/chatfeed?scan=200&deep=1&deepchats=1&tail=1');
  const days = await activeDays();
  const D = build(feed.chats, days, TOP);
  const page = html(D);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, page);
  console.log(`wrote ${OUT}: ${D.lanes.length} projects on the line, ${D.rest.chats.length} chats in the grey band, ${D.ndays} days, ${page.length} bytes`);
  if (!POST) { process.exit(0); }
  const title = `The work line — ${WD.shortDay(D.today)} (${VER})`;
  const r = await post(BASE + '/api/chatfeed/page', { chat: CHAT, session: SESSION, title, html: page });
  console.log('posted', r.ok, r.id, r.url, (r.warnings || []).join(' | '));
  if (SUPERSEDE && r.ok) console.log('supersede', JSON.stringify(await post(BASE + '/api/chatfeed/page/' + SUPERSEDE + '/supersede', { chat: CHAT, session: SESSION })));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
