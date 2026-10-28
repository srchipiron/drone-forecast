import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perfilViento, rachaEnAltura, vientoEnAltura } from '../src/motor/viento.js';

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

test('perfil: a 120 m marca ese nivel y va de arriba abajo', () => {
  const f = perfilViento(niv, 120);
  assert.deepEqual(f.map((x) => x.altura), [180, 120, 80, 10]);
  assert.deepEqual(f.filter((x) => x.vuelo).map((x) => x.altura), [120]);
});

test('perfil: una altura entre niveles se añade en su sitio con su valor interpolado', () => {
  const f = perfilViento(niv, 100);
  assert.deepEqual(f.map((x) => x.altura), [180, 120, 100, 80, 10]);
  const vuelo = f.find((x) => x.vuelo);
  assert.equal(vuelo.altura, 100);
  assert.ok(vuelo.valor > 6 && vuelo.valor < 7);
  assert.equal(vuelo.estimado, false);
});

test('perfil: por debajo de 10 m va al final y estimado; sin niveles no inventa', () => {
  const f = perfilViento(niv, 5);
  assert.equal(f.at(-1).altura, 5);
  assert.equal(f.at(-1).estimado, true);
  assert.deepEqual(perfilViento({}, 120), []);
  assert.deepEqual(perfilViento({ 10: 4 }, 10).map((x) => [x.altura, x.vuelo]), [[10, true]]);
});
