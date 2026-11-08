import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import { AARTI_RECORDING } from '../src/aarti-lyrics.js';

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

test('aarti uses the supplied local audio with opt-in playback and accessible lyrics controls', async () => {
  const audio = page.match(/<audio\b[^>]*>/)?.[0];
  assert.ok(audio);
  assert.ok(audio.includes(`src="audio/lakshmi-aarti.mp3?v=${AARTI_RECORDING.sha256.slice(0, 12)}"`));
  assert.match(audio, /controls/);
  assert.match(audio, /preload="none"/);
  assert.doesNotMatch(audio, /autoplay|loop/);
  assert.ok((await stat(new URL('../audio/lakshmi-aarti.mp3', import.meta.url))).size > 0);
  assert.match(page, /data-screen="aarti"[^>]*inert/);
  assert.match(page, /id="begin-aarti"/);
  assert.match(page, /id="skip-aarti"/);
  assert.match(page, /id="close-aarti"/);
  assert.match(page, /data-lyrics-script="romanized"/);
  assert.match(page, /data-lyrics-script="hindi"/);
  assert.match(page, /class="aarti-lyrics" aria-live="off"/);
});

test('ending includes the personal credit, safe social links, and a restart action', () => {
  assert.match(page, /data-screen="ending"[^>]*inert/);
  assert.match(page, /id="ending-title"/);
  assert.match(page, /Lakshay Malik/);
  for (const url of ['https://github.com/neolakshay', 'https://www.instagram.com/neolakshay']) {
    const link = [...page.matchAll(/<a\b[^>]*>/g)].map(([tag]) => tag).find((tag) => tag.includes(`href="${url}"`));
    assert.ok(link);
    assert.match(link, /target="_blank"/);
    assert.match(link, /rel="noopener noreferrer"/);
  }
  assert.match(page, /id="restart-greeting"/);
});
