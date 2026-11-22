import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capasNubes, luzNubes, urlWindyNubes } from '../src/motor/nubes.js';
import { leerPrevision } from '../src/motor/meteo.js';
import { respuestaOpenMeteo } from './fixtures/sinteticos.mjs';

test('luz de las nubes: de encapotado bajo a despejado, por capas', () => {
  const l = (b, m, a) => luzNubes({ nubesBajas: b, nubesMedias: m, nubesAltas: a })?.id;
  assert.equal(l(85, 0, 0), 'cubierto');
  assert.equal(l(40, 0, 0), 'ratos');
  assert.equal(l(10, 70, 0), 'medias');
  assert.equal(l(5, 10, 80), 'altas', 'cirros: el sol pasa');
  assert.equal(l(0, 0, 10), 'despejado');
  assert.equal(l(85, 90, 90), 'cubierto', 'las bajas mandan: tapan todo lo demás');
  assert.equal(luzNubes({}), null, 'sin datos, nada');
  assert.match(luzNubes({ nubesBajas: 85 }).texto, /fotogrametría/);
});

test('capas: se leen de Open-Meteo y se redondean; sin datos no hay franja', () => {
  const r = respuestaOpenMeteo();
  r.hourly.cloud_cover_low = r.hourly.time.map(() => 12.4);
  r.hourly.cloud_cover_mid = r.hourly.time.map(() => 50);
  r.hourly.cloud_cover_high = r.hourly.time.map(() => 88.6);
  const horas = leerPrevision(r).horas.slice(0, 24);
  const c = capasNubes(horas);
  assert.equal(c.hay, true);
  assert.deepEqual(c.horas[0], { ms: horas[0].ms, bajas: 12, medias: 50, altas: 89 });
  assert.equal(capasNubes(leerPrevision(respuestaOpenMeteo()).horas).hay, false);
});

test('Windy: el mapa de nubes en el punto', () => {
  assert.equal(urlWindyNubes(40.41679, -3.70379), 'https://www.windy.com/?clouds,40.417,-3.704,9');
});
