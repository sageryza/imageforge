import json
R=json.load(open('rough.json'))
C={c['key']:c for c in R['clips']}; SND={s['key']:s for s in R['sounds']}
clips=[]; sounds=[]
def pic(key,src,i,o,title,mute=False):
    c=C[src]; d={'key':key,'kind':'video','url':c['url'],'title':title,'seconds':c['seconds'],'in':round(i,3),'out':round(o,3)}
    if c.get('poster'): d['poster']=c['poster']
    if mute: d['mute']=True
    clips.append(d)
def snd(key,src,name,piece,offset,i,o,gain=0,fi=0,fo=0):
    s=SND[src]; sounds.append({'key':key,'url':s['url'],'name':name,'in':round(i,3),'out':round(o,3),'gain':gain,'fadeIn':fi,'fadeOut':fo,'anchor':{'piece':piece,'offset':round(offset,3)}})
# 1 the street — VO + jazz
pic('t01','c1',0,4.2,'the street — "the city gets very hot at night"',mute=True)
snd('vo_hot','vo','Sophie — "the city gets very hot at night in the summer"','t01',0.3,0,3.4)
pic('t02','c1',6.9,11.6,'the street — "walking around in circles"',mute=True)
snd('vo_circles','vo','Sophie — "I was walking around in circles, trying to get my mind right"','t02',0.1,5.0,9.6)
pic('t03','c4',1.0,5.2,'the spinning — "you know that game"',mute=True)
snd('vo_game','vo2a','Sophie — "you know that game you play…"','t03',0.2,0,3.96)
pic('t04','c4',13.5,19.5,'lying on the manhole — "I liked how it felt"',mute=True)
snd('vo_laying','vo2b','Sophie — "I liked how it felt, laying there, not moving…"','t04',0.3,4.9,10.655)
snd('jazz_open','jazz','jazz — the opening, out under the woman','t01',0,0,17.5,-10,0,3.5)
# 2 the turn
pic('t05','c5',4.8,7.9,'the woman — "a girl. she just fell. I saw her fall."')
pic('t07','c8',2.5,6.7,'the doctor — "trouble sitting still"')
pic('t08','c7',11.6,15.04,'the tranquilizer — "I don\'t have trouble sleeping!"')
pic('t09','c11',7.0,8.0,'the black')
pic('t10','c12',9.3,15.04,'waking up — "three days" · "this is a mental hospital"',mute=True)
snd('wake_a','wakea','waking — "they said you\'d been out for three days"','t10',0.0,9.3,11.3)
snd('wake_b','wakeb','waking — "do you know where you are? this is a mental hospital"','t10',2.1,0,3.15)
# 3 the ward
pic('t11','s8',20.6,23.2,'the dining room — "I\'m Sophie." "Anastasia." "Michael."')
pic('t12','s10',3.2,8.4,'Annie — "the rascal is talking to us"')
pic('t14','s20',19.6,23.9,'the metaphor machine — "you put the metaphor into one end"')
pic('t15','s23c',4.9,10.9,'the sculptures — "they\'re not trash, they\'re art!"')
pic('t16','s29',6.3,9.3,'the office — "cut my hand off?"')
pic('t17','s29',13.5,17.7,'the doctor — "is cutting your hand off something you\'ve thought about?"')
pic('t18','s30',20.5,22.7,'"when can I leave?"')
pic('t19','s31',0.0,1.0,'"tomorrow?"')
pic('t20','s31',4.2,6.2,'"the next day?"')
pic('t21','s31',7.8,9.3,'"the day after that?"')
pic('t22','s31',9.3,12.1,'"a little longer than that, I\'m afraid"')
pic('t23','s36',29.3,34.3,'Ms. O\'Hara — "all these ghosts, always trying to get me"')
pic('t24','s36',47.6,51.1,'"Sophie, be a good girl and go back to your room"')
pic('t25','s39a',0.3,4.8,'"your parents are here" — the hug')
pic('t26','s31b',10.9,15.07,'"you can go now"')
snd('jazz_close','jazz','jazz — under the parents and the last line','t25',0,3.0,13.2,-13,1.0,2.5)
json.dump({'clips':clips,'sounds':sounds},open('trailer-cut.json','w'),indent=1)
t=0
for c in clips: d=c['out']-c['in']; print(f"{t:5.1f} {d:4.1f} {c['key']} {c['title']}"); t+=d
print('total',round(t,1))
