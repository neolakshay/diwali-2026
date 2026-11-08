import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { AARTI_CUES, AARTI_RECORDING, getLyricFrame } from '../src/aarti-lyrics.js';
import { createAartiPlayer } from '../src/aarti-player.js';
import { createI18n, MESSAGES } from '../src/i18n.js';

class Element extends EventTarget {
  dataset = {};
  attributes = {};
  textContent = '';
  setAttribute(name, value) { this.attributes[name] = value; }
  fire(name) { this.dispatchEvent(new Event(name)); }
}

function fixture(i18n) {
  const elements = Object.fromEntries([
    'aarti-audio', 'aarti-current-line', 'aarti-next-line', 'aarti-status', 'aarti-replay',
  ].map((name) => [name, new Element()]));
  const audio = elements['aarti-audio'];
  let audioTime = 0;
  Object.defineProperty(audio, 'currentTime', {
    get: () => audioTime,
    set(value) { audioTime = value; if (value === 0) audio.ended = false; },
  });
  audio.currentTime = 0;
  audio.ended = false;
  audio.playCount = 0;
  audio.paused = true;
  audio.play = async () => {
    audio.playCount += 1;
    audio.paused = false;
    audio.ended = false;
    audio.fire('playing');
  };
  audio.pause = () => { audio.paused = true; audio.fire('pause'); };
  const buttons = ['romanized', 'hindi'].map((script) => {
    const button = new Element();
    button.dataset.lyricsScript = script;
    return button;
  });
  const player = createAartiPlayer({
    querySelector: (selector) => elements[selector.slice(1)],
    querySelectorAll: () => buttons,
  }, i18n);
  return { player, audio, elements, buttons };
}

test('cue lookup handles intros, gaps, exact boundaries, seeking backwards, and the outro', () => {
  const cues = [
    { start: 5, end: 8, romanized: 'First' },
    { start: 10, end: 15, romanized: 'Second' },
  ];
  assert.deepEqual(getLyricFrame(0, cues), { current: null, next: cues[0] });
  assert.deepEqual(getLyricFrame(5, cues), { current: cues[0], next: cues[1] });
  assert.deepEqual(getLyricFrame(8, cues), { current: null, next: cues[1] });
  assert.deepEqual(getLyricFrame(10, cues), { current: cues[1], next: null });
  assert.deepEqual(getLyricFrame(5.5, cues), { current: cues[0], next: cues[1] });
  assert.deepEqual(getLyricFrame(15, cues), { current: null, next: null });
  assert.deepEqual(getLyricFrame(0, []), { current: null, next: null });
});

test('recording cues are ordered, bilingual, nonoverlapping, and inside the supplied audio', () => {
  assert.ok(AARTI_CUES.length > 20);
  AARTI_CUES.forEach((cue, index) => {
    assert.ok(cue.start >= 0 && cue.end > cue.start && cue.end <= AARTI_RECORDING.duration);
    if (index) assert.ok(cue.start >= AARTI_CUES[index - 1].end);
    assert.ok(cue.romanized.length > 0);
    assert.match(cue.hindi, /[\u0900-\u097f]/);
  });
  assert.match(getLyricFrame(157.5, AARTI_CUES).current?.hindi ?? '', /सद्गुण/);
  assert.equal(getLyricFrame(235.5, AARTI_CUES).current?.hindi, 'कोई नहीं पाता');
  assert.match(getLyricFrame(249.5, AARTI_CUES).current?.hindi ?? '', /जन गाता/);
  assert.equal(getLyricFrame(267.5, AARTI_CUES).current?.hindi, 'पाप उतर जाता');
  assert.equal(getLyricFrame(75, AARTI_CUES).current?.hindi, 'सूर्य चन्द्रमा ध्यावत');
  assert.equal(getLyricFrame(94, AARTI_CUES).current?.hindi, 'दुर्गा रूप निरंजनी');
  assert.equal(getLyricFrame(335, AARTI_CUES).current?.hindi, 'ॐ जय लक्ष्मी माता');
  assert.equal(getLyricFrame(340, AARTI_CUES).current, null, 'instrumental outro is not stretched into a lyric');
});

test('lyric timings are tied to the exact recording, so another audio replacement requires re-alignment', async () => {
  const recording = await readFile(new URL('../audio/lakshmi-aarti.mp3', import.meta.url));
  assert.equal(recording.length, AARTI_RECORDING.bytes);
  assert.equal(createHash('sha256').update(recording).digest('hex'), AARTI_RECORDING.sha256);
});

test('replacement recording starts earlier and repeats the opening verse before Hari Vishnu Vidhata', () => {
  assert.equal(getLyricFrame(4.5, AARTI_CUES).current?.hindi, 'ॐ जय लक्ष्मी माता');
  assert.match(getLyricFrame(9.5, AARTI_CUES).current?.hindi ?? '', /मैया जय लक्ष्मी माता/);
  assert.match(getLyricFrame(20.5, AARTI_CUES).current?.hindi ?? '', /निशदिन सेवत/);
  assert.equal(getLyricFrame(25, AARTI_CUES).current?.hindi, 'हरि विष्णु विधाता');
});

test('player is opt-in and lyrics use the audio clock through pause and forward/backward seeking', async () => {
  const { player, audio, elements } = fixture();
  assert.equal(audio.playCount, 0);
  await player.play();
  assert.equal(audio.playCount, 1);
  audio.currentTime = AARTI_CUES[0].start;
  audio.fire('timeupdate');
  assert.equal(elements['aarti-current-line'].textContent, AARTI_CUES[0].romanized);
  assert.equal(elements['aarti-next-line'].textContent, AARTI_CUES[1].romanized);
  player.pause();
  assert.ok(audio.paused);
  assert.match(elements['aarti-status'].textContent, /pause/);
  audio.currentTime = AARTI_CUES[12].start;
  audio.fire('seeked');
  assert.equal(elements['aarti-current-line'].textContent, AARTI_CUES[12].romanized);
  audio.currentTime = AARTI_CUES[1].start;
  audio.fire('seeked');
  assert.equal(elements['aarti-current-line'].textContent, AARTI_CUES[1].romanized);
});

test('script switching preserves playback position and does not restart playback', async () => {
  const { player, audio, elements, buttons } = fixture();
  await player.play();
  audio.currentTime = AARTI_CUES[3].start;
  audio.fire('timeupdate');
  buttons[1].fire('click');
  assert.equal(elements['aarti-current-line'].textContent, AARTI_CUES[3].hindi);
  assert.equal(elements['aarti-current-line'].lang, 'hi');
  assert.equal(buttons[1].attributes['aria-pressed'], 'true');
  assert.equal(buttons[0].attributes['aria-pressed'], 'false');
  assert.equal(audio.currentTime, AARTI_CUES[3].start);
  assert.equal(audio.playCount, 1);
  buttons[0].fire('click');
  assert.equal(elements['aarti-current-line'].textContent, AARTI_CUES[3].romanized);
  assert.equal(elements['aarti-current-line'].lang, 'hi-Latn');
});

test('ending offers a closing wish, replay resets the track, and errors offer recovery', async () => {
  const { player, audio, elements } = fixture();
  audio.currentTime = AARTI_RECORDING.duration;
  audio.ended = true;
  audio.fire('ended');
  assert.match(elements['aarti-current-line'].textContent, /Shubh Diwali/);
  assert.equal(elements['aarti-next-line'].textContent, '');
  elements['aarti-replay'].fire('click');
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.playCount, 1);
  audio.play = () => Promise.reject(Object.assign(new Error('Blocked'), { name: 'NotAllowedError' }));
  await player.play();
  assert.match(elements['aarti-status'].textContent, /Press play/);
  audio.fire('error');
  assert.match(elements['aarti-status'].textContent, /could not be loaded/);
  audio.play = () => Promise.reject(new Error('Offline'));
  await player.play();
  assert.match(elements['aarti-status'].textContent, /could not play/);
});

test('site language changes translate a playing, paused, or failed player without restarting audio', async () => {
  const i18n = createI18n({ documentElement: {}, querySelectorAll: () => [] });
  const { player, audio, elements, buttons } = fixture(i18n);
  await player.play();
  audio.currentTime = AARTI_CUES[3].start;
  audio.fire('timeupdate');
  i18n.setLanguage('hi');
  assert.equal(elements['aarti-current-line'].textContent, AARTI_CUES[3].hindi);
  assert.equal(elements['aarti-status'].textContent, MESSAGES.hi.aartiPlaying);
  assert.equal(buttons[1].attributes['aria-pressed'], 'true');
  assert.equal(audio.playCount, 1);
  assert.equal(audio.currentTime, AARTI_CUES[3].start);
  assert.equal(audio.paused, false);
  player.pause();
  i18n.setLanguage('en');
  assert.equal(elements['aarti-status'].textContent, MESSAGES.en.aartiPaused);
  assert.ok(audio.paused);
  assert.equal(audio.playCount, 1);
  audio.play = () => Promise.reject(new Error('Offline'));
  await player.play();
  i18n.setLanguage('hi');
  assert.equal(elements['aarti-status'].textContent, MESSAGES.hi.aartiPlayError);
});

test('Hindi site language selects Hindi lyrics initially, including interludes and the closing wish', () => {
  const i18n = createI18n({ documentElement: {}, querySelectorAll: () => [] });
  i18n.setLanguage('hi');
  const { audio, elements, buttons } = fixture(i18n);
  assert.equal(audio.playCount, 0);
  assert.equal(elements['aarti-current-line'].textContent, MESSAGES.hi.aartiInterlude);
  assert.equal(elements['aarti-current-line'].lang, 'hi');
  assert.equal(elements['aarti-status'].textContent, MESSAGES.hi.aartiReady);
  assert.equal(buttons[1].attributes['aria-pressed'], 'true');
  audio.currentTime = AARTI_CUES[0].start;
  audio.fire('timeupdate');
  assert.equal(elements['aarti-current-line'].textContent, AARTI_CUES[0].hindi);
  buttons[0].fire('click');
  assert.equal(elements['aarti-current-line'].textContent, AARTI_CUES[0].romanized);
  assert.equal(elements['aarti-status'].textContent, MESSAGES.hi.aartiReady);
  audio.ended = true;
  audio.fire('ended');
  assert.equal(elements['aarti-current-line'].textContent, MESSAGES.hi.aartiFarewell);
  i18n.setLanguage('en');
  assert.equal(elements['aarti-current-line'].textContent, MESSAGES.en.aartiFarewell);
  assert.equal(audio.playCount, 0);
});

test('greeting restart resets the recording and lyrics without replaying audio or changing site language', async () => {
  const i18n = createI18n({ documentElement: {}, querySelectorAll: () => [] });
  i18n.setLanguage('hi');
  const { player, audio, elements, buttons } = fixture(i18n);
  await player.play();
  audio.currentTime = AARTI_RECORDING.duration;
  audio.ended = true;
  audio.fire('ended');
  buttons[0].fire('click');
  player.reset();
  assert.ok(audio.paused);
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.playCount, 1);
  assert.equal(i18n.language, 'hi');
  assert.equal(elements['aarti-current-line'].textContent, MESSAGES.hi.aartiInterlude);
  assert.equal(elements['aarti-next-line'].textContent, AARTI_CUES[0].hindi);
  assert.equal(elements['aarti-status'].textContent, MESSAGES.hi.aartiReady);
  assert.equal(buttons[1].attributes['aria-pressed'], 'true');
});
