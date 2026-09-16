#!/usr/bin/env python3
"""lightroom-sync.py — send the necklace photos from a Lightroom Classic
catalog to Deck Factory WITHOUT exporting anything.

Sophie's mom has ~4,000 pictures in Lightroom Classic and no patience for an
export (2026-09-16: "too many to export" · "she has tons of files"). This
reads the catalog file itself (it is a SQLite database) for every picture's
title, folder and collections, takes each picture's already-rendered
preview out of Lightroom's own preview cache (the "… Previews.lrdata"
folder beside the catalog — no export, no re-encode, the originals are
never opened), picks the preview level around 1,000px, and POSTs it to
/api/lightroom/photo. Only the pictures whose folder or collection name
matches --match (default "necklace") are sent; the rest of her catalog
stays on her computer.

Stdlib only, so it runs on the Python that the Microsoft Store installs in
one click. Re-running is safe: it asks the server what it already has and
skips those, so a stopped run resumes where it left off.

  python lightroom-sync.py                      finds the newest .lrcat itself
  python lightroom-sync.py --catalog "C:\\…\\x.lrcat"
  python lightroom-sync.py --dry                counts, sends nothing
  python lightroom-sync.py --limit 20           a few first, to verify
  python lightroom-sync.py --match necklace     the folder/collection word
  python lightroom-sync.py --all                every folder, not just one

The Windows launcher (lightroom-sync.bat) runs this with `py -3` and keeps
the window open at the end so she can read the last line.
"""
import argparse, glob, hashlib, io, json, os, re, shutil, sqlite3, struct, sys, tempfile, time, urllib.parse, urllib.request

SERVER = 'https://imageforge-q125.onrender.com'
WANT_WIDTH = 1000      # the preview level we send: the smallest one at least this wide
MAX_BYTES = 8 * 1024 * 1024

# ─── finding the catalog ───────────────────────────────────────────────
def find_catalog():
    home = os.path.expanduser('~')
    roots = [os.path.join(home, 'Pictures', 'Lightroom'), os.path.join(home, 'Pictures'),
             os.path.join(home, 'Documents'), os.path.join(home, 'OneDrive', 'Pictures'),
             os.path.join(home, 'OneDrive', 'Documents'), os.path.join(home, 'Desktop')]
    found = []
    for r in roots:
        if not os.path.isdir(r): continue
        for depth in ('*.lrcat', '*/*.lrcat', '*/*/*.lrcat'):
            for p in glob.glob(os.path.join(r, depth)):
                if os.path.isfile(p): found.append(p)
    found = sorted(set(found), key=lambda p: os.path.getmtime(p), reverse=True)
    return found

def open_copy(path):
    """Lightroom keeps the catalog open; a copy is the safe thing to read."""
    tmp = os.path.join(tempfile.gettempdir(), 'lightroom-sync-' + str(os.getpid()) + '.lrcat')
    shutil.copyfile(path, tmp)
    return sqlite3.connect('file:' + urllib.request.pathname2url(tmp) + '?mode=ro', uri=True), tmp

def columns(db, table):
    try: return [r[1] for r in db.execute('PRAGMA table_info(%s)' % table)]
    except sqlite3.Error: return []

def tables(db):
    return [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")]

# ─── titles ─────────────────────────────────────────────────────────────
TITLE_RE = re.compile(r'<dc:title>.*?<rdf:li[^>]*>(.*?)</rdf:li>', re.S | re.I)
def xmp_title(xmp):
    if not xmp: return ''
    if isinstance(xmp, bytes): xmp = xmp.decode('utf-8', 'ignore')
    m = TITLE_RE.search(xmp)
    if m: return unescape(m.group(1)).strip()
    m = re.search(r'dc:title="([^"]*)"', xmp)
    return unescape(m.group(1)).strip() if m else ''

def unescape(s):
    return (s.replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
             .replace('&#39;', "'").replace('&apos;', "'").replace('&amp;', '&'))

def read_titles(db):
    """{image id: title}. The IPTC table when it carries a title column, else
    the XMP packet Lightroom keeps per picture (dc:title)."""
    titles = {}
    if 'AgLibraryIPTC' in tables(db):
        cols = columns(db, 'AgLibraryIPTC')
        for c in ('title', 'headline'):
            if c in cols:
                for img, t in db.execute('SELECT image, %s FROM AgLibraryIPTC' % c):
                    if t and str(t).strip() and img not in titles: titles[img] = str(t).strip()
    if 'Adobe_AdditionalMetadata' in tables(db) and 'xmp' in columns(db, 'Adobe_AdditionalMetadata'):
        for img, xmp in db.execute('SELECT image, xmp FROM Adobe_AdditionalMetadata'):
            if img in titles: continue
            t = xmp_title(xmp)
            if t: titles[img] = t
    return titles

def read_images(db):
    """Every picture with its file, folder and root folder."""
    rows = db.execute('''
      SELECT i.id_local, i.captureTime, i.fileFormat, i.orientation,
             f.baseName, f.extension, fo.pathFromRoot, rf.absolutePath
      FROM Adobe_images i
      JOIN AgLibraryFile f ON f.id_local = i.rootFile
      JOIN AgLibraryFolder fo ON fo.id_local = f.folder
      JOIN AgLibraryRootFolder rf ON rf.id_local = fo.rootFolder''').fetchall()
    out = {}
    for (iid, cap, fmt, orient, base, ext, path, root) in rows:
        out[iid] = { 'id': iid, 'captured': cap or '', 'format': fmt or '', 'orientation': orient or '',
                     'file': (base or '') + ('.' + ext if ext else ''), 'folder': (path or ''),
                     'root': root or '' }
    return out

def read_collections(db):
    cols = {}
    if 'AgLibraryCollectionImage' not in tables(db): return cols
    for img, name in db.execute('''SELECT ci.image, c.name FROM AgLibraryCollectionImage ci
                                   JOIN AgLibraryCollection c ON c.id_local = ci.collection'''):
        cols.setdefault(img, []).append(name or '')
    return cols

# ─── the preview cache ─────────────────────────────────────────────────
def previews_dir(catalog_path):
    stem = os.path.splitext(catalog_path)[0]
    for cand in (stem + ' Previews.lrdata', stem + '-Previews.lrdata'):
        if os.path.isdir(cand): return cand
    return None

def read_preview_index(pdir):
    """{image id: path to its .lrprev}. previews.db names the uuid+digest; the
    file sits at <uuid[0]>/<uuid[0:4]>/<uuid>-<digest>.lrprev."""
    dbp = os.path.join(pdir, 'previews.db')
    if not os.path.isfile(dbp): return {}
    tmp = os.path.join(tempfile.gettempdir(), 'lightroom-sync-previews-' + str(os.getpid()) + '.db')
    shutil.copyfile(dbp, tmp)
    db = sqlite3.connect('file:' + urllib.request.pathname2url(tmp) + '?mode=ro', uri=True)
    index = {}
    for t in tables(db):
        cols = columns(db, t)
        if 'imageId' in cols and 'uuid' in cols and 'digest' in cols:
            for img, uuid, digest in db.execute('SELECT imageId, uuid, digest FROM %s' % t):
                if not uuid or not digest: continue
                p = os.path.join(pdir, uuid[0], uuid[:4], '%s-%s.lrprev' % (uuid, digest))
                if os.path.isfile(p): index[img] = p
    db.close()
    try: os.remove(tmp)
    except OSError: pass
    return index

SOI = b'\xff\xd8\xff'
def jpeg_levels(buf):
    """Every JPEG inside an .lrprev, as (width, height, bytes). The file is
    Lightroom's own container (AgHg chunks, one per pyramid level); the JPEGs
    inside it are plain, so scanning for them needs no format knowledge."""
    out, i = [], 0
    while True:
        a = buf.find(SOI, i)
        if a < 0: break
        b = buf.find(b'\xff\xd9', a + 2)
        if b < 0: break
        data = buf[a:b + 2]
        wh = jpeg_size(data)
        if wh: out.append((wh[0], wh[1], data))
        i = b + 2
    return out

def jpeg_size(data):
    i = 2
    n = len(data)
    while i + 9 < n:
        if data[i] != 0xFF: i += 1; continue
        marker = data[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7: i += 2; continue
        if i + 4 > n: return None
        seg = struct.unpack('>H', data[i + 2:i + 4])[0]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            if i + 9 > n: return None
            h, w = struct.unpack('>HH', data[i + 5:i + 9])
            return (w, h)
        i += 2 + seg
    return None

def pick_level(levels, want=WANT_WIDTH):
    if not levels: return None
    big = [l for l in levels if max(l[0], l[1]) >= want]
    if big: return min(big, key=lambda l: max(l[0], l[1]))
    return max(levels, key=lambda l: max(l[0], l[1]))

# ─── which pictures ────────────────────────────────────────────────────
def wanted(img, collections, match):
    if not match: return True
    m = match.lower()
    if m in (img['folder'] or '').lower(): return True
    return any(m in (c or '').lower() for c in collections)

# ─── the server ────────────────────────────────────────────────────────
def http(method, url, body=None, headers=None, tries=3):
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            if 400 <= e.code < 500 and e.code != 429: return e.code, e.read()
            last = e
        except Exception as e:
            last = e
        time.sleep(2 * (attempt + 1))
    raise last

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--catalog'); ap.add_argument('--server', default=SERVER)
    ap.add_argument('--match', default='necklace'); ap.add_argument('--all', action='store_true')
    ap.add_argument('--limit', type=int, default=0); ap.add_argument('--dry', action='store_true')
    ap.add_argument('--name', help='a name for this catalog on the site (default: the file name)')
    args = ap.parse_args()

    path = args.catalog
    if not path:
        found = find_catalog()
        if not found:
            print('No Lightroom catalog (.lrcat) found under Pictures, Documents or Desktop.')
            print('Run again with --catalog "C:\\path\\to\\your catalog.lrcat"'); return 2
        path = found[0]
        if len(found) > 1: print('Several catalogs found; using the newest:')
    print('Catalog:', path)
    pdir = previews_dir(path)
    print('Previews:', pdir or 'NOT FOUND — Lightroom has not built previews next to this catalog')
    slug = re.sub(r'[^a-z0-9]+', '-', (args.name or os.path.splitext(os.path.basename(path))[0]).lower()).strip('-') or 'catalog'

    db, tmp = open_copy(path)
    try:
        images = read_images(db)
        titles = read_titles(db)
        cols = read_collections(db)
    finally:
        db.close()
        try: os.remove(tmp)
        except OSError: pass
    match = None if args.all else args.match
    keep = [img for img in images.values() if wanted(img, cols.get(img['id'], []), match)]
    keep.sort(key=lambda i: (i['folder'], i['file']))
    print('%d pictures in the catalog, %d in "%s"' % (len(images), len(keep), match or 'everything'))
    titled = sum(1 for i in keep if titles.get(i['id']))
    print('%d of them have a title' % titled)
    index = read_preview_index(pdir) if pdir else {}
    have_prev = sum(1 for i in keep if i['id'] in index)
    print('%d of them have a preview in the cache' % have_prev)
    if args.dry:
        for i in keep[:15]:
            print('  ', i['file'], '|', titles.get(i['id'], '(no title)'), '|', i['folder'], '| preview' if i['id'] in index else '| NO preview')
        print('(dry run — nothing sent)'); return 0

    have = set()
    try:
        st, body = http('GET', args.server + '/api/lightroom/have?catalog=' + urllib.parse.quote(slug))
        if st == 200: have = set(json.loads(body).get('images', []))
    except Exception as e:
        print('Could not reach the site:', e); return 3
    print('The site already has %d of these' % len(have))

    sent = skipped = failed = 0
    todo = [i for i in keep if str(i['id']) not in have and i['id'] not in have]
    already = len(keep) - len(todo)
    left = 0
    if args.limit and len(todo) > args.limit:
        left = len(todo) - args.limit
        todo = todo[:args.limit]
    for n, img in enumerate(todo, 1):
        data = None; w = h = 0
        p = index.get(img['id'])
        if p:
            try:
                with open(p, 'rb') as f: buf = f.read()
                lvl = pick_level(jpeg_levels(buf))
                if lvl: w, h, data = lvl
            except OSError: pass
        if data is None:
            orig = os.path.join(img['root'], img['folder'], img['file'])
            if img['file'].lower().endswith(('.jpg', '.jpeg')) and os.path.isfile(orig) and os.path.getsize(orig) <= MAX_BYTES:
                with open(orig, 'rb') as f: data = f.read()
        if data is None:
            skipped += 1; continue
        q = { 'catalog': slug, 'image': img['id'], 'title': titles.get(img['id'], ''), 'folder': img['folder'],
              'file': img['file'], 'captured': img['captured'], 'w': w, 'h': h,
              'collections': '|'.join(cols.get(img['id'], []))[:500], 'total': len(keep) }
        url = args.server + '/api/lightroom/photo?' + urllib.parse.urlencode(q)
        try:
            st, body = http('POST', url, data, {'Content-Type': 'image/jpeg'})
            if st == 200: sent += 1
            else: failed += 1; print('  failed', img['file'], st, body[:120])
        except Exception as e:
            failed += 1; print('  failed', img['file'], e)
        if n % 25 == 0 or n == len(todo):
            print('%d of %d sent' % (n, len(todo)))
    print('Done: %d sent, %d already there, %d without a preview, %d failed%s' % (sent, already, skipped, failed, (', %d left for the next run' % left) if left else ''))
    print('Pick them at %s/lightroom?catalog=%s' % (args.server, slug))
    return 0

if __name__ == '__main__':
    try: sys.exit(main() or 0)
    except KeyboardInterrupt: print('\nstopped — run again to continue'); sys.exit(1)
