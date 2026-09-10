#!/usr/bin/env node
/* THE NAUTCHAUG BELT IS TOO BUSY (2026-09-10, Sophie, over a screenshot of
 * card 97 with five things scribbled in red: "this page is too busy · get rid
 * of all the red elements").
 *
 * What she marked, top to bottom:
 *   the autoscroll pill in the corner (and there were TWO of them — the page's
 *     own injected one plus the app viewer's `mkPagePill`, which is why "Fast"
 *     printed twice);
 *   the page's own <h1>, which the app's title bar already says;
 *   the "?" badge beside it;
 *   "WAITING FOR GO" under all 128 headings;
 *   the "header lines (mine, sent before your words — edit them)" fold.
 *
 * A POSTED PAGE IS FROZEN and the builder for this one lives in the owning
 * chat's container, not in this repo — so this repairs the LIVE PAGE ITSELF,
 * byte for byte, the way scripts/fix-belt-truncation.js did on 2026-09-08:
 * fetch the posted html, strip the server's injected pill (it is appended on
 * every read — re-posting it would bake a second copy in), make the five
 * edits, post as the next version, supersede the old one. Her edits live on
 * the `belt-nautchaug` verdict sheet and are never touched.
 *
 * ONE THING IS HIDDEN RATHER THAN DELETED, and it is deliberate: the header
 * lines' <textarea> stays in the page, hidden, because "Send to Footage" reads
 * it to build the prompt's reference-slot lines ("sophie is the woman in
 * [Image1]." / the setting) — the never-describe-a-reference rule. Deleting
 * the <details> would also throw inside the saver's fit(), which does
 * ta.closest('details'), and take every box after it down with it.
 *
 *   node scripts/declutter-belt-nautchaug.js              # dry
 *   node scripts/declutter-belt-nautchaug.js --out /tmp   # the patched html
 *   node scripts/declutter-belt-nautchaug.js --go         # posts + supersedes
 */
'use strict';
const B = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'new-script-draft';
const MATCH = /the draft belt/i;

const args = process.argv.slice(2);
const GO = args.includes('--go');
const OUT = (() => { const i = args.indexOf('--out'); return i >= 0 ? args[i + 1] : null; })();

const getJSON = async (p) => (await (await fetch(B + p)).json());
const getText = async (p) => (await (await fetch(B + p)).text());
const post = async (p, body) => (await (await fetch(B + p, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})).json());

// The server appends the shared pill to EVERY read of a posted page, so the
// html that comes back is not the html that was posted. Cut it off at its own
// marker before patching, or the next version carries a baked-in copy.
const PILL_MARK = '<!-- injected by the server: shared autoscroll pill';
function stripInjected(html) {
  const i = html.indexOf(PILL_MARK);
  return i < 0 ? html : html.slice(0, i).replace(/\s+$/, '') + '\n';
}

function patch(html) {
  const notes = [];
  let out = html;
  const sub = (old, to, want, what) => {
    const n = out.split(old).length - 1;
    if (n !== want) throw new Error(`${what}: matched ${n}, wanted ${want}`);
    out = out.split(old).join(to);
    notes.push(what);
  };

  // 1 — the pill goes away entirely. This one meta is read TWICE: by the
  //     injected snippet (which removes itself) and by chats.html's openPage,
  //     which reads it out of the frame's document and drops the app's own
  //     pill. That is what kills the second "Fast".
  sub('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="forge-pill" content="off">',
      1, 'the pill off (both copies)');

  // 2 — and the 58/64px gutter every row was reserving for it comes back
  sub('.card h2,.card .sends,.card .vid,.card .pend,.card .text summary{margin-right:58px}\n', '',
      1, "the cards' pill gutter");
  sub('padding:6px 0 8px;margin-right:64px;font-size:13px}', 'padding:6px 0 8px;font-size:13px}',
      1, "the nav row's pill gutter");

  // 3 — the header-lines fold off the screen, its textarea kept (see above)
  sub('.text summary{cursor:pointer', '.text.hdr{display:none}\n.text summary{cursor:pointer',
      1, 'hide rule');
  sub('<details class="text"><summary>header lines (mine, sent before your words — edit them)</summary>',
      '<details class="text hdr"><summary>header lines</summary>',
      128, 'the header-lines fold');

  // 4 — "waiting for go"
  sub('<span class="st">waiting for go</span>', '', 128, 'the status line');
  sub(' .st{display:block;font-size:11px;font-weight:400;color:#8a8176;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}',
      '', 1, 'its rule');

  // 5 — the <h1>, and with it the "?" (__compareHelp mounts on the h1, so the
  //     call is dropped rather than left to return null over 10KB of dead text)
  sub('<h1>The Nautchaug Boyfriend&#x27;s — the draft belt</h1>\n', '', 1, 'the title');
  const i = out.indexOf('window.__compareHelp({html:');
  if (i < 0) throw new Error('the "?" call: matched 0, wanted 1');
  const j = out.indexOf("'});", i);
  if (j < 0) throw new Error('the "?" call: no end found');
  out = out.slice(0, i) + out.slice(j + 4);
  notes.push('the "?"');

  for (const gone of ['waiting for go', '<h1>', '__compareHelp', 'margin-right:58px',
                      'margin-right:64px', 'sent before your words', PILL_MARK]) {
    if (out.includes(gone)) throw new Error('still present after the patch: ' + gone);
  }
  return { html: out, notes };
}

(async () => {
  const d = await getJSON('/api/chatfeed/pages?chat=' + encodeURIComponent(CHAT));
  const pages = (Array.isArray(d) ? d : (d.pages || [])).filter((p) => !p.superseded && MATCH.test(p.title));
  if (!pages.length) { console.log('no live belt page on ' + CHAT); return; }
  for (const p of pages) {
    const html = stripInjected(await getText('/api/chatfeed/page/' + p.id));
    const res = patch(html);
    const title = /\bv(\d+)\s*$/.test(p.title)
      ? p.title.replace(/\bv(\d+)\s*$/, (_, n) => 'v' + (Number(n) + 1)) : p.title + ' v2';
    console.log((GO ? 'FIXING  ' : 'WOULD FIX') + '  ' + p.title + ' → ' + title
      + '\n  ' + res.notes.join(', ') + '\n  ' + html.length + ' → ' + res.html.length + ' chars');
    if (OUT) {
      require('fs').writeFileSync(require('path').join(OUT, 'belt-declutter.html'), res.html);
      console.log('  wrote ' + require('path').join(OUT, 'belt-declutter.html'));
    }
    if (!GO) continue;
    const r = await post('/api/chatfeed/page', { chat: CHAT, title, html: res.html });
    if (!r || !r.id) { console.log('  !! no id back: ' + JSON.stringify(r).slice(0, 200)); continue; }
    await post('/api/chatfeed/page/' + p.id + '/supersede', { superseded: true });
    const back = await getText('/api/chatfeed/page/' + r.id);
    console.log('  posted ' + r.id
      + (back.includes('waiting for go') || back.includes('<h1>') ? '  !! STILL BUSY' : '  · reads back clean')
      + (r.warnings && r.warnings.length ? '  · warnings: ' + r.warnings.join(' | ') : ''));
    console.log('  ' + B + '/api/chatfeed/page/' + r.id);
  }
})();
