#!/bin/bash
# An open-weight voice clone in a session container: Chatterbox (Resemble AI,
# MIT), CPU only. Clones from one 10-30s reference clip and says the lines in
# LINES. Measured 2026-09-17: ~5 min end to end (mostly pip), ~20s a line on
# 4 CPUs. Free. Full write-up: docs/wan-face-gate-2026-09-17.md.
#
#   REF=/path/to/reference.mp3 bash scripts/container-voice-chatterbox.sh [workdir]
#   LINES='name1|Some words.;name2|More words.'  (default: two test lines)
set -u
REF=${REF:?path to a 10-30s reference clip (mp3/wav)}
D=${1:-$PWD/voice-build}; mkdir -p "$D"; cd "$D" || exit 1
FF=${FFMPEG:-$(dirname "$0")/../node_modules/ffmpeg-static/ffmpeg}
echo "== $(date) venv"
python3 -m venv venv && . venv/bin/activate || { echo "venv failed"; exit 1; }
pip install -q --upgrade pip
echo "== $(date) install torch cpu"
pip install -q --index-url https://download.pytorch.org/whl/cpu torch torchaudio 2>&1 | tail -3
echo "== $(date) install chatterbox"
pip install -q chatterbox-tts 2>&1 | tail -3
echo "== $(date) reference -> 24kHz mono wav"
"$FF" -v error -y -i "$REF" -ac 1 -ar 24000 ref.wav || exit 1
echo "== $(date) synth"
LINES=${LINES:-'line1|Are you kidnapping me?;line2|You can'"'"'t kidnap me. I'"'"'m bigger than you. I'"'"'m older than you, probably.'}
cat > say.py <<'PY'
import os, time, torchaudio as ta
from chatterbox.tts import ChatterboxTTS
t0 = time.time()
model = ChatterboxTTS.from_pretrained(device="cpu")
print("model loaded in", round(time.time() - t0, 1), "s", flush=True)
for part in os.environ["LINES"].split(";"):
    name, text = part.split("|", 1)
    t1 = time.time()
    wav = model.generate(text, audio_prompt_path="ref.wav", exaggeration=0.5, cfg_weight=0.5)
    ta.save(f"{name}.wav", wav, model.sr)
    print(name, "->", round(time.time() - t1, 1), "s", wav.shape, flush=True)
PY
LINES="$LINES" python say.py 2>&1 | grep -v -iE "warning|deprecat|Sampling" | tail -20
echo "== $(date) done"; ls -la *.wav
