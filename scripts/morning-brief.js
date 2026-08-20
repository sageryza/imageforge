#!/usr/bin/env node
/**
 * THE MORNING BRIEF — the page's FORMAT, so a run only has to bring the words.
 *
 * Sophie asked for her briefing as a Compare page rather than a reply (Aug
 * 2026: "this would be more helpful as a compare page with the things checked
 * off from yesterday and empty, checked boxes for today"), then for it twice a
 * day. So the shape lives here in code and the JUDGEMENT stays with the chat:
 * a run reads the live sources, decides what matters and how urgent it is,
 * writes a small JSON, and this file turns it into the page.
 *
 *   node scripts/morning-brief.js --data brief.json            → prints HTML
 *   node scripts/morning-brief.js --data brief.json --post      → posts it
 *   node scripts/morning-brief.js --data brief.json --post \
 *        --supersede <pageId>                                   → and retires the last one
 *
 * WHAT A RUN DOES (the ritual, top to bottom):
 *  1. Read the live sources — never remember them:
 *       GET /api/brief?fresh=1            the open asks, per chat
 *       GET /api/review                   the decks still waiting
 *       docs/desktop-tasks.md (OPEN)      what only her Mac can do
 *       git log origin/main               what actually shipped
 *  2. Judge each item's timing: now / later / some. That is the grouping AND
 *     the flag — see WHEN below.
 *  3. Write the JSON, run this, post, supersede the page you replaced.
 *
 * THREE THINGS THAT ARE LOAD-BEARING:
 *
 * - ITEM IDS ARE DERIVED FROM THE WORDS, NOT COUNTED. `idFor()` hashes the
 *   chat slug and the title, so the same task carries the same id from the
 *   morning run to the evening one — which is the only reason her ticks
 *   survive a re-post on the same day. A positional id (t-1, t-2) would hand
 *   her morning tick to whatever task happened to land in that slot at 5pm.
 * - THE SHEET IS PER DAY (`brief-YYYY-MM-DD`). Same day = same sheet = her
 *   marks carry. A new day starts clean.
 * - A CHAT IS LINKED BY ITS SLUG, NOT A claude.ai SESSION URL (Sophie, Aug
 *   2026: "the links shud go to the chat in deck factory, not the Claude
 *   app"). Inside the app the page is a same-origin IFRAME, so a plain link
 *   would load the whole Chats app INSIDE the page viewer — the row hands the
 *   parent an intention via `__openThread` and only falls back to
 *   /chats?chat= in a browser. Same bridge judge.js uses for its back button.
 *
 * WHEN: 'now' | 'later' | 'some' — the three sections, in that order, and the
 * three marks under every line (bolt / clock / cloud). Tapping one MOVES the
 * row: her flag is an override stored as `<id>:pri`, the run's call is the
 * default in `data-def`. Ticking a line drops it into Done at the bottom;
 * unticking puts it back where it was. The star is `<id>:star` and outlines
 * the row red — her "remember this".
 */
const fs = require('fs');
const crypto = require('crypto');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const WHENS = [
  ['now', 'Now'],
  ['later', 'Later'],
  ['some', 'At some point'],
];

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The id a task keeps for as long as it is the same task (see the note above).
const idFor = it => 'i' + crypto.createHash('sha1')
  .update((it.chat || '') + '|' + it.title).digest('hex').slice(0, 10);

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
// Lucide zap / clock / cloud — three silhouettes that stay apart at 16px.
const MARK = {
  now: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>',
  later: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  some: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
};
// the house star, verbatim from chats.html's STAR (a starred chat's mark)
const STAR = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m12 2.6 2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95z"/></svg>';

/** A title that opens the chat in Deck Factory — never claude.ai. */
function titleHtml(it) {
  if (!it.chat) return esc(it.title);
  return '<a class="go" href="/chats?chat=' + encodeURIComponent(it.chat) + '"'
    + ' data-chat="' + esc(it.chat) + '">' + esc(it.title) + '</a>';
}

function todayRow(it, ord) {
  const id = idFor(it);
  const when = MARK[it.when] ? it.when : 'later';
  const marks = WHENS.map(([k, label]) =>
    '<button class="pri" data-pri="' + k + '" aria-pressed="' + (k === when) + '"'
    + ' aria-label="' + esc(label) + '">' + MARK[k] + '</button>').join('');
  return '\n      <div class="row" data-item="' + id + '" data-def="' + when + '" data-ord="' + ord + '">'
    + '<button class="box" data-box aria-pressed="false" aria-label="done">' + CHECK + '</button>'
    + '<div class="rt"><div class="t">' + titleHtml(it)
    + (it.chip ? ' <span class="chip">' + esc(it.chip) + '</span>' : '') + '</div>'
    + (it.mini ? '<div class="mini">' + it.mini + '</div>' : '')
    + '<div class="marks">' + marks
    + '<button class="pri star" data-star aria-pressed="false" aria-label="remember this">' + STAR + '</button>'
    + '</div></div></div>';
}

function shippedRow(it) {
  return '\n      <div class="row done"><button class="box" aria-pressed="true" disabled>' + CHECK + '</button>'
    + '<div class="rt"><div class="t">' + titleHtml(it) + '</div>'
    + (it.mini ? '<div class="mini">' + it.mini + '</div>' : '') + '</div></div>';
}

function build(d) {
  const today = d.today || [];
  let ord = 0;
  let todayHtml = '';
  WHENS.forEach(([k, label]) => {
    const rows = today.filter(it => (MARK[it.when] ? it.when : 'later') === k);
    // Every section is rendered even when empty: her flag can move a row into
    // one at any moment, and a section that only exists when the run happened
    // to fill it would have nowhere to put it.
    todayHtml += '\n    <section data-sec="' + k + '"' + (rows.length ? '' : ' hidden') + '>'
      + '<h2>' + label + '</h2>' + rows.map(it => todayRow(it, ord++)).join('') + '\n    </section>';
  });

  let shipHtml = '';
  (d.shipped || []).forEach(g => {
    shipHtml += '\n    <h2>' + esc(g.h) + '</h2>' + (g.items || []).map(shippedRow).join('');
  });
  const nShip = (d.shipped || []).reduce((a, g) => a + (g.items || []).length, 0);

  return TEMPLATE
    .replace(/<!--TITLE-->/g, esc(d.title))
    .replace('<!--TODAY-->', todayHtml)
    .replace('<!--SHIPPED-->', shipHtml)
    .replace('<!--NTODAY-->', String(today.length))
    .replace('<!--NSHIP-->', String(nShip))
    .replace('<!--SHIPLABEL-->', esc(d.shippedLabel || 'Yesterday'))
    .replace('<!--CHAT-->', JSON.stringify(d.chat))
    .replace('<!--SHEET-->', JSON.stringify(d.sheet));
}

const TEMPLATE = fs.readFileSync(__dirname + '/morning-brief.tpl.html', 'utf8');

// ---------------------------------------------------------------- cli
if (require.main === module) {
  const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  const dataPath = arg('--data');
  if (!dataPath) { console.error('usage: morning-brief.js --data <file.json> [--post] [--supersede <id>]'); process.exit(1); }
  const d = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const html = build(d);

  if (process.argv.indexOf('--post') < 0) { process.stdout.write(html); process.exit(0); }

  const body = JSON.stringify({ chat: d.chat, session: d.session, title: d.title, html });
  fetch(BASE + '/api/chatfeed/page', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  })
    .then(r => r.json())
    .then(async j => {
      if (!j.ok) throw new Error(JSON.stringify(j));
      // A page that skipped the kit comes back with `warnings` — the house rule
      // is to fix and re-post before the turn ends, so say them loudly.
      if (j.warnings && j.warnings.length) console.error('WARNINGS:', j.warnings);
      const old = arg('--supersede');
      if (old) {
        const s = await fetch(BASE + '/api/chatfeed/page/' + old + '/supersede', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
        }).then(r => r.json()).catch(e => ({ error: e.message }));
        console.error('superseded ' + old + ': ' + JSON.stringify(s));
      }
      console.log(JSON.stringify(j));
    })
    .catch(e => { console.error('post failed: ' + e.message); process.exit(2); });
}

module.exports = { build, idFor, WHENS };
