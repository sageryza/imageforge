#!/usr/bin/env bash
# Render the PWC Training Film No. 001 narration with ElevenLabs.
#   ELEVENLABS_API_KEY=... bash scripts/pwc-film-vo.sh <outdir>
# Notes, voice choice and timings: docs/pwc-training-film-reel.md
set -euo pipefail
OUT="${1:-vo}"; mkdir -p "$OUT"

# Bill — the one premade voice labelled male/old/american/advertisement, i.e.
# the closest thing on the shelf to a 1950s announcer. NARRATOR stability is
# high on purpose: her direction is "do not perform the jokes".
NARRATOR="${PWC_NARRATOR:-pqHfZKP75CvOlQylNhV4}"
# The watcher's one whispered line is a different, younger voice.
WATCHER="${PWC_WATCHER:-bIHbv24MWmeRgasZH58o}"

# eleven_multilingual_v2, never v3 — house rule, and <break/> only works on v2.
say () { # $1=voice $2=outfile $3=text $4=stability
python3 - "$1" "$OUT/$2" "$3" "$4" <<'PY'
import json,os,sys,urllib.request
vid,out,txt,stab=sys.argv[1:5]
body=json.dumps({"text":txt,"model_id":"eleven_multilingual_v2","voice_settings":{
 "stability":float(stab),"similarity_boost":0.75,"style":0.0,"use_speaker_boost":True}}).encode()
req=urllib.request.Request(
 f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_128",
 data=body,headers={"xi-api-key":os.environ["ELEVENLABS_API_KEY"],"Content-Type":"application/json"})
open(out,"wb").write(urllib.request.urlopen(req,timeout=180).read()); print("ok",out)
PY
}

say "$NARRATOR" 01-title.mp3 'People Watching Club presents: <break time="0.4s"/> How to Look Without Looking. <break time="0.5s"/> Official Training Film Number One.' 0.7
say "$NARRATOR" 02-mistake.mp3 'The inexperienced people watcher often makes one critical mistake. <break time="0.9s"/> Looking. <break time="1.2s"/> Once detected, the novice may attempt to disguise his behavior by suddenly becoming interested in the ceiling. <break time="1.0s"/> This is rarely convincing.' 0.7
say "$NARRATOR" 03-t1.mp3 'Instead, direct your eyes approximately three feet to the left of your subject. <break time="0.6s"/> Maintain a pleasant, unfocused expression. <break time="0.6s"/> You are now observing them without technically looking at anything.' 0.7
say "$NARRATOR" 04-t2.mp3 'The trained observer understands the usefulness of reflective surfaces. <break time="0.5s"/> Windows are recommended for beginners. <break time="0.7s"/> Mirrors are suitable for the intermediate observer. <break time="1.6s"/> Advanced practitioners may attempt the spoon.' 0.7
say "$WATCHER"  05a-watcher.mp3 "Blue jacket. Behind you. Don't look." 0.45
say "$NARRATOR" 05b-friend.mp3 'Your friend will look. <break time="1.0s"/> Do not involve your friend.' 0.7
say "$NARRATOR" 06-eyecontact.mp3 'Occasionally, despite correct procedure, eye contact may occur. <break time="0.6s"/> Remain calm. <break time="0.7s"/> Assume a normal facial expression. <break time="1.1s"/> If possible. <break time="0.9s"/> Now redirect your attention toward an object behind your subject. <break time="0.9s"/> You were simply looking at... <break time="1.8s"/> something else.' 0.7
say "$NARRATOR" 07-graduation.mp3 'Congratulations. <break time="0.7s"/> You have completed the People Watching Club introductory course in discreet human observation. <break time="0.6s"/> You are now prepared to notice the gestures, habits, mysteries, and extremely minor dramas occurring around you every day. <break time="1.0s"/> Observe carefully. <break time="0.6s"/> Interfere with nothing. <break time="0.6s"/> And, whenever possible... <break time="0.9s"/> notice things.' 0.7
echo "narration in $OUT"
