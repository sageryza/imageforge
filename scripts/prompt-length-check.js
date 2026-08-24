#!/usr/bin/env node
/*
 * prompt-length-check.js — did the content prompts chats write actually get
 * SHORTER after the rules landed?
 *
 * WHY IT EXISTS (Sophie, 2026-08-24): the short-prompt guidance went into
 * CLAUDE.md on 2026-08-21 (WRITE IT SHORT) and 2026-08-24 (NAME THE
 * PHENOMENON), and nobody has ever checked whether the chats writing prompts
 * changed what they write. She asked for a look four days on, comparing the
 * window since against how they were before.
 *
 * WHAT IT MEASURES: the CONTENT half of every filed prompt
 * (`promptContent`), in characters. Not the style half — that is a fixed
 * house wrapper and its length says nothing about how a chat wrote. Rows are
 * deduped by url; a row with no content half contributes nothing.
 *
 * WHAT IT CANNOT SETTLE, and say so in any reply that quotes it: this is
 * observational, not an experiment. A batch of one-word prompts from one chat
 * moves the aggregate on its own (that is exactly the artifact that broke the
 * earlier ♥-vs-length sweep — 130 votes on ~18-char prompts in one chat), so
 * the per-chat table matters more than the headline median. Report the median,
 * not the mean: one 5,000-character transcript drags a mean anywhere.
 *
 * USAGE
 *   node scripts/prompt-length-check.js                 # since 08-21 vs before
 *   node scripts/prompt-length-check.js --since 2026-08-24
 *   node scripts/prompt-length-check.js --json          # for a reader
 *   node scripts/prompt-length-check.js --snapshot docs/prompt-length/<f>.json
 *
 * ENV: FORGE_BASE. Free — one paged read of a Firestore-backed route, no
 * model call.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const BASE = (process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com').replace(/\/$/, '');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i < 0 ? d : argv[i + 1]; };
const has = (n) => argv.includes('--' + n);

// The two dates the guidance landed. Everything before the first is "before".
const SHORT_RULE = '2026-08-21';   // WRITE IT SHORT (now cut from the doc, still the date it applied)
const NAME_RULE = '2026-08-24';    // NAME THE PHENOMENON

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const pct = (xs, p) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

/** Every row the meta-assets route holds, paged. */
async function fetchAll() {
  const out = [];
  const limit = 300;
  for (let offset = 0; ; offset += limit) {
    const r = await fetch(`${BASE}/api/gallery/assets/all?limit=${limit}&offset=${offset}`);
    if (!r.ok) throw new Error(`assets/all ${r.status} at offset ${offset}`);
    const j = await r.json();
    out.push(...(j.assets || []));
    if (out.length >= (j.total || 0) || !(j.assets || []).length) break;
  }
  return out;
}

/** Rows → one record per unique url that carries a content half. */
function records(assets) {
  const seen = new Set();
  const out = [];
  for (const a of assets) {
    const content = String(a.promptContent || '').trim();
    if (!content) continue;
    const key = String(a.url || '').split('?')[0];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const ms = a.created ? Date.parse(a.created) : (a.ms || 0);
    if (!ms) continue;
    out.push({ chat: a.chat || '', day: new Date(ms).toISOString().slice(0, 10), ms, len: content.length });
  }
  return out.sort((a, b) => a.ms - b.ms);
}

const stats = (rows) => {
  const lens = rows.map((r) => r.len);
  return {
    n: rows.length,
    chats: new Set(rows.map((r) => r.chat)).size,
    median: median(lens),
    p25: pct(lens, 25),
    p75: pct(lens, 75),
    over1000: lens.filter((l) => l > 1000).length,
    under300: lens.filter((l) => l <= 300).length,
  };
};

/** Per chat, only where the chat filed prompts on BOTH sides of the line —
 *  the only comparison that is not just a different chat writing. */
function perChat(before, after) {
  const bag = (rows) => rows.reduce((m, r) => ((m[r.chat] = m[r.chat] || []).push(r.len), m), {});
  const b = bag(before), a = bag(after);
  return Object.keys(a).filter((c) => b[c]).map((c) => ({
    chat: c,
    beforeN: b[c].length, beforeMedian: median(b[c]),
    afterN: a[c].length, afterMedian: median(a[c]),
    delta: median(a[c]) - median(b[c]),
  })).sort((x, y) => y.afterN - x.afterN);
}

async function main() {
  const since = opt('since', SHORT_RULE);
  const all = has('file') ? JSON.parse(fs.readFileSync(opt('file'), 'utf8')) : await fetchAll();
  const recs = records(all);
  const before = recs.filter((r) => r.day < since);
  const after = recs.filter((r) => r.day >= since);

  const byDay = {};
  for (const r of recs) (byDay[r.day] = byDay[r.day] || []).push(r.len);
  const days = Object.keys(byDay).sort().slice(-21)
    .map((d) => ({ day: d, n: byDay[d].length, median: median(byDay[d]) }));

  // `my-creations` is the app-made pseudo-chat (the Playground and the in-app
  // surfaces), where the prompt is whatever SOPHIE typed — house guidance to
  // chats cannot move it, and it is a third of the recent rows. Kept in the
  // headline for completeness and split out beside it, because the question
  // she asked is about what CHATS write.
  const notApp = (r) => r.chat !== 'my-creations';

  const report = {
    ranAt: new Date().toISOString(),
    since, rules: { shortRule: SHORT_RULE, nameRule: NAME_RULE },
    total: recs.length,
    before: stats(before), after: stats(after),
    sinceNameRule: stats(recs.filter((r) => r.day >= NAME_RULE)),
    chatsOnly: { before: stats(before.filter(notApp)), after: stats(after.filter(notApp)) },
    perChat: perChat(before, after),
    lastDays: days,
  };

  const snap = opt('snapshot');
  if (snap) {
    fs.mkdirSync(path.dirname(snap), { recursive: true });
    fs.writeFileSync(snap, JSON.stringify(report, null, 2) + '\n');
  }
  if (has('json')) { console.log(JSON.stringify(report, null, 2)); return; }

  const line = (label, s) => console.log(
    `${label.padEnd(22)} n=${String(s.n).padStart(5)}  chats=${String(s.chats).padStart(3)}` +
    `  median=${String(s.median).padStart(5)}  p25=${String(s.p25).padStart(5)}  p75=${String(s.p75).padStart(6)}` +
    `  ≤300=${String(Math.round(100 * s.under300 / (s.n || 1))).padStart(3)}%  >1000=${s.over1000}`);

  console.log(`content prompts on file: ${recs.length}   split at ${since}\n`);
  line('before', report.before);
  line('on/after', report.after);
  line(`since ${NAME_RULE}`, report.sinceNameRule);
  console.log('\nchats only (the app-made `my-creations` rows dropped — those are her own typing):');
  line('  before', report.chatsOnly.before);
  line('  on/after', report.chatsOnly.after);
  console.log('\nper chat (filed on both sides of the line):');
  if (!report.perChat.length) console.log('  none yet');
  for (const c of report.perChat.slice(0, 15)) {
    console.log(`  ${c.chat.padEnd(34)} ${String(c.beforeMedian).padStart(5)} (n=${c.beforeN})` +
      ` → ${String(c.afterMedian).padStart(5)} (n=${c.afterN})   ${c.delta > 0 ? '+' : ''}${c.delta}`);
  }
  console.log('\nlast days:');
  for (const d of report.lastDays) console.log(`  ${d.day}  n=${String(d.n).padStart(4)}  median=${d.median}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
