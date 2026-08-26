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
 */
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', '..', 'public');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css' };

module.exports = function servePublic(req, res) {
  let pathname;
  try { pathname = new URL(req.url, 'http://x').pathname; } catch (e) { return false; }
  const ext = path.extname(pathname);
  if (!TYPES[ext]) return false;
  // No traversal: resolve and check it really landed inside public/.
  const file = path.resolve(PUBLIC, '.' + pathname);
  if (!file.startsWith(PUBLIC + path.sep)) return false;
  if (!fs.existsSync(file)) return false;
  res.writeHead(200, { 'Content-Type': TYPES[ext] });
  res.end(fs.readFileSync(file));
  return true;
};
