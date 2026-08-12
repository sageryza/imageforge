#!/usr/bin/env python3
"""Sophie's own messages, verbatim — a page that is only her.

Her ask: "a new version of the artifact that doesn't delete the old one but
just has my messages like everything that I said about the stories that I
wanted verbatim."

THREE RULES, all load-bearing:

 1. VERBATIM. Each message is the transcript text, character for character —
    never trimmed, tidied or summarised. That is the whole value of the page.

 2. NOTHING IS FILTERED OUT. She said "everything that I said". Deciding which
    of her messages are "about the stories" means dropping some, and silently
    losing one of her asks is exactly what this page exists to prevent.

 3. THE TWO EXTRACTIONS ARE UNIONED, NOT SWAPPED. The chapters page was built
    from a snapshot of the transcript; re-reading the transcript today filters
    slightly differently — the fresh pass finds 6 of her messages the snapshot
    never had (today's), and the snapshot holds 1 the fresh pass drops. Taking
    either alone loses something, so both are merged and de-duped on
    (timestamp, text).

Chapters are matched by TIMESTAMP, not by list index: the two extractions
number their messages differently, so an index-keyed match would file her
words under the wrong chapter.
"""
import json, html, pathlib, re, sys, datetime as dt
from importlib.machinery import SourceFileLoader

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
OLD = json.loads((HERE / 'raw-messages.json').read_text())
FRESH = json.loads((HERE / 'raw-fresh.json').read_text())
D = SourceFileLoader('d', str(HERE / 'chapters-data.py')).load_module()
LAST_END = 616

# ── her messages: the union of both extractions, in time order ──────────────
seen, hers = set(), []
for m in OLD + FRESH:
    if m.get('who') != 'sophie':
        continue
    k = (m.get('at'), (m.get('text') or '').strip())
    if not k[1] or k in seen:
        continue
    seen.add(k)
    hers.append(m)
hers.sort(key=lambda m: m['at'])

# ── chapter boundaries, as TIMES taken off the snapshot the spine indexes ────
bounds = []
for i, (start, title, _l1, _l2) in enumerate(D.CHAPTERS):
    end = D.CHAPTERS[i + 1][0] if i + 1 < len(D.CHAPTERS) else LAST_END
    sl = OLD[start:end]
    if not sl:
        continue
    bounds.append({'id': 'ch%02d' % (i + 1), 'title': title,
                   'from': sl[0]['at'], 'to': sl[-1]['at']})
bounds.sort(key=lambda b: b['from'])

def chapter_of(at):
    # Anything after the LAST chapter's last message is newer than the spine —
    # it gets its own section rather than being folded into chapter 28, whose
    # title would then be describing messages it never covered.
    if bounds and at > bounds[-1]['to']:
        return None
    hit = None
    for b in bounds:
        if at >= b['from']:
            hit = b
    return hit

e = lambda s: html.escape(s or '', quote=True)
MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

def when(iso):
    t = dt.datetime.fromisoformat(iso.replace('Z', '+00:00'))
    h = t.hour % 12 or 12
    return '%s %d, %d:%02d %s' % (MONTH[t.month - 1], t.day, h, t.minute,
                                  'am' if t.hour < 12 else 'pm')

# an upload path in her text renders as a named chip, same as the chapters page
ATT = re.compile(r'@?"?(/[^\s"]*/uploads/[^\s"]*?/([^/\s"]+))"?')
def body(txt):
    out, last = [], 0
    for m in ATT.finditer(txt):
        out.append(e(txt[last:m.start()]))
        out.append('<span class="hx-att">%s</span>' % e(m.group(2)))
        last = m.end()
    out.append(e(txt[last:]))
    return ''.join(out).strip()

groups, order = {}, []
for m in hers:
    b = chapter_of(m['at'])
    key = b['id'] if b else 'since'
    if key not in groups:
        groups[key] = {'title': b['title'] if b else 'Since then', 'msgs': []}
        order.append(key)
    groups[key]['msgs'].append(m)

blocks = []
for key in order:
    g = groups[key]
    rows = ''.join(
        '<div class="hx-m"><div class="hx-w">%s</div><div class="hx-b">%s</div></div>'
        % (when(m['at']), body(m['text'])) for m in g['msgs'])
    blocks.append('<section class="hx-c" data-item="%s"><h2>%s<span class="hx-n">%d</span></h2>%s</section>'
                  % (e(key), e(g['title']), len(g['msgs']), rows))

CSS = """
.hx-c{margin:0 0 34px}
.hx-c h2{display:flex;align-items:baseline;gap:8px;font:700 11px/1.3 -apple-system,sans-serif;
  letter-spacing:.16em;text-transform:uppercase;color:var(--gold);
  border-bottom:1px solid var(--line);padding-bottom:7px;margin:0 0 4px}
.hx-n{margin-left:auto;font-weight:400;color:var(--ink2);letter-spacing:.06em}
.hx-m{padding:13px 0;border-bottom:1px solid var(--line)}
.hx-m:last-child{border-bottom:0}
.hx-w{font:400 10px/1.4 -apple-system,sans-serif;letter-spacing:.06em;
  text-transform:uppercase;color:var(--ink2);margin-bottom:4px}
.hx-b{font-size:16.5px;line-height:1.6;white-space:pre-wrap;color:var(--ink)}
.hx-att{display:inline-block;font:600 11px/1 -apple-system,sans-serif;
  letter-spacing:.04em;border:1px solid #e0d6c4;background:#f6f0e4;color:var(--ink2);
  border-radius:6px;padding:4px 7px;margin:0 2px}
"""

page = f'''<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Everything you said</title>
<link rel="stylesheet" href="/compare.css">
<style>{CSS}</style>

<div class="wrap">
  <div class="eyebrow">IMPRINT &middot; JUL 28 &ndash; AUG 12, 2026</div>
  <h1>Everything you said</h1>
  <div class="sub">Your {len(hers)} messages, word for word, in order. Nothing of mine, nothing cut.</div>
  {''.join(blocks)}
</div>

<script src="/compare.js"></script>
<script>
(function(){{
  if(window.__compareNotes) window.__compareNotes({{
    chat:'deck-factory-story-room', sheet:'hers-c{len(blocks)}' }});
}})();
</script>'''

(HERE / 'hers-page.html').write_text(page)
print('sections:', len(blocks), '| her messages:', len(hers), '| bytes:', len(page))
