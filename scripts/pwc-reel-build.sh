#!/usr/bin/env bash
# Rebuild the PWC Training Film No. 001 reel.
#   bash scripts/pwc-reel-build.sh <cards-dir> <stock-countdown.mpg> <out.mp4>
# Full notes, the card order and where the countdown comes from:
#   docs/pwc-training-film-reel.md
set -euo pipefail

CARDS="${1:?cards dir}"; STOCK="${2:?stock countdown mpg}"; OUT="${3:-pwc-reel.mp4}"
FF="${FFMPEG:-ffmpeg}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
W=1080; H=1920; FPS=30

# The 3-2-1 inside archive.org IMB_SF_R30_C3 (CC-BY 3.0). Measured, not guessed:
# "3" reads clean at 23.80, the "1" wipes to black from ~26.1.
"$FF" -y -ss 23.45 -t 3.2 -i "$STOCK" \
  -vf "setsar=1,scale=${W}:-2:flags=lanczos,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,fps=${FPS},format=yuv420p" \
  -an -c:v libx264 -crf 16 -preset medium "$TMP/00.mp4" -loglevel error

# A card sits on a blurred copy of itself — these posters are drawn to be read
# whole, so nothing may be cropped to fill 9:16.
card () { # $1=filename $2=seconds $3=index
  "$FF" -y -loop 1 -t "$2" -i "$CARDS/$1" -filter_complex "\
[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=42:2,eq=brightness=-0.16:saturation=0.5[bg];\
[0:v]scale=1080:1800:force_original_aspect_ratio=decrease:flags=lanczos[fg];\
[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=${FPS},format=yuv420p[v]" \
    -map "[v]" -an -c:v libx264 -crf 16 -preset medium "$TMP/$3.mp4" -loglevel error
}

card 01-title-how-to-look-without-looking.png 2.6 01
card 02-the-mistake-looking.png               4.0 02
card 03-technique-1-middle-distance.png       4.6 03
card 04-technique-2-reflective-surfaces.png   4.6 04
card 05-technique-3-the-friend.png            4.2 05
card 06-emergency-1-eye-contact.png           4.6 06
card 07-certified-people-watcher.png          4.2 07

for f in 00 01 02 03 04 05 06 07; do echo "file '$TMP/$f.mp4'"; done > "$TMP/list.txt"

# Gate weave + flicker + grain + vignette over the whole reel, so the treatment
# cannot drift card to card. vignette is PI/7 on purpose: the PI/5 default reads
# noticeably dimmer than the sepia artwork.
"$FF" -y -f concat -safe 0 -i "$TMP/list.txt" \
  -f lavfi -t 60 -i anullsrc=r=48000:cl=stereo \
  -filter_complex "[0:v]setsar=1,scale=1104:1962:flags=lanczos,\
crop=${W}:${H}:x='(iw-ow)/2+3*sin(n/7)+2*sin(n/3.1)':y='(ih-oh)/2+3*sin(n/5.3)+2*sin(n/2.3)',\
eq=brightness='0.016*sin(n/2.1)+0.010*sin(n/1.3)':eval=frame,\
noise=alls=5:allf=t+u,vignette=PI/7,setsar=1,format=yuv420p[v]" \
  -map "[v]" -map 1:a -shortest \
  -c:v libx264 -crf 20 -preset medium -profile:v high -level 4.1 -pix_fmt yuv420p -r ${FPS} \
  -c:a aac -b:a 128k -movflags +faststart "$OUT" -loglevel error

echo "wrote $OUT"
