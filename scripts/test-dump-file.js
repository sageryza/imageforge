#!/usr/bin/env node
'use strict';
// THE DUMP TAKES A FILE — a zip, a PDF — AND FILES IT AS ONE (2026-09-16,
// the LumaFusion zip door: her XML Project Package shares straight into the
// Dump from the export sheet, and scripts/fcpxml-to-cut.js --dump reads it
// back). Pure — no Firestore, no network, no bytes.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const drop = require('../dropbox.js');
const { pickDump } = require('./fcpxml-to-cut.js');
const ROOT = path.join(__dirname, '..');
let pass = 0;
const t = (name, fn) => {
  try { fn(); pass += 1; console.log('  ok  ' + name); } catch (e) {
    console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1;
  }
};

t('a zip and a pdf are files, never pictures', () => {
  assert.strictEqual(drop.mediaKind(drop.ctForName('cut.zip')), 'file');
  assert.strictEqual(drop.mediaKind('application/x-zip-compressed'), 'file');
  assert.strictEqual(drop.mediaKind(drop.ctForName('sheet.pdf')), 'file');
  assert.strictEqual(drop.extFor('application/zip'), 'zip');
});
t('pictures, clips and recordings are untouched', () => {
  assert.strictEqual(drop.mediaKind(drop.ctForName('a.jpg')), 'image');
  assert.strictEqual(drop.mediaKind(drop.ctForName('a.mov')), 'video');
  assert.strictEqual(drop.mediaKind(drop.ctForName('a.m4a')), 'audio');
  assert.strictEqual(drop.mediaKind(''), 'image');
});
t('the Dump page draws a file as its name with a save link, not an <img>', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public/dump.html'), 'utf8');
  assert.ok(/f\.media==='file'/.test(html));
  assert.ok(/href="\/api\/drop\/file\/'\+esc\(f\.id\)/.test(html));
});
t('the share extension accepts a zip and names its type', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'ios/DumpShare/ShareViewController.swift'), 'utf8');
  assert.strictEqual((sw.match(/UTType\.zip\.identifier/g) || []).length, 3, 'filter, loader, and the type ladder');
  assert.ok(/case "zip":\s+return "application\/zip"/.test(sw));
});
t('--dump latest is the newest zip; an id is that one', () => {
  const items = [
    { id: 'a', filename: 'old.zip', createdAt: 1 },
    { id: 'b', filename: 'sheet.pdf', createdAt: 5 },
    { id: 'c', filename: 'new.zip', createdAt: 3 },
  ];
  assert.strictEqual(pickDump(items, 'latest').id, 'c');
  assert.strictEqual(pickDump(items, 'a').id, 'a');
  assert.strictEqual(pickDump(items, 'zz'), null);
  assert.strictEqual(pickDump([], 'latest'), null);
});
console.log(process.exitCode ? 'test-dump-file: FAILED' : `test-dump-file: ${pass} checks passed`);
