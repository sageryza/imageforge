#!/usr/bin/env python3
"""Align the 28 beat texts against the Cutting Blocks word timings and write
per-beat [t0, t1) spans for the film cut. Greedy in-order alignment: both
texts are the same recording transcribed, so tokens run in the same order;
small transcription differences are absorbed by fuzzy stepping.

Usage: python3 align-beats.py <words.json> — writes spans.json beside beats.json
"""
import json, re, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
plan = json.load(open(os.path.join(HERE, 'beats.json')))
words = json.load(open(sys.argv[1]))['words']

def toks(s):
    return [t for t in re.sub(r"[^a-z0-9' ]+", ' ', s.lower()).split() if t]

wtok = [dict(w=toks(w['word']), start=w['start'], end=w['end']) for w in words]
# flatten: one token per timed word (whisper words are single tokens mostly)
stream = []
for w in wtok:
    for t in w['w']:
        stream.append((t, w['start'], w['end']))

pos = 0
spans = []
for beat in plan['beats']:
    bt = toks(beat['vo'])
    # find the start: match the first 3 beat tokens within a small window ahead
    start_i = pos
    best = None
    for i in range(pos, min(pos + 60, len(stream))):
        hits = 0
        j = i
        for k in range(min(5, len(bt))):
            if j < len(stream) and stream[j][0] == bt[k]:
                hits += 1; j += 1
            elif j + 1 < len(stream) and stream[j + 1][0] == bt[k]:
                j += 2
        if hits >= 3 or (len(bt) < 5 and hits >= len(bt) - 1):
            best = i; break
    if best is None:
        best = pos
    start_i = best
    # walk forward consuming roughly len(bt) tokens, fuzzy: allow skips both sides
    i, k, matched = start_i, 0, 0
    while i < len(stream) and k < len(bt):
        if stream[i][0] == bt[k]:
            i += 1; k += 1; matched += 1
        elif i + 1 < len(stream) and stream[i + 1][0] == bt[k]:
            i += 2; k += 1; matched += 1
        elif k + 1 < len(bt) and stream[i][0] == bt[k + 1]:
            k += 1
        else:
            i += 1; k += 1
    end_i = max(i - 1, start_i)
    spans.append(dict(n=beat['n'], t0=stream[start_i][1], t1=stream[end_i][2],
                      firstWord=stream[start_i][0], lastWord=stream[end_i][0],
                      matched=matched, of=len(bt)))
    pos = end_i + 1

# spans must tile: each beat runs to the next beat's start; the last to the end
total = words[-1]['end']
for a, b in zip(spans, spans[1:]):
    a['t1'] = b['t0']
spans[0]['t0'] = 0.0
spans[-1]['t1'] = total + 0.4

out = os.path.join(HERE, 'spans.json')
json.dump(spans, open(out, 'w'), indent=1)
for s in spans:
    print(f"beat {s['n']:2d}  {s['t0']:7.2f} → {s['t1']:7.2f}  ({s['t1']-s['t0']:5.2f}s)  match {s['matched']}/{s['of']}  [{s['firstWord']} … {s['lastWord']}]")
print('wrote', out)
