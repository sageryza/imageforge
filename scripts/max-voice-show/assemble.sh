#!/bin/bash
# Clearing Things Up — title segment assembly (v2: the title SHOOTS ACROSS
# with the star, riding the trail's diagonal from off-screen top-right and
# easing into place; her wav rides the unfurl +10dB/500ms, sparkle at the
# star cut, Max VO over the title).  usage: assemble.sh <workdir> <out.mp4>
set -e
SC="$1"; OUT="$2"; FF=node_modules/ffmpeg-static/ffmpeg
$FF -v error -i $SC/unfurl.mp4 -i $SC/starclip.mp4 -loop 1 -t 5.1 -i $SC/title.png \
 -i $SC/unfurl-sfx.wav -i $SC/sparkle.mp3 -i $SC/vo.mp3 -filter_complex "
[0:v][1:v]concat=n=2:v=1:a=0[cat];
[2:v]format=rgba,setpts=PTS-STARTPTS+5.07/TB[ttl];
[cat][ttl]overlay=x='940*exp(-3.2*max(0,t-5.4))':y='-870*exp(-3.2*max(0,t-5.4))':eof_action=pass:enable='gte(t,5.07)'[v];
[3:a]adelay=500|500,volume=10.0dB[a1];
[4:a]adelay=5070|5070,volume=-4.4dB[a2];
[5:a]adelay=6450|6450,volume=4.5dB[a3];
[a1][a2][a3]amix=inputs=3:duration=longest:normalize=0,afade=t=out:st=9.55:d=0.55[a]
" -map "[v]" -map "[a]" -c:v libx264 -crf 18 -pix_fmt yuv420p -r 30 \
 -c:a aac -b:a 192k -movflags +faststart -t 10.13 "$OUT" -y
