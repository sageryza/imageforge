'use strict';
/*
 * asset-union.js — ONE picture, ONE tile in a chat's Assets tab.
 *
 * THE PROBLEM THIS EXISTS FOR. The same picture reaches a chat's Assets tab by
 * more than one road: the storage object where it was generated
 * (…/witch-school/assets/<id>.png), and the copy the server makes when the same
 * image is ALSO sent as a chat file (…/claude-deliveries/<random>.png, written
 * by POST /api/gallery from a data URL). The tab used to join those copies by
 * FILENAME, which works only when the filename survives the trip — and the
 * claude-deliveries copy is named `<ms>-<random>.<ext>`, so it never can. The
 * result Sophie sees is her labeled portrait sitting next to an unlabeled twin
 * of itself.
 *
 * THE FAIL-SAFE. Records now join on CONTENT as well as on filename:
 *
 *   md5   — the Storage object's own md5, read from object METADATA at filing
 *           time (never by downloading bytes). Two copies of the same bytes
 *           under any two filenames collapse onto one tile.
 *   hash  — the sha256 of the bytes that POST /api/gallery already computes
 *           when a picture arrives inline (see findChatAsset in server.js).
 *           A DIFFERENT algorithm on purpose, hence its own key namespace:
 *           md5 comes free from Storage, sha256 comes free from bytes in hand,
 *           and neither is worth paying a download to convert into the other.
 *   file  — the filename, exactly as before, for every record that carries no
 *           hash of either kind (everything filed before Aug 2026).
 *
 * PROOF BEATS EVIDENCE. A content hash proves two records are the same bytes;
 * a shared url or filename only says they share an address, and an address can
 * be re-pointed (a fixed storage path overwritten with new bytes). So hashes
 * join first and unconditionally, and a weak key may never merge two groups
 * whose hashes disagree — the veto. Where it is ambiguous the code errs toward
 * TWO tiles, because a duplicate is visible and a wrong merge HIDES a picture.
 *
 * GROUPING IS TRANSITIVE, and it has to be: A can share its md5 with B while B
 * shares its filename with C, and all three are one picture. A per-key pass
 * would leave that chain as two tiles, so the join is union-find over the whole
 * page and each group is folded in one go.
 *
 * MERGING IS UNCHANGED — the rules below came from the filename union and are
 * kept declaration for declaration: every field that has something in it
 * survives whichever copy carried it, a curated "gpt-image-2 · medium" caption
 * beats the hook's "from <chat>", the url kept is the one Sophie's label and
 * prompt are attached to, and the others ride along as `alts` (which is what
 * keeps a ♥ or a note left on the other path findable).
 *
 * Pure and dependency-free so scripts/test-asset-hash-union.js can drive it
 * with fixture records and no network.
 */

// Audio rides the same records as images; an untagged doc (filed before the
// kind field existed) is still recognised by its url.
const AUDIO_URL_RE = /\.(mp3|m4a|wav|ogg|aac|flac)([?#]|$)/i;

/**
 * The filename key — the identity the tab used before content hashes existed,
 * and still the only one most older records have.
 */
function filenameKey(url) {
  const clean = String(url || '').split('?')[0].split('#')[0];
  // decodeURIComponent THROWS on malformed %-sequences, and one bad url in the
  // collection used to abort the whole union mid-forEach — a chat's Assets tab
  // silently showed almost nothing (a literal "%s.webp" template string the
  // hook had filed as an image did exactly this, Aug 2026).
  const raw = clean.split('/').pop() || '';
  let base;
  try { base = decodeURIComponent(raw).toLowerCase(); }
  catch (e) { base = raw.toLowerCase(); }
  return base || clean;
}

const norm = (v) => String(v || '').trim().toLowerCase();
const urlKey = (url) => String(url || '').split('?')[0].split('#')[0].trim().toLowerCase();

/**
 * PROOF keys — a content hash. Two records carrying the same one ARE the same
 * bytes, so these joins are unconditional. Namespaced, so an md5 can never be
 * compared against a sha256 (they are hashes of the same bytes and will never
 * be equal — silently failing to group is exactly the bug this module exists
 * to fix).
 */
function strongKeys(rec) {
  const keys = [];
  const md5 = norm(rec.md5);
  const sha = norm(rec.hash);
  if (md5) keys.push('m:' + md5);
  if (sha) keys.push('s:' + sha);
  return keys;
}

/**
 * EVIDENCE keys — a shared address, not shared bytes. Strong enough to join on
 * when nothing contradicts it, and vetoed by a content hash that does (see
 * THE HASH VETO in unionAssets).
 */
function weakKeys(rec) {
  const keys = [];
  // THE EXACT URL. Two records pointing at the identical url are almost always
  // the same picture — far better evidence than a shared basename, which is
  // what caused the vector-sheet bug (those were DIFFERENT urls that happened
  // to end in `sheet.png`).
  //
  // Without it, the two records this tab is built from could not join when
  // only one of them carried a hash: the tab reads iOS creations (which the
  // hook files WITH the sha256 of the bytes it posted) and forge-chat-assets
  // (which a chat writes from a url alone, so no hash at all). Same url, one
  // key in the `s:` namespace and one in `f:`, never compared — so Sophie saw
  // every image she was sent twice, once bare and once labelled, and labelling
  // the asset record could never fix the bare creation beside it.
  // Measured 2026-08-15: 7 pictures, 14 tiles, 7 docs.
  //
  // It is EVIDENCE and not proof because a url is an address, and an address
  // can be re-pointed: a fixed storage path (`vector/<name>/sheet.png`,
  // `refs/style.png`) overwritten with new bytes leaves two records agreeing
  // on the url and describing two different pictures. Measured 2026-08-16
  // across all 5,197 asset records in every chat: 274 urls are held by more
  // than one record and ZERO of them have hashes that disagree — so this is a
  // guard against a case that has not happened yet, not a repair of one that
  // has.
  const u = urlKey(rec.url);
  if (u) keys.push('u:' + u);
  // FILENAME ONLY WHEN THERE IS NO CONTENT HASH — which is what the note at the
  // top of this file always said this key was for ("for every record that
  // carries no hash of either kind"), but the code added it unconditionally and
  // a filename then OUTVOTED the bytes.
  //
  // Measured live 2026-08-14: the vector pipeline writes every sheet to
  // `vector/<name>/sheet.png`, so SEVEN different sheets — six objects, nine
  // heads, private scenes, four palettes of the same nine moments — collapsed
  // into ONE tile carrying one label, with the other six hidden as `alts`.
  // Sophie reported it as her images not posting; the posts had all succeeded.
  // Union-find is transitive, so one shared basename pulls the whole family in.
  //
  // Records filed before Aug 2026 carry no hash at all and still join each
  // other exactly as they used to, and the two-paths-one-picture case this
  // module was built for is unaffected — a claude-deliveries copy is named
  // `<ms>-<random>.<ext>` and never matched by filename anyway, which is the
  // whole reason content hashing was added.
  if (norm(rec.md5) || norm(rec.hash)) return keys;
  const f = filenameKey(rec.url);
  if (f) keys.push('f:' + f);
  return keys;
}

/**
 * Every key a record can be joined on, proof first. Kept as one function
 * because the tests and any future reader want the whole identity of a record
 * in one place; unionAssets uses the two halves separately so it can rank them.
 */
function joinKeys(rec) {
  return strongKeys(rec).concat(weakKeys(rec));
}

function seedTile(r) {
  return {
    url: r.url,
    ms: r.ms || 0,
    prompt: r.prompt || '',
    description: r.description || '',
    promptStyle: r.promptStyle || '',
    promptContent: r.promptContent || '',
    kind: r.kind || '',
    // Damage is a property of the BYTES, so it belongs to the picture and not
    // to whichever record happened to carry it — see foldTile.
    compressedAtBirth: !!r.compressedAtBirth,
    alts: [],
  };
}

/** Fold one more copy of the same picture into the tile already built. */
function foldTile(existing, r) {
  const { url, ms, prompt, description, promptStyle: style, promptContent: content, kind } = r;
  if (kind && !existing.kind) existing.kind = kind;
  // COMPRESSED AT BIRTH IS AN OR ACROSS THE GROUP. The records in a group are
  // the same bytes — that is what joined them — so if any copy is known
  // damaged, the picture is damaged. Tagging reaches records by url and by
  // md5, but a record carrying neither (an older doc with no md5 on file,
  // joined in on its filename) would otherwise drag an untagged `false` onto
  // the tile and hide the mark on a picture Sophie is looking at.
  if (r.compressedAtBirth) existing.compressedAtBirth = true;
  // Same picture arriving by its other path: keep every field that has
  // something in it, whichever copy carried it.
  if (existing.url !== url && existing.alts.indexOf(url) < 0) existing.alts.push(url);
  // Checked BEFORE the merge below — afterwards every copy looks "rich",
  // and the preferred-url swap could never fire.
  const richer = !!(description || style || content);
  const hasOwn = !!(existing.description || existing.promptStyle || existing.promptContent);
  if (style && !existing.promptStyle) existing.promptStyle = style;
  if (content && !existing.promptContent) existing.promptContent = content;
  // A curated tag (e.g. "gpt-image-2 · medium") beats a generic "from <chat>"
  // label for the same image, so the model/quality caption wins.
  if (prompt && !/^from /.test(prompt) && /^from /.test(existing.prompt || '')) {
    existing.prompt = prompt;
  }
  if (description && !existing.description) existing.description = description;
  // Show the copy her curation is attached to: the one that came with a label
  // or a prompt. Otherwise keep the first (newest) url.
  if (richer && !hasOwn) {
    if (existing.alts.indexOf(existing.url) < 0) existing.alts.push(existing.url);
    existing.url = url;
  }
  if ((ms || 0) > existing.ms) existing.ms = ms;
}

/**
 * records → one tile per picture.
 *
 * A record is `{url, ms, prompt, description, promptStyle, promptContent,
 * kind, hash, md5}` — see assetRecord / creationRecord below. Records with no
 * url are dropped (a doc can carry an empty one); everything else keeps its
 * arrival order, so the caller's own sort still decides what Sophie sees first.
 */
function unionAssets(records) {
  const recs = [];
  (records || []).forEach((r) => {
    if (!r || !r.url) return;
    const rec = Object.assign({}, r);
    if (!rec.kind && AUDIO_URL_RE.test(String(rec.url))) rec.kind = 'audio';
    recs.push(rec);
  });

  // Union-find. The root is always the LOWEST index in its group, so group
  // order follows first appearance however the joins happened to arrive.
  const parent = recs.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  // Each root carries the set of content hashes seen anywhere in its group —
  // that is what the veto below weighs a url against.
  const md5s = recs.map((r) => (norm(r.md5) ? new Set([norm(r.md5)]) : new Set()));
  const shas = recs.map((r) => (norm(r.hash) ? new Set([norm(r.hash)]) : new Set()));
  const join = (a, b) => {
    a = find(a); b = find(b);
    if (a === b) return;
    const root = a < b ? a : b;
    const other = a < b ? b : a;
    parent[other] = root;
    md5s[other].forEach((v) => md5s[root].add(v));
    shas[other].forEach((v) => shas[root].add(v));
  };

  // PASS 1 — the proof keys. Same bytes is same picture, no questions asked.
  const firstWithKey = new Map();
  recs.forEach((r, i) => {
    strongKeys(r).forEach((k) => {
      if (firstWithKey.has(k)) join(firstWithKey.get(k), i);
      else firstWithKey.set(k, i);
    });
  });

  // THE HASH VETO. A url is an address and an address can be re-pointed, so a
  // shared url is evidence; a differing md5 is proof of two different pictures
  // and always wins. Two groups may only be merged on a weak key when the
  // merge leaves at most one distinct md5 and at most one distinct sha256
  // across the whole group.
  //
  // Where the evidence is ambiguous this deliberately errs toward NOT merging:
  // two tiles for one picture is a duplicate Sophie can see and ask about;
  // one tile for two pictures HIDES the other behind `alts`, which is how six
  // vector sheets went missing and got reported as "my images didn't post".
  const agrees = (x, y) => {
    if (!x.size || !y.size) return true;
    if (x.size > 1 || y.size > 1) return false;
    return x.values().next().value === y.values().next().value;
  };
  const compatible = (a, b) => {
    a = find(a); b = find(b);
    return a === b || (agrees(md5s[a], md5s[b]) && agrees(shas[a], shas[b]));
  };

  // PASS 2 — the evidence keys. A key can end up with more than one accepted
  // group (that IS the veto firing), so a later record joins whichever of them
  // it does not contradict rather than the first one that shares the key.
  const seenWithKey = new Map();
  recs.forEach((r, i) => {
    weakKeys(r).forEach((k) => {
      const reps = seenWithKey.get(k);
      if (!reps) { seenWithKey.set(k, [i]); return; }
      const match = reps.find((rep) => compatible(rep, i));
      if (match === undefined) reps.push(i);
      else join(match, i);
    });
  });

  const groups = new Map();
  recs.forEach((r, i) => {
    const root = find(i);
    const g = groups.get(root);
    if (g) g.push(r); else groups.set(root, [r]);
  });

  const tiles = [];
  groups.forEach((group) => {
    const tile = seedTile(group[0]);
    for (let i = 1; i < group.length; i++) foldTile(tile, group[i]);
    tiles.push(tile);
  });
  return tiles;
}

/** A forge-chat-assets doc → a union record. */
function assetRecord(a) {
  const d = a || {};
  return {
    url: d.url,
    ms: Date.parse(d.created) || 0,
    prompt: d.prompt,
    description: d.description,
    promptStyle: d.promptStyle,
    promptContent: d.promptContent,
    kind: d.kind,
    hash: d.hash,   // sha256 of the bytes, when POST /api/gallery had them
    md5: d.md5,     // the Storage object's own md5, from its metadata
    // Written by scripts/tag-compressed-at-birth.js: this picture's ONLY copy
    // was encoded lossily before the bytes ever reached us. The bracket text
    // Sophie reads is drawn by the UI — the record just carries the fact.
    compressedAtBirth: d.compressedAtBirth,
  };
}

/** A membry `creations` doc (the iOS gallery) → a union record. */
function creationRecord(c) {
  const d = c || {};
  const ms = d.createdAt && d.createdAt.toMillis ? d.createdAt.toMillis() : 0;
  return { url: d.url, ms, prompt: d.prompt, compressedAtBirth: d.compressedAtBirth };
}

module.exports = {
  AUDIO_URL_RE, filenameKey, joinKeys, strongKeys, weakKeys,
  unionAssets, assetRecord, creationRecord,
};
