/* asset-lightbox.js — THE Assets-tab image lightbox, shared (Aug 2026,
   Sophie: "when I open up the image, I'd like it to be identical to what
   happens when I open the image in assets … rather than redoing all this
   stuff I would just port that exact code").

   This IS that exact code — the lightbox lifted verbatim out of chats.html's
   Assets tab (big picture; ♥/✕ on the image's top corners; PROMPT covering
   the picture with the Style|Content toggle, content first; the note letter-box
   under the image; MODEL · QUALITY tag over the label; freeze-the-page with
   exact scrollY restore) so the Assets tab and the template grid pages open
   the same thing. One copy on purpose: two hand copies had already drifted
   (assets.html grew action icons while only chats.html got the iOS
   scroll-restore fix).

   THE THREAD SITS UNDER THE BOX, PEEKING (Aug 2026, Sophie's rework after
   living with it): writing a note is the common act and re-reading the
   exchange the occasional one, so the box comes first and the letters peek
   under it. A CHAT button beside PROMPT throws the whole conversation over
   the picture — and it appears only when the thread has more in it than the
   peek can show, measured rather than counted ("only have it show up IF there
   are extra notes that would need to scroll to see").

     window.__assetLightbox(url, asset)

   `asset` is the Assets tab's own item shape and every part is optional:
     { description, prompt (the MODEL · QUALITY caption), promptStyle,
       promptContent, vote:'like'|'dislike'|null, thread:[{from,text,at}],
       _cast(v), _noteSend(text, cb), _markSeen(), unread,
       actions:[{label, icon, onClick}], who }

   THE EXTRAS HOOKS EXIST SO THERE IS NO FOURTH COPY (Aug 2026). Meta
   Assets (`public/assets.html`) stayed a third hand copy of this lightbox for
   months, and both of the close bugs settled here reached Sophie there a
   second time ("I can't get out of the light box in Meta assets"). The only
   reason it was never migrated is that it had grown two things this file had
   nowhere to put:
     `actions` — a row of small circular icon buttons directly under the
       picture (open the chat it came from, re-run it in the Playground, save
       to Photos). `icon` is inline SVG markup, `label` becomes the aria-label
       AND the title, `onClick(e)` is called with the tap.
     `who` — one small uppercase line at the very bottom, under the caption:
       which chat this picture came from, on a surface that mixes many.
   Both are optional and additive, so every existing caller is untouched. Add
   a hook rather than a copy the next time a surface needs something extra.

   THE STEPPING HOOKS (2026-08-26, Sophie: "it should be the exact same
   design — can it not be the same exact code?") — what let the PLAYGROUND
   retire the last hand copy in the house. A feed surface steps picture to
   picture without leaving the lightbox, so:
     `nav: { prev: fn|null, next: fn|null }` — two INVISIBLE tap zones over
       the picture, 28% of its width each (her 2026-08-24 rule: "tap anywhere
       on the right or left … and it switches left or right", "make it tap
       and no buttons showing"). A null side draws no zone, so at the ends of
       the feed a tap there closes like any other dead space. The caller
       steps by calling __assetLightbox again with the next picture.
     `promptSide` / `promptOpen` — the prompt door's state, passed in when a
       STEP rebuilds the box and written back onto the asset as she uses it
       (her rule: "the half she picked rides along as she steps … a fresh
       open always starts on content" — so a caller passes these only on a
       step, never on a fresh open).
     `window.__assetLightboxClose()` — closes it exactly as a backdrop tap
       would, for a page whose app chevron asks the page first.
     `onClose()` — called once as the lightbox closes, whichever way (backdrop
       tap, the chevron's __assetLightboxClose, a caller's own close). For a
       page that opens the lightbox OVER an overlay of its own holding the
       body's scroll lock (the Story Room's beat popup): the close here clears
       body overflow, so that caller re-asserts its lock in onClose.
   A toggle half with NOTHING filed is not offered (the Playground's rule,
   now everyone's): one empty half hides its button, and a prompt with only
   one half shows no Style|Content pair at all — the words alone.

   THE CTA HOOK (2026-08-28, Sophie: "create a single lightbox view, sync to
   all surfaces … ex assets, meta assets, story room, playground") — what let
   the STORY ROOM retire its hand copy. Its lightbox is where an older picture
   is picked BACK as a beat's art, and a 34px action circle cannot carry that:
   she picks by looking, so the button is a labeled primary — cream on the
   dark wash, the serif, the house 6px — directly under the picture.
     `cta: { label, onClick(e) }` — one labeled button under the picture (and
       under the actions row when one is drawn). The caller owns what it does;
       `e.currentTarget` is the button, so a caller can mark it `.busy` while
       a POST is in flight. The picture yields to 78vh while a cta is shown
       (the Story Room's own pick-state number). Pass null/omit for no button.

   THE PLAYGROUND LAYOUT HOOKS (2026-08-26, Sophie, the day after the port:
   "put the heart where they were before exactly … the quality model etc.
   should go right under the picture not below the note area"). The migration
   onto this file had moved that page's ♥/✕ to the screen's top corners,
   shrunk the picture, and left the MODEL · QUALITY tag below the note box.
     `votesBelow` — ♥/✕ lead the actions row UNDER the picture (♥ ✕ · copy ·
       save · story, one row — where the Playground has always kept them);
       the top band keeps only Prompt · Chat, centred, and the picture gets
       back the room the top-corner layout's caps took (76vh, yielding only
       when the screen is short).
     `capUnderImage` — the MODEL · QUALITY tag and the label sit directly
       under the picture, above that row and the notes.
   Both opt-in per caller; the Assets tab, Meta Assets and the grid pages
   pass neither and are untouched.
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
    + '.lbnote{display:flex; gap:6px; width:100%;}\n'
    + '.lbnote input{flex:1; min-width:0; border:none; border-radius:6px; background:rgba(250,247,240,.92); color:#26221c;\n'
    /* 16px is a FLOOR, not a size choice: iOS auto-zooms the page on focusing
       anything smaller, the zoom ignores user-scalable=no, and the page stays
       zoomed after the keyboard goes. Meta Assets' own copy had already been
       raised to 16 for exactly that; this is the one that survives. */
    + "  font-family:'EBGaramond',Georgia,serif; font-size:16px; padding:8px 10px; box-shadow:0 1px 4px rgba(0,0,0,.2);}\n"
    + '.lbnote .notesend{width:38px; height:38px; border-radius:50%; border:none; background:rgba(250,247,240,.92); color:#5d7a5a;\n'
    + '  display:flex; align-items:center; justify-content:center; cursor:pointer; flex:none; box-shadow:0 1px 4px rgba(0,0,0,.2); padding:0;}\n'
    + '.lbnote .notesend svg{width:18px; height:18px; display:block;}\n'
    + '.lbnote .notesend.saved{background:#5d7a5a; color:#fff;}\n'
    /* THE BOX COMES FIRST, THE CONVERSATION SITS UNDER IT (Aug 2026, Sophie:
       "I wanted it to be below the text box so most of it will be out of view
       and there can just be a button which makes the note texting take up more
       of a screen, like overlay on top of the actual image"). Writing is the
       common act; re-reading the exchange is the occasional one, so the thread
       peeks under the box and the CHAT button throws it over the picture. */
    + '.lbtalk{width:min(92vw,360px); margin-top:12px;}\n'
    + '.lbthread{max-height:13vh; overflow-y:auto; -webkit-overflow-scrolling:touch;\n'
    + '  display:flex; flex-direction:column; gap:5px; margin-top:8px;}\n'
    /* the peek fades out at its bottom edge, so a half-cut letter reads as
       "there is more" rather than as a rendering fault */
    + '.lbtalk:not(.big) .lbthread{-webkit-mask-image:linear-gradient(to bottom,#000 55%,transparent);\n'
    + '  mask-image:linear-gradient(to bottom,#000 55%,transparent);}\n'
    /* expanded: the same thread element, moved over the picture */
    /* CENTRED on the viewport, not top-anchored: the picture is what it has to
       cover ("like overlay on top of the actual image"), and a short thread
       pinned to the top could sit in the band ABOVE the picture instead. */
    + '.lbtalk.big .lbthread{position:fixed; left:50%; top:50%; transform:translate(-50%,-50%);\n'
    + '  width:min(92vw,420px); max-height:56vh;\n'
    + '  background:rgba(15,13,10,.95); border-radius:6px; padding:12px; box-sizing:border-box;\n'
    + '  z-index:3; margin-top:0; gap:6px;}\n'
    + '.lbtalk.big .lbmsg.them{background:rgba(250,247,240,.18);}\n'
    /* CHAT sits next to PROMPT in the top row (Aug 2026, Sophie) — they are the
       same kind of thing: a second surface over the picture. The two ride a
       middle group so the row's space-between keeps ♥ and ✕ on the corners. */
    + '.lbmid{display:flex; gap:8px; align-items:center;}\n'
    + ".lbmsg{max-width:82%; padding:7px 10px; border-radius:6px; font-family:'EBGaramond',Georgia,serif;\n"
    + '  font-size:14px; line-height:1.4; word-break:break-word; white-space:pre-wrap;}\n'
    + '.lbmsg.me{align-self:flex-end; background:rgba(250,247,240,.92); color:#26221c;}\n'
    + '.lbmsg.them{align-self:flex-start; background:rgba(250,247,240,.14); color:#ece6da;}\n'
    + '.lbmsg.pending{opacity:.55;}\n'
    + '.lbmsg.failed{opacity:1; box-shadow:inset 0 0 0 1px #c96a5e; cursor:pointer;}\n'
    + '#clightbox{position:fixed; inset:0; background:rgba(15,13,10,.93); z-index:30; display:none; align-items:center; justify-content:center; padding:18px; flex-direction:column;}\n'
    /* THE PICTURE ITSELF IS NEVER ROUNDED (Aug 2026, Sophie: "are the corners
       rounded on the actual image in the light box? Should not be"). Opened
       big is exactly where a corner radius stops reading as chrome and starts
       reading as a crop of her art. */
    + '#clightbox img{max-width:100%; max-height:88vh;}\n'
    /* With the note box under it the picture can't have the whole screen, or
       the box you type in falls off the bottom. It gets more room than it used
       to: the thread below the box only peeks now (Aug 2026).
       AND AN IMAGE WITH NO NOTES YET PAYS FOR NOTHING (Aug 2026, Sophie's
       ask that went unanswered for days: "it applies even when the image has
       no notes yet — the peek is reserved anyway, so you're paying for an
       empty strip"). `hasmsgs` is written by paintThread from the thread it
       just drew, so the picture gives the peek its room the moment her first
       letter lands and takes it back if the thread empties. */
    + '#clightbox.hastalk img{max-height:62vh;}\n'
    + '#clightbox.hastalk.hasmsgs img{max-height:52vh;}\n'
    /* an actions row under the picture is one more thing between it and the
       bottom of the screen, so the picture yields that much again */
    + '#clightbox.hastalk.hasacts img{max-height:56vh;}\n'
    + '#clightbox.hastalk.hasacts.hasmsgs img{max-height:46vh;}\n'
    /* THE ACTIONS ROW - small circles, one glyph each, directly under the
       picture. Drawn only when the caller passes `actions`. */
    + '.lbacts{display:flex; gap:14px; margin-top:10px; justify-content:center;}\n'
    + '.lbacts button{width:34px; height:34px; border-radius:50%; border:none; cursor:pointer; margin:0;\n'
    + '  background:rgba(250,247,240,.9); color:#3a3530; display:flex; align-items:center; justify-content:center; padding:0;}\n'
    + '.lbacts button svg{width:17px; height:17px; display:block;}\n'
    /* WHO - which chat it came from: the last line, and the quietest */
    + '#clightbox .clwho{color:#8a8377; font-family:-apple-system,sans-serif; font-size:10px; margin-top:8px;\n'
    + '  text-align:center; letter-spacing:.12em; text-transform:uppercase;}\n'
    + '#clightbox .clcap{color:#b9b2a4; font-size:12px; margin-top:12px; text-align:center; letter-spacing:.02em;}\n'
    /* MODEL · QUALITY sits ABOVE the label, dimmer and smaller — the label is
       what she reviews by, the tag is how it was made. */
    + '#clightbox .cltag{color:#8a8377; font-size:11px; margin-top:10px; text-align:center; letter-spacing:.06em; text-transform:uppercase;}\n'
    + '#clightbox .cltag + .clcap{margin-top:4px;}\n'
    // COMPRESSED AT BIRTH — its own element, never concatenated into the text.
    // In front of the prompt it has to be unmistakably NOT part of the prompt:
    // the house rule is that this field holds the exact text that was sent,
    // character for character, so the mark sits beside the words rather than
    // inside them. Flat colour, no gradient.
    + '#clightbox .compflag{color:#c98b7a; font-weight:600; letter-spacing:.04em;}\n'
    + '#clightbox .lbptext .compflag{display:block; margin-bottom:6px; font-size:11px; text-transform:uppercase;}\n'
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
    /* STYLE / CONTENT SIT CENTRED IN THEIR OWN HALVES (Aug 2026, Sophie:
       "style content not centered"). `flex:1` gives each button a width it did
       not ask for, and the house `button` rule sets display:inline-flex +
       align-items:center with NO justify-content — so the words held the left
       edge. The same trap the judge page's 62px squares hit: ANY button with a
       width it did not get from its own text has to say this itself. */
    + '.lbp .lbptog button{flex:1; margin:0; border:1px solid rgba(250,247,240,.35); border-radius:6px; background:none; color:#c8c1b3;\n'
    + '  display:flex; align-items:center; justify-content:center; text-align:center;\n'
    + '  font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.14em; text-transform:uppercase; padding:8px 4px; cursor:pointer;}\n'
    + '.lbp .lbptog button.on{background:#faf7f0; border-color:#faf7f0; color:#26221c;}\n'
    + '.lbp .lbptext{flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; color:#ece6da;\n'
    + "  font-family:'EBGaramond',Georgia,serif; font-size:15px; line-height:1.45; white-space:pre-wrap; word-break:break-word;}\n"
    + '.promptbtn{border:none; border-radius:6px; background:rgba(250,247,240,.9); color:#26221c; padding:7px 11px; margin:0;\n'
    + '  font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:.14em; text-transform:uppercase; cursor:pointer;\n'
    + '  box-shadow:0 1px 4px rgba(0,0,0,.2); flex:none;}\n'
    + '.promptbtn.on{background:#3a3530; color:#faf7f0;}\n'
    /* THE STEP ZONES — invisible on purpose (2026-08-24, Sophie: "make it tap
       and no buttons showing"): the zone is the control, and a mark drawn in
       it would sit on the art she opened the lightbox to judge. Sized to the
       PICTURE (.clwrap), never the window, so the caption and the note box
       are never covered. Positioned with no z-index: above the <img> (which
       is unpositioned), below the .lbp prompt words (z-index 1) and the ♥/✕
       row (z-index 2). */
    + '#clightbox .lbzone{position:absolute; top:0; bottom:0; width:28%; border:0; background:none;\n'
    + '  padding:0; margin:0; cursor:pointer; border-radius:0; box-shadow:none;}\n'
    + '#clightbox .lbzone.prev{left:0;}\n'
    + '#clightbox .lbzone.next{right:0;}\n'
    /* THE votesBelow LAYOUT (the Playground) — the picture gets its old room
       back: capped at 76vh and SHRINKING through flex when the screen is
       short, the old .lbstage pattern, instead of the top-corner layout's
       fixed 46-62vh steps. Every selector the step caps use is re-listed so
       none of them out-specifies this. */
    + '#clightbox.vbelow .clwrap{min-height:0; flex:0 1 auto;}\n'
    + '#clightbox.vbelow img, #clightbox.vbelow.hastalk img, #clightbox.vbelow.hastalk.hasmsgs img,\n'
    + '#clightbox.vbelow.hastalk.hasacts img, #clightbox.vbelow.hastalk.hasacts.hasmsgs img{max-height:min(76vh,100%);}\n'
    + '#clightbox.vbelow .cltag, #clightbox.vbelow .clcap, #clightbox.vbelow .lbacts, #clightbox.vbelow .lbtalk{flex:none;}\n'
    /* ONE SIZE FOR EVERY BUTTON UNDER THE PICTURE (2026-08-27, Sophie: "bottom
       buttons are all different sizes in the playground light box ... make them
       all that size"). The votesBelow row mixes two families that were never
       meant to share a line: `.vote` is 38px (it was drawn for the screen's top
       corners) and `.lbacts button` is 34px, so ♥ ✕ sat visibly bigger than
       copy · save · story beside them, with the 38px note-send under both.
       The numbers are the Playground's OWN, lifted from its hand-rolled
       lightbox as it stood the day before the port onto this file (`.lbbtn`,
       46x46 with a 21px glyph, 22px apart) — where all five really were one
       size. Scoped to .vbelow: the Assets tab, Meta Assets and the grid pages
       pass no layout hook and keep the sizes they have. */
    + '#clightbox.vbelow .lbacts{gap:22px;}\n'
    + '#clightbox.vbelow .lbacts button, #clightbox.vbelow .lbnote .notesend{width:46px; height:46px;}\n'
    + '#clightbox.vbelow .lbacts button svg, #clightbox.vbelow .lbnote .notesend svg{width:21px; height:21px;}\n'
    /* THE CTA — one labeled primary button under the picture (the Story Room's
       "Use this one"). Cream on the dark wash in BOTH themes — the backdrop is
       a fixed dark, so tokens are the wrong tool: a theme's --paper can be
       nearly the backdrop's own colour. The serif, the house 6px, never a
       pill. Only a lightbox carrying one gives up height for it — a plain
       look at a picture keeps every pixel it always had. */
    + '#clightbox .lbcta{background:#f6f2e9; color:#26221c; border:1.5px solid #f6f2e9; border-radius:6px;\n'
    + "  padding:9px 18px; margin-top:12px; font-family:'EBGaramond',Georgia,serif; font-size:16px;\n"
    + '  font-weight:600; cursor:pointer; flex:none; box-shadow:0 1px 4px rgba(0,0,0,.2);}\n'
    + '#clightbox .lbcta.busy{opacity:.45;}\n'
    + '#clightbox.hascta img{max-height:78vh;}\n';
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
    // A TAP IN HERE IS NEVER A REQUEST TO AUTOSCROLL (Aug 2026, Sophie: "the
    // auto scroll triggers when I tap out of the lightbox"). The app drives an
    // embedded page's scroll with a tap-to-TOGGLE bound in the parent, whose
    // skip list is `[data-nostop],img,figure,.cmp-lb` — this overlay was on
    // none of them, so the tap that closed it started the scroll behind it.
    // Marking the element is the fix that reaches every host, not just chats.
    lb.setAttribute('data-nostop', '');
    lb.innerHTML = '<div class="clwrap"><img alt="" src="' + url.replace(/"/g, '&quot;') + '"></div>';
    lb.classList.remove('hastalk');   // last image's thread must not shrink this one
    lb.classList.remove('hasmsgs');   // ...nor whether that thread had letters in it
    lb.classList.remove('hasacts');   // ...nor its actions row
    lb.classList.remove('hascta');    // ...nor its labeled button
    // the votesBelow layout is the caller's, per open — never carried over
    lb.classList.toggle('vbelow', !!(asset && asset.votesBelow));
    // THE STEP ZONES — a feed surface steps through its pictures without
    // leaving the lightbox (the Playground). A null side draws NOTHING, so at
    // the ends of the feed a tap there closes like any other dead space. The
    // caller's fn re-invokes __assetLightbox with the next picture.
    var nav = (asset && asset.nav) || null;
    if (nav && (nav.prev || nav.next)) {
      var zwrap = lb.querySelector('.clwrap');
      [['prev', 'Previous picture'], ['next', 'Next picture']].forEach(function (z) {
        var fn = nav[z[0]];
        if (!fn) return;
        var zb = document.createElement('button');
        zb.type = 'button';
        zb.className = 'lbzone ' + z[0];
        zb.setAttribute('aria-label', z[1]);
        zb.onclick = function (e) { e.stopPropagation(); fn(); };
        zwrap.appendChild(zb);
      });
    }
    // The caller's own buttons, directly under the picture (Meta Assets: open
    // the chat, the Playground, Save to Photos). The empty space beside them
    // is NOT dead - the close rule at the bottom asks the tap's TARGET, so
    // only the buttons themselves keep the lightbox open.
    var actions = (asset && asset.actions) || [];
    if (actions.length) {
      var acts = document.createElement('div'); acts.className = 'lbacts';
      actions.forEach(function (a) {
        if (!a) return;
        var ab = document.createElement('button');
        ab.type = 'button';
        ab.innerHTML = a.icon || '';
        if (a.label) { ab.setAttribute('aria-label', a.label); ab.title = a.label; }
        ab.onclick = function (e) { e.stopPropagation(); if (a.onClick) a.onClick(e); };
        acts.appendChild(ab);
      });
      lb.appendChild(acts);
      lb.classList.add('hasacts');
    }
    // THE CTA — one labeled primary button under the picture (the Story
    // Room's "Use this one"). The caller owns what it does; the button rides
    // to onClick as e.currentTarget so a POST in flight can mark it `.busy`.
    var cta = (asset && asset.cta) || null;
    if (cta && cta.onClick) {
      var ctab = document.createElement('button');
      ctab.type = 'button';
      ctab.className = 'lbcta';
      ctab.textContent = cta.label || '';
      ctab.onclick = function (e) { e.stopPropagation(); cta.onClick(e); };
      lb.appendChild(ctab);
      lb.classList.add('hascta');
    }
    // The generating prompt, over the image: Style left, Content right, tap the
    // PROMPT button to cover/uncover the picture. Only offered when a chat
    // actually filed a split — nothing is shown (and nothing is said) when it
    // didn't. Built before .lbtop so the button can join that row.
    var promptBtn = null;
    var syncTalk = null;   // re-measures whether the thread overflows its peek
    if (asset && (asset.promptStyle || asset.promptContent)) {
      var wrap = lb.querySelector('.clwrap');
      var ov = document.createElement('div'); ov.className = 'lbp'; ov.style.display = 'none';
      var tog = document.createElement('div'); tog.className = 'lbptog';
      var sb = document.createElement('button'); sb.textContent = 'Style';
      var cb = document.createElement('button'); cb.textContent = 'Content';
      var txt = document.createElement('div'); txt.className = 'lbptext';
      // CONTENT IS THE DEFAULT SIDE (Aug 2026, Sophie: "right now the style is
      // the default and I want it to be the content, so I don't have to click
      // all the time"). Style still wins when content is the only half missing.
      // A STEP passes the side she picked back in (`promptSide`) — comparing a
      // style across two pictures is exactly why she would switch it.
      var side = asset.promptContent ? 'content' : 'style';
      if (asset.promptSide === 'style' && asset.promptStyle) side = 'style';
      // A half with NOTHING filed is not offered — an empty box behind a lit
      // button is worse than no button, and with only one half there is no
      // pair to toggle at all: the words alone.
      var both = !!(asset.promptStyle && asset.promptContent);
      function paintSide() {
        sb.classList.toggle('on', side === 'style');
        cb.classList.toggle('on', side === 'content');
        txt.textContent = (side === 'style' ? asset.promptStyle : asset.promptContent) || '';
        // "[compressed]" in front of BOTH halves when this picture's only copy
        // was encoded lossily before the bytes ever reached us. The flag is the
        // data (compressedAtBirth, written by scripts/tag-compressed-at-birth.js);
        // this bracket text is presentation, prepended as its own node so the
        // prompt underneath stays the exact text that was sent.
        if (asset.compressedAtBirth) {
          var cf = document.createElement('span');
          cf.className = 'compflag'; cf.textContent = '[compressed]';
          txt.insertBefore(cf, txt.firstChild);
        }
        txt.scrollTop = 0;
      }
      sb.onclick = function (e) { e.stopPropagation(); side = 'style'; asset.promptSide = side; paintSide(); };
      cb.onclick = function (e) { e.stopPropagation(); side = 'content'; asset.promptSide = side; paintSide(); };
      if (!both) tog.style.display = 'none';
      tog.appendChild(sb); tog.appendChild(cb);
      ov.appendChild(tog); ov.appendChild(txt);
      paintSide();
      wrap.appendChild(ov);
      promptBtn = document.createElement('button');
      promptBtn.className = 'promptbtn'; promptBtn.textContent = 'Prompt';
      var setPon = function (open) {
        ov.style.display = open ? 'flex' : 'none';
        wrap.classList.toggle('pon', open);
        promptBtn.classList.toggle('on', open);
        asset.promptOpen = open;   // rides a STEP; a fresh open passes nothing
      };
      promptBtn.onclick = function (e) {
        e.stopPropagation();
        setPon(ov.style.display === 'none');
      };
      if (asset.promptOpen) setPon(true);
    }
    // ♥/✕ overlaid on the image (left / right); the note box sits UNDER the image.
    if (asset && asset._cast) {
      var row = document.createElement('div'); row.className = 'lbtop';
      var hb = document.createElement('button'); hb.className = 'vote heart'; hb.innerHTML = window.__HEART || HEART;
      var xb = document.createElement('button'); xb.className = 'vote nope'; xb.innerHTML = window.__XMARK || XMARK;
      hb.setAttribute('aria-label', 'Heart'); xb.setAttribute('aria-label', 'Reject');
      // The thread: her notes and the chat's replies back, oldest at the top.
      // Snail mail — the chat that made the image answers next time she messages
      // it, so a reply landing here later is normal and expected.
      var talk = document.createElement('div'); talk.className = 'lbtalk';
      var th = document.createElement('div'); th.className = 'lbthread';
      var more = null;
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
        // The picture only yields room for a thread that EXISTS — an image with
        // no notes keeps the taller cap (see the CSS note above).
        lb.classList.toggle('hasmsgs', msgs.length > 0);
        th.scrollTop = th.scrollHeight;   // newest letter in view
        if (more) syncMore();   // a new letter may push it past the peek
      }
      // CHAT — the conversation thrown over the picture. It appears ONLY when
      // there is more of it than the peek can show (Aug 2026, Sophie: "only
      // have it show up IF there are extra notes that would need to scroll to
      // see"). So the button means "there is more up there", never just "notes
      // exist" — a thread that already fits needs no way to open it bigger.
      // MEASURED, not counted: how much fits depends on how long the letters
      // are, so the test is the peek's own overflow.
      more = document.createElement('button'); more.className = 'promptbtn';
      more.type = 'button';
      more.style.display = 'none';   // until a measurement says otherwise
      function paintMore() {
        var big = talk.classList.contains('big');
        more.textContent = big ? 'Hide' : 'Chat';
        more.classList.toggle('on', big);
      }
      // one frame later: heights are 0 until the overlay is on screen, and the
      // serif can land after that again
      syncTalk = syncMore;
      function syncMore() {
        requestAnimationFrame(function () {
          var big = talk.classList.contains('big');
          var over = th.scrollHeight > th.clientHeight + 2;
          more.style.display = (big || over) ? '' : 'none';
          paintMore();
        });
      }
      more.onclick = function (e) {
        e.stopPropagation();
        talk.classList.toggle('big');
        paintMore();
        th.scrollTop = th.scrollHeight;
        syncMore();
      };
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
      talk.appendChild(nw); talk.appendChild(th);
      paintThread();
      if (asset._markSeen) asset._markSeen();   // opening it counts as reading it
      asset._lbPaint = function () {
        hb.classList.toggle('on', asset.vote === 'like');
        xb.classList.toggle('on', asset.vote === 'dislike');
      };
      asset._lbPaint();
      hb.onclick = function (e) { e.stopPropagation(); asset._cast('like'); };
      xb.onclick = function (e) { e.stopPropagation(); asset._cast('dislike'); };
      var mid = document.createElement('div'); mid.className = 'lbmid';
      if (promptBtn) mid.appendChild(promptBtn);
      mid.appendChild(more);
      var frame = lb.querySelector('.clframe');
      if (asset.votesBelow) {
        // ♥/✕ lead the row UNDER the picture (2026-08-26, Sophie: "put the
        // heart where they were before exactly") — the Playground kept them
        // there, ♥ ✕ · copy · save · story in one row, until the port onto
        // this file moved them to the screen's top corners. The top band
        // keeps only Prompt · Chat, centred.
        var arow = lb.querySelector('.lbacts');
        if (!arow) {
          arow = document.createElement('div'); arow.className = 'lbacts';
          lb.appendChild(arow); lb.classList.add('hasacts');
        }
        arow.insertBefore(xb, arow.firstChild);
        arow.insertBefore(hb, arow.firstChild);
        row.style.justifyContent = 'center';
        row.appendChild(mid);
      } else {
        // ♥ left, Prompt · Chat together in the middle, ✕ right (space-between)
        row.appendChild(hb); row.appendChild(mid); row.appendChild(xb);
      }
      (frame || lb).appendChild(row);
      lb.appendChild(talk);   // thread + note box below the image, never over it
      lb.classList.add('hastalk');   // shrinks the picture so the thread has room
    }
    if (promptBtn && !promptBtn.parentNode) {   // image opened without the curate row
      var prow = document.createElement('div'); prow.className = 'lbtop';
      prow.style.justifyContent = 'center';
      prow.appendChild(promptBtn); lb.appendChild(prow);
    }
    // Two lines, not one: the curated model/quality tag (never the hook's
    // generic "from <chat>") above the label. `description||prompt` hid the tag
    // on every labelled image.
    var tag = asset ? String(asset.prompt || '') : '';
    if (/^from /.test(tag)) tag = '';
    var cap = asset ? (asset.description || '') : '';
    if (!cap && tag) { cap = tag; tag = ''; }
    // "[compressed]" leads the MODEL · QUALITY line. An image with no caption
    // at all still has to say it, so the mark gets its own tag row rather than
    // riding on a string that may not exist.
    var comp = !!(asset && asset.compressedAtBirth);
    // RIGHT UNDER THE PICTURE when the caller asks (2026-08-26, Sophie: "the
    // quality model etc. should go right under the picture not below the note
    // area") — above the button row and the notes, the old Playground order.
    // Default stays the very bottom, which is the Assets tab's own design.
    var capAnchor = (asset && asset.capUnderImage)
      ? (lb.querySelector('.lbacts') || lb.querySelector('.lbtalk')) : null;
    function fileCap(el) { if (capAnchor) lb.insertBefore(el, capAnchor); else lb.appendChild(el); }
    if (comp || tag) {
      var tc = document.createElement('div'); tc.className = 'cltag';
      if (comp) {
        var cf2 = document.createElement('span');
        cf2.className = 'compflag'; cf2.textContent = '[compressed]';
        tc.appendChild(cf2);
        if (tag) tc.appendChild(document.createTextNode(' '));
      }
      if (tag) tc.appendChild(document.createTextNode(tag));
      fileCap(tc);
    }
    if (cap) { var cc = document.createElement('div'); cc.className = 'clcap'; cc.textContent = cap; fileCap(cc); }
    var who = asset ? (asset.who || '') : '';
    if (who) { var wc = document.createElement('div'); wc.className = 'clwho'; wc.textContent = who; lb.appendChild(wc); }
    lb.style.display = 'flex'; document.body.style.overflow = 'hidden'; document.body.classList.add('ontop');
    if (syncTalk) {
      syncTalk();                                        // now that it has a size
      try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncTalk); }
      catch (_) { /* the first measurement stands */ }
    }
    // ANYWHERE THAT ISN'T A CONTROL, THE PICTURE OR THE CHAT CLOSES IT (Aug
    // 2026, Sophie: "it's hard to [get] out of lightbox. it shud just be
    // anywhere not a button or image or chat but if I tap for example, between
    // the image and the prompt, it doesn't let me out"). Each row used to
    // swallow the tap for its WHOLE width — the ♥/✕ strip, the prompt row —
    // so the empty space beside a button was dead, and that space is most of
    // the row. One rule in one place now, asked of the tap's target rather
    // than of whichever box it landed in.
    function closeNow() {
      if (lb.style.display === 'none') return;
      if (asset) asset._lbPaint = null;
      // Blur FIRST: a still-focused note box makes iOS scroll again as the
      // keyboard leaves, which would land after our restore and undo it.
      var f = document.activeElement; if (f && f.blur) f.blur();
      lb.style.display = 'none';
      document.body.style.overflow = ''; document.body.classList.remove('ontop');
      // THE CONTENT IS DETACHED A FRAME LATER, NOT NOW (Aug 2026, Sophie: "why
      // does auto scroll get triggered when I tap out of the light box in the
      // auto compare page" — and she was right that this had been fixed once:
      // it was, for compare.js's OWN lightbox, which only sets [hidden] and so
      // stays reachable). A host decides whether a tap was the page's own by
      // asking `t.closest('[data-nostop],img,figure,.cmp-lb')` on a BUBBLING
      // click — chats.html does this for an embedded Compare page. Wiping
      // innerHTML inside our onclick runs FIRST, so by the time that handler
      // asks, the tapped caption/row has no parent left and closest() walks a
      // detached subtree: the [data-nostop] on this element is unreachable,
      // the tap falls through to the toggle, and the autoscroll STARTS behind
      // the closing overlay. Measured: tapping .clcap logged the toggle;
      // tapping the backdrop (lb itself, never detached) did not — which is
      // why it looked intermittent. One frame is all the bubbling phase needs.
      requestAnimationFrame(function () {
        if (lb.style.display !== 'none') return;         // reopened in between
        lb.innerHTML = '';                               // .big dies with it
        lb.classList.remove('hastalk');
        lb.classList.remove('hasmsgs');
        lb.classList.remove('hasacts');
        lb.classList.remove('hascta');
        lb.classList.remove('vbelow');
      });
      window.scrollTo(0, lbY);
      // …and again next frame, for the keyboard-dismissal scroll that lands late.
      requestAnimationFrame(function () { window.scrollTo(0, lbY); });
      // The caller's own cleanup, LAST — a page whose beat popup holds the
      // body lock re-asserts it here, over the overflow clear above.
      if (asset && asset.onClose) { try { asset.onClose(); } catch (_) { /* close stands */ } }
    }
    lb.onclick = function (e) {
      var t = e && e.target;
      if (t && t.closest
          && t.closest('button,a,input,textarea,select,label,img,.lbp,.lbtalk')) return;
      closeNow();
    };
    // For a page whose app chevron asks the page first ("close the lightbox if
    // it's open, else leave the tool") — the same close a backdrop tap runs.
    window.__assetLightboxClose = closeNow;
  };
})();
