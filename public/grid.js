/* grid.js — the GRID template (Aug 2026, Sophie: the classic Compare-tab
   shape, "comparing things with exactly one variable that's different…
   they sit next to each other on a row, usually just two to a row, but if
   you're comparing three options they all sit on the same row and so on
   until 6 is the max number and then they start wrapping").

   Rendered by the stock template page (POST /api/chatfeed/page with
   template:'grid' — see page-templates.js); a hand-built page may also call
   it directly after /compare.js:

     window.__grid({ chat, sheet, groups: [{ label?, items: […] }],
                     states?, help? })

   Each GROUP is one comparison: its items share a row (2–6 across, 7+
   wraps), labels ON TOP (the .duo rule), the differing variable as the
   label. Per item: ♥/✕ (or the page's own states — 'done'/'in progress'
   for a to-do), the shared note +, and PROMPT — the Assets tab's overlay
   exactly: MODEL · QUALITY at the top, content/style split, opens on
   CONTENT (Sophie: "the style is the default and I want it to be the
   content").

   THE MIRROR (Aug 2026, Sophie: the page and the Assets tab "should
   agree"): an item carrying `url` (its Assets-tab identity) writes ♥/✕
   through to the asset vote, and a committed note is appended to the asset
   note thread, so her review lands in ONE place however she gave it. On
   load, an asset vote fills in any item the page has no verdict for.
   Verdicts save to the page's verdict doc first, same as every page —
   GET /api/chatfeed/verdict?chat=&sheet= reads everything back. */
(function () {
  if (window.__grid) return;

  var css = document.createElement('style');
  css.textContent =
    '.gd-group{margin:0 0 18px;}' +
    '.gd-glabel{font:700 11px/1.4 -apple-system,sans-serif;letter-spacing:.08em;' +
    ' text-transform:uppercase;color:var(--gold);padding:0 0 6px;}' +
    '.gd-row{display:flex;flex-wrap:wrap;gap:8px;align-items:stretch;}' +
    '.gd-it{position:relative;background:var(--surface);border:1px solid var(--line);' +
    ' border-radius:6px;padding:8px 8px 30px;display:flex;flex-direction:column;gap:6px;' +
    ' min-width:0;box-sizing:border-box;}' +
    '.gd-it .tag{display:block;font:700 11px/1 -apple-system,sans-serif;' +
    ' letter-spacing:.08em;text-transform:uppercase;color:var(--gold);}' +
    '.gd-it img{width:100%;height:auto;border-radius:4px;display:block;}' +
    // the card-face menu (square / portrait / landscape) — ratio set inline
    // per tile so one page can mix shapes; the class carries the rest
    '.gd-sq img{height:auto;object-fit:cover;}' +
    '.gd-sq .gd-txt{width:100%;display:flex;align-items:center;' +
    ' justify-content:center;text-align:center;padding:8%;box-sizing:border-box;}' +
    '.gd-txt{font-size:15px;line-height:1.45;color:var(--ink);word-break:break-word;}' +
    '.gd-cap{font:500 11px/1.3 -apple-system,sans-serif;color:var(--ink2);}' +
    '.gd-acts{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:auto;}' +
    '.gd-vote{width:30px;height:30px;border-radius:50%;border:1.5px solid var(--line);' +
    ' background:var(--surface);color:var(--ink2);display:flex;align-items:center;' +
    ' justify-content:center;padding:0;}' +
    '.gd-vote svg{width:15px;height:15px;}' +
    '.gd-vote.yes.on{color:var(--chg);border-color:var(--chg);}' +
    '.gd-vote.no.on{color:var(--rose);border-color:var(--rose);}' +
    '.gd-state{border:1.5px solid var(--line);border-radius:6px;background:var(--surface);' +
    ' color:var(--ink2);font:600 12px/1 -apple-system,sans-serif;padding:7px 9px;}' +
    '.gd-state.on{color:var(--chg);border-color:var(--chg);}' +
    '.gd-prompt{border:1px solid var(--line);border-radius:6px;background:var(--surface);' +
    ' color:var(--ink2);font:700 10px/1 -apple-system,sans-serif;letter-spacing:.06em;' +
    ' padding:8px 8px;}' +
    '.gd-ov{position:fixed;inset:0;z-index:62;background:rgba(20,18,15,.55);' +
    ' display:flex;align-items:center;justify-content:center;padding:18px;}' +
    '.gd-ov[hidden]{display:none !important;}' +
    '.gd-ovcard{background:var(--paper);border:1px solid var(--line);border-radius:6px;' +
    ' max-width:420px;width:100%;max-height:76vh;overflow:auto;padding:14px 16px;}' +
    '.gd-ovmq{font:700 11px/1 -apple-system,sans-serif;letter-spacing:.08em;' +
    ' text-transform:uppercase;color:var(--gold);padding:0 0 10px;}' +
    '.gd-ovtabs{display:flex;gap:14px;border-bottom:1px solid var(--line);margin:0 0 10px;}' +
    '.gd-ovtabs button{border:0;background:none;padding:0 0 7px;font:600 12px/1 ' +
    ' -apple-system,sans-serif;letter-spacing:.06em;color:var(--ink2);' +
    ' border-bottom:2px solid transparent;border-radius:0;}' +
    '.gd-ovtabs button.on{color:var(--ink);border-bottom-color:var(--chg);}' +
    '.gd-ovtext{font-size:14px;line-height:1.55;color:var(--ink);white-space:pre-wrap;' +
    ' word-break:break-word;}';
  document.head.appendChild(css);

  var I = {
    heart: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  window.__grid = function (opts) {
    opts = opts || {};
    var chat = opts.chat, sheet = opts.sheet;
    var groups = (opts.groups || []).filter(function (g) { return g && (g.items || []).length; });
    var states = opts.states || null;   // e.g. [{key:'done',label:'done'},…]
    var mount = document.querySelector(opts.mount || '#grid');
    if (!mount || !groups.length) return;

    var byId = {};
    groups.forEach(function (g) {
      g.items.forEach(function (it) { if (it && it.id) byId[it.id] = it; });
    });
    var verdicts = {};

    function post(body) {
      body.chat = chat; body.sheet = sheet;
      return fetch('/api/chatfeed/verdict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(function () { /* offline — local state still holds */ });
    }
    // ♥/✕ on an asset-backed item lands in the Assets tab too — one review
    // state wherever she gives it. Only the boolean pair mirrors: 'like' /
    // 'dislike' are the only words the asset vote speaks.
    function mirrorVote(it, val) {
      if (!it.url) return;
      var vote = val === true ? 'like' : val === false ? 'dislike' : null;
      fetch('/api/gallery/assets/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: chat, url: it.url, vote: vote }),
      }).catch(function () { /* the page's own verdict still saved */ });
    }

    function setVerdict(it, val) {
      var prev = verdicts[it.id];
      var next = prev === val ? null : val;   // tap the lit one to clear
      verdicts[it.id] = next === null ? undefined : next;
      post({ item: it.id, ok: next });
      if (val === true || val === false || prev === true || prev === false) {
        mirrorVote(it, next);
      }
      paintActs(it.id);
    }

    function actsHtml(it) {
      var h = '';
      if (states) {
        h += states.map(function (s) {
          return '<button type="button" class="gd-state" data-v="' + esc(JSON.stringify(s.key))
            + '" data-id="' + esc(it.id) + '">' + esc(s.label) + '</button>';
        }).join('');
      } else {
        h += '<button type="button" class="gd-vote no" data-v="false" data-id="' + esc(it.id)
          + '" aria-label="Pass">' + I.x + '</button>'
          + '<button type="button" class="gd-vote yes" data-v="true" data-id="' + esc(it.id)
          + '" aria-label="Love">' + I.heart + '</button>';
      }
      if (it.promptContent || it.promptStyle) {
        h += '<button type="button" class="gd-prompt" data-prompt="' + esc(it.id) + '">PROMPT</button>';
      }
      return h;
    }

    function paintActs(id) {
      var host = mount.querySelector('[data-item="' + id + '"] .gd-acts');
      if (!host) return;
      var v = verdicts[id];
      host.querySelectorAll('[data-v]').forEach(function (b) {
        var key;
        try { key = JSON.parse(b.getAttribute('data-v')); } catch (_) { key = b.getAttribute('data-v'); }
        b.classList.toggle('on', v !== undefined && v === key);
      });
    }

    // one row per group: N across up to 6, wrapping after — the flex basis
    // carries the row size so 3 variants genuinely share one row
    var html = groups.map(function (g) {
      var per = Math.min(Math.max(g.items.length, 2), 6);
      var basis = 'calc((100% - ' + ((per - 1) * 8) + 'px)/' + per + ')';
      return '<div class="gd-group">'
        + (g.label ? '<div class="gd-glabel">' + esc(g.label) + '</div>' : '')
        + '<div class="gd-row">'
        + g.items.map(function (it) {
          var media = it.img
            ? '<img class="zoom" src="' + esc(it.img) + '" alt="' + esc(it.label || '') + '"'
              + (it.full ? ' data-full="' + esc(it.full) + '"' : '') + '>'
            : '<div class="gd-txt">' + esc(it.text || '') + '</div>';
          var cap = [it.model, it.quality].filter(Boolean).join(' · ');
          return '<div class="gd-it' + (opts.aspect === 'square' ? ' gd-sq' : '')
            + '" data-item="' + esc(it.id) + '"'
            + ' style="flex:0 0 ' + basis + '">'
            + (it.label ? '<span class="tag">' + esc(it.label) + '</span>' : '')
            + media
            + (cap ? '<div class="gd-cap">' + esc(cap) + '</div>' : '')
            + '<div class="gd-acts">' + actsHtml(it) + '</div>'
            + '</div>';
        }).join('')
        + '</div></div>';
    }).join('');
    mount.innerHTML = html;

    // ── the PROMPT overlay — the Assets tab's, to the letter ──
    var ov = null;
    function showPrompt(it) {
      if (!ov) {
        ov = document.createElement('div');
        ov.className = 'gd-ov';
        ov.setAttribute('hidden', '');
        ov.addEventListener('click', function (e) { if (e.target === ov) hidePrompt(); });
        document.body.appendChild(ov);
      }
      var mq = [it.model, it.quality].filter(Boolean).join(' · ');
      var hasC = !!it.promptContent, hasS = !!it.promptStyle;
      // CONTENT is the side that opens (Sophie) — style only when it's all there is
      var side = hasC ? 'content' : 'style';
      function paint() {
        ov.innerHTML = '<div class="gd-ovcard">'
          + (mq ? '<div class="gd-ovmq">' + esc(mq) + '</div>' : '')
          + '<div class="gd-ovtabs">'
          + '<button type="button" data-side="content"' + (side === 'content' ? ' class="on"' : '')
          + (hasC ? '' : ' disabled') + '>CONTENT</button>'
          + '<button type="button" data-side="style"' + (side === 'style' ? ' class="on"' : '')
          + (hasS ? '' : ' disabled') + '>STYLE</button>'
          + '</div>'
          + '<div class="gd-ovtext">'
          + esc(side === 'content' ? it.promptContent || '' : it.promptStyle || '') + '</div>'
          + '</div>';
        ov.querySelectorAll('[data-side]').forEach(function (b) {
          b.addEventListener('click', function (e) {
            e.stopPropagation();
            side = b.getAttribute('data-side');
            paint();
          });
        });
      }
      paint();
      ov.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
    }
    function hidePrompt() {
      if (!ov) return;
      ov.setAttribute('hidden', '');
      document.body.style.overflow = '';
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hidePrompt(); });

    mount.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-v],[data-prompt]') : null;
      if (!b) return;
      var pid = b.getAttribute('data-prompt');
      if (pid) { var pit = byId[pid]; if (pit) showPrompt(pit); return; }
      var it = byId[b.getAttribute('data-id')];
      if (!it) return;
      var val;
      try { val = JSON.parse(b.getAttribute('data-v')); } catch (_) { val = b.getAttribute('data-v'); }
      setVerdict(it, val);
    });

    // notes: the shared kit builds the + per [data-item]; a committed message
    // on an asset-backed item is mirrored onto the asset's note thread
    if (window.__compareNotes) {
      window.__compareNotes({
        chat: chat, sheet: sheet,
        onMessage: function (id, draft) {
          var it = byId[id];
          if (!it || !it.url || !draft) return;
          fetch('/api/gallery/assets/note', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat: chat, url: it.url, text: draft, from: 'sophie' }),
          }).catch(function () { /* the page's own thread still has it */ });
        },
      });
    }
    // THE TOUR (Aug 2026, Sophie): each control spotlighted, the rest
    // tinted, a line of explanation. Plays once on a template grid's first
    // open; replayable from the "?" forever.
    function tourSteps() {
      var steps = [{ sel: '.gd-row', text: 'Each row is one comparison — the things on '
        + 'it differ by exactly one thing, named in the label above each.' }];
      steps.push(states
        ? { sel: '.gd-state', text: 'Mark an item with one of these — tap the same one '
          + 'again to unmark it.' }
        : { sel: '.gd-vote.yes', text: '♥ keeps it, ✕ passes. On images from the Assets '
          + 'tab, the same heart shows up there too — the two always agree.' });
      steps.push({ sel: '.gd-prompt', text: 'PROMPT shows the exact text that made this '
        + 'image — what it depicts first, the style behind the second tab.' });
      steps.push({ sel: '.cmp-note-open', text: 'The + writes a note on this one — '
        + 'answers come back in the same thread.' });
      steps.push({ sel: '.gd-it img', text: 'Tap any picture to see it big; tap again '
        + 'to come back exactly where you were.' });
      return steps;
    }
    function startTour(auto) {
      if (!window.__compareTour) return;
      window.__compareTour({ key: 'grid', auto: !!auto, steps: tourSteps() });
    }
    if (window.__compareHelp) {
      window.__compareHelp({ html: (opts.help ? opts.help + '<br><br>' : '')
        + '<button type="button" class="gd-tourgo">SHOW ME AROUND</button>' });
      document.addEventListener('click', function (e) {
        if (e.target && e.target.className === 'gd-tourgo') {
          setTimeout(function () { startTour(false); }, 60);
        }
      });
    }
    if (opts.tour === 'auto') {
      // after the notes kit has drawn the + so the tour can point at one
      setTimeout(function () { startTour(true); }, 800);
    }

    // resume: the page's own verdicts first; an Assets-tab ♥/✕ fills in any
    // asset item the page has no verdict for, so the two surfaces agree in
    // BOTH directions on load
    fetch('/api/chatfeed/verdict?chat=' + encodeURIComponent(chat)
      + '&sheet=' + encodeURIComponent(sheet))
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (d) {
        var iv = (d && d.items) || {};
        Object.keys(iv).forEach(function (id) {
          if (iv[id] !== null && iv[id] !== undefined) verdicts[id] = iv[id];
        });
        Object.keys(byId).forEach(paintActs);
        var wantAssets = Object.keys(byId).some(function (id) {
          return byId[id].url && verdicts[id] === undefined;
        });
        if (!wantAssets) return null;
        return fetch('/api/gallery/assets?chat=' + encodeURIComponent(chat))
          .then(function (r) { return r.ok ? r.json() : {}; })
          .catch(function () { return {}; })
          .then(function (a) {
            var votes = {};
            ((a && a.assets) || []).forEach(function (as) {
              if (as.vote) votes[as.url] = as.vote === 'like';
            });
            Object.keys(byId).forEach(function (id) {
              var it = byId[id];
              if (verdicts[id] === undefined && it.url && votes[it.url] !== undefined) {
                verdicts[id] = votes[it.url];
                paintActs(id);
              }
            });
          });
      });
  };
})();
