#!/usr/bin/env node
/*
 * gen-doc-read.js — turn one of the docs/ markdown files into a READABLE
 * Compare page: flowing paragraphs instead of hard-wrapped bullets, with an
 * optional range highlighted as new.
 *
 * WHY: these docs are written to be read in a terminal — 80-column hard
 * wraps, nested bullets, bold lead-ins. On a phone that is a wall of text.
 * Sophie asked (2026-08-21) to read `docs/image-pipeline.md` "in a way I can
 * read it (paragraphs)" with the day's addition marked, and the same will be
 * true of the next doc she wants to read.
 *
 * The page is a READ-THROUGH: no pictures, so the "nothing to read before the
 * first picture" rule does not apply — here the words ARE the work. Everything
 * else about a Compare page still does: the shell's CSS, the injected pill,
 * the script in an IIFE, the explanation behind the "?".
 *
 * USAGE
 *   node scripts/gen-doc-read.js docs/image-pipeline.md \
 *     --title "The image pipeline" \
 *     --new-from "WRITE IT SHORT" --new-to "And the consequence" \
 *     --chat <slug> --post
 *
 * Without --post it prints the HTML to stdout and nothing else, so a chat can
 * eyeball it before it goes in her tab. ENV: FORGE_BASE.
 */
'use strict';
const fs = require('fs');

const BASE = (process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com').replace(/\/$/, '');
const argv = process.argv.slice(2);
const file = argv.find(a => !a.startsWith('--') && a.endsWith('.md'));
const opt = (n) => { const i = argv.indexOf('--' + n); return i < 0 ? '' : argv[i + 1]; };
const has = (n) => argv.includes('--' + n);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Inline markdown to html. Code is lifted out FIRST, so ** inside a code
 *  span stays literal — these docs are full of `set({field: <delete>})`. */
function inline(s) {
  const code = [];
  let t = s.replace(/`([^`]+)`/g, (_m, c) => 'XCODEX' + (code.push(c) - 1) + 'XENDX');
  t = esc(t)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');
  return t.replace(/XCODEX(\d+)XENDX/g, (_m, i) => '<code>' + esc(code[+i]) + '</code>');
}

/* The parse: BLOCKS, not lines. A bullet plus its continuation lines is ONE
 * paragraph, a nested bullet is its own paragraph one step in, and anything
 * else is a plain paragraph. That is the whole transform — the hard wraps go
 * away and the bold lead-ins become the sentence openers they already read as. */
function parse(md) {
  const out = [];
  let buf = null;
  const flush = () => { if (buf && buf.text.trim()) out.push(buf); buf = null; };
  for (const raw of md.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flush(); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flush(); out.push({ kind: 'h', level: h[1].length, text: h[2] }); continue; }
    const b = /^(\s*)[-*]\s+(.*)$/.exec(line);
    if (b) { flush(); buf = { kind: 'p', depth: Math.min(2, Math.round(b[1].length / 2)), text: b[2] }; continue; }
    if (buf) { buf.text += ' ' + line.trim(); continue; }
    buf = { kind: 'p', depth: 0, text: line.trim() };
  }
  flush();
  return out;
}

/** The highlight is a RANGE between two substrings, not a line count — a doc
 *  shifts under you the moment anyone edits it above your addition. */
function render(blocks, from, to) {
  let on = false, started = false;
  const parts = [];
  for (const b of blocks) {
    if (from && !started && b.text.includes(from)) { on = true; started = true; }
    else if (on && to && b.text.includes(to)) on = false;
    const cls = on ? ' class="new"' : '';
    if (b.kind === 'h') {
      if (b.level === 1) continue;                    // the page's own h1 says it
      const t = Math.min(3, b.level);
      parts.push('<h' + t + cls + '>' + inline(b.text) + '</h' + t + '>');
    } else {
      const d = b.depth ? ' data-d="' + b.depth + '"' : '';
      parts.push('<p' + cls + d + '>' + inline(b.text) + '</p>');
    }
  }
  return parts.join('\n  ');
}

const CSS = [
  '.doc { padding-bottom: 44px; }',
  '.doc h2 { font-size: 21px; margin: 32px 0 10px; padding-right: 64px; }',
  '.doc h3 { font-size: 18px; margin: 24px 0 8px; padding-right: 64px; }',
  '.doc p { font-size: 16px; line-height: 1.62; margin: 0 0 14px; }',
  '.doc p[data-d="1"] { margin-left: 15px; }',
  '.doc p[data-d="2"] { margin-left: 30px; }',
  '.doc code { font-size: 14px; background: #f1ebdd; padding: 1px 4px; border-radius: 4px; }',
  '.doc .new { background: #fdf3d6; border-left: 3px solid var(--gold); padding: 9px 12px; margin-left: 0; }',
  '.doc .new + .new { margin-top: -10px; }',
  '.key { display: inline-block; font-size: 13px; color: var(--ink2); border: 1px solid #e6d9b8;',
  '       background: #fdf3d6; border-radius: 6px; padding: 3px 9px; margin: 2px 0 20px; }',
].join('\n  ');

function page(title, body, source) {
  return [
    '<!doctype html>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<title>' + esc(title) + '</title>',
    '<link rel="stylesheet" href="/compare.css">',
    '<style>\n  ' + CSS + '\n</style>',
    '<div class="wrap doc">',
    '  <h1>' + esc(title) + '</h1>',
    '  <span class="key">the highlighted part is new</span>',
    '  ' + body,
    '</div>',
    '<script src="/compare.js"></script>',
    '<script>',
    '(function () {',
    "  window.__compareHelp({ html: '<b>" + esc(source) + "</b>, reflowed into paragraphs — "
      + "the same words, without the terminal wrapping. The highlighted block is what was "
      + "added today; everything else is as it stood.' });",
    '})();',
    '</script>',
  ].join('\n');
}

async function main() {
  if (!file) {
    console.error('usage: gen-doc-read.js <doc.md> --title "…" [--new-from x --new-to y] [--chat <slug> --post]');
    process.exit(1);
  }
  const title = opt('title') || file;
  const html = page(title, render(parse(fs.readFileSync(file, 'utf8')), opt('new-from'), opt('new-to')), file);
  if (!has('post')) { process.stdout.write(html); return; }
  const r = await fetch(BASE + '/api/chatfeed/page', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat: opt('chat'), session: (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, ''), title, html }),
  });
  console.log(JSON.stringify(await r.json(), null, 2));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
