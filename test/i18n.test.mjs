import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createI18n, MESSAGES, translate } from '../src/i18n.js';

class Element extends EventTarget {
  dataset = {};
  attributes = {};
  classes = new Set();
  classList = { toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name) };
  setAttribute(name, value) { this.attributes[name] = value; }
  click() { this.dispatchEvent(new Event('click')); }
}

function fixture(storage) {
  const heading = new Element();
  heading.dataset.i18n = 'choiceTitle';
  const label = new Element();
  label.dataset.i18nAria = 'beginGreeting';
  const buttons = ['en', 'hi'].map((language) => {
    const button = new Element();
    button.dataset.language = language;
    return button;
  });
  const root = {
    documentElement: { lang: 'en' },
    defaultView: storage ? { localStorage: storage } : {},
    querySelectorAll: (selector) => ({
      '[data-i18n]': [heading], '[data-i18n-aria]': [label], '[data-language]': buttons,
    })[selector] ?? [],
  };
  return { root, heading, label, buttons };
}

test('all translation keys and static page bindings have both English and Hindi text', async () => {
  assert.deepEqual(Object.keys(MESSAGES.en).sort(), Object.keys(MESSAGES.hi).sort());
  for (const [key, hindi] of Object.entries(MESSAGES.hi)) {
    assert.match(hindi, /[\u0900-\u097f]/, key);
    assert.deepEqual(hindi.match(/\{\w+\}/g)?.sort(), MESSAGES.en[key].match(/\{\w+\}/g)?.sort(), key);
  }
  const page = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const [, key] of page.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) {
    assert.ok(Object.hasOwn(MESSAGES.en, key), key);
    assert.ok(Object.hasOwn(MESSAGES.hi, key), key);
  }
  const hindiButton = page.match(/<button\b[^>]*data-language="hi"[^>]*>/)?.[0];
  assert.ok(hindiButton);
  assert.doesNotMatch(hindiButton, /disabled/);
  assert.doesNotMatch(page, /coming soon/);
});

test('top-right toggle updates text, accessibility labels, document language, and pressed state', () => {
  const { root, heading, label, buttons } = fixture();
  const i18n = createI18n(root);
  let changes = 0;
  const unsubscribe = i18n.subscribe(() => { changes += 1; });
  assert.equal(heading.textContent, MESSAGES.en.choiceTitle);
  buttons[1].click();
  assert.equal(i18n.language, 'hi');
  assert.equal(root.documentElement.lang, 'hi');
  assert.equal(root.title, MESSAGES.hi.pageTitle);
  assert.equal(heading.textContent, MESSAGES.hi.choiceTitle);
  assert.equal(heading.lang, 'hi');
  assert.equal(label.attributes['aria-label'], MESSAGES.hi.beginGreeting);
  assert.equal(buttons[1].attributes['aria-pressed'], 'true');
  assert.equal(buttons[0].attributes['aria-pressed'], 'false');
  assert.ok(buttons[1].classes.has('language__active'));
  assert.equal(changes, 1);
  i18n.setLanguage('hi');
  i18n.setLanguage('fr');
  assert.equal(changes, 1);
  unsubscribe();
  buttons[0].click();
  assert.equal(root.documentElement.lang, 'en');
  assert.equal(heading.textContent, MESSAGES.en.choiceTitle);
  assert.equal(changes, 1);
});

test('language choice persists, but blocked storage never breaks the toggle', () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  const first = fixture(storage);
  createI18n(first.root).setLanguage('hi');
  assert.equal(createI18n(fixture(storage).root).language, 'hi');
  const blocked = fixture();
  Object.defineProperty(blocked.root.defaultView, 'localStorage', { get() { throw new Error('Blocked'); } });
  const i18n = createI18n(blocked.root);
  assert.doesNotThrow(() => i18n.setLanguage('hi'));
  assert.equal(blocked.heading.textContent, MESSAGES.hi.choiceTitle);
  const writeBlocked = fixture({ getItem: () => null, setItem() { throw new Error('Quota'); } });
  const another = createI18n(writeBlocked.root);
  assert.doesNotThrow(() => another.setLanguage('hi'));
  assert.equal(another.language, 'hi');
});

test('progress is interpolated in either language, with safe English fallback', () => {
  assert.equal(translate('hi', 'progress', { count: 1, total: 3 }), 'संजोए उजाले: 3 में से 1');
  assert.equal(translate('en', 'progress', { count: 0, total: 3 }), 'Light gathered: 0 of 3');
  assert.equal(translate('unsupported', 'lightDiya'), MESSAGES.en.lightDiya);
});
