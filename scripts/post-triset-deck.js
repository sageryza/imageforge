#!/usr/bin/env node
/* The TINDER version of the versions comparison (2026-08-31, Sophie:
   "tinder version"). Posts the SAME 161 subjects as a stock template page —
   a LIST, not HTML, so the structure is the server's — with `start:'swipe'`
   so it opens on the deck: one card per subject, its generations side by
   side (a group of 2+ IS a spread, and a spread is one swipe card), her
   ✕ · ? · ♥ marking the SUBJECT, and each picture opening the shared Assets
   lightbox. The COMPARE half of the same page is the scrolling wall, one
   hairline tap away — one page, two views, one verdict doc.
   Run gen-triset-compare-data.js first. Env: FORGE_BASE, session id. */
const fs = require('fs');
const groups = JSON.parse(fs.readFileSync('/tmp/tricards.json', 'utf8'));
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.argv[2] || 'triset-multilevel-patterns';
const SESSION = (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, '');
const TITLE = process.argv[3] || 'Triset — swipe the versions v1';

// thumbs in the card, the ORIGINAL behind the lightbox (`full`): a quality
// comparison zoomed on a thumb would be a lie
const thumb = (u) => '/api/story/thumb?w=640&url=' + encodeURIComponent(u);
const data = {
  aspect: 'square',
  groups: groups.map((g) => ({
    label: g.title,
    items: g.versions.map((v, i) => {
      let tag = v.quality || '?';
      if (i > 0 && v.promptContent && v.promptContent !== g.versions[0].promptContent) tag += ' · new prompt';
      else if (g.versions.slice(0, i).some((p) => p.quality === v.quality)) tag += ' · redo';
      return { label: tag, img: thumb(v.url), full: v.url, url: v.url,
        model: 'gpt-image-2', quality: v.quality || '',
        promptStyle: v.promptStyle || '', promptContent: v.promptContent || '' };
    }),
  })),
  start: 'swipe',
  help: 'Every Triset subject drawn more than once. One card per subject, its '
    + 'generations side by side — oldest left, newest right, the tag says the quality. '
    + 'Tap a picture for the full-res original with its prompt and notes; swipe or tap '
    + 'the card edges to move on. ✕ · ? · ♥ mark the subject. '
    + 'COMPARE at the top is the same cards as a scrolling wall.',
};

(async () => {
  const r = await fetch(BASE + '/api/chatfeed/page', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, session: SESSION, title: TITLE, template: 'grid', data }),
  }).then((x) => x.json());
  console.log(JSON.stringify({ id: r.id, sheet: r.sheet, error: r.error, warnings: r.warnings }));
})();
