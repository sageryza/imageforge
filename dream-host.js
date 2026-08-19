// ─── "You were in my dreams" front door (youwereinmydreams.com) ─────────
// Sophie bought the domain (Hover, Aug 2026) for the dream feed she is
// sending to her friends, so on that host the dream app IS the site: `/`
// serves it and the studio it shares a server with stays out of sight.
//
// Kept apart from server.js's witch front door on purpose — that one carries
// a storefront's worth of legacy redirects, and this one is four rules that
// can be read and tested on their own (scripts/test-dream-host.js).
//
// Inert for every other host: imageforge-q125.onrender.com is unchanged, and
// /dreamfeed keeps working there exactly as it does today.
const HOSTS = new Set(['youwereinmydreams.com', 'www.youwereinmydreams.com']);

// req.hostname already drops the port, but a decide() caller may not have.
const isDreamHost = (host) => HOSTS.has(String(host || '').toLowerCase().split(':')[0]);

// The studio surfaces that happen to share this server. A friend who wanders
// into one is sent to the feed rather than shown Sophie's workshop — there is
// no secret here (the same pages answer on the onrender host), it is just not
// what this domain is for.
const STUDIO = ['/studio', '/photo', '/song', '/dreams', '/films', '/report', '/character', '/story',
  '/storyroom', '/wall', '/writing', '/chats', '/import', '/test', '/book', '/talking', '/gallery',
  '/set', '/stickers', '/editor', '/cuttingroom', '/blocks', '/pausing', '/chunking', '/clips',
  '/search', '/cutmarks', '/timeline', '/playground', '/freeform', '/vector', '/brief', '/review',
  '/dump', '/crystals', '/crystalsplit', '/voice', '/audio', '/blog', '/witch', '/selfcare'];

const ROBOTS = [
  'User-agent: *',
  'Disallow: /api/',
  'Disallow: /*.html$',
  'Disallow: /t/',
  ...STUDIO.map((p) => `Disallow: ${p}`),
].join('\n') + '\n';

// One decision, so the table is readable and testable without a server.
//   app      → the dream app itself
//   redirect → 301 to `to`
//   robots   → the robots.txt above
//   pass     → not ours: /api/*, fonts, images, everything static
function decide(path) {
  const p = String(path || '/').replace(/\/+$/, '') || '/';
  if (p === '/') return { kind: 'app' };
  // The canonical home on this host is `/`, so the studio's own URL for the
  // page folds into it rather than living at two addresses.
  if (p === '/dreamfeed') return { kind: 'redirect', to: '/' };
  // A dream-team invite (/t/<code>) is the app too — the page reads the code
  // from the path and joins after sign-in. Kept out of robots.txt above.
  if (/^\/t\/[^/]+$/.test(p)) return { kind: 'app' };
  if (p === '/robots.txt') return { kind: 'robots' };
  if (STUDIO.includes(p)) return { kind: 'redirect', to: '/' };
  return { kind: 'pass' };
}

function middleware(root) {
  return function dreamFrontDoor(req, res, next) {
    if (!isDreamHost(req.hostname)) return next();
    const d = decide(req.path);
    const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    if (d.kind === 'app') {
      // The app changes under her; a cached shell is how a friend ends up
      // reading last week's build.
      res.set('Cache-Control', 'no-cache, must-revalidate');
      return res.sendFile(root + '/public/dreamapp.html');
    }
    if (d.kind === 'redirect') return res.redirect(301, d.to + qs);
    if (d.kind === 'robots') return res.type('text/plain').send(ROBOTS);
    return next();
  };
}

module.exports = { HOSTS, STUDIO, ROBOTS, isDreamHost, decide, middleware };
