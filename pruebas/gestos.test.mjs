import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sentidoDeslizar } from '../src/motor/gestos.js';

test('gestos: dedo a la izquierda es el día siguiente; a la derecha, el anterior', () => {
  assert.equal(sentidoDeslizar(-120, 10, 300), 1);
  assert.equal(sentidoDeslizar(120, -10, 300), -1);
});

test('gestos: un toque, un movimiento lento o uno en diagonal no cambian de día', () => {
  assert.equal(sentidoDeslizar(-20, 0, 100), 0, 'corto');
  assert.equal(sentidoDeslizar(-120, 0, 2000), 0, 'lento');
  assert.equal(sentidoDeslizar(-100, 90, 300), 0, 'diagonal: se está bajando');
  assert.equal(sentidoDeslizar(-100, 60, 300), 1, 'algo torcido pero de lado');
  assert.equal(sentidoDeslizar(NaN, 0, 100), 0);
});
