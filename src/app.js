import { applyDrop, createRitual } from './ritual-state.js';

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

const ORB_COUNT = 10;
const SUCCESSFUL_DROPS = 3;

let transitioning = false;
let ritual = null;
let activeDrag = null;

window.setTimeout(() => entryHint.classList.add('is-visible'), 7000);

entryOrb.addEventListener('click', () => switchScreen('choice'));
choiceButtons.forEach((button) => {
  button.addEventListener('click', () => beginRitual(button.dataset.choice));
});

function switchScreen(nextName, onShown = () => {}) {
  if (transitioning) return;

  const current = document.querySelector('[data-screen].is-visible');
  const next = screens.get(nextName);
  if (!next || current === next) return;

  transitioning = true;
  current.classList.add('is-leaving');

  window.setTimeout(() => {
    current.classList.remove('is-visible', 'is-leaving');
    current.setAttribute('aria-hidden', 'true');
    next.classList.add('is-visible');
    next.setAttribute('aria-hidden', 'false');
    onShown();
    window.setTimeout(() => {
      transitioning = false;
    }, 280);
  }, 560);
}

function beginRitual(kind) {
  if (transitioning || ritual) return;

  ritual = createRitual(kind);
  ritualScene.dataset.kind = kind;
  ritualScene.dataset.progress = '0';
  ritualScene.classList.remove('is-complete', 'is-near-target');
  ritualLabel.textContent = kind === 'diya' ? 'Bring light to the wick' : 'Wake the skyshot';
  ritualInstruction.textContent = 'Drag three wandering lights to begin.';
  updateProgress();
  orbField.replaceChildren();

  switchScreen('ritual', createOrbs);
}

function createOrbs() {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < ORB_COUNT; index += 1) {
    const orb = document.createElement('button');
    const left = 10 + Math.random() * 80;
    const top = 14 + Math.random() * 72;

    orb.type = 'button';
    orb.className = 'orb';
    orb.ariaLabel = 'Drag this wandering light to the ignition point';
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
    fragment.append(orb);
  }

  orbField.append(fragment);
}

function onPointerDown(event) {
  if (!ritual || ritual.status === 'complete' || activeDrag || event.currentTarget.classList.contains('is-used')) return;

  event.preventDefault();
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
  orb.releasePointerCapture(event.pointerId);
  activeDrag = null;

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
  activeDrag.orb.releasePointerCapture(event.pointerId);
  returnOrbToDrift(activeDrag.orb);
  activeDrag = null;
}

function placeOrb(orb, event) {
  const fieldBounds = orbField.getBoundingClientRect();
  const x = clamp(event.clientX - fieldBounds.left, 0, fieldBounds.width);
  const y = clamp(event.clientY - fieldBounds.top, 0, fieldBounds.height);

  orb.style.left = `${x}px`;
  orb.style.top = `${y}px`;
}

function isNearTarget(event) {
  const target = document.querySelector(ritual.kind === 'diya' ? '#diya-wick' : '#skyshot-fuse');
  const targetBounds = target.getBoundingClientRect();
  const targetX = targetBounds.left + targetBounds.width / 2;
  const targetY = targetBounds.top + targetBounds.height / 2;
  const radius = Math.max(46, Math.max(targetBounds.width, targetBounds.height) * .55);

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

  orb.style.left = `${targetBounds.left + targetBounds.width / 2 - fieldBounds.left}px`;
  orb.style.top = `${targetBounds.top + targetBounds.height / 2 - fieldBounds.top}px`;
  orb.classList.remove('is-dragging');
  orb.classList.add('is-used');
}

function updateProgress() {
  ritualScene.dataset.progress = String(ritual.successfulDrops);
  ritualProgress.setAttribute('aria-label', `Light gathered: ${ritual.successfulDrops} of ${SUCCESSFUL_DROPS}`);
  [...ritualProgress.children].forEach((dot, index) => {
    dot.classList.toggle('is-filled', index < ritual.successfulDrops);
  });
}

function completeRitual() {
  ritualScene.classList.add('is-complete');
  ritualInstruction.textContent = ritual.kind === 'diya'
    ? 'Your diya is glowing.'
    : 'The sky answers in light.';
  ritualStage.setAttribute('aria-label', ritual.kind === 'diya' ? 'A diya is lit' : 'A skyshot has burst');
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}
