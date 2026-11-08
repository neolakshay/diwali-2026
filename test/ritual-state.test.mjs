import assert from 'node:assert/strict';
import test from 'node:test';

import { applyDrop, createRitual } from '../src/ritual-state.js';

test('completes a diya ritual on its third accepted drop', () => {
  let state = createRitual('diya');

  const first = applyDrop(state, true);
  state = first.state;
  const second = applyDrop(state, true);
  state = second.state;
  const third = applyDrop(state, true);

  assert.equal(first.accepted, true);
  assert.equal(first.completed, false);
  assert.equal(second.state.successfulDrops, 2);
  assert.equal(third.accepted, true);
  assert.equal(third.completed, true);
  assert.deepEqual(third.state, {
    kind: 'diya',
    successfulDrops: 3,
    status: 'complete',
  });
});

test('keeps a skyshot ritual unchanged when an orb misses the fuse', () => {
  const initial = createRitual('skyshot');
  const result = applyDrop(initial, false);

  assert.equal(result.accepted, false);
  assert.equal(result.completed, false);
  assert.deepEqual(result.state, initial);
});

test('does not re-complete a ritual after it has already ignited', () => {
  let state = createRitual('skyshot');
  state = applyDrop(state, true).state;
  state = applyDrop(state, true).state;
  state = applyDrop(state, true).state;

  const result = applyDrop(state, true);

  assert.equal(result.accepted, false);
  assert.equal(result.completed, false);
  assert.deepEqual(result.state, state);
});
