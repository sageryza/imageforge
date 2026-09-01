/* ── THE DOORS UNDER A PICTURE — ONE SET, ONE FILE ───────────────────────────
 *
 * 2026-08-31, Sophie: "why the fuck different buttons in assets ex no
 * playground button".
 *
 * The LIGHTBOX has been one shared file since 2026-08-28 (asset-lightbox.js —
 * her own "create a single lightbox view, sync to all surfaces"), and its
 * layout is the same everywhere. The BUTTONS were not: `actions` is a hook,
 * and every caller hand-wrote its own array. Measured the day this landed:
 *
 *   Meta Assets   — open the chat · Playground · Shoebox · Save to Photos
 *   Playground    — put the prompt back · Save · Shoebox · Story Room
 *   Assets tab    — NOTHING AT ALL
 *
 * So the surface she reviews EVERY picture in was the one with no doors: a
 * picture she wanted in the Playground had to be found a second time in Meta
 * Assets first. One shared lightbox is not one view while the things you can
 * DO to a picture are typed out per page.
 *
 * This file is the standard set for a FILED picture — a record in a chat's
 * Assets tab, wherever it is being looked at. Lifted verbatim out of
 * assets.html (the icons, the three-path saver, the port query), so nothing
 * about Meta Assets' behaviour moved; it just stopped being the only page
 * that had it.
 *
 * WHAT IT IS NOT: the Playground's own row. That one puts the prompt back in
 * its own box and walks to the Story Room carrying a RUN id — neither means
 * anything on a filed record, which knows no run. A surface with a door of its
 * own still passes its own array; what it must not do is re-type these four.
 *
 * THE PAGE OWES IT `toast` AND `api` (both pages declare the identical pair as
 * globals) and, for the Playground door, `/playground-port.js` — without the
 * port there is no honest way to say which tile made a picture, so that door
 * falls back to riding the picture as a PHOTO REFERENCE rather than guessing.
 */
(function () {
  'use strict';

  var HEART='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  // Lucide messages-square — the Chats tool's bubbles, for "open the chat".
  var CHATICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-8a2 2 0 0 1-2-2v-1"/></svg>';
  // Lucide arrow-down-to-line — save to Photos (the iOS gallery's own glyph).
  var SAVEICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>';
  // The Story Room's own Add-to-Shoebox glyph (the iOS square-and-arrow-up) —
  // the doors are the same door, so they wear the same mark.
  var SHOEICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>';
  // The Playground's own wire-loop drawing (the shared tool glyph — a button
  // that opens another tool wears THAT tool's icon). Mirrors ICON_PLAY in
  // scripts/gen-scratchpad.py / Assets.xcassets/Playground.imageset.
  var PLAYICON='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"> <g transform="translate(1.47 0) scale(0.09510)" fill="currentColor" stroke="none"> <g transform="translate(0,673) scale(0.1,-0.1)"> <path d="M3145 6720 c-7 -12 -58 -175 -91 -293 l-19 -69 -96 7 c-108 8 -150 -5 -171 -50 -13 -30 -4 -29 -103 -8 -119 25 -497 25 -620 0 -279 -57 -515 -175 -704 -353 -228 -215 -341 -450 -357 -744 -15 -263 37 -431 236 -766 101 -169 140 -248 179 -357 17 -49 31 -90 31 -93 0 -2 -13 -4 -30 -4 -22 0 -31 5 -35 23 -3 12 -19 80 -35 152 -39 178 -36 175 -223 175 -134 0 -149 -2 -267 -36 -159 -46 -180 -65 -180 -157 1 -52 13 -213 23 -280 2 -15 -20 -27 -107 -60 -94 -37 -112 -47 -122 -72 -17 -39 -17 -106 1 -178 l13 -58 -51 -38 c-132 -98 -289 -286 -365 -440 l-47 -94 -3 -235 c-3 -233 -3 -235 22 -286 83 -169 254 -294 596 -436 273 -114 371 -181 467 -321 l31 -45 -130 -144 c-256 -284 -597 -676 -637 -732 -12 -16 -15 -78 -18 -314 l-3 -295 24 -24 c30 -29 68 -32 586 -45 217 -5 553 -14 745 -20 626 -18 1506 -30 2165 -29 l645 0 55 63 c30 35 136 153 235 262 99 110 256 285 349 389 93 105 184 204 203 222 18 18 38 45 44 60 8 18 11 120 11 299 -1 291 -7 330 -52 354 -13 7 -105 14 -236 17 l-215 6 58 59 c149 152 351 267 663 378 320 114 423 168 555 291 84 79 131 142 183 245 72 144 73 154 70 416 l-3 233 -32 64 c-86 169 -247 296 -429 336 -128 29 -116 18 -144 130 -14 55 -29 108 -33 118 -13 33 -74 50 -164 44 l-81 -5 -12 82 c-6 44 -16 114 -22 155 -15 103 -31 120 -133 133 -110 14 -262 5 -372 -21 -131 -32 -138 -41 -146 -203 -4 -68 -4 -151 -1 -184 l6 -60 -87 -25 c-115 -32 -135 -54 -135 -147 1 -37 7 -96 15 -132 20 -93 19 -117 -6 -125 -46 -15 -261 -190 -369 -301 -274 -281 -551 -653 -676 -909 -66 -135 -132 -321 -155 -438 l-13 -68 -130 3 -131 3 -8 105 c-20 270 72 996 183 1440 42 166 103 351 177 540 102 258 159 363 368 685 128 197 230 395 266 520 21 69 24 101 24 240 0 140 -3 169 -23 235 -36 115 -89 207 -166 288 l-69 72 9 58 c15 101 11 187 -9 210 -10 11 -57 32 -103 47 -83 26 -85 28 -79 54 37 146 50 217 50 278 0 91 -11 103 -150 164 l-100 44 -192 3 c-135 2 -193 0 -198 -8z m-520 -605 c44 -10 83 -20 86 -23 4 -4 1 -41 -7 -82 -7 -41 -13 -108 -14 -148 0 -91 18 -114 106 -132 96 -19 94 -17 94 -61 0 -56 23 -105 62 -129 45 -29 163 -25 205 6 23 17 54 62 66 97 1 4 17 5 35 1 32 -6 32 -7 32 -66 0 -55 3 -63 34 -94 33 -33 36 -34 116 -34 82 0 82 0 121 39 22 22 39 48 39 61 0 17 4 21 18 15 33 -13 147 -17 174 -6 16 6 36 24 47 41 l18 31 27 -36 c69 -90 110 -215 108 -325 -2 -153 -81 -331 -286 -649 -210 -324 -269 -438 -378 -721 -155 -404 -237 -747 -308 -1295 -35 -273 -50 -472 -50 -674 l0 -194 -241 6 c-133 4 -244 9 -247 11 -11 11 24 195 70 366 69 258 84 329 102 460 25 194 28 250 16 383 -39 455 -271 788 -635 915 -95 33 -152 43 -280 50 l-119 7 -12 72 c-30 175 -83 301 -242 570 -120 202 -155 278 -188 402 -40 155 -30 288 36 458 45 117 118 224 229 333 193 192 426 311 696 355 114 18 357 13 470 -10z m-765 -2395 c295 -70 505 -291 597 -627 23 -85 26 -118 27 -248 0 -172 -20 -294 -99 -589 -63 -236 -72 -277 -86 -397 l-12 -107 -116 -6 c-64 -3 -290 -9 -502 -12 l-385 -6 -18 28 c-111 174 -239 266 -546 394 -330 138 -451 227 -527 387 -29 60 -36 87 -36 133 2 153 108 354 275 522 48 49 92 88 98 88 5 0 10 -8 10 -18 0 -29 44 -63 87 -68 21 -3 74 1 118 8 l80 14 20 -41 c25 -51 72 -75 145 -75 100 0 160 55 160 146 0 33 4 43 19 47 15 4 20 -2 25 -28 6 -32 33 -63 73 -84 36 -18 129 -13 173 9 49 25 70 64 70 128 l0 50 73 10 c61 9 76 16 100 42 23 26 27 39 27 88 0 53 -8 118 -26 200 l-6 32 48 0 c27 0 87 -9 134 -20z m4196 -296 c124 -88 204 -235 204 -378 0 -166 -117 -396 -266 -519 -98 -82 -194 -132 -401 -208 -296 -109 -361 -137 -467 -195 -181 -101 -327 -225 -452 -384 l-49 -63 -160 7 c-310 13 -836 44 -842 50 -9 8 52 196 98 303 73 172 153 303 323 528 130 172 276 345 391 461 103 104 277 241 283 224 2 -6 17 -17 34 -26 24 -13 48 -14 122 -9 l92 7 12 -39 c19 -64 52 -87 131 -91 90 -5 136 15 162 72 10 23 19 58 19 79 0 20 3 37 8 37 4 0 16 -24 27 -53 25 -65 63 -87 148 -87 103 0 157 47 157 135 l0 53 92 13 c120 16 138 32 138 118 l0 61 66 -25 c37 -14 95 -46 130 -71z m-3766 -1997 c0 -158 5 -167 95 -167 93 0 98 11 89 169 l-7 121 267 0 266 0 0 -30 c0 -32 40 -243 66 -344 31 -125 41 -136 122 -136 90 0 111 60 69 200 -26 86 -67 267 -67 295 0 12 16 15 88 15 106 0 132 -6 132 -31 0 -37 36 -59 94 -59 47 0 57 4 75 26 12 15 21 33 21 40 0 11 10 13 38 9 20 -2 181 -12 357 -20 176 -9 361 -18 411 -21 l92 -6 -54 -91 c-46 -78 -54 -100 -54 -143 0 -70 15 -86 83 -92 68 -5 73 -1 164 155 37 62 78 126 92 142 l26 30 158 -7 158 -7 -187 -215 c-103 -118 -268 -306 -367 -417 l-179 -203 -226 0 c-281 1 -1228 15 -1902 30 -486 10 -1571 48 -1579 55 -4 5 120 149 378 438 107 120 197 214 201 210 10 -11 40 -149 40 -185 0 -31 16 -68 34 -80 6 -4 35 -8 65 -8 76 0 91 16 91 97 0 64 -30 221 -55 294 l-14 39 27 1 c231 11 423 16 635 17 l257 2 0 -123z m2911 -233 l-2 -86 -207 -232 c-114 -127 -272 -304 -352 -393 l-145 -161 -3 79 c-2 53 1 86 10 98 12 17 136 158 537 613 86 97 158 174 160 172 3 -2 4 -43 2 -90z m-4281 -679 c556 -21 2082 -55 2725 -60 231 -1 473 -3 538 -4 l118 -1 -3 -137 -3 -138 -345 3 c-190 2 -514 8 -720 13 -206 6 -609 14 -895 19 -681 10 -1798 41 -1807 49 -8 7 2 271 11 271 3 0 175 -7 381 -15z"/> </g> </g> </svg>';

  // ── WHAT THE PAGE OWES IT ────────────────────────────────────────────────
  // assets.html declares `api` and `toast` at the top level, so they are
  // globals; chats.html wraps its whole script in an IIFE, so they are not.
  // Rather than make one of them leak, either page may hand them in — and
  // `window.*` stays the fallback so nothing about assets.html moved.
  var HOST = {};
  function init(o){ HOST = o || {}; }
  function toast(m){
    var t = HOST.toast || window.toast;
    if (t) t(m);
  }
  // A door that WALKS goes through the top window: a Compare page opened in
  // the app runs in a same-origin IFRAME, and navigating the frame would load
  // the Playground inside the page viewer. On a page that is not framed this
  // is exactly `location.href`, so nothing about Meta Assets or the Assets
  // tab moved. A cross-origin parent throws on read and keeps the frame.
  function go(href){
    var w = window;
    try { if (window.top && window.top !== window && window.top.location.origin === location.origin) w = window.top; }
    catch (e) { w = window; }
    w.location.href = href;
  }
  function post(path, body){
    var a = HOST.api || window.api;
    if (a) return a(path, {method:'POST', body:JSON.stringify(body)});
    return fetch(path, {method:'POST',
      headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  }

  // ── Save to Photos, the Playground's own three-path saver ─────────────────
  // 1. In the app, the native forgeSave bridge writes it to the photo library.
  // 2. In Safari, the share sheet (needs the blob ALREADY fetched — a download
  //    inside the tap handler makes navigator.share reject silently).
  // 3. A plain download for a desktop browser.
  var lbBlob=null;
  function prefetchBlob(url){
    lbBlob=null;
    fetch(url).then(function(r){ return r.blob(); })
      .then(function(b){ lbBlob={url:url, blob:b}; }).catch(function(){});
  }
  function nativeSaver(){ try{ return window.webkit.messageHandlers.forgeSave; }catch(e){ return null; } }
  window.__saveResult=function(ok,msg){ toast(msg||(ok?'Saved to Photos':'Couldn’t save that')); };
  function saveImage(url){
    var native=nativeSaver();
    if(native){ native.postMessage(url); toast('Saving…'); return; }
    if(!(lbBlob && lbBlob.url===url)){ toast('Still loading that image — try again'); return; }
    var ext=((lbBlob.blob.type||'').split('/')[1]||'png').replace('jpeg','jpg');
    var file=null;
    try{ file=new File([lbBlob.blob],'image.'+ext,{type:lbBlob.blob.type||'image/png'}); }catch(e){}
    if(file && navigator.canShare && navigator.canShare({files:[file]})){
      navigator.share({files:[file]})
        .catch(function(err){ if(err&&err.name!=='AbortError') toast('Couldn’t open the share sheet'); });
      return;
    }
    var a=document.createElement('a');
    a.href=URL.createObjectURL(lbBlob.blob); a.download='image.'+ext;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ── Open in the Playground: land with this image's settings prefilled ─────
  // Only offered when the exact prompt is on file (promptContent) — the same
  // query promptlab.html reads (?prompt=&style=&quality=), plus `sameref`.
  //
  // WHICH TILE, AND WHETHER WE ACTUALLY KNOW, both come from
  // /playground-port.js — see its header. `sameref=1` means the filed style
  // half names that tile's own reference or quotes its own baked prompt, so
  // re-running carries the same reference the picture was made with; `0` means
  // nothing identified it and the fallback tile's reference is NOT the one
  // behind this picture. The Playground says which, in her words, on arrival.
  // This used to be four loose regexes over the style half, which sent 224
  // pictures whose prompts merely said "watercolor wash" to the WTR LoRA — a
  // different engine — with nothing on screen admitting it was a guess.
  function playgroundQuery(it){
    if(!it || !it.promptContent) return null;
    var port=(window.ForgePlaygroundPort||null);
    if(!port) return null;
    var m=port.matchStyle(it.promptStyle, it.prompt);
    var q='prompt='+encodeURIComponent(it.promptContent)+'&style='+m.style
         +'&sameref='+(m.matched?'1':'0');
    var qual=port.matchQuality(it.promptStyle, it.prompt);
    if(qual) q+='&quality='+qual;
    // THE CAST COMES TOO (2026-08-29, Sophie: "panels adds a character / if i
    // import solo to playground / can it auto add the character description
    // from the original multi sheet / ex creepy guy"). A cut panel's filed
    // STYLE half is everything in the sheet's prompt before that panel's own
    // line, so the characters clause is sitting in it verbatim — castParse
    // reads the rows straight back out. Nothing is invented: no clause on the
    // record means no rows and the link is exactly what it always was.
    var sg=window.__sheetGrid;
    var cast=sg&&sg.castParse?sg.castParse(it.promptStyle):[];
    if(cast&&cast.length) q+='&cast='+encodeURIComponent(JSON.stringify(cast));
    return q;
  }

  // ── THE STANDARD ROW ──────────────────────────────────────────────────────
  // `build(url, asset, opts)` → the `actions` array for asset-lightbox.js.
  //
  // opts.chatDoor — draw "Open the chat". TRUE on a surface that mixes chats
  //   (Meta Assets, the Delivered strip); FALSE inside a chat's own Assets tab,
  //   where it is a button back to the screen she is standing on.
  //
  // It also PREFETCHES the bytes, because Save needs them in hand by the time
  // she taps: a fetch started inside the tap handler makes navigator.share
  // reject silently. So a caller builds this on the way INTO the lightbox.
  function build(url, asset, opts){
    opts = opts || {};
    if(!asset) return [];
    prefetchBlob(url);
    var acts=[];
    if(opts.chatDoor && asset.chat && !asset.app){
      acts.push({label:'Open the chat', icon:CHATICON, onClick:function(){
        go('/chats?chat='+encodeURIComponent(asset.chat)); }});
    }
    // EVERY picture has a way to the Playground (2026-08-28, Sophie: "meta
    // assets missing its send to playground/shoebox"). With a filed prompt it
    // ports exactly as before; with none there is nothing to port HONESTLY,
    // so the picture itself rides along as the photo reference instead —
    // her own image attached, no words invented.
    var pq=playgroundQuery(asset) || 'photo='+encodeURIComponent(url);
    acts.push({label:'Open in Playground', icon:PLAYICON, onClick:function(){
      go('/playground?'+pq); }});
    // ADD TO SHOEBOX — the Story Room door's twin (same share glyph, same
    // content-addressed memory, so the doors can never make twins). The label
    // she reviews by becomes the polaroid's title; the lit button is the
    // receipt, because this door walks nowhere and without it a tap that
    // landed and a tap that did nothing look identical.
    acts.push({label:'Add to Shoebox', icon:SHOEICON, onClick:function(ev){
      var btn=ev&&ev.currentTarget;
      post('/api/scratchpad/shoebox-url',{url:url, title:asset.description||''})
        .then(function(r){return r.json()})
        .then(function(d){
          if(d&&d.ok){ if(btn){btn.style.background='#3a3530'; btn.style.color='#faf7f0';} toast('In the Shoebox'); }
          else toast((d&&d.error)||'That didn’t save');
        })
        .catch(function(){ toast('That didn’t save'); });
    }});
    acts.push({label:'Save to Photos', icon:SAVEICON, onClick:function(){ saveImage(url); }});
    return acts;
  }

  window.ForgeAssetActions = {
    init: init,
    build: build,
    prefetch: prefetchBlob,
    save: saveImage,
    playgroundQuery: playgroundQuery,
    ICONS: { chat:CHATICON, play:PLAYICON, shoebox:SHOEICON, save:SAVEICON, heart:HEART },
  };
})();
