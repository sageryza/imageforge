/* TAP-TO-NOTE ON A FILM — the ONE implementation (Aug 2026; v3 to Sophie's
 * own spec, 2026-08-21).
 *
 * She designed it on the Evan film, it shipped inside chats.html's pinned
 * player, moved here so compare.js's video lightbox (every film row and
 * playable tile on a Compare page) shares it — and after real use of the
 * ported player she respecified the whole interaction. Her words, verbatim,
 * because each one is a rule:
 *
 *   - "tapping the screen anywhere should pause it, not just the pause
 *     button — but it shouldn't pull up the note thing; pressing it again…
 *     start it playing again."  A tap on the film TOGGLES pause/play and
 *     never opens the sheet.
 *   - "when i tap to get rid of the tinted pause screen, it also pauses the
 *     video" (2026-08-27). The hosts run the video with NATIVE controls, so
 *     iOS draws its own tinted overlay on any tap and fades it ~4s later
 *     while the film plays. A tap during that window is her putting the
 *     overlay AWAY, not asking to pause — but no API says whether iOS's
 *     overlay is on screen, so the toggle mirrors its clock: every tap on
 *     the film arms a window (SCRIM_MS), and a tap on a PLAYING film inside
 *     it only dismisses (and clears the window, exactly as iOS hides the
 *     overlay on that same tap — so the NEXT tap pauses). A paused film
 *     never treats a tap as dismissal: pausing keeps the overlay up, and a
 *     tap there has always meant play.
 *   - The NOTE button shows while the film is PAUSED — pausing is one tap
 *     now, so the pause IS the moment the option presents itself. No fade
 *     timers, no touch-to-reveal.
 *   - "pressing play after it's been paused should trigger the note to save
 *     and disappear."  Play — a tap on the film or the native control — is
 *     Done. Cancel stays as the deliberate discard.
 *   - "rather than sending each note each time it should probably save them
 *     all and batch them so it doesn't have to wait to send… It says note
 *     couldn't be sent."  A finished note is QUEUED on the device (the
 *     localStorage outbox below) and sent in the background with retries —
 *     the sheet closes INSTANTLY, and a network hiccup can never bounce a
 *     note back at her. 'Note saved' is honest: saved here, sent when the
 *     network allows, still queued after a reload if it hasn't gone yet.
 *     filmnote.js loads with the Chats app, so opening the app flushes
 *     anything a bad connection left behind.
 *
 * Callers (unchanged):
 *
 *   var note = window.__filmNote({ wrap, video, chat, url });
 *   …
 *   note && note.destroy();      // in the caller's own close()
 *
 * `wrap` is the overlay element (it gets `filmnote-host`). `chat`/`url` are
 * where the note lands: the FILM's own url thread, via the same asset-note
 * machinery her picture notes use, so the chat that made the film sweeps
 * them the same way. Closing the player over an unfinished note QUEUES what
 * she typed (or the words already transcribed) rather than losing it; only a
 * raw, untouched recording is discarded by a close — Cancel is the
 * deliberate discard.
 */
(function () {
  if (window.__filmNote) return;                 // safe to include twice


  var css = document.createElement('style'); css.id = 'filmnote-css';
  css.textContent =
    '.filmnote-host .notebtn{position:absolute; right:12px;'
    + ' bottom:calc(env(safe-area-inset-bottom,0px) + 64px); z-index:3;'
    + ' display:flex; align-items:center; gap:6px; padding:9px 13px; border-radius:6px;'
    + ' border:1px solid #3a352c; background:rgba(23,20,15,.86); color:#e8e2d6;'
    + " font:600 12px/1 -apple-system,'Helvetica Neue',sans-serif;"
    + ' transition:opacity .18s;}'
    + '.filmnote-host .notebtn.off{opacity:0; pointer-events:none;}'
    + '.filmnote-host .nsheet{position:absolute; left:0; right:0; bottom:0; z-index:4;'
    + ' background:#17140f; border-top:1px solid #3a352c; padding:10px 12px'
    + ' calc(env(safe-area-inset-bottom,0px) + 10px); display:flex; flex-direction:column; gap:7px;}'
    + ".filmnote-host .nsheet .nt{font:12px/1.3 -apple-system,'Helvetica Neue',sans-serif; color:#97907f;}"
    // 16px on purpose (the original pinned player's size): anything smaller
    // makes iOS zoom the whole page the moment the box focuses, which shoves
    // the fixed overlay around and reads as "the note box is broken"
    + '.filmnote-host .nsheet textarea{width:100%; min-height:62px; box-sizing:border-box; padding:8px;'
    + ' border:1px solid #3a352c; border-radius:6px; background:#211d16; color:#e8e2d6;'
    + " font:16px/1.4 -apple-system,'Helvetica Neue',sans-serif; resize:none;}"
    + '.filmnote-host .nsheet .row{display:flex; gap:10px; align-items:center;}'
    + '.filmnote-host .nsheet .row button{border:1px solid #3a352c; border-radius:6px;'
    + " background:#211d16; color:#e8e2d6; padding:7px 13px;"
    + " font:600 13px/1 -apple-system,'Helvetica Neue',sans-serif;}"
    + '.filmnote-host .nsheet .send{background:#e8e2d6; color:#17140f; border-color:#e8e2d6;}'
    + ".filmnote-host .nsheet .st{font:11px/1.3 -apple-system,'Helvetica Neue',sans-serif;"
    + ' color:#97907f; min-height:14px;}'
    // the moment-of-saving word, visible while she is already watching again
    + '.filmnote-host .ntoast{position:absolute; left:50%; transform:translateX(-50%);'
    + ' bottom:calc(env(safe-area-inset-bottom,0px) + 64px); z-index:5; padding:9px 14px;'
    + ' border-radius:6px; border:1px solid #3a352c; background:rgba(23,20,15,.92); color:#e8e2d6;'
    + " font:600 12px/1.3 -apple-system,'Helvetica Neue',sans-serif; text-align:center;"
    + ' max-width:86%; opacity:0; transition:opacity .25s; pointer-events:none;}'
    + '.filmnote-host .ntoast.on{opacity:1;}';
  document.head.appendChild(css);

  /* THE OUTBOX — "save them all and batch them so it doesn't have to wait to
     send". Every finished note lands here first; a background flusher walks
     the queue one entry at a time, retrying until the server answers ok. An
     entry is {id, chat, url, t, text, audio?, voice?}: `audio` is the
     recording as a data: url still waiting to be uploaded+transcribed,
     `voice` the Storage url once it has been (persisted mid-flight, so a
     retry never uploads the same recording twice). */
  var OUTKEY = 'forge.filmnotes.outbox';
  function outRead(){ try{ return JSON.parse(localStorage.getItem(OUTKEY)||'[]'); }catch(_){ return []; } }
  function outWrite(list){ try{ localStorage.setItem(OUTKEY, JSON.stringify(list)); return true; }catch(_){ return false; } }
  function saveEntry(e){
    var list=outRead();
    for(var i=0;i<list.length;i++) if(list[i].id===e.id){ list[i]=e; break; }
    outWrite(list);
  }
  function noteLine(t, words, voiceUrl){
    return '['+t+'] '+(words||'(voice note)')+(voiceUrl?' (voice: '+voiceUrl+')':'');
  }
  function postText(chat, url, line){
    return fetch('/api/gallery/assets/note',{ method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ chat: chat, url: url, from:'sophie', text: line }) })
      .then(function(r){ return r.json(); })
      .then(function(d){ return !!(d&&d.ok); })
      .catch(function(){ return false; });
  }
  function sendEntry(e){
    if(e.audio && !e.voice){
      return fetch('/api/gallery/assets/note-voice',{ method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ chat: e.chat, url: e.url, t: e.t, hold: true, audio: e.audio }) })
        .then(function(r){ return r.json(); })
        .then(function(d){
          if(!d||!d.ok) return false;
          e.voice=d.url; if(!e.text) e.text=d.transcript||'';
          e.audio='';                    // uploaded — stop carrying the bytes
          saveEntry(e);                  // progress persists: a retry starts here
          return postText(e.chat, e.url, noteLine(e.t, e.text, e.voice));
        })
        .catch(function(){ return false; });
    }
    return postText(e.chat, e.url, noteLine(e.t, e.text, e.voice));
  }
  var flushing=false;
  function flush(){
    if(flushing) return;
    var list=outRead(), now=Date.now(), e=null;
    for(var i=0;i<list.length;i++){
      // a lock says another open page is (or was just) sending this one —
      // the cheap guard against the same note filing twice from two tabs
      if(!(list[i].lock && now-list[i].lock<25000)){ e=list[i]; break; }
    }
    if(!e) return;
    e.lock=now; saveEntry(e);
    flushing=true;
    sendEntry(e).then(function(ok){
      flushing=false;
      if(ok){ outWrite(outRead().filter(function(x){ return x.id!==e.id; })); flush(); }
      else {
        e.lock=0; saveEntry(e);          // free it for the next try, wherever that runs
        setTimeout(flush, 30000);        // the network will come back; the note waits here
      }
    });
  }
  function queueNote(entry){
    entry.id = Date.now()+'-'+Math.random().toString(36).slice(2,8);
    var list=outRead(); list.push(entry);
    if(!outWrite(list)){
      // no storage (private mode / quota on a long recording): send it now,
      // fire-and-forget — worse than the queue, better than losing it
      sendEntry(entry);
      return;
    }
    flush();
  }
  window.addEventListener('online', flush);
  setInterval(flush, 45000);             // no-ops on an empty queue
  setTimeout(flush, 1200);               // opening any page that loads this flushes stragglers

  // How long iOS keeps its tinted controls overlay up on a playing film
  // after a tap (~4s) — the dismiss-only window above. Overridable so the
  // headless test can drive it without real seconds.
  var SCRIM_DEFAULT = 3800;

  window.__filmNote = function (opts) {
    opts = opts || {};
    var w = opts.wrap, v = opts.video, chat = opts.chat, url = opts.url;
    if (!w || !v || !chat || !url) return null;
    w.classList.add('filmnote-host');
    var mrec = null;
    var sheet=null, finishFn=null;
    var toastEl=null, toastT=null, dead=false;
    function toast(msg){
      if(dead) return;
      if(!toastEl){ toastEl=document.createElement('div'); toastEl.className='ntoast'; w.appendChild(toastEl); }
      toastEl.textContent=msg;
      requestAnimationFrame(function(){ if(toastEl) toastEl.classList.add('on'); });
      clearTimeout(toastT);
      toastT=setTimeout(function(){ if(toastEl) toastEl.classList.remove('on'); }, 2200);
    }
    var fmtT=function(s){ s=Math.max(0,Math.floor(s||0)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
    var MIC='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';
    var nb=document.createElement('button'); nb.className='notebtn off';
    nb.innerHTML=MIC+'<span>Note</span>';
    nb.setAttribute('aria-label','Leave a note here');
    // the button lives on the PAUSED screen: paused and no sheet → shown
    function syncBtn(){ nb.classList.toggle('off', !!sheet || !v.paused); }
    // play — her tap, or the native control — SAVES an open note ("pressing
    // play after it's been paused should trigger the note to save and
    // disappear"); pause is just the button's cue to appear
    var onPlay=function(){ if(finishFn) finishFn(); syncBtn(); };
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', syncBtn);
    // A TAP ANYWHERE ON THE FILM TOGGLES PAUSE/PLAY — and never the sheet.
    // The pointerdown snapshot guards against a browser whose own controls
    // already flipped playback on this same tap (desktop Chrome toggles on a
    // body click; iOS does not) — no second flip.
    // scrimAt is the native-overlay clock (the header's tinted-pause-screen
    // rule): armed by every tap on the film, read only while it PLAYS.
    var downPaused=null, scrimAt=0;
    var scrimMs=function(){ var n=window.__filmNote&&window.__filmNote.SCRIM_MS; return typeof n==='number'?n:3800; };
    var onDown=function(e){ downPaused = (e.target===v) ? v.paused : null; };
    var onWrapTap=function(e){
      if(e.target!==v) return;
      if(downPaused!==null && v.paused!==downPaused){ downPaused=null; scrimAt=Date.now(); syncBtn(); return; }
      downPaused=null;
      if(sheet){                          // tap = play = save and disappear
        if(finishFn) finishFn();
        v.play().catch(function(){});
        scrimAt=Date.now();
        syncBtn(); return;
      }
      if(!v.paused && Date.now()-scrimAt < scrimMs()){
        scrimAt=0;                        // iOS hid its overlay on this tap;
        return;                           // the next tap pauses as always
      }
      if(v.paused) v.play().catch(function(){});
      else v.pause();
      scrimAt=Date.now();
      syncBtn();
    };
    w.addEventListener('pointerdown', onDown);
    w.addEventListener('click', onWrapTap);
    nb.onclick=function(){
      if(sheet) return;
      try{ v.pause(); }catch(_){ }
      var t=fmtT(v.currentTime);
      sheet=document.createElement('div'); sheet.className='nsheet';
      sheet.innerHTML='<div class="nt">Note at '+t+'</div>'
        +'<textarea aria-label="Your note — tap here to edit with the keyboard"></textarea>'
        +'<div class="row"><span class="st"></span><span style="flex:1"></span>'
        +'<button class="cxl">Cancel</button><button class="send">Done</button></div>';
      var ta=sheet.querySelector('textarea'), st=sheet.querySelector('.st');
      var chunks=[], voiceHeld=null, mode='text'; // 'rec' | 'held' | 'text'
      // A recorder hands its data over ASYNC: dataavailable and stop fire on
      // a LATER task after stop(). Reading `chunks` synchronously right after
      // stop() got an EMPTY blob in every real browser — so every talk-then-
      // Done note was silently dropped. Anything that needs the recording
      // passes a `cb`; the blob is built in there.
      function stopMic(cb){
        var r=mrec; mrec=null;
        if(!r){ if(cb) cb(); return; }
        if(!cb){ try{ r.stop(); }catch(_){ } return; }
        var fired=false, fin=function(){ if(!fired){ fired=true; cb(); } };
        var prev=r.onstop;
        r.onstop=function(){ if(prev) prev(); fin(); };
        setTimeout(fin, 1200);  // a recorder that never reports back must not eat the note
        try{ r.stop(); }catch(_){ fin(); }
      }
      function closeSheet(){ stopMic(); finishFn=null; if(sheet){ sheet.remove(); sheet=null; } syncBtn(); }
      function resume(){ closeSheet(); v.play().catch(function(){}); }
      // upload + transcribe WITHOUT filing (hold:true) so her words can land
      // in the box for editing; filing is always through the outbox
      function holdVoice(blob){
        return new Promise(function(res){
          var rd=new FileReader();
          rd.onloadend=function(){
            fetch('/api/gallery/assets/note-voice',{ method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ chat: chat, url: url, t: t, hold: true, audio: rd.result }) })
              .then(function(r){ return r.json(); }).then(res).catch(function(){ res(null); });
          };
          rd.readAsDataURL(blob);
        });
      }
      // FINISHING A NOTE — Done, play, or the player closing over it. The
      // note goes to the OUTBOX and the sheet closes instantly; nothing here
      // ever waits on the network. `discard` (only the player's own close)
      // keeps typed/transcribed words but drops a raw untouched recording —
      // Cancel is the deliberate discard for everything.
      finishFn=function(discard){
        if(!sheet) return;
        var typed=ta.value.trim();
        if(mode==='rec'){
          stopMic(function(){
            var blob=new Blob(chunks,{type:chunks[0]&&chunks[0].type||'audio/webm'});
            if(discard || !blob.size){
              if(typed){ queueNote({ chat:chat, url:url, t:t, text:typed }); if(!discard) toast('Note saved'); }
              else if(!discard) toast('Didn’t catch any sound — nothing saved');
              return;
            }
            var rd=new FileReader();
            rd.onloadend=function(){ queueNote({ chat:chat, url:url, t:t, text:typed||'', audio:rd.result }); };
            rd.readAsDataURL(blob);
            if(!discard) toast('Note saved');
          });
          closeSheet();
          return;
        }
        if(typed||voiceHeld){
          queueNote({ chat:chat, url:url, t:t, text:typed||'', voice:voiceHeld||'' });
          if(!discard) toast('Note saved');
        }
        closeSheet();
      };
      // DEFAULT: the mic is already on — she talks; Done (or play) does the rest
      if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&typeof MediaRecorder!=='undefined'){
        navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
          if(!sheet){ stream.getTracks().forEach(function(tr){ tr.stop(); }); return; }
          mrec=new MediaRecorder(stream);
          mode='rec'; st.textContent='Recording — talk, then tap Done or press play';
          mrec.ondataavailable=function(e){ if(e.data&&e.data.size) chunks.push(e.data); };
          mrec.onstop=function(){ stream.getTracks().forEach(function(tr){ tr.stop(); }); };
          mrec.start();
        }).catch(function(){ st.textContent='No mic here — type instead.'; ta.focus(); });
      } else { st.textContent='No mic here — type instead.'; }
      // tapping the box: stop the mic, put her words there, keyboard rises
      ta.addEventListener('focus', function(){
        if(mode!=='rec') return;
        mode='held';
        st.textContent='Getting your words…';
        stopMic(function(){
          if(!sheet) return;
          var blob=new Blob(chunks,{type:chunks[0]&&chunks[0].type||'audio/webm'});
          if(!blob.size){ mode='text'; st.textContent=''; return; }
          holdVoice(blob).then(function(d){
            if(!sheet) return;
            if(d&&d.ok){ voiceHeld=d.url; if(!ta.value.trim()) ta.value=d.transcript||''; st.textContent=''; }
            else st.textContent='Couldn’t hear that — type it instead.';
          });
        });
      });
      sheet.querySelector('.cxl').onclick=function(){ finishFn=null; resume(); };
      sheet.querySelector('.send').onclick=function(){ var f=finishFn; if(f) f(); v.play().catch(function(){}); };
      w.appendChild(sheet);
      syncBtn();
    };
    w.appendChild(nb);
    return { destroy: function () {
      dead=true;
      // an unfinished note is SAVED, not lost — the queue survives the player
      if (finishFn) finishFn(true);
      if (mrec) { try { mrec.stop(); } catch (_) {} mrec = null; }
      if (sheet) { sheet.remove(); sheet = null; }
      // the lightbox wrap is REUSED across opens (compare.js keeps one
      // .cmp-vlb) — leave nothing behind, or listeners stack per open
      w.removeEventListener('pointerdown', onDown);
      w.removeEventListener('click', onWrapTap);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', syncBtn);
      w.classList.remove('filmnote-host');
      clearTimeout(toastT);
      if (toastEl) { toastEl.remove(); toastEl = null; }
      nb.remove();
    } };
  };
  window.__filmNote.SCRIM_MS = SCRIM_DEFAULT;
})();
