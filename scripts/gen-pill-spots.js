#!/usr/bin/env node
/**
 * gen-pill-spots.js — one-off driver for the fictional pill commercial
 * storyboards (Somnivex / Placebrex / Oblivane). Reads
 * docs/pill-spots/frames.json and, for each frame, STRICTLY ONE AT A TIME
 * (CLAUDE.md: serialize bulk batches — parallel batches have restarted the
 * 512MB box):
 *   1. draws it via the live server's /api/generate/gptimage
 *      (gpt-image-2, 1536x1024, medium — saved as a permanent Storage webp),
 *   2. files the label + MODEL · QUALITY caption on the chat's Assets tab,
 *   3. files the exact prompt split style/content,
 *   4. posts the My Creations gallery doc (post-to-gallery.js) with the
 *      frame's true generation time, when GALLERY_UID is set.
 * Then posts one grid Compare page with all frames in storyboard order.
 *
 * Resumable: frames already in docs/pill-spots/results.json are skipped, so
 * a crashed run continues where it stopped instead of re-paying.
 *
 *   CHAT=<slug> [GALLERY_UID=<uid>] node scripts/gen-pill-spots.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.CHAT || 'fictional-pill-commercial-01h7qx';
const SESSION = (process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^cse_/, '');
const ROOT = path.join(__dirname, '..');
const FRAMES = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/pill-spots/frames.json'), 'utf8'));
const RESULTS_PATH = path.join(ROOT, 'docs/pill-spots/results.json');

let results = [];
try { results = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8')); } catch {}
const done = new Map(results.map(r => [r.id, r]));

async function post(route, body, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(BASE + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      if (i >= tries) throw err;
      console.log(`  retry ${i} on ${route}: ${err.message}`);
      await new Promise(r => setTimeout(r, 5000 * i));
    }
  }
}

(async () => {
  for (const spot of FRAMES.spots) {
    const style = FRAMES.styleBase + spot.tint;
    // Filed style half: the exact prefix with the seam marked, then run params.
    const styleFiled = `${style}. [content] (gpt-image-2 · ${FRAMES.size} · ${FRAMES.quality})`;
    for (const f of spot.frames) {
      const id = `${spot.spot.toLowerCase()}-${f.n}`;
      if (done.has(id)) { console.log(`skip ${id} (already drawn)`); continue; }
      const prompt = `${style}. ${f.content}`;
      console.log(`drawing ${id}: ${f.label}`);
      const t0 = Date.now();
      const gen = await post('/api/generate/gptimage', {
        prompt, size: FRAMES.size, quality: FRAMES.quality,
      });
      if (!gen.url || gen.url.startsWith('data:')) throw new Error(`${id}: no permanent url`);
      console.log(`  ${gen.url} (${Math.round((Date.now() - t0) / 1000)}s)`);
      await post('/api/gallery', {
        assetsOnly: true, chat: CHAT, session: SESSION, url: gen.url,
        prompt: 'gpt-image-2 · medium', description: f.label,
      });
      await post('/api/gallery/assets/prompt', {
        chat: CHAT, url: gen.url, style: styleFiled, content: f.content,
      });
      if (process.env.GALLERY_UID) {
        try {
          execFileSync('node', [path.join(__dirname, 'post-to-gallery.js'),
            '--url', gen.url, '--prompt', f.content, '--created', String(t0),
            '--model', 'gpt-image-2', '--quality', 'medium', '--source', 'pill-spots'],
            { cwd: ROOT, stdio: 'pipe' });
        } catch (err) {
          console.log(`  gallery post failed for ${id}: ${err.message}`);
        }
      }
      const rec = { id, spot: spot.spot, n: f.n, label: f.label, url: gen.url,
        content: f.content, style: styleFiled, madeAt: t0 };
      results.push(rec); done.set(id, rec);
      fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
    }
  }

  const groups = FRAMES.spots.map(spot => ({
    label: spot.spot,
    items: spot.frames.map(f => {
      const r = done.get(`${spot.spot.toLowerCase()}-${f.n}`);
      return {
        id: r.id, label: f.label, img: r.url, url: r.url,
        model: 'gpt-image-2', quality: 'medium',
        promptStyle: r.style, promptContent: f.content,
      };
    }),
  }));
  const page = await post('/api/chatfeed/page', {
    chat: CHAT, session: SESSION, title: 'Pill spots — storyboards v1',
    template: 'grid', data: { groups, aspect: 'landscape' },
  });
  console.log('page posted:', JSON.stringify(page));
  console.log(`DONE: ${results.length} frames`);
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
