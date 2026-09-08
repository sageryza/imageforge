import json,urllib.request,html as H,time,os
import os,time; os.environ["TZ"]="America/Los_Angeles"; time.tzset()
B='https://imageforge-q125.onrender.com'
def post(path,body):
    r=urllib.request.Request(B+'/api/chatfeed/'+path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(r))
rows=json.load(open('clips.json')); rows.sort(key=lambda r:-r['at'])
st=json.load(open('clips-state.json')) if os.path.exists('clips-state.json') else {'ver':0,'ids':[]}
ver=st['ver']+1
def when(t): return time.strftime('%b %-d · %-I:%M %p',time.localtime(t)).replace('AM','am').replace('PM','pm')
body=''.join('''<div class="clip" data-item="%s"><div class="film" data-url="%s" data-label="%s"></div><p class="meta">%s · <a href="%s/api/drop/file/%s">save</a></p></div>'''%(H.escape(r['key']),H.escape(r['url']),H.escape(r['title']),when(r['at']),B,r['id']) for r in rows)
page='''<meta charset="utf-8"><link rel="stylesheet" href="/compare.css"><script src="/compare.js"></script>
<style>.clip{margin:0 0 14px;padding-bottom:8px;border-bottom:1px solid #e3dccd}.meta{font-size:12px;color:#6b6257;margin:2px 0 0}.meta a{color:inherit}</style>
<h1>The clips</h1>
'''+body+'''
<script>
document.querySelectorAll('.film').forEach(function(el){ if(window.__filmRow) window.__filmRow({url:el.getAttribute('data-url'),label:el.getAttribute('data-label'),mount:el}); });
window.__compareNotes({chat:'severance-api-multiple-frames',sheet:'clips-notes'});
window.__compareHelp({html:'<p>Every clip that has landed, newest at the top. Tap a row to play it here; "save" underneath downloads the file. A new clip is added the moment it lands.</p>'});
</script>'''
os.environ['TZ']='America/Los_Angeles'; time.tzset()
d=post('page',{'chat':'severance-api-multiple-frames','title':'The clips v%d'%ver,'html':page}); print('clips page',d.get('id'),d.get('warnings'))
for old in st['ids']: post('page/'+old+'/supersede',{'superseded':True})
json.dump({'ver':ver,'ids':[d['id']]},open('clips-state.json','w'))
