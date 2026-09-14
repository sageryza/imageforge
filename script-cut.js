// THE SCRIPT BOX'S ONE RULE — scenes are separated by the word "cut" on a
// line of its own (2026-09-08, Sophie: "multiple scenes w only the word cut
// to separate them"). A chat reads GET /api/chatfeed/script?chat= and calls
// this; the words inside a scene are never touched — a "cut" INSIDE a
// sentence is her word, not a separator. Pure, no deps.
'use strict';
const CUT = /^[ \t]*cut[ \t.!:]*$/im;
function splitScenes(text) {
  return String(text || '').split(/\r?\n/).reduce((acc, line) => {
    if (CUT.test(line)) { acc.push([]); return acc; }
    acc[acc.length - 1].push(line); return acc;
  }, [[]]).map(ls => ls.join('\n').trim()).filter(Boolean);
}
module.exports = { splitScenes, CUT };
