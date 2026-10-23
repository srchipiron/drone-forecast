import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rachaEnAltura, vientoEnAltura } from '../src/motor/viento.js';

const niv = { 10: 4, 80: 6, 120: 7, 180: 8 };

test('en un nivel del modelo devuelve su valor', () => {
  assert.equal(vientoEnAltura(niv, 120).valor, 7);
  assert.equal(vientoEnAltura(niv, 120).estimado, false);
});

test('entre niveles interpola y queda entre los dos', () => {
  const v = vientoEnAltura(niv, 100).valor;
  assert.ok(v > 6 && v < 7, `${v}`);
});

test('por debajo de 10 m baja y se marca como estimado', () => {
  const r = vientoEnAltura(niv, 5);
  assert.ok(r.valor < 4 && r.estimado);
});

test('sin niveles altos extrapola desde 10 m', () => {
  const r = vientoEnAltura({ 10: 4, 80: null, 120: null, 180: null }, 120);
  assert.ok(r.valor > 5 && r.valor < 6 && r.estimado, `${r.valor}`);
});

test('sin ningún dato no inventa', () => {
  assert.equal(vientoEnAltura({}, 120).valor, null);
});

test('la racha en altura suma el exceso de la de 10 m', () => {
  assert.equal(rachaEnAltura(9, 4, 7), 12);
  assert.equal(rachaEnAltura(null, 4, 7), null);
  assert.equal(rachaEnAltura(3, 4, 7), 7);
});
