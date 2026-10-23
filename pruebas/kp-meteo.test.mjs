import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kpEn, leerKp } from '../src/motor/kp.js';
import { leerBusqueda, leerConsenso, leerPrevision, techoNubes, urlConsenso, urlPrevision } from '../src/motor/meteo.js';
import { respuestaOpenMeteo } from './fixtures/sinteticos.mjs';

test('Kp: formato de lista con cabecera', () => {
  const t = leerKp([
    ['time_tag', 'kp', 'observed', 'noaa_scale'],
    ['2026-10-23 00:00:00', '2.33', 'observed', null],
    ['2026-10-23 03:00:00', '5.67', 'predicted', 'G1'],
  ]);
  assert.equal(t.length, 2);
  assert.equal(kpEn(t, Date.parse('2026-10-23T04:59:00Z')), 5.67);
  assert.equal(kpEn(t, Date.parse('2026-10-23T06:00:00Z')), null);
  assert.equal(t[0].observado, true);
});

test('Kp: formato de lista de objetos', () => {
  const t = leerKp([{ time_tag: '2026-10-23T00:00:00', kp: 3, observed: 'estimated' }]);
  assert.equal(kpEn(t, Date.parse('2026-10-23T01:00:00Z')), 3);
});

test('Kp: basura no rompe', () => {
  assert.deepEqual(leerKp(null), []);
  assert.deepEqual(leerKp([['x'], ['y']]), []);
});

test('Open-Meteo: se leen horas Unix, zona y elevación', () => {
  const m = leerPrevision(respuestaOpenMeteo());
  assert.equal(m.horas.length, 168);
  assert.equal(m.zona, 'Europe/Madrid');
  assert.equal(m.elevacion, 657);
  assert.equal(m.horas[0].ms, Date.parse('2026-06-20T22:00:00Z'));
  assert.ok(Math.abs(m.horas[0].niveles[120] - 4.2) < 1e-9);
});

test('Open-Meteo sin horas es un error, no una previsión vacía', () => {
  assert.throws(() => leerPrevision({ error: true }));
});

test('consenso: dispersión entre modelos y modelos que faltan', () => {
  const c = leerConsenso({ hourly: { time: [100, 200], wind_speed_10m_ecmwf_ifs025: [3, null], wind_speed_10m_gfs_seamless: [7, 5], wind_speed_10m_icon_seamless: [4, null] } });
  assert.deepEqual(c.get(100000), { dispersion: 4, modelos: 3 });
  assert.equal(c.has(200000), false);
});

test('URLs piden m/s, hora Unix y zona automática', () => {
  for (const u of [urlPrevision(40.4, -3.7), urlConsenso(40.4, -3.7)]) {
    assert.match(u, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
    assert.match(u, /wind_speed_unit=ms/);
    assert.match(u, /timeformat=unixtime/);
    assert.match(u, /timezone=auto/);
  }
});

test('búsqueda de lugares', () => {
  const r = leerBusqueda({ results: [{ name: 'Getafe', admin1: 'Madrid', country: 'España', latitude: 40.3, longitude: -3.73 }, { name: 'roto' }] });
  assert.deepEqual(r, [{ nombre: 'Getafe', zona: 'Madrid, España', lat: 40.3, lon: -3.73 }]);
  assert.deepEqual(leerBusqueda({}), []);
});

test('base de nubes por Espy', () => {
  assert.equal(techoNubes(20, 12), 1000);
  assert.equal(techoNubes(null, 12), null);
});
