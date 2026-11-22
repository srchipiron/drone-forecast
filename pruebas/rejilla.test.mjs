import { test } from 'node:test';
import assert from 'node:assert/strict';
import { celdasVeredicto, resumenVeredictos, urlRejillaTiempo, veredictosRejilla } from '../src/motor/rejilla.js';
import { rejillaNubes } from '../src/motor/nubes.js';
import { VARIABLES } from '../src/motor/meteo.js';
import { AHORA, respuestaOpenMeteo } from './fixtures/sinteticos.mjs';

const caja = { oeste: -4, este: -3, sur: 40, norte: 41 };
const puntos = rejillaNubes(caja, 2);

test('dónde volar: una petición con todos los puntos y las variables del semáforo', () => {
  const u = new URL(urlRejillaTiempo(puntos));
  assert.equal(u.searchParams.get('latitude').split(',').length, 4);
  assert.equal(u.searchParams.get('hourly'), VARIABLES.join(','));
  assert.equal(u.searchParams.get('wind_speed_unit'), 'ms');
  assert.equal(u.searchParams.get('forecast_days'), '2');
});

test('dónde volar: cada celda con el semáforo de tu dron; el porqué del rojo', () => {
  // Una tranquila, una con chubascos posibles (ámbar), una con 9 m/s a 10 m (≈ 12,6 a 120 m) y una rota.
  const resp = [respuestaOpenMeteo({ viento: 3 }), respuestaOpenMeteo({ viento: 3, prob: 50 }), respuestaOpenMeteo({ viento: 9, racha: 10 }), { error: true }];
  const celdas = veredictosRejilla(resp, puntos, { ajustes: { dron: 'mini5pro' }, ahora: AHORA });
  const enHora = celdasVeredicto(celdas, AHORA);
  // De día a las 10:30: las tranquilas en verde (los satélites sin órbitas no deciden).
  assert.deepEqual(enHora.map((c) => c.estado), ['ok', 'precaucion', 'no', null]);
  assert.ok(enHora[2].motivos.some((m) => /Viento/.test(m)), enHora[2].motivos.join());
  assert.deepEqual(enHora[3].motivos, [], 'la rota, sin datos y sin inventar');
  const r = resumenVeredictos(enHora);
  assert.deepEqual([r.ok, r.precaucion, r.no], [1, 1, 1]);
  assert.match(r.masRojo, /Viento|Rachas/, 'el porqué del rojo no cuenta los ámbar (la lluvia)');
  // Con un dron que aguanta más, la del viento ya no es roja: se juzga con TU dron.
  const anafi = celdasVeredicto(veredictosRejilla(resp, puntos, { ajustes: { dron: 'anafiukr' }, ahora: AHORA }), AHORA);
  assert.notEqual(anafi[2].estado, 'no');
  assert.throws(() => veredictosRejilla(resp.slice(1), puntos, { ajustes: {} }), /no cuadra/);
});
