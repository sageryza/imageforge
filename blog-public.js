// blog-public.js — the PUBLIC blog served on secretlyawitch.com/blog.
//
// When the apex domain moved from the Shopify storefront to the witch app,
// the Shopify blog (Blog Studio's old destination) lost its home — this module
// is the replacement. Posts are the same Firestore `forge-blog` docs the Blog
// Studio already saves; publishing to the site just flags a doc (`site: true`,
// via POST /api/blog/publish-site in blog.js) and this module server-renders
// it at /blog and /blog/<slug> in the witch app's warm-cream look.
//
// IMPORTANT: unlike blog.js, this module reads NO env keys at require time,
// so server.js can safely require it at boot (before the Firestore config
// loader hydrates process.env). Everything env-ish is read per request.

const admin = require('firebase-admin');

function db() {
  return admin.apps.length ? admin.firestore() : null;
}

function siteOrigin() {
  return (process.env.WITCH_SITE_ORIGIN || 'https://secretlyawitch.com').replace(/\/$/, '');
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ─── Focal point ────────────────────────────────────────────────────
// The heroes are SQUARE but every slot that shows them is a wide banner, so
// something always gets cropped. `siteFocal` is which part survives — the same
// idea as Shopify's focal point, and literally a CSS `object-position` pair.
// These illustrations put the witch's face high in the frame, so a plain centre
// crop decapitates most of them; the stored values pull the crop up just enough
// to keep the face without losing the crystals/cards/cauldron underneath.
// Whitelisted to two percentages before it reaches a style attribute — the
// value comes from a Firestore doc, and anything else is dropped for centre.
const FOCAL_OK = /^\d{1,3}% \d{1,3}%$/;
const focal = (v) => (typeof v === 'string' && FOCAL_OK.test(v.trim()) ? v.trim() : '50% 50%');

// ─── Posts (cached — the blog is small and read-heavy) ──────────────
let CACHE = { at: 0, posts: null };
function bust() { CACHE = { at: 0, posts: null }; }

async function sitePosts() {
  const now = Date.now();
  if (CACHE.posts && now - CACHE.at < 5 * 60 * 1000) return CACHE.posts;
  const store = db();
  if (!store) return [];
  // No orderBy here — a where+orderBy pair on different fields needs a
  // composite index; the blog stays small, so sort in memory instead.
  const snap = await store.collection('forge-blog').where('site', '==', true).limit(200).get();
  const posts = snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      slug: v.siteSlug || v.slug || d.id,
      title: v.title || '(untitled)',
      metaDescription: v.metaDescription || v.excerpt || '',
      bodyHtml: v.siteBodyHtml || v.bodyHtml || '',
      image: v.siteImage || (Array.isArray(v.images) && v.images[0]) || null,
      focal: focal(v.siteFocal),
      tags: Array.isArray(v.tags) ? v.tags : [],
      publishedAt: v.sitePublishedAt && v.sitePublishedAt.toDate ? v.sitePublishedAt.toDate() : null,
      updatedAt: v.siteUpdatedAt && v.siteUpdatedAt.toDate ? v.siteUpdatedAt.toDate() : null,
    };
  }).sort((a, b) => (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0));
  CACHE = { at: now, posts };
  return posts;
}

function fmtDate(d) {
  if (!d) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Where the blog sits relative to the app ────────────────────────
// The blog is reachable from two hosts and has to link back into the app
// correctly from both:
//   secretlyawitch.com          → the witch app is at `/`
//   imageforge-q125.onrender.com → the witch app is at `/witch`, and `/blog`
//                                  there is the GATED Blog Studio unless
//                                  ?public=1 rides along.
// It also has to survive being opened INSIDE the iOS app (a WKWebView on
// /witch?app=1). Same-host links navigate the web view, so a blog link there
// replaces the app — `app=1` is carried through every internal link and the
// page installs a `window.__setTab` shim (see below) so the native tab bar
// still works from a blog page instead of tapping into nothing.
const WITCH_HOSTS = new Set(['secretlyawitch.com', 'www.secretlyawitch.com']);
function nav(req) {
  const onWitchHost = WITCH_HOSTS.has(String((req && req.hostname) || '').toLowerCase());
  const inApp = !!(req && req.query && req.query.app);
  // Preserve whatever got the visitor here, so following a link can't drop
  // them onto the gated studio page or out of app mode.
  const parts = [];
  if (req && req.query && req.query.public) parts.push('public=1');
  if (inApp) parts.push('app=1');
  const qs = parts.length ? '?' + parts.join('&') : '';
  const appHome = (onWitchHost ? '/' : '/witch') + (inApp ? '?app=1' : '');
  return {
    inApp,
    qs,
    appHome,
    blog: '/blog' + qs,
    post: (slug) => '/blog/' + slug + qs,
    // Tab deep-link back into the app (witch.html reads ?tab= on load).
    tab: (t) => (onWitchHost ? '/' : '/witch') + '?tab=' + t + (inApp ? '&app=1' : ''),
  };
}

// The app header's sigil, verbatim from public/witch.html so the two headers
// are the same object — one star each side of the title.
const SIGIL = '<svg viewBox="0 0 100 100" fill="currentColor" stroke="none"><path d="M 55.8 31.9C52.8 32.3 53.9 36.4 53.2 38.5C52.5 44.4 52.0 51.0 47.3 55.3C42.9 59.9 36.4 60.6 30.4 61.3C28.2 61.9 24.2 60.8 23.9 64.0C24.4 67.0 28.4 65.9 30.6 66.6C36.5 67.4 43.0 68.0 47.3 72.6C52.0 76.9 52.5 83.5 53.3 89.4C54.0 91.5 52.7 95.5 55.8 95.9C59.0 95.6 57.9 91.6 58.5 89.4C59.4 83.5 60.0 76.9 64.6 72.6C68.8 68.0 75.4 67.3 81.2 66.5C83.4 65.8 87.4 67.0 87.9 64.0C87.7 60.8 83.6 61.9 81.5 61.2C75.5 60.5 68.9 59.9 64.6 55.2C59.9 51.0 59.3 44.5 58.5 38.5C57.9 36.4 59.0 32.2 55.8 31.9Z"/><path d="M 25.8 21.9C24.5 22.2 25.1 23.9 24.7 24.8C24.4 27.4 24.3 30.3 22.3 32.2C20.4 34.3 17.4 34.4 14.8 34.7C13.9 35.0 12.2 34.5 11.9 35.8C12.0 37.2 13.9 36.8 14.8 37.0C17.4 37.4 20.4 37.4 22.3 39.5C24.3 41.4 24.4 44.3 24.7 46.9C25.0 47.9 24.5 49.6 25.8 49.9C27.2 49.8 26.8 48.0 27.0 47.1C27.4 44.4 27.4 41.4 29.6 39.5C31.5 37.4 34.5 37.4 37.1 37.0C38.0 36.8 39.8 37.2 39.9 35.8C39.6 34.5 37.9 35.0 36.9 34.7C34.3 34.4 31.4 34.3 29.5 32.3C27.4 30.4 27.4 27.4 27.0 24.8C26.8 23.9 27.2 22.0 25.8 21.9Z"/><path d="M 47.9 4.9C47.1 5.1 47.3 6.2 47.2 6.9C47.1 8.5 46.7 10.3 45.5 11.5C44.3 12.7 42.5 13.1 40.8 13.2C40.2 13.3 39.0 13.1 38.9 14.0C39.2 14.8 40.2 14.4 40.8 14.6C42.5 14.7 44.2 15.0 45.4 16.3C46.8 17.5 47.1 19.3 47.2 21.0C47.3 21.6 47.1 22.8 47.9 22.8C48.7 22.7 48.4 21.6 48.6 21.0C48.6 19.3 49.1 17.5 50.4 16.2C51.6 15.0 53.3 14.6 55.0 14.6C55.6 14.4 56.6 14.8 56.8 14.0C56.8 13.1 55.6 13.3 55.0 13.2C53.3 13.1 51.5 12.8 50.3 11.5C49.1 10.3 48.6 8.5 48.6 6.9C48.4 6.2 48.8 5.1 47.9 4.9Z"/></svg>';

// ─── Page shell (matches witch.html's warm-cream theme; no gradients) ─
function page({ title, description, canonicalPath, ogImage, bodyHtml, jsonLd, n }) {
  const canonical = siteOrigin() + canonicalPath;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#f5efe2">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Secretly a Witch">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --bg: #f5efe2; --surface: #fffbf3; --border: #e3d8c2; --border-soft: #ece2ce;
    --gold: #9c6f33; --gold-dim: #b3894a; --moon: #6b4f86;
    --text: #302b34; --text-dim: #6d6472; --text-faint: #a1968b;
    --serif: 'Cormorant Garamond', Georgia, serif;
  }
  body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; line-height: 1.65; }
  .wrap { max-width: 680px; margin: 0 auto; padding: 18px 18px 70px; }

  /* ── The app's header, verbatim ────────────────────────────────────────
     Same sticky cream bar, same two stars flanking the same italic gold
     title, same hamburger in the same corner as public/witch.html — the
     blog is a room in the app, not a different building. Any change to the
     app's header belongs here too (the dials are the same two vars). */
  header.top {
    position: sticky; top: 0; z-index: 40;
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    padding: 5px 20px 10px;
    background: rgba(245,239,226,0.92); backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border-soft);
  }
  header.top .sigil { --sigil-size: 15px; --sigil-gap: 14px;
                      display: flex; align-items: center; color: var(--gold); opacity: .92; }
  header.top .sigil svg { width: var(--sigil-size); height: var(--sigil-size); }
  header.top .sigil { justify-self: end; margin-right: var(--sigil-gap); }
  header.top .brand ~ .sigil { justify-self: start; margin-right: 0; margin-left: var(--sigil-gap); }
  header.top .brand {
    font-family: var(--serif); font-style: italic; font-weight: 500;
    font-size: 26px; letter-spacing: .4px; color: var(--gold);
    white-space: nowrap; text-decoration: none;
  }
  .menu-btn { position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
              display: flex; align-items: center; background: none; border: none;
              color: var(--text-dim); cursor: pointer; padding: 6px; }
  .menu-btn svg { width: 20px; height: 20px; }
  .menu-btn:hover, .menu-btn.on { color: var(--gold); }
  /* Square corners and hard ink rules, exactly like the app's jump menu. */
  #jump-menu { position: fixed; inset: 0; z-index: 60; display: none; }
  #jump-menu.show { display: block; }
  #jump-menu .jm-scrim { position: absolute; inset: 0; background: rgba(48,43,52,.26); }
  .jm-panel { position: absolute; right: 10px; width: 236px; max-height: 76vh; overflow-y: auto;
              background: var(--surface); border: 1px solid var(--text); border-radius: 0;
              box-shadow: 0 12px 30px rgba(48,30,20,.18); }
  .jm-panel a { display: block; width: 100%; text-align: left; background: none;
                border-top: 1px solid var(--text); font-size: 14.5px; text-decoration: none;
                color: var(--text); padding: 12px 14px; }
  .jm-panel a:first-child { border-top: none; }
  .jm-panel a:active { background: var(--border-soft); }

  h1 { font-family: var(--serif); font-size: 32px; font-weight: 600; line-height: 1.18; margin-bottom: 8px; }
  .date { font-size: 12.5px; color: var(--text-faint); letter-spacing: .4px; text-transform: uppercase; margin-bottom: 20px; }
  /* Both hero slots are 16:9 banners cropped from a square source, so both need
     object-position — see the focal-point note in this file. */
  .hero { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 6px;
          border: 1px solid var(--border-soft); display: block; margin: 0 0 22px; }
  article h2 { font-family: var(--serif); font-size: 24px; font-weight: 600; margin: 26px 0 8px; }
  article h3 { font-family: var(--serif); font-size: 19px; font-weight: 600; margin: 18px 0 6px; }
  article p { margin: 10px 0; } article ul, article ol { margin: 10px 0 10px 22px; }
  article a { color: var(--gold); } article img { max-width: 100%; border-radius: 6px; }
  article strong { font-weight: 600; }
  .card { display: block; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; text-decoration: none; color: var(--text); margin-bottom: 16px; }
  .card img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; border-bottom: 1px solid var(--border-soft); }
  .card .cb { padding: 14px 16px 16px; }
  .card h2 { font-family: var(--serif); font-size: 22px; font-weight: 600; line-height: 1.2; }
  .card .cd { font-size: 11.5px; color: var(--text-faint); text-transform: uppercase; letter-spacing: .4px; margin: 5px 0 7px; }
  .card p { font-size: 14px; color: var(--text-dim); }
  .empty { color: var(--text-dim); font-size: 14.5px; }
  .back { display: inline-block; margin-top: 30px; color: var(--gold); text-decoration: none; font-size: 14px; }
  footer.bottom { margin-top: 44px; padding-top: 16px; border-top: 1px solid var(--border-soft); font-size: 13px; color: var(--text-dim); }
  footer.bottom a { color: var(--gold); text-decoration: none; }
</style>
</head>
<body>
<header class="top">
  <span class="sigil">${SIGIL}</span>
  <a class="brand" href="${esc(n.appHome)}">Secretly a Witch</a>
  <span class="sigil">${SIGIL}</span>
  <button class="menu-btn" id="menu-btn" aria-label="Menu" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg></button>
</header>
<div id="jump-menu"><div class="jm-scrim"></div><div class="jm-panel">
  <a href="${esc(n.blog)}">The blog</a>
  <a href="${esc(n.tab('home'))}">Home</a>
  <a href="${esc(n.tab('school'))}">Witch School</a>
  <a href="${esc(n.tab('book'))}">Book of Shadows</a>
  <a href="${esc(n.tab('shop'))}">Shop</a>
</div></div>
<div class="wrap">
${bodyHtml}
<footer class="bottom">From <a href="${esc(n.appHome)}">Secretly a Witch</a> — moon phases, daily tarot, spells &amp; everyday magic.</footer>
</div>
<script>
(function () {
  var menu = document.getElementById('jump-menu'), btn = document.getElementById('menu-btn');
  var head = document.querySelector('header.top'), panel = menu.querySelector('.jm-panel');
  function open() {
    var hh = head.offsetHeight;
    panel.style.top = (hh + 4) + 'px';
    menu.querySelector('.jm-scrim').style.top = hh + 'px';
    menu.classList.add('show'); btn.classList.add('on'); btn.setAttribute('aria-expanded', 'true');
  }
  function close() { menu.classList.remove('show'); btn.classList.remove('on'); btn.setAttribute('aria-expanded', 'false'); }
  btn.addEventListener('click', function () { menu.classList.contains('show') ? close() : open(); });
  menu.addEventListener('click', function (e) { if (!e.target.closest('a')) close(); });
})();
</script>
${n.inApp ? `<script>
// Opened inside the iOS app: this page replaced the web app in the same web
// view, so the native tab bar's window.__setTab call would otherwise land on
// nothing and the bar would go dead. Answer it by navigating back to the app
// on the tab that was tapped.
window.__setTab = function (t) { location.href = ${JSON.stringify(n.tab('__TAB__'))}.replace('__TAB__', encodeURIComponent(t)); };
</script>` : ''}
</body>
</html>`;
}

// ─── GET /blog — the index ──────────────────────────────────────────
async function renderIndex(req, res) {
  try {
    const posts = await sitePosts();
    const n = nav(req);
    const items = posts.length ? posts.map((p) => `
<a class="card" href="${esc(n.post(p.slug))}">
  ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" style="object-position:${esc(p.focal)}">` : ''}
  <div class="cb">
    <h2>${esc(p.title)}</h2>
    <div class="cd">${esc(fmtDate(p.publishedAt))}</div>
    <p>${esc(p.metaDescription)}</p>
  </div>
</a>`).join('\n') : '<p class="empty">Nothing here yet — the first posts are brewing. ✦</p>';
    res.type('html').send(page({
      n,
      title: 'The Secretly a Witch Blog',
      description: 'Witchcraft, tarot, moon magic and everyday rituals — notes from Secretly a Witch.',
      canonicalPath: '/blog',
      ogImage: posts.find((p) => p.image)?.image || null,
      bodyHtml: `<h1>The Blog</h1>\n<div class="date">Witchcraft, tarot &amp; everyday magic</div>\n${items}`,
    }));
  } catch (err) {
    res.status(502).type('html').send('<p style="font-family:sans-serif;padding:30px">The blog is resting for a moment — try again shortly.</p>');
  }
}

// ─── GET /blog/:slug — one post ─────────────────────────────────────
async function renderPost(req, res) {
  try {
    const posts = await sitePosts();
    const n = nav(req);
    const post = posts.find((p) => p.slug === req.params.slug);
    if (!post) return res.redirect(302, n.blog);
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.metaDescription,
      datePublished: post.publishedAt ? post.publishedAt.toISOString() : undefined,
      dateModified: (post.updatedAt || post.publishedAt) ? (post.updatedAt || post.publishedAt).toISOString() : undefined,
      image: post.image || undefined,
      url: `${siteOrigin()}/blog/${post.slug}`,
      publisher: { '@type': 'Organization', name: 'Secretly a Witch', url: siteOrigin() },
    };
    res.type('html').send(page({
      n,
      title: post.title,
      description: post.metaDescription,
      canonicalPath: `/blog/${post.slug}`,
      ogImage: post.image,
      jsonLd,
      bodyHtml: `<article>
<h1>${esc(post.title)}</h1>
<div class="date">${esc(fmtDate(post.publishedAt))}</div>
${post.image ? `<img class="hero" src="${esc(post.image)}" alt="${esc(post.title)}" style="object-position:${esc(post.focal)}">` : ''}
${post.bodyHtml}
<a class="back" href="${esc(n.blog)}">← All posts</a>
</article>`,
    }));
  } catch (err) {
    res.status(502).type('html').send('<p style="font-family:sans-serif;padding:30px">The blog is resting for a moment — try again shortly.</p>');
  }
}

// ─── GET /sitemap.xml (witch host) ──────────────────────────────────
async function sitemap(req, res) {
  try {
    const posts = await sitePosts().catch(() => []);
    const origin = siteOrigin();
    const urls = [
      { loc: `${origin}/`, priority: '1.0' },
      { loc: `${origin}/blog`, priority: '0.7' },
      ...posts.map((p) => ({
        loc: `${origin}/blog/${p.slug}`,
        lastmod: (p.updatedAt || p.publishedAt) ? (p.updatedAt || p.publishedAt).toISOString().slice(0, 10) : null,
        priority: '0.6',
      })),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
    res.type('application/xml').send(xml);
  } catch (err) {
    res.status(502).type('text').send('sitemap unavailable');
  }
}

module.exports = { renderIndex, renderPost, sitemap, sitePosts, siteOrigin, bust };
