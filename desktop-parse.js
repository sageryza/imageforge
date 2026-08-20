// desktop-parse.js — the DESKTOP QUEUE's pure half: turning
// `docs/desktop-tasks.md` into task blocks the page can render.
//
// It lives apart from desktop.js for one reason: NOTHING IN HERE NEEDS A
// DEPENDENCY, so scripts/test-desktop-queue.js drives the real parser in any
// checkout, with no express installed. desktop.js re-exports it.
//
// The file it reads is the SAME one the terminal chat runs from — see
// desktop.js's header for why there is no second copy of the queue.

// ── parsing ────────────────────────────────────────────────────────────────
// FORGIVING ON PURPOSE. The file carries a template, but a real entry always
// grows bullets the template never had ("Expect ~57, not 94", "If the curl
// 404s", a FAILED note added by the terminal chat) — those are the useful half,
// so nothing is dropped: the whole block rides along as `body` and the page
// renders it. Only the few fields worth putting on the closed row are picked
// out, and every one of them is optional.

function section(md, name) {
  const lines = md.split('\n');
  const start = lines.findIndex(l => l.trim() === '## ' + name);
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n');
}

function field(body, label) {
  // A field runs to the next top-level bullet or heading, so a wrapped value
  // (they nearly all wrap) is kept whole.
  // NO `m` flag, deliberately: under it `$` means end of LINE, which cut every
  // value at its first newline — and nearly every real one wraps. The line
  // anchor is (?:^|\n) instead, and the value runs to the next top-level
  // bullet, the next heading, or the rule that ends the section.
  const re = new RegExp('(?:^|\\n)- \\*\\*' + label + ':?\\*\\*:?\\s*([\\s\\S]*?)(?=\\n- \\*\\*|\\n#|\\n---|$)');
  const m = body.match(re);
  if (!m) return '';
  return m[1].replace(/\s+/g, ' ').trim();
}

function firstSentence(s, cap) {
  if (!s) return '';
  const cut = s.match(/^(.{20,}?[.;])\s/);
  const out = cut ? cut[1] : s;
  return out.length > cap ? out.slice(0, cap - 1).trimEnd() + '…' : out;
}

function parseTasks(sec) {
  const out = [];
  const re = /^### (.+)$/gm;
  const heads = [];
  let m;
  while ((m = re.exec(sec))) heads.push({ title: m[1].trim(), at: m.index, end: re.lastIndex });
  heads.forEach((h, i) => {
    const raw = sec.slice(h.end, i + 1 < heads.length ? heads[i + 1].at : sec.length);
    // Trim the horizontal rule that separates the file's sections.
    const body = raw.replace(/\n+---\s*$/, '').replace(/^\n+|\n+$/g, '');
    const q = body.match(/\*\*Queued:?\*\*:?\s*(\d{4}-\d{2}-\d{2})(?:\s*by\s+([^\n*]+))?/);
    // The terminal chat writes the outcome as its own bolded bullet. FAILED is
    // the one that has to reach the closed row: a task can sit in OPEN looking
    // untouched when it has actually been tried and is stuck waiting on her.
    const bad = body.match(/\*\*(FAILED|BLOCKED|NEEDS HER|PARTIAL)\b[^*]*?(\d{4}-\d{2}-\d{2})?\*\*/);
    const ran = body.match(/\*\*(?:DONE|RAN)\b[^*]*?(\d{4}-\d{2}-\d{2})\*\*/i);
    out.push({
      title: h.title,
      why: firstSentence(field(body, 'Why'), 150),
      needs: firstSentence(field(body, 'Needs from her'), 90),
      where: field(body, 'Where'),
      queued: q ? q[1] : '',
      by: q && q[2] ? q[2].trim() : '',
      flag: bad ? bad[1].toLowerCase() : '',
      ranAt: ran ? ran[1] : '',
      commands: (body.match(/```/g) || []).length >> 1,
      body,
    });
  });
  return out;
}

module.exports = { parseTasks, section, field, firstSentence };
