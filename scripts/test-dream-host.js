#!/usr/bin/env node
// The youwereinmydreams.com front door: the decision table pure, then the real
// middleware mounted in a real express app and driven over HTTP by Host header.
// No network, no keys — it never boots server.js.
//
//   node scripts/test-dream-host.js
const http = require('http');
const express = require('express');
const path = require('path');
const door = require(path.join(__dirname, '..', 'dream-host'));

const fails = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

// ── the host itself ──
check('the apex is ours', door.isDreamHost('youwereinmydreams.com'));
check('www is ours', door.isDreamHost('www.youwereinmydreams.com'));
check('a port does not confuse it', door.isDreamHost('youwereinmydreams.com:10000'));
check('the studio host is NOT ours', !door.isDreamHost('imageforge-q125.onrender.com'));
check('nor the witch domain', !door.isDreamHost('secretlyawitch.com'));
check('nor a lookalike', !door.isDreamHost('youwereinmydreams.com.evil.net'));

// ── the decision table ──
const kind = (p) => door.decide(p).kind;
check('/ serves the app', kind('/') === 'app');
check('a trailing slash is the same page', kind('//') === 'app');
check('/dreamfeed folds into /', JSON.stringify(door.decide('/dreamfeed')) === '{"kind":"redirect","to":"/"}');
check('/robots.txt is served', kind('/robots.txt') === 'robots');
check('a studio page goes to the feed', kind('/chats') === 'redirect' && kind('/editor') === 'redirect');
check('the API passes through untouched', kind('/api/dreamapp/feed') === 'pass');
check('so do the fonts and pictures', kind('/fonts/baveuse.woff') === 'pass' && kind('/dream-sunflowers.png') === 'pass');
check('robots keeps the API and the studio out', /Disallow: \/api\//.test(door.ROBOTS) && /Disallow: \/chats/.test(door.ROBOTS));

// ── the middleware, over real HTTP ──
const app = express();
app.use(door.middleware(path.join(__dirname, '..')));
app.use(express.static(path.join(__dirname, '..', 'public')));
// server.js serves public/index.html at `/` on every other host; express.static
// answers it here the same way, which is what the studio check reads.

const get = (port, p, host) => new Promise((resolve) => {
  http.get({ port, path: p, headers: { Host: host } }, (res) => {
    let b = ''; res.on('data', (c) => { b += c; });
    res.on('end', () => resolve({ code: res.statusCode, loc: res.headers.location, cache: res.headers['cache-control'], body: b }));
  });
});

const server = app.listen(0, async () => {
  const port = server.address().port;
  const DOM = 'youwereinmydreams.com';

  const home = await get(port, '/', DOM);
  check('on the domain, / is the dream app', home.code === 200 && /<title>dreams<\/title>/.test(home.body),
    `${home.code}, ${home.body.length} bytes`);
  check('and it is not cached', /no-cache/.test(home.cache || ''), home.cache);

  const studioHome = await get(port, '/', 'imageforge-q125.onrender.com');
  check('on the studio host, / is still the studio hub',
    studioHome.code === 200 && !/<title>dreams<\/title>/.test(studioHome.body) && /Deck Factory|forge\.css/i.test(studioHome.body),
    `${studioHome.code}, ${studioHome.body.length} bytes`);

  const feed = await get(port, '/dreamfeed?x=1', DOM);
  check('/dreamfeed 301s home, query kept', feed.code === 301 && feed.loc === '/?x=1', `${feed.code} ${feed.loc}`);

  const chats = await get(port, '/chats', DOM);
  check('a studio page 301s home', chats.code === 301 && chats.loc === '/', `${chats.code} ${chats.loc}`);

  // The same path on the studio host is left entirely alone — it falls through
  // to whatever server.js mounts there (a 404 in this cut-down app, which is
  // exactly the point: the door did not touch it).
  const chatsElsewhere = await get(port, '/chats', 'imageforge-q125.onrender.com');
  check('but not on the studio host', chatsElsewhere.code !== 301, String(chatsElsewhere.code));

  const rob = await get(port, '/robots.txt', DOM);
  check('robots.txt answers on the domain', rob.code === 200 && /User-agent/.test(rob.body));

  const px = await get(port, '/dream-sunflowers.png', DOM);
  check('the app\'s own pictures still serve', px.code === 200, String(px.code));

  server.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
  process.exit(fails.length ? 1 : 0);
});
