#!/usr/bin/env node
// A BLOCK IN THE THREAD THAT COST NO OUTPUT TOKENS (2026-09-08, Sophie:
// "could chats put an editable text block inserted into their chat, but NOT
// as output tokens" → "ok").
//
// The editable half already exists on the page: a run of `> ` lines in a
// message is ONE script block with a pencil (quoteBlocks in chats.html,
// 2026-09-07), her edit lives on the message doc under `blockedits[key]`
// (POST /api/chatfeed/blockedit, 4000 chars), and the block shows her words
// over the original. What did not exist was a way to put one there WITHOUT
// the model writing it: a scene from the repo, a prompt from a file, her own
// words back to her. This script reads a FILE and posts it — the bytes go
// from disk to the server and never through the model, so the block costs
// nothing to post and is verbatim by construction (nothing stands between
// the source and the output).
//
//   node scripts/chat-block.js post --chat <slug> --file scene.txt [--lead "one line above it"]
//   node scripts/chat-block.js read --chat <slug> [--id <msgId>] [--out file.txt]
//
// `post` answers the message id and the block's KEY (the page's own tickKey
// over the original words — pinned equal by the test) and refuses a file over
// the edit cap rather than posting a block she could not save whole. `read`
// prints every block in the thread with her edit where she made one — that is
// how a chat gets her version back (input tokens, the cheap direction).
//
// It is its own message in the thread, never inside the reply: the hook posts
// each turn's reply as one doc keyed by session+turn, and this is a separate
// doc, so a block sits as its own row (a run of the chat's messages merges
// into one row on the page, so it still reads in place). Posting through the
// ordinary feed route means the chat's registry row, `repliedAt` and the
// reply push gate all see it as the chat writing — which it is.
'use strict';
const fs = require('fs');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const EDIT_MAX = 4000; // POST /blockedit's own cap — a block over it cannot be saved whole

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const has = (n) => args.includes('--' + n);

// The page's own key over the block's ORIGINAL words (tickKey in chats.html —
// the test extracts that function and pins the two equal). The page hashes the
// HTML-escaped text with tags stripped and entities blanked; plain text has no
// tags, and `esc` only touches & < > " ' — each of which becomes ONE entity,
// i.e. one space here as there.
function tickKey(text) {
  const t = String(text).replace(/[&<>"']/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 200);
  let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36) + t.length.toString(36);
}
// One block = every line quoted; a blank line becomes a bare `>` so the run
// holds (a blank line would END the block, and the scene would split).
function quote(text) {
  const body = String(text).replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
  return body.split('\n').map((l) => (l.trim() === '' ? '>' : '> ' + l)).join('\n');
}
// The original words as the page reads them back out of the quote — what the
// key is taken over.
function unquote(quoted) {
  return String(quoted).split('\n').map((l) => l.replace(/^> ?/, '')).join('\n').replace(/^\n+|\n+$/g, '');
}
// A message's blocks: each run of `>` lines, with her edit where one is filed.
function blocksOf(msg) {
  const lines = String(msg.text || '').split('\n'), out = []; let i = 0;
  const edits = msg.blockedits || {};
  while (i < lines.length) {
    if (!/^>( |$)/.test(lines[i])) { i++; continue; }
    const q = []; while (i < lines.length && /^>( |$)/.test(lines[i])) { q.push(lines[i]); i++; }
    const orig = unquote(q.join('\n')), key = tickKey(orig), ed = edits[key];
    out.push({ id: msg.id, key, orig, text: ed && ed.text ? ed.text : orig, edited: !!(ed && ed.text), at: ed && ed.at ? ed.at : null });
  }
  return out;
}

async function call(url, opts) {
  const r = await fetch(url, Object.assign({ headers: { 'content-type': 'application/json' } }, opts || {}, opts && opts.body ? { body: JSON.stringify(opts.body) } : {}));
  let json = null; try { json = await r.json(); } catch (e) { /* not json */ }
  return { status: r.status, json };
}

async function main() {
  const chat = flag('chat') || process.env.FORGE_CHAT;
  const session = flag('session') || (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, '');
  if (cmd === 'post') {
    const file = flag('file');
    if (!chat || !file) { console.error('usage: chat-block.js post --chat <slug> --file <path> [--lead "…"]'); process.exit(2); }
    const raw = fs.readFileSync(file, 'utf8');
    const orig = unquote(quote(raw));
    if (orig.length > EDIT_MAX) {
      console.error(`refused: ${file} is ${orig.length} chars and a block she can edit holds ${EDIT_MAX}; split it, or post it as a Compare page`);
      process.exit(3);
    }
    const lead = flag('lead') ? String(flag('lead')).trim() : '';
    const text = (lead ? lead + '\n\n' : '') + quote(raw);
    const tldr = lead || orig.split('\n')[0].slice(0, 120);
    const { status, json } = await call(BASE + '/api/chatfeed', { method: 'POST', body: { chat, session, text, tldr } });
    if (status !== 200 || !json || !json.ok) { console.error('post failed', status, JSON.stringify(json)); process.exit(1); }
    console.log(JSON.stringify({ ok: true, id: json.id, chat: json.chat || chat, key: tickKey(orig), chars: orig.length }));
    return;
  }
  if (cmd === 'read') {
    if (!chat) { console.error('usage: chat-block.js read --chat <slug> [--id <msgId>] [--out file]'); process.exit(2); }
    const { status, json } = await call(BASE + '/api/chatfeed/thread?chat=' + encodeURIComponent(chat));
    if (status !== 200 || !json) { console.error('read failed', status); process.exit(1); }
    const id = flag('id');
    const blocks = (json.messages || []).filter((m) => !id || String(m.id) === id).flatMap(blocksOf);
    if (has('out') && blocks.length) { fs.writeFileSync(flag('out'), blocks[blocks.length - 1].text + '\n'); }
    if (has('json')) { console.log(JSON.stringify(blocks, null, 1)); return; }
    for (const b of blocks) {
      console.log(`=== ${b.id} · key ${b.key} · ${b.edited ? 'EDITED by her ' + b.at : 'unedited'} · ${b.text.length} chars`);
      console.log(b.text); console.log();
    }
    if (!blocks.length) console.log('no blocks in ' + chat);
    return;
  }
  console.error('usage: chat-block.js post|read …'); process.exit(2);
}

module.exports = { tickKey, quote, unquote, blocksOf, EDIT_MAX };
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
