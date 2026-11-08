import assert from 'node:assert/strict';
import test from 'node:test';
import { MESSAGES } from '../src/i18n.js';
import { AARTI_CUES } from '../src/aarti-lyrics.js';

class Element {
  constructor(bounds = { left: 0, top: 0, width: 400, height: 600 }) {
    this.bounds = bounds;
    this.dataset = {};
    this.style = { setProperty() {} };
    this.children = [];
    this.listeners = new Map();
    this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
      toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name),
    };
    this.clientWidth = 400;
    this.clientHeight = 600;
  }
  addEventListener(name, fn) { this.listeners.set(name, fn); }
  dispatch(name, props = {}) {
    this.listeners.get(name)?.({ currentTarget: this, pointerId: 1, button: 0, preventDefault() {}, ...props });
  }
  setAttribute(name, value) { this[name] = value; }
  focus() { this.focused = true; }
  getBoundingClientRect() { return this.bounds; }
  setPointerCapture(id) { this.capture = id; }
  hasPointerCapture(id) { return this.capture === id; }
  releasePointerCapture() {
    this.capture = null;
    this.dispatch('lostpointercapture');
  }
  append(child) { this.children.push(...(child.fragment ? child.children : [child])); }
  replaceChildren() { this.children = []; }
  getContext() { return null; }
}

for (const kind of ['skyshot', 'diya']) {
  test(`${kind} first: drags, invitation, other path, and closing wish work end to end`, async () => {
    const ids = Object.fromEntries([
      'entry-orb', 'entry-hint', 'ritual-stage', 'ritual-scene', 'ritual-label',
      'ritual-instruction', 'ritual-progress', 'orb-field', 'diya-wick', 'skyshot-fuse', 'skyshot-fireworks',
      'ritual-invitation', 'ritual-quote', 'other-ritual',
      'aarti-invitation', 'begin-aarti', 'skip-aarti', 'close-aarti', 'aarti-title',
      'aarti-audio', 'aarti-current-line', 'aarti-next-line', 'aarti-status', 'aarti-replay',
      'sound-toggle',
    ].map((id) => [id, new Element()]));
    ids['ritual-progress'].children = [new Element(), new Element(), new Element()];
    ids['ritual-invitation'].hidden = true;
    ids['other-ritual'].hidden = true;
    ids['aarti-invitation'].hidden = true;
    const audio = ids['aarti-audio'];
    audio.currentTime = 0;
    audio.playCount = 0;
    audio.play = async () => { audio.playCount += 1; audio.paused = false; audio.dispatch('playing'); };
    audio.pause = () => { audio.paused = true; audio.dispatch('pause'); };
    // Scaled and offset, as during the screen's entrance animation.
    ids['orb-field'].bounds = { left: 10, top: 20, width: 440, height: 660 };
    const target = ids[kind === 'diya' ? 'diya-wick' : 'skyshot-fuse'];
    target.bounds = { left: 198, top: 480, width: 64, height: 64 };
    const screens = ['entry', 'choice', 'ritual', 'aarti'].map((screen) => {
      const element = new Element();
      element.dataset.screen = screen;
      element.inert = screen !== 'entry';
      return element;
    });
    screens[0].classList.add('is-visible');
    const choice = new Element();
    choice.dataset.choice = kind;
    const languageButtons = ['en', 'hi'].map((language) => {
      const button = new Element();
      button.dataset.language = language;
      return button;
    });
    const setLanguage = (language) => languageButtons[language === 'hi' ? 1 : 0].dispatch('click');
    ids['ritual-label'].dataset.i18n = 'diyaLabel';
    ids['ritual-instruction'].dataset.i18n = 'initialInstruction';
    ids['aarti-current-line'].dataset.i18n = 'aartiInterlude';
    ids['aarti-status'].dataset.i18n = 'aartiReady';
    const oldDocument = globalThis.document;
    const oldWindow = globalThis.window;
    globalThis.document = {
      documentElement: { lang: 'en' },
      querySelectorAll: (selector) => ({
        '[data-screen]': screens,
        '[data-choice]': [choice],
        '[data-language]': languageButtons,
        '[data-i18n]': Object.values(ids).filter((element) => element.dataset.i18n),
      })[selector] ?? [],
      querySelector: (selector) => selector.startsWith('#')
        ? ids[selector.slice(1)] : screens.find((screen) => screen.classList.contains('is-visible')),
      createElement: () => new Element(),
      createDocumentFragment: () => Object.assign(new Element(), { fragment: true }),
    };
    const timers = new Map();
    let timerId = 0;
    globalThis.window = {
      setTimeout: (fn, delay) => {
        const id = ++timerId;
        if (delay === 1200) timers.set(id, fn);
        else fn();
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      matchMedia: () => ({ matches: false }),
    };
    const settleDiya = () => {
      for (const [id, fn] of timers) {
        timers.delete(id);
        fn();
      }
    };
    try {
      await import(`../src/app.js?test=${kind}`);
      ids['entry-orb'].dispatch('click');
      choice.dispatch('click');
      const orbs = ids['orb-field'].children;
      assert.equal(orbs.length, 10);
      assert.ok(ids['ritual-invitation'].hidden);
      ids['begin-aarti'].dispatch('click');
      assert.equal(audio.playCount, 0, 'aarti is gated until both rituals settle');
      ids['other-ritual'].dispatch('click');
      assert.equal(ids['orb-field'].children, orbs);
      for (const light of orbs) {
        assert.ok(Number(light.dataset.homeY) >= 30 && Number(light.dataset.homeY) <= 68);
      }
      assert.match(ids['ritual-instruction'].textContent, /glowing/);
      const orb = orbs[0];
      orb.dispatch('pointerdown', { clientX: 100, clientY: 200 });
      orb.dispatch('pointermove', { clientX: 230, clientY: 512 });
      assert.equal(orb.style.left, '200px');
      assert.ok(ids['ritual-scene'].classList.contains('is-near-target'));
      setLanguage('hi');
      assert.equal(globalThis.document.documentElement.lang, 'hi');
      assert.equal(ids['ritual-instruction'].textContent, MESSAGES.hi[`${kind}Instruction`]);
      assert.equal(orb.ariaLabel, MESSAGES.hi.orbLabel);
      assert.equal(ids['orb-field'].children, orbs);
      assert.equal(orb.style.left, '200px');
      assert.ok(orb.classList.contains('is-dragging'), 'language switching preserves an active drag');
      setLanguage('en');
      orb.dispatch('pointercancel');
      assert.equal(orb.classList.contains('is-dragging'), false);
      assert.equal(ids['ritual-scene'].dataset.progress, '0');
      orb.dispatch('pointerdown');
      orb.dispatch('pointerup', { clientX: 10, clientY: 10 });
      assert.equal(ids['ritual-scene'].dataset.progress, '0');
      orb.dispatch('pointerdown');
      orb.releasePointerCapture();
      assert.equal(orb.classList.contains('is-dragging'), false);
      for (let index = 0; index < 3; index += 1) {
        orbs[index].dispatch('pointerdown', { clientX: 100, clientY: 200 });
        orbs[index].dispatch('pointerup', { clientX: 230, clientY: 512 });
        assert.equal(ids['ritual-scene'].dataset.progress, String(index + 1));
        assert.ok(orbs[index].classList.contains('is-used'));
        if (index === 0) {
          setLanguage('hi');
          assert.equal(ids['ritual-progress']['aria-label'], 'संजोए उजाले: 3 में से 1');
          assert.equal(ids['ritual-scene'].dataset.progress, '1');
          assert.equal(ids['orb-field'].children, orbs);
          setLanguage('en');
        }
      }
      assert.ok(ids['ritual-scene'].classList.contains('is-complete'));
      orbs[3].dispatch('pointerdown');
      assert.equal(orbs[3].classList.contains('is-dragging'), false);
      if (kind === 'diya') {
        assert.ok(ids['ritual-invitation'].hidden, 'waits for the flame to settle');
        setLanguage('hi');
        assert.ok(ids['ritual-invitation'].hidden, 'translation does not reveal a pending invitation early');
        assert.equal(ids['ritual-instruction'].textContent, MESSAGES.hi.diyaComplete);
        setLanguage('en');
        ids['other-ritual'].dispatch('click');
        assert.equal(ids['ritual-scene'].dataset.kind, kind);
        settleDiya();
      }
      const nextKind = kind === 'diya' ? 'skyshot' : 'diya';
      assert.equal(ids['ritual-invitation'].hidden, false);
      assert.equal(ids['other-ritual'].hidden, false);
      assert.equal(ids['other-ritual'].dataset.kind, nextKind);
      assert.match(ids['ritual-quote'].textContent, /Why not/);
      setLanguage('hi');
      assert.equal(ids['ritual-quote'].textContent, MESSAGES.hi[`${kind}Invitation`]);
      assert.equal(ids['other-ritual'].textContent, MESSAGES.hi[kind === 'diya' ? 'experienceFireworks' : 'lightDiya']);
      ids['begin-aarti'].dispatch('click');
      assert.ok(ids['aarti-invitation'].hidden);
      assert.equal(audio.playCount, 0, 'one completed ritual is not enough');
      ids['other-ritual'].dispatch('click');
      const nextOrbs = ids['orb-field'].children;
      assert.equal(ids['ritual-instruction'].textContent, MESSAGES.hi[`${nextKind}Instruction`]);
      assert.ok(nextOrbs.every((light) => light.ariaLabel === MESSAGES.hi.orbLabel));
      setLanguage('en');
      assert.notEqual(nextOrbs, orbs);
      assert.equal(nextOrbs.length, 10);
      assert.equal(ids['ritual-scene'].dataset.kind, nextKind);
      assert.equal(ids['ritual-scene'].dataset.progress, '0');
      assert.equal(ids['ritual-scene'].classList.contains('is-complete'), false);
      assert.ok(ids['ritual-invitation'].hidden);
      assert.ok(ids['ritual-progress'].children.every((dot) => !dot.classList.contains('is-filled')));
      assert.ok(ids['ritual-label'].focused);
      assert.equal(ids['ritual-stage']['aria-label'], nextKind === 'diya' ? 'Light a diya' : 'Wake the skyshot');
      ids['other-ritual'].dispatch('click');
      assert.equal(ids['orb-field'].children, nextOrbs, 'double clicks cannot restart the second path');
      // Each path has its own target; do not accidentally retain the first target.
      ids[nextKind === 'diya' ? 'diya-wick' : 'skyshot-fuse'].bounds = { left: 98, top: 380, width: 64, height: 64 };
      for (const light of nextOrbs.slice(0, 3)) {
        light.dispatch('pointerdown', { clientX: 200, clientY: 200 });
        light.dispatch('pointerup', { clientX: 130, clientY: 412 });
      }
      settleDiya();
      assert.equal(ids['ritual-scene'].dataset.progress, '3');
      assert.equal(ids['ritual-invitation'].hidden, false);
      assert.equal(ids['ritual-quote'].textContent, 'A little glow, a little wonder. May both stay with you this Diwali.');
      assert.ok(ids['other-ritual'].hidden);
      ids['other-ritual'].dispatch('click');
      assert.equal(ids['ritual-scene'].dataset.kind, nextKind, 'no invitation loop after both paths');
      assert.equal(ids['aarti-invitation'].hidden, false);
      setLanguage('hi');
      assert.equal(ids['ritual-quote'].textContent, MESSAGES.hi.closingWish);
      assert.equal(ids['aarti-invitation'].hidden, false);
      setLanguage('en');
      assert.equal(audio.playCount, 0, 'finishing both rituals never autoplays audio');
      if (kind === 'diya') {
        ids['begin-aarti'].dispatch('click');
        assert.equal(audio.playCount, 1);
        assert.ok(screens.find((screen) => screen.dataset.screen === 'aarti').classList.contains('is-visible'));
        assert.equal(screens.find((screen) => screen.dataset.screen === 'ritual').inert, true);
        assert.equal(screens.find((screen) => screen.dataset.screen === 'aarti').inert, false);
        assert.ok(ids['aarti-title'].focused);
        const lyricTime = AARTI_CUES[0].start + .1;
        audio.currentTime = lyricTime;
        audio.dispatch('timeupdate');
        setLanguage('hi');
        assert.equal(audio.currentTime, lyricTime);
        assert.equal(audio.playCount, 1);
        assert.equal(audio.paused, false);
        assert.equal(ids['aarti-status'].textContent, MESSAGES.hi.aartiPlaying, 'static translations do not overwrite player state');
        assert.match(ids['aarti-current-line'].textContent, /लक्ष्मी/);
        setLanguage('en');
        ids['close-aarti'].dispatch('click');
        assert.ok(audio.paused, 'returning to the quiet stops playback');
        assert.ok(screens.find((screen) => screen.dataset.screen === 'ritual').classList.contains('is-visible'));
      }
      const playCount = audio.playCount;
      ids['skip-aarti'].dispatch('click');
      assert.ok(ids['aarti-invitation'].hidden);
      assert.ok(ids['ritual-quote'].focused);
      ids['begin-aarti'].dispatch('click');
      assert.equal(audio.playCount, playCount, 'declining the invitation never starts audio');
    } finally {
      globalThis.document = oldDocument;
      globalThis.window = oldWindow;
    }
  });
}
