import { applyDrop, createRitual } from './ritual-state.js';
import { pointInField } from './ritual-geometry.js';
import { playFireworks } from './fireworks.js';
import { createAartiPlayer } from './aarti-player.js';
import { createI18n } from './i18n.js';
import { createSoundscape } from './soundscape.js';

const i18n = createI18n();
const sounds = createSoundscape(document, i18n);

const screens = new Map(
  [...document.querySelectorAll('[data-screen]')].map((screen) => [screen.dataset.screen, screen]),
);
const entryOrb = document.querySelector('#entry-orb');
const entryHint = document.querySelector('#entry-hint');
const choiceButtons = document.querySelectorAll('[data-choice]');
const ritualStage = document.querySelector('#ritual-stage');
const ritualScene = document.querySelector('#ritual-scene');
const ritualLabel = document.querySelector('#ritual-label');
const ritualInstruction = document.querySelector('#ritual-instruction');
const ritualProgress = document.querySelector('#ritual-progress');
const orbField = document.querySelector('#orb-field');
const ritualInvitation = document.querySelector('#ritual-invitation');
const ritualQuote = document.querySelector('#ritual-quote');
const otherRitualButton = document.querySelector('#other-ritual');
const aartiInvitation = document.querySelector('#aarti-invitation');
const beginAartiButton = document.querySelector('#begin-aarti');
const skipAartiButton = document.querySelector('#skip-aarti');
const closeAartiButton = document.querySelector('#close-aarti');
const aartiAudio = document.querySelector('#aarti-audio');
const endingTitle = document.querySelector('#ending-title');
const restartGreetingButton = document.querySelector('#restart-greeting');

const ORB_COUNT = 10;
const SUCCESSFUL_DROPS = 3;

let transitioning = false;
let ritual = null;
let activeDrag = null;
const completedKinds = new Set();
let invitationTimer;
let stopFireworks;
let aartiPlayer;
let entryHintTimer;

i18n.subscribe(renderRitualText);
renderRitualText();

scheduleEntryHint();

function scheduleEntryHint() {
  window.clearTimeout(entryHintTimer);
  entryHint.classList.remove('is-visible');
  entryHintTimer = window.setTimeout(() => entryHint.classList.add('is-visible'), 3500);
}

entryOrb.addEventListener('click', () => {
  if (transitioning) return;
  window.clearTimeout(entryHintTimer);
  sounds.unlock();
  sounds.setScene('choice');
  switchScreen('choice');
});
choiceButtons.forEach((button) => {
  button.addEventListener('click', () => beginRitual(button.dataset.choice));
});
otherRitualButton.addEventListener('click', () => {
  if (!ritualInvitation.hidden && !otherRitualButton.hidden) beginRitual(otherRitualButton.dataset.kind);
});
beginAartiButton.addEventListener('click', () => {
  if (transitioning || completedKinds.size !== 2 || aartiInvitation.hidden) return;
  sounds.setScene('aarti');
  aartiPlayer ??= createAartiPlayer(document, i18n);
  // Keep play() in the click handler: mobile browsers require this user gesture.
  aartiPlayer.play();
  switchScreen('aarti', () => document.querySelector('#aarti-title').focus({ preventScroll: true }));
});
skipAartiButton.addEventListener('click', () => {
  if (completedKinds.size !== 2 || aartiInvitation.hidden) return;
  endGreeting();
});
closeAartiButton.addEventListener('click', endGreeting);
aartiAudio.addEventListener('ended', () => {
  if (screens.get('aarti').classList.contains('is-visible')) endGreeting();
});
restartGreetingButton.addEventListener('click', restartGreeting);

function endGreeting() {
  if (transitioning || completedKinds.size !== 2) return;
  aartiPlayer?.pause();
  sounds.setScene('quiet');
  aartiInvitation.hidden = true;
  switchScreen('ending', () => endingTitle.focus({ preventScroll: true }));
}

function restartGreeting() {
  if (transitioning || !screens.get('ending').classList.contains('is-visible')) return;
  window.clearTimeout(invitationTimer);
  window.clearTimeout(entryHintTimer);
  invitationTimer = undefined;
  entryHint.classList.remove('is-visible');
  stopFireworks?.();
  stopFireworks = null;
  if (aartiPlayer) aartiPlayer.reset();
  else {
    aartiAudio.pause();
    aartiAudio.currentTime = 0;
  }
  sounds.setScene('entry');
  completedKinds.clear();
  ritual = null;
  activeDrag = null;
  ritualScene.dataset.kind = '';
  ritualScene.classList.remove('is-complete', 'is-near-target');
  orbField.replaceChildren();
  ritualInvitation.hidden = true;
  otherRitualButton.hidden = true;
  aartiInvitation.hidden = true;
  ritualQuote.textContent = '';
  screens.forEach((screen) => { screen.scrollTop = 0; });
  renderRitualText();
  switchScreen('entry', () => {
    scheduleEntryHint();
    entryOrb.focus({ preventScroll: true });
  });
}

function switchScreen(nextName, onShown = () => {}) {
  if (transitioning) return;

  const current = document.querySelector('[data-screen].is-visible');
  const next = screens.get(nextName);
  if (!next || current === next) return;

  transitioning = true;
  current.inert = true;
  current.classList.add('is-leaving');

  window.setTimeout(() => {
    current.classList.remove('is-visible', 'is-leaving');
    current.setAttribute('aria-hidden', 'true');
    next.classList.add('is-visible');
    next.setAttribute('aria-hidden', 'false');
    next.inert = false;
    onShown();
    window.setTimeout(() => {
      transitioning = false;
    }, 280);
  }, 560);
}

function beginRitual(kind) {
  if (transitioning || (ritual && (ritual.status !== 'complete' || completedKinds.has(kind)))) return;

  sounds.unlock();
  sounds.setScene(kind);
  window.clearTimeout(invitationTimer);
  stopFireworks?.();
  stopFireworks = null;
  ritualInvitation.hidden = true;
  otherRitualButton.hidden = true;
  aartiInvitation.hidden = true;

  ritual = createRitual(kind);
  ritualScene.dataset.kind = kind;
  ritualScene.dataset.progress = '0';
  ritualScene.classList.remove('is-complete', 'is-near-target');
  renderRitualText();
  orbField.replaceChildren();

  const prepareScene = () => {
    createOrbs();
    ritualLabel.setAttribute('tabindex', '-1');
    ritualLabel.focus({ preventScroll: true });
  };
  if (screens.get('ritual').classList.contains('is-visible')) prepareScene();
  else switchScreen('ritual', prepareScene);
}

function createOrbs() {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < ORB_COUNT; index += 1) {
    const orb = document.createElement('button');
    const left = 10 + Math.random() * 80;
    const top = 30 + Math.random() * 38;

    orb.type = 'button';
    orb.className = 'orb';
    orb.ariaLabel = i18n.t('orbLabel');
    orb.dataset.homeX = left.toFixed(2);
    orb.dataset.homeY = top.toFixed(2);
    orb.style.left = `${orb.dataset.homeX}%`;
    orb.style.top = `${orb.dataset.homeY}%`;
    orb.style.setProperty('--size', `${12 + Math.round(Math.random() * 9)}px`);
    orb.style.setProperty('--duration', `${2.8 + Math.random() * 2.9}s`);
    orb.style.setProperty('--delay', `${-Math.random() * 3}s`);

    orb.addEventListener('pointerdown', onPointerDown);
    orb.addEventListener('pointermove', onPointerMove);
    orb.addEventListener('pointerup', onPointerUp);
    orb.addEventListener('pointercancel', cancelDrag);
    orb.addEventListener('lostpointercapture', cancelDrag);
    fragment.append(orb);
  }

  orbField.append(fragment);
}

function onPointerDown(event) {
  if (!ritual || ritual.status === 'complete' || activeDrag || event.button !== 0 || event.currentTarget.classList.contains('is-used')) return;

  event.preventDefault();
  sounds.unlock();
  const orb = event.currentTarget;
  activeDrag = { orb, pointerId: event.pointerId };
  orb.setPointerCapture(event.pointerId);
  orb.classList.add('is-dragging');
  placeOrb(orb, event);
}

function onPointerMove(event) {
  if (!activeDrag || activeDrag.pointerId !== event.pointerId || activeDrag.orb !== event.currentTarget) return;

  placeOrb(activeDrag.orb, event);
  ritualScene.classList.toggle('is-near-target', isNearTarget(event));
}

function onPointerUp(event) {
  if (!activeDrag || activeDrag.pointerId !== event.pointerId || activeDrag.orb !== event.currentTarget) return;

  const orb = activeDrag.orb;
  const hitTarget = isNearTarget(event);
  const result = applyDrop(ritual, hitTarget);

  ritualScene.classList.remove('is-near-target');
  activeDrag = null;
  if (orb.hasPointerCapture(event.pointerId)) orb.releasePointerCapture(event.pointerId);

  if (!result.accepted) {
    returnOrbToDrift(orb);
    return;
  }

  ritual = result.state;
  absorbOrb(orb);
  updateProgress();

  if (result.completed) completeRitual();
}

function cancelDrag(event) {
  if (!activeDrag || activeDrag.pointerId !== event.pointerId || activeDrag.orb !== event.currentTarget) return;

  ritualScene.classList.remove('is-near-target');
  const orb = activeDrag.orb;
  activeDrag = null;
  if (orb.hasPointerCapture(event.pointerId)) orb.releasePointerCapture(event.pointerId);
  returnOrbToDrift(orb);
}

function placeOrb(orb, event) {
  const fieldBounds = orbField.getBoundingClientRect();
  const { x, y } = pointInField(event, fieldBounds, orbField.clientWidth, orbField.clientHeight);

  orb.style.left = `${x}px`;
  orb.style.top = `${y}px`;
}

function isNearTarget(event) {
  const target = document.querySelector(ritual.kind === 'diya' ? '#diya-wick' : '#skyshot-fuse');
  const targetBounds = target.getBoundingClientRect();
  const targetX = targetBounds.left + targetBounds.width / 2;
  const targetY = targetBounds.top + targetBounds.height / 2;
  const radius = Math.max(76, Math.max(targetBounds.width, targetBounds.height) * .9);

  return Math.hypot(event.clientX - targetX, event.clientY - targetY) <= radius;
}

function returnOrbToDrift(orb) {
  orb.style.left = `${orb.dataset.homeX}%`;
  orb.style.top = `${orb.dataset.homeY}%`;
  orb.classList.remove('is-dragging');
}

function absorbOrb(orb) {
  const target = document.querySelector(ritual.kind === 'diya' ? '#diya-wick' : '#skyshot-fuse');
  const targetBounds = target.getBoundingClientRect();
  const fieldBounds = orbField.getBoundingClientRect();

  const { x, y } = pointInField({
    clientX: targetBounds.left + targetBounds.width / 2,
    clientY: targetBounds.top + targetBounds.height / 2,
  }, fieldBounds, orbField.clientWidth, orbField.clientHeight);
  orb.style.left = `${x}px`;
  orb.style.top = `${y}px`;
  orb.classList.remove('is-dragging');
  orb.classList.add('is-used');
}

function updateProgress() {
  const count = ritual?.successfulDrops ?? 0;
  ritualScene.dataset.progress = String(count);
  ritualProgress.setAttribute('aria-label', i18n.t('progress', { count, total: SUCCESSFUL_DROPS }));
  [...ritualProgress.children].forEach((dot, index) => {
    dot.classList.toggle('is-filled', index < count);
  });
}

function completeRitual() {
  completedKinds.add(ritual.kind);
  ritualScene.classList.add('is-complete');
  renderRitualText();
  if (ritual.kind === 'skyshot') {
    stopFireworks = playFireworks(
      document.querySelector('#skyshot-fireworks'),
      document.querySelectorAll('.skyshot__cylinder'),
      revealInvitation,
      { onLaunch: sounds.launch, onBurst: sounds.burst },
    );
  } else {
    sounds.lightDiya();
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1200;
    invitationTimer = window.setTimeout(revealInvitation, delay);
  }
}

function revealInvitation() {
  if (completedKinds.size === 2) {
    otherRitualButton.hidden = true;
    aartiInvitation.hidden = false;
  } else {
    const nextKind = ritual.kind === 'diya' ? 'skyshot' : 'diya';
    otherRitualButton.dataset.kind = nextKind;
    otherRitualButton.hidden = false;
  }
  ritualInvitation.hidden = false;
  renderRitualText();
}

function renderRitualText() {
  if (!ritual) {
    ritualStage.setAttribute('aria-label', i18n.t('chooseRitual'));
    ritualLabel.textContent = i18n.t('diyaLabel');
    ritualInstruction.textContent = i18n.t('initialInstruction');
    updateProgress();
    return;
  }
  const { kind, status } = ritual;
  const complete = status === 'complete';
  ritualStage.setAttribute('aria-label', i18n.t(`${kind}${complete ? 'CompleteStage' : 'Stage'}`));
  ritualLabel.textContent = i18n.t(`${kind}Label`);
  ritualInstruction.textContent = i18n.t(`${kind}${complete ? 'Complete' : 'Instruction'}`);
  updateProgress();
  [...orbField.children].forEach((orb) => { orb.ariaLabel = i18n.t('orbLabel'); });
  if (complete) {
    ritualQuote.textContent = i18n.t(completedKinds.size === 2 ? 'closingWish' : `${kind}Invitation`);
    otherRitualButton.textContent = i18n.t(kind === 'diya' ? 'experienceFireworks' : 'lightDiya');
  }
}
