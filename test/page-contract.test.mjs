import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

test('contains the discovery orb, choice tiles, and ritual regions', () => {
  assert.match(page, /id="entry-orb"/);
  assert.match(page, /data-choice="diya"/);
  assert.match(page, /data-choice="skyshot"/);
  assert.match(page, /id="ritual-stage"/);
  assert.match(page, /id="diya-wick"/);
  assert.match(page, /id="skyshot-fuse"/);
  assert.match(page, /src="src\/app\.js"/);
});

test('declares stable interaction hooks for the ritual controller', () => {
  assert.match(page, /id="entry-hint"/);
  assert.match(page, /id="ritual-progress"/);
  assert.match(page, /data-choice="diya"/);
  assert.match(page, /data-choice="skyshot"/);
  assert.match(app, /setPointerCapture/);
  assert.match(app, /applyDrop/);
  assert.match(app, /pointerdown/);
});
