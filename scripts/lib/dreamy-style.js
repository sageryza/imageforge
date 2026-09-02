// Reads PL_GPT_STYLES.dreamy's literals out of server.js SOURCE — for
// scripts that must build prompts through triset's own init (the seed script,
// the triset test) without booting the whole app. server.js stays the one
// owner of the wording; this parses it, never copies it, so a reword there
// reaches every caller here on the next run.
const fs = require('fs');
const path = require('path');

function joined(lit) {
  return String(lit).split(/'\s*\+\s*'/).join('').replace(/^\s*'/, '').replace(/'\s*$/, '');
}

function grabIn(block, key) {
  const m = block.match(new RegExp(key + ":\\s*((?:'(?:[^'\\\\]|\\\\.)*'\\s*\\+?\\s*)+)"));
  return m ? joined(m[1].trim()) : null;
}

function dreamyStyle(serverSrc) {
  const src = serverSrc || fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');
  const table = src.slice(src.indexOf('const PL_GPT_STYLES = {'));
  const start = table.indexOf('\n  dreamy: {');
  if (start < 0) throw new Error('PL_GPT_STYLES.dreamy not found in server.js');
  const entry = table.slice(start, table.indexOf('\n  },', start));
  const sub = (name) => {
    const i = entry.indexOf(name + ': {');
    return i < 0 ? '' : entry.slice(i, entry.indexOf('\n    },', i));
  };
  const refs = entry.match(/refFiles:\s*\[([^\]]*)\]/);
  return {
    label: grabIn(entry, 'label') || 'Dreamy',
    prefix: grabIn(entry, 'prefix'),
    suffix: grabIn(entry, 'suffix'),
    refFiles: refs ? refs[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean) : [],
    noText: { from: grabIn(sub('noText'), 'from'), to: grabIn(sub('noText'), 'to') },
    sheet: { from: grabIn(sub('sheet'), 'from'), to: grabIn(sub('sheet'), 'to') },
  };
}

module.exports = { dreamyStyle };
