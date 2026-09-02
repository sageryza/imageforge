#!/usr/bin/env node
// day-cut.js — the server's copy of the 5AM PACIFIC day cut, pinned to fixed
// instants so it cannot drift from the page's `dayKey` (which
// test-chats-day-rules.js pins to the same rule). Pure, no network.
//   node scripts/test-day-cut.js
const assert = require('assert');
const { dayKey, today } = require('../day-cut');

// August: PDT is UTC-7, so 5:00am Pacific is 12:00Z.
assert.strictEqual(dayKey('2026-08-27T11:59:00Z'), '2026-08-26', '4:59am PDT is still yesterday');
assert.strictEqual(dayKey('2026-08-27T12:00:00Z'), '2026-08-27', '5:00am PDT starts the day');
assert.strictEqual(dayKey('2026-08-27T06:59:00Z'), '2026-08-26', '11:59pm PDT Aug 26');
assert.strictEqual(dayKey('2026-08-27T07:00:00Z'), '2026-08-26', 'midnight PDT is NOT a new day');
assert.strictEqual(dayKey('2026-08-27T23:30:00Z'), '2026-08-27', 'an afternoon');
// January: PST is UTC-8, so 5:00am Pacific is 13:00Z — an offset of -8 baked
// in would put August's cut an hour out.
assert.strictEqual(dayKey('2026-01-15T12:59:00Z'), '2026-01-14', '4:59am PST is still yesterday');
assert.strictEqual(dayKey('2026-01-15T13:00:00Z'), '2026-01-15', '5:00am PST starts the day');
// The DST switch itself (2026-11-01, 2am PDT → 1am PST): 5am still lands at 5am.
assert.strictEqual(dayKey('2026-11-01T12:59:00Z'), '2026-10-31', '4:59am PST on the switch day');
assert.strictEqual(dayKey('2026-11-01T13:00:00Z'), '2026-11-01', '5:00am PST on the switch day');
// Unreadable → ''
assert.strictEqual(dayKey(''), '');
assert.strictEqual(dayKey('nope'), '');
assert.strictEqual(today('2026-08-27T12:00:00Z'), '2026-08-27');
assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
console.log('OK — day-cut');
