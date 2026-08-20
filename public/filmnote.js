/* TAP-TO-NOTE ON A FILM — the ONE implementation (Aug 2026).
 *
 * Sophie designed this on the Evan film ("I watch the video but I can tap it
 * and then the video pauses and a Field comes up where I can write a note …
 * this could be reusable not just for this"), and it shipped inside
 * chats.html's pinned-film player, where it stayed. Her ask, on the dream
 * commercials grid: "there was a chat where we built a built-in pause and
 * notetaking thing … that was only on the links at the top of the page that
 * are pinned, could you somehow bring that mechanism in here."
 *
 * So it lives here now and BOTH callers use it — chats.html's pinned player
 * and compare.js's video lightbox, which is what every film row and every
 * playable tile on a Compare page opens. A second copy would drift, and this
 * one has already been reworked once from real use.
 *
 *   var note = window.__filmNote({ wrap, video, chat, url });
 *   …
 *   note && note.destroy();      // in the caller's own close()
 *
 * `wrap` is the overlay element (it gets `filmnote-host`, which is what the
 * CSS below hangs off, so the module never depends on the host's class
 * names). `chat` and `url` are where the note lands: the FILM's own url
 * thread, via the same asset-note machinery her picture notes use, so the
 * chat that made the film sweeps them the same way.
 *
 * REWORKED ONCE, FROM HER FIRST REAL USE — do not undo it: there is no layer
 * over the video ("even pressing play on the video triggers the note thing").
 * A floating NOTE button appears on a touch and fades like the native
 * controls; tapping it pauses and starts the MIC immediately, so she just
 * talks and ONE Done stops it, files, and resumes. Tapping the TEXT BOX
 * instead stops the mic and drops the transcript in to edit — that is the
 * only moment the keyboard rises.
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
    + '.filmnote-host .nsheet textarea{width:100%; min-height:62px; box-sizing:border-box; padding:8px;'
    + ' border:1px solid #3a352c; border-radius:6px; background:#211d16; color:#e8e2d6;'
    + " font:15px/1.4 -apple-system,'Helvetica Neue',sans-serif; resize:none;}"
    + '.filmnote-host .nsheet .row{display:flex; gap:10px; align-items:center;}'
    + '.filmnote-host .nsheet .row button{border:1px solid #3a352c; border-radius:6px;'
    + " background:#211d16; color:#e8e2d6; padding:7px 13px;"
    + " font:600 13px/1 -apple-system,'Helvetica Neue',sans-serif;}"
    + '.filmnote-host .nsheet .send{background:#e8e2d6; color:#17140f; border-color:#e8e2d6;}'
    + ".filmnote-host .nsheet .st{font:11px/1.3 -apple-system,'Helvetica Neue',sans-serif;"
    + ' color:#97907f; min-height:14px;}';
  document.head.appendChild(css);

  window.__filmNote = function (opts) {
    opts = opts || {};
    var w = opts.wrap, v = opts.video, chat = opts.chat, url = opts.url;
    if (!w || !v || !chat || !url) return null;
    w.classList.add('filmnote-host');
    var mrec = null;
    var sheet=null, fadeT=null;
    var fmtT=function(s){ s=Math.max(0,Math.floor(s||0)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
    var MIC='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';
    var nb=document.createElement('button'); nb.className='notebtn off';
    nb.innerHTML=MIC+'<span>Note</span>';
    nb.setAttribute('aria-label','Pause and leave a note');
    // the button follows the native controls' rhythm: a touch on the video
    // shows it, another touch (or 3.5s) fades it away
    function showBtn(){ nb.classList.remove('off');
      clearTimeout(fadeT); fadeT=setTimeout(function(){ nb.classList.add('off'); }, 3500); }
    w.addEventListener('click', function(e){
      if(e.target!==v || sheet) return;
      if(nb.classList.contains('off')) showBtn();
      else { clearTimeout(fadeT); nb.classList.add('off'); }
    });
    // files the note text (with the voice url when there is one) onto the
    // film's thread; background=true means she is already watching again
    function fileNote(t, text, voiceUrl, st){
      var line='['+t+'] '+(text||'(voice note)')+(voiceUrl?' (voice: '+voiceUrl+')':'');
      return fetch('/api/gallery/assets/note',{ method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ chat: chat, url: url, from:'sophie', text: line }) })
        .then(function(r){ return r.json(); });
    }
    nb.onclick=function(){
      if(sheet) return;
      clearTimeout(fadeT); nb.classList.add('off');
      try{ v.pause(); }catch(_){ }
      var t=fmtT(v.currentTime);
      sheet=document.createElement('div'); sheet.className='nsheet';
      sheet.innerHTML='<div class="nt">Note at '+t+'</div>'
        +'<textarea aria-label="Your note — tap here to edit with the keyboard"></textarea>'
        +'<div class="row"><span class="st"></span><span style="flex:1"></span>'
        +'<button class="cxl">Cancel</button><button class="send">Done</button></div>';
      var ta=sheet.querySelector('textarea'), st=sheet.querySelector('.st');
      var chunks=[], voiceHeld=null, mode='text'; // 'rec' | 'held' | 'text'
      function stopMic(){ if(mrec){ try{ mrec.stop(); }catch(_){ } mrec=null; } }
      function closeSheet(){ stopMic(); if(sheet){ sheet.remove(); sheet=null; } }
      function resume(){ closeSheet(); v.play().catch(function(){}); }
      // upload + transcribe WITHOUT filing (hold:true) so her words can land
      // in the box for editing; filing is always the text route above
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
      // DEFAULT: the mic is already on — she talks, one Done does the rest
      if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&typeof MediaRecorder!=='undefined'){
        navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
          if(!sheet){ stream.getTracks().forEach(function(tr){ tr.stop(); }); return; }
          mrec=new MediaRecorder(stream);
          mode='rec'; st.textContent='Recording — talk, then tap Done';
          mrec.ondataavailable=function(e){ if(e.data&&e.data.size) chunks.push(e.data); };
          mrec.onstop=function(){ stream.getTracks().forEach(function(tr){ tr.stop(); }); };
          mrec.start();
        }).catch(function(){ st.textContent='No mic here — type instead.'; ta.focus(); });
      } else { st.textContent='No mic here — type instead.'; }
      // tapping the box: stop the mic, put her words there, keyboard rises
      ta.addEventListener('focus', function(){
        if(mode!=='rec') return;
        mode='held'; stopMic();
        st.textContent='Getting your words…';
        var blob=new Blob(chunks,{type:chunks[0]&&chunks[0].type||'audio/webm'});
        if(!blob.size){ mode='text'; st.textContent=''; return; }
        holdVoice(blob).then(function(d){
          if(!sheet) return;
          if(d&&d.ok){ voiceHeld=d.url; if(!ta.value.trim()) ta.value=d.transcript||''; st.textContent=''; }
          else st.textContent='Couldn’t hear that — type it instead.';
        });
      });
      sheet.querySelector('.cxl').onclick=resume;
      sheet.querySelector('.send').onclick=function(){
        var typed=ta.value.trim();
        if(mode==='rec'){
          // her one button: stop, file, resume — she is watching again while
          // the transcription finishes in the background
          stopMic();
          var blob=new Blob(chunks,{type:chunks[0]&&chunks[0].type||'audio/webm'});
          resume();
          if(!blob.size && !typed) return;
          if(!blob.size){ fileNote(t, typed, null); return; }
          holdVoice(blob).then(function(d){
            var voice=d&&d.ok?d.url:null;
            var words=typed||(d&&d.ok?d.transcript:'')||'';
            if(!voice&&!words) return;
            fileNote(t, words, voice);
          });
          return;
        }
        if(!typed && !voiceHeld){ resume(); return; }
        st.textContent='Sending…';
        fileNote(t, typed, voiceHeld).then(function(d){
          if(!d||!d.ok){ st.textContent='Couldn’t send that — it’s still in the box.'; return; }
          resume();
        }).catch(function(){ st.textContent='Couldn’t send that — it’s still in the box.'; });
      };
      w.appendChild(sheet);
    };
    w.appendChild(nb);
    return { destroy: function () {
      if (mrec) { try { mrec.stop(); } catch (_) {} mrec = null; }
      if (sheet) { sheet.remove(); sheet = null; }
      nb.remove();
    } };
  };
})();
