#!/usr/bin/env python3
"""Stage 3 of the voice-training pipeline: assemble prepped files into chunks.

    python3 scripts/chunk-voice-training.py <prepped.tsv> <prep-dir> <out-dir>

Reads the TSV that prep-voice-training.sh emits (SKIP rows are ignored), joins
the files chronologically by filename, and writes ~30 minute mono mp3s — the
upload size ElevenLabs asks for.

Two details that matter:

* 0.3s of silence between recordings. Butting two unrelated takes together
  produces a click at the splice, and a clone will happily learn the click.
* Chronological order. Not required by the model, but it makes a chunk's
  contents predictable when you later need to find and remove one bad take.
"""
import json
import os
import subprocess
import sys

FF = os.environ.get('FFMPEG_PATH', 'node_modules/ffmpeg-static/ffmpeg')
FP = os.environ.get('FFPROBE_PATH', 'node_modules/ffprobe-static/bin/linux/x64/ffprobe')
MAX_CHUNK = int(os.environ.get('CHUNK_SECONDS', '1800'))
GAP = 0.3

tsv, prep_dir, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]

# A prepped row has 6 fields; a SKIP row has 3.
rows = [l.rstrip('\n').split('\t') for l in open(tsv) if l.strip()]
files = sorted((r[0].rsplit('.', 1)[0], float(r[2])) for r in rows if len(r) >= 6)
if not files:
    sys.exit('no prepped files in ' + tsv)
print(f'{len(files)} files, {sum(d for _, d in files) / 60:.0f} min')

os.makedirs(out_dir, exist_ok=True)
gap = os.path.join(out_dir, '_gap.wav')
subprocess.run([FF, '-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono',
                '-t', str(GAP), '-c:a', 'pcm_s16le', gap], check=True)

chunks, cur, cur_len = [], [], 0.0
for name, dur in files:
    if cur and cur_len + dur > MAX_CHUNK:
        chunks.append(cur)
        cur, cur_len = [], 0.0
    cur.append(name)
    cur_len += dur + GAP
if cur:
    chunks.append(cur)

manifest = []
for i, names in enumerate(chunks, 1):
    lst = os.path.join(out_dir, f'_concat-{i}.txt')
    with open(lst, 'w') as fh:
        for j, name in enumerate(names):
            if j:
                fh.write("file '%s'\n" % os.path.abspath(gap))
            fh.write("file '%s'\n" % os.path.abspath(os.path.join(prep_dir, name + '.wav')))
    out = os.path.join(out_dir, f'chunk-{i:02d}.mp3')
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst,
                    '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '48000', '-ac', '1', out], check=True)
    dur = float(subprocess.run([FP, '-v', 'error', '-show_entries', 'format=duration',
                                '-of', 'csv=p=0', out], capture_output=True, text=True).stdout.strip())
    print(f'{out}  {dur / 60:.1f} min  {os.path.getsize(out) / 1e6:.1f} MB  ({len(names)} recordings)')
    manifest.append({'file': os.path.basename(out), 'seconds': round(dur), 'recordings': names})

json.dump(manifest, open(os.path.join(out_dir, 'manifest.json'), 'w'), indent=2)
print(f'total {sum(m["seconds"] for m in manifest) / 3600:.2f} hours in {len(manifest)} chunks')
