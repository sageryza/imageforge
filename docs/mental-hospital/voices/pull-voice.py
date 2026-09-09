#!/usr/bin/env python3
# pull-voice.py — cut ONE character's voice out of a clip we already shot and file it
# as an mp3 in the Dump, so it can ride a Seedance job as [Audio1].
# Usage:  python3 pull-voice.py <name> <clip-url-or-mp4> <start-seconds> <end-seconds>
# Free: ffmpeg in this container, no model call, nothing sent to any door.
# The span must be a stretch where ONLY that character speaks — check the script first.
import json, os, subprocess, sys, urllib.request, imageio_ffmpeg
name, src, a, b = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
FF = imageio_ffmpeg.get_ffmpeg_exe()
B = 'https://imageforge-q125.onrender.com'
if src.startswith('http'):
    urllib.request.urlretrieve(src, 'src-tmp.mp4'); src = 'src-tmp.mp4'
out = f'{name}.mp3'
subprocess.run([FF, '-y', '-ss', str(a), '-to', str(b), '-i', src, '-vn', '-ac', '1',
                '-ar', '44100', '-b:a', '128k', out], check=True, capture_output=True)
up = subprocess.run(['curl', '-sS', '-X', 'POST',
                     f'{B}/api/drop/upload-file?session=soap-voices&bundle=Ward%20%E2%86%92%20voices&filename={out}',
                     '-H', 'content-type: audio/mpeg', '--data-binary', f'@{out}'],
                    capture_output=True, text=True).stdout
it = json.loads(up)['item']
v = json.load(open('voices.json')) if os.path.exists('voices.json') else {}
v[name] = {'id': it['id'], 'url': it['url'], 'from': os.path.basename(sys.argv[2]), 'span': [a, b]}
json.dump(v, open('voices.json', 'w'), indent=1)
print(name, f'{b-a:.2f}s', it['url'])
