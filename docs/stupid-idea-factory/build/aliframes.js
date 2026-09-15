const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs');
const html = fs.readFileSync('/home/user/imageforge/public/alibaba.html','utf8');
const script = fs.readFileSync('/home/user/imageforge/docs/stupid-idea-factory/alibaba-escalation.txt','utf8');
const srv = http.createServer(async (req, res) => {
  if (req.url === '/alibaba') { res.setHeader('content-type','text/html'); return res.end(html); }
  const r = await fetch('https://imageforge-q125.onrender.com' + req.url);
  res.statusCode = r.status; res.setHeader('content-type', r.headers.get('content-type') || 'text/plain'); res.end(Buffer.from(await r.arrayBuffer()));
});
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto('http://127.0.0.1:' + srv.address().port + '/alibaba'); await p.waitForTimeout(1500);
  const n = await p.evaluate((script) => {
    const s = document.getElementById('script'); s.value = script; s.dispatchEvent(new Event('input', {bubbles:true}));
    document.getElementById('who').value = 'Cindy Su'; document.getElementById('b-who').value = 'Eva Huang';
    return window.__alibaba.parse().length;
  }, script);
  for (let i = 1; i <= n; i++) {
    const data = await p.evaluate((i) => { const r = document.getElementById('range'); r.value = String(i); r.dispatchEvent(new Event('input', {bubbles:true})); window.__alibaba.render(); return document.getElementById('canvas').toDataURL('image/png'); }, i);
    fs.writeFileSync(process.argv[2] + '/f' + String(i).padStart(2,'0') + '.png', Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('frames', n); await b.close(); srv.close();
});
