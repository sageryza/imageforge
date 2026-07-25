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

// ─── Page shell (matches witch.html's warm-cream theme; no gradients) ─
function page({ title, description, canonicalPath, ogImage, bodyHtml, jsonLd }) {
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
  .wrap { max-width: 680px; margin: 0 auto; padding: 22px 18px 70px; }
  header.top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--border-soft); margin-bottom: 26px; }
  header.top .brand { font-family: var(--serif); font-size: 21px; font-weight: 600; color: var(--text); text-decoration: none; }
  header.top .brand span { color: var(--gold); }
  header.top nav a { color: var(--text-dim); text-decoration: none; font-size: 13.5px; margin-left: 14px; }
  header.top nav a:hover { color: var(--gold); }
  h1 { font-family: var(--serif); font-size: 32px; font-weight: 600; line-height: 1.18; margin-bottom: 8px; }
  .date { font-size: 12.5px; color: var(--text-faint); letter-spacing: .4px; text-transform: uppercase; margin-bottom: 20px; }
  .hero { width: 100%; border-radius: 6px; border: 1px solid var(--border-soft); display: block; margin: 0 0 22px; }
  article h2 { font-family: var(--serif); font-size: 24px; font-weight: 600; margin: 26px 0 8px; }
  article h3 { font-family: var(--serif); font-size: 19px; font-weight: 600; margin: 18px 0 6px; }
  article p { margin: 10px 0; } article ul, article ol { margin: 10px 0 10px 22px; }
  article a { color: var(--gold); } article img { max-width: 100%; border-radius: 6px; }
  article strong { font-weight: 600; }
  .card { display: block; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; text-decoration: none; color: var(--text); margin-bottom: 16px; }
  .card img { width: 100%; display: block; border-bottom: 1px solid var(--border-soft); }
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
<div class="wrap">
<header class="top">
  <a class="brand" href="/">Secretly a Witch <span>✦</span></a>
  <nav><a href="/blog">Blog</a><a href="/">The app</a></nav>
</header>
${bodyHtml}
<footer class="bottom">From <a href="/">Secretly a Witch</a> — moon phases, daily tarot, spells &amp; everyday magic.</footer>
</div>
</body>
</html>`;
}

// ─── GET /blog — the index ──────────────────────────────────────────
async function renderIndex(req, res) {
  try {
    const posts = await sitePosts();
    const items = posts.length ? posts.map((p) => `
<a class="card" href="/blog/${esc(p.slug)}">
  ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : ''}
  <div class="cb">
    <h2>${esc(p.title)}</h2>
    <div class="cd">${esc(fmtDate(p.publishedAt))}</div>
    <p>${esc(p.metaDescription)}</p>
  </div>
</a>`).join('\n') : '<p class="empty">Nothing here yet — the first posts are brewing. ✦</p>';
    res.type('html').send(page({
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
    const post = posts.find((p) => p.slug === req.params.slug);
    if (!post) return res.redirect(302, '/blog');
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
      title: post.title,
      description: post.metaDescription,
      canonicalPath: `/blog/${post.slug}`,
      ogImage: post.image,
      jsonLd,
      bodyHtml: `<article>
<h1>${esc(post.title)}</h1>
<div class="date">${esc(fmtDate(post.publishedAt))}</div>
${post.image ? `<img class="hero" src="${esc(post.image)}" alt="${esc(post.title)}">` : ''}
${post.bodyHtml}
<a class="back" href="/blog">← All posts</a>
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
