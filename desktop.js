// desktop.js — the DESKTOP QUEUE, read-only.
//
// Sophie is almost never at her desktop, so anything that can only run on her
// Mac gets written into `docs/desktop-tasks.md` instead of asked for (the rule
// lives in CLAUDE.md). That file is the queue, and it is the right home for it:
// the terminal chat on her Mac already works out of `~/imageforge`, and a task
// is exact copy-pasteable commands, which belong in a file rather than in a
// Firestore text field.
//
// But she can't read a markdown file on her phone, so she asked to SEE what is
// queued and what has been checked off. This is that view and nothing more:
// the page at /desktop renders what this route parses, and this route parses
// THE SAME FILE the terminal chat runs from. There is deliberately no second
// copy of the queue anywhere — a database of tasks beside the file would drift
// from it the first time a chat appended without knowing about the database.
//
// WHERE THE FILE IS READ FROM, and why it is not simply the one on disk: the
// server's checkout only updates when Render redeploys, so a task queued two
// minutes ago would be invisible for the length of a build. GitHub's raw copy
// of a PUBLIC repo is current the moment the chat pushes, so that is asked
// first (60s cache, 4s timeout) and the local file is the fallback — which
// also means the page still works when GitHub is unreachable. `source` says
// which one answered.

const fs = require('fs');
const path = require('path');
const express = require('express');
const { parseTasks, section } = require('./desktop-parse');
const router = express.Router();

const RAW = 'https://raw.githubusercontent.com/sageryza/imageforge/main/docs/desktop-tasks.md';
const LOCAL = path.join(__dirname, 'docs', 'desktop-tasks.md');
const TTL_MS = 60 * 1000;

let cache = null;      // { md, source, at }

async function readQueue() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(RAW, { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (r.ok) {
      const md = await r.text();
      if (md.includes('## OPEN')) {
        cache = { md, source: 'github', at: Date.now() };
        return cache;
      }
    }
  } catch (e) { /* fall through to the checkout on disk */ }
  const md = fs.readFileSync(LOCAL, 'utf8');
  cache = { md, source: 'local', at: Date.now() };
  return cache;
}

router.get('/tasks', async (req, res) => {
  try {
    const { md, source, at } = await readQueue();
    res.json({
      ok: true,
      source,
      readAt: at,
      open: parseTasks(section(md, 'OPEN')),
      done: parseTasks(section(md, 'DONE')),
      file: 'https://github.com/sageryza/imageforge/blob/main/docs/desktop-tasks.md',
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
});

module.exports = { router };
