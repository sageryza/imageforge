// cut-export.js — A FILM EDITOR CUT, HANDED TO ANOTHER EDITOR (2026-09-08,
// Sophie: "importing it into a program so I could edit it by hand" → she
// bought LumaFusion). Pure: given a cut doc (cut-model.js's two lanes) and
// what is known about its sources, it names the media files, writes the cut
// sheet she reads the timeline off, and writes an FCPXML timeline. No
// network, no ffmpeg — scripts/filmcut.js `export` downloads, probes, zips
// and uploads around it. Tests: node scripts/test-cut-export.js
//
// WHAT GOES IN THE ZIP, and why each half exists:
//   media/      every source file ONCE, named in TIMELINE ORDER — `01 - …`
//               through `65 - …` for the picture lane, `S1 - …` for the
//               sounds. LumaFusion has NO timeline import (measured
//               2026-09-08: its FCPXML support is EXPORT only — it reads
//               nothing but its own .lfpackage, an undocumented shape), so
//               the order in the file NAMES is what lets her select the
//               folder and drop the whole picture lane onto the timeline in
//               one go. A source cut into two pieces is one file, named by
//               its first piece.
//   CUT SHEET.txt  every piece with its start timecode, its length and its
//               trim; every sound with the second it starts, its level, its
//               fades and the shot it rides. What she reads while placing
//               the sounds by hand.
//   <title>.fcpxml  the same two lanes as a real timeline — pieces on the
//               spine, each sound a connected clip on its own lane under the
//               shot it starts on — for DaVinci Resolve or Final Cut on the
//               Mac, where a whole edit imports in one tap. Times are on
//               the sequence's frame grid (24fps here — every Seedance
//               source is 24), as FCP requires; media-rep src is RELATIVE
//               (`media/<name>`), which both read from the zip's own folder.
'use strict';
const crypto = require('crypto');
const M = require('./cut-model');

const NAME_MAX = 70;
const MUTE_DB = -96;
const BAD_CHARS = /[\x00-\x1f\/\\:*?"<>|]+/g;   // what no file system takes, plus control characters

function slugTitle(t) {
  return String(t || '').replace(BAD_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
}
function extOf(url) {
  const m = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(String(url || ''));
  return m ? m[1].toLowerCase() : 'bin';
}
function tc(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
}

// url → filename, timeline order. Every url once; a name that would
// collide takes a numeric tail rather than overwriting a sibling.
function mediaNames(doc) {
  const lanes = M.readDoc(doc);
  const names = {};
  const used = new Set();
  function claim(url, base) {
    if (names[url]) return;
    let name = base, i = 2;
    while (used.has(name.toLowerCase())) { name = base.replace(/(\.[^.]+)$/, ` (${i++})$1`); }
    used.add(name.toLowerCase());
    names[url] = name;
  }
  lanes.clips.forEach((c, i) => {
    claim(c.url, `${String(i + 1).padStart(2, '0')} - ${slugTitle(c.title) || c.key}.${extOf(c.url)}`);
  });
  lanes.sounds.forEach((s, i) => {
    claim(s.url, `S${i + 1} - ${slugTitle(s.name) || s.key}.${extOf(s.url)}`);
  });
  return names;
}

function cutSheet(doc, names) {
  const lanes = M.readDoc(doc);
  names = names || mediaNames(doc);
  const L = [];
  L.push(`${doc.title || 'Cut'} — ${tc(M.totalSeconds(lanes.clips))}`);
  L.push('');
  L.push('PICTURE — in order. Each line: start · length · file. A trim is the part of the source that plays.');
  M.starts(lanes.clips).forEach((s) => {
    const p = s.piece;
    const trim = p.kind === 'video' && (p.in > 0 || (p.seconds != null && p.out < p.seconds - 0.05))
      ? `  trim ${tc(p.in)}–${tc(p.out)} of ${tc(p.seconds)}` : '';
    const hold = p.kind === 'image' ? `  still, hold ${p.out}s` : '';
    const lvl = p.mute ? (p.kind === 'video' ? '  muted' : '') : (p.gain ? `  ${p.gain > 0 ? '+' : ''}${p.gain}dB` : '');
    L.push(`  ${tc(s.start).padStart(6)}  ${tc(s.dur).padStart(5)}  ${names[p.url]}${trim}${hold}${lvl}`);
  });
  L.push('');
  L.push('SOUND — each starts at the timecode given, on top of the picture. "rides" = it was anchored to that shot; if you move the shot, move the sound with it.');
  lanes.sounds.forEach((s) => {
    const len = M.soundSeconds(s);
    const trim = s.in > 0 || (s.seconds != null && s.out != null && s.out < s.seconds - 0.05)
      ? `  trim ${tc(s.in)}–${tc(s.out)} of ${tc(s.seconds)}` : '';
    const parts = [];
    if (s.gain) parts.push(`${s.gain > 0 ? '+' : ''}${s.gain}dB`);
    if (s.fadeIn) parts.push(`fade in ${s.fadeIn}s`);
    if (s.fadeOut) parts.push(`fade out ${s.fadeOut}s`);
    if (s.mute) parts.push('muted');
    if (s.anchor) {
      const i = lanes.clips.findIndex((c) => c.key === s.anchor.piece);
      if (i >= 0) parts.push(`rides ${String(i + 1).padStart(2, '0')}${s.anchor.offset ? ` +${s.anchor.offset}s` : ''}`);
    }
    L.push(`  ${tc(M.soundStart(s, lanes.clips)).padStart(6)}  ${(len == null ? '?' : tc(len)).padStart(5)}  ${names[s.url]}${trim}${parts.length ? '  ' + parts.join(' · ') : ''}`);
  });
  return L.join('\n') + '\n';
}

// ── FCPXML ─────────────────────────────────────────────────────────────
// assets: { [url]: { seconds, width, height, fps, hasAudio, image,
// audioRate, channels } } — what ffprobe said about each source. A source
// with nothing known is written from the doc's own numbers.
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function encPath(p) { return String(p).split('/').map(encodeURIComponent).join('/'); }

function fcpxml(doc, assets, opts) {
  assets = assets || {};
  opts = opts || {};
  const names = opts.names || mediaNames(doc);
  const lanes = M.readDoc(doc);
  const videos = lanes.clips.filter((c) => c.kind === 'video');
  // the sequence's grid: the most common fps among the video sources, else 24
  const fpsCount = {};
  videos.forEach((c) => { const a = assets[c.url]; if (a && a.fps) fpsCount[a.fps] = (fpsCount[a.fps] || 0) + 1; });
  const fps = Number(opts.fps) || Number(Object.keys(fpsCount).sort((a, b) => fpsCount[b] - fpsCount[a])[0]) || 24;
  const TB = fps * 100;                       // timebase ticks per second; a frame is 100 ticks
  const frames = (sec) => Math.round((Number(sec) || 0) * fps);
  const T = (sec) => `${frames(sec) * 100}/${TB}s`;
  const first = videos.map((c) => assets[c.url]).find((a) => a && a.width && a.height);
  const width = Number(opts.width) || (first && first.width) || 1080;
  const height = Number(opts.height) || (first && first.height) || 1920;
  const pieceStarts = M.starts(lanes.clips);
  const lastPs = pieceStarts[pieceStarts.length - 1];
  const total = lastPs ? lastPs.start + lastPs.dur : 0;

  const res = [];
  const ids = {};
  let n = 0;
  const rid = () => `r${++n}`;
  const seqFmt = rid();
  res.push(`<format id="${seqFmt}" name="FFVideoFormat${height}p${fps}" frameDuration="100/${TB}s" width="${width}" height="${height}"/>`);
  const imgFmts = {};
  function imgFmt(w, h) {
    const k = `${w}x${h}`;
    if (!imgFmts[k]) { imgFmts[k] = rid(); res.push(`<format id="${imgFmts[k]}" name="FFVideoFormatRateUndefined" width="${w}" height="${h}"/>`); }
    return imgFmts[k];
  }
  function assetFor(url, fallback) {
    if (ids[url]) return ids[url];
    const a = assets[url] || {};
    const id = rid(); ids[url] = id;
    const name = names[url] || url.split('/').pop();
    const uid = crypto.createHash('sha1').update(url).digest('hex').slice(0, 32).toUpperCase();
    const rep = `<media-rep kind="original-media" src="${esc(encPath('media/' + name))}"/>`;
    if (fallback.kind === 'image' || a.image) {
      const w = a.width || width, h = a.height || height;
      res.push(`<asset id="${id}" name="${esc(name)}" uid="${uid}" start="0s" duration="0s" hasVideo="1" videoSources="1" format="${imgFmt(w, h)}">${rep}</asset>`);
      return id;
    }
    const seconds = a.seconds || fallback.seconds || fallback.out || 0;
    const hasVideo = fallback.kind === 'video' ? 1 : 0;
    const hasAudio = a.hasAudio == null ? 1 : (a.hasAudio ? 1 : 0);
    const attrs = [`id="${id}"`, `name="${esc(name)}"`, `uid="${uid}"`, `start="0s"`, `duration="${T(seconds)}"`,
      `hasVideo="${hasVideo}"`, `hasAudio="${hasAudio}"`];
    if (hasVideo) attrs.push(`format="${seqFmt}"`, `videoSources="1"`);
    if (hasAudio) attrs.push(`audioSources="1"`, `audioChannels="${a.channels || 2}"`, `audioRate="${a.audioRate || 48000}"`);
    res.push(`<asset ${attrs.join(' ')}>${rep}</asset>`);
    return id;
  }
  // every asset, picture lane first so the resource order reads like the cut
  lanes.clips.forEach((c) => assetFor(c.url, c));
  lanes.sounds.forEach((s) => assetFor(s.url, { kind: 'audio', seconds: s.seconds, out: s.out }));

  // which shot each sound starts under, and a lane per overlapping sound
  const sounds = lanes.sounds.map((s) => {
    const at = M.soundStart(s, lanes.clips);
    const len = M.soundSeconds(s);
    return { s, at, len: len == null ? Math.max(0, total - at) : len };
  }).filter((x) => x.len >= 0.1);
  const laneEnds = [];   // lane i → the second the last sound on it ends
  sounds.sort((a, b) => a.at - b.at).forEach((x) => {
    let lane = laneEnds.findIndex((end) => end <= x.at + 1e-6);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(0); }
    laneEnds[lane] = x.at + x.len;
    x.lane = -(lane + 1);
  });
  function volume(gain, mute, fadeIn, fadeOut) {
    const db = mute ? MUTE_DB : (Number(gain) || 0);
    if (!db && !fadeIn && !fadeOut) return '';
    const amount = `${db > 0 ? '+' : ''}${db}dB`;
    if (!fadeIn && !fadeOut) return `<adjust-volume amount="${amount}"/>`;
    return `<adjust-volume amount="${amount}"><param name="amount">${fadeIn ? `<fadeIn type="easeIn" duration="${T(fadeIn)}"/>` : ''}${fadeOut ? `<fadeOut type="easeOut" duration="${T(fadeOut)}"/>` : ''}</param></adjust-volume>`;
  }
  const spine = [];
  pieceStarts.forEach((ps, i) => {
    const p = ps.piece;
    const id = ids[p.url];
    const last = i === pieceStarts.length - 1;
    // a sound starts under the shot whose span holds its start (the last shot takes anything past the end)
    const under = sounds.filter((x) => (x.at >= ps.start - 1e-6 && x.at < ps.start + ps.dur - 1e-6) || (last && x.at >= ps.start + ps.dur - 1e-6));
    const kids = under.map((x) => {
      const localStart = p.kind === 'video' ? p.in : 0;   // a connected clip's offset is in the parent's own timeline, whose origin is `start`
      const off = localStart + (x.at - ps.start);
      return `<asset-clip ref="${ids[x.s.url]}" lane="${x.lane}" offset="${T(off)}" name="${esc(x.s.name || x.s.key)}" start="${T(x.s.in)}" duration="${T(x.len)}">${volume(x.s.gain, x.s.mute, x.s.fadeIn, x.s.fadeOut)}</asset-clip>`;
    }).join('');
    if (p.kind === 'image') {
      spine.push(`<video ref="${id}" offset="${T(ps.start)}" name="${esc(p.title || p.key)}" start="0s" duration="${T(ps.dur)}">${kids}</video>`);
    } else {
      spine.push(`<asset-clip ref="${id}" offset="${T(ps.start)}" name="${esc(p.title || p.key)}" start="${T(p.in)}" duration="${T(ps.dur)}" format="${seqFmt}">${volume(p.gain, p.mute)}${kids}</asset-clip>`);
    }
  });
  const title = doc.title || 'Cut';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE fcpxml>',
    '<fcpxml version="1.9">',
    '<resources>', ...res.map((r) => '  ' + r), '</resources>',
    '<library>',
    `  <event name="${esc(title)}">`,
    `    <project name="${esc(title)}">`,
    `      <sequence format="${seqFmt}" duration="${T(total)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">`,
    '        <spine>', ...spine.map((s) => '          ' + s), '        </spine>',
    '      </sequence>',
    '    </project>',
    '  </event>',
    '</library>',
    '</fcpxml>', ''].join('\n');
}

module.exports = { mediaNames, cutSheet, fcpxml, slugTitle, tc, MUTE_DB };
