// whiten-bg.js — the flood-fill whiten pass, ONE copy.
//
// Lifted out of server.js on 2026-08-26, the day the Story Room grew a PASTEL
// style: the pad draws the Playground's Pastel recipe, and that recipe is only
// itself with this pass on the end (`whiten: true` on PL_GPT_STYLES.pastel).
// scratchpad.js is its own module and cannot reach into server.js, so the
// choice was a second copy of a twenty-line flood fill or one file both
// require. The house rule that already covers this: the cutter lives in
// editor.js and every other room imports it rather than hand-rolling one.
//
// The picture it is for: the pastel house look draws a subject on a plain
// white ground, and gpt-image-2 returns that ground as a very slightly tinted
// off-white which reads as grey the moment it sits on paper.

// Flood-fill the border-connected background to pure white (for whitened house
// styles). Interior colours walled off by black outlines are preserved. Safe
// for a single centred subject with white space around it (the Test Station case).
async function whitenBackground(buf, tol = 46) {
  const sharp = require('sharp');
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const idx = (x, y) => (y * W + x) * C;
  const corners = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]];
  let br = 0, bg = 0, bb = 0;
  for (const [x, y] of corners) { const i = idx(x, y); br += data[i]; bg += data[i + 1]; bb += data[i + 2]; }
  br /= 4; bg /= 4; bb /= 4;
  const tol2 = tol * tol;
  const close = (i) => { const dr = data[i] - br, dg = data[i + 1] - bg, db = data[i + 2] - bb; return dr * dr + dg * dg + db * db <= tol2; };
  const visited = new Uint8Array(W * H), stack = [];
  const pushIf = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const p = y * W + x; if (visited[p] || !close(idx(x, y))) return; visited[p] = 1; stack.push(p); };
  for (let x = 0; x < W; x++) { pushIf(x, 0); pushIf(x, H - 1); }
  for (let y = 0; y < H; y++) { pushIf(0, y); pushIf(W - 1, y); }
  while (stack.length) { const p = stack.pop(), x = p % W, y = (p - x) / W; pushIf(x + 1, y); pushIf(x - 1, y); pushIf(x, y + 1); pushIf(x, y - 1); }
  const out = Buffer.from(data);
  for (let p = 0; p < W * H; p++) if (visited[p]) { const i = p * C; out[i] = 255; out[i + 1] = 255; out[i + 2] = 255; if (C === 4) out[i + 3] = 255; }
  // lossless — this buffer REPLACES the original (an argument-less webp
  // encode silently re-encodes the whole picture at sharp's default 80).
  return await sharp(out, { raw: { width: W, height: H, channels: C } }).webp({ lossless: true }).toBuffer();
}

module.exports = { whitenBackground };
