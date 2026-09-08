#!/usr/bin/env node
// A BLOCK POSTED FROM A FILE (2026-09-08, scripts/chat-block.js). Pure: the
// quote holds a blank line as a bare `>` so the block stays ONE block; the
// key the script prints is the PAGE's own tickKey over the same words (the
// page's function is EXTRACTED out of chats.html, never retyped — the two
// drift, the edit she makes is filed under a key the script cannot find); a
// file over the edit cap is refused; and `read` hands back her edit over the
// original. Then the post driven against a stub, asserting on what the stub
// really received.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const { execFile } = require('child_process');
const run = (args, env) => new Promise((resolve) => execFile('node', [path.join(__dirname, 'chat-block.js')].concat(args), { env: Object.assign({}, process.env, env) }, (err, stdout, stderr) => resolve({ code: err ? err.code : 0, stdout: String(stdout), stderr: String(stderr) })));
const cb = require('./chat-block');

const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'chats.html'), 'utf8');
const m = page.match(/function tickKey\(html\)\{[\s\S]*?\n\}/);
assert(m, 'tickKey not found in chats.html');
const ctx = {}; vm.runInNewContext(m[0] + '; out = tickKey;', ctx);
const pageKey = ctx.out;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const scene = 'Sophie is the woman in [Video1].\n\nShe walks the hall & says "no".\n\nIt\'s night.';
const q = cb.quote(scene);
assert.strictEqual(q, '> Sophie is the woman in [Video1].\n>\n> She walks the hall & says "no".\n>\n> It\'s night.');
assert.strictEqual(cb.unquote(q), scene, 'round trip');
assert.strictEqual(cb.tickKey(scene), pageKey(esc(scene)), 'the script key is the page key over the same words');
assert.strictEqual(cb.tickKey('a & b'), pageKey(esc('a & b')), 'an entity counts as one space on both sides');
console.log('ok - quote holds one block and the key is the page\'s own');

const key = cb.tickKey(scene);
const blocks = cb.blocksOf({ id: 'm1', text: 'Lead line\n\n' + q + '\n\ntrailing words', blockedits: { [key]: { text: 'her version', at: 't1' } } });
assert.deepStrictEqual(blocks.map((b) => [b.key, b.text, b.edited]), [[key, 'her version', true]]);
assert.deepStrictEqual(cb.blocksOf({ id: 'm2', text: q }).map((b) => [b.text, b.edited]), [[scene, false]]);
console.log('ok - read hands back her edit over the original');

// the post, against a stub
const posts = [];
const server = http.createServer((req, res) => {
  let b = ''; req.on('data', (d) => b += d); req.on('end', () => {
    posts.push({ path: req.url, body: JSON.parse(b || '{}') });
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, id: 'newid', chat: 'belt-x' }));
  });
});
server.listen(0, async () => {
  const base = 'http://127.0.0.1:' + server.address().port;
  const tmp = path.join(require('os').tmpdir(), 'chat-block-test.txt'); fs.writeFileSync(tmp, scene + '\n');
  const r1 = await run(['post', '--chat', 'belt-x', '--session', 'sid1', '--file', tmp, '--lead', 'The door scene, from the repo:'], { FORGE_BASE: base });
  assert.strictEqual(r1.code, 0, r1.stderr);
  const ans = JSON.parse(r1.stdout);
  assert.strictEqual(ans.key, key); assert.strictEqual(ans.id, 'newid'); assert.strictEqual(ans.chars, scene.length);
  assert.strictEqual(posts.length, 1); assert.strictEqual(posts[0].path, '/api/chatfeed');
  assert.deepStrictEqual(posts[0].body, { chat: 'belt-x', session: 'sid1', text: 'The door scene, from the repo:\n\n' + q, tldr: 'The door scene, from the repo:' });
  console.log('ok - post sends the quoted file verbatim under the chat and session, and prints the key');
  const big = path.join(require('os').tmpdir(), 'chat-block-big.txt'); fs.writeFileSync(big, 'x'.repeat(cb.EDIT_MAX + 1));
  const r2 = await run(['post', '--chat', 'belt-x', '--file', big], { FORGE_BASE: base });
  assert.strictEqual(r2.code, 3, r2.stderr); assert.strictEqual(posts.length, 1, 'nothing posted over the cap');
  console.log('ok - a file over the edit cap is refused before anything is posted');
  server.close();
});
