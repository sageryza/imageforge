/* Drives one-flow-v1.html in headless Chromium: marks, pile, undo, join, move. */
const http = require('http'); const fs = require('fs'); const os = require('os');
const path = require('path'); const { spawn } = require('child_process');
const page = fs.readFileSync(path.join(__dirname, '..', 'docs', 'one-flow', 'one-flow-v1.html'), 'utf8');
const posts = [];
let finish = null;
const DRIVER = `<script>
(function(){
  var out=[];
  function ok(name,cond){ out.push((cond?'ok — ':'FAIL — ')+name); }
  function $(s){ return document.querySelector(s); }
  function $$(s){ return document.querySelectorAll(s); }
  function report(){ fetch('/report?v='+encodeURIComponent(out.join(' | '))); }
  setTimeout(function(){
    ok('11 units painted', $$('.unit').length===11);
    ok('30 cards on page', $$('.mcard').length===30);
    ok('3 long units fold', $$('.unit.long').length===3);
    var b16=document.querySelector('[data-item="b16"]');
    b16.querySelector('.qm').click();
    ok('lock walks to keep', b16.classList.contains('st-keep'));
    b16.querySelector('.qm').click();
    ok('then to not sure', b16.classList.contains('st-maybe'));
    b16.querySelector('.qm').click();
    ok('then back to neither', !b16.classList.contains('st-maybe')&&!b16.classList.contains('st-keep'));
    b16.querySelector('.outb').click();
    setTimeout(function(){
      ok('cut card leaves the page', !document.contains(document.querySelector('[data-item="b16"]')) || $$('.unit').length===10);
      var pb=$('.pileb');
      ok('pile button lit with count', !pb.disabled && pb.textContent.indexOf('1')>=0);
      pb.click();
      setTimeout(function(){
        var back=document.querySelector('[data-item="b16"]');
        ok('pile shows it in place, dimmed', !!back && back.classList.contains('st-out') && $$('.unit').length===11);
        back.querySelector('.outb').click();
        setTimeout(function(){
          back=document.querySelector('[data-item="b16"]');
          ok('x again brings it back', !!back && !back.classList.contains('st-out'));
          $('.undob').click();
          setTimeout(function(){
            back=document.querySelector('[data-item="b16"]');
            ok('undo re-cuts it', back===null || back.classList.contains('st-out'));
            $('.redob').click();
            setTimeout(function(){
              back=document.querySelector('[data-item="b16"]');
              ok('redo restores it', !!back && !back.classList.contains('st-out'));
              var joins=$$('.joinb');
              joins[0].click();
              setTimeout(function(){
                ok('join melds units 1+2', $$('.unit').length===10 && $$('.unit')[0].querySelectorAll('.mcard').length===5);
                $('.undob').click();
                setTimeout(function(){
                  ok('undo unjoins', $$('.unit').length===11);
                  var no=$$('.unit')[0].querySelector('.no');
                  no.focus(); no.value='3'; no.blur();
                  setTimeout(function(){
                    var third=$$('.unit')[2];
                    ok('typed 3 lands third', !!third.querySelector('[data-item="b11"]'));
                    setTimeout(report, 700);   // let the 400ms save debounce fire
                  },250);
                },250);
              },250);
            },250);
          },250);
        },250);
      },250);
    },250);
  },600);
})();
<\/script>`;
const server = http.createServer((req, res) => {
  const u = req.url;
  if (u === '/') { res.setHeader('Content-Type','text/html'); res.end(page + DRIVER.replace('<\\/script>','</scr'+'ipt>')); return; }
  if (u === '/compare.css') { res.setHeader('Content-Type','text/css');
    res.end(':root{--paper:#f6f2e9;--surface:#fff;--ink:#26221c;--ink2:#8a8377;--line:#e5ddcf;--gold:#a8842c;--rose:#a5586a;--chg:#b3443f}body{background:var(--paper)}'); return; }
  if (u === '/compare.js') { res.setHeader('Content-Type','text/javascript');
    res.end('window.__compareHelp=function(){};window.__compareNotes=function(){};'); return; }
  if (u.startsWith('/api/chatfeed/verdict')) {
    if (req.method === 'POST') { let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ posts.push(b); res.setHeader('Content-Type','application/json'); res.end('{"ok":true}'); }); return; }
    res.setHeader('Content-Type','application/json'); res.end('{"ok":true,"items":{},"texts":{}}'); return;
  }
  if (u.startsWith('/report')) { res.end('ok'); finish(decodeURIComponent(u.split('v=')[1]||'')); return; }
  res.statusCode = 404; res.end();
});
server.listen(0, () => {
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'flowtest-'));
  let chrome = '/opt/pw-browsers/chromium';
  try { fs.accessSync(chrome); } catch (_) {
    try { const hit = fs.readdirSync('/opt/pw-browsers').find(d=>d.startsWith('chromium-'));
      chrome = hit && path.join('/opt/pw-browsers', hit, 'chrome-linux', 'chrome'); fs.accessSync(chrome);
    } catch (_) { console.log('no chromium — skip'); process.exit(0); }
  }
  const kid = spawn(chrome, ['--headless','--no-sandbox','--disable-gpu','--user-data-dir='+profile, url], { stdio:'ignore' });
  const done = (verdict, err) => {
    try { kid.kill('SIGKILL'); } catch(_){}
    server.close();
    if (err) { console.error(err); process.exit(1); }
    const lines = verdict.split(' | ').filter(Boolean);
    lines.forEach(l=>console.log('  '+l));
    const stFields = posts.filter(p=>p.includes('"st:'));
    const orderFields = posts.filter(p=>p.includes('"order"'));
    console.log('  posts: '+posts.length+' ('+stFields.length+' marks, '+orderFields.length+' orders)');
    if (!lines.length || lines.some(l=>l.startsWith('FAIL')) || !stFields.length || !orderFields.length) process.exit(1);
    console.log('all page checks passed'); process.exit(0);
  };
  const timer = setTimeout(()=>done('', 'timed out'), 40000);
  finish = v => { clearTimeout(timer); done(v); };
});
