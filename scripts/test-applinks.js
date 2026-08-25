#!/usr/bin/env node
// Universal links — the whole contract, pure, no network.
//
// The load-bearing check is the LAST one: the path list the site claims
// (applinks.js) and the path map the app understands (ForgeLinks.swift) live
// in two files that no compiler, linter or deploy ever compares. A path
// claimed but unknown opens the app on nothing; a path known but unclaimed
// never reaches it. Both failures are silent on her phone, so they are pinned
// here — the same pattern PL_GPT_STYLES/STYLES/PORT_STYLES already follows.

const fs = require('fs');
const path = require('path');
const applinks = require('../applinks');

let fail = 0;
const ok = (name, cond, extra) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond || extra === undefined ? '' : ` — ${extra}`}`);
  if (!cond) fail++;
};

// ---- the association file itself -------------------------------------------
const aasa = applinks.aasa();
const details = aasa.applinks && aasa.applinks.details;
ok('applinks.details is a non-empty array', Array.isArray(details) && details.length === 1);
const d = details[0];
ok('appID is <TeamID>.<bundle id>', d.appIDs.length === 1 && d.appIDs[0] === '5XR23N2CBH.com.sageryza.imageforge', d.appIDs[0]);
ok('every component is an exact path', d.components.every(c => typeof c['/'] === 'string' && !c['/'].includes('*')),
  JSON.stringify(d.components.filter(c => String(c['/']).includes('*'))));
ok('no component pins a query', d.components.every(c => c['?'] === undefined),
  'a "?" would stop /chats?chat=<slug> from reaching the app');
ok('it is JSON-serializable with no undefined', JSON.stringify(aasa).includes('"applinks"'));

// ---- the route -------------------------------------------------------------
// Apple's fetcher follows NO redirect and sends NO credentials, and refuses
// anything that is not application/json. Drive the real router.
const express = require('express');
const app = express();
app.use('/.well-known', applinks.router);
const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const res = await fetch(`${base}/.well-known/apple-app-site-association`, { redirect: 'manual' });
  ok('route answers 200', res.status === 200, `got ${res.status}`);
  ok('content-type is application/json',
    (res.headers.get('content-type') || '').startsWith('application/json'),
    res.headers.get('content-type'));
  const body = await res.json();
  ok('served body matches aasa()', JSON.stringify(body) === JSON.stringify(aasa));
  server.close();

  // ---- the two path lists ------------------------------------------------
  const swiftSrc = fs.readFileSync(
    path.join(__dirname, '..', 'ios', 'ImageForge', 'ForgeLinks.swift'), 'utf8');

  const block = swiftSrc.match(/static let map: \[String: String\] = \[([\s\S]*?)\n {4}\]/);
  ok('ForgeLinks.swift still declares `map`', !!block);
  const swiftMap = {};
  if (block) {
    for (const m of block[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)) swiftMap[m[1]] = m[2];
  }
  ok('the Swift map parsed', Object.keys(swiftMap).length > 5, `${Object.keys(swiftMap).length} entries`);

  const jsMap = Object.fromEntries(applinks.LINKS);
  const jsPaths = Object.keys(jsMap).sort();
  const swiftPaths = Object.keys(swiftMap).sort();
  ok('the site claims exactly the paths the app knows',
    JSON.stringify(jsPaths) === JSON.stringify(swiftPaths),
    `claimed-only ${jsPaths.filter(p => !swiftMap[p])} · app-only ${swiftPaths.filter(p => !jsMap[p])}`);
  const disagree = jsPaths.filter(p => swiftMap[p] && swiftMap[p] !== jsMap[p]);
  ok('both sides send each path to the same destination', disagree.length === 0,
    disagree.map(p => `${p}: js=${jsMap[p]} swift=${swiftMap[p]}`).join(', '));

  // ---- destinations the app can actually reach ---------------------------
  // `go()` in RootView answers home/gallery/business/crafts by hand and
  // everything else through Tool(rawValue:). A destination in neither list is
  // a link that opens the app and does nothing.
  const rootSrc = fs.readFileSync(
    path.join(__dirname, '..', 'ios', 'ImageForge', 'RootView.swift'), 'utf8');
  const enumLine = rootSrc.match(/enum Tool: String[\s\S]*?\n {4}case ([^\n]+)\n/);
  const tools = enumLine ? enumLine[1].split(',').map(s => s.trim()) : [];
  ok('the Tool enum parsed', tools.length > 20, `${tools.length} tools`);
  const byHand = ['home', 'gallery', 'business', 'crafts', 'quilt', ''];
  const dead = [...new Set(Object.values(jsMap))].filter(v => !tools.includes(v) && !byHand.includes(v));
  ok('every destination is a real Tool (or a hand-handled one)', dead.length === 0, dead.join(', '));

  // ---- the entitlement ---------------------------------------------------
  const ent = fs.readFileSync(
    path.join(__dirname, '..', 'ios', 'ImageForge', 'ImageForge.entitlements'), 'utf8');
  ok('Associated Domains names the studio host',
    /applinks:imageforge-q125\.onrender\.com/.test(ent));
  ok('the entitlement is NOT in developer mode',
    !/applinks:[^<]*\?mode=developer/.test(ent),
    'a shipped build must resolve through Apple\'s CDN');
  const swiftHost = (swiftSrc.match(/static let host = "([^"]+)"/) || [])[1];
  ok('ForgeLinks.host matches the entitlement', swiftHost === 'imageforge-q125.onrender.com', swiftHost);

  // ---- the custom scheme still works ------------------------------------
  ok('the deckfactory:// scheme is still registered',
    /<string>deckfactory<\/string>/.test(
      fs.readFileSync(path.join(__dirname, '..', 'ios', 'ImageForge', 'Info.plist'), 'utf8')),
    'the widget deep-links through it');
  ok('RootView listens for the browsing activity',
    /onContinueUserActivity\(NSUserActivityTypeBrowsingWeb\)/.test(rootSrc),
    'onOpenURL alone never sees a universal link');

  console.log(fail ? `\n${fail} failed` : '\nall passed');
  process.exit(fail ? 1 : 0);
});
