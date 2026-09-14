/* THE FILM'S OWN TRANSPORT — play/pause, a scrubber, elapsed and total
 * (2026-09-10, Sophie: "the way a movie tints when it starts" → "go").
 *
 * WHY THIS FILE EXISTS. The wash she was pointing at is not ours — nothing in
 * this repo has ever drawn a tint over a film. It is iOS's OWN controls
 * overlay, which it paints across the whole picture whenever a `<video
 * controls>` starts or is tapped, and there is no attribute, no CSS and no API
 * that turns the tint off while keeping the controls. So the only way to lose
 * it is to stop asking for native controls and draw the transport ourselves.
 *
 * WHAT THAT BUYS BESIDES THE PICTURE. The overlay was load-bearing in
 * filmnote.js and every bit of that machinery goes with it:
 *   - SCRIM_MS / scrimAt — a ~4s clock that MIRRORED iOS's overlay, because no
 *     API says whether it is on screen, so a tap on a playing film had to be
 *     read as "put the overlay away" rather than "pause".
 *   - the 64px "scrub bar exemption" — a band at the bottom of the VIDEO where
 *     the toggle had to stand down, because that is where iOS drew its bar.
 * With our own bar neither question exists: the bar is a sibling of the video,
 * so a tap on it is never a tap on the film, and a tap on the film always
 * means pause. (Both are deleted, not disabled — see filmnote.js.)
 *
 * WHAT IT COSTS, named because it does not come back: AirPlay, picture-in-
 * picture and the native fullscreen button are things iOS gives free with
 * `controls`. Fullscreen is no loss here — both hosts are already full-screen
 * overlays — but AirPlay and PiP are genuinely gone.
 *
 * IT IS ALWAYS ON SCREEN, deliberately. A bar that fades and comes back on a
 * tap is the same ambiguity the scrim code existed to paper over ("was that
 * tap asking to pause, or asking for the controls?"), and it is exactly what
 * she asked to be rid of. A thin bar at the bottom edge is not a wash: no
 * timers, nothing to learn, and the picture is never tinted.
 *
 * The transport is LIFTED from the Footage trimmer's own strip
 * (public/footage.html), which is the proven one: the BAND is the tap target
 * and the BAR is the picture, and the fraction is measured off the BAR's own
 * rect so the band can grow without moving where a tap lands.
 *
 *   var bar = window.__filmBar({ wrap, video });
 *   …
 *   bar && bar.destroy();     // in the caller's own close()
 *
 * `wrap` is the overlay element (it gets `filmbar-host`). Audio players keep
 * NATIVE controls — an audio element has no picture to tint, so there is
 * nothing here for it to fix.
 */
(function () {
  if (window.__filmBar) return;                  // safe to include twice

  var css = document.createElement('style'); css.id = 'filmbar-css';
  css.textContent =
    /* Bottom 0, so filmnote's Note and Prompt buttons — which sit 64px up,
       clear of the strip iOS used to draw its bar in — still clear it. The
       note SHEET (z-index 4) covers the bar on purpose: while she is writing,
       the transport is not what she is doing. */
    '.filmbar-host .filmbar{position:absolute; left:0; right:0; z-index:3;'
    + ' bottom:env(safe-area-inset-bottom,0px); height:44px; box-sizing:border-box;'
    + ' display:flex; align-items:center; gap:10px; padding:0 12px;'
    + ' background:rgba(10,9,7,.58);}'
    + ".filmbar-host .filmbar .fbt{flex:0 0 auto; color:#e8e2d6; font-variant-numeric:tabular-nums;"
    + " font:12px/1 -apple-system,'Helvetica Neue',sans-serif;}"
    + '.filmbar-host .filmbar .fbplay{flex:0 0 auto; width:34px; height:34px; padding:0; margin:0;'
    + ' border:none; background:none; color:#fff; display:flex; align-items:center;'
    + ' justify-content:center; border-radius:6px; -webkit-tap-highlight-color:transparent;}'
    /* THE BAND IS THE TARGET AND THE BAR IS THE PICTURE (the trimmer's rule):
       a 6px bar is far under any tap target, so the button is 34px tall with
       the bar drawn inside it — the size is bought without making the mark
       heavier or moving a row. */
    + '.filmbar-host .filmbar .fbstrip{flex:1 1 auto; min-width:0; height:34px; padding:0; margin:0;'
    + ' border:none; background:none; display:flex; align-items:center; border-radius:6px;'
    + ' -webkit-tap-highlight-color:transparent; touch-action:none;}'
    + '.filmbar-host .filmbar .fbbar{position:relative; width:100%; height:6px; border-radius:6px;'
    + ' background:rgba(255,255,255,.26);}'
    + '.filmbar-host .filmbar .fbfill{position:absolute; left:0; top:0; bottom:0; width:0;'
    + ' border-radius:6px; background:#e8e2d6;}'
    + '.filmbar-host .filmbar .fbhead{position:absolute; top:-4px; bottom:-4px; width:2px; left:0;'
    + ' background:#fff; border-radius:1px;}';
  document.head.appendChild(css);

  var PLAY = '<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
    + '<path d="M7 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5Z"/></svg>';
  var PAUSE = '<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
    + '<rect x="6" y="4" width="4.2" height="16" rx="1.1"/>'
    + '<rect x="13.8" y="4" width="4.2" height="16" rx="1.1"/></svg>';

  // a length nothing knows yet reads as a dash, never as 0:00 — a wrong number
  // on the right of the bar is worse than an honest blank
  function fmt(s) {
    if (!(s > 0) && s !== 0) return '–:––';
    if (!isFinite(s)) return '–:––';
    s = Math.max(0, Math.floor(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  window.__filmBar = function (opts) {
    opts = opts || {};
    var w = opts.wrap, v = opts.video;
    if (!w || !v) return null;
    w.classList.add('filmbar-host');

    var el = document.createElement('div');
    el.className = 'filmbar';
    el.innerHTML = '<button type="button" class="fbplay" aria-label="Play"></button>'
      + '<span class="fbt fbnow">0:00</span>'
      + '<button type="button" class="fbstrip" aria-label="Tap to jump to that point">'
      + '<span class="fbbar"><span class="fbfill"></span><span class="fbhead"></span></span></button>'
      + '<span class="fbt fbend">–:––</span>';
    var playBtn = el.querySelector('.fbplay');
    var strip = el.querySelector('.fbstrip');
    var bar = el.querySelector('.fbbar');
    var fill = el.querySelector('.fbfill');
    var head = el.querySelector('.fbhead');
    var nowT = el.querySelector('.fbnow');
    var endT = el.querySelector('.fbend');

    var dead = false, raf = 0, scrubbing = false;

    function dur() { var d = v.duration; return (isFinite(d) && d > 0) ? d : 0; }
    function paint() {
      if (dead) return;
      var d = dur(), t = Math.min(Math.max(v.currentTime || 0, 0), d || Infinity);
      var f = d ? Math.min(Math.max(t / d, 0), 1) : 0;
      fill.style.width = (f * 100) + '%';
      head.style.left = 'calc(' + (f * 100) + '% - 1px)';
      nowT.textContent = fmt(t);
      endT.textContent = fmt(d);
    }
    /* The head moves on a frame loop while it PLAYS — `timeupdate` fires about
       four times a second, which reads as a stuttering playhead on a bar this
       wide. The loop runs only while playing, so a paused film costs nothing. */
    function tick() { raf = 0; if (dead || v.paused) return; paint(); raf = requestAnimationFrame(tick); }
    function startTick() { if (!raf && !dead) raf = requestAnimationFrame(tick); }
    function stopTick() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    function syncPlay() {
      var p = v.paused;
      playBtn.innerHTML = p ? PLAY : PAUSE;
      playBtn.setAttribute('aria-label', p ? 'Play' : 'Pause');
      if (p) stopTick(); else startTick();
      paint();
    }

    playBtn.onclick = function (e) {
      e.stopPropagation();                       // never also a tap on the film
      if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      else v.pause();
    };

    /* TAP THE STRIP AND IT JUMPS THERE, and a drag scrubs. Measured off the
       BAR's own rect, never the button's, so the band around it can grow
       without moving where a tap lands (the trimmer's rule). It does NOT
       change whether the film is playing: here she is watching, where in the
       trimmer a tap on the strip is her looking for a frame to mark. */
    function seekAt(clientX) {
      var d = dur(); if (!d) return;
      var r = bar.getBoundingClientRect(); if (!r.width) return;
      var f = Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
      try { v.currentTime = f * d; } catch (_) {}
      paint();
    }
    function onStripDown(e) {
      e.stopPropagation();
      if (!dur()) return;
      scrubbing = true;
      try { strip.setPointerCapture(e.pointerId); } catch (_) {}
      seekAt(e.clientX);
    }
    function onStripMove(e) { if (scrubbing) { e.preventDefault(); seekAt(e.clientX); } }
    function onStripUp(e) { if (scrubbing) { scrubbing = false; try { strip.releasePointerCapture(e.pointerId); } catch (_) {} } }
    // the click that follows the pointer sequence must not reach the wrap —
    // filmnote reads a tap on the wrap, and this one was already spent seeking
    function onStripClick(e) { e.stopPropagation(); }
    strip.addEventListener('pointerdown', onStripDown);
    strip.addEventListener('pointermove', onStripMove);
    strip.addEventListener('pointerup', onStripUp);
    strip.addEventListener('pointercancel', onStripUp);
    strip.addEventListener('click', onStripClick);

    var onMeta = function () { paint(); };
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('durationchange', onMeta);
    v.addEventListener('timeupdate', paint);     // the fallback when not playing (a seek, a stall)
    v.addEventListener('seeked', paint);
    v.addEventListener('play', syncPlay);
    v.addEventListener('pause', syncPlay);
    v.addEventListener('ended', syncPlay);
    // a backgrounded page runs no frames; coming back re-arms the loop
    var onVis = function () { if (!document.hidden && !v.paused) startTick(); };
    document.addEventListener('visibilitychange', onVis);

    w.appendChild(el);
    syncPlay();

    return {
      el: el,
      destroy: function () {
        dead = true; stopTick();
        v.removeEventListener('loadedmetadata', onMeta);
        v.removeEventListener('durationchange', onMeta);
        v.removeEventListener('timeupdate', paint);
        v.removeEventListener('seeked', paint);
        v.removeEventListener('play', syncPlay);
        v.removeEventListener('pause', syncPlay);
        v.removeEventListener('ended', syncPlay);
        document.removeEventListener('visibilitychange', onVis);
        // the lightbox wrap is REUSED across opens (compare.js keeps one
        // .cmp-vlb) — leave nothing behind, or listeners stack per open
        strip.removeEventListener('pointerdown', onStripDown);
        strip.removeEventListener('pointermove', onStripMove);
        strip.removeEventListener('pointerup', onStripUp);
        strip.removeEventListener('pointercancel', onStripUp);
        strip.removeEventListener('click', onStripClick);
        w.classList.remove('filmbar-host');
        el.remove();
      }
    };
  };
})();
