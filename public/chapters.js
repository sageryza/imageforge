/* chapters.js — the CHAPTERS page (Aug 2026, Sophie's ask: "a new artifact
   type called chapters where we catalog what we did in a way that I can
   easily go back to").

   TWO AXES, and both are hers:

   VERTICAL — the chapters. A long chat divided into what it actually was:
   the research at the start, then each lesson/thing made, with any big
   stretch of experimentation (testing two looks against each other, tuning
   parameters) as its own chapter. It is an ACCORDION on purpose — "when I
   open one, the rest of them collapse" — so the spine of the whole project
   stays readable on a phone.

   HORIZONTAL — progressive expansion / contraction. Inside an open chapter
   she steps through three levels:

     1  gist    a surface summary, enough to refresh her memory
     2  deeper  what was decided, built, learned — the detail under the gist
     3  raw     the ACTUAL messages of that stretch, both sides, verbatim

   Level 3 is the point of the whole thing: a catalog she can't verify is a
   story about the work, not a record of it. So the raw level is the real
   transcript slice, never a summary of it — the only display change is that
   an attachment path renders as a chip instead of a wall of uuid.

   Include after /compare.js on a page built from chapters-shell.html:

     <link rel="stylesheet" href="/compare.css">
     <div class="wrap"> …eyebrow / h1 / one-line sub… <div id="chapters"></div></div>
     <script src="/compare.js"></script>
     <script src="/chapters.js"></script>
     <script>(function(){ window.__chapters({ chat, sheet, chapters }); })();</script>

   chapters: [{ id, title, when, l1, l2: [line, …], msgs: [{who, at, text}] }]
     id    — stable slug; it keys her note on that chapter
     when  — the date range, shown small beside the title
     l1    — ONE short paragraph (level 1)
     l2    — a few short lines (level 2); each renders as its own line
     msgs  — who: 'sophie' | 'claude', at: ISO string, text: verbatim

   Notes ride the same verdict doc every reviewable surface uses (the
   standing rule), so a chat reads them back with
   GET /api/chatfeed/verdict?chat=&sheet=.

   Style: compare.css tokens only — they are also what keeps the injected
   autoscroll pill from rendering black. The chapter list is [data-nostop]
   because its ordinary content is tappable: a tap there PAUSES a running
   scroll but never starts one (the embedded-iframe contract). */
(function () {
  if (window.__chapters) return;

  var css = document.createElement('style');
  css.textContent =
    '.cx{max-width:680px;margin:0 auto;}' +
    /* one chapter = a row that opens */
    '.cx-ch{border-top:1px solid var(--line);}' +
    '.cx-ch:last-child{border-bottom:1px solid var(--line);}' +
    '.cx-head{display:flex;align-items:baseline;gap:10px;width:100%;text-align:left;' +
    ' background:none;border:0;padding:13px 0;cursor:pointer;color:var(--ink);}' +
    '.cx-n{font:500 11px/1.4 -apple-system,sans-serif;color:var(--ink2);' +
    ' letter-spacing:.06em;min-width:20px;flex:none;}' +
    '.cx-t{flex:1;min-width:0;font:600 15px/1.3 Georgia,serif;}' +
    '.cx-ch.on .cx-t{color:var(--chg);}' +
    '.cx-when{flex:none;font:500 10px/1.4 -apple-system,sans-serif;color:var(--ink2);' +
    ' letter-spacing:.05em;white-space:nowrap;}' +
    '.cx-body{padding:0 0 18px;}' +
    /* the horizontal axis */
    '.cx-lv{display:flex;gap:6px;padding:0 0 12px;}' +
    '.cx-lv button{font:500 10px/1 -apple-system,sans-serif;letter-spacing:.09em;' +
    ' text-transform:uppercase;padding:7px 10px;border-radius:6px;border:1px solid var(--line);' +
    ' background:var(--surface);color:var(--ink2);cursor:pointer;}' +
    '.cx-lv button.on{border-color:var(--chg);color:var(--chg);' +
    ' background:color-mix(in srgb, var(--chg) 8%, var(--surface));}' +
    '.cx-lv button .cx-num{opacity:.55;padding-right:4px;}' +
    /* levels 1 and 2 */
    '.cx-l1{font:400 15px/1.55 Georgia,serif;margin:0 0 2px;}' +
    '.cx-l2{list-style:none;padding:12px 0 0;margin:0;}' +
    '.cx-l2 li{font:400 14px/1.5 -apple-system,sans-serif;color:var(--ink);' +
    ' padding:0 0 9px 14px;position:relative;}' +
    '.cx-l2 li:before{content:"";position:absolute;left:0;top:9px;width:5px;height:5px;' +
    ' border-radius:50%;background:var(--ink2);}' +
    '.cx-l2 li b{font-weight:700;}' +
    /* level 3 — the real messages */
    '.cx-raw{padding:2px 0 0;}' +
    '.cx-msg{padding:11px 0;border-bottom:1px solid var(--line);}' +
    '.cx-msg:last-child{border-bottom:0;}' +
    '.cx-who{font:500 10px/1 -apple-system,sans-serif;letter-spacing:.1em;' +
    ' text-transform:uppercase;color:var(--ink2);padding-bottom:5px;display:block;}' +
    '.cx-msg.me .cx-who{color:var(--chg);}' +
    '.cx-text{white-space:pre-wrap;font:400 14px/1.55 -apple-system,sans-serif;' +
    ' word-break:break-word;}' +
    '.cx-msg.me .cx-text{color:var(--ink);}' +
    '.cx-msg.them .cx-text{color:var(--ink2);}' +
    '.cx-att{display:inline-block;font:500 11px/1 -apple-system,sans-serif;' +
    ' color:var(--ink2);border:1px solid var(--line);border-radius:6px;' +
    ' padding:4px 7px;margin:2px 4px 2px 0;background:var(--surface);}' +
    '.cx-count{font:500 10px/1 -apple-system,sans-serif;letter-spacing:.08em;' +
    ' text-transform:uppercase;color:var(--ink2);padding:0 0 8px;}';
  document.head.appendChild(css);

  var LEVELS = [['1', 'gist'], ['2', 'deeper'], ['3', 'raw']];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  /* Bare **bold** in the level-2 lines — nothing else is interpreted, so a
     stray < in her words can never become markup. */
  function line(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  }
  /* An attachment reaches the transcript as @"/root/.claude/uploads/<session>/
     <hash>-<name>". The path is machinery, not her words, so it renders as a
     chip carrying the real filename; every other character stays verbatim. */
  function body(text) {
    var out = '', re = /@"\/[^"]*\/([^"\/]+)"/g, last = 0, m;
    while ((m = re.exec(text))) {
      out += esc(text.slice(last, m.index));
      var name = m[1].replace(/^[0-9a-f]{6,}-/i, '');
      out += '<span class="cx-att">' + esc(name) + '</span>';
      last = m.index + m[0].length;
    }
    return out + esc(text.slice(last));
  }
  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    var h = d.getHours(), ap = h >= 12 ? 'pm' : 'am';
    h = h % 12; if (!h) h = 12;
    return mo + ' ' + d.getDate() + ' · ' + h + ':' + String(d.getMinutes()).padStart(2, '0') + ap;
  }

  window.__chapters = function (opts) {
    opts = opts || {};
    var list = opts.chapters || [];
    var mount = document.getElementById(opts.mount ? opts.mount.replace('#', '') : 'chapters');
    if (!mount) return;
    mount.className = 'cx';
    mount.setAttribute('data-nostop', '');

    var open = null;                       // one at a time — her spec
    var level = {};                        // per chapter, session-only

    list.forEach(function (ch, i) {
      var el = document.createElement('div');
      el.className = 'cx-ch';
      el.setAttribute('data-item', ch.id);  // her note keys off this

      var head = document.createElement('button');
      head.className = 'cx-head';
      head.innerHTML = '<span class="cx-n">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="cx-t">' + esc(ch.title) + '</span>' +
        '<span class="cx-when">' + esc(ch.when || '') + '</span>';
      el.appendChild(head);

      var bodyEl = document.createElement('div');
      bodyEl.className = 'cx-body';
      bodyEl.hidden = true;
      el.appendChild(bodyEl);

      function paint() {
        var lv = level[ch.id] || 1;
        var h = '<div class="cx-lv">';
        LEVELS.forEach(function (L) {
          h += '<button data-lv="' + L[0] + '"' + (String(lv) === L[0] ? ' class="on"' : '') +
            '><span class="cx-num">' + L[0] + '</span>' + L[1] + '</button>';
        });
        h += '</div>';
        if (lv < 3) {
          h += '<p class="cx-l1">' + line(ch.l1 || '') + '</p>';
          if (lv === 2 && (ch.l2 || []).length) {
            h += '<ul class="cx-l2">';
            ch.l2.forEach(function (x) { h += '<li>' + line(x) + '</li>'; });
            h += '</ul>';
          }
        } else {
          var msgs = ch.msgs || [];
          h += '<div class="cx-count">' + msgs.length + ' messages</div><div class="cx-raw">';
          msgs.forEach(function (m) {
            var me = m.who === 'sophie';
            h += '<div class="cx-msg ' + (me ? 'me' : 'them') + '">' +
              '<span class="cx-who">' + (me ? 'me' : 'claude') + ' · ' + esc(when(m.at)) + '</span>' +
              '<div class="cx-text">' + body(m.text || '') + '</div></div>';
          });
          h += '</div>';
        }
        bodyEl.innerHTML = h;
        bodyEl.querySelectorAll('.cx-lv button').forEach(function (b) {
          b.onclick = function (ev) {
            ev.stopPropagation();
            level[ch.id] = Number(b.getAttribute('data-lv'));
            paint();
          };
        });
      }

      head.onclick = function () {
        if (open === el) {                       // tapping the open one closes it
          el.classList.remove('on'); bodyEl.hidden = true; open = null; return;
        }
        if (open) {                              // the rest collapse — her spec
          open.classList.remove('on');
          open.querySelector('.cx-body').hidden = true;
        }
        open = el;
        el.classList.add('on');
        paint();
        bodyEl.hidden = false;
        if (window.__scrollStop) window.__scrollStop();
        var top = el.getBoundingClientRect().top + window.scrollY - 8;
        window.scrollTo(0, top);
      };

      mount.appendChild(el);
    });

    if (opts.chat && opts.sheet && window.__compareNotes) {
      window.__compareNotes({ chat: opts.chat, sheet: opts.sheet });
    }
  };
})();
