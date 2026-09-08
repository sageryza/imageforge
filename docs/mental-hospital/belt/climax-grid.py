import json,urllib.request
B='https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/'
D=B+'drops/_/'
JAZZ=B+'apiframe-video/1788736757836-f3j8qh.mp4'
V={'office2':D+'e9a630abb4fc88d8178d02e49389d727.mp4','office':D+'7695f1483c18c952082f0af59294cc3c.mp4',
   'broll1':D+'1c3482aeb75c68c690c774204c23ee08.mp4','broll1b':D+'2d26ca4e4f944ccdd43772e5b1184885.mp4'}
I={'A':D+'52a036179b0e90785fc918e6f95520ec.png','C':D+'12c13654fcb9fb3fc3c30b463acdb562.png','pocket':D+'418f17e802ee8e01e0b55afedb0fc483.png',
   'chairwide':D+'6bc3a3ada2014ef32e872a1259131f3c.png','docchair':D+'8a4648e540fc7daf9f5b37f4cb2e9b08.png','docchairblur':D+'969ed3663c91a864e3fb3d8da60bc1a8.png',
   'sophiechair':D+'2d59752e5f0f7d2ad20b826e560fdb43.png','sophieclose':D+'521ba42c881dc3fd08477802e2e61b78.png','room':D+'a26b474c31334b9e2b32d1d10b6ec5bc.png',
   'door':D+'12d87db0e1d8ab86a5a314ed93d0f620.png','socks':D+'aa5a689009cdaae6810d689208685ee7.png'}
def vid(k,slot,label,url): return {'id':f'{k}-{slot.lower()}','label':f'{slot} — {label}','text':'video reference · tap Play to watch','link':{'url':url,'label':'Play'}}
def img(k,slot,label,key): return {'id':f'{k}-{key}','label':f'{slot} — {label}','img':I[key]}
def pj(k): return [img(k,'Image1','A, Sophie alone (the pajamas)','A'),img(k,'Image2','C, teacher cropped out (the pajamas)','C'),img(k,'Image3','the grippy hospital socks','socks')]
groups=[
 {'label':'Card 1 · Climax 3 — Tomorrow? → the judge · 20s · $3.00','items':[
   vid('31a','Video1','the jazz (15.1s)',JAZZ),vid('31a','Video2','office, eye level (4s)',V['office2']),vid('31a','Video3','office, from below (4s)',V['office']),vid('31a','Video4','hall from the back (4s)',V['broll1']),
   *pj('31a'),img('31a','Image4','Sophie on the folding chair, wide (climax 2a)','chairwide'),
   img('31a','Image5 option 1','Dr. Grayson in his chair, face blurred','docchairblur'),img('31a','Image5 option 2','Dr. Grayson in his chair, unblurred (the one you hearted)','docchair')]},
 {'label':'Card 2 · Climax 3 — the grin, the ghost, You can go now · 15s · $2.25','items':[
   vid('31b','Video1','the jazz (15.1s)',JAZZ),vid('31b','Video2','office, eye level (4s)',V['office2']),
   *pj('31b'),img('31b','Image4','Dr. Grayson in his chair','docchair'),
   img('31b','option','Sophie on the folding chair (climax 2b), face blurred','sophiechair'),img('31b','option','Sophie close (climax 2b), face blurred','sophieclose')]},
 {'label':'Card 3 · Climax 4 — the hall float, the mirror · 15s · $2.25','items':[
   vid('32b','Video1','the jazz (15.1s)',JAZZ),vid('32b','Video2','hall, head on (4s)',V['broll1b']),
   *pj('32b'),img('32b','Image4','her room, face blurred','room'),img('32b','option','the office door','door')]},
 {'label':'Card 4 · Climax 5 — the speech at the mirror · 25s · $3.75','items':[
   vid('33','Video1','the jazz (15.1s)',JAZZ),vid('33','Video2','hall, head on (4s)',V['broll1b']),
   *pj('33'),img('33','Image4','her room, face blurred','room')]},
 {'label':'Card 5 · Climax 6 — the hall breakdown · 30s · $4.50 (needs a split)','items':[
   vid('34','Video1','the jazz (15.1s)',JAZZ),vid('34','Video2','hall, head on (4s)',V['broll1b']),*pj('34')]},
]
data={'groups':groups,'stamp':False,'pace':'labored','spreadAll':True,'spreadEach':True,
 'help':'One row per climax scene. Each picture says which slot it rides in (Image1, Image2…). ♥ the pictures you want sent, ✕ the ones you don\'t — a ♥ here is the same ♥ as the Assets tab. "option" = not on the card yet, only if you want it. Videos: tap Play. v2: the tape pocket is off every climax card (art-tape scenes only); the socks still is Image3 on every card.'}
body={'chat':'climax-dissociation-accounts','title':'The climax — what rides each card v2','template':'grid','data':data}
req=urllib.request.Request('https://imageforge-q125.onrender.com/api/chatfeed/page',data=json.dumps(body).encode(),headers={'content-type':'application/json'})
print(urllib.request.urlopen(req).read().decode()[:600])
