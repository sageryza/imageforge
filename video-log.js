'use strict';
// EVERY VIDEO CLIP'S EXACT PROMPT AND EVERY REFERENCE, KEPT (2026-09-07,
// Sophie: "you're saving every single exact prompt, including the reference,
// is [that] correct? if not make sure that that's happening starting now …
// eventually we will redo all this footage at 1080p once it's perfect and we
// need the prompts and the references").
//
// Until this, the only durable copy of what a Seedance clip was made from was
// APIFRAME's own job record — which the chat had to remember the id of, and
// which APIFRAME can expire. The server's `POST /api/apiframe/video` route
// now files a doc per job in `forge-video-jobs` the moment the job is
// accepted: the literal prompt, the model, the exact `seedanceParams` sent
// (duration, resolution, aspect, audio, EVERY reference url), and whatever
// the caller tagged it with (chat, scene, title). The poll fills in the
// outcome and the clip's permanent url. So the 1080p redo is a read of that
// collection, and a chat has nothing to remember — the route is the log.
//
// A clip drawn OUTSIDE the route (a chat with its own key) is filed with
// scripts/apiframe-video-log-backfill.js, which reads the job back from
// APIFRAME and writes the same doc.
//
// Pure helpers; the route and the backfill both build docs through here so
// the two can never disagree about the shape.
const COLL = 'forge-video-jobs';

function sentRecord({ jobId, prompt, model, params, tag }) {
  const t = tag || {};
  const doc = {
    job: String(jobId),
    prompt: String(prompt == null ? '' : prompt),
    model: String(model || ''),
    params: params && typeof params === 'object' ? params : {},
    references: {
      images: Array.isArray(params && params.reference_image_urls) ? params.reference_image_urls.slice() : [],
      videos: Array.isArray(params && params.reference_video_urls) ? params.reference_video_urls.slice() : [],
      audio: Array.isArray(params && params.reference_audio_urls) ? params.reference_audio_urls.slice() : [],
      startImage: (params && params.start_image) || '',
      endImage: (params && params.end_image) || '',
    },
    status: 'sent',
    sentAt: new Date().toISOString(),
  };
  for (const k of ['chat', 'scene', 'title', 'session', 'note']) {
    if (t[k] != null && String(t[k]).trim()) doc[k] = String(t[k]).slice(0, 300);
  }
  return doc;
}

// The poll's patch: nothing when the job is still running; the outcome and
// the permanent clip url when it is done; the error when it failed.
function finishPatch(job, video) {
  const st = job && job.status;
  if (!st || st === 'PROCESSING' || st === 'PENDING' || st === 'QUEUED' || st === 'STARTING') return null;
  const p = { status: String(st).toLowerCase(), doneAt: new Date().toISOString() };
  if (st === 'COMPLETED' && video) p.video = String(video);
  if (job && job.error) p.error = String(job.error).slice(0, 500);
  return p;
}

// Rebuild the doc from APIFRAME's own job record (the backfill's door).
function fromJob(job, tag) {
  const inp = (job && job.input) || {};
  const doc = sentRecord({ jobId: job.id, prompt: inp.prompt, model: inp.model || job.model,
    params: inp.seedanceParams || {}, tag });
  if (job.createdAt) doc.sentAt = String(job.createdAt);
  const fin = finishPatch(job, null);
  if (fin) Object.assign(doc, fin);
  return doc;
}

module.exports = { COLL, sentRecord, finishPatch, fromJob };
