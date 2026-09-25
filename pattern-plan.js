// pattern-plan.js — the ONE arithmetic behind a repeating pattern, shared by the
// page (served at /pattern-plan.js, drawn on a canvas) and the server
// (required by pattern.js, composited with sharp for the export). The preview
// she approves and the file she downloads come from the same list of draws,
// so what she sees IS what she gets — the pause-plan.js rule.
//
// THE MODEL. A pattern is one TILE of `tile.w` x `tile.h` units (default
// 1000x1000) holding items. An item is a piece placed at a CENTRE `x`,`y`
// given as fractions of the tile (0..1), `size` = the piece's longest side in
// tile units, `rot` in degrees, `flip` (mirrored left-right). Four things she
// named are four fields: which piece (`piece`), how much to turn it (`rot`),
// where it goes (`x`,`y`), and how far apart the repeats land (the tile's
// size against the pieces' — grow the tile and the pieces spread).
//
// SEAMLESS BY WRAPPING: a piece that crosses the tile's edge is drawn again one
// tile over, so the part that left on the right comes back in on the left.
// Every draw is listed nine times (the tile and its eight neighbours) and the
// ones that cannot touch the canvas are dropped before anyone draws them.
//
// THREE LAYOUTS, each an output IMAGE that repeats on a plain grid:
//   grid   — the tile itself (w x h)
//   half   — half-drop: two columns, the second dropped by h/2 (2w x h)
//   mirror — the tile, its mirror, and both flipped below (2w x 2h)
// So a printer, a wallpaper app or a CSS background gets ONE picture to repeat
// and never needs to know which layout it is.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.__patternPlan = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LAYOUTS = ['grid', 'half', 'mirror'];
  var DEFAULT_TILE = { w: 1000, h: 1000, bg: '#ffffff' };   // white (2026-09-25, Sophie: "default white no other colors")
  var DEFAULT_SIZE = 280;

  function num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /** Normalise whatever the doc holds into a tile the rest can trust. */
  function tileOf(p) {
    var t = (p && p.tile) || {};
    return {
      w: clamp(num(t.w, DEFAULT_TILE.w), 200, 6000),
      h: clamp(num(t.h, DEFAULT_TILE.h), 200, 6000),
      bg: /^#[0-9a-f]{6}$/i.test(String(t.bg || '')) ? String(t.bg).toLowerCase() : DEFAULT_TILE.bg,
    };
  }
  function layoutOf(p) {
    var l = p && p.layout && p.layout.kind;
    return LAYOUTS.indexOf(l) >= 0 ? l : 'grid';
  }
  function itemOf(it) {
    return {
      k: String(it.k || ''),
      piece: String(it.piece || ''),
      x: clamp(num(it.x, 0.5), -0.5, 1.5),
      y: clamp(num(it.y, 0.5), -0.5, 1.5),
      size: clamp(num(it.size, DEFAULT_SIZE), 20, 6000),
      rot: ((num(it.rot, 0) % 360) + 360) % 360,
      flip: !!it.flip,
    };
  }

  /** The output image's size in tile units for a layout. */
  function outSize(layout, tile) {
    if (layout === 'half') return { W: tile.w * 2, H: tile.h };
    if (layout === 'mirror') return { W: tile.w * 2, H: tile.h * 2 };
    return { W: tile.w, H: tile.h };
  }

  /** Every draw for the tile ALONE (with wrap copies), in tile units.
   *  `pieces` maps piece id → {w,h} of the cut-out, so a draw knows its box;
   *  a piece not in the map is drawn square, which is only wrong by a margin. */
  function tileDraws(p, pieces) {
    var tile = tileOf(p);
    var items = Array.isArray(p && p.items) ? p.items.map(itemOf) : [];
    var out = [];
    items.forEach(function (it, order) {
      var pc = (pieces && pieces[it.piece]) || { w: 1, h: 1 };
      var ar = pc.w / pc.h;
      var w = ar >= 1 ? it.size : it.size * ar;
      var h = ar >= 1 ? it.size / ar : it.size;
      // The rotated box is at most the diagonal on a side — enough to say
      // whether a wrap copy can touch the tile at all.
      var r = Math.hypot(w, h) / 2;
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          var cx = (it.x + dx) * tile.w, cy = (it.y + dy) * tile.h;
          if (cx + r < 0 || cy + r < 0 || cx - r > tile.w || cy - r > tile.h) continue;
          out.push({ k: it.k, piece: it.piece, order: order, cx: cx, cy: cy, w: w, h: h, rot: it.rot, flip: it.flip, mx: false, my: false, home: dx === 0 && dy === 0 });
        }
      }
    });
    return out;
  }

  /** Every draw for the OUTPUT image of the layout, in tile units. */
  function draws(p, pieces) {
    var tile = tileOf(p);
    var layout = layoutOf(p);
    var base = tileDraws(p, pieces);
    var size = outSize(layout, tile);
    var out = [];
    // A mirrored copy is the SAME draw reflected: its centre reflects across
    // the tile and the renderer applies the reflection (`mx`/`my`) on top of
    // the item's own turn and flip — so a reflection is exact by construction
    // rather than a rotation somebody worked out.
    function copy(d, dx, dy, mx, my) {
      out.push({ k: d.k, piece: d.piece, order: d.order,
        cx: (mx ? tile.w - d.cx : d.cx) + dx, cy: (my ? tile.h - d.cy : d.cy) + dy,
        w: d.w, h: d.h, rot: d.rot, flip: d.flip, mx: !!mx, my: !!my, home: d.home && !dx && !dy });
    }
    if (layout === 'grid') {
      base.forEach(function (d) { copy(d, 0, 0, false, false); });
    } else if (layout === 'half') {
      base.forEach(function (d) {
        copy(d, 0, 0, false, false);
        // The second column is the tile dropped by half its height — and since
        // the tile wraps, the half that drops off the bottom is the copy that
        // comes in at the top.
        copy(d, tile.w, tile.h / 2, false, false);
        copy(d, tile.w, -tile.h / 2, false, false);
      });
    } else {
      base.forEach(function (d) {
        copy(d, 0, 0, false, false);
        copy(d, tile.w, 0, true, false);
        copy(d, 0, tile.h, false, true);
        copy(d, tile.w, tile.h, true, true);
      });
    }
    // Drop what cannot touch the output, keep the paint order stable.
    var kept = out.filter(function (d) {
      var r = Math.hypot(d.w, d.h) / 2;
      return !(d.cx + r < 0 || d.cy + r < 0 || d.cx - r > size.W || d.cy - r > size.H);
    });
    kept.sort(function (a, b) { return a.order - b.order; });
    return { W: size.W, H: size.H, bg: tile.bg, layout: layout, draws: kept };
  }

  /** Even places for n items on a tile: a staggered grid, every other row
   *  shifted half a column, so nothing lines up in a stripe. Fractions. */
  /** n spots on the tile, as fractions. With NO seed: an even staggered
   *  grid (what freeSpot reads). With a seed: a NEW random placement — each
   *  spot jittered within its own cell so nothing piles up, and the cells
   *  dealt out in a random order so which piece lands where changes too
   *  (2026-09-25, Sophie: "can u make it do a new random placement … every
   *  time"). The same seed is the same scatter, so a test can pin one. */
  function scatter(n, seed) {
    n = Math.max(0, n | 0);
    if (!n) return [];
    var cols = Math.ceil(Math.sqrt(n));
    var rows = Math.ceil(n / cols);
    var out = [];
    for (var i = 0; i < n; i++) {
      var c = i % cols, r = Math.floor(i / cols);
      var x = (c + 0.5 + (r % 2 ? 0.5 : 0)) / cols;
      out.push({ x: x - Math.floor(x), y: (r + 0.5) / rows });
    }
    if (seed == null) return out;
    var s = (num(seed, 1) * 9301 + 49297) % 233280;
    function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    var jx = 0.35 / cols, jy = 0.35 / rows;
    out = out.map(function (p) {
      var x = p.x + (rnd() * 2 - 1) * jx, y = p.y + (rnd() * 2 - 1) * jy;
      return { x: x - Math.floor(x), y: y - Math.floor(y) };
    });
    for (var k = out.length - 1; k > 0; k--) {
      var j = Math.floor(rnd() * (k + 1)); var t = out[k]; out[k] = out[j]; out[j] = t;
    }
    return out;
  }

  /** The free spot for ONE more item: of the scatter slots for n+1, the one
   *  farthest from anything already placed (distance measured on the torus,
   *  because the tile wraps). */
  function freeSpot(items) {
    var placed = (items || []).map(itemOf);
    var slots = scatter(placed.length + 1);
    var best = slots[0], bestD = -1;
    slots.forEach(function (s) {
      var d = Infinity;
      placed.forEach(function (it) {
        var dx = Math.abs(s.x - it.x); dx = Math.min(dx, 1 - dx);
        var dy = Math.abs(s.y - it.y); dy = Math.min(dy, 1 - dy);
        d = Math.min(d, dx * dx + dy * dy);
      });
      if (d > bestD) { bestD = d; best = s; }
    });
    return best;
  }

  /** A rotation for every item within ±spread of its own, from a seed so the
   *  same tap twice is two different spins. Degrees, whole. */
  function spin(items, spread, seed) {
    var s = (num(seed, 1) * 9301 + 49297) % 233280;
    function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    var sp = clamp(num(spread, 0), 0, 180);
    return (items || []).map(function (it) {
      var d = Math.round((rnd() * 2 - 1) * sp);
      return ((num(it.rot, 0) + d) % 360 + 360) % 360;
    });
  }

  return { LAYOUTS: LAYOUTS, DEFAULT_TILE: DEFAULT_TILE, DEFAULT_SIZE: DEFAULT_SIZE,
    tileOf: tileOf, layoutOf: layoutOf, itemOf: itemOf, outSize: outSize,
    tileDraws: tileDraws, draws: draws, scatter: scatter, freeSpot: freeSpot, spin: spin };
});
