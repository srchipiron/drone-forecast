import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoCompartir } from '../src/motor/compartir.js';
import { leerPrevision } from '../src/motor/meteo.js';
import { construirPrevision } from '../src/motor/prevision.js';
import { AHORA, LUGAR, respuestaOpenMeteo } from './fixtures/sinteticos.mjs';

const prev = (op) => construirPrevision({ meteo: leerPrevision(respuestaOpenMeteo(op)), lugar: LUGAR, ajustes: {}, ahora: AHORA });

test('compartir: lugar, dron, veredicto de ahora, viento y las ventanas de hoy y mañana', () => {
  const t = textoCompartir(prev({ viento: 3, racha: 4 }), { nombre: 'Getafe' }, 'https://srchipiron.github.io/drone-forecast/');
  const l = t.split('\n');
  assert.equal(l[0], '🚁 Getafe · DJI Mini 5 Pro a 120 m');
  assert.equal(l[1], 'Ahora (10:00): Se puede volar');
  assert.equal(l[2], 'Viento 15 km/h, rachas 19 km/h');
  assert.match(l[3], /^Mejor ventana hoy: 10:00–\d\d:00$/);
  assert.match(l[4], /^Mañana: \d\d:00–\d\d:00$/);
  assert.equal(l[5], 'https://srchipiron.github.io/drone-forecast/');
});

test('compartir: si no se puede volar dice por qué; sin ventana lo dice', () => {
  const t = textoCompartir(prev({ viento: 20, racha: 25 }), { nombre: 'Tarifa' });
  assert.match(t, /Ahora \(10:00\): No volar — viento a 120 m \d+ km\/h/);
  assert.match(t, /Mejor ventana hoy: sin ventana/);
  assert.doesNotMatch(t, /https/, 'sin dirección si no se pasa');
});
