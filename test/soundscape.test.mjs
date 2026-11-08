import assert from 'node:assert/strict';
import test from 'node:test';
import { createSoundscape } from '../src/soundscape.js';
import { createI18n, MESSAGES } from '../src/i18n.js';

class Param {
  value = 0;
  events = [];
  setTargetAtTime(value, time, constant) { this.events.push({ type: 'target', value, time, constant }); }
  setValueAtTime(value, time) { this.events.push({ type: 'value', value, time }); }
  exponentialRampToValueAtTime(value, time) { this.events.push({ type: 'ramp', value, time }); }
}

class Node {
  connect(node) { return node; }
  disconnect() { this.disconnected = true; }
}

class Context {
  state = 'suspended';
  currentTime = 0;
  sampleRate = 8000;
  destination = new Node();
  gains = [];
  sources = [];
  resumeCount = 0;
  createGain() {
    const node = Object.assign(new Node(), { gain: new Param() });
    this.gains.push(node);
    return node;
  }
  createDynamicsCompressor() {
    return Object.assign(new Node(), { threshold: new Param(), knee: new Param(), ratio: new Param() });
  }
  createBiquadFilter() { return Object.assign(new Node(), { frequency: new Param() }); }
  createBuffer(channels, length) {
    const samples = new Float32Array(length);
    return { getChannelData: () => samples };
  }
  source() {
    const source = Object.assign(new Node(), {
      start: (time = 0) => { source.startedAt = time; },
      stop: (time = this.currentTime) => {
        source.stoppedAt = time;
        if (time <= this.currentTime) source.onended?.();
      },
    });
    this.sources.push(source);
    return source;
  }
  createBufferSource() { return this.source(); }
  createOscillator() { return Object.assign(this.source(), { frequency: new Param() }); }
  async resume() { this.state = 'running'; this.resumeCount += 1; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
}

class Button extends EventTarget {
  attributes = {};
  setAttribute(name, value) { this.attributes[name] = value; }
  click() { this.dispatchEvent(new Event('click')); }
}

function fixture({ supported = true, preference } = {}) {
  const contexts = [];
  const button = new Button();
  const host = new EventTarget();
  const data = new Map(preference ? [['diwali-effects', preference]] : []);
  host.localStorage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  if (supported) host.AudioContext = class extends Context { constructor() { super(); contexts.push(this); } };
  const root = Object.assign(new EventTarget(), {
    hidden: false,
    documentElement: {},
    defaultView: host,
    querySelector: () => button,
    querySelectorAll: () => [],
  });
  const i18n = createI18n(root);
  const sounds = createSoundscape(root, i18n);
  return { contexts, button, host, root, data, i18n, sounds };
}

const target = (gain) => gain.gain.events.filter((event) => event.type === 'target').at(-1)?.value;

test('sound is lazy, starts only after a gesture, and reuses one audio context', async () => {
  const { sounds, contexts, button } = fixture();
  assert.equal(contexts.length, 0);
  sounds.setScene('diya');
  sounds.lightDiya();
  assert.equal(contexts.length, 0);
  assert.equal(button.attributes['aria-pressed'], 'true');
  await sounds.unlock();
  const context = contexts[0];
  assert.equal(context.state, 'running');
  assert.equal(context.sources.length, 4, 'only the ambience and flame loops are persistent');
  assert.equal(target(context.gains[0]), .55);
  await sounds.unlock();
  assert.equal(contexts.length, 1);
  sounds.dispose();
  sounds.dispose();
  assert.equal(context.state, 'closed');
});

test('ignition and fireworks have bounded envelopes, and changing paths cancels old effects', async () => {
  const { sounds, contexts } = fixture();
  sounds.setScene('diya');
  await sounds.unlock();
  const context = contexts[0];
  sounds.lightDiya();
  assert.equal(context.sources.length, 5);
  assert.equal(context.sources.at(-1).stoppedAt, .85);
  assert.equal(target(context.gains[2]), .055, 'a lit diya gets a subtle crackle');
  sounds.setScene('skyshot');
  assert.equal(context.sources[4].stoppedAt, 0);
  assert.equal(target(context.gains[2]), 0);
  sounds.launch(0);
  assert.equal(context.sources.length, 7);
  sounds.burst();
  assert.equal(context.sources.length, 9);
  assert.equal(context.sources.at(-2).stoppedAt, 1.35);
  assert.equal(context.sources.at(-1).stoppedAt, .65);
  const peaks = context.gains.flatMap((node) => node.gain.events.filter((event) => event.type === 'ramp').map((event) => event.value));
  assert.ok(peaks.every((peak) => peak > 0 && peak <= .32));
  sounds.dispose();
});

test('mute preference persists, changes language, stops tails, and never replays missed effects', async () => {
  const { sounds, contexts, button, data, i18n } = fixture({ preference: 'off' });
  sounds.setScene('diya');
  await sounds.unlock();
  assert.equal(contexts.length, 0);
  assert.equal(button.textContent, MESSAGES.en.effectsOff);
  button.click();
  await Promise.resolve();
  const context = contexts[0];
  assert.equal(data.get('diwali-effects'), 'on');
  sounds.lightDiya();
  assert.equal(context.sources.length, 5);
  button.click();
  assert.equal(target(context.gains[0]), 0);
  assert.equal(context.sources[4].stoppedAt, 0);
  assert.equal(data.get('diwali-effects'), 'off');
  i18n.setLanguage('hi');
  assert.equal(button.textContent, MESSAGES.hi.effectsOff);
  assert.equal(button.attributes['aria-label'], MESSAGES.hi.unmuteEffects);
  sounds.lightDiya();
  button.click();
  await Promise.resolve();
  assert.equal(context.sources.length, 5, 'unmuting never queues an old ignition');
  assert.equal(target(context.gains[2]), .055);
  sounds.dispose();
});

test('aarti and quiet scenes silence synthesis without changing the aarti recording', async () => {
  const { sounds, contexts } = fixture();
  sounds.setScene('skyshot');
  await sounds.unlock();
  sounds.burst();
  const context = contexts[0];
  const count = context.sources.length;
  sounds.setScene('aarti');
  assert.equal(target(context.gains[0]), 0);
  sounds.burst();
  sounds.launch(1);
  sounds.lightDiya();
  assert.equal(context.sources.length, count);
  assert.ok(context.sources.slice(4).every((source) => source.disconnected));
  sounds.setScene('quiet');
  assert.equal(target(context.gains[0]), 0);
  sounds.dispose();
});

test('hidden pages suspend sound and cancel tails; returning resumes ambience without replaying effects', async () => {
  const { sounds, contexts, root, host } = fixture();
  sounds.setScene('skyshot');
  await sounds.unlock();
  sounds.burst();
  const context = contexts[0];
  const count = context.sources.length;
  root.hidden = true;
  root.dispatchEvent(new Event('visibilitychange'));
  assert.equal(context.state, 'suspended');
  assert.equal(target(context.gains[0]), 0);
  root.hidden = false;
  root.dispatchEvent(new Event('visibilitychange'));
  await Promise.resolve();
  assert.equal(context.state, 'running');
  assert.equal(context.sources.length, count);
  host.dispatchEvent(new Event('pagehide'));
  assert.equal(context.state, 'suspended');
  host.dispatchEvent(new Event('pageshow'));
  await Promise.resolve();
  assert.equal(context.state, 'running');
  sounds.dispose();
  root.dispatchEvent(new Event('visibilitychange'));
  assert.equal(context.state, 'closed');
});

test('unsupported audio or blocked storage never breaks the visual experience', async () => {
  const { sounds, button } = fixture({ supported: false });
  assert.ok(button.disabled);
  assert.equal(button.textContent, MESSAGES.en.effectsUnavailable);
  await sounds.unlock();
  assert.doesNotThrow(() => { sounds.setScene('diya'); sounds.lightDiya(); sounds.setScene('skyshot'); sounds.burst(); sounds.dispose(); });
  const supported = fixture();
  supported.sounds.dispose();
  Object.defineProperty(supported.host, 'localStorage', { get() { throw new Error('Blocked'); } });
  const another = createSoundscape(supported.root, supported.i18n);
  another.setScene('choice');
  await another.unlock();
  assert.equal(supported.contexts.length, 1);
  another.dispose();
});
