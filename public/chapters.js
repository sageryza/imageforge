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

   HORIZONTAL — progressive expansion / contraction. ONE sticky bar at the
   top of the list sets the depth for the whole page (v3, Sophie: "not per
   section but for the whole thing, and they stay pinned even when I scroll
   down so they can still be clicked"), and whichever chapter is open shows
   at that level:

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
     copy  — OPTIONAL { cards: [{img?, kicker?, h?, body}] }: the REWRITTEN
             lesson copy for review (v6, Sophie: "add one more section so
             there's four — where the new copy will go so I can read it
             first before you add it to the cards"). Any chapter carrying it
             grows the page a 4th tab; [[words]] in any field = words that
             are MINE, not hers, rendered red with a star.

   Notes ride the same verdict doc every reviewable surface uses (the
   standing rule), so a chat reads them back with
   GET /api/chatfeed/verdict?chat=&sheet=.

   V2 (Aug 2026, Sophie, after using v1):
   - **Opening a chapter must NOT move the page.** v1 scrolled the row to the
     top, which threw her place away every time she opened or closed one.
     Nothing scrolls now; the body simply appears under the row she tapped.
   - **The level switch is the account-tabs hairline**, not chips — three
     labels over a hairline with a 2px line that SLIDES to the open one
     (`.acctabs` in chats.html, ported verbatim). Her ask, and it is the
     app's established "these are the same thing, pick one" pattern.
   - **Titles are the sans, caps, not bold** — the chat-row voice
     (`.cr-name`), not the serif masthead voice.
   - **A chapter carries its KIND as a colour dot**: lesson pink,
     experiment yellow, build mint, research blue. Fixed colours, like the
     Chats row's ⊖ — the dot sits on cream in both themes.
   - **Level 3 is the CHAT MESSAGE style**, collapsible the same way: a long
     message shows two lines until tapped, short ones show whole.

   Style: compare.css tokens only — they are also what keeps the injected
   autoscroll pill from rendering black. TAPPING THE PROSE STARTS/STOPS THE
   AUTOSCROLL like any other page (v5) — the controls are real buttons and
   inputs, so the shared exempt list handles them; only a long message needs
   its own [data-nostop], since its expander is a .onclick property. */
(function () {
  if (window.__chapters) return;

  var css = document.createElement('style');
  css.textContent =
    /* THE TITLE ALONE (Sophie, Aug 2026: "keep the title, but get rid of the
       gold text above it and the tagline below it"). A chapters page is a
       spine she scrolls — the gold eyebrow and the one-line sub were two rows
       of chrome before the first chapter, restating what the title says.
       Scoped to pages that load THIS file, so every other Compare page keeps
       the shared header; the builders no longer emit either, and this rule is
       what takes them off pages already posted. */
    '.wrap > .eyebrow, .wrap > .sub{display:none;}' +
    '.cx{max-width:680px;margin:0 auto;}' +
    /* one chapter = a row that opens. The KIND dot leads it. */
    '.cx-ch{border-top:1px solid var(--line);}' +
    '.cx-ch:last-child{border-bottom:1px solid var(--line);}' +
    /* CENTRED, not baseline — the tile is 54px tall and dominates the row, so
       the title and date sit against its middle rather than its feet. */
    '.cx-head{display:flex;align-items:center;gap:12px;width:100%;text-align:left;' +
    ' background:none;border:0;padding:9px 0;cursor:pointer;color:var(--ink);' +
    ' -webkit-tap-highlight-color:transparent;}' +
    /* THE KIND IS A DRAWING, NOT A COLOURED DOT (Sophie, Aug 2026: "replace
       the little dots in different colors with the icons you picked"). A dot
       needs a legend; a magnifying glass says research by itself. Pass icons
       per kind via the `icons` option — the engine ships none, so a page that
       supplies nothing falls back to the coloured dot it always had. */
    /* THE DRAWING SITS IN A PASTEL TILE AND OWNS THE ROW (Sophie, Aug 2026:
       "the icons are still too small — make them take up most of the line…
       could you put little coloured rounded square boxes around them,
       different colours, pastels"). 22px → 32px → a 54px tile: at the smaller
       sizes it read as a bullet beside the title instead of the row's picture.

       WHY MULTIPLY WORKS OVER A COLOURED TILE (measured, not assumed): the
       icons are opaque RGB cut from the pastel lesson sheet, corners pure
       #ffffff — so white × pastel leaves the pastel untouched and only the
       ink darkens. No transparent PNGs needed, and no halo. */
    '.cx-tile{flex:none;width:54px;height:54px;border-radius:10px;display:flex;' +
    ' align-items:center;justify-content:center;overflow:hidden;}' +
    '.cx-ico{width:44px;height:44px;display:block;object-fit:contain;' +
    ' mix-blend-mode:multiply;}' +
    '.cx-dot{width:12px;height:12px;border-radius:50%;}' +
    /* Flat pastels, no gradients — three of them are her own words for the
       palette she picked ("lilac, pastel pink, mint green"). Seven, assigned
       by row order, so a colour never lands next to itself. */
    '.cx-p0{background:#ddd3ea;}' +   /* lilac */
    '.cx-p1{background:#f0d4dd;}' +   /* pastel pink */
    '.cx-p2{background:#cfe6d8;}' +   /* mint green */
    '.cx-p3{background:#f0e4bf;}' +   /* butter */
    '.cx-p4{background:#cfdcea;}' +   /* powder blue */
    '.cx-p5{background:#f2ddcb;}' +   /* peach */
    '.cx-p6{background:#dbe3cf;}' +   /* sage */
    '.cx-k-lesson{background:#e39ab4;}' +      /* her colours: lessons pink */
    '.cx-k-experiment{background:#e3c25c;}' +  /* experiments yellow */
    '.cx-k-build{background:#8fc7ae;}' +       /* everything else: mint */
    '.cx-k-research{background:#94b4d6;}' +    /* and light blue */
    /* the title is the CHAT-ROW voice: sans, caps, tracked, NOT bold */
    '.cx-t{flex:1;min-width:0;font-family:-apple-system,sans-serif;font-size:13.5px;' +
    ' font-weight:400;letter-spacing:.04em;text-transform:uppercase;line-height:1.3;}' +
    '.cx-ch.on .cx-t{color:var(--ink);}' +
    '.cx-when{flex:none;font:400 10px/1.4 -apple-system,sans-serif;color:var(--ink2);' +
    ' letter-spacing:.05em;white-space:nowrap;}' +
    '.cx-body{padding:0 0 18px;}' +
    /* THE LEVEL SWITCH IS ONE BAR FOR THE WHOLE PAGE, AND IT STAYS PUT
       (Sophie, Aug 2026: "have the gist/deeper/raw hairline buttons not
       per-section but for the whole thing, and they stay pinned — even when
       I scroll down, so they can still be clicked"). v2 drew a copy inside
       every open chapter, so the control scrolled away the moment she read
       past the top of a long chapter and she had to scroll back up to change
       depth. One bar, sticky at the top, governing whichever chapter is open.
       Still the account-tabs hairline, ported verbatim.
       IT RESERVES THE PILL'S CORNER (padding-right:56px). Stuck at the top it
       sits inside the autoscroll pill's x 324-374 / y 14-192 band, so without
       the reserve the RAW button's own half is under the pill and eats the
       tap. The sliding line then needs calc((100% - 56px)/3): an abspos
       child's percentages resolve against the PADDING box, so an inherited
       33.33% is wider than a tab and drifts right. */
    '.cx-lv{position:sticky;top:0;z-index:5;background:var(--paper);' +
    ' display:flex;border-bottom:1px solid var(--line);margin:0 0 2px;' +
    ' padding-right:56px;}' +
    '.cx-lv button{flex:1 1 0;min-width:0;padding:9px 4px 10px;border:none;background:none;' +
    ' cursor:pointer;font-family:-apple-system,sans-serif;font-size:10px;' +
    ' letter-spacing:.08em;text-transform:uppercase;color:var(--ink2);' +
    ' -webkit-tap-highlight-color:transparent;}' +
    '.cx-lv button.on{color:var(--ink);}' +   /* the sliding line says which — no bold */
    '.cx-lv::after{content:"";position:absolute;left:0;bottom:-1px;height:2px;' +
    ' width:calc((100% - 56px)/3);background:var(--ink);transform:translateX(0);' +
    ' transition:transform .2s ease;}' +
    '.cx-lv[data-on="2"]::after{transform:translateX(100%);}' +
    '.cx-lv[data-on="3"]::after{transform:translateX(200%);}' +
    /* A FOURTH LEVEL, only when a page carries it (Sophie, Aug 2026: "add one
       more section to the artifact so there's four — this is where the new
       copy will go so I can read it first before you add it to the cards").
       The bar grows a 4th tab ONLY when some chapter has `copy` — the two
       live artifacts without it keep their three tabs untouched. */
    '.cx-lv.lv4::after{width:calc((100% - 56px)/4);}' +
    '.cx-lv.lv4[data-on="4"]::after{transform:translateX(300%);}' +
    /* the copy level: the card's image small on the left, the new words
       beside it. HER words in ink; a word I changed or added is RED with a
       small star — different colour than the text, her spec, so nothing of
       mine can pass as hers. */
    '.cx-cp{display:flex;gap:12px;padding:13px 0;border-bottom:1px solid var(--line);}' +
    '.cx-cp:last-child{border-bottom:0;}' +
    '.cx-cpimg{flex:none;width:72px;height:72px;border-radius:8px;object-fit:cover;}' +
    '.cx-cptxt{flex:1;min-width:0;}' +
    '.cx-cpk{font:400 9px/1.4 -apple-system,sans-serif;letter-spacing:.12em;' +
    ' text-transform:uppercase;color:var(--ink2);margin:0 0 1px;}' +
    '.cx-cph{font:700 15px/1.35 Georgia,serif;margin:0 0 4px;}' +
    '.cx-cpb{font-size:14.5px;line-height:1.55;margin:0;white-space:pre-wrap;}' +
    '.cx-mine{color:#b3443f;}' +
    '.cx-mine:before{content:"\\2731";font-size:8px;vertical-align:super;margin-right:1px;}' +
    '.cx-cplegend{font:400 11px/1.5 -apple-system,sans-serif;letter-spacing:.05em;' +
    ' color:var(--ink2);padding:10px 0 4px;}' +
    '.cx-cplegend .cx-mine{letter-spacing:.05em;}' +
    /* THE NOTE + ONLY EXISTS ON THE OPEN CHAPTER (Sophie, Aug 2026: "make
       the plus for the note only appear once I open the section"). A closed
       row is a spine entry, and a + on every one of 28 of them is 28 offers
       to write something. A note she HAS written still shows on the closed
       row — that is the point of having written it. */
    '.cx-ch:not(.on) .cmp-note-open{display:none;}' +
    /* levels 1 and 2 */
    '.cx-l1{font:400 15px/1.55 Georgia,serif;margin:0 0 2px;}' +
    '.cx-l2{list-style:none;padding:12px 0 0;margin:0;}' +
    '.cx-l2 li{font:400 14px/1.5 -apple-system,sans-serif;color:var(--ink);' +
    ' padding:0 0 9px 14px;position:relative;}' +
    '.cx-l2 li:before{content:"";position:absolute;left:0;top:9px;width:5px;height:5px;' +
    ' border-radius:50%;background:var(--ink2);}' +
    '.cx-l2 li b{font-weight:700;}' +
    /* level 3 — the CHAT MESSAGE style (chats.html .msg / .m-chat / .m-full) */
    '.cx-msg{padding:14px 0;border-bottom:1px solid var(--line);}' +
    '.cx-msg:last-child{border-bottom:0;}' +
    '.cx-mhead{display:flex;gap:8px;align-items:baseline;}' +
    '.cx-who{font-family:-apple-system,sans-serif;font-size:11px;letter-spacing:.1em;' +
    ' text-transform:uppercase;color:var(--ink2);}' +
    '.cx-msg.me .cx-who{color:var(--rose);}' +
    '.cx-time{font-family:-apple-system,sans-serif;font-size:10px;color:var(--ink2);}' +
    '.cx-more{display:none;font-family:-apple-system,sans-serif;font-size:10px;' +
    ' letter-spacing:.1em;text-transform:uppercase;color:var(--ink2);margin-left:auto;}' +
    '.cx-msg.long .cx-more{display:inline;}' +
    '.cx-prev{font-size:16.5px;line-height:1.5;cursor:pointer;display:-webkit-box;' +
    ' -webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}' +
    '.cx-text{font-size:16.5px;line-height:1.6;white-space:pre-wrap;' +
    ' overflow-wrap:anywhere;}' +
    '.cx-msg.long .cx-text{display:none;}' +
    '.cx-msg.long.open .cx-text{display:block;}' +
    '.cx-msg.long.open .cx-prev{display:none;}' +
    '.cx-msg.long:not(.open) .cx-prev{display:-webkit-box;}' +
    '.cx-msg:not(.long) .cx-prev{display:none;}' +
    '.cx-att{display:inline-block;font:400 11px/1 -apple-system,sans-serif;' +
    ' color:var(--ink2);border:1px solid var(--line);border-radius:6px;' +
    ' padding:4px 7px;margin:2px 4px 2px 0;background:var(--surface);}' +
    '.cx-count{font:400 10px/1 -apple-system,sans-serif;letter-spacing:.08em;' +
    ' text-transform:uppercase;color:var(--ink2);padding:0 0 8px;}';
  document.head.appendChild(css);

  var LEVELS = [['1', 'gist'], ['2', 'deeper'], ['3', 'raw']];
  var KINDS = { lesson: 1, experiment: 1, build: 1, research: 1 };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  /* Bare **bold** in the level-2 lines — nothing else is interpreted, so a
     stray < in her words can never become markup. */
  function line(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  }
  /* The copy level's one extra marker: [[words]] = words that are MINE, not
     hers — rendered red with a small star. Escaped first, same as line(), so
     nothing in the text itself can become markup. */
  function copyLine(s) {
    return esc(s)
      .replace(/\[\[([^\]]+)\]\]/g, '<span class="cx-mine">$1</span>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
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
    /* TAP THE PAGE TO SCROLL (Sophie, Aug 2026: "right now only the pill
       works to scroll, but usually I can just tap the page — add that back,
       just exempt the places to open and close the things").
       v1 marked the WHOLE list [data-nostop], which in the app's embedded
       viewer means "pause a running scroll, never start one" — so the pill
       was the only way to start it. That blanket was over-broad: every
       control here is already a real <button>, <textarea> or <input>, and
       the shared exempt list (a,button,summary,details,input,textarea,
       select,label,video,audio,[onclick]) covers those by itself. So the
       chapter rows, the level bar and the note box do their own job without
       toggling the scroll, and a tap on the PROSE between them scrolls.
       The one gap the shared list cannot see is a long message: its expander
       is a `.onclick` PROPERTY, not an `[onclick]` attribute, so those rows
       are marked individually below. */

    var open = null;                       // one at a time — her spec
    var level = 1;                         // ONE level for the page, session-only
    var repaint = null;                    // the open chapter's painter

    /* The COPY level exists only when a page brings copy — the bar grows the
       tab by DATA, so the pages without any keep three tabs with no repost. */
    var hasCopy = list.some(function (c) { return c.copy && (c.copy.cards || []).length; });
    var levels = hasCopy ? LEVELS.concat([['4', 'copy']]) : LEVELS;

    /* The sticky bar, built once and living above the list. It is present
       even with nothing open: tapping a level then sets the depth the next
       chapter opens at, which is what "for the whole thing" means. */
    var bar = document.createElement('div');
    bar.className = 'cx-lv' + (hasCopy ? ' lv4' : '');
    bar.setAttribute('data-on', String(level));
    levels.forEach(function (L) {
      var b = document.createElement('button');
      b.setAttribute('data-lv', L[0]);
      b.textContent = L[1];
      if (String(level) === L[0]) b.className = 'on';
      b.onclick = function (ev) {
        ev.stopPropagation();
        level = Number(L[0]);
        bar.setAttribute('data-on', String(level));
        bar.querySelectorAll('button').forEach(function (x) {
          x.classList.toggle('on', x.getAttribute('data-lv') === L[0]);
        });
        /* Changing depth changes the open chapter's height, so hold ITS row
           under her finger the same way opening one does. */
        if (repaint) repaint();
      };
      bar.appendChild(b);
    });
    mount.appendChild(bar);

    var PALETTE = 7;                       // cx-p0 … cx-p6

    list.forEach(function (ch, i) {
      var el = document.createElement('div');
      el.className = 'cx-ch';
      el.setAttribute('data-item', ch.id);  // her note keys off this

      var head = document.createElement('button');
      head.className = 'cx-head';
      var kind = KINDS[ch.kind] ? ch.kind : 'build';
      // A chapter's OWN icon wins (Sophie, Aug 2026: "the icons you picked for
      // each one not Snake for all of them — use all the icons you made"), then
      // a per-kind icon, then the coloured dot. So a page can give every row
      // its own drawing and still fall back for rows that have none.
      var icon = ch.icon || (opts.icons || {})[kind];
      /* EVERY row gets a tile, drawing or not — a bare kind-dot beside a
         column of 54px tiles reads as a broken row, so a chapter with no
         drawing of its own shows its dot centred in the tile instead. */
      head.innerHTML =
        '<span class="cx-tile cx-p' + (i % PALETTE) + '">' +
        (icon
          ? '<img class="cx-ico" src="' + esc(icon) + '" alt="' + esc(kind) + '">'
          : '<span class="cx-dot cx-k-' + kind + '"></span>') +
        '</span>' +
        // No 01/02/03 (Sophie, Aug 2026: "get rid of the numbers"). The order
        // is the page, and a number on every row is a column of nothing.
        '<span class="cx-t">' + esc(ch.title) + '</span>' +
        '<span class="cx-when">' + esc(ch.when || '') + '</span>';
      el.appendChild(head);

      var bodyEl = document.createElement('div');
      bodyEl.className = 'cx-body';
      bodyEl.hidden = true;
      el.appendChild(bodyEl);

      function paint() {
        var lv = level;                      // the page's one level, not this row's
        var h = '';
        /* EACH LEVEL SHOWS SOMETHING DIFFERENT (Sophie, Aug 2026: "for the
           medium level of detail get rid of the one-sentence summary, because
           it ruins the rule of them having all different inputs"). v2 drew the
           gist again above the bullets, so 'deeper' was 'gist plus' rather
           than its own view — and the sentence she had just read sat in the
           way of the detail she tapped for. 1 is the gist, 2 is the detail,
           3 is the raw. Nothing repeats. */
        if (lv === 1) {
          h += '<p class="cx-l1">' + line(ch.l1 || '') + '</p>';
        } else if (lv === 2) {
          if ((ch.l2 || []).length) {
            h += '<ul class="cx-l2">';
            ch.l2.forEach(function (x) { h += '<li>' + line(x) + '</li>'; });
            h += '</ul>';
          } else {
            // no detail written — say so rather than showing a blank body
            h += '<p class="cx-l1">' + line(ch.l1 || '') + '</p>';
          }
        } else if (lv === 4) {
          /* THE NEW COPY, for review before it goes anywhere near the real
             cards. Same images, rewritten words — hers verbatim in ink, and
             any word that is MINE marked red ([[..]] in the data), so she can
             see exactly where the telling was touched. */
          var cp = ch.copy || {};
          if ((cp.cards || []).length) {
            h += '<div class="cx-cplegend">your words in ink · ' +
              '<span class="cx-mine">red&nbsp;=&nbsp;a word that is mine, not yours</span></div>';
            cp.cards.forEach(function (c) {
              h += '<div class="cx-cp">' +
                (c.img ? '<img class="cx-cpimg" src="' + esc(c.img) + '" alt="">' : '') +
                '<div class="cx-cptxt">' +
                (c.kicker ? '<p class="cx-cpk">' + copyLine(c.kicker) + '</p>' : '') +
                (c.h ? '<p class="cx-cph">' + copyLine(c.h) + '</p>' : '') +
                '<p class="cx-cpb">' + copyLine(c.body || '') + '</p>' +
                '</div></div>';
            });
          } else {
            h += '<p class="cx-l1">No new copy written for this chapter yet.</p>';
          }
        } else {
          /* The CHAT MESSAGE style, collapsible the same way: a long message
             shows two lines until tapped. Short ones show whole — collapsing
             a one-line message would be a tap that reveals nothing. */
          var msgs = ch.msgs || [];
          h += '<div class="cx-count">' + msgs.length + ' messages</div>';
          msgs.forEach(function (m) {
            var me = m.who === 'sophie';
            var txt = body(m.text || '');
            var long = (m.text || '').length > 220;
            // a LONG message opens on tap, and its handler is a .onclick
            // PROPERTY — invisible to the shared [onclick] exempt — so mark it
            // pause-only by hand. A short one has no handler and scrolls.
            h += '<div class="cx-msg ' + (me ? 'me' : 'them') + (long ? ' long' : '') +
              '"' + (long ? ' data-nostop' : '') + '>' +
              '<div class="cx-mhead"><span class="cx-who">' + (me ? 'me' : 'claude') + '</span>' +
              '<span class="cx-time">' + esc(when(m.at)) + '</span>' +
              '<span class="cx-more">more</span></div>' +
              '<div class="cx-prev">' + txt + '</div>' +
              '<div class="cx-text">' + txt + '</div></div>';
          });
        }
        bodyEl.innerHTML = h;
        bodyEl.querySelectorAll('.cx-msg.long').forEach(function (mEl) {
          mEl.onclick = function () { mEl.classList.toggle('open'); };
        });
      }

      /* KEEP THE PAGE WHERE IT IS (Sophie, v2: "I don't like how it jumps
         around when I open and close a tab"). An accordion moves everything
         below AND above the change, so pinning is not "don't scroll" — it is
         measure the tapped row, mutate, then put that row back under her
         finger. */
      function hold(fn) {
        var before = el.getBoundingClientRect().top;
        fn();
        var after = el.getBoundingClientRect().top;
        if (after !== before) window.scrollBy(0, after - before);
      }

      head.onclick = function () {
        hold(function () {
          if (open === el) {                     // tapping the open one closes it
            el.classList.remove('on'); bodyEl.hidden = true;
            open = null; repaint = null; return;
          }
          if (open) {                            // the rest collapse — her spec
            open.classList.remove('on');
            open.querySelector('.cx-body').hidden = true;
          }
          open = el;
          el.classList.add('on');
          paint();
          bodyEl.hidden = false;
          // the bar drives whichever chapter is open, and holds ITS row
          repaint = function () { hold(paint); };
        });
      };

      mount.appendChild(el);
    });

    if (opts.chat && opts.sheet && window.__compareNotes) {
      window.__compareNotes({ chat: opts.chat, sheet: opts.sheet });
    }
  };
})();
