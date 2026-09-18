import re, math, json, sys
S='/tmp/claude-0/-home-user-imageforge/762fa79f-125c-58b7-bf46-ebb266cfbbf8/scratchpad/'
L=open(S+'packets.txt').read().split('\n')
HEAD=L[:85]; LEDGER=L[85:370]; PK=L[1470:2079]; APP=L[3362:]
HEADERS=['ATTACH THESE REFERENCES','TONE/PERFORMANCE','BACKGROUND CONTEXT ONLY / DO NOT DEPICT','OPENING STATE','CURRENT CLIP — SHOOT ONLY THIS','EXACT SPOKEN WORDS','ENDING STATE','EXCLUSIONS']
def parse_prompt(p):
    m=re.match(r'CLIP (\w+) — (\d+) SECONDS MAXIMUM',p); d={'id':m.group(1),'sec':int(m.group(2))}
    rest=p[m.end():]
    pos=[(rest.find(h),h) for h in HEADERS]; pos=[x for x in pos if x[0]>=0]; pos.sort()
    d['style']=rest[:pos[0][0]]
    for i,(a,h) in enumerate(pos):
        b=pos[i+1][0] if i+1<len(pos) else len(rest)
        d[h]=rest[a+len(h):b]
    # split EXACT SPOKEN WORDS into lines + trailer
    sp=d['EXACT SPOKEN WORDS']
    tr=re.search(r'(Speaker labels are not spoken.*|None\. No improvised.*)$',sp)
    d['say']=sp[:tr.start()] if tr else sp; d['saytrailer']=tr.group(1) if tr else ''
    return d
clips=[]
i=0
while i<len(PK):
    if PK[i].startswith('CLIP ') and 'CURRENT CLIP' in PK[i]:
        d=parse_prompt(PK[i]); d['title']=PK[i-2].strip().split(' ',1)[1]
        m=re.match(r'Source: (.*?)\. Target: (\d+) seconds\. Gate: (.*?)\.$',PK[i-1].strip())
        d['src'],d['gate']=m.group(1),m.group(3); clips.append(d)
    i+=1
# references per clip from index
idx={}
j=377
while j<1470:
    if re.fullmatch(r'[A-Z]\d{3}',L[j].strip()):
        rows=[L[j].strip()]; k=j+1
        while len(rows)<6:
            if L[k].strip(): rows.append(L[k].strip())
            k+=1
        idx[rows[0]]=rows; j=k
    else: j+=1
for c in clips: c['refs']=idx[c['id']][4]
SAYTRAIL='Speaker labels are not spoken. Say the words exactly, including incomplete clauses; do not vocalize punctuation or draft annotation (?). Only a label marked VO indicates narration.'
def saylines(s):
    # 'Woman: xxxRobert: yyy' → list of (speaker,text)
    parts=re.split(r'(?=(?:Woman VO|Robert VO|Woman|Robert|Pedestrian|Dispatcher|Guard|PA voice|Waitress): )',s)
    out=[]
    for p in parts:
        p=p.strip()
        if not p: continue
        sp,tx=p.split(': ',1); out.append((sp,tx.strip()))
    return out
def joinsay(lines): return ''.join(f'{a}: {b}' for a,b in lines)
by={c['id']:c for c in clips}
changes=[]
def note(cid,what): changes.append((cid,what))
# ---- 1. D007 wish speaker → Robert
c=by['D007']; c['say']='Robert: I wish…this, I wish..that, My god, I wish the waitress would come take our fucking plates away and bring us the check.Woman: Ha!'
c['CURRENT CLIP — SHOOT ONLY THIS']='Robert, lash held up between them, voices the trivial mocking wish; the woman lets out a snorting laugh that blows the lash across the table.'
c['gate']='DRAFT READY AFTER REFERENCES'; note('D007','Wish reassigned to Robert (he plucked the lash; “Ha!” and the snort are hers; “I was satisfied that it really wouldn’t prove anything” is her relief about HIS wish). Author may reverse.')
# ---- 2. A012 dispatcher quote boundary
c=by['A012']; c['say']='Robert: What? No. Just call an ambulanceDispatcher: Yes. Is he in danger of being hit? Can you get him out of the street?'
c['CURRENT CLIP — SHOOT ONLY THIS']='Robert answers the woman, then takes out his own phone and calls. The dispatcher is a phone-filtered offscreen voice, not another person in frame; the source puts “Yes” and the first question inside one set of quotation marks, so they are one speaker.'
c['gate']='DRAFT READY AFTER REFERENCES'; note('A012','“Yes / Is he in danger of being hit?” share one quotation in the source → one speaker, the dispatcher. Author may hand “Yes” back to Robert.')
# ---- 3. C090 fingernails restored
c=by['C090']; c['CURRENT CLIP — SHOOT ONLY THIS']='She delivers the line — “girls” said disdainfully — while ripping off two of her fingernails and flicking them across the table without thinking; it is really quite disgusting, and Robert shifts his weight to avoid them. Grounded, not gory: torn nails, no blood.'
c['ENDING STATE']='Two torn fingernails on the far side of the table; hands otherwise intact.'; note('C090','Source restored: she rips off two fingernails and it is “really quite disgusting”; the disdain on “girls” is directed.')
# ---- 4. Valentine: no red heart
for cid in ['V001','V002','V003','V004','V005']:
    c=by[cid]
    for k in list(c.keys()):
        if isinstance(c[k],str):
            c[k]=c[k].replace('red-heart white-doily valentine','white-doily valentine of magazine cutouts (“the awful doilie thing”)').replace('Heart on white fridge','Valentine on white fridge').replace('heart','valentine').replace('Heart','Valentine')
    c['title']=c['title'].replace('Heart','Valentine')
note('V001–V005','“Red heart” removed; the source says an awful doily thing made of magazine pictures. Design the valentine from those words only.')
# ---- 5. C036 typo
c=by['C036']; c['say']=c['say'].replace('something in mean to me','something mean to me'); note('C036','“something in mean to me” read as a typo → “something mean to me”. Author confirms.')
# ---- 6. Coast in wides
for cid in ['B001','B002','B003','B004','B005','B006','B007','B008']:
    c=by[cid]; c['OPENING STATE']=c['OPENING STATE'].replace('Victim disposition unresolved; frame front seats only.','Victim disposition unresolved; frame front seats only in interiors.')
c=by['B003']; c['CURRENT CLIP — SHOOT ONLY THIS']='Open on one WIDE exterior: the old wagon flying along the coastal road with the great lapping waves alive beside it (ocean on the approved side; the source itself says “left (or was it our right?)”), then side profile on the woman inside. Woman VO; the figurative puddle is not an image instruction.'
c=by['B008']; c['CURRENT CLIP — SHOOT ONLY THIS']='Close on him: protests, then sighs and stares out his window with resigned mild interest at the horizon drawing closer. The waves may ride in his window in the wide; no tight shot depends on which side.'
note('B003/B008','The coast is back: one wide of the wagon on the coastal road with the waves alive. The side is a production pick (note it on the master), never a tight-shot dependency.')
# ---- 7. Reel Inn
c=by['C001']; c['OPENING STATE']=c['OPENING STATE'].replace('fish restaurant','the Reel Inn, a fish place (the source names it, p 17)')
note('C001','Restaurant named: the Reel Inn (source p 17), which also fits the coastal drive.')
# ---- 8. Robert VO in A (symmetry with the woman's VO in B001–B003)
VO={'A001':('There was that woman again. Short, kind of - stubby looking - and wearing a frock that could only be described as frumpy.',8),
    'A002':('I felt bad for depriving him of so many customers, so whenever I ordered a latte, I paid for about seven. And believe me - I can’t drink seven lattes all by myself - believe me - I’ve tried.',15),
    'A003':('I doubted anyone would recognize me today. And if they did, they’d probably just run away in horror.',8),
    'A013':('Oh, sure I went to the gym every morning. Or at least it looked like I did.',12),
    'A014':('And where had that woman gone? She had been no help in the whole carrying situation.',10),
    'A022':('Her car was not filthy exactly, but it was far from clean.',8),
    'A023':('Oh no. Oh no. This couldn’t be happening. This was a bad dream.',10)}
for cid,(vo,sec) in VO.items():
    c=by[cid]; c['sec']=sec
    c['say']=(c['say'] if c['say'].strip() and 'None.' not in c['say'] else '')+f'Robert VO: {vo}'
    c['gate']='VO PROPOSED — APPROVE OR DROP' if c['gate']=='DRAFT READY AFTER REFERENCES' else c['gate']+' · VO PROPOSED'
note('A001/A002/A003/A013/A014/A022/A023','Robert VO added from his own chapter-A prose, verbatim, mirroring the woman’s VO in B001–B003. Each is one line she can drop.')
# ---- 9. Re-split the confession runs at sentence boundaries, ~40 words per 15s
WPS=40/15.0
def split_sent(t):
    t=t.strip()
    parts=re.split(r'(?<=[.!?…])\s+(?=[A-Z“(])',t)
    out=[]
    for p in parts:
        if len(p.split())>44:
            sub=re.split(r'(?<=,)\s+| - ',p); out+= [s.strip() for s in sub if s.strip()]
        else: out.append(p)
    return out
def pack(sents,maxw=40):
    W=sum(len(s.split()) for s in sents); n=max(1,math.ceil(W/maxw)); target=W/n
    chunks=[]; cur=[]; cw=0
    for s in sents:
        sw=len(s.split())
        if cur and (cw+sw>maxw or (cw>=target*0.85 and len(chunks)<n-1)): chunks.append(' '.join(cur)); cur=[]; cw=0
        cur.append(s); cw+=sw
    if cur: chunks.append(' '.join(cur))
    return chunks
new=[]; k=0
while k<len(clips):
    c=clips[k]; m=re.match(r'(.*) (\d+) of (\d+)$',c['title'])
    if c['id'].startswith('C') and m:
        stem=m.group(1); grp=[c]; k2=k+1
        while k2<len(clips) and re.match(re.escape(stem)+r' \d+ of \d+$',clips[k2]['title']): grp.append(clips[k2]); k2+=1
        lines=[]; 
        for g in grp: lines+=saylines(g['say'])
        spk=lines[0][0]; text=' '.join(t for _,t in lines)
        chunks=pack(split_sent(text))
        for n,ch in enumerate(chunks,1):
            d=dict(grp[0]); d['title']=f'{stem} {n} of {len(chunks)}' if len(chunks)>1 else stem
            d['say']=f'{spk}: {ch}'; w=len(ch.split()); d['sec']=int(min(15,max(6,math.ceil(w/WPS)+1)))
            d['src']=grp[0]['src'] if grp[0]['src']==grp[-1]['src'] else grp[0]['src'].split('–')[0].replace('pp','p')+'–'+grp[-1]['src'].split(' ')[-1]
            new.append(d)
        k=k2
    else: new.append(c); k+=1
# renumber C
n=0
for d in new:
    if d['id'].startswith('C'): n+=1; d['id']=f'C{n:03d}'
clips=new
note('C004–C094 (now fewer)','The confession re-split at sentence boundaries at about 40 words per 15 seconds (~160 wpm, her “speaking more quickly … in a rush”), never mid-clause. Same words, fewer clips.')
# ---- 10. sanity: no clip over 44 words
for d in clips:
    w=len(re.sub(r'(Woman VO|Robert VO|Woman|Robert|Pedestrian|Dispatcher|Guard|PA voice|Waitress): ','',d['say']).split())
    if w>46: print('LONG',d['id'],w,file=sys.stderr)
total=sum(d['sec'] for d in clips)
print(len(clips),'clips',total//60,'m',total%60,'s',file=sys.stderr)
json.dump({'clips':clips,'changes':changes,'total':total},open(S+'v2.json','w'))
