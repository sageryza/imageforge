#!/usr/bin/env python3
"""Build + post the character-card comparison Compare page.

  python3 nde-compare-cards.py            # build and POST
  python3 nde-compare-cards.py --dry-run  # write the html locally only

House rules baked in (CLAUDE.md "Compare pages"): links /compare.css and does
not override its :root tokens (the injected autoscroll pill reads them), adds
no scroll pill of its own, scopes its script in an IIFE (the pill declares bare
`var`s in global scope and a page-level `let` kills it at parse time), pauses
the autoscroll on ANY tap except taps on the pill itself, and the lightbox
saves/restores window.scrollY as well as locking background scroll.
"""
import json, os, sys, urllib.request

BASE = "https://imageforge-q125.onrender.com"
IMG = "https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/nde-watercolor/cards"
CHAT = "nde-illustration-montages"

PEOPLE = [("barker", "Tricia Barker"), ("wright", "Darius J. Wright"),
          ("hugenot", "Alan Hugenot (drawn at 17)")]
VARIANTS = [("v3", "pale", "“plain <b>pale</b> background”, plus “calm and open-faced”"),
            ("v4", "white", "“plain <b>white</b> background”, expression line removed"),
            ("v5", "paper white", "“plain <b>off-white paper</b> background”, expression line removed")]


def build():
    rows = []
    for key, name in PEOPLE:
        figs = "".join(
            f'<figure><img src="{IMG}/card-{key}-{v}.webp" alt="{name} — {label}" '
            f'loading="lazy"><figcaption>{label}</figcaption></figure>'
            for v, label, _ in VARIANTS)
        rows.append(f'<div class="card"><h3>{name}</h3>'
                    f'<div class="imgrow three">{figs}</div>'
                    f'<div class="mini">Tap any one to see it full size.</div></div>')

    what = "".join(f'<li><b>{label}</b> — {desc}</li>' for _, label, desc in VARIANTS)

    return f"""<link rel="stylesheet" href="/compare.css">
<div class="wrap">
  <div class="eyebrow">NDE ILLUSTRATION MONTAGES · 11 AUG 2026</div>
  <h1>Character cards — pale vs white vs paper white</h1>
  <div class="sub">The same three people, the same prompt, one phrase different.</div>

  <div class="big"><b>What is different</b>
    <ul>{what}</ul>
    Everything else is identical: one style reference (sage sandy mirror), the
    one-sentence likeness line, gpt-image-2 edits, medium, 1024&times;1536.
  </div>

  {"".join(rows)}

  <div class="card">
    <h3>What I see</h3>
    <p class="mini">Every word removed so far has loosened the drawing, and that
    holds here too. But <b>white</b> also took away the warm paper the style
    reference was carrying — the ground goes flat, and some of the
    scanned-sketchbook feel goes with it. <b>Paper white</b> is the attempt to
    keep the wording precise without flattening the ground.</p>
  </div>

  <div class="card">
    <h3>Which one?</h3>
    <div class="chips" id="pick">
      <button class="btn" data-v="pale">pale</button>
      <button class="btn" data-v="white">white</button>
      <button class="btn" data-v="paper white">paper white</button>
    </div>
    <div class="mini" id="said"></div>
  </div>
</div>

<div id="lb" hidden style="position:fixed;inset:0;background:rgba(20,18,15,.92);
     z-index:9998;display:flex;align-items:center;justify-content:center;padding:12px">
  <img id="lbimg" style="max-width:100%;max-height:100%;border-radius:6px" alt="">
</div>

<script>
(function () {{
  // Any tap pauses the autoscroll — but never a tap on the pill itself, whose
  // own repaint would otherwise eat the click.
  document.addEventListener('pointerdown', function (e) {{
    var t = e.target;
    if (t && t.closest && t.closest('.float')) return;
    if (window.__scrollStop) window.__scrollStop();
  }}, true);

  var lb = document.getElementById('lb'), lbimg = document.getElementById('lbimg'), savedY = 0;
  function open(src, alt) {{
    savedY = window.scrollY;
    lbimg.src = src; lbimg.alt = alt || '';
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
  }}
  function close() {{
    lb.hidden = true; lbimg.src = '';
    document.body.style.overflow = '';
    window.scrollTo(0, savedY);   // overflow:hidden does not stop window.scrollBy
  }}
  document.querySelectorAll('.imgrow img').forEach(function (im) {{
    im.addEventListener('click', function () {{ open(im.src, im.alt); }});
  }});
  lb.addEventListener('click', close);

  var said = document.getElementById('said');
  document.querySelectorAll('#pick button').forEach(function (b) {{
    b.addEventListener('click', function () {{
      var v = b.getAttribute('data-v');
      said.textContent = 'Saved: ' + v;
      // A served page must never post to /api/chatfeed/reply — verdicts only.
      fetch('/api/chatfeed/verdict', {{
        method: 'POST', headers: {{ 'content-type': 'application/json' }},
        body: JSON.stringify({{ chat: {CHAT!r}, sheet: 'card-paper', item: 'choice', text: v }})
      }}).catch(function () {{ said.textContent = 'Saved locally — ' + v; }});
    }});
  }});
}})();
</script>"""


def main():
    html = build()
    out = "/home/user/out/nde-wc/compare-cards.html"
    open(out, "w").write(html)
    print(f"{len(html)} bytes → {out}")
    if "--dry-run" in sys.argv:
        return
    body = json.dumps({"chat": CHAT,
                       "title": "Character cards — pale vs white vs paper white",
                       "html": html}).encode()
    req = urllib.request.Request(BASE + "/api/chatfeed/page", data=body,
                                 headers={"content-type": "application/json"})
    print(urllib.request.urlopen(req, timeout=120).read().decode()[:300])


if __name__ == "__main__":
    main()
