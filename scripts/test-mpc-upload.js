#!/usr/bin/env node
// test-mpc-upload.js — drive the MPC uploader's whole engine against a MOCK of
// makeplayingcards.com's editor (2026-09-20). The mock speaks the same ids and
// JS objects the MPC Autofill desktop tool drives (login page with a logout
// link, #dro_paper_type / #dro_choosesize, doPersonalize(), the
// sysifm_loginFrame card-count box with setMode(), #uploadId keyed by SHA-1,
// oDesignImage.dn_getImageList(), PageLayout.prototype.getElement3 /
// applyDragPhoto / renderDesignCount, oDesign.setNextStep / setTemporarySave,
// #sysdiv_wait). It records every slot assignment server-side, so the test
// asserts what MPC WOULD have received: 3 fronts in slots 0-2 by their SHA-1,
// the shared back in slot 0 of the back face, the project saved twice, the
// stock and bracket picked, and no password anywhere in the log.
//
// No network, no account: it never leaves localhost. Skips (exit 0) when
// playwright or a Chromium is not installed.
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const express = require('express');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright not installed'); process.exit(0); }
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

const up = require('../mpc-upload');
const sharp = require('sharp');

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

// ─── the mock site ──────────────────────────────────────────────────
const state = { loggedIn: false, saves: [], stock: null, bracket: null, cardNumber: null, modes: [], images: {}, faces: { 0: {}, 1: {} }, step: 0 };
const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.raw({ type: 'application/octet-stream', limit: '20mb' }));
const page = (body) => `<!doctype html><html><body>${state.loggedIn ? '<a href="https://www.makeplayingcards.com/logout.aspx">Log out</a>' : ''}${body}</body></html>`;
app.get('/login.aspx', (req, res) => res.send(page(`<form method="post" action="/login.aspx"><input id="txtEmail" name="email"><input id="txtPassword" type="password" name="password"><input id="btnLogin" type="submit" value="Sign in"></form>`)));
app.post('/login.aspx', (req, res) => { state.loggedIn = req.body.email === 'me@example.com' && req.body.password === 'hunter2'; res.redirect('/account.aspx'); });
app.get('/account.aspx', (req, res) => res.send(page('<h1>My account</h1>')));
app.get('/design/custom-blank-card.html', (req, res) => res.send(page(`
  <select id="dro_paper_type"><option>(S30) Standard Smooth</option><option>(S33) Superior Smooth</option><option>(M31) Linen</option></select>
  <select id="dro_choosesize"><option value="18">18</option><option value="36">36</option><option value="55">55</option></select>
  <select id="dro_product_effect"><option value="EF_000">none</option><option value="EF_055">foil</option></select>
  <script>function doPersonalize(u){var q='?stock='+encodeURIComponent(document.getElementById('dro_paper_type').value)+'&bracket='+document.getElementById('dro_choosesize').value; location.href=u+q;}</script>`)));
app.get('/products/pro_item_process_flow.aspx', (req, res) => { state.stock = req.query.stock; state.bracket = req.query.bracket; state.step = 0; res.redirect('/editor?face=0'); });
app.get('/frame', (req, res) => res.send(`<!doctype html><html><body><input id="txt_card_number" value="" onchange="fetch('/api/cardnumber?n='+this.value)"><script>var oRenderFeature={};function setMode(kind,same){fetch('/api/mode?same='+same+'&face='+${JSON.stringify(req.query.face || '0')});}</script></body></html>`));
app.get('/api/cardnumber', (req, res) => { state.cardNumber = req.query.n; res.json({ ok: true }); });
app.get('/api/mode', (req, res) => { state.modes.push({ face: req.query.face, same: req.query.same }); res.json({ ok: true }); });
app.get('/editor', (req, res) => {
  const face = String(req.query.face || '0');
  res.send(page(`
  <div id="sysdiv_wait" style="display:none"></div>
  <input id="uploadId" type="file" style="display:none">
  <input id="txt_temporaryname"><div id="div_temporarysavestatus"></div>
  <button id="closeBtn" style="display:none">close</button>
  <div id="slots">${[0, 1, 2].map((i) => `<div class="dnImg" data-slot="${i}" pid=""></div>`).join('')}</div>
  <iframe name="sysifm_loginFrame" src="/frame?face=${face}"></iframe>
  <script>
    var FACE=${JSON.stringify(face)};
    var oDesignImage={UploadStatus:'Idle', list:[], dn_getImageList:function(){return this.list.join(';');}};
    document.getElementById('uploadId').addEventListener('change', function(){
      var f=this.files[0]; if(!f) return; oDesignImage.UploadStatus='Uploading';
      f.arrayBuffer().then(function(buf){ return fetch('/api/upload',{method:'POST',headers:{'content-type':'application/octet-stream'},body:buf}); })
       .then(function(r){return r.json();}).then(function(j){ if(oDesignImage.list.indexOf(j.pid)<0) oDesignImage.list.push(j.pid); setTimeout(function(){oDesignImage.UploadStatus='Idle';},300); });
    });
    function PageLayout(){}
    PageLayout.prototype.getElement3=function(cls,slot){return document.querySelector('.'+cls+'[data-slot="'+slot+'"]');};
    PageLayout.prototype.applyDragPhoto=function(el,idx,pid){ var w=document.getElementById('sysdiv_wait'); w.style.display='block'; el.setAttribute('pid',pid);
      fetch('/api/assign?face='+FACE+'&slot='+el.getAttribute('data-slot')+'&pid='+pid).then(function(){ setTimeout(function(){w.style.display='none';},200); }); };
    PageLayout.prototype.renderDesignCount=function(){};
    var oDesign={ setNextStep:function(){ fetch('/api/step').then(function(r){return r.json();}).then(function(j){ if(j.face!==FACE) location.href='/editor?face='+j.face; }); },
                  setTemporarySave:function(){ var n=document.getElementById('txt_temporaryname').value; fetch('/api/save?name='+encodeURIComponent(n)+'&face='+FACE).then(function(){ document.getElementById('div_temporarysavestatus').textContent='Saved successfully'; }); } };
  </script>`));
});
app.post('/api/upload', (req, res) => { const pid = crypto.createHash('sha1').update(req.body).digest('hex').toUpperCase(); state.images[pid] = req.body.length; res.json({ pid }); });
app.get('/api/assign', (req, res) => { state.faces[req.query.face][req.query.slot] = req.query.pid; res.json({ ok: true }); });
// steps: fronts(0) → 1 (a preview page, still face 0) → 2 backs (face 1) → 3 → 4 review (face 1)
app.get('/api/step', (req, res) => { state.step++; res.json({ face: state.step >= 2 ? '1' : '0', step: state.step }); });
app.get('/api/save', (req, res) => { state.saves.push({ name: req.query.name, face: req.query.face }); res.json({ ok: true }); });

(async () => {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  // a prepped deck folder: three distinct fronts + one back, tiny PNGs
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpc-mock-deck-'));
  fs.mkdirSync(path.join(dir, 'fronts'));
  const png = (r, g, b) => sharp({ create: { width: 20, height: 28, channels: 3, background: { r, g, b } } }).png().toBuffer();
  const files = [];
  for (const [i, c] of [[1, [200, 30, 30]], [2, [30, 200, 30]], [3, [30, 30, 200]]]) {
    const p = path.join(dir, 'fronts', `0${i}.png`); fs.writeFileSync(p, await png(...c)); files.push(p);
  }
  fs.writeFileSync(path.join(dir, 'back.png'), await png(240, 230, 210));
  const sha = (p) => crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').toUpperCase();

  const flow = {
    loginUrl: `${base}/login.aspx`, startUrl: `${base}/design/custom-blank-card.html`,
    acceptSettingsUrl: `${base}/products/pro_item_process_flow.aspx`,
  };
  let result, err;
  try {
    result = await up.driveMpcUpload({ deckName: 'Fruit flash cards — the trial deck that is long', stock: 'superior' },
      { deckDir: dir, flow, creds: { email: 'me@example.com', password: 'hunter2' }, executablePath: exe, workDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mpc-mock-run-')) });
  } catch (e) { err = e; }
  ok(!err, 'engine ran to the end' + (err ? ' — ' + err.message : ''));
  if (process.env.MPC_TEST_LOG || err) console.log((result || {}).log || []);
  if (result) {
    ok(result.ok && /\/editor\?face=1$/.test(result.reviewUrl), 'ended on the review page (' + result.reviewUrl + ')');
    ok(result.projectName.length <= 32, 'project name cut to MPC\'s 32 characters');
    ok(result.shots.length >= 6 && result.shots.every((s) => fs.existsSync(s.path)), `screenshots written (${result.shots.length})`);
    ok(!result.log.join('\n').includes('hunter2'), 'the password is not in the log');
  }
  ok(state.loggedIn, 'logged in through the form');
  ok(state.stock === '(S33) Superior Smooth', 'stock picked by visible text: ' + state.stock);
  ok(state.bracket === '18', 'smallest bracket ≥ 3 cards: ' + state.bracket);
  ok(state.cardNumber === '3', 'card count typed into the frame: ' + state.cardNumber);
  ok(JSON.stringify(state.modes.slice(0, 1)) === JSON.stringify([{ face: '0', same: '0' }]), 'fronts set to different images');
  ok(state.modes.some((m) => m.face === '1' && m.same === '1'), 'backs set to the same image (shared back)');
  ok(Object.keys(state.images).length === 4, `four distinct files uploaded once each (${Object.keys(state.images).length})`);
  ok([0, 1, 2].every((i) => state.faces[0][i] === sha(files[i])), 'fronts landed in slots 0-2 by their SHA-1');
  ok(state.faces[1][0] === sha(path.join(dir, 'back.png')), 'shared back landed in back slot 0');
  ok(state.saves.length === 2 && state.saves.every((s) => s.name === 'Fruit flash cards — the trial deck that is long'.slice(0, 32)), `project saved after fronts and after backs (${state.saves.length})`);

  // login that does not land must STOP, never go on into the account blind
  state.loggedIn = false; state.saves = [];
  let stopped = null;
  try { await up.driveMpcUpload({ deckName: 'x' }, { deckDir: dir, flow: { ...flow, loginTimeout: 1500 }, creds: { email: 'me@example.com', password: 'wrong' }, executablePath: exe }); }
  catch (e) { stopped = e.message; }
  ok(/login did not land/.test(stopped || ''), 'a failed login stops the run: ' + stopped);
  ok(state.saves.length === 0, 'nothing was saved after the failed login');

  server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
