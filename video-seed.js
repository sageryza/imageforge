'use strict';
// video-seed.js — EVERY Seedance clip carries a seed, minted if the caller
// did not pass one (Sophie, 2026-09-09: "random seed yes but make it
// enforced and widespread").
//
// WHAT A SEED IS AND IS NOT, measured the same night on 2.0 Mini with
// `ffmpeg psnr` (identical video would be infinite; every md5 differed):
//   same seed + IDENTICAL prompt   27.1 dB overall — 33.2 at t=0, 24.5 by 3.5s
//   different seed + same prompt   21.5 dB overall — 29.7 at t=0, 18.8 by 3.5s
//   same seed, ONE sentence moved  16.8 dB
//   same seed at 720p not 480p     16.2 dB
//   no seed, different prompts     16.1 dB
// AND THE GRIP FALLS OFF HARD WITH LENGTH — the same test at 15s (two clips
// sent byte-identical, seed 7) is 17.8 dB at t=0 and 13.5 overall, against
// 33.2 and 27.1 on the 4s pair and 16.1 for two unrelated runs. So at the
// lengths this film actually shoots, a pinned seed does close to nothing.
// So a seed REPRODUCES THE OPENING OF A SHORT CLIP AND THEN DRIFTS. It does not reproduce a
// clip, it does not survive a changed prompt, and it does not survive a
// resolution change — you cannot block a shot at 480p and re-render the
// keeper at 720p, and you cannot isolate one prompt line with it.
//
// WHY MINT ONE ANYWAY: nothing ever hands a seed BACK. APIFRAME echoes only
// the params that were sent and OpenRouter's finished job carries id, status
// and usage — so a clip sent without a seed has no seed, ever, and the
// seeds of everything shot before this are gone. Minting one puts the number
// on the record (it rides `params` into `forge-video-jobs`) for free.
//
// A FRESH RANDOM ONE PER CLIP, NEVER A HOUSE CONSTANT: a fixed seed
// reproduces openings, so one number across a film risks every clip starting
// with the same family resemblance. A caller's own seed always wins — that is
// how a deliberate A/B pins one.
//
// Test: node scripts/test-video-seed.js

// 1 … 2^31-1. Zero is skipped: several image and video APIs read 0 as
// "unset", so a zero seed would be a seed that silently is not one.
function randomSeed() {
  return Math.floor(Math.random() * 2147483646) + 1;
}

// The seed a job should carry: the caller's if they gave a usable one, else a
// fresh mint. A non-numeric or out-of-range value is replaced rather than
// sent — an unusable seed on the wire is worse than a new one on the record.
function seedFor(given) {
  const n = Number(given);
  if (given != null && Number.isFinite(n) && Math.floor(n) === n && n >= 1 && n <= 2147483647) return n;
  return randomSeed();
}

// Which models take a seed at all. The Seedance 2.x family declares
// `seed: true` on its served model card; the 1.x models have no such control
// and APIFRAME refuses an unknown param rather than ignoring it, so a 1.x
// job is left exactly as it was.
function takesSeed(model) {
  return /^(bytedance\/)?seedance-2/.test(String(model || '').trim().toLowerCase());
}

module.exports = { randomSeed, seedFor, takesSeed };
