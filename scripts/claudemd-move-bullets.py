#!/usr/bin/env python3
"""Move individual top-level bullets out of one `## ` section of CLAUDE.md.

The sibling of `claudemd-move.py`, for the case where a section is a mix of
"what every chat must DO" (stays in CLAUDE.md) and "how this app is BUILT"
(belongs in docs/). The Chats app section was 1,960 lines of exactly that mix.

A top-level bullet is a line starting with "- " at column 0; it runs until the
next such line or the end of the section. Bullets are matched by a unique
prefix of their first line, and moved verbatim — nothing is rewritten.

Usage: python3 scripts/claudemd-move-bullets.py plan.json [--dry-run]

plan.json = {
  "section": "## Exact heading",
  "doc": "docs/foo.md",
  "title": "...", "intro": "...",
  "move": ["- **PREFIX of the bullet's first line", ...],
  "pointer": "- optional replacement bullet appended where the block was"
}
"""
import json
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
MD = ROOT / "CLAUDE.md"


def main():
    plan = json.loads(pathlib.Path(sys.argv[1]).read_text())
    dry = "--dry-run" in sys.argv
    lines = MD.read_text().splitlines(keepends=True)

    start = next(i for i, l in enumerate(lines) if l.rstrip("\n") == plan["section"])
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")),
               len(lines))

    # Carve the section into blocks: the heading/preamble, then one per bullet.
    # `###` starts a block too — otherwise a sub-heading written AFTER a bullet
    # attaches to that bullet and is silently carried off when it moves. That
    # really happened: a pointer heading ended up inside docs/compare-pages.md.
    blocks, cur = [], [lines[start]]
    for l in lines[start + 1:end]:
        if l.startswith("- ") or l.startswith("### "):
            blocks.append(cur)
            cur = [l]
        else:
            cur.append(l)
    blocks.append(cur)

    moved, kept, unmatched = [], [], list(plan["move"])
    for b in blocks:
        head = b[0]
        hit = next((p for p in plan["move"] if head.startswith(p)), None)
        if hit and head.startswith("- "):
            moved.append("".join(b))
            if hit in unmatched:
                unmatched.remove(hit)
        else:
            kept.append("".join(b))

    if unmatched:
        sys.exit("BULLETS NOT FOUND:\n  " + "\n  ".join(unmatched))

    doc = ROOT / plan["doc"]
    body = (f"# {plan['title']}\n\n{plan['intro'].strip()}\n\n"
            "*(Moved out of `CLAUDE.md` Aug 2026 — see the pointers there. "
            "Nothing was rewritten; this is the text as it stood.)*\n\n"
            + "\n".join(x.rstrip("\n") + "\n" for x in moved))

    new_section = "".join(kept)
    if plan.get("pointer"):
        new_section = new_section.rstrip("\n") + "\n" + plan["pointer"].rstrip("\n") + "\n"

    out = "".join(lines[:start]) + new_section + "".join(lines[end:])

    if not dry:
        doc.parent.mkdir(parents=True, exist_ok=True)
        doc.write_text(body)
        MD.write_text(out)
    print(f"moved {len(moved)} bullets ({len(body)} bytes) -> {plan['doc']}")
    print(f"section {end - start} -> {len(new_section.splitlines())} lines")


if __name__ == "__main__":
    main()
