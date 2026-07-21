#!/usr/bin/env python3
# Builds public/pill-inject.html — the shared autoscroll pill as one
# self-contained snippet the SERVER appends to every served Compare page
# (chatfeed.js GET /api/chatfeed/page/:id). Compare pages are arbitrary
# chat-authored HTML that won't define the forge CSS variables, so the
# snippet scopes its own fallback palette onto .float (light + dark).
# Re-run after changing scripts/pill.py.
import os
from pill import PILL_CSS, PILL_HTML, PILL_JS

VARS = """
.float{--paper:#f6f2e9; --ink:#26221c; --ink2:#8a8377; --chg:#b3443f; --rose:#a5586a;}
@media (prefers-color-scheme: dark){.float{--paper:#191713; --ink:#e8e2d6; --ink2:#97907f; --chg:#e08b84; --rose:#c98a99;}}
"""

snippet = ("\n<!-- injected by the server: shared autoscroll pill (scripts/gen-pill-inject.py) -->\n"
           + "<style>" + VARS + PILL_CSS + "</style>\n"
           + PILL_HTML + "\n"
           + "<script>\n" + PILL_JS + "\n</script>\n")

out = os.path.join(os.path.dirname(__file__), '..', 'public', 'pill-inject.html')
open(out, 'w', encoding='utf-8').write(snippet)
print('built public/pill-inject.html', len(snippet), 'bytes')
