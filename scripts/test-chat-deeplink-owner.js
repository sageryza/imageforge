// The registry's `url` — the orange Open button — must always be the CHAT
// OWNER's session, never whichever session happened to post last.
// Found live 2026-09-08: severance-api-multiple-frames carried 872 messages
// from session 018fYFNh… and an Open link pointing at 01XwF5s…
const assert = require('assert');
const fs = require('fs');
const { keepsDeepLink } = require('../chatfeed.js');

let n = 0;
const ok = (cond, what) => { assert.ok(cond, what); n++; };

// an unclaimed chat takes the poster's link
ok(keepsDeepLink('', 'session_AAAAAAAAAA') === true, 'unowned chat takes the link');
ok(keepsDeepLink(undefined, 'AAAAAAAAAA') === true, 'missing owner takes the link');

// the owner keeps its own, both spellings
ok(keepsDeepLink('AAAAAAAAAA', 'AAAAAAAAAA') === true, 'owner writes its own link');
ok(keepsDeepLink('session_AAAAAAAAAA', 'AAAAAAAAAA') === true, 'prefixed owner matches bare poster');
ok(keepsDeepLink('AAAAAAAAAA', 'session_AAAAAAAAAA') === true, 'bare owner matches prefixed poster');

// THE BUG: a different session may not move an owned chat's link
ok(keepsDeepLink('018fYFNhV5YZUy11p3wtCgLe', '01XwF5sEs8h9uxC9Q4tA3Fwg') === false,
  'a stranger cannot overwrite the Open link');
// …nor may a post that names no session at all
ok(keepsDeepLink('AAAAAAAAAA', '') === false, 'a sessionless post cannot move an owned link');
ok(keepsDeepLink('AAAAAAAAAA', undefined) === false, 'undefined poster cannot move an owned link');

// SOURCE PIN: the route must not assign reg.url outside the guard.
const src = fs.readFileSync(require.resolve('../chatfeed.js'), 'utf8');
const writes = src.match(/reg\.url\s*=/g) || [];
ok(writes.length === 1, `exactly one reg.url write (found ${writes.length})`);
ok(/keepsDeepLink\(mine\.sessionId, skey\)\)\s*reg\.url = doc\.url;/.test(src),
  'the one reg.url write is behind keepsDeepLink');

console.log(`test-chat-deeplink-owner: ${n} checks passed`);
