'use strict';
/*
 * panels-import.js — a container-drawn panel sheet files into the Playground's
 * PANELS tab (2026-08-28, Sophie: "the playground is for me, but panels
 * should go in panels").
 *
 * The 2026-08-28 "THE FEED IS HERS" rule sends chat sheet work to the chat's
 * own container (scripts/draw-panel-sheet.js) — which meant a finished sheet
 * had no run doc, so the Panels tab could never show it (the meteorite set,
 * drawn Aug 24, was the one she went looking for). This module builds the
 * DONE run doc such an import writes: no generation, no cut, no money — the
 * work already happened elsewhere; this is only the record.
 *
 * The PICTURE tab is untouched by construction: a doc carrying `panels` +
 * `grid` is a panels run to plRunIsPanels/runIsPanels, and kind=single drops
 * it. So an import can never put chat work back into the feed she just asked
 * to keep for herself.
 *
 * Rules the validator holds the line on:
 *  - PAIRING IS SACRED: images[i] is the panel drawn from panels[i], and a
 *    count mismatch is refused outright — a wrong prompt under her finger is
 *    the one failure this record must never produce (the filmshots rule).
 *  - NEVER STAMPED AHEAD OF NOW (the playground-bump lesson): createdAt is
 *    the real draw time, in the past; a future stamp would sit above
 *    everything she draws next until the clock catches up.
 *  - THE STYLE IS VALIDATED, NEVER GUESSED: an unknown style id is refused
 *    rather than silently landed on a default — an import is a record of
 *    what happened, and a wrong style is a lie about it.
 *  - fullPrompt is OPTIONAL and taken verbatim when given (the exact-prompt
 *    rule: the caller passes the literal text it sent, or nothing — the
 *    Prompt door on a run without one simply shows less, honestly).
 *
 * Pure — scripts/test-panels-import.js drives it with no network.
 */

const MAX_PANELS = 25;
const PANEL_MAX = 2000;
const FULL_MAX = 20000;

const isHttps = (u) => /^https:\/\/\S+$/.test(String(u || ''));
const isCanvas = (s) => /^\d{2,5}x\d{2,5}$/.test(String(s || ''));

/**
 * body → { run, createdMs } | { error }
 * opts: { styleIds: [...valid gpt style ids], now?: ms }
 */
function buildImportRun(body, opts) {
  const b = body || {};
  const now = (opts && opts.now) || Date.now();
  const styleIds = (opts && opts.styleIds) || [];

  const panels = Array.isArray(b.panels)
    ? b.panels.map((p) => String(p == null ? '' : p).trim().slice(0, PANEL_MAX)) : [];
  if (!panels.length || panels.length > MAX_PANELS) {
    return { error: `panels required (1-${MAX_PANELS})` };
  }
  if (panels.some((p) => !p)) return { error: 'every panel needs its words' };

  const images = Array.isArray(b.images) ? b.images.map((u) => String(u || '').trim()) : [];
  if (images.length !== panels.length) {
    return { error: `images and panels must pair up (${images.length} images, ${panels.length} panels)` };
  }
  if (images.some((u) => !isHttps(u))) return { error: 'every image must be an https url' };

  const g = b.grid || {};
  const across = Math.floor(Number(g.across));
  const down = Math.floor(Number(g.down));
  if (!(across >= 1 && down >= 1 && across <= 5 && down <= 5)) {
    return { error: 'grid.across and grid.down required (1-5)' };
  }
  const count = across * down;
  if (panels.length > count) {
    return { error: `${panels.length} panels cannot come from a ${across}x${down} sheet` };
  }

  const style = String(b.style || '');
  if (styleIds.indexOf(style) < 0) {
    return { error: `unknown style '${style}' — one of: ${styleIds.join(', ')}` };
  }
  const quality = String(b.quality || '');
  if (['low', 'medium', 'high'].indexOf(quality) < 0) {
    return { error: 'quality must be low, medium or high' };
  }

  const res = String(b.res || '').toLowerCase();
  if (res && ['1k', '2k', '4k'].indexOf(res) < 0) return { error: 'res must be 1k, 2k or 4k' };
  const size = String(b.size || '');
  if (size && !isCanvas(size)) return { error: 'size must be the sheet canvas, WxH' };
  const aspectRatio = String(b.aspectRatio || '');
  if (aspectRatio && ['2:3', '1:1', '3:2'].indexOf(aspectRatio) < 0) {
    return { error: 'aspectRatio must be 2:3, 1:1 or 3:2' };
  }
  const sheetUrl = String(b.sheetUrl || '');
  if (sheetUrl && !isHttps(sheetUrl)) return { error: 'sheetUrl must be https' };

  let createdMs = Number(b.createdAt) || now;
  if (createdMs > now) return { error: 'createdAt cannot be in the future' };
  if (createdMs < Date.parse('2025-01-01T00:00:00Z')) return { error: 'createdAt is not a real draw time' };

  const run = {
    engine: 'gptimage',
    model: 'gpt-image-2',
    gptStyle: style,
    quality,
    prompt: panels.join('\n'),
    panels,
    grid: { across, down, count },
    images,
    outputs: 1,
    status: 'done',
    imported: true,
  };
  if (res) run.res = res;
  if (size) { run.size = size; run.sheet = size; }
  if (aspectRatio) run.aspectRatio = aspectRatio;
  if (sheetUrl) run.sheetUrl = sheetUrl;
  const fullPrompt = String(b.fullPrompt || '').slice(0, FULL_MAX);
  if (fullPrompt) run.fullPrompt = fullPrompt;
  const chat = String(b.chat || '').trim().slice(0, 120);
  if (chat) run.chat = chat;
  if (Array.isArray(b.cast) && b.cast.length) {
    const cast = b.cast.slice(0, 12)
      .map((c) => ({ name: String((c && c.name) || '').slice(0, 200),
        description: String((c && c.description) || '').slice(0, 1000) }))
      .filter((c) => c.name || c.description);
    if (cast.length) run.cast = cast;
  }
  return { run, createdMs };
}

module.exports = { buildImportRun, MAX_PANELS };
