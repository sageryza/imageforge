'use strict';
/*
 * asset-hash.js — what a Firebase Storage url is, and the md5 of the bytes it
 * points at, WITHOUT ever downloading them.
 *
 * Cloud Storage already stores every object's md5 and hands it back in the
 * object's metadata, so identifying a picture by its content costs one small
 * metadata call — the same technique scripts/drop-dedupe.js used to hash a
 * 2,717-file library with no downloads at all. That is the whole reason the
 * Assets tab can join two copies of one picture by content instead of by
 * filename (see asset-union.js).
 *
 * TWO PROJECTS, TWO BUCKETS. The same picture can live in deckfactory-43176
 * (the server's own project) or in membry-df528 (the iOS gallery's), and a
 * credential for one cannot read the other. So the bucket is resolved FROM THE
 * URL and handed to the caller's `bucketFor(name)`, which owns the admin apps
 * and answers with the right one — never guessed from which app happens to be
 * initialised.
 *
 * EVERYTHING HERE IS BEST-EFFORT. An external url, a deleted object, a
 * credential that can't see that bucket, a slow metadata call — every one of
 * them answers `null`, because filing an image must never fail or stall on a
 * dedupe hint. Node stdlib only; the bucket object is passed in.
 */

const DEFAULT_TIMEOUT_MS = 4000;
const MAX_CACHE = 5000;

const decode = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };

/**
 * A Storage url → `{bucket, path}`, or null when it isn't one.
 *
 * The three shapes that actually occur in this repo's data:
 *   https://storage.googleapis.com/<bucket>/<path>              (what saveToFirebase writes)
 *   https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encoded path>?alt=media&token=…
 *   https://<bucket>.storage.googleapis.com/<path>              (virtual-hosted style)
 */
function storageRef(url) {
  let u;
  try { u = new URL(String(url || '')); } catch (e) { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname;
  const seg = u.pathname.replace(/^\//, '').split('/').filter(Boolean);
  if (host === 'storage.googleapis.com') {
    if (seg.length < 2) return null;
    return { bucket: decode(seg[0]), path: seg.slice(1).map(decode).join('/') };
  }
  if (host === 'firebasestorage.googleapis.com') {
    // /v0/b/<bucket>/o/<one encoded segment>
    if (seg[0] !== 'v0' || seg[1] !== 'b' || seg[3] !== 'o' || !seg[2] || !seg[4]) return null;
    return { bucket: decode(seg[2]), path: seg.slice(4).map(decode).join('/') };
  }
  if (host.endsWith('.storage.googleapis.com')) {
    const bucket = host.slice(0, host.length - '.storage.googleapis.com'.length);
    if (!bucket || !seg.length) return null;
    return { bucket, path: seg.map(decode).join('/') };
  }
  return null;
}

/** Storage hands md5 back base64-encoded; every `hash` field in this repo is hex. */
const hex = (md5b64) => Buffer.from(String(md5b64), 'base64').toString('hex');

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    if (t.unref) t.unref();
    Promise.resolve(p).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); });
  });
}

/**
 * The md5 (hex) of the object a url points at, or null.
 *
 * @param url         the image url
 * @param bucketFor   (bucketName) => bucket | null, may be async — the caller
 *                    owns the admin apps and decides which credential can see it
 * @param opts.cache  a Map to remember answers in (positives only: a null may
 *                    be a transient failure and must stay retryable)
 */
async function readMd5(url, bucketFor, opts) {
  const o = opts || {};
  const ref = storageRef(url);
  if (!ref || typeof bucketFor !== 'function') return null;
  const key = ref.bucket + '/' + ref.path;
  const cache = o.cache;
  if (cache && cache.has(key)) return cache.get(key);
  try {
    const bucket = await bucketFor(ref.bucket);
    if (!bucket) return null;
    const [meta] = await withTimeout(bucket.file(ref.path).getMetadata(), o.timeoutMs || DEFAULT_TIMEOUT_MS);
    const md5 = meta && meta.md5Hash ? hex(meta.md5Hash) : null;
    if (md5 && cache) {
      if (cache.size >= MAX_CACHE) cache.clear();   // a long-lived process must not grow forever
      cache.set(key, md5);
    }
    return md5;
  } catch (e) {
    return null;   // never let a dedupe hint break, or slow, a filing
  }
}

module.exports = { storageRef, hex, readMd5 };
