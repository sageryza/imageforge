#!/usr/bin/env node
// Builds the Font tester Compare page with every one of her fonts INLINED
// (base64), so it works before any deploy. Dry by default; --go posts it,
// --supersede <id> retires the old version.
//   node scripts/font-tester-page.js [--go] [--supersede <id>]
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHAT = 'font-creation-01bjog';
// Only the fonts drawn in this chat (Sophie: "new page just the new ones").
const FONTS = [['Print Caps', 'print-caps'], ['Serif Caps', 'serif-caps']];
function build() {
  const list = FONTS.filter(([, f]) => fs.existsSync(path.join(ROOT, 'public/fonts', f + '.ttf')));
  const faces = list.map(([, f]) => {
    const b64 = fs.readFileSync(path.join(ROOT, 'public/fonts', f + '.ttf')).toString('base64');
    return `@font-face{font-family:'ft-${f}';src:url(data:font/ttf;base64,${b64}) format('truetype')}`;
  }).join('\n');
  const tpl = fs.readFileSync(path.join(ROOT, 'docs/font-tester/tester.tpl.html'), 'utf8');
  return tpl.replace('/*FONTFACES*/', faces)
    .replace('/*FONTLIST*/', JSON.stringify(list.map(([name, f]) => ({ name, fam: 'ft-' + f }))));
}
module.exports = { build, FONTS };
if (require.main === module) {
  const a = process.argv.slice(2), go = a.includes('--go');
  const si = a.indexOf('--supersede'), sup = si >= 0 ? a[si + 1] : null;
  const html = build();
  const vf = path.join(ROOT, 'docs/font-tester/VERSIONS');
  const v = (fs.existsSync(vf) ? fs.readFileSync(vf, 'utf8').trim().split('\n').filter(Boolean).length : 0) + 1;
  const title = `Font tester v${v}`;
  if (!go) { console.log(`dry: ${title}, ${html.length} bytes`); process.exit(0); }
  const B = 'https://imageforge-q125.onrender.com/api/chatfeed';
  (async () => {
    const r = await fetch(B + '/page', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: CHAT, title, html }) }).then(r => r.json());
    console.log(JSON.stringify(r));
    if (!r.id) process.exit(1);
    fs.appendFileSync(vf, `${v} ${r.id} ${new Date().toISOString()}\n`);
    if (sup) console.log(await fetch(`${B}/page/${sup}/supersede`, { method: 'POST' }).then(r => r.text()));
  })();
}
