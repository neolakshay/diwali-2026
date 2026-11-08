import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceParticle, createBurst, playFireworks } from '../src/fireworks.js';

test('reference-inspired bursts have distinct palettes and willow physics', () => {
  const bursts = [0, 1, 2].map((style) => createBurst(200, 180, 140, style, () => .5));
  assert.equal(bursts[0].length, 110);
  assert.equal(bursts[2].length, 140);
  assert.equal(new Set(bursts[0].map((p) => p.color)).size, 4);
  assert.notEqual(bursts[0][0].color, bursts[1][0].color);
  assert.ok(bursts[2][0].gravity > bursts[1][0].gravity);
  for (const burst of bursts) {
    assert.ok(burst.some((p) => p.vx > 0));
    assert.ok(burst.some((p) => p.vx < 0));
    assert.ok(burst.some((p) => p.vy > 0));
    assert.ok(burst.some((p) => p.vy < 0));
  }
});

test('sparks leave bounded trails, fall under gravity, and expire', () => {
  const particle = createBurst(0, 0, 140, 2, () => .5)[0];
  const initialSpeed = particle.vx;
  for (let frame = 0; frame < 240; frame += 1) advanceParticle(particle, 1 / 60);
  assert.ok(particle.vx < initialSpeed);
  assert.ok(particle.y > 0);
  assert.equal(particle.trail.length, 28);
  assert.equal(advanceParticle(particle, 1 / 60), false);
});

for (const mode of ['animated', 'reduced-motion', 'canceled']) {
  test(`${mode} fireworks notify completion at the right time and can be cleaned up`, () => {
    const previousWindow = globalThis.window;
    const frames = new Map();
    const listeners = new Map();
    let frameId = 0;
    let completed = 0;
    let clears = 0;
    const launches = [];
    const bursts = [];
    const noop = () => {};
    const context = {
      setTransform: noop, beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop,
      arc: noop, fill: noop, fillRect: noop,
      clearRect: () => { clears += 1; },
      createRadialGradient: () => ({ addColorStop: noop }),
      createLinearGradient: () => ({ addColorStop: noop }),
    };
    const canvas = {
      getContext: () => context,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }),
    };
    const barrels = [0, 1, 2].map((index) => ({
      getBoundingClientRect: () => ({ left: 120 + index * 50, top: 680, width: 45 }),
    }));
    globalThis.window = {
      matchMedia: () => ({ matches: mode === 'reduced-motion' }),
      requestAnimationFrame: (fn) => { frames.set(++frameId, fn); return frameId; },
      cancelAnimationFrame: (id) => frames.delete(id),
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name) => listeners.delete(name),
    };
    try {
      const stop = playFireworks(canvas, barrels, () => { completed += 1; }, {
        onLaunch: (index) => launches.push(index),
        onBurst: (index) => bursts.push(index),
      });
      if (mode === 'canceled') {
        stop();
        assert.equal(completed, 0, 'canceling is not completing');
        assert.deepEqual(launches, []);
        assert.deepEqual(bursts, []);
      } else if (mode === 'reduced-motion') {
        assert.equal(completed, 1, 'static display does not wait for an animation');
        assert.equal(frames.size, 0);
        assert.deepEqual(launches, []);
        assert.deepEqual(bursts, [0], 'static display has only one sound, not three overlapping booms');
        listeners.get('resize')();
        assert.deepEqual(bursts, [0], 'resizing never replays the effect');
      } else {
        assert.equal(completed, 0);
        for (let step = 0; step < 500 && frames.size; step += 1) {
          const [id, fn] = frames.entries().next().value;
          frames.delete(id);
          fn(step * 1000 / 60);
          if (step < 300) assert.equal(completed, 0, 'invitation waits for the last sparks');
        }
        assert.equal(completed, 1);
        assert.equal(listeners.size, 0);
        assert.deepEqual(launches, [0, 1, 2]);
        assert.deepEqual(bursts, [0, 1, 2]);
      }
      stop();
      assert.equal(frames.size, 0);
      assert.equal(listeners.size, 0);
      assert.ok(clears > 0);
      assert.equal(completed, mode === 'canceled' ? 0 : 1);
    } finally {
      globalThis.window = previousWindow;
    }
  });
}
