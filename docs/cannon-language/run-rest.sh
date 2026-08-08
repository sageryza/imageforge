#!/usr/bin/env bash
# Wait for the medium stills to finish, retry any that failed, then animate
# every shot and pull the clips down locally for assembly.
set -u
cd "$(dirname "$0")"
WORK=/tmp/claude-0/-home-user/f2896c89-febe-5a45-b7dd-d2f403c0f14e/scratchpad
CLIPDIR="$WORK/clips"
mkdir -p "$CLIPDIR"

count() { node -e "try{console.log(Object.keys(require('./$1')).length)}catch(e){console.log(0)}"; }
missing() { node -e "
let r={};try{r=require('./$1')}catch(e){}
const have=new Set(Object.keys(r).map(Number));const m=[];
for(let i=1;i<=20;i++) if(!have.has(i)) m.push(i);
console.log(m.join(','));"; }

echo '== waiting for medium stills =='
while pgrep -f "gen-stills.js --quality medium" >/dev/null; do sleep 10; done
echo "medium stills: $(count renders-medium.json)/20"

for attempt in 1 2 3; do
  MISS=$(missing renders-medium.json)
  [ -z "$MISS" ] && break
  echo "== retry $attempt for stills: $MISS =="
  node gen-stills.js --quality medium --only "$MISS" --pool 3
done

MISS=$(missing renders-medium.json)
if [ -n "$MISS" ]; then echo "STILLS STILL MISSING: $MISS"; exit 1; fi

echo '== animating =='
node gen-clips.js --pool 4
for attempt in 1 2 3; do
  MISS=$(missing clips.json)
  [ -z "$MISS" ] && break
  echo "== retry $attempt for clips: $MISS =="
  node gen-clips.js --only "$MISS" --pool 3
done

echo '== downloading clips =='
node -e "
const c=require('./clips.json');
for(const k of Object.keys(c)) console.log(k, c[k].url);
" | while read n url; do
  f="$CLIPDIR/c$(printf %02d "$n").mp4"
  [ -s "$f" ] || curl -sS -o "$f" "$url"
done
echo "clips on disk: $(ls "$CLIPDIR"/c*.mp4 2>/dev/null | wc -l)"
echo '== ready to assemble =='
