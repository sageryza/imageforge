#!/usr/bin/env python3
"""Forced alignment (torchaudio wav2vec2 CTC) — repair Whisper's drifting word
timestamps with exact waveform positions (<100ms), the WhisperX approach.

  align_words(wav_path, words) -> same word list with accurate start/end.
CLI: python3 nde_align.py <wav16k_mono> <whisper_words.json>"""
import json, re, sys

import torch
import torchaudio
import torchaudio.functional as F

_bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
_model = None
_dict = None

def _load():
    global _model, _dict
    if _model is None:
        _model = _bundle.get_model().eval()
        labels = _bundle.get_labels()
        _dict = {c: i for i, c in enumerate(labels)}
    return _model, _dict

def _norm(w):
    return re.sub(r"[^A-Z']", "", w.upper())

def align_words(wav_path, words):
    """words: [{word, start, end}, …] (times ignored). Returns new list with
    aligned times; words that can't be tokenized get interpolated times."""
    model, dic = _load()
    wave, sr = torchaudio.load(wav_path)
    if sr != _bundle.sample_rate:
        wave = torchaudio.functional.resample(wave, sr, _bundle.sample_rate)
        sr = _bundle.sample_rate
    if wave.size(0) > 1:
        wave = wave.mean(0, keepdim=True)
    with torch.inference_mode():
        emission, _ = model(wave)
        emission = torch.log_softmax(emission, dim=-1)
    ratio = wave.size(1) / emission.size(1) / sr  # seconds per emission frame

    sep = dic.get("|")
    tokens, spans_per_word, keep = [], [], []
    for i, w in enumerate(words):
        nw = _norm(w.get("word", ""))
        ids = [dic[c] for c in nw if c in dic]
        if not ids:
            keep.append(None)
            continue
        if tokens and sep is not None:
            tokens.append(sep)
        keep.append((len(tokens), len(tokens) + len(ids)))
        tokens.extend(ids)

    if not tokens:
        return words
    targets = torch.tensor([tokens], dtype=torch.int32)
    alignment, scores = F.forced_align(emission, targets, blank=0)
    token_spans = F.merge_tokens(alignment[0], scores[0])
    # token_spans: one entry per target token, in order — map back to words
    out = []
    ti = 0
    span_times = []  # (start_s, end_s) per target-token index
    tok_starts = {}
    for ts in token_spans:
        span_times.append((ts.start * ratio, ts.end * ratio))
    for i, w in enumerate(words):
        nw = keep[i]
        w2 = dict(w)
        if nw is not None:
            a, b = nw
            w2["start"] = round(span_times[a][0], 3)
            w2["end"] = round(span_times[b - 1][1], 3)
        out.append(w2)
    # interpolate the untokenizable ones from neighbors
    for i, w in enumerate(out):
        if keep[i] is None:
            prev_end = next((out[j]["end"] for j in range(i - 1, -1, -1) if keep[j] is not None), 0)
            nxt_start = next((out[j]["start"] for j in range(i + 1, len(out)) if keep[j] is not None), prev_end + 0.3)
            w["start"], w["end"] = prev_end, min(nxt_start, prev_end + 0.4)
    return out

if __name__ == "__main__":
    wav, wj_path = sys.argv[1], sys.argv[2]
    wj = json.load(open(wj_path))
    words = wj.get("words") or wj
    aligned = align_words(wav, words)
    for w in aligned[:20]:
        print(f"{w['start']:7.2f}-{w['end']:7.2f}  {w['word']}")
    json.dump({"words": aligned}, open("/tmp/aligned-test.json", "w"))
    print(f"…{len(aligned)} words aligned")
