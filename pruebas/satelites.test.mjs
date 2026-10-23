import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gmst } from '../src/motor/astro.js';
import { antiguedadDias, contarVisibles, desdeOMM, elevacion, satValido } from '../src/motor/satelites.js';
import { AHORA, constelacionSintetica } from './fixtures/sinteticos.mjs';

const ecuatorial = { epoca: AHORA, n: 2.00563, e: 0, i: 0, raan: 0, argp: 0, M: 0 };

test('un satélite en la vertical se ve a 90° y en las antípodas no se ve', () => {
  // En la época está sobre el eje x inercial: su longitud terrestre es -GMST.
  const lon = ((-gmst(AHORA) * 180) / Math.PI + 540) % 360 - 180;
  assert.ok(elevacion(ecuatorial, AHORA, 0, lon) > 89.5);
  assert.ok(elevacion(ecuatorial, AHORA, 0, lon + 180 > 180 ? lon - 180 : lon + 180) < -60);
});

test('media vuelta después (6 h) está al otro lado', () => {
  const lon = ((-gmst(AHORA) * 180) / Math.PI + 540) % 360 - 180;
  assert.ok(elevacion(ecuatorial, AHORA + 6 * 3600000 - 2 * 60000, 0, lon) < 0);
});

test('una constelación tipo GPS deja entre 5 y 14 visibles en Madrid a cualquier hora', () => {
  const sats = constelacionSintetica();
  for (let h = 0; h < 24; h++) {
    const { total, porConstelacion } = contarVisibles(sats, AHORA + h * 3600000, 40.4, -3.7, 0.7);
    assert.ok(total >= 5 && total <= 14, `hora ${h}: ${total}`);
    assert.equal(porConstelacion.GPS, total);
  }
});

test('la máscara importa: a 0° se ven más que a 10°', () => {
  const sats = constelacionSintetica();
  assert.ok(contarVisibles(sats, AHORA, 40.4, -3.7, 0, 0).total >= contarVisibles(sats, AHORA, 40.4, -3.7, 0, 10).total);
});

test('CelesTrak OMM se convierte y la época sin zona se toma en UTC', () => {
  const s = desdeOMM({ OBJECT_NAME: 'GPS BIIF-1 (PRN 25)', EPOCH: '2026-10-22T12:00:00.000000', MEAN_MOTION: 2.0056, ECCENTRICITY: 0.0102, INCLINATION: 54.9, RA_OF_ASC_NODE: 100.1, ARG_OF_PERICENTER: 50.2, MEAN_ANOMALY: 310.5 }, 'GPS');
  assert.equal(s.epoca, Date.parse('2026-10-22T12:00:00Z'));
  assert.ok(satValido(s));
  assert.equal(satValido({ ...s, n: NaN }), false);
});

test('antigüedad de las órbitas', () => {
  assert.equal(antiguedadDias([], AHORA), Infinity);
  assert.ok(Math.abs(antiguedadDias(constelacionSintetica(AHORA - 2 * 86400000), AHORA) - 2) < 1e-9);
});
