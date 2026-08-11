/* compare.js — the shared BEHAVIOUR half of a Compare page (Aug 2026, Sophie's
   ask: "a shell every chat can use for their compare page that has the auto
   scroll pill with everything exempt").

   compare.css gives a page the one house look; this gives it the one house
   behaviour. Include it once, after the content:

     <link rel="stylesheet" href="/compare.css">
     ...
     <script src="/compare.js"></script>

   That is the whole integration. It wires, correctly, the three things every
   hand-rolled Compare page has got wrong at least once:

   1. ANY TAP PAUSES THE AUTOSCROLL — Sophie's rule: while she is voting,
      typing or tapping anything, the page must not keep creeping underneath
      her. Capture phase, so it fires even when the tap lands on a button.
   2. …EXCEPT ON THE PILL ITSELF. `__scrollStop` repaints the pill's glyphs,
      and swapping the tapped element out mid-press EATS the click — an
      unconditional handler makes the pill's own play button dead. Found live
      on Cut Marks, fixed again on the Cutting Room; now it cannot recur.
      Anything inside `[data-nostop]` is skipped too, for a control that must
      not disturb playback.
   3. OPENING AN IMAGE FREEZES THE PAGE BEHIND IT — autoscroll stopped,
      background scroll locked, AND the scroll position saved on open and
      restored on close (locking alone does not stop `window.scrollBy`, so
      anything that restarts the scroll under the overlay still moves the
      page — this bit her repeatedly).
   4. AN EXTERNAL LINK LEAVES THE IFRAME instead of navigating it. In the app
      a Compare page runs EMBEDDED (chats.html opens it in an iframe with
      `?embed=1`), so a plain `<a href="https://claude.ai/…">` tries to load
      that site INSIDE the frame — and claude.ai sends
      `x-frame-options: SAMEORIGIN` (verified 2026-08-10), so the load is
      refused and the tap reads as bouncing back to the page. Sophie hit this
      on the chat-survey page's "Open the chat" link. An off-origin link is
      therefore opened from the TOP document with `target="_blank"` — exactly
      what the Chats app's own Open button does — and never navigates the
      web view away from the app.

   The pill itself is INJECTED BY THE SERVER on every served page — never add
   your own, and never re-implement its script. This file only talks to it
   through the globals it publishes (`__scrollStop`, `__pillInteractive`).

   Everything here is inside an IIFE on purpose: the injected pill snippet runs
   in GLOBAL scope and declares `var raf`, `var I`, `var playing`, … A page (or
   a shared script) that declares those at top level kills the pill's script at
   PARSE time. Your own page script must be wrapped the same way.
*/
(function () {
  if (window.__compareShell) return;          // safe to include twice
  window.__compareShell = { version: 1 };

  /* 1 + 2 — any tap pauses, the pill and opted-out controls exempt. */
  document.addEventListener('pointerdown', function (e) {
    var t = e.target;
    try {
      if (t && t.closest && (t.closest('.float') || t.closest('[data-nostop]'))) return;
    } catch (_) { /* a non-element target (text node in odd browsers) — carry on */ }
    if (window.__scrollStop) window.__scrollStop();
  }, true);

  /* 3 — the image lightbox. Opt in per image with class="zoom", or get it for
     free on any image inside the skeleton's .imgrow block. */
  var lb = null, savedY = 0;

  function ensureLightbox() {
    if (lb) return lb;
    lb = document.createElement('div');
    lb.className = 'cmp-lb';
    lb.setAttribute('hidden', '');
    lb.innerHTML = '<img alt="">';
    lb.addEventListener('click', close);
    document.body.appendChild(lb);
    var css = document.createElement('style');
    css.textContent =
      '.cmp-lb{position:fixed; inset:0; z-index:60; background:rgba(20,18,15,.92);' +
      ' display:flex; align-items:center; justify-content:center; padding:16px; cursor:zoom-out;}' +
      '.cmp-lb[hidden]{display:none !important;}' +
      '.cmp-lb img{max-width:100%; max-height:100%; object-fit:contain; border-radius:4px;}';
    document.head.appendChild(css);
    return lb;
  }

  function open(src, alt) {
    var el = ensureLightbox();
    savedY = window.scrollY;                       // restored on close, always
    if (window.__scrollStop) window.__scrollStop();
    el.querySelector('img').src = src;
    el.querySelector('img').alt = alt || '';
    el.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!lb || lb.hasAttribute('hidden')) return;
    lb.setAttribute('hidden', '');
    document.body.style.overflow = '';
    window.scrollTo(0, savedY);        // exactly where she opened it, whatever
  }                                    // happened behind the overlay

  document.addEventListener('click', function (e) {
    // .duo joined the list (Aug 2026): a labeled side-by-side's images are as
    // tappable as any other picture on a Compare page.
    var img = e.target && e.target.closest ? e.target.closest('img.zoom, .imgrow img, .duo img') : null;
    if (!img) return;
    e.preventDefault();
    open(img.getAttribute('data-full') || img.src, img.alt);
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  window.__compareShell.openImage = open;
  window.__compareShell.closeImage = close;

  /* 4 — an EXTERNAL link must leave the iframe, never navigate it (see the
     header). Only off-origin http(s) links are touched: a relative or
     same-origin link is the page's own business, and an in-page `#anchor`
     must keep working. Standalone (not embedded) pages are left alone too —
     an ordinary link is already right there. */
  function openOut(href) {
    var doc = null;
    // same-origin parent, so this reaches the app's own document; a
    // cross-origin host would throw, and window.open is the fallback.
    try { doc = window.top.document; } catch (_) { doc = null; }
    if (doc && doc.body) {
      var a = doc.createElement('a');
      a.href = href; a.target = '_blank'; a.rel = 'noopener';
      doc.body.appendChild(a);
      a.click();
      doc.body.removeChild(a);
      return true;
    }
    return !!window.open(href, '_blank', 'noopener');
  }
  document.addEventListener('click', function (e) {
    if (window.top === window.self) return;              // not embedded
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.href;                                   // resolved, absolute
    if (!/^https?:/i.test(href)) return;                 // mailto:, #anchor, …
    if (a.origin === window.location.origin) return;     // our own pages
    e.preventDefault();
    openOut(href);
  });
  window.__compareShell.openExternal = openOut;

  /* 5 — THE FILM ROW: a finished video is A LINE OF TEXT WITH A PLAY BUTTON
     at the TOP of the page, never an embedded <video> (Aug 2026, Sophie:
     "never put a whole video when it's gonna be opened as a lightbox anyway,
     it should just be a line of text with a play button… so I don't just
     scroll through the whole thing").

     Why: a <video> at the top is a huge black box she has to scroll past
     every time she opens the page — and tapping it goes fullscreen anyway,
     so the box bought nothing. The row is one line; the film opens over the
     page when she asks for it.

         <div id="film"></div>
         window.__filmRow({ url: '…/cut-v2.mp4', label: 'Mason — the shape',
                            meta: '4:56', mount: '#film' });

     Same overlay contract as the image lightbox: autoscroll stopped, page
     locked, scroll position restored on close, and the video is torn down on
     close so it can never keep playing behind the page. */
  var vlb = null, vSavedY = 0;
  function ensureVideoLB() {
    if (vlb) return vlb;
    vlb = document.createElement('div');
    vlb.className = 'cmp-vlb';
    vlb.setAttribute('hidden', '');
    vlb.innerHTML = '<button class="cmp-vlb-x" aria-label="Close">✕</button>'
      + '<video controls playsinline preload="metadata"></video>';
    vlb.addEventListener('click', function (e) {
      // only the backdrop and the ✕ close it — a tap on the controls must not
      if (e.target === vlb || (e.target.className || '') === 'cmp-vlb-x') closeVideo();
    });
    document.body.appendChild(vlb);
    var css = document.createElement('style');
    css.textContent =
      '.cmp-vlb{position:fixed; inset:0; z-index:61; background:rgba(20,18,15,.94);'
      + ' display:flex; align-items:center; justify-content:center; padding:14px;}'
      + '.cmp-vlb[hidden]{display:none !important;}'
      + '.cmp-vlb video{max-width:100%; max-height:100%; border-radius:4px; background:#000;}'
      + '.cmp-vlb-x{position:absolute; top:max(10px,env(safe-area-inset-top)); right:12px;'
      + ' width:38px; height:38px; border-radius:50%; border:1.5px solid #fff; background:rgba(0,0,0,.35);'
      + ' color:#fff; font-size:17px; line-height:1; cursor:pointer;}'
      + '.cmp-film{display:flex; align-items:center; gap:10px; width:100%; text-align:left;'
      + ' padding:10px 12px; margin:10px 0 4px; border:1.5px solid var(--ink,#2b2724);'
      + ' border-radius:6px; background:var(--paper,#fff); color:var(--ink,#2b2724);'
      + ' font:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent;}'
      + '.cmp-film .g{flex:0 0 auto; width:30px; height:30px; border-radius:50%;'
      + ' border:1.5px solid var(--ink,#2b2724); display:flex; align-items:center; justify-content:center;}'
      + '.cmp-film .t{flex:1 1 auto; font-size:15px;}'
      + '.cmp-film .m{flex:0 0 auto; font-size:12.5px; color:var(--ink2,#7a736c);}';
    document.head.appendChild(css);
    return vlb;
  }
  function openVideo(src, poster) {
    var el = ensureVideoLB();
    vSavedY = window.scrollY;
    if (window.__scrollStop) window.__scrollStop();
    var v = el.querySelector('video');
    v.src = src;
    if (poster) v.poster = poster;
    el.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    var p = v.play();                       // inside the tap, so iOS allows it
    if (p && p.catch) p.catch(function () { /* she can press play herself */ });
  }
  function closeVideo() {
    if (!vlb || vlb.hasAttribute('hidden')) return;
    var v = vlb.querySelector('video');
    try { v.pause(); } catch (_) { /* already gone */ }
    v.removeAttribute('src'); v.load();     // or it keeps playing behind the page
    vlb.setAttribute('hidden', '');
    document.body.style.overflow = '';
    window.scrollTo(0, vSavedY);
  }
  window.__filmRow = function (opts) {
    opts = opts || {};
    if (!opts.url) return null;
    var mount = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
    if (!mount) {                            // no mount given: under the header
      var wrap = document.querySelector('.wrap') || document.body;
      mount = document.createElement('div');
      var after = wrap.querySelector('.sub') || wrap.querySelector('h1') || wrap.querySelector('.eyebrow');
      if (after && after.parentNode === wrap) wrap.insertBefore(mount, after.nextSibling);
      else wrap.insertBefore(mount, wrap.firstChild);
    }
    var b = document.createElement('button');
    b.className = 'cmp-film';
    b.type = 'button';
    b.innerHTML = '<span class="g"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"'
      + ' stroke="currentColor" stroke-width="1" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg></span>'
      + '<span class="t"></span><span class="m"></span>';
    b.querySelector('.t').textContent = opts.label || 'Play the film';
    b.querySelector('.m').textContent = opts.meta || '';
    b.addEventListener('click', function () { openVideo(opts.url, opts.poster); });
    mount.appendChild(b);
    return b;
  };
  window.__compareShell.openVideo = openVideo;
  window.__compareShell.closeVideo = closeVideo;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeVideo(); });

  /* 6 — NOTES ON ANYTHING (Aug 2026, Sophie's standing rule: "whenever
     applicable notes should be able to be added"). Reviewing is not only
     yes/no — she needs to say WHY, or what to change, next to the thing
     itself. So every Compare page that shows reviewable items gets a note
     box per item, and it lives here rather than being hand-rolled per page.

     Wire it in one line, after your items are in the DOM:

       window.__compareNotes({ chat: 'my-chat', sheet: 'page-thing-v1' });

     Every element carrying `data-item="<id>"` gets a note affordance: a
     SMALL + IN THAT ITEM'S BOTTOM-RIGHT CORNER (Aug 2026, Sophie — v1 put a
     "+ note" button on its own line under every item and left a written note
     open in a textarea, which "takes up too much space and makes it hard to
     see everything at once"). Three states: nothing written is just the +
     and costs no height; a written note SHOWS as her words under the item
     ("if I left a note, make it show"); tapping either opens the textarea,
     which folds back on blur. Never open a written note into a textarea just
     to display it, and never put an empty one back in flow.

     ANSWER HER ON THE NOTE ITSELF. A note is a conversation, not a comment
     box — she asked for replies to land there ("otherwise I forget what
     we're talking about"), so a chat appends its answer to the same field
     and she writes back under it. Read them with
     GET /api/chatfeed/verdict?chat=&sheet= → texts, and POST the whole
     field back with your line added. Keep it short; the field caps at 2000.
     Notes
     save to the SAME verdict doc as votes but a DIFFERENT field (`text` vs
     `ok`), so writing one never clears the other — read both back with
     GET /api/chatfeed/verdict?chat=&sheet= → { items, texts }.

     Never post a note to /api/chatfeed/reply: a note on a page is not a chat
     message (the server reroutes it anyway, but say what you mean).

     Saving is debounced while she types and flushed on blur and on pagehide,
     so a note is never lost by navigating away mid-sentence. */
  var noteCfg = null, noteTimers = {};

  function postNote(item, text) {
    if (!noteCfg) return Promise.resolve();
    return fetch('/api/chatfeed/verdict', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: noteCfg.chat, sheet: noteCfg.sheet, item: item, text: text }),
    }).catch(function () { /* offline — the text stays in the box */ });
  }

  var PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    + 'stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

  function buildNote(host, item, existing) {
    if (host.querySelector(':scope > .cmp-note')) return;
    // the + is pinned in the item's corner, so the host has to be the
    // positioning context — set here rather than in compare.css, so a page's
    // own layout for [data-item] is never overridden
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    var wrap = document.createElement('div');
    wrap.className = 'cmp-note';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cmp-note-open';
    btn.setAttribute('aria-label', 'a note about this one');
    btn.innerHTML = PLUS_SVG;
    var shown = document.createElement('div');
    shown.className = 'cmp-note-text';
    var caret = document.createElement('button');
    caret.type = 'button'; caret.className = 'cmp-note-more';
    var box = document.createElement('textarea');
    box.className = 'cmp-note-box';
    box.rows = 2;
    box.placeholder = 'a note about this one…';
    var flag = document.createElement('span');
    flag.className = 'cmp-note-saved';
    flag.textContent = 'saved';
    wrap.appendChild(btn); wrap.appendChild(shown); wrap.appendChild(caret);
    wrap.appendChild(box); wrap.appendChild(flag);
    host.appendChild(wrap);

    // A written note SHOWS as her words (Aug 2026, Sophie: "if I left a note,
    // make it show") — not as an open textarea, which is what made every item
    // cost a box whether or not she had written in it. An empty one is just
    // the + and costs nothing.
    //
    // And it shows as a THREAD, hers and mine in separate blocks (Sophie,
    // Aug 2026: "I don't know why I'm responding inside of your message.
    // That's strange" — v1 handed her the whole field in one textarea, so
    // answering meant typing inside my paragraph). Writing now APPENDS a new
    // message; only the last block is ever hers to extend.
    var thread = [], current = '';   // `current` is the field; the box is only a draft
    function display() {
      thread = parseThread(current);
      wrap.classList.toggle('has', !!thread.length);
      renderThread(shown, thread);
      // more than one message folds down to the newest (Sophie: "also
      // collapse the messages anyway")
      var many = thread.length > 1;
      caret.hidden = !many;
      wrap.classList.toggle('foldable', many);
      if (many && !wrap.dataset.opened) wrap.classList.add('folded');
      if (!many) wrap.classList.remove('folded');
      caret.textContent = (thread.length - 1) + ' earlier';
    }
    if (existing) { current = existing; box.dataset.touched = '1'; }
    display();

    // the box is always EMPTY: it writes the NEXT message, never edits mine
    function open() {
      box.value = '';
      wrap.classList.add('open');
      wrap.classList.remove('folded'); wrap.dataset.opened = '1';
      box.focus();
    }
    btn.addEventListener('click', function () {
      if (wrap.classList.contains('open')) { box.blur(); return; }
      open();
    });
    caret.addEventListener('click', function () {
      wrap.classList.toggle('folded');
      wrap.dataset.opened = '1';
    });
    shown.addEventListener('click', open);   // tap the thread to write back
    // saving writes the WHOLE thread back — her draft appended as one new
    // message — so a debounced save mid-sentence can't lose the earlier ones
    function fieldWith(draft) {
      var msgs = thread.concat(draft.trim() ? [{ who: 'me', text: draft.trim() }] : []);
      return msgs.map(function (m) { return '— ' + (m.who === 'claude' ? 'Claude' : 'me') + ': ' + m.text; })
        .join('\n\n');
    }
    box._cmpField = fieldWith;      // the pagehide beacon needs the thread too
    function save() {
      flag.classList.remove('on');
      postNote(item, fieldWith(box.value)).then(function () {   // draft included

        flag.classList.add('on');
        setTimeout(function () { flag.classList.remove('on'); }, 1200);
      });
    }
    box.addEventListener('input', function () {
      clearTimeout(noteTimers[item]);
      noteTimers[item] = setTimeout(save, 700);
    });
    box.addEventListener('blur', function () {
      clearTimeout(noteTimers[item]);
      var draft = box.value.trim();
      if (draft) {
        // commit the draft INTO the field, then empty the box. The box must
        // never hold the thread: a second blur (the synthetic one a test
        // fires, or a re-focus) would then append the whole thread to itself.
        current = fieldWith(draft);
        box.dataset.touched = '1';
        box.value = '';
        flag.classList.remove('on');
        postNote(item, current).then(function () {
          flag.classList.add('on');
          setTimeout(function () { flag.classList.remove('on'); }, 1200);
        });
      }
      // always fold back — the textarea is for writing the next message,
      // the thread is what stays on the page
      display();
      wrap.classList.remove('open');
    });
  }

  /* A note is a CONVERSATION, so the one text field carries both voices,
     each message on its own `— me:` / `— Claude:` line. Anything before the
     first marker is hers (every note written before this existed). */
  function parseThread(text) {
    var out = [];
    String(text || '').split(/\n(?=—\s*(?:me|Claude)\s*:)/).forEach(function (chunk) {
      var s = chunk.trim();
      if (!s) return;
      var m = /^—\s*(me|Claude)\s*:\s*/i.exec(s);
      out.push({
        who: m && m[1].toLowerCase() === 'claude' ? 'claude' : 'me',
        text: m ? s.slice(m[0].length).trim() : s,
      });
    });
    return out.filter(function (m) { return m.text; });
  }

  function renderThread(host, msgs) {
    host.textContent = '';
    msgs.forEach(function (m, i) {
      var d = document.createElement('div');
      d.className = 'cmp-msg ' + m.who + (i === msgs.length - 1 ? ' last' : '');
      var who = document.createElement('span');
      who.className = 'cmp-msg-who';
      who.textContent = m.who === 'claude' ? 'Claude' : 'me';
      var p = document.createElement('div');
      p.className = 'cmp-msg-t';
      p.textContent = m.text;
      d.appendChild(who); d.appendChild(p);
      host.appendChild(d);
    });
  }
  window.__compareShell.parseNoteThread = parseThread;
  // judge.js builds its own card markup, so it paints its note through this
  // rather than re-implementing the thread
  window.__compareShell.paintNote = function (wrap, text) {
    var host = wrap && wrap.querySelector('.cmp-note-text');
    if (!host) return [];
    var msgs = parseThread(text);
    renderThread(host, msgs);
    wrap.classList.toggle('has', !!msgs.length);
    return msgs;
  };
  window.__compareShell.threadField = function (msgs, draft) {
    return msgs.concat(draft && draft.trim() ? [{ who: 'me', text: draft.trim() }] : [])
      .map(function (m) { return '— ' + (m.who === 'claude' ? 'Claude' : 'me') + ': ' + m.text; })
      .join('\n\n');
  };

  window.__compareNotes = function (opts) {
    noteCfg = { chat: (opts || {}).chat, sheet: (opts || {}).sheet };
    var sel = (opts || {}).selector || '[data-item]';
    var hosts = Array.prototype.slice.call(document.querySelectorAll(sel));
    if (!hosts.length || !noteCfg.chat || !noteCfg.sheet) return;
    // prefill from whatever she already wrote, then wire every box
    fetch('/api/chatfeed/verdict?chat=' + encodeURIComponent(noteCfg.chat) +
          '&sheet=' + encodeURIComponent(noteCfg.sheet))
      .then(function (r) { return r.ok ? r.json() : { texts: {} }; })
      .catch(function () { return { texts: {} }; })
      .then(function (d) {
        var texts = (d && d.texts) || {};
        hosts.forEach(function (h) {
          var item = h.getAttribute('data-item');
          if (item) buildNote(h, item, texts[item] || '');
        });
      });
  };

  // a half-typed note must survive leaving the page
  window.addEventListener('pagehide', function () {
    if (!noteCfg) return;
    document.querySelectorAll('.cmp-note-box').forEach(function (box) {
      var item = box.closest('[data-item]');
      if (!item || !box.value.trim()) return;
      try {
        // the box holds only the DRAFT, so the beacon has to send the whole
        // thread with it or an interrupted message would eat the earlier ones
        var full = box._cmpField ? box._cmpField(box.value) : box.value;
        navigator.sendBeacon('/api/chatfeed/verdict', new Blob([JSON.stringify({
          chat: noteCfg.chat, sheet: noteCfg.sheet,
          item: item.getAttribute('data-item'), text: full,
        })], { type: 'application/json' }));
      } catch (_) { /* nothing more we can do here */ }
    });
  });
})();
