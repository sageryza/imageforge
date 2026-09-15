const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, recordVideo: { dir: process.argv[2] + '/vid', size: { width: 390, height: 844 } } });
  await ctx.route('**/*', async (route) => { const req = route.request(); try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
      const r = await fetch(req.url(), { method: req.method(), headers: req.headers(), body: ['GET','HEAD'].includes(req.method()) ? undefined : req.postDataBuffer(), signal: ctl.signal, redirect: 'manual' });
      clearTimeout(t); const headers = {}; r.headers.forEach((v, k) => { if (!/^(content-encoding|content-length|transfer-encoding)$/i.test(k)) headers[k] = v; });
      await route.fulfill({ status: r.status, headers, body: Buffer.from(await r.arrayBuffer()) });
    } catch (e) { await route.abort().catch(() => {}); } });
  const q = await ctx.newPage();
  await q.goto('https://shouldimakethis.web.app', { waitUntil: 'load', timeout: 60000 }); await q.waitForTimeout(9000);
  await q.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  const t0 = Date.now(); const at = (ms) => new Promise(r => setTimeout(r, Math.max(0, t0 + ms - Date.now())));
  await at(1500);
  for (let i = 0; i <= 90; i++) { await q.evaluate((y) => window.scrollTo(0, y), Math.round(1700 * (1 - Math.cos(Math.PI * i / 90)) / 2)); await at(1500 + i * 50); }
  await at(6200);
  for (let i = 0; i <= 30; i++) { await q.evaluate((y) => window.scrollTo(0, y), Math.round(1700 * (1 - i / 30))); await at(6200 + i * 25); }
  await at(7000);
  await q.evaluate(() => {
    const st = document.createElement('style'); st.textContent = '@keyframes hb{0%{transform:scale(.2);opacity:0}30%{transform:scale(1.2);opacity:1}100%{transform:scale(1) translateY(-140px);opacity:0}} .hb{position:fixed;font-size:64px;line-height:1;pointer-events:none;animation:hb 1.3s ease-out forwards;z-index:9999}'; document.head.appendChild(st);
    window.__heart = (x, y, s) => { const h = document.createElement('div'); h.className = 'hb'; h.textContent = '❤️'; h.style.left = x + 'px'; h.style.top = y + 'px'; h.style.fontSize = s + 'px'; document.body.appendChild(h); };
  });
  const pops = [7000, 7400, 7750, 8050, 8300, 8500, 8650, 8800, 8900, 9000, 9100, 9200, 9300];
  for (let i = 0; i < pops.length; i++) { await at(pops[i]); await q.evaluate(([i]) => window.__heart(40 + ((i * 97) % 280), 260 + ((i * 53) % 120), 48 + (i % 4) * 14), [i]); }
  await at(11800);
  await ctx.close(); await b.close();
  const f = fs.readdirSync(process.argv[2] + '/vid').find(x => x.endsWith('.webm')); console.log('webm', f);
})().catch(e => { console.log('ERR', e.message.split('\n')[0]); process.exit(1); });
