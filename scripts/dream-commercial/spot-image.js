// Draw the dream picture the song spot shows on the phone — through the APP'S
// OWN recipe, not an imitation.
//
//   node scripts/dream-commercial/spot-image.js "i dreamt you were in my kitchen…"
//
// The shot is of the dream app's screen, so the picture in it has to be what
// the app actually produces: movies.js `makeDreamImage` (gpt-image-2 EDITS
// with refs/dream-mystery.jpg attached as the style reference, SQUARE
// 1024x1024, medium — 5.3¢, the app's exact spend per dream). Calling that
// export is the point of this file: a hand-styled lookalike would not match
// what a user sees, and re-deriving the prompt wrapper here would drift from
// the server the day it changes.
//
// It deliberately does NOT go through /api/dreamapp/dreams/:id/draw — that
// writes a real dream into a real person's feed. Nothing here touches
// Firestore; the picture lands in Storage and the url is printed.
// Needs OPENAI_API_KEY + FIREBASE_SERVICE_ACCOUNT.
const { makeDreamImage } = require(require('path').join(__dirname, '..', '..', 'movies'));

(async () => {
  const text = process.argv[2];
  if (!text) { console.error('usage: node spot-image.js "<the dream>"'); process.exit(1); }
  const dream = { id: 'spot-prop', dreamText: text, castApproved: [], driftCues: [] };
  const page = await makeDreamImage(dream, 'medium', async (d, t, label) => process.stdout.write(label + '\n'));
  console.log(JSON.stringify({ url: page.url, imagePlan: page.imagePlan, promptUsed: page.promptUsed, spend: dream.spend }, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
