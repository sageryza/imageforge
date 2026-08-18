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
    // corner controls need their own strip on a SHORT card: a one-line text
    // card put the mic ON the words and the note + out of reach (Sophie
    // caught it live on the XI deck, Aug 2026) — the bottom padding is the
    // controls\' room, reserved whenever a corner control exists
    '.jg-card.ctl{padding-bottom:52px;}' +
    // the card-face menu (square / portrait / landscape — page-templates.js
    // ASPECTS): the ratio is set INLINE per card so one deck can mix shapes;
    // this class carries the rest — images cover the face, words center in
    // it. width:100% is load-bearing: with only an aspect-ratio, the box
    // resolves its width from the 58vh max-height instead.
    '.jg-media.sq figure{overflow:hidden;border-radius:6px;}' +
    '.jg-media.sq img{width:100%;height:100%;max-height:none;object-fit:cover;}' +
    '.jg-cardtext.sq{width:100%;display:flex;align-items:center;' +
    ' justify-content:center;text-align:center;padding:10%;box-sizing:border-box;' +
    ' max-height:none;overflow-y:auto;}' +
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
    // browse mode paints the card's current verdict on its button
    '.jg-btn.on{background:var(--ink);border-color:var(--ink);color:var(--paper);}' +
    // custom states are her words — chips that hug them (never pills)
    '.jg-chip{border:1.5px solid var(--line);border-radius:6px;background:var(--surface);' +
    ' color:var(--ink2);font:600 13px/1 -apple-system,sans-serif;padding:11px 13px;}' +
    '.jg-chip.on{color:var(--paper);background:var(--ink);border-color:var(--ink);}' +
    // the browse tap zones: the card's left/right edges page the deck; the
    // middle stays the picture's own tap (lightbox)
    '.jg-navzone{position:absolute;top:0;bottom:0;width:26%;background:transparent;' +
    ' border:0;border-radius:0;padding:0;z-index:2;}' +
    '.jg-navzone.prev{left:0;}.jg-navzone.next{right:0;}' +
    // tap-to-record, bottom-left corner (the note + owns bottom-right)
    '.jg-mic{position:absolute;left:8px;bottom:8px;width:30px;height:30px;z-index:3;' +
    ' border-radius:50%;border:1.5px solid var(--line);background:var(--surface);' +
    ' color:var(--ink2);display:flex;align-items:center;justify-content:center;padding:0;}' +
    '.jg-mic svg{width:15px;height:15px;}' +
    '.jg-mic.rec{color:var(--rose);border-color:var(--rose);animation:jgrec 1.1s infinite;}' +
    '@keyframes jgrec{0%,100%{opacity:1}50%{opacity:.45}}' +
    '.jg-toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:70;' +
    ' background:var(--ink);color:var(--paper);border-radius:6px;padding:9px 13px;' +
    ' font:500 13px/1.3 -apple-system,sans-serif;max-width:86vw;}' +
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
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
  };
  var DEFAULT_PILES = [
    { key: true,    name: 'Loved' },
    { key: 'maybe', name: 'Maybe' },
    { key: 'later', name: 'Later' },
    { key: false,   name: 'Passed' },
  ];

  window.__judge = function (opts) {
    opts = opts || {};
    var chat = opts.chat, sheet = opts.sheet;
    var items = (opts.items || []).filter(function (it) { return it && it.id; });
    var mount = document.querySelector(opts.mount || '#judge');
    if (!mount || !items.length) return;

    // THE DECK TEMPLATE'S OPTIONS (Aug 2026, Sophie):
    //   states — her own verdicts ('done' / 'in progress') instead of the
    //            four defaults; strings ride the verdict route as-is.
    //   browse — "you don't have to take any action per card… tapping on the
    //            screen to the right or left goes backwards or forwards":
    //            edge taps (and a swipe) navigate, judging is optional, a
    //            judged card advances one step instead of jumping around.
    //   voice  — a tap-to-record mic on every card; the note lands on the
    //            card as her transcribed message (POST /page-voice).
    var states = Array.isArray(opts.states) && opts.states.length >= 2
      ? opts.states.filter(function (s) { return s && s.label !== undefined; }) : null;
    var browse = !!opts.browse;
    var voice = !!opts.voice;
    var piles = (states
      ? states.map(function (s) { return { key: s.key, name: s.label }; })
      : DEFAULT_PILES).concat([{ key: undefined, name: 'Unsorted' }]);

    var verdicts = {}, notes = {}, undoStack = [], cur = 0, view = 'card';
    var noteTimer = null;

    // ♥/✕ on an asset-backed card lands in the Assets tab too (Sophie: the
    // page and the tab "should agree"). Only the boolean pair mirrors —
    // 'like'/'dislike' are the only words the asset vote speaks.
    function mirrorVote(it, val) {
      if (!it.url) return;
      var vote = val === true ? 'like' : val === false ? 'dislike' : null;
      fetch('/api/gallery/assets/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: chat, url: it.url, vote: vote }),
      }).catch(function () { /* the page's own verdict still saved */ });
    }
    function mirrorNote(it, text) {
      if (!it.url || !text) return;
      fetch('/api/gallery/assets/note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: chat, url: it.url, text: text, from: 'sophie' }),
      }).catch(function () { /* the page's own thread still has it */ });
    }

    // ── THE MIC (Aug 2026). One tap starts, one tap stops — and what happens
    // in between decides which kind of note it is, so there is no mode
    // toggle to remember:
    //   stayed on one card  → the transcript lands on THAT card
    //     (pinned to where the recording STARTED, so finishing a sentence
    //     while swiping onward cannot mis-file it — POST /page-voice);
    //   swiped while talking → HANDS-FREE: the page logs when each card came
    //     up, the server transcribes once with sentence start-times, and
    //     each sentence lands on the card showing when she STARTED saying it
    //     (POST /page-voice-session; built the day her in-app mic probe
    //     passed, 2026-08-17). Every note carries the recording's url and
    //     its card's timestamp, so the original is always a tap away.
    var mrec = null, recIt = null, recStart = 0, recTimeline = null;
    function recActive() { return !!mrec; }
    function toast(msg) {
      var t = document.createElement('div');
      t.className = 'jg-toast';
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 3200);
    }
    function toggleRec() {
      if (mrec) { try { mrec.stop(); } catch (_) { mrec = null; } return; }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia
          || typeof MediaRecorder === 'undefined') {
        toast('The mic isn’t available here — typed notes still work.');
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var chunks = [];
        mrec = new MediaRecorder(stream);
        recIt = items[cur];
        recStart = Date.now();
        recTimeline = [{ item: recIt.id, at: 0 }];
        mrec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        mrec.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          mrec = null;
          var it = recIt || items[cur];
          var tl = recTimeline || [];
          recIt = null; recTimeline = null;
          render();
          var blob = new Blob(chunks, { type: chunks[0] && chunks[0].type || 'audio/webm' });
          if (blob.size > 20000000) { toast('That one’s too long to keep here — under ~20 minutes.'); return; }
          if (!blob.size) return;
          var rd = new FileReader();
          rd.onloadend = function () {
            if (tl.length > 1) {
              // she swiped while talking — split the one recording across
              // the cards, each sentence to the card it started on
              toast('Splitting the voice notes across ' + tl.length + ' cards…');
              fetch('/api/chatfeed/page-voice-session', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat: chat, sheet: sheet, audio: rd.result, timeline: tl }),
              }).then(function (r) { return r.json(); }).then(function (d) {
                if (!d || !d.ok) { toast('Couldn’t save that voice session.'); return; }
                var ids = Object.keys(d.perCard || {});
                Object.keys(d.texts || {}).forEach(function (id) { notes[id] = d.texts[id]; });
                ids.forEach(function (id) {
                  var target = null;
                  items.forEach(function (x) { if (x.id === id) target = x; });
                  if (target) mirrorNote(target, d.perCard[id] + ' (voice: ' + d.url + ')');
                });
                toast('Voice notes on ' + ids.length + ' card' + (ids.length === 1 ? '' : 's')
                  + ' — open a card to read its part.');
                if (view === 'card') render();
              }).catch(function () { toast('Couldn’t save that voice session.'); });
              return;
            }
            toast('Saving the voice note…');
            fetch('/api/chatfeed/page-voice', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat: chat, sheet: sheet, item: it.id, audio: rd.result }),
            }).then(function (r) { return r.json(); }).then(function (d) {
              if (!d || !d.ok) { toast('Couldn’t save that voice note.'); return; }
              notes[it.id] = d.text || notes[it.id];
              toast(d.transcript ? '“' + d.transcript.slice(0, 80) + '…” — on the card.'
                : 'Voice note attached.');
              mirrorNote(it, (d.transcript || 'voice note') + ' (voice: ' + d.url + ')');
              if (items[cur] === it && view === 'card') render();
            }).catch(function () { toast('Couldn’t save that voice note.'); });
          };
          rd.readAsDataURL(blob);
        };
        mrec.start();
        render();
      }).catch(function () {
        toast('Mic permission was refused here — typed notes still work.');
      });
    }

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
      var prev = verdicts[it.id];
      // in browse mode the lit verdict is visible, so tapping it again clears
      if (browse && prev === val) val = null;
      undoStack.push({ i: cur, prev: prev });
      if (val === null) delete verdicts[it.id]; else verdicts[it.id] = val;
      post({ item: it.id, ok: val });
      if (val === true || val === false || prev === true || prev === false) mirrorVote(it, val);
      if (browse) {
        // a judged card steps FORWARD, never jumps — her order stays hers
        if (val !== null) { if (cur < items.length - 1) cur += 1; else view = 'piles'; }
      } else {
        var next = firstUnjudged();
        if (next === -1) { view = 'piles'; } else { cur = next; }
      }
      render(true);
    }
    function nav(step) {
      var to = cur + step;
      if (to < 0) return;
      if (to > items.length - 1) { view = 'piles'; render(true); return; }
      cur = to; view = 'card'; render(true);
    }
    function undo() {
      var u = undoStack.pop();
      if (!u) return;
      var it = items[u.i];
      var was = verdicts[it.id];
      if (u.prev === undefined) { delete verdicts[it.id]; post({ item: it.id, ok: null }); }
      else { verdicts[it.id] = u.prev; post({ item: it.id, ok: u.prev }); }
      if (was === true || was === false || u.prev === true || u.prev === false) {
        mirrorVote(it, u.prev === undefined ? null : u.prev);
      }
      cur = u.i; view = 'card'; render(true);
    }

    // the card-face menu (Aug 2026): square (the XI deck), portrait (a story
    // fragment's rectangle), landscape. The page picks one; a single item
    // may pick its own. Anything else keeps the item's natural shape.
    var AR = { square: '1/1', portrait: '5/7', landscape: '7/5' };
    function arOf(it) { return AR[it.aspect] || AR[opts.aspect] || ''; }
    function mediaHtml(it) {
      var ar = arOf(it);
      var sq = ar ? ' sq' : '';
      var ars = ar ? ' style="aspect-ratio:' + ar + '"' : '';
      // a TEMPLATE item's words render ESCAPED — template data carries no
      // HTML by design (page-templates.js); `card` below stays page-authored
      // trusted HTML for hand-built judge pages
      if (it.text && !it.img && !it.pair && !it.card) {
        return '<div class="jg-cardtext' + sq + '"' + ars + '>' + esc(it.text) + '</div>';
      }
      if (it.card) return '<div class="jg-cardtext">' + it.card + '</div>';
      if (it.pair) {
        return '<div class="jg-media">' + it.pair.map(function (p) {
          return '<figure><span class="tag">' + esc(p.label || '') + '</span>'
            + '<img class="zoom" src="' + esc(p.img) + '" alt="' + esc(p.label || '') + '"'
            + (p.full ? ' data-full="' + esc(p.full) + '"' : '') + '></figure>';
        }).join('') + '</div>';
      }
      return '<div class="jg-media' + sq + '"><figure' + ars + '><img class="zoom" src="' + esc(it.img) + '"'
        + ' alt="' + esc(it.label || '') + '"'
        + (it.full ? ' data-full="' + esc(it.full) + '"' : '') + '></figure></div>';
    }
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function render(flash) {
      // hands-free: while the mic runs, every card change is logged so the
      // recording can be split back onto the cards afterwards
      if (mrec && recTimeline && view === 'card' && items[cur]
          && recTimeline[recTimeline.length - 1].item !== items[cur].id) {
        recTimeline.push({ item: items[cur].id, at: Date.now() - recStart });
      }
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
        var sections = piles.map(function (p) {
          var members = items.filter(function (it) { return verdicts[it.id] === p.key; });
          if (!members.length) return '';
          return '<h2>' + p.name + ' · ' + members.length + '</h2><div class="jg-grid">'
            + members.map(function (it) {
              if (it.card || (it.text && !it.img && !it.pair)) {
                return '<button class="txt" data-open="' + esc(it.id) + '">'
                  + esc(it.label || it.text || it.id) + '</button>';
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
        var v = verdicts[it.id];
        var row;
        if (states) {
          // her own words as chips — a button is only as wide as its words
          row = states.map(function (s, i) {
            return '<button class="jg-chip' + (v === s.key ? ' on' : '')
              + '" data-state="' + i + '">' + esc(s.label) + '</button>';
          }).join('');
        } else {
          var lit = function (k) { return browse && v === k ? ' on' : ''; };
          row = '<button class="jg-btn no' + lit(false) + '" data-act="no" aria-label="Pass">' + I.x + '</button>'
            + '<button class="jg-btn later' + lit('later') + '" data-act="later" aria-label="Sort later">' + I.later + '</button>'
            + '<button class="jg-btn maybe' + lit('maybe') + '" data-act="maybe" aria-label="Maybe">' + I.maybe + '</button>'
            + '<button class="jg-btn yes' + lit(true) + '" data-act="yes" aria-label="Love">' + I.heart + '</button>';
        }
        // the controls strip: reserved whenever a corner control could sit on
        // the content — the mic (voice) always, and the note + on a short
        // text-only card (the XI overlap)
        var ctl = voice || (it.text && !it.img && !it.pair && !it.card) ? ' ctl' : '';
        mount.innerHTML = '<div class="jg" data-nostop>' + top
          + '<div class="jg-card' + ctl + (flash ? ' jg-flash' : '') + '">'
          // browse mode: the card's left/right EDGES page through the deck
          // (Sophie: "tapping on the screen to the right or left goes
          // backwards or forwards") — the middle still opens the lightbox
          + (browse ? '<button class="jg-navzone prev" data-act="prev" aria-label="Back"></button>'
            + '<button class="jg-navzone next" data-act="next" aria-label="Forward"></button>' : '')
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
          + (voice ? '<button type="button" class="jg-mic' + (recActive() ? ' rec' : '')
            + '" data-act="mic" aria-label="voice note">' + I.mic + '</button>' : '')
          + '</div>'
          + '<div class="jg-row">' + row + '</div></div>';
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
            mirrorNote(it, draft);   // asset-backed cards agree with the tab
          }
          wrap.classList.remove('open');
        });
      }
    }

    // THE TOUR (Aug 2026, Sophie): first open of a template deck plays the
    // coach marks once — each control spotlighted, the rest tinted, a line
    // of explanation, tap to step. Replayable from the "?" forever.
    function tourSteps() {
      var steps = [];
      if (browse) {
        steps.push({ sel: '.jg-card', text: 'One card at a time. Tap the left or right '
          + 'edge of the card (or swipe) to move through the deck — you never have to '
          + 'mark a card to keep going.' });
      }
      steps.push({ sel: '.jg-row', text: states
        ? 'Mark a card with one of these — tap the same one again to unmark it.'
        : '♥ love it, ✕ pass, the dashed circle is maybe, the arrow means sort it later. '
          + 'Each one saves the moment you tap it.' });
      if (voice) {
        steps.push({ sel: '.jg-mic', text: 'The mic: tap to start talking, tap again to '
          + 'stop. Stay on one card and the note lands there — or keep talking while you '
          + 'swipe, and each sentence lands on the card you were looking at.' });
      }
      steps.push({ sel: '.cmp-note-open', text: 'The + writes a note on this card — '
        + 'typed notes and voice notes end up in the same thread.' });
      steps.push({ sel: '[data-act="undo"]', text: 'Undo the last thing you marked.' });
      steps.push({ sel: '[data-act="piles"]', text: 'The piles: everything you’ve '
        + 'sorted, grouped. Tap any tile there to open its card again.' });
      steps.push({ sel: '[data-act="help"]', text: 'The ? explains this page any time — '
        + 'and “show me around” in there replays this tour.' });
      return steps;
    }
    function startTour(auto) {
      if (!window.__compareTour) return;
      window.__compareTour({ key: 'deck', auto: !!auto, steps: tourSteps() });
    }

    function showHelp() {
      var h = document.createElement('div');
      h.className = 'jg-help';
      // A page's OWN explanation belongs here and nowhere else (Aug 2026,
      // Sophie: instructions on the page are clutter — "they can put it
      // behind a ? so I can tap it if I don't know what's going on"). Pass
      // `help: '…'` to __judge and it leads the card, above the buttons key.
      var keys = states
        ? 'Tap a word under the card to mark it; tap it again to unmark.'
        : '♥ love it · ✕ pass · dashed circle = maybe (its own pile) · arrow = sort it later.';
      h.innerHTML = '<div>' + (opts.help ? '<div>' + opts.help + '</div><br>' : '')
        + '<b>THE BUTTONS</b><br>' + keys + '<br>'
        + (browse ? 'Tap the card’s left/right edge (or swipe) to move through'
          + ' — nothing has to be marked. ' : '')
        + (voice ? 'The mic records a voice note: tap to start, tap to stop. Stay on one'
          + ' card and it lands there — or keep talking WHILE you swipe, and each'
          + ' sentence lands on the card you were looking at when you started it. ' : '')
        + 'Top row: undo the last one, the grid shows every pile —'
        + ' tap any tile there to open it again.<br><br>'
        + '<button type="button" class="jg-tourgo">SHOW ME AROUND</button></div>';
      h.addEventListener('click', function (e) {
        h.remove();
        if (e.target && e.target.className === 'jg-tourgo') {
          setTimeout(function () { startTour(false); }, 60);
        }
      });
      document.body.appendChild(h);
    }

    mount.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-act],[data-open],[data-state]') : null;
      if (!b) return;
      var open = b.getAttribute('data-open');
      if (open !== null && open !== undefined && open !== '') {
        cur = items.findIndex(function (it) { return it.id === open; });
        if (cur < 0) cur = 0;
        view = 'card'; render(true); return;
      }
      var st = b.getAttribute('data-state');
      if (st !== null && st !== undefined && st !== '' && states) {
        var s = states[parseInt(st, 10)];
        if (s) judge(s.key);
        return;
      }
      var act = b.getAttribute('data-act');
      if (act === 'yes') judge(true);
      else if (act === 'no') judge(false);
      else if (act === 'maybe') judge('maybe');
      else if (act === 'later') judge('later');
      else if (act === 'prev') nav(-1);
      else if (act === 'next') nav(1);
      else if (act === 'mic') toggleRec();
      else if (act === 'undo') undo();
      else if (act === 'help') showHelp();
      else if (act === 'piles') { view = view === 'piles' ? 'card' : 'piles'; render(); }
    });

    // a real SWIPE pages the deck too — it is the Tinder page, after all.
    // Horizontal, decisive (40px+, more sideways than down), card view only.
    if (browse) {
      var swX = null, swY = null;
      mount.addEventListener('pointerdown', function (e) { swX = e.clientX; swY = e.clientY; });
      mount.addEventListener('pointerup', function (e) {
        if (swX === null || view !== 'card') { swX = null; return; }
        var dx = e.clientX - swX, dy = e.clientY - swY;
        swX = null;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        nav(dx < 0 ? 1 : -1);   // swipe left = forward, the deck convention
      });
    }

    // first-ever open of a template deck: the tour plays once, after the
    // resume pass has painted the real state (never again — localStorage)
    if (opts.tour === 'auto') {
      setTimeout(function () { if (view === 'card') startTour(true); }, 600);
    }

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
