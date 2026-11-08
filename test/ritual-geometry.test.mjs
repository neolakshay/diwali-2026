import assert from 'node:assert/strict';
import test from 'node:test';
import { pointInField } from '../src/ritual-geometry.js';

test('drag coordinates follow the pointer even while the screen is scaled', () => {
  assert.deepEqual(pointInField(
    { clientX: 260, clientY: 340 },
    { left: 40, top: 10, width: 440, height: 660 }, 400, 600,
  ), { x: 200, y: 300 });
});

test('drag coordinates stay within the field', () => {
  const bounds = { left: 20, top: 30, width: 400, height: 600 };
  assert.deepEqual(pointInField({ clientX: -100, clientY: 900 }, bounds, 400, 600), { x: 0, y: 600 });
});
