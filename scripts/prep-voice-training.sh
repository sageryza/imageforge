#!/bin/bash
# Prepare voice-memo recordings as an ElevenLabs PVC (professional voice clone)
# training set.
#
#   ./scripts/prep-voice-training.sh <in.m4a> <out.wav>
#
# One file at a time; run it over a folder with xargs -P to do a batch. The
# output files are then concatenated into ~30 minute chunks (ElevenLabs' own
# preferred upload size) and uploaded to /v1/voices/pvc/<voice_id>/samples.
#
# The chain, and why each step is there:
#
#   highpass f=70      Handling rumble and desk thumps only. This is the ONLY
#                      cleanup applied. Do NOT add a denoiser: a PVC clones what
#                      it hears, and a denoised voice trains a denoised-sounding
#                      clone. Room tone is left alone — it is consistent across
#                      a single phone in a single room, which is what matters.
#
#   loudnorm (2 pass)  I=-18, TP=-3 puts every file in the RMS -23..-18 dBFS /
#                      -3 dB true peak window ElevenLabs asks for. Two passes,
#                      not one: single-pass loudnorm is dynamic and pumps.
#                      Phone voice memos peak near 0 dBFS and vary wildly file
#                      to file, so this is not optional.
#
#   silenceremove      Long pauses get cloned as long pauses, so anything over
#                      1.5s is cut back to 0.5s. Shorter gaps and breaths are
#                      untouched — the goal is to remove dead air, not to make
#                      the delivery sound clipped and breathless.
#
# Note the order: normalize BEFORE trimming. silenceremove takes an absolute
# threshold, so on un-normalized files the same -40dB setting removes nothing
# from a loud recording and guts a quiet one.
set -euo pipefail

FF=${FFMPEG_PATH:-node_modules/ffmpeg-static/ffmpeg}
FP=${FFPROBE_PATH:-node_modules/ffprobe-static/bin/linux/x64/ffprobe}
in=$1
out=$2
HP="highpass=f=70"

m=$("$FF" -v info -nostats -i "$in" -af "${HP},loudnorm=I=-18:TP=-3:LRA=9:print_format=json" -f null - 2>&1 | sed -n '/{/,/}/p')
gv() { printf '%s' "$m" | grep "\"$1\"" | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/'; }
I=$(gv input_i); TP=$(gv input_tp); LRA=$(gv input_lra); TH=$(gv input_thresh); OFF=$(gv target_offset)
[ -n "$I" ] || { echo "loudnorm measurement failed: $in" >&2; exit 1; }

"$FF" -v error -y -i "$in" \
  -af "${HP},loudnorm=I=-18:TP=-3:LRA=9:measured_I=$I:measured_TP=$TP:measured_LRA=$LRA:measured_thresh=$TH:offset=$OFF:linear=true,silenceremove=stop_periods=-1:stop_duration=1.5:stop_threshold=-40dB:stop_silence=0.5:detection=rms:window=0.03" \
  -ar 48000 -ac 1 -c:a pcm_s16le "$out"

# Report so a batch can be checked against the spec at a glance.
st=$("$FF" -v info -i "$out" -af volumedetect -f null - 2>&1)
printf '%s\t%.0f\t%.0f\t%s\t%s\n' \
  "$(basename "$in")" \
  "$("$FP" -v error -show_entries format=duration -of csv=p=0 "$in")" \
  "$("$FP" -v error -show_entries format=duration -of csv=p=0 "$out")" \
  "$(printf '%s' "$st" | grep mean_volume | awk '{print $(NF-1)}')" \
  "$(printf '%s' "$st" | grep max_volume | awk '{print $(NF-1)}')"
