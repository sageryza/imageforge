#!/usr/bin/env python3
# Builds public/pill-inject.html — the shared autoscroll pill as one
# self-contained snippet the SERVER appends to every served Compare page
# (chatfeed.js GET /api/chatfeed/page/:id). Compare pages are arbitrary
# chat-authored HTML that may not define the forge CSS variables.
#
# IT NO LONGER BAKES A PALETTE ONTO `.float` (Aug 2026, Sophie: "it's still
# the wrong pill"). It used to, plus a `prefers-color-scheme: dark` block —
# and because an element's own custom property beats one inherited from
# `:root`, a host could not colour the pill by defining the tokens; it had to
# out-specify with `body .float{…}`, which is exactly the ten hand-synced
# lines compare.css was carrying. PILL_CSS reads `var(--x, fallback)` now, so
# the host's `:root` wins by itself and a page with no tokens still gets the
# studio cream. Nothing to bake here any more.
# Re-run after changing scripts/pill.py.
import os
from pill import PILL_CSS, PILL_HTML, PILL_JS

snippet = ("\n<!-- injected by the server: shared autoscroll pill (scripts/gen-pill-inject.py) -->\n"
           + "<style>" + PILL_CSS + "</style>\n"
           + PILL_HTML + "\n"
           + "<script>\n" + PILL_JS + "\n</script>\n")

out = os.path.join(os.path.dirname(__file__), '..', 'public', 'pill-inject.html')
open(out, 'w', encoding='utf-8').write(snippet)
print('built public/pill-inject.html', len(snippet), 'bytes')
