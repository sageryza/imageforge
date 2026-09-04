#!/usr/bin/env node
// Files the for-Claude list notes ALREADY on message docs (`ticknotes`, the
// tick box's notes from before 2026-09-04's inbox copy) into
// `forge-item-notes`, so the one notes inbox lists them. Dry by default;
// `--go` writes. Never touches the message doc; never files a just-for-me
// note; a doc already there is left alone (a chat may have answered on it).
//   node scripts/backfill-item-notes.js [--go] [--chat <slug>]
const admin = require('firebase-admin');
const args = process.argv.slice(2);
const GO = args.includes('--go');
const chatArg = args.includes('--chat') ? args[args.indexOf('--chat') + 1] : '';
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!sa.project_id) { console.error('FIREBASE_SERVICE_ACCOUNT (deckfactory) needed'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
// The page's own rules, copied (chats.html is not a module): which lines are
// items, and the key an item's words hash to.
const LIST_MARK = /^(\s*)(?:[-*•]|\d{1,2}[.)])\s+(\S.*)$/;
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function tickKey(html) {
  const t = String(html).replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 200);
  let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36) + t.length.toString(36);
}
function itemsOf(text) {
  const out = {};
  String(text || '').split('\n').forEach((raw) => {
    const l = esc(raw).replace(/\*\*([^*\n][^*]*?)\*\*/g, '<b>$1</b>');
    const mm = LIST_MARK.exec(l);
    const body = mm ? mm[2] : (/^<b>[^<]+<\/b>/.test(l) ? l : null);
    if (body) out[tickKey(body)] = body.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim().slice(0, 240);
  });
  return out;
}
(async () => {
  let q = db.collection('forge-chat-feed').where('ticknotes', '!=', null);
  if (chatArg) q = q.where('chat', '==', chatArg);
  const snap = await q.get();
  let n = 0, skipped = 0;
  for (const d of snap.docs) {
    const m = d.data(); const items = itemsOf(m.text);
    for (const [key, nt] of Object.entries(m.ticknotes || {})) {
      if (!nt || !nt.text || nt.to === 'me') continue;
      const ref = db.collection('forge-item-notes').doc(String(d.id).slice(0, 80) + '__' + key);
      if ((await ref.get()).exists) { skipped++; continue; }
      const item = items[key] || '';
      const at = nt.at || m.created || new Date().toISOString();
      console.log((GO ? 'WRITE ' : 'would write ') + m.chat + ' · "' + item.slice(0, 50) + '" → ' + JSON.stringify(nt.text.slice(0, 60)));
      if (GO) await ref.set({ chat: m.chat, msgId: d.id, key, item, text: nt.text, at, updatedAt: at, thread: [{ from: 'sophie', text: nt.text, at }] });
      n++;
    }
  }
  console.log((GO ? 'wrote ' : 'would write ') + n + ', already there ' + skipped + (GO ? '' : ' (dry — add --go)'));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
