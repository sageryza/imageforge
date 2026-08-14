#!/usr/bin/env python3
"""Move whole `## ` sections out of CLAUDE.md into a docs file, leaving a pointer.

Used for the Aug 2026 reorganisation: CLAUDE.md had grown to 5,383 lines, all of
it read at the start of every turn in every chat, with the rules that apply to
EVERY chat buried among per-module encyclopedias. Nothing is deleted — a section
moves verbatim into docs/ and a pointer takes its place.

Usage:  python3 scripts/claudemd-move.py plan.json [--dry-run]

plan.json = {
  "docs/modules/foo.md": {
    "title": "Foo tools",
    "intro": "One paragraph naming what lives here.",
    "sections": [
      {"heading": "## Exact heading line from CLAUDE.md",
       "pointer": "- **Name** — 4-10 lines that keep what a chat must know."}
    ]
  }
}

The pointer replaces the section; the section body is appended to the doc file
under its original heading. Byte accounting is printed so a move can be checked.
"""
import json
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
MD = ROOT / "CLAUDE.md"


def split_sections(text):
    """Return [(heading_or_None, body_including_heading), ...] in file order."""
    out, cur, head = [], [], None
    for line in text.splitlines(keepends=True):
        if line.startswith("## "):
            out.append((head, "".join(cur)))
            head, cur = line.rstrip("\n"), [line]
        else:
            cur.append(line)
    out.append((head, "".join(cur)))
    return out


def main():
    plan = json.loads(pathlib.Path(sys.argv[1]).read_text())
    dry = "--dry-run" in sys.argv

    text = MD.read_text()
    before = len(text)
    parts = split_sections(text)

    # heading -> (docfile, pointer)
    wanted = {}
    for docfile, spec in plan.items():
        for s in spec["sections"]:
            wanted[s["heading"]] = (docfile, s["pointer"])

    found = {}
    kept = []
    for head, body in parts:
        if head in wanted and head not in found:
            found[head] = body
            docfile, pointer = wanted[head]
            kept.append(pointer.rstrip("\n") + "\n")
        else:
            kept.append(body)

    missing = [h for h in wanted if h not in found]
    if missing:
        sys.exit("HEADINGS NOT FOUND:\n  " + "\n  ".join(missing))

    moved_bytes = 0
    for docfile, spec in plan.items():
        path = ROOT / docfile
        chunks = [f"# {spec['title']}\n\n{spec['intro'].strip()}\n\n"
                  "*(Moved out of `CLAUDE.md` Aug 2026 — see the pointer there. "
                  "Nothing was rewritten; this is the text as it stood.)*\n"]
        for s in spec["sections"]:
            body = found[s["heading"]]
            moved_bytes += len(body)
            chunks.append("\n" + body.rstrip("\n") + "\n")
        if not dry:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("".join(chunks))
        print(f"{docfile}: {len(spec['sections'])} sections")

    new = "".join(kept)
    if not dry:
        MD.write_text(new)
    print(f"\nCLAUDE.md {before} -> {len(new)} bytes "
          f"({before - len(new)} out, {moved_bytes} written to docs)")


if __name__ == "__main__":
    main()
