/**
 * The shared shell for this chat's comparison pages — the STYLES page (three
 * styles, one subject per row) and the QUALITY ladder (one subject, one style
 * per row, low/medium/high across).
 *
 * They differ only in what the three columns MEAN, so the markup, the CSS and
 * the prompt-button behaviour live here once. Two pages that behave differently
 * because someone copied the script and edited one of them is exactly the bug
 * `new-page` keeps warning about.
 *
 * Built on public/compare-shell.html: title once and nothing above it,
 * explanation behind the "?", notes on every row, page script in an IIFE
 * (the injected pill declares `var raf`/`var I` in global scope and a
 * page-level `let` of the same name kills it at parse time).
 */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param {object}   o
 * @param {string}   o.title    shown once, as the <h1>
 * @param {string}   o.chat     chat slug for notes
 * @param {string}   o.sheet    verdict sheet name — must carry the item set's SHAPE
 * @param {string}   o.help     html for the "?" card
 * @param {Array}    o.rows     [{ id, label, cells: [{ tag, url, alt, promptStyle, promptContent }] }]
 */
function buildPage({ title, chat, sheet, help, rows }) {
  // Keyed prompts, read by the page script to fill the panel. Kept out of the
  // markup so a prompt containing quotes or newlines can't break an attribute.
  const prompts = {};
  for (const r of rows) {
    for (const c of r.cells) {
      prompts[`${r.id}__${c.key}`] = { style: c.promptStyle, content: c.promptContent };
    }
  }

  const cards = rows.map((r) => {
    const cells = r.cells.map((c) => `      <figure>
        <span class="tag">${esc(c.tag)}</span>
        <img src="${esc(c.url)}" alt="${esc(c.alt)}">
        <button type="button" class="pbtn" data-p="${esc(r.id)}__${esc(c.key)}" data-n="${esc(c.tag)}">prompt</button>
      </figure>`).join('\n');
    return `  <div class="card" data-item="${esc(r.id)}">
    <h3>${esc(r.label)}</h3>
    <div class="duo trio">
${cells}
    </div>
    <div class="ppanel" hidden></div>
  </div>`;
  }).join('\n');

  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  /* Three across, labels on top — .duo's look, one more column. */
  .duo.trio { grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .duo.trio figure { display: flex; flex-direction: column; }
  /* The button hugs its word and sits under its own picture. */
  .pbtn { font-size: 12px; padding: 5px 9px; margin-top: 6px; align-self: start; }
  .pbtn[aria-expanded="true"] { background: var(--gold); color: var(--surface); }
  /* Full width under the row — a prompt in a 1/3 column is unreadable. */
  .ppanel { margin-top: 10px; border-top: 1px solid var(--line); padding-top: 10px; }
  .ppanel h4 {
    font: 700 11px/1 -apple-system, 'Helvetica Neue', sans-serif;
    letter-spacing: .14em; text-transform: uppercase; color: var(--gold); margin-bottom: 5px;
  }
  .ppanel p { font-size: 14px; line-height: 1.5; margin-bottom: 12px; white-space: pre-wrap; }
  .ppanel p:last-child { margin-bottom: 0; }
</style>

<div class="wrap">
  <h1>${esc(title)}</h1>
${cards}
</div>

<script src="/compare.js"></script>
<script>
(function () {
  var P = ${JSON.stringify(prompts)};
  window.__compareNotes({ chat: ${JSON.stringify(chat)}, sheet: ${JSON.stringify(sheet)} });
  window.__compareHelp({ html: ${JSON.stringify(help)} });

  // One panel per card, one open at a time. Tapping the open button closes it.
  // A <button> is on compare.js's shared exempt list, so these taps pause the
  // autoscroll without ever restarting it and never eat their own click.
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.pbtn');
    if (!b) return;
    var card = b.closest('.card');
    var panel = card.querySelector('.ppanel');
    var open = b.getAttribute('aria-expanded') === 'true';
    card.querySelectorAll('.pbtn').forEach(function (o) { o.setAttribute('aria-expanded', 'false'); });
    if (open) { panel.hidden = true; return; }
    b.setAttribute('aria-expanded', 'true');
    var p = P[b.getAttribute('data-p')] || {};
    panel.innerHTML = '<h4></h4><p></p><h4>content</h4><p></p>';
    panel.querySelector('h4').textContent = b.getAttribute('data-n') + ' \\u2014 style';
    var ps = panel.querySelectorAll('p');
    ps[0].textContent = p.style || 'not available';
    ps[1].textContent = p.content || 'not available';
    panel.hidden = false;
  });
})();
</script>
`;
}

/** POST the page, and optionally mark the one it replaces as superseded. */
async function postPage({ base, chat, title, html, topic, supersede }) {
  const res = await fetch(`${base}/api/chatfeed/page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat, title, html, reference: true, topic }),
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
  if (data.warnings && data.warnings.length) {
    console.error('\n⚠ WARNINGS — fix the page and re-post:', data.warnings);
    process.exit(1);
  }
  if (data.id) console.log(`\npage → ${base}/api/chatfeed/page/${data.id}`);
  if (supersede && data.id) {
    // The route only toggles a flag — it stores no pointer to the replacement,
    // so the version lives in the TITLE and nowhere else.
    const s = await fetch(`${base}/api/chatfeed/page/${supersede}/supersede`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ superseded: true }),
    });
    console.log('superseded', supersede, '→', s.status, JSON.stringify(await s.json()).slice(0, 200));
  }
  return data;
}

module.exports = { buildPage, postPage, esc };
