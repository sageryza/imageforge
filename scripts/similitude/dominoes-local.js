const express = require('express'); const fs = require('fs'); const path = require('path'); const cp = require('child_process');
const S = process.argv[2]; const app = express(); app.use(express.json());
const CUTS = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/triset/cuts/';
const html = fs.readFileSync(S + '/dominoes.html', 'utf8').split(CUTS).join('/cuts/');
app.get('/dominoes', (q, r) => r.type('html').send(html));
app.get('/cuts/:k', (q, r) => { const f = path.join(S, 'cuts', q.params.k); if (!fs.existsSync(f)) cp.execFileSync('curl', ['-sL', '-o', f, CUTS + q.params.k]); r.type('image/webp').send(fs.readFileSync(f)); });
app.post('/api/chatfeed/verdict', (q, r) => r.json({ ok: true }));   // never write the recording into her game record
app.get('/api/chatfeed/verdict', (q, r) => r.json({ ok: true, items: {} }));
app.use(express.static('public')); app.listen(4748, () => console.log('dominoes on 4748'));
