# -*- coding: utf-8 -*-
"""Sophie's speech in the ward footage — every span, read off the whisper
transcript against the belt scripts (docs/mental-hospital/**/jobs*.json and
script-*.md). WHO SAYS WHAT IS DECIDED BY THE SCRIPT, never by the acoustics:
each Seedance clip generates its own audio, so a voiceprint cluster mixes
speakers (measured: doctor-to-Sophie similarity 0.68 against Sophie-to-Sophie
0.66 across clips).

A span is (cn, uid, t0, phrase|None). `uid` disambiguates the unnamed clips
that share a bundle+duration name. `phrase` != None means the utterance holds
two speakers and only those words are hers; the cut lands on the whisper word
timings for exactly that phrase.
"""
import json,os,re
SP=os.environ['SP']
U=json.load(open(SP+'/utterances.json'))
T={t['url']:t for t in json.load(open(SP+'/transcribe.json'))}

NARR=[  # her voiceover — the film's narration
 ('ext',None,0.00,None),
 ('cut-1-seedance-8.1','6f37c30e8ac118',0.00,None),
 ('cut-1-seedance-23.1','132d5ca8a6bac9',15.02,None),
 ('cut-1-seedance-15.1','40db2a7b7e23b2',0.00,None),('cut-1-seedance-15.1','40db2a7b7e23b2',1.54,None),
 ('cut-1-seedance-15.1','40db2a7b7e23b2',4.46,None),('cut-1-seedance-15.1','40db2a7b7e23b2',7.74,None),
 ('cut-1-seedance-15.1','90c6ace3a3362a',0.00,None),('cut-1-seedance-15.1','90c6ace3a3362a',8.04,None),
 ('cut-1-seedance-15.1','90c6ace3a3362a',12.82,None),('cut-1-seedance-15.1','90c6ace3a3362a',14.24,None),
 ('cut-1-seedance-15.1','9dec931870f933',0.00,None),('cut-1-seedance-15.1','9dec931870f933',12.84,None),
 ('p2a',None,0.00,None),('p2a',None,4.10,None),('p2a',None,8.08,None),
 ('p2a25',None,0.00,None),('p2a25',None,4.06,None),('p2a25',None,5.40,None),('p2a25',None,8.04,None),
 ('p2b',None,0.00,None),
 ('p2b3',None,5.26,None),('p2b3',None,11.60,None),
 ('p2b25',None,8.26,None),('p2b25',None,14.04,None),
]
SCENE=[  # her lines in the scenes
 ('intakeA3',None,9.28,None),('intakeA3',None,11.24,None),('intakeA3',None,27.92,None),
 ('intakeB3',None,14.58,None),
 ('wake2',None,13.08,None),
 ('table-paused',None,6.36,None),('table-paused',None,8.90,None),('table-paused',None,14.68,None),
 ('table-paused',None,24.44,None),('table-paused',None,28.38,None),
 ('hall',None,4.96,None),('hall',None,16.70,None),
 ('hall2',None,4.56,None),('hall2',None,18.08,None),
 ('annie1c',None,1.42,None),
 ('art',None,8.74,None),
 ('scissorsA',None,3.96,None),('scissorsA',None,7.80,None),
 ('scissorsA2',None,1.52,None),
 ('climax1',None,9.20,None),('climax1',None,18.60,None),('climax1',None,27.72,None),
 ('climax2a2',None,3.42,None),('climax2a2',None,4.72,None),
 ('climax2b',None,7.24,None),('climax2b',None,21.16,None),
 ('milk2',None,4.36,'It was in my'),
 ('ward-seedance-75.2','0c9e17e5eb3122',63.32,None),('ward-seedance-75.2','0c9e17e5eb3122',65.02,None),
 ('broll1b',None,2.72,None),
 ('office2',None,0.00,"I'm not sure"),
 ('tranq',None,7.66,None),('tranq',None,11.78,"But I don't have trouble sleeping"),
 ('ward-seedance-15.1','0b26f817b51ce6',5.10,'Where are they taking you'),
 ('ward-seedance-30.0','7b81af58a5b035',14.26,None),
 ('ward-seedance-30.0','2f30fb61414a9b',14.32,'Where are they taking you'),
 ('ward-seedance-15.0','7cc8a171c8007b',13.28,None),
 ('ward-seedance-15.0','5a3bb78ce327a1',7.50,'Where did all my sculptures go'),
]
def norm(s): return re.sub(r"[^a-z0-9 ]",'',s.lower()).split()
out=[];miss=[]
for kind,spans in (('narration',NARR),('scene',SCENE)):
    for cn,uid,t0,phrase in spans:
        cand=[u for u in U if u['cn']==cn and abs(u['t0']-t0)<0.35 and (uid is None or uid in u['url'])]
        if not cand: miss.append((cn,uid,t0,phrase)); continue
        u=cand[0]; a,b,text=u['t0'],u['t1'],u['text']
        if phrase:
            ws=[w for w in (T[u['url']].get('words') or []) if w.get('end',0)>w.get('start',0)
                and w['start']>=u['t0']-0.25 and w['end']<=u['t1']+0.25]
            tw=norm(' '.join(w['word'] for w in ws)); pw=norm(phrase)
            hit=next((i for i in range(len(tw)-len(pw)+1) if tw[i:i+len(pw)]==pw),None)
            if hit is None: miss.append((cn,uid,t0,phrase)); continue
            # her words run from the phrase to the end of her turn: stop at the
            # phrase's last word unless the rest of the utterance is hers too
            j=hit+len(pw)-1
            tail=' '.join(tw[j+1:])
            if phrase.lower().startswith(("it was in my","i'm not sure","but i don't")): j=len(ws)-1
            a=max(0.0,ws[hit]['start']-0.06); b=min(u['t1']+0.10,ws[j]['end']+0.10)
            text=' '.join(w['word'] for w in ws[hit:j+1])
        out.append({'kind':kind,'cn':cn,'url':u['url'],'wav':u['wav'],'t0':round(a,3),'t1':round(b,3),
                    'secs':round(b-a,2),'text':text})
print('spans',len(out),'narration',sum(1 for o in out if o['kind']=='narration'),
      'scene',sum(1 for o in out if o['kind']=='scene'),'| total %.1fs'%sum(o['secs'] for o in out))
print('narration %.1fs  scene %.1fs'%(sum(o['secs'] for o in out if o['kind']=='narration'),
                                      sum(o['secs'] for o in out if o['kind']=='scene')))
if miss: print('MISSED',miss)
json.dump(out,open(SP+'/sophie-spans.json','w'),indent=1)
