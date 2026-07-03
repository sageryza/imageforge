// melody.js — sung melody → MIDI, no ML, no dependencies.
//
// A made-up song sung into a phone is MONOPHONIC — one voice — which is the
// case classic pitch tracking solves well. This is the YIN algorithm
// (de Cheveigné & Kawahara 2002) over the CLEANED vocal, followed by simple
// note segmentation and a hand-rolled Standard MIDI File writer. The point is
// the GarageBand handoff: the extracted .mid carries the actual notes at the
// actual timing, so real chords can be built around the real tune — the part
// the generative models can't do (their melody conditioning is a fuzzy
// harmonic fingerprint, not note tracking).
//
// Input is raw mono float32 PCM (the caller decodes with ffmpeg); output is a
// .mid Buffer plus the note list for display.

// ─── YIN pitch detection ────────────────────────────────────────────
// One frame: difference function → cumulative-mean-normalized difference →
// first dip under threshold (descend to its local minimum) → parabolic
// interpolation for sub-sample lag. Returns null when unvoiced.
function yinFrame(x, offset, W, tauMin, tauMax, threshold) {
  const d = new Float64Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < W; j++) {
      const diff = x[offset + j] - x[offset + j + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  const cmnd = new Float64Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    cmnd[tau] = running > 0 ? (d[tau] * tau) / running : 1;
  }
  let tauEst = -1;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEst = tau;
      break;
    }
  }
  if (tauEst < 0) {
    // No dip under the threshold — accept a clear global minimum (soft voice),
    // otherwise call the frame unvoiced.
    let best = tauMin;
    for (let tau = tauMin + 1; tau <= tauMax; tau++) if (cmnd[tau] < cmnd[best]) best = tau;
    if (cmnd[best] >= 0.35) return null;
    tauEst = best;
  }
  const x0 = cmnd[Math.max(1, tauEst - 1)];
  const x1 = cmnd[tauEst];
  const x2 = cmnd[Math.min(tauMax, tauEst + 1)];
  const denom = x0 - 2 * x1 + x2;
  const tau = denom !== 0 ? tauEst + 0.5 * (x0 - x2) / denom : tauEst;
  return { tau, confidence: 1 - x1 };
}

// Track the whole take → per-frame { t, midi (float, NaN = unvoiced), rms }.
// Async: yields to the event loop every few hundred frames — a multi-minute
// take is billions of multiplies and this runs inside the web server.
async function trackPitch(samples, sampleRate, opts = {}) {
  const fmin = opts.fmin || 75;    // low male voice
  const fmax = opts.fmax || 1000;  // above any sung fundamental
  const W = opts.window || 600;
  const hop = opts.hop || 256;
  const threshold = opts.threshold || 0.15;
  const minConfidence = opts.minConfidence || 0.5;
  const tauMin = Math.max(2, Math.floor(sampleRate / fmax));
  const tauMax = Math.ceil(sampleRate / fmin);

  const frames = [];
  for (let off = 0; off + W + tauMax < samples.length; off += hop) {
    if (frames.length % 400 === 399) await new Promise(r => setImmediate(r));
    let sum = 0;
    for (let j = 0; j < W; j++) sum += samples[off + j] * samples[off + j];
    const rms = Math.sqrt(sum / W);
    const r = yinFrame(samples, off, W, tauMin, tauMax, threshold);
    const voiced = r && r.confidence >= minConfidence;
    frames.push({
      t: off / sampleRate,
      midi: voiced ? 69 + 12 * Math.log2((sampleRate / r.tau) / 440) : NaN,
      rms,
    });
  }

  // Loudness gate relative to the take (phones auto-level, so absolute
  // thresholds lie): frames quieter than 8% of the 95th-percentile RMS are
  // breaths/room, not notes.
  const sorted = frames.map(f => f.rms).sort((a, b) => a - b);
  const ref = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const gate = ref * 0.08;
  for (const f of frames) if (f.rms < gate) f.midi = NaN;

  // 5-point median filter over voiced pitch — kills octave blips without
  // smearing real note changes.
  const med = frames.map((f, i) => {
    if (Number.isNaN(f.midi)) return NaN;
    const win = [];
    for (let k = -2; k <= 2; k++) {
      const m = frames[i + k]?.midi;
      if (m !== undefined && !Number.isNaN(m)) win.push(m);
    }
    win.sort((a, b) => a - b);
    return win[Math.floor(win.length / 2)];
  });
  frames.forEach((f, i) => { f.midi = med[i]; });
  return { frames, hopSeconds: (opts.hop || 256) / sampleRate, rmsRef: ref };
}

// ─── Note segmentation ──────────────────────────────────────────────
// Quantize each voiced frame to the nearest semitone, group runs, absorb
// blips shorter than ~35ms into their neighbors, drop notes shorter than
// ~80ms. Velocity follows the take's own loudness.
function framesToNotes(frames, hopSeconds, rmsRef, opts = {}) {
  const minNoteSec = opts.minNoteSec || 0.08;
  const blipSec = opts.blipSec || 0.035;

  const runs = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const pitch = Number.isNaN(f.midi) ? null : Math.max(36, Math.min(96, Math.round(f.midi)));
    const last = runs[runs.length - 1];
    if (last && last.pitch === pitch) { last.count++; last.rmsSum += f.rms; }
    else runs.push({ pitch, start: i, count: 1, rmsSum: f.rms });
  }
  // Absorb micro-runs (vibrato wobble crossing a semitone line, glitch
  // frames) into the previous pitched run.
  const blipFrames = Math.max(1, Math.round(blipSec / hopSeconds));
  const merged = [];
  for (const run of runs) {
    const prev = merged[merged.length - 1];
    if (prev && run.count <= blipFrames && prev.pitch !== null && run.pitch !== null) {
      prev.count += run.count; prev.rmsSum += run.rmsSum;
    } else if (prev && prev.pitch === run.pitch) {
      prev.count += run.count; prev.rmsSum += run.rmsSum;
    } else {
      merged.push({ ...run });
    }
  }

  const notes = [];
  for (const run of merged) {
    if (run.pitch === null) continue;
    const durationSec = run.count * hopSeconds;
    if (durationSec < minNoteSec) continue;
    const meanRms = run.rmsSum / run.count;
    const velocity = Math.max(30, Math.min(112, Math.round(40 + 70 * (rmsRef ? meanRms / rmsRef : 0.5))));
    notes.push({
      pitch: run.pitch,
      startSec: run.start * hopSeconds,
      durationSec,
      velocity,
    });
  }
  return notes;
}

// ─── Standard MIDI File writer (format 0, one track) ────────────────
function vlq(n) {
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}

function notesToMidi(notes, { bpm = 120, program = 0 } = {}) {
  const division = 480; // ticks per quarter note
  const ticksPerSec = (division * bpm) / 60;
  const events = [];
  for (const n of notes) {
    const start = Math.round(n.startSec * ticksPerSec);
    const end = Math.max(start + 1, Math.round((n.startSec + n.durationSec) * ticksPerSec));
    events.push({ tick: start, data: [0x90, n.pitch, n.velocity] });
    events.push({ tick: end, data: [0x80, n.pitch, 0] });
  }
  events.sort((a, b) => a.tick - b.tick || a.data[0] - b.data[0]); // note-offs before note-ons at the same tick

  const track = [];
  const usPerQuarter = Math.round(60000000 / bpm);
  track.push(...vlq(0), 0xff, 0x51, 0x03,
    (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff);
  track.push(...vlq(0), 0xc0, program & 0x7f);
  let lastTick = 0;
  for (const ev of events) {
    track.push(...vlq(ev.tick - lastTick), ...ev.data);
    lastTick = ev.tick;
  }
  track.push(...vlq(0), 0xff, 0x2f, 0x00); // end of track

  const header = Buffer.from([
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, // MThd, length 6
    0, 0,                               // format 0
    0, 1,                               // one track
    (division >> 8) & 0xff, division & 0xff,
  ]);
  const trackHeader = Buffer.alloc(8);
  trackHeader.write('MTrk', 0);
  trackHeader.writeUInt32BE(track.length, 4);
  return Buffer.concat([header, trackHeader, Buffer.from(track)]);
}

// ─── The one entry point ────────────────────────────────────────────
// Raw mono float32 samples in → { midi: Buffer, notes, voicedSeconds }.
async function extractMelodyMidi(samples, sampleRate, opts = {}) {
  const { frames, hopSeconds, rmsRef } = await trackPitch(samples, sampleRate, opts);
  const notes = framesToNotes(frames, hopSeconds, rmsRef, opts);
  if (!notes.length) throw new Error('no melody found — the take may be too quiet or too noisy');
  return {
    midi: notesToMidi(notes, opts),
    notes,
    voicedSeconds: +notes.reduce((s, n) => s + n.durationSec, 0).toFixed(1),
  };
}

module.exports = { extractMelodyMidi, trackPitch, framesToNotes, notesToMidi };
