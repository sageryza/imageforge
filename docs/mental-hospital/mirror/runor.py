#!/usr/bin/env python3
# runor.py — send ONE Seedance job through the OpenRouter door (no video references),
# poll it, and file the landed clip the way runsoap.py does. Usage:
#   MODEL=seedance-2.0-mini AR=3:4 IMGS='["url",…]' python3 runor.py <key> "<title>" <prompt.txt>
# No duration is ever sent (Sophie, 2026-09-08: the model picks). Her "go" rule lives in the chat.
import json, os, sys, time, urllib.request, subprocess
key, title, pfile = sys.argv[1:4]
B = 'https://imageforge-q125.onrender.com'
S = os.environ.get('CLAUDE_CODE_REMOTE_SESSION_ID', '').replace('cse_', '')
body = {"prompt": open(pfile).read().rstrip('\n'), "model": os.environ.get('MODEL', 'seedance-2.0-mini'),
        "resolution": os.environ.get('RES', '480p'), "aspectRatio": os.environ.get('AR', '3:4'), "generateAudio": True,
        "referenceImageUrls": json.loads(os.environ.get('IMGS', '[]')), "chat": "soap-pill-scene", "scene": key,
        "title": title, "session": S}
print('BODY', json.dumps(body)[:400], flush=True)
req = urllib.request.Request(B + '/api/openrouter/video', data=json.dumps(body).encode(), headers={'content-type': 'application/json'})
try:
    r = json.loads(urllib.request.urlopen(req).read())
except urllib.error.HTTPError as e:
    print(key, 'HTTP', e.code, e.read().decode()[:600], flush=True); sys.exit(1)
json.dump(r, open(f'or-{key}-job.json', 'w'), indent=1)
jid = r.get('jobId'); print(key, 'started', jid, 'sent:', json.dumps(r.get('sent'))[:300], flush=True)
while True:
    time.sleep(15)
    j = json.loads(urllib.request.urlopen(B + f'/api/openrouter/video-job/{jid}').read())
    st = (j.get('status') or '').lower()
    if st in ('completed', 'done', 'failed', 'error', 'canceled', 'refused'): break
json.dump(j, open(f'or-{key}-final.json', 'w'), indent=1)
url = j.get('video') or j.get('url')
print(key, st.upper(), url, json.dumps(j.get('error') or j.get('refusal') or '')[:300], flush=True)
if not url: sys.exit(2)
fname = f'{key}.mp4'
urllib.request.urlretrieve(url, fname)
up = subprocess.run(['curl', '-sS', '-X', 'POST', f'{B}/api/drop/upload-file?session=seedance-cut1&bundle=Ward%20%E2%86%92%20Seedance&filename={fname}', '-H', 'content-type: video/mp4', '--data-binary', f'@{fname}'], capture_output=True, text=True).stdout
it = json.loads(up)['item']; open(f'{key}-drop.txt', 'w').write(it['id'] + ' ' + it['url'])
print(key, 'filed · save ' + B + '/api/drop/file/' + it['id'], flush=True)
rows = json.load(open('clips.json')); rows.append({'key': key, 'title': title, 'id': it['id'], 'url': it['url'], 'at': time.time()}); json.dump(rows, open('clips.json', 'w'), indent=1)
for path, b in (('/api/chatfeed/clips', {"chat": "soap-pill-scene", "session": S, "url": it['url'], "title": title}),
                ('/api/deliverables', {"chat": "soap-pill-scene", "session": S, "url": it['url'], "title": title, "kind": "video"})):
    try: urllib.request.urlopen(urllib.request.Request(B + path, data=json.dumps(b).encode(), headers={'content-type': 'application/json'}))
    except Exception as e: print(key, 'post', path, e, flush=True)
