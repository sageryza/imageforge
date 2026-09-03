#!/usr/bin/env node
// THE PROMPT RIDES INSIDE THE PICTURE FILE (2026-09-03, Sophie: "could the
// prompt it was made from be filed as metadata w pictures").
//
// Pins image-meta.js: the round trip on all three containers, that the
// picture bytes are untouched, that a malformed or foreign file comes back
// unchanged, the ranged-read reader, and — a SOURCE PIN — that every save
// of a picture this server draws hands the file its prompt.
//
//   node scripts/test-image-meta.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const im = require('../image-meta');

let n = 0;
const ok = (c, name) => { assert.ok(c, name); n++; };
const root = (f) => path.join(__dirname, '..', f);

// ── fixtures, built by hand so this needs no node_modules ─────────────────
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
  return (c ^ -1) >>> 0;
}
function png() {
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.from([0, 255, 0, 0, 0, 255, 0, 0, 0, 0, 255, 0, 255, 255, 255]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function webpLossless() {
  // a bare VP8L chunk, the shape gpt-image-2 returns: signature + 14/14-bit dims
  const w = 37, h = 21;
  const bits = (w - 1) | ((h - 1) << 14);
  const hdr = Buffer.alloc(5); hdr[0] = 0x2f; hdr.writeUInt32LE(bits, 1);
  const data = Buffer.concat([hdr, Buffer.alloc(11, 0x5a)]);                // fake stream
  const chunk = Buffer.concat([Buffer.from('VP8L'), Buffer.from([data.length, 0, 0, 0]), data]);
  const head = Buffer.alloc(12); head.write('RIFF'); head.writeUInt32LE(4 + chunk.length, 4); head.write('WEBP', 8);
  return Buffer.concat([head, chunk]);
}
function jpeg() {
  const app0 = Buffer.from([0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const sos = Buffer.from([0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0, 0xab, 0xcd]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sos, Buffer.from([0xff, 0xd9])]);
}
const FIELDS = {
  fullPrompt: 'PRE\n\na fox <in> a "raincoat" & hat\n\nSUF', promptStyle: 'PRE\n\n[content]\n\nSUF',
  promptContent: 'a fox <in> a "raincoat" & hat', model: 'gpt-image-2', quality: 'medium', size: '2K', canvas: '1536x2304',
};

// 1 — round trip on each container, pixels untouched, re-stamp replaces
for (const [name, mk] of [['webp', webpLossless], ['png', png], ['jpeg', jpeg]]) {
  const src = mk();
  const out = im.stamp(src, FIELDS);
  ok(out !== src && out.length > src.length, `${name}: a stamp grows the file`);
  ok(im.kindOf(out) === name, `${name}: still a ${name}`);
  assert.deepStrictEqual(im.read(out), FIELDS, `${name}: the fields come back verbatim, escapes and all`); n++;
  const again = im.stamp(out, { ...FIELDS, quality: 'high' });
  ok(im.read(again).quality === 'high', `${name}: stamping again REPLACES the packet`);
  ok((again.toString('latin1').match(/<x:xmpmeta/g) || []).length === 1, `${name}: …and does not stack a second one`);
  // the picture data is byte-for-byte where it was
  if (name === 'webp') {
    ok(out.indexOf(src.slice(12)) > 0, 'webp: the VP8L chunk is untouched inside the stamped file');
    ok(out.slice(12, 16).toString() === 'VP8X' && (out[20] & 0x04), 'webp: a VP8X header announces the XMP');
    ok(out.readUIntLE(24, 3) === 36 && out.readUIntLE(27, 3) === 20, 'webp: the canvas in VP8X matches the VP8L dims');
    ok(out.readUInt32LE(4) === out.length - 8, 'webp: the RIFF size is right');
  }
  if (name === 'png') {
    ok(out.indexOf(src.slice(8, 33)) === 8, 'png: IHDR untouched');
    const idat = out.indexOf('IDAT'), itxt = out.indexOf('iTXt');
    ok(itxt > 0 && itxt < idat, 'png: the packet sits BEFORE the pixel data (libvips only reads it there)');
    ok(out.slice(-12).equals(src.slice(-12)), 'png: IEND untouched');
  }
  if (name === 'jpeg') {
    ok(out.indexOf(Buffer.from([0xff, 0xda])) > out.indexOf('http://ns.adobe.com/xap'), 'jpeg: the APP1 comes before the scan');
    ok(out.slice(2, 20).equals(src.slice(2, 20)), 'jpeg: APP0 stays first');
  }
}

// 2 — what must NOT happen
{
  const w = webpLossless();
  ok(im.stamp(w, {}) === w, 'nothing to say → the same buffer back');
  ok(im.stamp(Buffer.from('not a picture at all, hello'), FIELDS).toString() === 'not a picture at all, hello', 'a foreign file is untouched');
  ok(im.read(Buffer.from('hello')) === null && im.read(w) === null, 'no packet → null, never a guess');
  const trunc = im.stamp(w, FIELDS).slice(0, 40);
  ok(im.stamp(trunc, FIELDS) === trunc, 'a truncated file is left alone rather than rebuilt wrong');
  const ctrl = im.read(im.stamp(w, { promptContent: 'a\x01b' }));
  ok(ctrl.promptContent === 'ab', 'a control character is dropped, not written into XML');
  ok(im.read(im.stamp(w, { promptContent: 'x', bogus: 'y' })).bogus === undefined, 'an unknown field is not written');
}

// 3 — the packet is what Photos reads: dc:description = her words
{
  const p = im.packet(FIELDS);
  ok(/<dc:description>[\s\S]*a fox &lt;in&gt; a &quot;raincoat&quot; &amp; hat/.test(p), 'dc:description carries the content half, escaped');
  ok(/x:xmptk="ImageForge"/.test(p) && /<\?xpacket end="w"\?>/.test(p), 'a real xpacket');
  ok(im.parsePacket(p.replace(/<forge:[\s\S]*<\/forge:canvas>/, '')).promptContent === FIELDS.promptContent,
    'a packet with only dc:description (another tool’s) still yields a caption');
  ok(im.caption(FIELDS) === 'gpt-image-2 · medium · 2K', 'the caption is the three slots');
  assert.deepStrictEqual(im.promptHalves(FIELDS), { promptStyle: FIELDS.promptStyle, promptContent: FIELDS.promptContent }); n++;
  ok(Object.keys(im.promptHalves({ model: 'x' })).length === 0, 'no halves → nothing to patch');
}

// 4 — the ranged reader: tail for webp, head for jpeg, and it never trusts a
//     server that ignored the Range; then 5 — the source pins
(async () => {
  const w = im.stamp(webpLossless(), FIELDS);
  const frag = im.readFragment(w.slice(20));      // no RIFF head: the walk cannot run, the packet is whole
  ok(frag && frag.size === '2K', 'a tail fragment reads');
  const fake = (body) => async (url, opts) => {
    const r = String(opts.headers.Range);
    let b = body;
    const m = r.match(/^bytes=-(\d+)$/); if (m) b = body.slice(Math.max(0, body.length - +m[1]));
    const h = r.match(/^bytes=0-(\d+)$/); if (h) b = body.slice(0, +h[1] + 1);
    return { ok: true, status: 206, arrayBuffer: async () => b };
  };
  const t = await im.readRemote('https://x/y.webp', { fetchFn: fake(w), bytes: 2048 });
  ok(t && t.model === 'gpt-image-2', 'readRemote finds a webp packet from the tail alone');
  const j = im.stamp(jpeg(), FIELDS);
  const jj = await im.readRemote('https://x/y.jpg', { fetchFn: fake(j), bytes: 2048 });
  ok(jj && jj.quality === 'medium', 'readRemote finds a jpeg packet from the head');
  const none = await im.readRemote('https://x/z.webp', { fetchFn: fake(webpLossless()), bytes: 2048 });
  ok(none === null, 'an unstamped file answers null');
  const big = Buffer.concat([Buffer.alloc(40000), w]);
  const ignored = await im.readRemote('https://x/big', { fetchFn: async () => ({ ok: true, status: 200, arrayBuffer: async () => big }), bytes: 1024 });
  ok(ignored === null, 'a server that ignores Range (whole file back) is refused rather than downloaded');
  ok((await im.readRemote('not a url')) === null, 'a bad url answers null');

  // 5 — SOURCE PIN: every picture save on the server hands the file its prompt
  const srv = fs.readFileSync(root('server.js'), 'utf8');
  ok(/if \(stamp\) buffer = imageMeta\.stamp\(buffer, stamp\);/.test(srv), 'saveBufferToFirebase stamps when handed fields');
  const sites = [
    ["'promptlab', plStamp(cfg, st)", 'the Playground single run'],
    ['stampFor ? stampFor(urls.length, r) : undefined', 'every cut panel'],
    ['label: `the sheet — ${plan.count} panels`,\n    });', 'the banked sheet'],
    ["'openai',\n      { fullPrompt: prompt", '/api/generate/gptimage'],
    ["'housestyle', {\n      ...promptRecord.promptRecord", '/api/generate/housestyle'],
    ["'dalle',\n      { fullPrompt: prompt", '/api/generate/dalle'],
    ["engine: 'replicate',\n    })));", 'the LoRA run'],
  ];
  for (const [needle, what] of sites) ok(srv.includes(needle), `${what} stamps its file`);
  ok(/imageMeta\.readRemote\(wipUrl\)/.test(srv) && /imageMeta\.readRemote\(finalUrl\)/.test(srv), 'POST /api/gallery reads the file’s own prompt back on both doors');
  ok(/fileMeta = imageMeta\.read\(buf\)/.test(srv), '…and off inline bytes without a fetch');
  for (const [f, needle] of [
    ['freeform.js', "require('./image-meta').stamp(buf, stamp)"],
    ['triset.js', "require('./image-meta').stamp(buf, stamp)"],
    ['scripts/post-to-gallery.js', "require('../image-meta').stamp(fs.readFileSync(file), stamp || {})"],
  ]) ok(fs.readFileSync(root(f), 'utf8').includes(needle), `${f} stamps its uploads`);
  ok(/stamp: \{[\s\S]*fullPrompt: promptRec\.fullPrompt \|\| sent/.test(fs.readFileSync(root('freeform.js'), 'utf8')), 'freeform hands render the run’s own record');
  // the iOS saver carries the packet through its PNG re-encode
  const swift = fs.readFileSync(root('ios/ImageForge/CreationsView.swift'), 'utf8');
  ok(/CGImageMetadataCreateFromXMPData/.test(swift) && /xmpPacket\(inWebP/.test(swift), 'PhotoSaver carries the webp XMP into the PNG it hands Photos');

  console.log(`test-image-meta: ${n} checks passed`);
})().catch((e) => { console.error(e.message); process.exit(1); });
