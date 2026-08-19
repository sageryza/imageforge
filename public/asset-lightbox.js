/* asset-lightbox.js — THE Assets-tab image lightbox, shared (Aug 2026,
   Sophie: "when I open up the image, I'd like it to be identical to what
   happens when I open the image in assets … rather than redoing all this
   stuff I would just port that exact code").

   This IS that exact code — the lightbox lifted verbatim out of chats.html's
   Assets tab (big picture; ♥/✕ on the image's top corners; PROMPT covering
   the picture with the Style|Content toggle, content first; the note THREAD
   under the image with the letter-box; MODEL · QUALITY tag over the label;
   freeze-the-page with exact scrollY restore) so the Assets tab and the
   template grid pages open the same thing. One copy on purpose: two hand
   copies had already drifted (assets.html grew action icons while only
   chats.html got the iOS scroll-restore fix).

     window.__assetLightbox(url, asset)

   `asset` is the Assets tab's own item shape and every part is optional:
     { description, prompt (the MODEL · QUALITY caption), promptStyle,
       promptContent, vote:'like'|'dislike'|null, thread:[{from,text,at}],
       _cast(v), _noteSend(text, cb), _markSeen(), unread }
   ♥/✕ and the note box appear only when the caller wires _cast (votes) —
   the caller owns WHERE a vote lands (the Assets tab posts the asset vote;
   a grid page also saves its page verdict), same as it always did.

   Self-contained: injects its own CSS (the exact rules from chats.html,
   vote-button base included so a compare page needs nothing else), creates
   #clightbox if the page doesn't carry one, and uses the page's own
   scrollStop when there is one (chats.html's, or the injected pill's). */
(function () {
  if (window.__assetLightbox) return;

  var css = document.createElement('style');
  css.textContent =
    /* lightbox: ♥ / ✕ overlaid on the image corners; note box sits under the image */
    '.lbtop{position:absolute; top:max(18px, env(safe-area-inset-top)); left:22px; right:22px; display:flex; gap:8px; align-items:center; justify-content:space-between; z-index:2;}\n'
    /* the vote circles, base included — a page outside chats.html has no .vote rule */
    + '#clightbox .vote{width:38px; height:38px; border-radius:50%; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer;\n'
    + '  background:rgba(250,247,240,.9); color:#8a8377; box-shadow:0 1px 4px rgba(0,0,0,.2); padding:0; flex:none;}\n'
    + '#clightbox .vote svg{width:18px; height:18px; display:block;}\n'
    + '#clightbox .vote.heart.on{background:#c96a5e; color:#fff;}\n'
    + '#clightbox .vote.nope.on{background:#3a3530; color:#fff;}\n'
    + '.lbnote{display:flex; gap:6px; width:100%; margin-top:8px;}\n'
    + '.lbnote input{flex:1; min-width:0; border:none; border-radius:6px; background:rgba(250,247,240,.92); color:#26221c;\n'
    + "  font-family:'EBGaramond',Georgia,serif; font-size:15px; padding:8px 10px; box-shadow:0 1px 4px rgba(0,0,0,.2);}\n"
    + '.lbnote .notesend{width:38px; height:38px; border-radius:50%; border:none; background:rgba(250,247,240,.92); color:#5d7a5a;\n'
    + '  display:flex; align-items:center; justify-content:center; cursor:pointer; flex:none; box-shadow:0 1px 4px rgba(0,0,0,.2); padding:0;}\n'
    + '.lbnote .notesend svg{width:18px; height:18px; display:block;}\n'
    + '.lbnote .notesend.saved{background:#5d7a5a; color:#fff;}\n'
    /* The note thread under the image: her letters and the chat's replies back.
       Its own scroll area so a long exchange can never push the picture off. */
    + '.lbtalk{width:min(92vw,360px); margin-top:12px;}\n'
    + '.lbthread{max-height:26vh; overflow-y:auto; -webkit-overflow-scrolling:touch;\n'
    + '  display:flex; flex-direction:column; gap:5px;}\n'
    + ".lbmsg{max-width:82%; padding:7px 10px; border-radius:6px; font-family:'EBGaramond',Georgia,serif;\n"
    + '  font-size:14px; line-height:1.4; word-break:break-word; white-space:pre-wrap;}\n'
    + '.lbmsg.me{align-self:flex-end; background:rgba(250,247,240,.92); color:#26221c;}\n'
    + '.lbmsg.them{align-self:flex-start; background:rgba(250,247,240,.14); color:#ece6da;}\n'
    + '.lbmsg.pending{opacity:.55;}\n'
    + '.lbmsg.failed{opacity:1; box-shadow:inset 0 0 0 1px #c96a5e; cursor:pointer;}\n'
    + '#clightbox{position:fixed; inset:0; background:rgba(15,13,10,.93); z-index:30; display:none; align-items:center; justify-content:center; padding:18px; flex-direction:column;}\n'
    + '#clightbox img{max-width:100%; max-height:88vh; border-radius:6px;}\n'
    /* With a note thread under it the picture can't have the whole screen, or the
       thread and the box you type in fall off the bottom. */
    + '#clightbox.hastalk img{max-height:46vh;}\n'
    + '#clightbox .clcap{color:#b9b2a4; font-size:12px; margin-top:12px; text-align:center; letter-spacing:.02em;}\n'
    /* MODEL · QUALITY sits ABOVE the label, dimmer and smaller — the label is
       what she reviews by, the tag is how it was made. */
    + '#clightbox .cltag{color:#8a8377; font-size:11px; margin-top:10px; text-align:center; letter-spacing:.06em; text-transform:uppercase;}\n'
    + '#clightbox .cltag + .clcap{margin-top:4px;}\n'
    /* the prompt behind the image: covers it completely (that's the point — you
       read the words instead of the picture), Style on the left of the toggle,
       Content on the right. .clwrap only wraps the img so the overlay lands on
       exactly the image; it is deliberately NOT .clframe, which would move the
       ♥/✕ row off the screen corners it sits in today. */
    + '#clightbox .clwrap{position:relative; display:flex; align-items:center; justify-content:center; max-width:100%;}\n'
    /* The wrapper shrink-wraps the <img>, so on a slow connection it can still
       be 0×0 when you tap PROMPT — an inset:0 overlay would then render as an
       unreadable stamp. .pon (only while the prompt is showing, so nothing
       moves otherwise) floors the box so the words always have room. */
    + '#clightbox .clwrap.pon{min-width:min(86vw,420px); min-height:min(52vh,420px);}\n'
    + '.lbp{position:absolute; inset:0; border-radius:6px; background:rgba(15,13,10,.95); display:flex; flex-direction:column;\n'
    + '  padding:14px; box-sizing:border-box; z-index:1;}\n'
    + '.lbp .lbptog{display:flex; gap:6px; flex:none; margin-bottom:10px;}\n'
    + '.lbp .lbptog button{flex:1; margin:0; border:1px solid rgba(250,247,240,.35); border-radius:6px; background:none; color:#c8c1b3;\n'
    + '  font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.14em; text-transform:uppercase; padding:8px 4px; cursor:pointer;}\n'
    + '.lbp .lbptog button.on{background:#faf7f0; border-color:#faf7f0; color:#26221c;}\n'
    + '.lbp .lbptext{flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; color:#ece6da;\n'
    + "  font-family:'EBGaramond',Georgia,serif; font-size:15px; line-height:1.45; white-space:pre-wrap; word-break:break-word;}\n"
    + '.promptbtn{border:none; border-radius:6px; background:rgba(250,247,240,.9); color:#26221c; padding:7px 11px; margin:0;\n'
    + '  font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.14em; text-transform:uppercase; cursor:pointer;\n'
    + '  box-shadow:0 1px 4px rgba(0,0,0,.2); flex:none;}\n'
    + '.promptbtn.on{background:#3a3530; color:#faf7f0;}\n';
  document.head.appendChild(css);

  var HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  var XMARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  function stopScroll() {
    var s = window.scrollStop || window.__scrollStop;
    if (s) try { s(); } catch (_) { /* the pill repaints itself */ }
  }

  // Image lightbox — freezes the page behind it (design rule)
  window.__assetLightbox = function (url, asset) {
    stopScroll();
    // The house overlay rule: stop the autoscroll, lock the background, and
    // restore the EXACT scroll position on close. The restore is load-bearing
    // HERE because of the NOTE BOX: focusing an input inside a position:fixed
    // overlay makes iOS scroll the DOCUMENT underneath to reveal the caret
    // (overflow:hidden does not stop that), so leaving a comment on an image
    // used to close onto a completely different part of the tab.
    var lbY = window.scrollY;
    var lb = document.getElementById('clightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'clightbox';
      document.body.appendChild(lb);
    }
    lb.innerHTML = '<div class="clwrap"><img alt="" src="' + url.replace(/"/g, '&quot;') + '"></div>';
    lb.classList.remove('hastalk');   // last image's thread must not shrink this one
    // The generating prompt, over the image: Style left, Content right, tap the
    // PROMPT button to cover/uncover the picture. Only offered when a chat
    // actually filed a split — nothing is shown (and nothing is said) when it
    // didn't. Built before .lbtop so the button can join that row.
    var promptBtn = null;
    if (asset && (asset.promptStyle || asset.promptContent)) {
      var wrap = lb.querySelector('.clwrap');
      var ov = document.createElement('div'); ov.className = 'lbp'; ov.style.display = 'none';
      ov.onclick = function (e) { e.stopPropagation(); };   // reading it must not close the lightbox
      var tog = document.createElement('div'); tog.className = 'lbptog';
      var sb = document.createElement('button'); sb.textContent = 'Style';
      var cb = document.createElement('button'); cb.textContent = 'Content';
      var txt = document.createElement('div'); txt.className = 'lbptext';
      // CONTENT IS THE DEFAULT SIDE (Aug 2026, Sophie: "right now the style is
      // the default and I want it to be the content, so I don't have to click
      // all the time"). Style still wins when content is the only half missing.
      var side = asset.promptContent ? 'content' : 'style';
      function paintSide() {
        sb.classList.toggle('on', side === 'style');
        cb.classList.toggle('on', side === 'content');
        txt.textContent = (side === 'style' ? asset.promptStyle : asset.promptContent) || '';
        txt.scrollTop = 0;
      }
      sb.onclick = function (e) { e.stopPropagation(); side = 'style'; paintSide(); };
      cb.onclick = function (e) { e.stopPropagation(); side = 'content'; paintSide(); };
      tog.appendChild(sb); tog.appendChild(cb);
      ov.appendChild(tog); ov.appendChild(txt);
      paintSide();
      wrap.appendChild(ov);
      promptBtn = document.createElement('button');
      promptBtn.className = 'promptbtn'; promptBtn.textContent = 'Prompt';
      promptBtn.onclick = function (e) {
        e.stopPropagation();
        var open = ov.style.display === 'none';
        ov.style.display = open ? 'flex' : 'none';
        wrap.classList.toggle('pon', open);
        promptBtn.classList.toggle('on', open);
      };
    }
    // ♥/✕ overlaid on the image (left / right); the note box sits UNDER the image.
    if (asset && asset._cast) {
      var row = document.createElement('div'); row.className = 'lbtop';
      row.onclick = function (e) { e.stopPropagation(); };
      var hb = document.createElement('button'); hb.className = 'vote heart'; hb.innerHTML = window.__HEART || HEART;
      var xb = document.createElement('button'); xb.className = 'vote nope'; xb.innerHTML = window.__XMARK || XMARK;
      // The thread: her notes and the chat's replies back, oldest at the top.
      // Snail mail — the chat that made the image answers next time she messages
      // it, so a reply landing here later is normal and expected.
      var talk = document.createElement('div'); talk.className = 'lbtalk';
      talk.onclick = function (e) { e.stopPropagation(); };
      var th = document.createElement('div'); th.className = 'lbthread';
      function paintThread() {
        th.innerHTML = '';
        var msgs = asset.thread || [];
        msgs.forEach(function (m) {
          var b = document.createElement('div');
          b.className = 'lbmsg ' + (m.from === 'chat' ? 'them' : 'me');
          b.textContent = m.text;
          th.appendChild(b);
        });
        th.style.display = msgs.length ? '' : 'none';
        th.scrollTop = th.scrollHeight;   // newest letter in view
      }
      var nw = document.createElement('div'); nw.className = 'lbnote';
      var ni = document.createElement('input'); ni.placeholder = 'Write a note…';
      var ns = document.createElement('button'); ns.className = 'notesend';
      // Lucide "send" — the paper aeroplane (lucide-static 1.27.0)
      ns.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>';
      function sendNote() {
        var t = (ni.value || '').trim();
        if (!t) return;
        // It leaves the box the moment it's sent and joins the thread underneath,
        // so the box is always empty and ready for the next one.
        ni.value = '';
        asset.thread = (asset.thread || []).concat([{ from: 'sophie', text: t, at: new Date().toISOString() }]);
        paintThread();
        var el = th.lastChild;
        el.classList.add('pending');
        function attempt() {
          el.classList.remove('failed'); el.classList.add('pending');
          asset._noteSend(t, function (ok) {
            el.classList.remove('pending');
            if (ok) return;
            // Nothing is lost on a failure — the letter stays on screen, outlined,
            // and tapping it tries again.
            el.classList.add('failed');
            el.title = 'Not sent — tap to try again';
            el.onclick = function (e) { e.stopPropagation(); attempt(); };
          });
        }
        attempt();
      }
      ns.onclick = function (e) { e.stopPropagation(); sendNote(); };
      ni.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); sendNote(); } };
      nw.appendChild(ni); nw.appendChild(ns);
      talk.appendChild(th); talk.appendChild(nw);
      paintThread();
      if (asset._markSeen) asset._markSeen();   // opening it counts as reading it
      asset._lbPaint = function () {
        hb.classList.toggle('on', asset.vote === 'like');
        xb.classList.toggle('on', asset.vote === 'dislike');
      };
      asset._lbPaint();
      hb.onclick = function (e) { e.stopPropagation(); asset._cast('like'); };
      xb.onclick = function (e) { e.stopPropagation(); asset._cast('dislike'); };
      // ♥ left, Prompt in the middle, ✕ right (the row is space-between)
      row.appendChild(hb); if (promptBtn) row.appendChild(promptBtn); row.appendChild(xb);
      var frame = lb.querySelector('.clframe');
      (frame || lb).appendChild(row);
      lb.appendChild(talk);   // thread + note box below the image, never over it
      lb.classList.add('hastalk');   // shrinks the picture so the thread has room
    }
    if (promptBtn && !promptBtn.parentNode) {   // image opened without the curate row
      var prow = document.createElement('div'); prow.className = 'lbtop';
      prow.style.justifyContent = 'center';
      prow.onclick = function (e) { e.stopPropagation(); };
      prow.appendChild(promptBtn); lb.appendChild(prow);
    }
    // Two lines, not one: the curated model/quality tag (never the hook's
    // generic "from <chat>") above the label. `description||prompt` hid the tag
    // on every labelled image.
    var tag = asset ? String(asset.prompt || '') : '';
    if (/^from /.test(tag)) tag = '';
    var cap = asset ? (asset.description || '') : '';
    if (!cap && tag) { cap = tag; tag = ''; }
    if (tag) { var tc = document.createElement('div'); tc.className = 'cltag'; tc.textContent = tag; lb.appendChild(tc); }
    if (cap) { var cc = document.createElement('div'); cc.className = 'clcap'; cc.textContent = cap; lb.appendChild(cc); }
    lb.style.display = 'flex'; document.body.style.overflow = 'hidden'; document.body.classList.add('ontop');
    lb.onclick = function () {
      if (asset) asset._lbPaint = null;
      // Blur FIRST: a still-focused note box makes iOS scroll again as the
      // keyboard leaves, which would land after our restore and undo it.
      var f = document.activeElement; if (f && f.blur) f.blur();
      lb.style.display = 'none'; lb.innerHTML = '';
      lb.classList.remove('hastalk'); document.body.style.overflow = ''; document.body.classList.remove('ontop');
      window.scrollTo(0, lbY);
      // …and again next frame, for the keyboard-dismissal scroll that lands late.
      requestAnimationFrame(function () { window.scrollTo(0, lbY); });
    };
  };
})();
