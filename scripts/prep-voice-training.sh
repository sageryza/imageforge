#!/bin/bash
# Stage 2 of the voice-training pipeline: condition ONE recording.
# See docs/voice-cloning.md for the whole flow.
#
#   ./scripts/prep-voice-training.sh <in.m4a> <out.wav>
#
# Prints one TSV row: name, in_secs, out_secs, out_rms, out_peak, gain_applied
# (or "name<TAB>SKIP<TAB>needs N.NdB" for a file too quiet to use).
# Run a batch with:  cat jobs.txt | xargs -P 5 -n 2 ./scripts/prep-voice-training.sh
#
# ── The one rule that matters ────────────────────────────────────────────────
# Level-match with a SINGLE FIXED GAIN per file. Never with ffmpeg `loudnorm`.
#
# loudnorm silently falls back from linear to DYNAMIC mode whenever the gain it
# needs is large — which is always, for phone voice memos. Dynamic mode is a
# compressor: it rides gain up during pauses, lifting room tone and codec noise
# until they swell audibly, then ducks when speech returns. A voice clone
# reproduces that pumping faithfully. (It announces itself as
# "normalization_type": "dynamic" in the pass-1 JSON. Read it.)
#
# A fixed gain can only raise the noise floor by exactly that gain. Which is
# also why the gain is CAPPED: a recording made across the room cannot be made
# loud without making its room loud too, so files needing more than the cap are
# dropped, not rescued.
set -euo pipefail

FF=${FFMPEG_PATH:-node_modules/ffmpeg-static/ffmpeg}
FP=${FFPROBE_PATH:-node_modules/ffprobe-static/bin/linux/x64/ffprobe}
in=$1
out=$2

TARGET=${TARGET_RMS:--23.0}   # ElevenLabs wants RMS -23..-18 dBFS. Sit at the
                              # quiet end: quiet is harmless, boosted noise isn't.
MAXGAIN=${MAX_GAIN:-6.0}      # Hard ceiling on lift. Above this, drop the file.
HP=highpass=f=70              # Handling rumble only. The ONLY spectral change.
                              # No denoiser: a clone learns the denoising too.

# Silence threshold tracks the target, because silenceremove's threshold is
# ABSOLUTE. Applied to un-levelled files, one setting removes nothing from a
# loud recording and guts a quiet one.
THRESH=$(python3 -c "print('%.0f' % ($TARGET - 20))")

st=$("$FF" -v info -nostats -i "$in" -af "${HP},volumedetect" -f null - 2>&1)
rms=$(printf '%s' "$st" | grep mean_volume | awk '{print $(NF-1)}')
[ -n "$rms" ] || { echo "measurement failed: $in" >&2; exit 1; }

read gain skip <<< $(python3 -c "
need = $TARGET - ($rms)
print('%.2f %d' % (min(need, $MAXGAIN), 1 if need > $MAXGAIN else 0))")

if [ "$skip" = "1" ]; then
  printf '%s\tSKIP\tneeds %.1fdB\n' "$(basename "$in")" \
    "$(python3 -c "print($TARGET - ($rms))")"
  exit 0
fi

# volume  = the fixed gain, the whole level change.
# alimiter= catches the occasional transient that would now exceed -3 dBFS.
#           Peaks are outliers; letting them cap the gain would force every
#           file DOWN to accommodate one loud consonant.
# silenceremove = pauses longer than stop_duration are cut to stop_silence.
#           Note this is a hard threshold, not a proportional squeeze: a 1.4s
#           pause survives untouched, a 1.6s pause becomes 0.5s.
"$FF" -v error -y -i "$in" \
  -af "${HP},volume=${gain}dB,alimiter=limit=-3dB:level=disabled,silenceremove=stop_periods=-1:stop_duration=1.5:stop_threshold=${THRESH}dB:stop_silence=0.5:detection=rms:window=0.03" \
  -ar 48000 -ac 1 -c:a pcm_s16le "$out"

o=$("$FF" -v info -nostats -i "$out" -af volumedetect -f null - 2>&1)
printf '%s\t%.0f\t%.0f\t%s\t%s\t%s\n' "$(basename "$in")" \
  "$("$FP" -v error -show_entries format=duration -of csv=p=0 "$in")" \
  "$("$FP" -v error -show_entries format=duration -of csv=p=0 "$out")" \
  "$(printf '%s' "$o" | grep mean_volume | awk '{print $(NF-1)}')" \
  "$(printf '%s' "$o" | grep max_volume  | awk '{print $(NF-1)}')" \
  "$gain"
