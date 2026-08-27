/**
 * PUBLIC ASSETS FOR A STUB TEST SERVER.
 *
 * Every headless harness in here runs its own tiny http server that answers a
 * few stub API routes and serves the page under test for everything else. Each
 * one had also grown a hand-written branch per SHARED file the page links —
 * `/tritoggle.css`, `/tritoggle.js`, `/playground-port.js` — and a harness that
 * forgot one did not fail loudly: the toggle collapsed to a 4px sliver, or the
 * aim rule silently fell back to the old cycle.
 *
 * 2026-08-26 made that a real problem rather than a tidy one: the Playground
 * and Panels now share /feedkit.js, and a page whose kit 404s throws on its
 * first line, so TWENTY harnesses would each have needed the same new branch
 * and every one of them would have timed out until it got it.
 *
 * So: one call at the top of the request handler answers anything the page
 * links out of `public/` — the same thing express.static does in production —
 * and the next shared file needs no harness change at all.
 *
 *   const servePublic = require('./lib/public-asset');
 *   const server = http.createServer((req, res) => {
 *     if (servePublic(req, res)) return;
 *     … the stub's own routes …
 *   });
 *
 * Only `.js` and `.css` are served, and only when the file really exists, so a
 * harness that deliberately serves a doctored page keeps doing exactly that.
 *
 * AND THE SHARED FILES AT THE REPO ROOT TOO (2026-08-27). A handful of modules
 * are loaded by the SERVER and served to the page as the same file — the
 * `pause-plan.js` pattern — so they live at the root rather than in `public/`
 * and `express.static` never sees them: server.js routes each one by hand.
 * They were therefore the one kind of shared file this helper still 404'd, and
 * `/pad-characters.js` really was 404ing in every Playground harness. The
 * failure is the quiet one this file exists to end: the page guards the global
 * it could not load, so the harness renders a page missing that behaviour and
 * passes.
 *
 * The list is DERIVED from server.js's own routes rather than typed here, so
 * the next root-level shared file needs no harness change either — which is
 * the whole promise above.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css' };

// `app.get('/pause-plan.js', … res.sendFile(__dirname + '/pause-plan.js'))`
// → the set of root-level files the real server hands to a page. Read once;
// an unreadable server.js just leaves the set empty (the old behaviour).
const ROOT_SHARED = (() => {
  const set = new Set();
  try {
    const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const re = /res\.sendFile\(__dirname \+ '\/([\w.-]+\.js)'\)/g;
    let m;
    while ((m = re.exec(src))) set.add(m[1]);
  } catch (e) { /* no server.js in reach — public/ only, as before */ }
  return set;
})();

module.exports = function servePublic(req, res) {
  let pathname;
  try { pathname = new URL(req.url, 'http://x').pathname; } catch (e) { return false; }
  const ext = path.extname(pathname);
  if (!TYPES[ext]) return false;
  // No traversal: resolve and check it really landed inside public/.
  let file = path.resolve(PUBLIC, '.' + pathname);
  if (!file.startsWith(PUBLIC + path.sep)) return false;
  if (!fs.existsSync(file)) {
    // A root-level shared file the real server routes by hand. Matched by
    // BASENAME against that derived set, never by joining the url to ROOT —
    // this must not become a way to read anything else out of the repo.
    const base = path.basename(pathname);
    if (path.dirname(pathname) !== '/' || !ROOT_SHARED.has(base)) return false;
    file = path.join(ROOT, base);
    if (!fs.existsSync(file)) return false;
  }
  res.writeHead(200, { 'Content-Type': TYPES[ext] });
  res.end(fs.readFileSync(file));
  return true;
};
