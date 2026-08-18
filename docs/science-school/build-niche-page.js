// build-niche-page.js — renders the niche-lessons review Compare page from
// niche-lessons-data.json and (with --post) posts it into the chat's Compare
// tab. Text-review page: no images, every card carries data-item so Sophie
// can note any single card. Lessons are <details> folds so the page opens as
// the shape of the whole thing (progressive expansion rule).
//
//   node docs/science-school/build-niche-page.js            # writes HTML next to itself
//   node docs/science-school/build-niche-page.js --post     # also POSTs the page
//
const fs = require('fs');
const path = require('path');

const CHAT = 'witch-school-lesson-topics';
const SHEET = 'niche-lessons-v1';
const TITLE = 'Niche lessons v1 — text + art prompts';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'niche-lessons-data.json'), 'utf8'));

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

function quizHtml(quiz) {
  return quiz.map(q => `
      <div class="qz">
        <div class="qz-q">${q.q}</div>
        ${q.a.map((a, i) => `<div class="qz-a${i === q.ok ? ' ok' : ''}">${i === q.ok ? '✓ ' : ''}${a}</div>`).join('')}
        <div class="qz-tell">${q.tell}</div>
      </div>`).join('');
}

function cardHtml(c) {
  const body = c.quiz
    ? quizHtml(c.quiz)
    : `<div class="bd">${c.body}</div>`;
  const faq = (c.faq || []).map(f =>
    `<div class="fq"><span class="fq-q">ⓘ ${f.q}</span> ${f.a}</div>`).join('');
  const art = c.art
    ? `<div class="art"><span class="art-tag">art</span> ${esc(c.art)}</div>`
    : `<div class="art"><span class="art-tag">art</span> — quiz card, no picture</div>`;
  return `
    <div class="card lcard" data-item="${c.id}">
      <div class="kick">${esc(c.kicker)} <span class="cid">${c.id}</span></div>
      ${c.h ? `<h2>${esc(c.h)}</h2>` : ''}
      ${body}
      ${faq}
      ${art}
    </div>`;
}

function lessonHtml(l, i) {
  const artCount = l.cards.filter(c => c.art).length;
  return `
  <details class="lesson"${i === 0 ? ' open' : ''}>
    <summary><span class="ltitle">${esc(l.title)}</span><span class="lmeta">${l.cards.length} cards · ${artCount} pictures ≈ $${(artCount * 0.07).toFixed(2)}</span></summary>
    <div class="lsub">${esc(l.sub)}</div>
    ${l.cards.map(cardHtml).join('')}
  </details>`;
}

const totalArt = data.lessons.reduce((n, l) => n + l.cards.filter(c => c.art).length, 0);

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITLE}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  .lesson { border: 1px solid rgba(0,0,0,.12); border-radius: 6px; margin: 10px 0; background: rgba(255,255,255,.5); }
  .lesson > summary { list-style: none; cursor: pointer; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; }
  .lesson > summary::-webkit-details-marker { display: none; }
  .ltitle { font-weight: 600; font-size: 16px; }
  .lmeta { font-size: 12px; opacity: .6; }
  .lsub { font-size: 13px; opacity: .75; padding: 0 14px 8px; }
  .lcard { margin: 8px 10px; }
  .kick { font-size: 10.5px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; opacity: .55; }
  .cid { letter-spacing: 0; text-transform: none; font-weight: 400; opacity: .8; float: right; }
  .lcard h2 { margin: 3px 0 6px; }
  .bd { font-size: 14.5px; line-height: 1.55; }
  .fq { font-size: 13px; line-height: 1.5; margin-top: 8px; opacity: .85; }
  .fq-q { font-weight: 600; }
  .art { font-size: 12.5px; line-height: 1.45; margin-top: 10px; padding: 7px 9px; border: 1px dashed rgba(0,0,0,.2); border-radius: 6px; opacity: .8; }
  .art-tag { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-right: 4px; }
  .qz { font-size: 13.5px; line-height: 1.5; margin-top: 6px; }
  .qz-q { font-weight: 600; }
  .qz-a { padding-left: 12px; opacity: .75; }
  .qz-a.ok { opacity: 1; font-weight: 600; }
  .qz-tell { font-style: italic; opacity: .7; padding-left: 12px; margin-top: 2px; }
</style>

<div class="wrap">
  <h1>${TITLE}</h1>
  ${data.lessons.map(lessonHtml).join('')}
</div>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: '${CHAT}', sheet: '${SHEET}' });
  window.__compareHelp({ html: '<b>The niche lessons, words first.</b> Ten lessons, '
    + 'tap one open to read its cards. Under every card, the dashed box is the exact '
    + 'art prompt that would be sent (the fixed pastel style block gets prepended). '
    + 'Nothing is illustrated or wired yet — leave a + note on any card to change or '
    + 'cut it, and say which lessons get the go-ahead. '
    + 'Art runs about 7¢ a card — ${totalArt} pictures ≈ $${(totalArt * 0.07).toFixed(2)} for everything, or per lesson as marked.' });
})();
</script>
`;

const out = path.join(__dirname, 'niche-lessons-page.html');
fs.writeFileSync(out, html);
console.log('wrote', out, html.length, 'bytes,', totalArt, 'art cards');

if (process.argv.includes('--post')) {
  fetch(BASE + '/api/chatfeed/page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title: TITLE, html })
  }).then(r => r.json()).then(j => {
    console.log('posted:', JSON.stringify(j));
  }).catch(e => { console.error('post failed:', e.message); process.exit(1); });
}
