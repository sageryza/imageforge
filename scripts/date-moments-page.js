#!/usr/bin/env node
/* Date moments — every verbatim direction Sophie gave, chronological.
 *
 * Sophie's ask (2026-09-04): "i asked various chats to help me gather date
 * moments. be thorough and find every verbatim direction on these moments.
 * put them chronological in a compare page each collapsible. link to the
 * chats at the bottom".
 *
 * NOTHING IS TRANSCRIBED BY HAND. The table below names each direction by
 * chat + the exact `created` stamp; the text is pulled LIVE from
 * /api/chatfeed/thread on every build, so the page can never drift from what
 * she actually said (the house "nothing stands between the source and the
 * output" rule). A stamp that no longer resolves fails the build loudly
 * rather than quietly dropping a direction.
 *
 * Which chats: measured, not guessed. Tight searches over the whole feed
 * ("cheese grater", "Westgate", "moments-rubric", "backup moments") return
 * exactly the two chats that did the moments pass, plus the two that built
 * the surfaces the moments live in. The review-queue chat names date moments
 * once inside a broader redesign — it is kept in its own section at the end
 * rather than mixed into the chronology.
 *
 *   node scripts/date-moments-page.js          # build + print, post nothing
 *   node scripts/date-moments-page.js --go     # post it into the chat
 */
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'date-moments-compare';
const TITLE = 'Date moments — every direction you gave (v1)';
const SHEET = 'date-directions-v1';

// chat slug -> what she calls it in the app
const CHATS = {
  'portland-dates-moments':      'date moments (og)',
  'sophie-portland-dates-blake': 'date moments part two',
  'dates-tinder-text-template':  'the date card template',
  'notion-tinder-memories-page': 'the Notion page of moments',
  'review-queue-ui-changes':     'the review queue',
};

// [chat, created (exact), short title, tag, note?]
const ENTRIES = [
  ['portland-dates-moments','2026-08-17T06:39:20','The ask: read every date, pull the moments that stayed with you','the brief'],
  ['portland-dates-moments','2026-08-17T19:52:21','What makes a moment good — plus the timeline, the caption and the statistics','what to pick'],
  ['portland-dates-moments','2026-08-17T19:53:17','One more moment: his height, only in centimeters','a moment'],
  ['portland-dates-moments','2026-08-17T20:11:55','The caption can be funny — snarky, self-deprecating','captions'],
  ['portland-dates-moments','2026-08-17T20:23:27','You overcorrected on the snark — clarity first','captions'],
  ['portland-dates-moments','2026-08-17T20:54:04','How you want to review them: one moment a screen, Tinder style','the deck'],
  ['portland-dates-moments','2026-08-17T22:59:32','Read Matt, Kyle and Jake','the reading'],
  ['sophie-portland-dates-blake','2026-08-17T23:01:00','The handoff you sent to the second chat','handoff',
   'Written by the og chat at your ask, and sent by you — the only entry here that is not your own words. It is what the second chat was actually working from, so it is kept.'],
  ['dates-tinder-text-template','2026-08-18T03:17:15','Change the check to a heart','the card'],
  ['dates-tinder-text-template','2026-08-18T03:37:39','Leftovers of the old template — the pill, the misalignment, the extra header','the card'],
  ['dates-tinder-text-template','2026-08-18T04:10:04','Align the heart and the ✕, square the corners, move his name down and make it red','the card'],
  ['dates-tinder-text-template','2026-08-18T04:44:52','Is this the surface both dating-book chats will use?','the card'],
  ['dates-tinder-text-template','2026-08-18T05:29:04','Move them onto the new design','the card'],
  ['notion-tinder-memories-page','2026-08-18T06:04:07','I did not pick them yet — put them in unpacked and label them so','the Notion page'],
  ['notion-tinder-memories-page','2026-08-18T06:16:40','Include this on the page too','the Notion page'],
  ['notion-tinder-memories-page','2026-08-18T06:16:59','Pin the Notion page there','the Notion page'],
  ['dates-tinder-text-template','2026-08-18T06:20:19','Hearting must not move the moment — only tapping the sides does','the card'],
  ['dates-tinder-text-template','2026-08-18T06:20:44','His name in all capitals','the card'],
  ['notion-tinder-memories-page','2026-08-18T06:23:19','ChatGPT will read this page and illustrate one an hour — does that change it?','the Notion page'],
  ['dates-tinder-text-template','2026-08-18T07:58:45','Back to 13px, no pinch zoom, and hide the gray bars','the card'],
  ['notion-tinder-memories-page','2026-08-18T08:28:43','This is not a surface for decisions — the moments are already picked','the Notion page'],
  ['notion-tinder-memories-page','2026-08-18T08:32:24','Actually keep the checkboxes — they mark what they finish','the Notion page',
   'You sent this twice, a few minutes apart; it is one direction, shown once.'],
  ['portland-dates-moments','2026-08-20T04:16:37','Illustrate the first 10 moments I said yes to','illustration'],
];

// Named date moments once, inside a redesign of something else. Kept apart so
// the chronology above is only ever directions about the moments themselves.
const ASIDE = [
  ['review-queue-ui-changes','2026-08-19T01:48:09','A queue tile opens the content itself — images, video ideas or date moment prompts','the queue'],
  ['review-queue-ui-changes','2026-08-19T02:35:03','If the text is really long put the title in the top left corner','the queue'],
];

const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// Pacific, 12-hour, and the working day turns over at 5am (the house cut —
// she works past midnight, so a 1am direction belongs to the day before).
const PT = (iso, opts) => new Intl.DateTimeFormat('en-US',
  Object.assign({ timeZone: 'America/Los_Angeles' }, opts)).format(new Date(iso));
const clock = (iso) => PT(iso, { hour: 'numeric', minute: '2-digit' });
function dayKey(iso) {
  const h = +PT(iso, { hour: 'numeric', hour12: false });
  const d = new Date(new Date(iso).getTime() - (h < 5 ? 864e5 : 0));
  return PT(d.toISOString(), { weekday: 'short', month: 'short', day: 'numeric' });
}

const paras = (t) => String(t).split(/\n\s*\n|\n/).map((s) => s.trim()).filter(Boolean)
  .map((s) => `<p>${esc(s)}</p>`).join('');

async function thread(slug) {
  const r = await fetch(`${BASE}/api/chatfeed/thread?chat=${encodeURIComponent(slug)}`);
  if (!r.ok) throw new Error(`thread ${slug}: ${r.status}`);
  return (await r.json()).messages || [];
}

function pick(msgs, slug, created) {
  const m = msgs.find((x) => x.from === 'sophie' && String(x.created || '').startsWith(created));
  if (!m) throw new Error(`no message ${slug} @ ${created} — the source moved; fix the table`);
  return m;
}

function row(e, msgs, i) {
  const [slug, created, title, tag, note] = e;
  const m = pick(msgs[slug], slug, created);
  const id = `d${String(i + 1).padStart(2, '0')}`;
  return `<section class="ent" data-item="${id}">
  <button class="enthd" type="button" aria-expanded="false">
    <span class="entt">${esc(clock(m.created))}</span>
    <span class="entl">${esc(title)}</span>
    <span class="entc">${esc(tag)} · ${esc(CHATS[slug])}</span>
  </button>
  <div class="entb" hidden>${note ? `<p class="entn">${esc(note)}</p>` : ''}${paras(m.text)}</div>
</section>`;
}

(async () => {
  const slugs = [...new Set([...ENTRIES, ...ASIDE].map((e) => e[0]))];
  const msgs = {};
  for (const s of slugs) msgs[s] = await thread(s);

  const sorted = [...ENTRIES].sort((a, b) => a[1].localeCompare(b[1]));
  let body = '', day = '';
  sorted.forEach((e, i) => {
    const k = dayKey(pick(msgs[e[0]], e[0], e[1]).created);
    if (k !== day) { day = k; body += `\n<h2>${esc(k)}</h2>\n`; }
    body += row(e, msgs, i) + '\n';
  });

  let aside = `\n<h2>Named in passing, elsewhere</h2>\n`;
  ASIDE.forEach((e, i) => { aside += row(e, msgs, ENTRIES.length + i) + '\n'; });

  const links = Object.entries(CHATS).map(([slug, name]) =>
    `<li><a href="${BASE}/chats?chat=${slug}">${esc(name)}</a></li>`).join('\n');

  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(TITLE)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  .ent { border-bottom: 1px solid var(--line); }
  .enthd {
    display: grid; grid-template-columns: 66px minmax(0, 1fr); column-gap: 8px;
    width: 100%; text-align: left; background: none;
    border: 0; padding: 12px 64px 12px 0; cursor: pointer; color: inherit; font: inherit;
  }
  .entt {
    color: var(--gold); align-self: start; padding-top: 5px;
    font: 700 11px/1 -apple-system, 'Helvetica Neue', sans-serif;
    letter-spacing: .1em; text-transform: uppercase;
  }
  .entl { font-size: 16px; line-height: 1.35; }
  .entc {
    grid-column: 2; margin-top: 3px; color: var(--ink2);
    font: 11px/1.3 -apple-system, 'Helvetica Neue', sans-serif;
    letter-spacing: .08em; text-transform: uppercase;
  }
  .ent.open .enthd { padding-bottom: 4px; }
  .entb { padding: 0 0 14px 0; }
  .entb p { margin: 0 0 10px; }
  .entb p:last-child { margin-bottom: 0; }
  .entn {
    color: var(--ink2); font: 13px/1.45 -apple-system, 'Helvetica Neue', sans-serif;
    border-left: 2px solid var(--line); padding-left: 10px;
  }
  .chatlinks { list-style: none; margin: 10px 0 0; padding: 0; }
  .chatlinks li { margin-bottom: 8px; }
  .chatlinks a { color: var(--gold); }
</style>

<div class="wrap">
  <h1>${esc(TITLE)}</h1>
${body}${aside}
  <h2>The chats</h2>
  <ul class="chatlinks">
${links}
  </ul>
</div>

<script src="/compare.js"></script>
<script>
(function () {
  document.querySelectorAll('.enthd').forEach(function (b) {
    b.addEventListener('click', function () {
      var s = b.closest('.ent'), body = s.querySelector('.entb');
      var open = s.classList.toggle('open');
      body.hidden = !open;
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(SHEET)} });
  window.__compareHelp({ html: '<b>Every direction you gave on the date moments</b>, '
    + 'oldest first, tap one to read it word for word. Pulled from the two chats that '
    + 'did the moments pass and the two that built the surfaces they live in. '
    + 'The last section is the one place date moments were named inside a redesign of '
    + 'something else. Times are Pacific.' });
})();
</script>`;

  const outAt = process.argv.indexOf('--out');
  if (outAt > -1 && process.argv[outAt + 1]) {
    require('fs').writeFileSync(process.argv[outAt + 1], html);
    console.log('wrote', process.argv[outAt + 1], html.length, 'bytes');
  }
  if (!process.argv.includes('--go')) {
    console.log(`${sorted.length} directions + ${ASIDE.length} aside · ${html.length} bytes`);
    console.log('dry run — pass --go to post');
    process.exit(0);
  }
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title: TITLE, html }),
  });
  const out = await r.json();
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e.message); process.exit(1); });
