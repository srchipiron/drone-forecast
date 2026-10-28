import { test } from 'node:test';
import assert from 'node:assert/strict';
import { informeDiagnostico } from '../src/motor/diagnostico.js';
import { leerPrevision } from '../src/motor/meteo.js';
import { construirPrevision, normalizarAjustes } from '../src/motor/prevision.js';
import { AHORA, LUGAR, constelacionSintetica, respuestaOpenMeteo } from './fixtures/sinteticos.mjs';

const meteo = leerPrevision(respuestaOpenMeteo());
const base = (extra = {}) => ({
  version: '9.9.9',
  lugar: { nombre: 'Madrid', ...LUGAR },
  ajustes: normalizarAjustes({ modo: 'profesional', mision: 'termografia_fv' }),
  prevision: construirPrevision({ meteo, satelites: [...constelacionSintetica(), ...constelacionSintetica(AHORA, 'Galileo', 3, 8)], lugar: LUGAR, ajustes: { modo: 'profesional', mision: 'termografia_fv' }, ahora: AHORA }),
  meteo: { descargado: AHORA - 5 * 60000, desdeCache: false, horas: meteo.horas.length, elevacion: meteo.elevacion },
  kp: { tramos: 0 },
  orbitas: { total: 24, origen: 'celestrak', actualizado: new Date(AHORA - 3 * 3600000).toISOString() },
  error: '',
  navegador: 'Mozilla/5.0 (Linux; Android 14)',
  ahora: AHORA,
  ...extra,
});

test('el informe lleva versión, lugar, ajustes, cada fuente con su edad y los factores de ahora', () => {
  const t = informeDiagnostico(base());
  assert.match(t, /^Drone Forecast v9\.9\.9 · .*\(Europe\/Madrid\)/);
  assert.match(t, /Lugar: Madrid \(40\.4168, -3\.7038\) · 657 m/);
  assert.match(t, /Modo profesional · misión termografia_fv · dron mini5pro \(máx 12 m\/s\) · altura 120 m/);
  assert.match(t, /Previsión: de la red hace 5 min · 168 h/);
  assert.match(t, /Kp: 0 tramos · ahora sin dato/);
  assert.match(t, /Órbitas: 24 \(celestrak\) hace 3 h/);
  assert.match(t, /Ahora 10:00 → /);
  assert.match(t, /^ {2}OK {2}viento: /m);
  assert.match(t, /irradiancia: 700 W\/m²/, 'los factores de la misión también salen');
  assert.match(t, /Ventana hoy: \d\d:\d\d–\d\d:\d\d/);
  assert.match(t, /Error: ninguno/);
  assert.match(t, /Navegador: Mozilla/);
});

test('avisa en mayúsculas de lo que más confunde: previsión guardada y órbitas que no se usan', () => {
  const p = construirPrevision({ meteo, satelites: constelacionSintetica(AHORA - 40 * 86400000), lugar: LUGAR, ajustes: {}, ahora: AHORA });
  const t = informeDiagnostico(base({ prevision: p, meteo: { descargado: AHORA - 3 * 86400000, desdeCache: true, horas: 168, elevacion: null } }));
  assert.match(t, /Previsión: GUARDADA hace 3 d/);
  assert.match(t, /NO SE USAN/);
});

test('sin lugar ni previsión no rompe', () => {
  const t = informeDiagnostico(base({ lugar: null, prevision: null, meteo: { descargado: 0, desdeCache: false, horas: 0, elevacion: null }, orbitas: { total: 0, origen: null, actualizado: null }, error: 'HTTP 503' }));
  assert.match(t, /Lugar: sin elegir/);
  assert.match(t, /Previsión: sin descargar/);
  assert.match(t, /Error: HTTP 503/);
  assert.doesNotMatch(t, /Ahora/);
});
