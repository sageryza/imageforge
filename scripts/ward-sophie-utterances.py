import json,os,wave,numpy as np
from resemblyzer import VoiceEncoder
SP=os.environ['SP']
man={m['url']:m for m in json.load(open(SP+'/manifest.json'))}
T=json.load(open(SP+'/transcribe.json'))
enc=VoiceEncoder('cpu')
GAP=0.45
def wavread(p):
    with wave.open(p) as w: raw=w.readframes(w.getnframes())
    return np.frombuffer(raw,dtype=np.int16).astype(np.float32)/32768.0
utt=[]
for t in T:
    m=man.get(t['url'])
    if not m or not m.get('wav') or not os.path.exists(m['wav']): continue
    ws=[w for w in (t.get('words') or []) if w.get('end',0)>w.get('start',0)]
    if not ws: continue
    wav=wavread(m['wav']); dur=len(wav)/16000
    groups=[]; cur=[ws[0]]
    for w in ws[1:]:
        if w['start']-cur[-1]['end']>GAP: groups.append(cur); cur=[w]
        else: cur.append(w)
    groups.append(cur)
    name=m.get('refkey') or m.get('key') or m.get('bundle','?')
    for g in groups:
        t0=max(0.0,g[0]['start']-0.06); t1=min(dur,g[-1]['end']+0.10)
        if t1-t0<0.55: continue
        a=wav[int(t0*16000):int(t1*16000)]
        if len(a)<int(0.55*16000): continue
        try: e=enc.embed_utterance(a)
        except Exception: continue
        utt.append({'clip':name,'title':m.get('title') or '','url':t['url'],'wav':m['wav'],
                    't0':round(t0,3),'t1':round(t1,3),'text':' '.join(w['word'] for w in g),
                    'e':[round(float(x),5) for x in e]})
json.dump(utt,open(SP+'/utterances.json','w'))
print('utterances',len(utt),'speech secs',round(sum(u['t1']-u['t0'] for u in utt),1))
