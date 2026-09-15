// christmas-footage-page — HER Christmas script, read out of Footage, as the
// Compare page (2026-09-15, Sophie: "scripts from footage" · "scripts = mine
// only" · "stay in ur lane").
//
//   node scripts/christmas-footage-page.js            # print the html
//   node scripts/christmas-footage-page.js --go [--supersede <pageId>]
//
// WHERE THE SCRIPT ACTUALLY LIVES. The Footage page's draft — the text blocks
// she types into — is in localStorage on her own phone (`footage_draft`), so
// no chat can read it. What every chat CAN read is the prompt of every clip
// she has sent: `GET /api/apiframe/video-log?chat=footage` and
// `GET /api/footage/jobs`, which between them hold the literal text of each
// job. Her script is therefore recovered from what she SHOT, not from a doc.
// Neither source alone is enough — the log missed jobs sent in the last hour
// and /jobs caps at 200 — so both are read and merged on the job id.
//
// TAKES. She re-sends a scene as she rewrites it, so the same scene appears
// many times: grouped here by prompt similarity (the reference slots stripped
// first, since [Image1] moving is not a rewrite) and only her NEWEST wording
// is shown, with the take count beside it. Nothing of hers is retyped — the
// page carries the prompt exactly as the API received it.
//
// THE ORDER IS HER OWN. The master (the longest, most re-sent scene) contains
// the whole arc in order, and the shorter jobs are her breaking that master
// into shootable pieces — so the pieces are laid out in the order the master
// puts them, not by date.
const https = require('https');

const CHAT = 'christmas-scripts-saturnalia';
const SHEET = 'xmas-footage-v1';
const TITLE = 'Christmas — the script from Footage v1';
const BASE = 'https://imageforge-q125.onrender.com';

// Her scenes, by the id of the take whose wording is current. Resolved live so
// a re-send updates the page rather than freezing an old draft into it.
const ORDER = [
  { key: 'stairs',  label: 'Coming down the stairs' },
  { key: 'kit',     label: 'The witch kit' },
  { key: 'circle',  label: 'The tree' },
  { key: 'cottage', label: 'The cottage' },
  { key: 'master',  label: 'The whole thing, as she wrote it' },
];
const MATCH = {
  stairs:  (p) => /blurred christmas lights that then come into focus/i.test(p) && p.length < 900,
  kit:     (p) => /you get her a \*witch\* kit/i.test(p) && !/druid women, dancing/i.test(p),
  circle:  (p) => /around a (christmas tree|pine tree)/i.test(p) && /pickup truck/i.test(p),
  cottage: (p) => /exterior view of a cottage/i.test(p) && !/you get her a \*witch\* kit/i.test(p),
  master:  (p) => /druid women, dancing around a christmas tree/i.test(p),
};

const get = (url) => new Promise((ok, no) => {
  https.get(url, (r) => { let b = ''; r.on('data', (c) => b += c); r.on('end', () => { try { ok(JSON.parse(b)); } catch (e) { no(e); } }); }).on('error', no);
});

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

(async () => {
  const [log, jobs] = await Promise.all([
    get(`${BASE}/api/apiframe/video-log?chat=footage&limit=500`),
    get(`${BASE}/api/footage/jobs?limit=1000`),
  ]);
  const by = new Map();
  for (const x of (log.jobs || [])) by.set(x.job, x);
  for (const x of (jobs.jobs || [])) if (!by.has(x.id)) by.set(x.id, x);
  const all = [...by.values()].filter((x) => x.prompt).sort((a, b) => (a.sentAt || '').localeCompare(b.sentAt || ''));

  const cards = [];
  for (const { key, label } of ORDER) {
    const takes = all.filter((x) => MATCH[key](x.prompt));
    if (!takes.length) { console.error(`no take matched ${key}`); continue; }
    const cur = takes[takes.length - 1];
    const secs = (cur.params && cur.params.duration) || cur.seconds || '';
    const meta = [takes.length + (takes.length === 1 ? ' take' : ' takes'), secs ? secs + 's' : ''].filter(Boolean).join(' · ');
    const film = cur.video && /completed|done/i.test(cur.status || '')
      ? `<div class="film" data-url="${esc(cur.video)}" data-label="${esc(label)}" data-meta="${esc(meta)}"></div>` : '';
    cards.push(`<div class="card" data-item="sc-${key}">
<h2>${esc(label)}</h2>
${film}
<pre class="scr">${esc(cur.prompt.trim())}</pre>
</div>`);
  }

  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(TITLE)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  /* THE PILL'S COLUMN IS RESERVED ON A PAGE MADE OF WORDS — it is fixed at
     x 324-374 and the page scrolls under it, so without this every line
     passing through its band loses its last word (PHOTO'd at 390x844). */
  .card { padding-right: 64px; }
  .card h2 { margin-bottom: 10px; }
  /* Her own line breaks are the scene's shape — a <pre> keeps them and never
     scrolls sideways on a phone. */
  .scr { font: 15px/1.55 ui-serif, Georgia, serif; white-space: pre-wrap;
         overflow-wrap: anywhere; margin: 0; }
</style>

<div class="wrap">
  <h1>${esc(TITLE)}</h1>

${cards.join('\n\n')}
</div>

<script src="/compare.js"></script>
<script>
(function () {
  document.querySelectorAll('.film').forEach(function (el) {
    window.__filmRow({ url: el.dataset.url, label: el.dataset.label,
                       meta: el.dataset.meta, mount: el });
  });
  window.__compareNotes({ chat: '${CHAT}', sheet: '${SHEET}' });
})();
</script>
`;

  if (!process.argv.includes('--go')) { process.stdout.write(html); return; }
  const r = await fetch(BASE + '/api/chatfeed/page', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title: TITLE, html }),
  });
  console.log(JSON.stringify(await r.json(), null, 1));
  const i = process.argv.indexOf('--supersede');
  if (i > 0 && process.argv[i + 1]) {
    const s = await fetch(`${BASE}/api/chatfeed/page/${process.argv[i + 1]}/supersede`, { method: 'POST' });
    console.log('superseded:', s.status);
  }
})();
