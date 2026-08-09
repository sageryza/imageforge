/* picker.js — the SHARED cut picker for Compare pages (Aug 2026, Sophie's
   ask after four chats each hand-rolled their own span-picking page: "so far
   we haven't established a user interface that is pain-free").

   The job it owns: Sophie picks exact spans of a long recording's transcript,
   HEARS each pick immediately, orders them, and the chat reads her picks back
   and cuts for real. It merges the three interaction models that worked, so
   no chat re-invents them (and re-ships their bugs):

     · word-tap spans — tap a first word, tap a last word (the "grasshopper"
       page's model, which was Sophie's own idea and which she really used)
     · instant playback — every pick gets a ▶ that cuts THAT exact span
       server-side, once, via GET /api/search/clip-span (the machinery behind
       the Search page's Play buttons); no chat pre-renders audio anymore
     · tiles that reorder — ▲▼ / remove / put back / note per pick and a
       play-all, the "TIME — move the sentences around" page's model

   Include it after /compare.css and /compare.js, then call it once per
   source, after the mount elements exist:

     <link rel="stylesheet" href="/compare.css">
     <div id="pick1"></div>
     <script src="/compare.js"></script>
     <script src="/picker.js"></script>
     <script>
       (function(){                       // IIFE — the pill contract
         window.__cutPicker({
           mount: '#pick1',
           id:    'exile',                // stable per source; keys the saves
           chat:  'my-chat-slug',         // the EFFECTIVE slug (see /name)
           sheet: 'exile-picks-v1',
           src:   'https://storage.googleapis.com/…/interview.webm',
                                          // or an indexed recording id
           words: [{w:'Chapter', t:0.0}, {w:'8.', t:0.6}, …],
                                          // t = absolute seconds in src;
                                          // e (end seconds) optional
           shade: [{a:10, z:42}],         // already-in-the-film words (grey)
           seed:  [{a:50, z:80}],         // chat-suggested picks, editable
         });
       })();
     </script>

   HOW A CHAT READS THE PICKS BACK — one field per pick, never one big JSON
   (a single JSON string silently truncates at the verdict route's 2000-char
   cap around 15 picks; per-pick fields cannot):

     GET /api/chatfeed/verdict?chat=&sheet= → { texts }
     every key `<id>:p<key>` with non-empty text is one live pick:
       { a, z, o, note? }   a/z = word indexes into YOUR words array,
                            o   = her play order (sort by it),
                            note = what she said about this pick
     a removed pick's field is '' — skip empties. The pick's text is
     words[a..z] of the array the page was built with.

   Word times don't need to be word-exact — segment-interpolated times are
   fine for PREVIEW (the ▶ pads a beat each side). The real render still goes
   through the chat's precise cutter (editor.js). Only word-tap picking needs
   no times at all: with no usable `t`s the ▶ buttons simply don't render.

   Pill contract notes (why this file is shaped the way it is):
   · everything lives in an IIFE — the injected pill declares globals
   · taps on words pause the autoscroll via /compare.js's document handler;
     this file adds no tap handler of its own, so the exempt list stays the
     shared one (buttons/textareas are already exempt from pausing)
   · no gradients, no pill-shaped buttons (6px radius), Lucide-idiom icons
*/
(function () {
  if (window.__cutPicker) return;

  var CLIP_ROUTE = '/api/search/clip-span';
  var PAD_IN = 0.25;     // start a beat before the first word
  var PAD_OUT = 0.35;    // breathe past the last word
  var WORD_MAX = 3.5;    // a word "lasts" until the next one, capped (silence)

  /* ── one stylesheet, tokens from compare.css ─────────────────────── */
  var css = document.createElement('style');
  css.textContent =
    '.ckp{margin:14px 0 26px;}' +
    '.ckp-read{background:var(--paper); border:1px solid var(--line,#d8cfc0);' +
    ' border-radius:6px; padding:14px 12px; line-height:2.05; font-size:16.5px; color:var(--ink);}' +
    '.ckp-read w{display:inline; padding:3px 1px; border-radius:3px; cursor:pointer;}' +
    '.ckp-read w.old{background:color-mix(in srgb, var(--ink2) 16%, transparent);' +
    ' color:var(--ink2);}' +
    '.ckp-read w.pick{background:color-mix(in srgb, var(--rose,#c98a8a) 32%, transparent);}' +
    '.ckp-read w.a{border-top-left-radius:6px; border-bottom-left-radius:6px;}' +
    '.ckp-read w.z{border-top-right-radius:6px; border-bottom-right-radius:6px;}' +
    '.ckp-read w.pend{outline:2px solid var(--chg,#b3443f); outline-offset:1px;}' +
    '.ckp-read w.cut{outline:2px dashed var(--chg,#b3443f); outline-offset:1px;}' +
    '.ckp-read w.now{background:color-mix(in srgb, var(--chg,#b3443f) 30%, transparent);}' +
    '.ckp-tabs{display:flex; gap:2px; border-bottom:1px solid var(--line,#d8cfc0); margin:0 0 10px;}' +
    '.ckp .ckp-tabs button{border:none; background:none; border-radius:6px 6px 0 0; padding:8px 14px;' +
    ' color:var(--ink2); border-bottom:2px solid transparent; margin-bottom:-1px; font-size:14.5px;}' +
    '.ckp .ckp-tabs button.on{color:var(--ink); border-bottom:2px solid var(--chg,#b3443f); font-weight:600;}' +
    '.ckp-bar{display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:8px 0 0;' +
    ' font-size:13.5px; color:var(--ink2);}' +
    '.ckp-bar b{color:var(--ink); font-weight:600;}' +
    '.ckp button{font:inherit; font-size:13.5px; color:var(--ink); background:var(--paper);' +
    ' border:1px solid var(--line,#d8cfc0); border-radius:6px; padding:5px 10px; cursor:pointer;}' +
    '.ckp button:disabled{opacity:.38; cursor:default;}' +
    '.ckp button svg{width:15px; height:15px; vertical-align:-2.5px; stroke:currentColor;' +
    ' stroke-width:1.8; fill:none; stroke-linecap:round; stroke-linejoin:round;}' +
    '.ckp-list{margin-top:12px; display:flex; flex-direction:column; gap:10px;}' +
    '.ckp-pk{background:var(--paper); border:1px solid var(--line,#d8cfc0); border-radius:6px;' +
    ' padding:10px 12px;}' +
    '.ckp-pk p{margin:0 0 8px; font-size:14.5px; line-height:1.55; color:var(--ink);}' +
    '.ckp-pk .row{display:flex; align-items:center; gap:6px; flex-wrap:wrap;}' +
    '.ckp-pk .dur{font-size:12.5px; color:var(--ink2); margin-left:auto;}' +
    '.ckp-pk textarea{width:100%; margin-top:8px; font:inherit; font-size:14px; color:var(--ink);' +
    ' background:var(--paper); border:1px solid var(--line,#d8cfc0); border-radius:6px;' +
    ' padding:7px 9px; resize:vertical; box-sizing:border-box;}' +
    '.ckp-saved{font-size:12px; color:var(--ink2); opacity:0; transition:opacity .3s;}' +
    '.ckp-saved.on{opacity:1;}' +
    '.ckp [hidden]{display:none !important;}';
  document.head.appendChild(css);

  /* Lucide-idiom inline icons (stroke currentColor, 1.8) */
  var I = {
    play: '<svg viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="1.5"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
    scissors: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>' +
      '<path d="M20 4 8.12 15.88"/><path d="M14.47 14.48 20 20"/><path d="M8.12 8.12 12 12"/></svg>',
    // the Episode Editor's own glyph (SF `waveform` on the tile; Lucide's
    // audio-waveform here) — a button that opens another tool wears THAT
    // tool's icon (design rule)
    waveform: '<svg viewBox="0 0 24 24"><path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/>' +
      '<path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/></svg>',
  };

  /* ── one shared audio element per page ───────────────────────────── */
  var audio = null, playingBtn = null, playQueue = null;
  // what's playing right now, for the follow-along word highlight
  // (the Voice Memos / Cutting Room pattern — Sophie's ask, Aug 2026)
  var playCtx = null, nowEl = null;
  function clearNow() { if (nowEl) { nowEl.classList.remove('now'); nowEl = null; } }
  function stopAudio() {
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    if (playingBtn) { playingBtn.innerHTML = I.play; playingBtn = null; }
    playQueue = null; playCtx = null; clearNow();
  }
  function ensureAudio() {
    if (audio) return audio;
    audio = document.createElement('audio');
    audio.preload = 'none';
    document.body.appendChild(audio);
    audio.addEventListener('ended', function () {
      var q = playQueue;
      playCtx = null; clearNow();
      if (playingBtn) { playingBtn.innerHTML = I.play; playingBtn = null; }
      if (q && q.length) { playQueue = null; playSeq(q); } else playQueue = null;
    });
    // Follow the words as they're spoken (Voice Memos' transcript pattern):
    // absolute time = the clip's own start + playback position, and the
    // word whose start we've passed lights up. Times are only as exact as
    // the page's word times (often segment-interpolated), so the highlight
    // can lead or trail by a beat — same as rough captions, and honest.
    audio.addEventListener('timeupdate', function () {
      if (!playCtx) return;
      var abs = playCtx.t0 + audio.currentTime;
      var ws = playCtx.inst.opts.words, p = playCtx.pick, hit = null;
      for (var i = p.a; i <= p.z; i++) {
        if (typeof ws[i].t === 'number' && ws[i].t <= abs) hit = i; else if (ws[i].t > abs) break;
      }
      if (hit === null) return;
      var el = playCtx.inst.wordEl(hit);
      if (!el || el === nowEl) return;
      clearNow(); nowEl = el; el.classList.add('now');
      // keep the spoken word in the middle of the screen — but only when
      // the words are actually on screen (never scroll under the picks tab)
      if (el.offsetParent !== null) {
        var r = el.getBoundingClientRect(), h = window.innerHeight;
        if (r.top < h * 0.2 || r.bottom > h * 0.8) {
          try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) { el.scrollIntoView(); }
        }
      }
    });
    return audio;
  }
  function playSeq(entries) {           // entries: [{inst, pick}] in order
    if (!entries.length) return;
    var head = entries[0];
    playPick(head.inst, head.pick, null, entries.slice(1));
  }

  /* poll /clip-span until the cut is banked, then play it */
  function playPick(inst, pick, btn, thenQueue) {
    stopAudio();
    var span = spanOf(inst, pick);
    if (!span) return;
    if (btn) { btn.innerHTML = '…'; }
    var url = CLIP_ROUTE + '?src=' + encodeURIComponent(inst.opts.src) +
      '&t0=' + span.t0.toFixed(2) + '&t1=' + span.t1.toFixed(2);
    var tries = 0;
    (function ask() {
      fetch(url).then(function (r) { return r.json(); }).then(function (d) {
        if (d.status === 'ready' && d.url) {
          var a = ensureAudio();
          playCtx = { inst: inst, pick: pick, t0: span.t0 };
          a.src = d.url;
          a.play().catch(function () { if (btn) btn.innerHTML = I.play; });
          if (btn) { btn.innerHTML = I.stop; playingBtn = btn; }
          playQueue = thenQueue || null;
        } else if (d.status === 'making' && tries++ < 40) {
          setTimeout(ask, 1400);
        } else {
          if (btn) btn.innerHTML = I.play;
          inst.flash(d.error ? ('could not cut that one — ' + d.error) : 'could not cut that one');
        }
      }).catch(function () {
        if (tries++ < 40) setTimeout(ask, 2000);
        else if (btn) btn.innerHTML = I.play;
      });
    })();
  }

  function spanOf(inst, pick) {
    var ws = inst.opts.words;
    var wa = ws[pick.a], wz = ws[pick.z];
    if (!wa || !wz || typeof wa.t !== 'number' || typeof wz.t !== 'number') return null;
    var end = (typeof wz.e === 'number') ? wz.e
      : (ws[pick.z + 1] && typeof ws[pick.z + 1].t === 'number')
        ? Math.min(ws[pick.z + 1].t, wz.t + WORD_MAX)
        : wz.t + 1.6;
    return { t0: Math.max(0, wa.t - PAD_IN), t1: end + PAD_OUT };
  }

  /* ── saves: ONE verdict field per pick (see the header) ──────────── */
  function saveField(inst, item, text) {
    return fetch('/api/chatfeed/verdict', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: inst.opts.chat, sheet: inst.opts.sheet, item: item, text: text }),
    });
  }
  function scheduleSave(inst, keys) {
    keys.forEach(function (k) { inst.dirty[k] = true; });
    clearTimeout(inst.saveTimer);
    inst.saveTimer = setTimeout(function () { flushSaves(inst); }, 700);
  }
  function flushSaves(inst) {
    var keys = Object.keys(inst.dirty);
    if (!keys.length) return;
    inst.dirty = {};
    var chain = Promise.resolve();
    keys.forEach(function (k) {
      var pick = null;
      inst.picks.forEach(function (p) { if (p.k === k) pick = p; });
      var text = pick ? JSON.stringify({
        a: pick.a, z: pick.z, o: inst.picks.indexOf(pick),
        note: pick.note || undefined,
      }) : '';
      chain = chain.then(function () { return saveField(inst, inst.opts.id + ':' + k, text); });
    });
    chain.then(function () { inst.savedFlag(); })
      .catch(function () { keys.forEach(function (k) { inst.dirty[k] = true; }); });
  }

  /* a half-made state must survive leaving the page */
  var instances = [];
  window.addEventListener('pagehide', function () {
    instances.forEach(function (inst) {
      Object.keys(inst.dirty).forEach(function (k) {
        var pick = null;
        inst.picks.forEach(function (p) { if (p.k === k) pick = p; });
        var text = pick ? JSON.stringify({
          a: pick.a, z: pick.z, o: inst.picks.indexOf(pick), note: pick.note || undefined,
        }) : '';
        try {
          navigator.sendBeacon('/api/chatfeed/verdict', new Blob([JSON.stringify({
            chat: inst.opts.chat, sheet: inst.opts.sheet, item: inst.opts.id + ':' + k, text: text,
          })], { type: 'application/json' }));
        } catch (_) { /* nothing more to do */ }
      });
      inst.dirty = {};
    });
  });

  /* ── the component ───────────────────────────────────────────────── */
  window.__cutPicker = function (opts) {
    var mount = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
    if (!mount || !opts.chat || !opts.sheet || !opts.id || !Array.isArray(opts.words)) return null;
    opts.words = opts.words.map(function (w) {
      return typeof w === 'string' ? { w: w } : w;
    });

    var inst = {
      opts: opts, picks: [], pend: null, splitting: null, undoStack: [],
      dirty: {}, saveTimer: null,
      savedFlag: function () {
        savedEl.classList.add('on');
        setTimeout(function () { savedEl.classList.remove('on'); }, 1200);
      },
      flash: function (msg, ms) {
        statusEl.textContent = msg;
        setTimeout(paint, ms || 2600);
      },
    };
    instances.push(inst);
    var hasTimes = !!opts.src && opts.words.some(function (w) { return typeof w.t === 'number'; });

    /* build the DOM.
       data-nostop is load-bearing (Aug 2026, Sophie hit this on the first
       demo): in the app the page runs inside the Chats viewer's iframe,
       whose tap-anywhere gesture TOGGLES the autoscroll — so without the
       opt-out, tapping a word started the page scrolling. A data-nostop
       region's taps stay the page's own there (they still pause a running
       scroll, never start one). */
    mount.classList.add('ckp');
    mount.setAttribute('data-nostop', '');
    var read = document.createElement('div');
    read.className = 'ckp-read';
    var ws = [];                       // word elements by index — repaints
    var frag = document.createDocumentFragment();  // never re-query the DOM
    opts.words.forEach(function (w, i) {
      var el = document.createElement('w');
      el.textContent = w.w;
      el.dataset.i = i;
      ws.push(el);
      frag.appendChild(el);
      frag.appendChild(document.createTextNode(' '));
    });
    read.appendChild(frag);
    inst.wordEl = function (i) { return ws[i]; };
    (opts.shade || []).forEach(function (s) {
      for (var i = s.a; i <= s.z; i++) if (ws[i]) ws[i].classList.add('old');
    });

    var bar = document.createElement('div');
    bar.className = 'ckp-bar';
    var cnt = document.createElement('b');
    var statusEl = document.createElement('span');
    var undoBtn = mkBtn(I.undo, 'put the last removed pick back');
    var playAllBtn = hasTimes ? mkBtn(I.play + ' play them in order', 'play every pick, in her order') : null;
    // Send-to-Episode-Editor (Aug 2026, Sophie's ask): every pick, in her
    // order, becomes a snippet card in ONE NEW episode — narration, gaps and
    // the real render live there. Needs word times for the anchors, and an
    // INDEXED recording id (the editor's transcript view and cutter key off
    // it); a raw-URL source hides the button and the chat does the hand-off
    // itself when asked.
    var sendable = hasTimes && !/^https?:/.test(String(opts.src || ''));
    var sendBtn = sendable ? mkBtn(I.waveform + ' to the Episode Editor',
      'send every pick, in order, to a new episode') : null;
    var savedEl = document.createElement('span');
    savedEl.className = 'ckp-saved';
    savedEl.textContent = 'saved';
    bar.appendChild(cnt); bar.appendChild(statusEl);
    if (playAllBtn) bar.appendChild(playAllBtn);
    if (sendBtn) bar.appendChild(sendBtn);
    bar.appendChild(undoBtn); bar.appendChild(savedEl);

    var list = document.createElement('div');
    list.className = 'ckp-list';

    // Two tabs — WORDS and PICKS — instead of the pick tiles living a long
    // scroll below the transcript (Sophie's ask, Aug 2026; the pattern is
    // Secretly a Witch's shop sheet, description vs reviews). The bar stays
    // visible on both, so the status line, play-all, send and undo are
    // always in reach.
    var tabs = document.createElement('div');
    tabs.className = 'ckp-tabs';
    var tabWords = mkBtn('Words', 'the transcript');
    var tabPicks = mkBtn('Picks', 'what you have picked, in order');
    tabs.appendChild(tabWords); tabs.appendChild(tabPicks);
    var wordsWrap = document.createElement('div');
    var picksWrap = document.createElement('div');
    wordsWrap.appendChild(read); picksWrap.appendChild(list);
    inst.setTab = function (t) {
      inst.tab = t;
      tabWords.classList.toggle('on', t === 'words');
      tabPicks.classList.toggle('on', t === 'picks');
      if (t === 'words') { wordsWrap.removeAttribute('hidden'); picksWrap.setAttribute('hidden', ''); }
      else { picksWrap.removeAttribute('hidden'); wordsWrap.setAttribute('hidden', ''); }
    };
    tabWords.addEventListener('click', function () { inst.setTab('words'); });
    tabPicks.addEventListener('click', function () { inst.setTab('picks'); });
    mount.appendChild(tabs); mount.appendChild(bar);
    mount.appendChild(wordsWrap); mount.appendChild(picksWrap);
    inst.setTab('words');

    function mkBtn(html, title) {
      var b = document.createElement('button');
      b.type = 'button'; b.innerHTML = html; b.title = title || '';
      return b;
    }

    /* word taps — event delegation, one listener for the whole transcript.
       A word tap is a deliberate interaction, so it pauses a running
       autoscroll itself (compare.js's document handler skips data-nostop
       regions, so it can't do it for us here). */
    read.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('w') : null;
      if (!el) return;
      if (window.__scrollStop) window.__scrollStop();
      tap(Number(el.dataset.i));
    });

    function inPick(i) {
      for (var k = 0; k < inst.picks.length; k++) {
        if (i >= inst.picks[k].a && i <= inst.picks[k].z) return k;
      }
      return -1;
    }
    function tap(i) {
      // split mode (the tile's scissors): the tapped word becomes the FIRST
      // word of the second part — so one pick becomes two, back to back, and
      // each part can get its own picture / speaker / note downstream
      // (Sophie's ask, Aug 2026: "this is where one part starts and another
      // part stops"). A tap anywhere else just leaves split mode.
      if (inst.splitting !== null) {
        var sn = -1;
        inst.picks.forEach(function (p, m) { if (p.k === inst.splitting) sn = m; });
        inst.splitting = null;
        if (sn >= 0) {
          var sp = inst.picks[sn];
          if (i > sp.a && i <= sp.z) {
            var second = { k: 'p' + Math.random().toString(36).slice(2, 7), a: i, z: sp.z, note: '' };
            sp.z = i - 1;                          // the note stays on part one
            inst.picks.splice(sn + 1, 0, second);
            scheduleSave(inst, [sp.k].concat(orderKeys()));
          }
        }
        paint(); return;
      }
      if (inst.pend === null) {
        var k = inPick(i);
        if (k >= 0) { removePick(k); return; }
        inst.pend = i; paint(); return;
      }
      // tapping the SAME word again deselects it (Sophie's ask — a mis-tap
      // must not become a one-word pick; her first demo left a stray "dark")
      if (inst.pend === i) { inst.pend = null; paint(); return; }
      if (inPick(i) >= 0) { inst.pend = null; paint(); return; }
      var a = Math.min(inst.pend, i), z = Math.max(inst.pend, i);
      for (var j = a; j <= z; j++) if (inPick(j) >= 0) { inst.pend = null; paint(); return; }
      var pick = { k: 'p' + Math.random().toString(36).slice(2, 7), a: a, z: z, note: '' };
      inst.pend = null;
      inst.picks.push(pick);                         // play order: appended last
      scheduleSave(inst, [pick.k]);
      paint();
    }
    function removePick(n) {
      var gone = inst.picks.splice(n, 1)[0];
      inst.undoStack.push(gone);
      if (inst.undoStack.length > 20) inst.undoStack.shift();
      scheduleSave(inst, [gone.k].concat(orderKeys()));
      paint();
    }
    function orderKeys() { return inst.picks.map(function (p) { return p.k; }); }

    undoBtn.addEventListener('click', function () {
      var back = inst.undoStack.pop();
      if (!back) return;
      inst.picks.push(back);
      scheduleSave(inst, [back.k]);
      paint();
    });
    if (playAllBtn) playAllBtn.addEventListener('click', function () {
      stopAudio();
      playSeq(inst.picks.map(function (p) { return { inst: inst, pick: p }; }));
    });
    if (sendBtn) sendBtn.addEventListener('click', function () {
      if (!inst.picks.length || sendBtn.disabled) return;
      sendBtn.disabled = true;
      var title = (opts.editorTitle || document.title || 'From the cut picker').slice(0, 120);
      fetch('/api/search/picks-to-editor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          src: opts.src, title: title,
          picks: inst.picks.map(function (p) {
            return { text: textOf(p), timeSec: opts.words[p.a].t, note: p.note || undefined };
          }),
        }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        sendBtn.disabled = false;
        if (d && d.ok) {
          inst.flash('in the Episode Editor as “' + d.title + '” — ' +
            d.count + (d.count === 1 ? ' card' : ' cards'), 12000);
        } else {
          inst.flash((d && d.error) ? d.error : 'could not send — try again');
        }
      }).catch(function () {
        sendBtn.disabled = false;
        inst.flash('could not send — try again');
      });
    });

    function textOf(p) {
      var t = [];
      for (var i = p.a; i <= p.z; i++) t.push(opts.words[i].w);
      return t.join(' ');
    }

    function paint() {
      ws.forEach(function (w) { w.classList.remove('pick', 'a', 'z', 'pend', 'cut'); });
      inst.picks.forEach(function (p) {
        for (var i = p.a; i <= p.z; i++) if (ws[i]) ws[i].classList.add('pick');
        if (ws[p.a]) ws[p.a].classList.add('a');
        if (ws[p.z]) ws[p.z].classList.add('z');
      });
      if (inst.pend !== null && ws[inst.pend]) ws[inst.pend].classList.add('pend');
      if (inst.splitting !== null) {
        inst.picks.forEach(function (p) {
          if (p.k !== inst.splitting) return;
          for (var i = p.a; i <= p.z; i++) if (ws[i]) ws[i].classList.add('cut');
        });
      }
      var n = inst.picks.length;
      cnt.textContent = n ? (n + (n === 1 ? ' pick' : ' picks')) : 'no picks yet';
      tabPicks.textContent = n ? ('Picks \u00b7 ' + n) : 'Picks';
      statusEl.textContent = inst.splitting !== null
        ? 'tap the word where the new part starts'
        : inst.pend !== null ? 'now tap the last word'
        : (n ? 'tap a first word to add another' : 'tap a first word to start');
      undoBtn.disabled = !inst.undoStack.length;
      if (playAllBtn) playAllBtn.disabled = !n;
      renderList();
    }

    function renderList() {
      list.innerHTML = '';
      inst.picks.forEach(function (p, n) {
        var d = document.createElement('div');
        d.className = 'ckp-pk';
        var quote = document.createElement('p');
        quote.textContent = '“' + textOf(p) + '”';
        var row = document.createElement('div');
        row.className = 'row';
        if (hasTimes) {
          var play = mkBtn(I.play, 'hear this pick');
          play.addEventListener('click', function () {
            if (playingBtn === play) { stopAudio(); return; }
            playPick(inst, p, play);
          });
          row.appendChild(play);
        }
        var up = mkBtn(I.up, 'move this pick earlier');
        var down = mkBtn(I.down, 'move this pick later');
        up.disabled = n === 0; down.disabled = n === inst.picks.length - 1;
        up.addEventListener('click', function () { move(n, -1); });
        down.addEventListener('click', function () { move(n, 1); });
        row.appendChild(up); row.appendChild(down);
        if (p.z > p.a) {                 // a one-word pick has nowhere to cut
          var cut = mkBtn(I.scissors, 'split this pick in two');
          cut.addEventListener('click', function () {
            inst.pend = null;
            inst.splitting = (inst.splitting === p.k) ? null : p.k;
            if (inst.splitting !== null) inst.setTab('words');   // the split point is a word
            paint();
          });
          row.appendChild(cut);
        }
        var del = mkBtn(I.x, 'remove this pick');
        del.addEventListener('click', function () { removePick(n); });
        row.appendChild(del);
        if (hasTimes) {
          var span = spanOf(inst, p);
          if (span) {
            var dur = document.createElement('span');
            dur.className = 'dur';
            dur.textContent = '~' + Math.round(span.t1 - span.t0) + 's';
            row.appendChild(dur);
          }
        }
        var note = document.createElement('textarea');
        note.rows = 1;
        note.placeholder = 'a note about this one…';
        note.value = p.note || '';
        note.addEventListener('input', function () {
          p.note = note.value.slice(0, 1500);
          scheduleSave(inst, [p.k]);
        });
        note.addEventListener('blur', function () { flushSaves(inst); });
        d.appendChild(quote); d.appendChild(row); d.appendChild(note);
        list.appendChild(d);
      });
    }
    function move(n, dir) {
      var m = n + dir;
      if (m < 0 || m >= inst.picks.length) return;
      var t = inst.picks[n]; inst.picks[n] = inst.picks[m]; inst.picks[m] = t;
      scheduleSave(inst, orderKeys());               // every o shifted
      paint();
    }

    /* load what she already picked; seed only a truly untouched sheet */
    fetch('/api/chatfeed/verdict?chat=' + encodeURIComponent(opts.chat) +
          '&sheet=' + encodeURIComponent(opts.sheet))
      .then(function (r) { return r.ok ? r.json() : { texts: {} }; })
      .catch(function () { return { texts: {} }; })
      .then(function (d) {
        var texts = (d && d.texts) || {};
        var found = [], touched = false;
        Object.keys(texts).forEach(function (key) {
          if (key.indexOf(opts.id + ':') !== 0) return;
          touched = true;                            // even removed ('') picks count
          if (!texts[key]) return;
          try {
            var v = JSON.parse(texts[key]);
            if (typeof v.a === 'number' && typeof v.z === 'number') {
              found.push({ k: key.slice((opts.id + ':').length), a: v.a, z: v.z,
                o: typeof v.o === 'number' ? v.o : 0, note: v.note || '' });
            }
          } catch (_) { /* not a pick field */ }
        });
        if (found.length) {
          found.sort(function (x, y) { return x.o - y.o; });
          inst.picks = found;
        } else if (!touched && Array.isArray(opts.seed) && opts.seed.length) {
          inst.picks = opts.seed.map(function (s) {
            return { k: 'p' + Math.random().toString(36).slice(2, 7), a: s.a, z: s.z, note: '' };
          });
          scheduleSave(inst, orderKeys());           // the seeds ARE the current picks
        }
        paint();
      });

    paint();
    return inst;
  };
})();
