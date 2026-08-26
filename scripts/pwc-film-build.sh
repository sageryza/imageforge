#!/usr/bin/env bash
# Build the narrated PWC Training Film No. 001 (2:03, 9:16).
#   bash scripts/pwc-film-build.sh <cards-dir> <leader.mpg> <mix.wav> <out.mp4>
# Narration: scripts/pwc-film-vo.sh   Audio mix: scripts/pwc-film-audio.py
# Everything else: docs/pwc-training-film-reel.md
set -euo pipefail
CARDS="${1:?cards dir}"; LEADER="${2:?leader mpg}"; MIX="${3:?mix wav}"; OUT="${4:-pwc-film.mp4}"
FF="${FFMPEG:-ffmpeg}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
W=1080; H=1920; FPS=30

# Card lengths are the NARRATION's lengths plus ~0.5s in front and ~0.9s after,
# so no line ever straddles a card change. Keep these in step with the offsets
# in scripts/pwc-film-audio.py — the two files together are the edit.
"$FF" -y -ss 23.45 -t 3.20 -i "$LEADER" -vf "setsar=1,scale=$W:-2:flags=lanczos,pad=$W:$H:(ow-iw)/2:(oh-ih)/2:black,fps=$FPS,format=yuv420p" -an -c:v libx264 -crf 16 -preset medium "$TMP/00.mp4" -loglevel error
card () {
  "$FF" -y -loop 1 -t "$2" -i "$CARDS/$1" -filter_complex "\
[0:v]scale=$W:$H:force_original_aspect_ratio=increase,crop=$W:$H,boxblur=42:2,eq=brightness=-0.16:saturation=0.5[bg];\
[0:v]scale=1080:1800:force_original_aspect_ratio=decrease:flags=lanczos[fg];\
[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=$FPS,format=yuv420p[v]" -map "[v]" -an -c:v libx264 -crf 16 -preset medium "$TMP/$3.mp4" -loglevel error
}
card 01-title-how-to-look-without-looking.png  8.90 01
card 02-the-mistake-looking.png               18.40 02
card 03-technique-1-middle-distance.png       14.40 03
card 04-technique-2-reflective-surfaces.png   16.90 04
card 05-technique-3-the-friend.png             8.25 05
card 06-emergency-1-eye-contact.png           24.00 06
card 07-certified-people-watcher.png          27.20 07
# her ending: "film flicker -> leader/countdown blip -> cut to black"
"$FF" -y -ss 20.15 -t 0.55 -i "$LEADER" -vf "setsar=1,scale=$W:-2:flags=lanczos,pad=$W:$H:(ow-iw)/2:(oh-ih)/2:black,fps=$FPS,format=yuv420p" -an -c:v libx264 -crf 16 -preset medium "$TMP/08.mp4" -loglevel error
"$FF" -y -f lavfi -t 1.45 -i "color=c=black:s=${W}x${H}:r=$FPS" -vf format=yuv420p -c:v libx264 -crf 16 -preset medium "$TMP/09.mp4" -loglevel error

for f in 00 01 02 03 04 05 06 07 08 09; do echo "file '$TMP/$f.mp4'"; done > "$TMP/list.txt"

# One treatment over the whole film so it cannot drift card to card.
# colorchannelmixer is a 60% sepia: the cards are already sepia, but the leader
# is neutral B&W, and this is what pulls the two into one palette.
# noise=alls=4 rather than 6: heavier grain doubled the file and Instagram's
# own re-encode turns fine grain to mush anyway.
"$FF" -y -f concat -safe 0 -i "$TMP/list.txt" -i "$MIX" -filter_complex "\
[0:v]setsar=1,scale=1104:1962:flags=lanczos,\
crop=$W:$H:x='(iw-ow)/2+3*sin(n/7)+2*sin(n/3.1)':y='(ih-oh)/2+3*sin(n/5.3)+2*sin(n/2.3)',\
colorchannelmixer=.6358:.4614:.1134:0:.2094:.8116:.1008:0:.1632:.3204:.4786,\
eq=brightness='0.018*sin(n/2.1)+0.011*sin(n/1.3)':contrast=1.04:eval=frame,\
noise=alls=4:allf=t+u,vignette=PI/7,setsar=1,format=yuv420p[v];\
[1:a]loudnorm=I=-15:TP=-1.5:LRA=11,aformat=sample_rates=48000:channel_layouts=stereo[a]" \
-map "[v]" -map "[a]" -shortest \
-c:v libx264 -crf 22 -preset slow -profile:v high -level 4.1 -pix_fmt yuv420p -r $FPS \
-c:a aac -b:a 192k -movflags +faststart "$OUT" -loglevel error
echo "wrote $OUT"
