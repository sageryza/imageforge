// UNIVERSAL LINKS — an ordinary https://imageforge-q125.onrender.com/… link,
// tapped anywhere on Sophie's phone, opens the iOS Deck Factory app on that
// tool instead of Safari (Aug 2026, her ask: "is there anyway to do links that
// go directly and open in my actual iOS Deck Factory app?").
//
// The `deckfactory://` scheme has always existed and still works, but a custom
// scheme is only tappable where something treats it as a link — it renders as
// plain text in most of the places she actually reads. An https link is
// tappable everywhere, which is the whole point of this file.
//
// HOW IT WORKS: iOS fetches /.well-known/apple-app-site-association from this
// host (through Apple's CDN, once, at install/update) and remembers which
// paths belong to the app. Three things Apple requires and are easy to get
// wrong, all pinned by scripts/test-applinks.js:
//   1. Content-Type MUST be application/json. No .json extension on the file.
//   2. It MUST be served with NO redirect and NO auth — so this router mounts
//      ABOVE the studio gate in server.js, and above dream-host.
//   3. The appID is <TeamID>.<bundle id>, not the bundle id alone.
//
// THE PATH LIST IS THE CONTRACT WITH THE APP. Apple only hands the app a URL
// whose path is claimed here, and the app only knows what to do with a path in
// its own map (ios/ImageForge/ForgeLinks.swift). The two are kept identical by
// scripts/test-applinks.js, which parses the Swift file — the same
// pinned-tables pattern PL_GPT_STYLES/STYLES/PORT_STYLES already follows.
// A path claimed here but unknown to the app opens the app on nothing; a path
// the app knows but nobody claims never reaches it. Add to BOTH.
//
// DELIBERATELY NOT CLAIMED: the public pages (/witch, /selfcare, /dreamfeed,
// /fruit), the out-of-the-way ones (/desktop), and /instagram — that path is
// the Instagram MOCKUPS page, while the app's `instagram` tool is a different
// thing entirely, so claiming it would open the wrong screen. Anything not
// claimed keeps opening in Safari exactly as it does today.

const express = require('express');

// From .github/workflows/ios-testflight.yml (APPLE_TEAM_ID) and
// ios/project.yml (PRODUCT_BUNDLE_IDENTIFIER). Neither is a secret — a Team ID
// is public in every app's receipt.
const TEAM_ID = '5XR23N2CBH';
const BUNDLE_ID = 'com.sageryza.imageforge';
const APP_ID = `${TEAM_ID}.${BUNDLE_ID}`;

// path on this server → the app's deep-link destination (a Tool raw value, or
// `home`/`gallery`). The two sides differ in a few places on purpose — the
// Cutting Room's page is /cuttingroom and its tool is `cutroom`, the Story
// Room's page is /storyroom and its tool is `story` — which is exactly why the
// map exists rather than a string match.
const LINKS = [
  ['/', 'home'],
  ['/chats', 'chats'],
  ['/gallery', 'gallery'],
  ['/playground', 'playground'],
  ['/panels', 'panels'],
  ['/freeform', 'freeform'],
  ['/vector', 'vector'],
  ['/test', 'test'],
  ['/review', 'review'],
  ['/timeline', 'timeline'],
  ['/storyroom', 'story'],
  ['/scratchpad', 'scratchpad'],
  ['/writing', 'writing'],
  ['/editor', 'editor'],
  ['/cuttingroom', 'cutroom'],
  ['/cutmarks', 'cutmarks'],
  ['/blocks', 'blocks'],
  ['/pausing', 'pausing'],
  ['/search', 'search'],
  ['/chunking', 'chunking'],
  ['/clips', 'chunking'],          // the alias the Chunking page also answers to
  ['/assembly', 'assembly'],
  ['/filmeditor', 'filmeditor'],
  ['/dump', 'dump'],
  ['/blog', 'blog'],
  ['/studio', 'product'],
  ['/report', 'report'],
  ['/voice', 'voice'],
  ['/song', 'song'],
  ['/character', 'character'],
  ['/films', 'films'],
];

// A component with no "?" key matches ANY query string, which is what carries
// /chats?chat=<slug> and /chats?view=news through to the app. Exact paths, no
// trailing `*`: `/chats*` would also swallow a future /chatsomething.
function aasa() {
  return {
    applinks: {
      details: [{
        appIDs: [APP_ID],
        components: LINKS.map(([path]) => ({ '/': path })),
      }],
    },
  };
}

const router = express.Router();

// Apple's fetcher wants application/json and no redirect. `res.json` sets the
// type; the explicit `type` is belt-and-braces against a future default.
router.get('/apple-app-site-association', (req, res) => {
  res.type('application/json').send(JSON.stringify(aasa()));
});

module.exports = { router, aasa, LINKS, APP_ID, TEAM_ID, BUNDLE_ID };
