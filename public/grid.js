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

   Each GROUP is one comparison, ruled off from the next: its items share a
   row (wrapping at three across), the PICTURE first and one what-changed
   line under it. Per item: ✕ · PROMPT · ♥ (or the page's own states —
   'done'/'in progress' for a to-do). PROMPT is the Assets tab's overlay
   exactly: MODEL · QUALITY at the top, content/style split, opens on
   CONTENT (Sophie: "the style is the default and I want it to be the
   content"). When a row's variants differ in their STYLE half, the style
   tab marks the lines this one does not share with the others in rose
   (Sophie, Aug 2026: "showing the lines that are different in the style
   tab").

   Tapping an asset-backed picture opens THE Assets-tab lightbox
   (/asset-lightbox.js) — the big image, ♥/✕, the note box and the prompt,
   the same surface as the Assets tab. There is deliberately NO note + on a
   tile: the note lives in the lightbox (her call, Aug 2026).

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
    // A HAIRLINE BETWEEN THE SETS (Sophie, 2026-08-19: "a line between
    // different sets of things being compared, so that if things … wrapped to
    // the [next] line, I can still tell the difference between that and the
    // next set"). Rows wrap at three, so a 6-item set is two rows of tiles and
    // white space alone could not say where one comparison stopped. On the
    // TOP of each group but the first, so no rule dangles under the last one.
    '.gd-group + .gd-group{border-top:1px solid var(--line);padding-top:16px;}' +
    // the row header (what the row SHARES) clamps too — a style prompt's
    // first line can run long and this is a heading, not a reading
    // the spread's own ♥/✕ sit at the right end of its name row
    '.gd-gacts{display:flex;gap:6px;margin-left:auto;flex:none;}' +
    '.gd-gacts .gd-vote{width:26px;height:26px;}' +
    '.gd-gacts .gd-vote svg{width:13px;height:13px;}' +
    // the ROW is the flex line; the NAME keeps the two-line clamp it always
    // had (they cannot be the same element — -webkit-box would win over flex)
    // 64px on the right is the pill's column (x 326-374 on a 390pt phone).
    // The page SCROLLS, so a label row passes through that band on its way up
    // — reserving the column keeps a spread's marks tappable the whole way,
    // where padding on the first row alone would only work at rest.
    '.gd-glabel{display:flex;align-items:flex-end;gap:8px;padding:0 64px 6px 0;}' +
    '.gd-glabel .t{min-width:0;' +
    ' font:700 11px/1.4 -apple-system,sans-serif;letter-spacing:.08em;' +
    ' text-transform:uppercase;color:var(--gold);' +
    ' display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;' +
    ' overflow:hidden;overflow-wrap:anywhere;}' +
    '.gd-row{display:flex;flex-wrap:wrap;gap:8px;align-items:stretch;}' +
    // The picture fills its cell edge to edge — no inner padding around media
    // (Sophie, 2026-08-19: the tiles were "already small and then they're also
    // going inside of a border with padding so it makes them even smaller").
    // The text bits carry their own padding instead; overflow:hidden lets the
    // cell's radius clip the image corners.
    '.gd-it{position:relative;background:var(--surface);border:1px solid var(--line);' +
    ' border-radius:6px;padding:0 0 30px;display:flex;flex-direction:column;gap:6px;' +
    ' min-width:0;box-sizing:border-box;overflow:hidden;}' +
    // THE PICTURE COMES FIRST, the words under it (Sophie, 2026-08-19, on the
    // auto page: "the things I need to compare are staggered and the titles
    // are way too long… just the picture and then two lines underneath it
    // saying what changed"). Labels above the pictures made every tile start
    // at a different height, so the row never lined up. The line below clamps
    // at TWO lines — the full text still reads in the lightbox.
    '.gd-sub{font:500 11px/1.35 -apple-system,sans-serif;color:var(--ink2);' +
    ' padding:6px 8px 0;overflow-wrap:anywhere;display:-webkit-box;' +
    ' -webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}' +
    '.gd-it img{width:100%;height:auto;border-radius:0;display:block;}' +
    // the card-face menu (square / portrait / landscape) — ratio set inline
    // per tile so one page can mix shapes; the class carries the rest
    '.gd-sq img{height:auto;object-fit:cover;}' +
    '.gd-sq .gd-txt{width:100%;display:flex;align-items:center;' +
    ' justify-content:center;text-align:center;padding:8%;box-sizing:border-box;}' +
    '.gd-txt{font-size:15px;line-height:1.45;color:var(--ink);word-break:break-word;' +
    ' padding:8px;}' +
    // an item's way out — `margin-top:auto` on .gd-acts still pins the action
    // row to the bottom, so the link sits directly above it
    '.gd-link{padding:6px 8px 0;}' +
    '.gd-link a{text-decoration:none;color:var(--chg,#C25E4C);' +
    ' font:700 10px/1.2 -apple-system,sans-serif;letter-spacing:.12em;' +
    ' text-transform:uppercase;}' +
    '.gd-acts{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:auto;' +
    ' padding:0 8px;}' +
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
    // COMPRESSED AT BIRTH — its own element in front of the caption and of each
    // prompt half, never concatenated into either. The prompt must stay the
    // exact text that was sent, so the mark sits beside the words. Flat rose,
    // no gradient, matching .gd-diff's reasoning above.
    '.gd-comp{color:var(--chg,#c98b7a);font-weight:700;}' +
    '.gd-ovtext .gd-comp{display:block;font-size:11px;letter-spacing:.06em;' +
    ' text-transform:uppercase;margin:0 0 6px;}' +
    '.gd-ovtabs{display:flex;gap:14px;border-bottom:1px solid var(--line);margin:0 0 10px;}' +
    '.gd-ovtabs button{border:0;background:none;padding:0 0 7px;font:600 12px/1 ' +
    ' -apple-system,sans-serif;letter-spacing:.06em;color:var(--ink2);' +
    ' border-bottom:2px solid transparent;border-radius:0;}' +
    '.gd-ovtabs button.on{color:var(--ink);border-bottom-color:var(--chg);}' +
    '.gd-ovtext{font-size:14px;line-height:1.55;color:var(--ink);white-space:pre-wrap;' +
    ' word-break:break-word;}' +
    // the style lines that DIFFER from the row's other variants (Sophie, Aug
    // 2026: "ideally showing the lines that are different in the style tab").
    // A flat rose, no background — mark's default yellow is not the house.
    '.gd-diff{background:none;color:var(--rose);font-weight:600;}';
  document.head.appendChild(css);

  var I = {
    heart: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  };

  // THE TILE IS A DERIVED COPY, NEVER THE ORIGINAL (2026-08-27, Sophie on a
  // 30-tile grid of cut 4K panels: "no images in the compare top"). Every
  // picture was there and public — each one a ~1.4MB LOSSLESS webp straight
  // out of the panel cutter, so the page asked her phone for ~42MB at once and
  // nothing finished arriving. That is the house webp rule (never serve a raw
  // generated image to a page) reaching the one renderer that had never
  // applied it. /api/story/thumb bakes an 800px copy once and 302s to it,
  // redirecting to the ORIGINAL on any failure, so a tile can never come up
  // blank because a thumb could not be made.
  // The original is untouched where it matters: `data-full` still carries it,
  // and the lightbox opens from the ITEM (views.open(it) reads it.full /
  // it.url), never from the tile's src.
  var THUMB_HOST = /^https:\/\/(storage\.googleapis\.com|firebasestorage\.googleapis\.com)\//;
  function tileSrc(u) {
    return THUMB_HOST.test(u) ? '/api/story/thumb?w=800&url=' + encodeURIComponent(u) : u;
  }

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
    var mates = {};   // id → the other items in its group (the style-diff basis)
    groups.forEach(function (g) {
      g.items.forEach(function (it) {
        if (!it || !it.id) return;
        byId[it.id] = it;
        mates[it.id] = g.items.filter(function (o) { return o && o !== it; });
      });
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
      // …and into an open lightbox, so its heart agrees with the tile's
      views.sync(it, verdicts[it.id] === true ? 'like'
        : verdicts[it.id] === false ? 'dislike' : null);
    }

    // ── the ASSETS lightbox on every asset-backed picture (Aug 2026, Sophie:
    // "when I open up the image, I'd like it to be identical to what happens
    // when I open the image in assets — I can leave a note, that heart, etc.,
    // and see the prompt… just port that exact code"). /asset-lightbox.js IS
    // that code, lifted out of chats.html; this only feeds it the item.
    // ── the ASSETS lightbox on every asset-backed picture (Aug 2026, Sophie:
    // "when I open up the image, I'd like it to be identical to what happens
    // when I open the image in assets — I can leave a note, that heart, etc.,
    // and see the prompt… just port that exact code"). /asset-lightbox.js IS
    // that code, lifted out of chats.html; /asset-view.js is the adapter that
    // feeds it an item, shared with judge.js so the swipe card opens the same
    // thing this tile does.
    var views = window.__assetViews({
      chat: chat,
      voteOf: function (it) {
        return verdicts[it.id] === true ? 'like'
          : verdicts[it.id] === false ? 'dislike' : null;
      },
      // ♥/✕ in the lightbox: on a ♥/✕ page it IS the page's verdict (and
      // mirrors to the Assets tab through setVerdict, as always); on an
      // own-states page the page verdict stays the states', so the heart
      // casts the ASSET vote alone — exactly what it does in the Assets tab.
      cast: states
        ? function (it, v, a) {
          a.vote = a.vote === v ? null : v;
          mirrorVote(it, a.vote === 'like' ? true : a.vote === 'dislike' ? false : null);
          if (a._lbPaint) a._lbPaint();
        }
        : function (it, v) { setVerdict(it, v === 'like'); },
    });

    function openAsset(it) { views.open(it); }

    function actsHtml(it) {
      var h = '';
      if (states) {
        h += states.map(function (s) {
          return '<button type="button" class="gd-state" data-v="' + esc(JSON.stringify(s.key))
            + '" data-id="' + esc(it.id) + '">' + esc(s.label) + '</button>';
        }).join('');
        if (it.promptContent || it.promptStyle) {
          h += '<button type="button" class="gd-prompt" data-prompt="' + esc(it.id) + '">PROMPT</button>';
        }
        return h;
      }
      // ✕ · PROMPT · ♥ — the prompt button in the MIDDLE (Sophie, Aug 2026),
      // the same order the lightbox row has always had.
      h += '<button type="button" class="gd-vote no" data-v="false" data-id="' + esc(it.id)
        + '" aria-label="Pass">' + I.x + '</button>';
      if (it.promptContent || it.promptStyle) {
        h += '<button type="button" class="gd-prompt" data-prompt="' + esc(it.id) + '">PROMPT</button>';
      }
      h += '<button type="button" class="gd-vote yes" data-v="true" data-id="' + esc(it.id)
        + '" aria-label="Love">' + I.heart + '</button>';
      return h;
    }

    function paintActs(id) {
      // THE SPREAD'S OWN ROW IS ASKED FOR FIRST. A group contains tiles, and a
      // tile has `.gd-acts` — so `[data-item=<spread>] .gd-acts` matches a
      // CARD's buttons inside the spread and would paint the wrong thing. The
      // child-scoped spread selector cannot match an item, so this order is
      // right for both.
      var host = mount.querySelector('[data-item="' + id + '"] > .gd-glabel .gd-gacts')
        || mount.querySelector('[data-item="' + id + '"] .gd-acts');
      if (!host) return;
      var v = verdicts[id];
      host.querySelectorAll('[data-v]').forEach(function (b) {
        var key;
        try { key = JSON.parse(b.getAttribute('data-v')); } catch (_) { key = b.getAttribute('data-v'); }
        b.classList.toggle('on', v !== undefined && v === key);
      });
    }

    // one row per group, capped at THREE across: 2 share halves, 3 thirds,
    // and anything larger wraps at 3 — a 6-item group used to land as ONE row
    // of six ~50px tiles (Sophie, 2026-08-19, on a phone: "six things all in
    // the same row"). Comparing more than 3 across is unreadable at phone
    // width whatever the design intent says.
    // A SPREAD IS MARKABLE TOO (Aug 2026) — it joins byId as a thing with a
    // key and a name and no picture, so setVerdict, paintActs and the verdict
    // round trip all work on it unchanged. mirrorVote is a no-op for it: with
    // no `url` there is no asset to agree with, which is right — a spread is
    // this page's own question, not a picture in the Assets tab.
    groups.forEach(function (g) {
      if (g.id) byId[g.id] = { id: g.id, label: g.label || '' };
    });

    var html = groups.map(function (g) {
      var per = Math.min(Math.max(g.items.length, 2), 3);
      var basis = 'calc((100% - ' + ((per - 1) * 8) + 'px)/' + per + ')';
      // THE SPREAD'S OWN MARK (Aug 2026, Sophie: "so I can leave a note per
      // card, or per spread. same w heart"). A spread of 2+ carries an id of
      // its own (page-views.js, `s:` prefixed so it can never collide with a
      // card's), so its ♥/✕ ride the same verdict doc as every tile's — and
      // `data-item` on the group is what the shared note kit needs to put a
      // note + in its corner, the same one every reviewable thing gets.
      return '<div class="gd-group"' + (g.id ? ' data-item="' + esc(g.id) + '"' : '') + '>'
        + (g.label || g.id
          ? '<div class="gd-glabel"><span class="t">' + esc(g.label || '') + '</span>'
            + (g.id ? '<span class="gd-gacts">'
              + '<button type="button" class="gd-vote no" data-v="false" data-id="' + esc(g.id)
              + '" aria-label="Pass the whole spread">' + I.x + '</button>'
              + '<button type="button" class="gd-vote yes" data-v="true" data-id="' + esc(g.id)
              + '" aria-label="Love the whole spread">' + I.heart + '</button></span>' : '')
            + '</div>'
          : '')
        + '<div class="gd-row">'
        + g.items.map(function (it) {
          // an asset-backed picture opens the ASSETS lightbox (heart, note
          // thread, prompt — see openAsset below); only a plain picture keeps
          // compare.js's simple zoom
          var media = it.img
            ? '<img class="' + (it.url ? '' : 'zoom') + '" '
              + (it.url ? 'data-lb="' + esc(it.id) + '" ' : '')
              + 'loading="lazy" decoding="async" '
              + 'src="' + esc(tileSrc(it.img)) + '" alt="' + esc(it.label || '') + '"'
              + (it.full ? ' data-full="' + esc(it.full) + '"' : '') + '>'
            : '<div class="gd-txt">' + esc(it.text || '') + '</div>';
          var cap = [it.model, it.quality].filter(Boolean).join(' · ');
          // the two lines under the picture = what changed on this one; the
          // caption fills in only when no label was given (it still reads in
          // the lightbox and atop the PROMPT overlay either way)
          var sub = it.label || cap;
          return '<div class="gd-it' + (opts.aspect === 'square' ? ' gd-sq' : '')
            + '" data-item="' + esc(it.id) + '"'
            + ' style="flex:0 0 ' + basis + '">'
            + media
            + (sub ? '<div class="gd-sub">' + esc(sub) + '</div>' : '')
            // the item's way OUT (page-templates.js `link`) — the same field
            // the swipe view renders, so a page carries its links through the
            // view switch instead of losing them on one side
            + (it.link && it.link.url
              ? '<div class="gd-link"><a href="' + esc(it.link.url) + '"'
                + ' target="_blank" rel="noopener">' + esc(it.link.label || 'Open')
                + ' ›</a></div>'
              : '')
            + '<div class="gd-acts">' + actsHtml(it) + '</div>'
            + '</div>';
        }).join('')
        + '</div></div>';
    }).join('');
    mount.innerHTML = html;

    // ── the PROMPT overlay — the Assets tab's, to the letter ──
    // …plus one thing the Assets tab can't do: on the STYLE side, the lines
    // this variant does NOT share with the row's other variants show in rose
    // (Sophie, Aug 2026: "ideally showing the lines that are different in the
    // style tab"). Segments split on newlines, else on sentence marks, and
    // the raw pieces are rejoined as-is so the exact filed text still reads.
    function normSeg(s) {
      return String(s || '').toLowerCase().replace(/\s+/g, ' ')
        .replace(/[.,;:\s]+$/, '').trim();
    }
    function segsOf(s) {
      s = String(s || '');
      if (/\n/.test(s)) return s.split(/(\n+)/);
      return s.match(/[^.;]+[.;]*\s*/g) || [s];
    }
    function styleHtml(it) {
      var own = String(it.promptStyle || '');
      var others = (mates[it.id] || []).map(function (o) {
        return String(o.promptStyle || '');
      }).filter(function (s) {
        return normSeg(s) && normSeg(s) !== normSeg(own);
      });
      if (!own || !others.length) return esc(own);
      var otherSets = others.map(function (s) {
        var set = {};
        segsOf(s).forEach(function (x) { var n = normSeg(x); if (n) set[n] = 1; });
        return set;
      });
      return segsOf(own).map(function (x) {
        var n = normSeg(x);
        if (!n) return esc(x);
        var everywhere = otherSets.every(function (set) { return set[n]; });
        return everywhere ? esc(x) : '<mark class="gd-diff">' + esc(x) + '</mark>';
      }).join('');
    }
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
      // "[compressed]" leads the caption and each prompt half when this
      // picture's only copy was encoded lossily before it reached us. The flag
      // is the data (compressedAtBirth); the bracket text is presentation.
      var comp = it.compressedAtBirth
        ? '<span class="gd-comp">[compressed]</span>' : '';
      // CONTENT is the side that opens (Sophie) — style only when it's all there is
      var side = hasC ? 'content' : 'style';
      function paint() {
        ov.innerHTML = '<div class="gd-ovcard">'
          // the mark still shows on a picture that carries no caption at all
          + (mq || comp ? '<div class="gd-ovmq">' + comp + (comp && mq ? ' ' : '') + esc(mq) + '</div>' : '')
          + '<div class="gd-ovtabs">'
          + '<button type="button" data-side="content"' + (side === 'content' ? ' class="on"' : '')
          + (hasC ? '' : ' disabled') + '>CONTENT</button>'
          + '<button type="button" data-side="style"' + (side === 'style' ? ' class="on"' : '')
          + (hasS ? '' : ' disabled') + '>STYLE</button>'
          + '</div>'
          + '<div class="gd-ovtext">' + comp
          + (side === 'content' ? esc(it.promptContent || '') : styleHtml(it)) + '</div>'
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
      var b = e.target && e.target.closest ? e.target.closest('[data-v],[data-prompt],[data-lb]') : null;
      if (!b) return;
      var lid = b.getAttribute('data-lb');
      if (lid) { var lit = byId[lid]; if (lit) openAsset(lit); return; }
      var pid = b.getAttribute('data-prompt');
      if (pid) { var pit = byId[pid]; if (pit) showPrompt(pit); return; }
      var it = byId[b.getAttribute('data-id')];
      if (!it) return;
      var val;
      try { val = JSON.parse(b.getAttribute('data-v')); } catch (_) { val = b.getAttribute('data-v'); }
      setVerdict(it, val);
    });

    // NO NOTE + ON THE TILE (Aug 2026, Sophie: "for the note + thing it's
    // making an extra line, so could you make it only appear in lightbox view
    // for now — I might rescind that later"). The shared kit's + sat on its
    // own line under every tile and cost a row of height on a grid whose whole
    // point is seeing the set at once; the note box inside the lightbox is the
    // same conversation (it posts to the same asset thread), one tap away.
    // THE TOUR (Aug 2026, Sophie): each control spotlighted, the rest
    // tinted, a line of explanation. Plays once on a template grid's first
    // open; replayable from the "?" forever.
    function tourSteps() {
      var steps = [{ sel: '.gd-row', text: 'Each row is one comparison — the things on '
        + 'it differ by exactly one thing; the line under each picture says '
        + 'what changed on that one.' }];
      steps.push(states
        ? { sel: '.gd-state', text: 'Mark an item with one of these — tap the same one '
          + 'again to unmark it.' }
        : { sel: '.gd-vote.yes', text: '♥ keeps it, ✕ passes. On images from the Assets '
          + 'tab, the same heart shows up there too — the two always agree.' });
      steps.push({ sel: '.gd-prompt', text: 'PROMPT shows the exact text that made this '
        + 'image — what it depicts first, the style behind the second tab.' });
      steps.push({ sel: '.gd-it img', text: 'Tap any picture to open it big — the '
        + 'heart, a note box and the prompt, same as the Assets tab.' });
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

    // rebuild one tile's buttons — used when the Assets tab hands us something
    // the page's frozen data never had (a filed prompt earns a PROMPT button)
    function repaintActs(id) {
      var host = mount.querySelector('[data-item="' + id + '"] .gd-acts');
      if (!host) return;
      host.innerHTML = actsHtml(byId[id]);
      paintActs(id);
    }

    // resume: the page's own verdicts first; then the chat's Assets tab fills
    // in what the page is missing — an Assets-tab ♥/✕ for any item with no
    // verdict (so the two surfaces agree in BOTH directions), AND THE FILED
    // PROMPT for any item whose data never carried one.
    //
    // THE PROMPT FILL (Aug 2026, Sophie: "I don't see a prompt box for this
    // chat"). A template page's DATA is frozen at post time, so a page whose
    // chat left promptStyle/promptContent out of its items can never grow a
    // PROMPT button — even though the pictures themselves have their prompts
    // filed against them in the Assets tab. Reading them here fixes every page
    // ALREADY POSTED, with nothing to re-post, and costs no extra request: the
    // Assets read is the one this block already makes. The page's own data
    // still wins where it has any — a chat that filed a page-specific prompt
    // meant it.
    function loadVerdicts() {
      return fetch('/api/chatfeed/verdict?chat=' + encodeURIComponent(chat)
      + '&sheet=' + encodeURIComponent(sheet))
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (d) {
        var iv = (d && d.items) || {};
        Object.keys(byId).forEach(function (id) {
          if (iv[id] !== null && iv[id] !== undefined) verdicts[id] = iv[id];
          else delete verdicts[id];            // cleared in the other view
        });
        Object.keys(byId).forEach(paintActs);
        // THE COMPRESSED FLAG IS ALWAYS WORTH THE READ. A page's data is frozen
        // at post time and the tagging pass runs long after, so a picture marked
        // damaged today can only reach an already-posted page from here — the
        // same argument as THE PROMPT FILL. That does mean a page whose items
        // all carry verdicts AND prompts now makes this one extra request where
        // it used to make none; an unmarked damaged picture is the worse trade.
        var wantAssets = Object.keys(byId).some(function (id) {
          var it = byId[id];
          if (!it.url) return false;
          return verdicts[id] === undefined
            || !(it.promptContent || it.promptStyle)
            || !it.compressedAtBirth;
        });
        if (!wantAssets) return null;
        return fetch('/api/gallery/assets?chat=' + encodeURIComponent(chat) + '&limit=500')
          .then(function (r) { return r.ok ? r.json() : {}; })
          .catch(function () { return {}; })
          .then(function (a) {
            var votes = {}; var rows = {};
            ((a && a.assets) || []).forEach(function (as) {
              if (as.vote) votes[as.url] = as.vote === 'like';
              rows[as.url] = as;
              // one picture can sit at two storage paths; the union hands the
              // others along as `alts`, and the page may name either
              (as.alts || []).forEach(function (u) {
                rows[u] = as;
                if (as.vote) votes[u] = as.vote === 'like';
              });
            });
            Object.keys(byId).forEach(function (id) {
              var it = byId[id];
              if (!it.url) return;
              if (verdicts[id] === undefined && votes[it.url] !== undefined) {
                verdicts[id] = votes[it.url];
                paintActs(id);
              }
              var as = rows[it.url];
              if (!as) return;
              // BEFORE the prompt fill's early return: an item that already
              // carries its prompt still needs to learn it is damaged, and the
              // page's own data can never carry that (see wantAssets above).
              // (the lightbox view is built lazily from `it` by asset-view.js,
              // so setting it here is enough — same as the prompt fill below)
              if (as.compressedAtBirth) it.compressedAtBirth = true;
              if (it.promptContent || it.promptStyle) return;
              if (!as.promptContent && !as.promptStyle) return;
              it.promptStyle = as.promptStyle || '';
              it.promptContent = as.promptContent || '';
              // …and the caption too, when the page never carried one
              if (!it.model && !it.quality) {
                var cap = /^([^·]{1,60}?)\s*·\s*([a-z0-9-]{1,20})$/i.exec(String(as.prompt || '').trim());
                if (cap) { it.model = cap[1].trim(); it.quality = cap[2].trim().toLowerCase(); }
              }
              repaintActs(id);   // the PROMPT button exists now
            });
          });
      });
    }
    loadVerdicts();

    // A NOTE ON THE SPREAD (Aug 2026, Sophie: "so I can leave a note per card,
    // or per spread"). A card's note lives in its lightbox, on the picture; a
    // spread has no picture, so it gets the SHARED note affordance — the small
    // + in its corner, saved to the same verdict doc under the spread's key.
    // The kit keys off `data-item`, which the group already carries, so this
    // is a wiring line rather than a note box of its own.
    if (window.__compareNotes && groups.some(function (g) { return g.id; })) {
      window.__compareNotes({ chat: chat, sheet: sheet, selector: '.gd-group[data-item]' });
    }

    // the handle the two-view page holds: a mark she made while swiping shows
    // on these tiles when she switches back (both views write the same doc)
    return { refresh: function () { return loadVerdicts(); } };
  };
})();
