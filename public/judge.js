/* judge.js — the JUDGE page (Aug 2026, Sophie's ask: "a Tinder style page
   where I can pick and choose things quickly").

   One thing at a time, big, NO SCROLLING ("I hate scrolling") — tap a verdict
   and the next one appears. Four verdicts, her spec:

     ♥  love          → verdict true   (the same boolean older vote readers use)
     ✕  pass          → verdict false
     ◌  maybe         → verdict 'maybe'   (a real pile, reviewable)
     →  later         → verdict 'later'   (declined to sort NOW — grouped so
                                           she can come back to all of them)

   Include after /compare.js on a page built from judge-shell.html:

     <link rel="stylesheet" href="/compare.css">
     <div class="wrap"> …eyebrow / h1 / one-line sub… <div id="judge"></div></div>
     <script src="/compare.js"></script>
     <script src="/judge.js"></script>
     <script>(function(){ window.__judge({ chat, sheet, items }); })();</script>

   items: [{ id, label, img, full? }]                     — one picture
        | [{ id, label, pair: [{img,label},{img,label}] }] — a labeled
          side-by-side judged as ONE thing (medium vs high, PDF page vs text —
          the compare-and-choose case).
        | [{ id, label, card: '<html>' }]                  — a TEXT card (Aug
          2026, the chat-survey page): `card` is PAGE-AUTHORED trusted HTML
          rendered in the picture's place — never user/remote input. In the
          piles view a card item shows as a small text tile named by `label`.

   Verdicts save LIVE to the chat's verdict doc (POST /api/chatfeed/verdict,
   ok = true/false/'maybe'/'later'), so a chat reads them back with
   GET /api/chatfeed/verdict?chat=&sheet= exactly like vote chips. Notes ride
   the same doc's text field (the standing every-reviewable-thing rule).
   Reopening the page resumes at the first unjudged item; when everything is
   judged it opens on the PILES view — Loved / Maybe / Later / Passed — where
   tapping any tile re-opens that item to re-judge it.

   Style: minimal, cream, the Chats-app look — compare.css provides the tokens
   (which also keep the injected pill styled right). Icon-first controls, so
   the "?" circle explains them (the house rule for icon-first tools). */
(function () {
  if (window.__judge) return;

  var css = document.createElement('style');
  css.textContent =
    '.jg{max-width:680px;margin:0 auto;}' +
    '.jg-top{display:flex;align-items:center;gap:10px;padding:2px 56px 10px 0;}' +
    '.jg-count{font:600 12px/1 -apple-system,sans-serif;color:var(--ink2);letter-spacing:.04em;}' +
    '.jg-ic{width:30px;height:30px;border-radius:50%;border:1.5px solid var(--gold);' +
    ' background:var(--surface);color:var(--gold);display:flex;align-items:center;' +
    ' justify-content:center;padding:0;margin-left:auto;}' +
    '.jg-ic+.jg-ic{margin-left:0;}' +
    '.jg-ic svg{width:15px;height:15px;}' +
    '.jg-ic.txt{font:700 15px/1 Georgia,serif;}' +
    // position:relative because the note + is pinned in this card's corner
    // (compare.css .cmp-note-open — see the note-affordance rule there)
    '.jg-card{background:var(--surface);border:1px solid var(--line);border-radius:6px;' +
    ' padding:12px;position:relative;}' +
    '.jg-media{display:flex;gap:8px;justify-content:center;}' +
    '.jg-media figure{margin:0;flex:1;min-width:0;text-align:center;}' +
    '.jg-media .tag{display:block;font:700 11px/1 -apple-system,sans-serif;' +
    ' letter-spacing:.08em;text-transform:uppercase;color:var(--gold);padding-bottom:5px;}' +
    '.jg-media img{max-width:100%;max-height:52vh;width:auto;height:auto;' +
    ' object-fit:contain;border-radius:6px;display:inline-block;}' +
    '.jg-label{font-size:15px;color:var(--ink);padding-top:8px;text-align:center;}' +
    '.jg-row{display:flex;justify-content:center;gap:18px;padding:16px 0 6px;}' +
    '.jg-btn{width:54px;height:54px;border-radius:50%;border:1.5px solid var(--line);' +
    ' background:var(--surface);display:flex;align-items:center;justify-content:center;padding:0;}' +
    '.jg-btn svg{width:24px;height:24px;}' +
    '.jg-btn.no{color:var(--rose);border-color:var(--rose);}' +
    '.jg-btn.later{color:var(--ink2);}' +
    '.jg-btn.maybe{color:var(--gold);}' +
    '.jg-btn.yes{color:var(--chg);border-color:var(--chg);}' +
    '.jg-piles h2{margin-top:22px;}' +
    '.jg-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}' +
    '.jg-grid button{border:1px solid var(--line);border-radius:6px;background:var(--surface);' +
    ' padding:0;overflow:hidden;aspect-ratio:1;}' +
    '.jg-grid img{width:100%;height:100%;object-fit:cover;display:block;}' +
    '.jg-grid button.txt{aspect-ratio:auto;min-height:64px;padding:6px;' +
    ' font-size:12px;line-height:1.3;color:var(--ink);word-break:break-word;}' +
    '.jg-cardtext{font-size:15px;line-height:1.5;color:var(--ink);text-align:left;' +
    ' overflow-y:auto;max-height:58vh;}' +
    '.jg-cardtext a{color:var(--gold);}' +
    '.jg-help{position:fixed;inset:0;background:rgba(20,18,15,.35);z-index:50;' +
    ' display:flex;align-items:center;justify-content:center;padding:24px;}' +
    '.jg-help>div{background:var(--surface);border:1px solid var(--line);border-radius:6px;' +
    ' padding:16px 18px;max-width:340px;font-size:15px;}' +
    '.jg-help b{color:var(--gold);font-family:-apple-system,sans-serif;font-size:13px;}' +
    '.jg-flash{animation:jgf .18s;}@keyframes jgf{from{opacity:.35}to{opacity:1}}';
  document.head.appendChild(css);

  // the note + — same glyph compare.js draws, so the mark reads the same
  // wherever she meets it
  var PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

  var I = {
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    maybe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-dasharray="3.5 3.5"/></svg>',
    later: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  };
  var PILES = [
    { key: true,    name: 'Loved' },
    { key: 'maybe', name: 'Maybe' },
    { key: 'later', name: 'Later' },
    { key: false,   name: 'Passed' },
    { key: undefined, name: 'Unsorted' },
  ];

  window.__judge = function (opts) {
    opts = opts || {};
    var chat = opts.chat, sheet = opts.sheet;
    var items = (opts.items || []).filter(function (it) { return it && it.id; });
    var mount = document.querySelector(opts.mount || '#judge');
    if (!mount || !items.length) return;

    var verdicts = {}, notes = {}, undoStack = [], cur = 0, view = 'card';
    var noteTimer = null;

    function post(body) {
      body.chat = chat; body.sheet = sheet;
      return fetch('/api/chatfeed/verdict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(function () { /* offline — local state still holds */ });
    }
    function saveNote(id, text) {
      notes[id] = text;
      clearTimeout(noteTimer);
      noteTimer = setTimeout(function () { post({ item: id, text: text }); }, 700);
    }
    window.addEventListener('pagehide', function () {
      // a half-typed note survives leaving (same contract as __compareNotes)
      var box = mount.querySelector('.cmp-note-box');
      var it = items[cur];
      if (!box || !it || !box.value.trim()) return;
      try {
        navigator.sendBeacon('/api/chatfeed/verdict', new Blob([JSON.stringify({
          chat: chat, sheet: sheet, item: it.id, text: box.value,
        })], { type: 'application/json' }));
      } catch (_) { /* nothing else to do */ }
    });

    function firstUnjudged() {
      for (var i = 0; i < items.length; i++) if (verdicts[items[i].id] === undefined) return i;
      return -1;
    }
    function judge(val) {
      var it = items[cur];
      undoStack.push({ i: cur, prev: verdicts[it.id] });
      verdicts[it.id] = val;
      post({ item: it.id, ok: val });
      var next = firstUnjudged();
      if (next === -1) { view = 'piles'; } else { cur = next; }
      render(true);
    }
    function undo() {
      var u = undoStack.pop();
      if (!u) return;
      var it = items[u.i];
      if (u.prev === undefined) { delete verdicts[it.id]; post({ item: it.id, ok: null }); }
      else { verdicts[it.id] = u.prev; post({ item: it.id, ok: u.prev }); }
      cur = u.i; view = 'card'; render(true);
    }

    function mediaHtml(it) {
      // page-authored trusted HTML judged in the picture's place (see header)
      if (it.card) return '<div class="jg-cardtext">' + it.card + '</div>';
      if (it.pair) {
        return '<div class="jg-media">' + it.pair.map(function (p) {
          return '<figure><span class="tag">' + esc(p.label || '') + '</span>'
            + '<img class="zoom" src="' + esc(p.img) + '" alt="' + esc(p.label || '') + '"'
            + (p.full ? ' data-full="' + esc(p.full) + '"' : '') + '></figure>';
        }).join('') + '</div>';
      }
      return '<div class="jg-media"><figure><img class="zoom" src="' + esc(it.img) + '"'
        + ' alt="' + esc(it.label || '') + '"'
        + (it.full ? ' data-full="' + esc(it.full) + '"' : '') + '></figure></div>';
    }
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function render(flash) {
      var judged = items.filter(function (it) { return verdicts[it.id] !== undefined; }).length;
      var top = '<div class="jg-top"><span class="jg-count">'
        + (view === 'piles' ? judged + ' of ' + items.length + ' sorted'
                            : (cur + 1) + ' of ' + items.length) + '</span>'
        + '<button class="jg-ic" data-act="undo" aria-label="Undo">' + I.undo + '</button>'
        + '<button class="jg-ic" data-act="piles" aria-label="Piles">' + I.grid + '</button>'
        + '<button class="jg-ic txt" data-act="help" aria-label="What the icons mean">?</button></div>';

      // data-nostop: in the app a Compare page is EMBEDDED (chats.html's
      // parent pill + its tap-to-toggle gesture on this document). A judge
      // page has nothing to scroll, so no tap here may ever START the scroll.
      if (view === 'piles') {
        var sections = PILES.map(function (p) {
          var members = items.filter(function (it) { return verdicts[it.id] === p.key; });
          if (!members.length) return '';
          return '<h2>' + p.name + ' · ' + members.length + '</h2><div class="jg-grid">'
            + members.map(function (it) {
              if (it.card) {
                return '<button class="txt" data-open="' + esc(it.id) + '">'
                  + esc(it.label || it.id) + '</button>';
              }
              var src = it.pair ? it.pair[0].img : it.img;
              return '<button data-open="' + esc(it.id) + '"><img src="' + esc(src)
                + '" alt="' + esc(it.label || '') + '"></button>';
            }).join('') + '</div>';
        }).join('');
        mount.innerHTML = '<div class="jg" data-nostop>' + top + '<div class="jg-piles">'
          + (sections || '<p class="mini">Nothing here yet.</p>') + '</div></div>';
      } else {
        var it = items[cur];
        mount.innerHTML = '<div class="jg" data-nostop>' + top
          + '<div class="jg-card' + (flash ? ' jg-flash' : '') + '">'
          + mediaHtml(it)
          + (it.label ? '<div class="jg-label">' + esc(it.label) + '</div>' : '')
          // the note is a small + in the card's bottom-right corner; a
          // written one SHOWS as her words, never as an open textarea
          // (Sophie, Aug 2026 — same contract as compare.js's __compareNotes)
          + '<div class="cmp-note' + (notes[it.id] ? ' has' : '') + '">'
          + '<button type="button" class="cmp-note-open" aria-label="a note about this one">'
          + PLUS_SVG + '</button>'
          + '<div class="cmp-note-text"></div>'
          + '<textarea class="cmp-note-box" rows="2" placeholder="write back…"></textarea></div>'
          + '</div>'
          + '<div class="jg-row">'
          + '<button class="jg-btn no" data-act="no" aria-label="Pass">' + I.x + '</button>'
          + '<button class="jg-btn later" data-act="later" aria-label="Sort later">' + I.later + '</button>'
          + '<button class="jg-btn maybe" data-act="maybe" aria-label="Maybe">' + I.maybe + '</button>'
          + '<button class="jg-btn yes" data-act="yes" aria-label="Love">' + I.heart + '</button>'
          + '</div></div>';
        var box = mount.querySelector('.cmp-note-box');
        var open = mount.querySelector('.cmp-note-open');
        // the thread is painted by the shared kit, so hers and the chat's
        // messages read the same here as on a Compare page; the box always
        // writes the NEXT message and never edits an earlier one
        var wrap = mount.querySelector('.cmp-note');
        var shownNote = mount.querySelector('.cmp-note-text');
        var S = window.__compareShell || {};
        var msgs = S.paintNote ? S.paintNote(wrap, notes[it.id] || '') : [];
        function openBox() { box.value = ''; wrap.classList.add('open'); box.focus(); }
        if (open) open.addEventListener('click', function () {
          if (wrap.classList.contains('open')) { box.blur(); return; }
          openBox();
        });
        if (shownNote) shownNote.addEventListener('click', openBox);
        if (box) box.addEventListener('input', function () {
          saveNote(it.id, S.threadField ? S.threadField(msgs, box.value) : box.value);
        });
        if (box) box.addEventListener('blur', function () {
          var draft = box.value.trim();
          if (draft) {
            saveNote(it.id, S.threadField ? S.threadField(msgs, draft) : draft);
            msgs = S.paintNote ? S.paintNote(wrap, notes[it.id]) : msgs;
          }
          wrap.classList.remove('open');
        });
      }
    }

    function showHelp() {
      var h = document.createElement('div');
      h.className = 'jg-help';
      h.innerHTML = '<div><b>THE BUTTONS</b><br>♥ love it · ✕ pass ·'
        + ' dashed circle = maybe (its own pile) · arrow = sort it later.<br>'
        + 'Top row: undo the last one, the grid shows every pile —'
        + ' tap any picture there to judge it again.</div>';
      h.addEventListener('click', function () { h.remove(); });
      document.body.appendChild(h);
    }

    mount.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-act],[data-open]') : null;
      if (!b) return;
      var open = b.getAttribute('data-open');
      if (open !== null && open !== undefined && open !== '') {
        cur = items.findIndex(function (it) { return it.id === open; });
        if (cur < 0) cur = 0;
        view = 'card'; render(true); return;
      }
      var act = b.getAttribute('data-act');
      if (act === 'yes') judge(true);
      else if (act === 'no') judge(false);
      else if (act === 'maybe') judge('maybe');
      else if (act === 'later') judge('later');
      else if (act === 'undo') undo();
      else if (act === 'help') showHelp();
      else if (act === 'piles') { view = view === 'piles' ? 'card' : 'piles'; render(); }
    });

    // resume: her earlier verdicts and notes come back off the doc
    fetch('/api/chatfeed/verdict?chat=' + encodeURIComponent(chat)
      + '&sheet=' + encodeURIComponent(sheet))
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (d) {
        var iv = (d && d.items) || {}, tx = (d && d.texts) || {};
        items.forEach(function (it) {
          if (iv[it.id] !== undefined && iv[it.id] !== null) verdicts[it.id] = iv[it.id];
          if (tx[it.id]) notes[it.id] = tx[it.id];
        });
        var next = firstUnjudged();
        if (next === -1) view = 'piles'; else cur = next;
        render();
      });

    render();
  };
})();
