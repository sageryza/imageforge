#!/bin/bash
# free probe: a bad resolution is refused on `resolution` once the model id is accepted; the old build refuses on `model` first
for i in $(seq 1 100); do
  r=$(curl -s -m 20 -X POST https://imageforge-q125.onrender.com/api/apiframe/video -H 'content-type: application/json' -d '{"prompt":"probe","model":"seedance-1.5-pro","resolution":"bogus"}')
  if echo "$r" | grep -q -F 'path\":\"model'; then sleep 15; continue; fi
  echo "LIVE $(date -u +%H:%M:%S) $r"; exit 0
done; echo TIMEOUT
