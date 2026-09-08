import json,urllib.request,time,sys,os,subprocess
key,title,fname,pfile=sys.argv[1:5]
S=os.environ.get('CLAUDE_CODE_REMOTE_SESSION_ID','').replace('cse_','')
B='https://imageforge-q125.onrender.com'
V6="https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/apiframe-video/1788736757836-f3j8qh.mp4"
WAKE=None
imgs=None
# wait for the top-up to land (450 credits needed)
body={**({"duration":int(os.environ["DUR"])} if os.environ.get("DUR") else {}),"prompt":open(pfile).read().rstrip('\n'),"model":"seedance-2.5","resolution":"480p","generateAudio":True,"aspectRatio":os.environ.get("AR","3:4"),"referenceVideoUrls":json.loads(os.environ.get("REFS","[]")),"referenceImageUrls":json.loads(os.environ.get("IMGS","[]")),"chat":"soap-pill-scene","scene":key,"title":title,"session":S}
print("BODY",json.dumps(body,ensure_ascii=False)[:400],flush=True)
req=urllib.request.Request(B+"/api/apiframe/video",data=json.dumps(body).encode(),headers={"content-type":"application/json"})
try: d=json.load(urllib.request.urlopen(req))
except urllib.error.HTTPError as e: print(key,'HTTP',e.code,e.read().decode()[:400],flush=True); sys.exit(1)
open(f'af-{key}-job.json','w').write(json.dumps(d)); print(key,'started',d['jobId'],flush=True)
for _ in range(160):
    time.sleep(15)
    j=json.load(urllib.request.urlopen(B+d['poll']))
    if j['status'] in ('COMPLETED','FAILED','CANCELED','ERROR'): break
json.dump(j,open(f'af-{key}-final.json','w'))
print(key,j['status'],j.get('video'),(j.get('raw') or {}).get('error'),flush=True)
if not j.get('video'): sys.exit(2)
urllib.request.urlretrieve(j['video'],fname)
up=subprocess.run(['curl','-sS','-X','POST',f'{B}/api/drop/upload-file?session=seedance-cut1&bundle=Ward%20%E2%86%92%20Seedance&filename={fname}','-H','content-type: video/mp4','--data-binary',f'@{fname}'],capture_output=True,text=True).stdout
it=json.loads(up)['item']; open(f'{key}-drop.txt','w').write(it['id']+' '+it['url'])
pin=json.dumps({"chat":"soap-pill-scene","session":S,"url":it['url'],"title":"Newest clip · "+title,"kind":"video"}).encode()
urllib.request.urlopen(urllib.request.Request(B+"/api/chatfeed/pin",data=pin,headers={"content-type":"application/json"}))
print(key,'pinned · save '+B+'/api/drop/file/'+it['id'],flush=True)
try:
    import time as _t
    rows=json.load(open('clips.json')); rows.append({'key':key,'title':title,'id':it['id'],'url':it['url'],'at':_t.time()}); json.dump(rows,open('clips.json','w'),indent=1)
    subprocess.run(['python3','clips-page.py'])
    urllib.request.urlopen(urllib.request.Request(B+'/api/chatfeed/clips',data=json.dumps({'chat':'soap-pill-scene','session':S,'url':it['url'],'title':title,'id':it['id']}).encode(),headers={'content-type':'application/json'}))
    urllib.request.urlopen(urllib.request.Request(B+'/api/deliverables',data=json.dumps({'chat':'soap-pill-scene','session':S,'url':it['url'],'title':title,'kind':'video'}).encode(),headers={'content-type':'application/json'}))
except Exception as e: print(key,'clips-list',e,flush=True)
