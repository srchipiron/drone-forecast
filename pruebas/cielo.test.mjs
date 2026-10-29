import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cielo } from '../src/motor/cielo.js';

test('cielo: los códigos WMO de Open-Meteo, en palabras, con icono de día y de noche', () => {
  assert.deepEqual(cielo(0), { texto: 'Despejado', icono: '☀️' });
  assert.deepEqual(cielo(0, false), { texto: 'Despejado', icono: '🌙' });
  assert.equal(cielo(3).texto, 'Cubierto');
  assert.equal(cielo(48).texto, 'Niebla');
  assert.equal(cielo(65).texto, 'Lluvia');
  assert.equal(cielo(99).texto, 'Tormenta con granizo');
  assert.equal(cielo(42), null, 'un código desconocido no se inventa');
  assert.equal(cielo(null), null);
});

test('cielo: todos los códigos que da Open-Meteo tienen texto', () => {
  for (const c of [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]) assert.ok(cielo(c), `falta el ${c}`);
});
