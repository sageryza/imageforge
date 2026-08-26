#!/usr/bin/env node
/**
 * WHAT COLOUR IS THIS APP? — the style-drift audit.
 *
 * Sophie, 2026-08-24: "it seems like there are conflicting styles across the
 * board." She was right, and this is the number rather than
 * the impression: it loads every gated page in a real browser and prints what
 * each one ACTUALLY paints — body background, ink, accent, button radius —
 * plus which shared stylesheet (if any) it is reading.
 *
 * WHY IT IS A LIVE MEASUREMENT AND NOT A GREP. A page declares its palette in
 * a dozen places (`:root`, `body{}`, a `.tool` override, an inline style, a
 * shared sheet it links), and the only thing that settles which one wins is
 * the browser. A grep over hex codes answers a different, easier question.
 *
 * THE THREE VOCABULARIES ARE THE ROOT OF IT (measured 2026-08-24):
 *   tool.css     --bg --ink --accent --border --surface2   #faf9f7 / #3a3530 / #b48b6a
 *   forge.css    --bg --text --accent --border --surface-2  the SAME values, other names
 *   compare.css  --paper --ink --line --chg --rose          #faf6ee / #2a2620 / #a8845c
 * so `--ink` means #3a3530 in one and #2a2620 in another, and a page that
 * wants to colour the INJECTED pill (which reads compare.css's vocabulary on
 * every page) has to hand-declare a set of its own. That is how the fourth,
 * fifth and sixth cream got into the app.
 *
 * Read the ROUTES off server.js so a new page joins the audit the day it is
 * registered — the rule test-header-top.js already follows.
 *
 * Usage: PORT=3111 node server.js &  then  node scripts/audit-styles.js
 *        --json for a reader. Skips cleanly with no server and no playwright.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = process.env.FORGE_BASE || 'http://localhost:3111';
const JSON_OUT = process.argv.includes('--json');

function routes() {
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const seen = new Set(); const out = [];
  for (const m of src.matchAll(/app\.get\('(\/[a-z-]+)',\s*serveGated\('([a-z-]+\.html)'/g)) {
    if (seen.has(m[2])) continue;          // one route per PAGE — /clips and /chunking are one look
    seen.add(m[2]); out.push({ route: m[1], page: m[2] });
  }
  return out;
}

const PROBE = () => {
  const cs = getComputedStyle(document.body);
  const root = getComputedStyle(document.documentElement);
  const v = (n) => (root.getPropertyValue(n) || cs.getPropertyValue(n) || '').trim();
  const btn = [...document.querySelectorAll('button')].find((x) => {
    const c = getComputedStyle(x);
    return x.offsetParent && c.backgroundColor !== 'rgba(0, 0, 0, 0)' && c.backgroundColor !== 'transparent';
  });
  return {
    bg: cs.backgroundColor,
    ink: cs.color,
    accent: v('--accent') || v('--chg') || v('--rose') || '',
    radius: btn ? getComputedStyle(btn).borderRadius : '',
    sheets: [...document.styleSheets]
      .map((s) => (s.href ? s.href.split('/').pop() : ''))
      .filter((h) => h && h.endsWith('.css')).join(' '),
  };
};

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) { console.log('skipped (no playwright)'); return; }
  try {
    const probe = await fetch(BASE + '/api/promptlab/styles');
    if (!probe.ok) throw new Error(String(probe.status));
  } catch (e) {
    console.log(`skipped (no server at ${BASE} — start one with PORT=3111 node server.js)`);
    return;
  }

  let b;
  try { b = await chromium.launch(); }
  catch { b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const rows = [];
  try {
    for (const { route, page } of routes()) {
      const p = await b.newPage({ viewport: { width: 390, height: 844 } });
      try {
        await p.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await p.waitForTimeout(1200);
        rows.push({ route, page, ...(await p.evaluate(PROBE)) });
      } catch (e) { rows.push({ route, page, error: e.message.split('\n')[0] }); }
      await p.close();
    }
  } finally { await b.close(); }

  if (JSON_OUT) { console.log(JSON.stringify(rows, null, 1)); return; }

  const pad = (s, n) => String(s == null ? '' : s).padEnd(n).slice(0, n);
  console.log(pad('route', 15) + pad('background', 18) + pad('ink', 18) + pad('accent', 10)
    + pad('btn r', 7) + 'shared sheet');
  for (const r of rows) {
    console.log(pad(r.route, 15) + pad(r.error ? 'ERR' : r.bg, 18) + pad(r.ink, 18)
      + pad(r.accent || '—', 10) + pad(r.radius || '—', 7) + (r.sheets || 'none'));
  }
  const tally = (k) => {
    const m = new Map();
    for (const r of rows) { if (r.error || !r[k]) continue; m.set(r[k], (m.get(r[k]) || 0) + 1); }
    return [...m.entries()].sort((a, b2) => b2[1] - a[1]);
  };
  console.log('');
  for (const k of ['bg', 'ink', 'accent', 'radius']) {
    const t = tally(k);
    console.log(`${pad(k, 9)} ${t.length} distinct — ${t.map(([v2, n]) => `${v2}×${n}`).join('  ')}`);
  }
  const none = rows.filter((r) => !r.error && !r.sheets).length;
  console.log(`\n${rows.length} pages · ${none} read no shared stylesheet at all`);
})();
