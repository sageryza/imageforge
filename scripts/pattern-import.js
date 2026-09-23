#!/usr/bin/env node
// pattern-import.js — put a card-pattern.js tile onto the Pattern page so she
// can fine-tune it there (2026-09-23, Sophie: "feed it into the pattern maker
// the other chat made today so i can fine tune").
//
//   node scripts/pattern-import.js --file scripts/patterns/exotic.json [--pid exotic1] [--dry]
//
// Reads the spec's placements (x, y fractions of the tile; scale a multiple of
// the cell's motif size; rot; flip), finds each card on the Pattern shelf by
// NAME (forge-pattern-pieces, ready and not hidden — run pattern-seed.js
// first for a piece not there yet), and writes the page's own texts on its
// verdict doc: `p:cfg:<pid>` and one `p:it:<pid>:<k>` per item, the shape
// pattern.tpl.html saves itself. Size on the page = the piece's longest side
// in tile units (1000): (1000 / cols) * fill * scale — the same arithmetic
// card-pattern.js draws with, so the picture is the size she approved. No
// model call; nothing is deployed.

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const FILE = flag('file', '');
const DRY = args.includes('--dry');
const CHAT = flag('chat', 'animal-fruit-pattern-tool');
const SHEET = 'pattern';
const BASE = 'https://imageforge-q125.onrender.com';
if (!FILE) { console.error('--file spec.json is required'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const PID = (flag('pid', '') || String(spec.name || 'p').toLowerCase().replace(/[^a-z0-9]/g, '') + '1');
if (!/^[a-z0-9]+$/.test(PID)) { console.error('pid must be [a-z0-9]+'); process.exit(1); }
const bareName = (id) => String(id).replace(/^[a-z]+:/, '').replace(/^\d+-/, '').replace(/-v\d+$/, '').replace(/-/g, ' ').toLowerCase();

(async () => {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const snap = await admin.firestore().collection('forge-pattern-pieces').get();
  const byName = new Map();
  snap.forEach((d) => { const p = d.data(); if (p.status === 'ready' && !p.hidden && !byName.has(p.name)) byName.set(p.name, d.id); });
  const cols = Number(spec.cols || 4), fill = Number(spec.fill == null ? 0.8 : spec.fill);
  const items = [];
  for (const p of spec.placements || []) {
    const name = bareName(p.id);
    const piece = byName.get(name);
    if (!piece) { console.error(`not on the shelf: ${name} (seed it first)`); process.exit(1); }
    items.push({ piece, x: +Number(p.x).toFixed(4), y: +Number(p.y).toFixed(4), size: Math.round((1000 / cols) * fill * (p.scale || 1)), rot: Math.round(p.rot || 0), flip: !!p.flip });
  }
  const bg = /^#[0-9a-f]{6}$/i.test(spec.bg || '') ? spec.bg.toLowerCase() : '#ffffff';
  const cfg = { name: spec.name || PID, tile: { w: 1000, h: 1000, bg }, layout: { kind: spec.layout === 'halfdrop' ? 'half' : 'grid' }, exports: [], updatedAt: new Date().toISOString() };
  console.log(`${PID}: ${items.length} items · ${cfg.layout.kind} · ${bg}`);
  items.forEach((it, i) => console.log(`  ${bareName(spec.placements[i].id).padEnd(14)} ${it.piece} x${it.x} y${it.y} size ${it.size} rot ${it.rot}${it.flip ? ' flip' : ''}`));
  if (DRY) return;
  const put = async (item, text) => {
    const r = await fetch(`${BASE}/api/chatfeed/verdict`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat: CHAT, sheet: SHEET, item, text }) });
    if (!r.ok) throw new Error(`${item}: ${r.status}`);
  };
  await put(`p:cfg:${PID}`, JSON.stringify(cfg));
  for (let i = 0; i < items.length; i++) await put(`p:it:${PID}:i${i + 1}`, JSON.stringify({ ...items[i], o: i }));
  console.log(`written to ${CHAT} / ${SHEET}`);
})().catch((e) => { console.error(e); process.exit(1); });
