import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventosSol, gmst, posicionSol, tipoLuz } from '../src/motor/astro.js';

test('al mediodía solar de junio en Madrid el sol está alto y al sur', () => {
  const { elevacion, azimut } = posicionSol(Date.parse('2026-06-21T12:15:00Z'), 40.4168, -3.7038);
  assert.ok(Math.abs(elevacion - 73) < 1, `elevación ${elevacion}`);
  assert.ok(Math.abs(azimut - 180) < 8, `azimut ${azimut}`);
});

test('a medianoche es de noche', () => {
  const { elevacion } = posicionSol(Date.parse('2026-06-21T23:00:00Z'), 40.4168, -3.7038);
  assert.equal(tipoLuz(elevacion), 'noche');
});

test('salida y puesta en Madrid el 21 de junio (06:44 y 21:48 locales, ±4 min)', () => {
  const ev = eventosSol(Date.parse('2026-06-20T22:00:00Z'), 40.4168, -3.7038);
  assert.ok(Math.abs(ev.salida - Date.parse('2026-06-21T04:44:00Z')) < 4 * 60000, new Date(ev.salida).toISOString());
  assert.ok(Math.abs(ev.puesta - Date.parse('2026-06-21T19:48:00Z')) < 4 * 60000, new Date(ev.puesta).toISOString());
  assert.ok(ev.doradaManana > ev.salida && ev.doradaTarde < ev.puesta);
});

test('sol de medianoche: sin salida ni puesta, sin romper', () => {
  const ev = eventosSol(Date.parse('2026-06-21T00:00:00Z'), 78, 15);
  assert.equal(ev.salida, null);
  assert.equal(ev.puesta, null);
});

test('GMST en J2000 vale 280,46°', () => {
  const g = (gmst(Date.parse('2000-01-01T12:00:00Z')) * 180) / Math.PI;
  assert.ok(Math.abs(g - 280.46) < 0.01, `${g}`);
});
