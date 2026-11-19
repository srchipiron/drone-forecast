import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAXIMO_PLANES, anadirPlan, crearPlan, cuandoPlan, empeora, planesValidos, textoEmpeora, valorarPlan } from '../src/motor/planificado.js';
import { leerPrevision } from '../src/motor/meteo.js';
import { construirPrevision } from '../src/motor/prevision.js';
import { AHORA, LUGAR, respuestaOpenMeteo } from './fixtures/sinteticos.mjs';

const H = 3600000;
const MANANA_10 = Date.parse('2026-06-22T08:00:00Z'); // 10:00 en Madrid (hora 34 de la respuesta)
const lugar = { nombre: 'Getafe', ...LUGAR };
const prev = (op) => construirPrevision({ meteo: leerPrevision(respuestaOpenMeteo(op)), lugar, ajustes: { dron: 'flip' }, ahora: AHORA });
const plan = (op = {}) => crearPlan({ ms: MANANA_10, horas: 2, lugar, zona: 'Europe/Madrid', estado: 'ok', ...op });

test('plan: empieza en punto, duración válida, nombre y nota recortados', () => {
  const p = plan({ ms: MANANA_10 + 25 * 60000, horas: 9, nota: 'x'.repeat(300), lugar: { ...lugar, nombre: 'n'.repeat(200) } });
  assert.equal(p.ms, MANANA_10);
  assert.equal(p.horas, 1, 'una duración rara pasa a 1 h');
  assert.equal(p.nota.length, 200);
  assert.equal(p.lugar.nombre.length, 120);
  assert.equal(plan({ estado: 'sin-prevision' }).estado, null);
  assert.equal(cuandoPlan(plan()), 'lun 22 jun, 10:00–12:00');
});

test('plan: el estado es el de la PEOR de sus horas, con los motivos de esa', () => {
  // Viento fuerte solo a las 11:00 (hora 35): el plan de 10 a 12 sale rojo.
  const v = valorarPlan(plan(), prev({ viento: (k) => (k === 35 ? 20 : 3) }));
  assert.equal(v.estado, 'no');
  assert.equal(v.cubiertas, 2);
  assert.ok(v.motivos.some((m) => /viento/i.test(m)), v.motivos.join());
  assert.deepEqual(valorarPlan(plan(), prev({ viento: 3 })), { estado: 'ok', cubiertas: 2, motivos: [] });
  // De 10 a 11 no toca la hora mala.
  assert.equal(valorarPlan(plan({ horas: 1 }), prev({ viento: (k) => (k === 35 ? 20 : 3) })).estado, 'ok');
});

test('plan: si la previsión no llega a todas sus horas no se juzga', () => {
  const tarde = plan({ ms: Date.parse('2026-06-27T21:00:00Z'), horas: 2 }); // la última hora de la respuesta es 21:00 UTC del 27
  assert.deepEqual(valorarPlan(tarde, prev()), { estado: 'sin-prevision', cubiertas: 1, motivos: [] });
  assert.equal(valorarPlan(plan({ ms: Date.parse('2026-07-10T08:00:00Z') }), prev()).cubiertas, 0);
});

test('plan: empeora solo de verde a ámbar/rojo o de ámbar a rojo', () => {
  assert.ok(empeora('ok', 'precaucion'));
  assert.ok(empeora('ok', 'no'));
  assert.ok(empeora('precaucion', 'no'));
  assert.ok(!empeora('no', 'ok'));
  assert.ok(!empeora('ok', 'ok'));
  assert.ok(!empeora(null, 'no'), 'sin referencia no hay «empeora»');
  assert.ok(!empeora('ok', 'sin-prevision'));
  const t = textoEmpeora(plan(), 'ok', { estado: 'precaucion', motivos: ['Rachas'] });
  assert.equal(t.titulo, 'Empeora tu vuelo en Getafe');
  assert.equal(t.cuerpo, 'lun 22 jun, 10:00–12:00: de verde a ámbar (rachas).');
});

test('planes: lo guardado roto o pasado se descarta; ordenados, sin repetir y con tope', () => {
  const a = plan();
  const b = plan({ ms: MANANA_10 + 24 * H });
  assert.deepEqual(planesValidos([b, null, { id: 'x' }, a, { ...a, id: 'roto', horas: 7 }], AHORA).map((p) => p.id), [a.id, b.id]);
  assert.deepEqual(planesValidos([a], MANANA_10 + H), [a], 'en marcha todavía cuenta');
  assert.deepEqual(planesValidos([a], MANANA_10 + 2 * H), [], 'acabado, fuera');
  assert.deepEqual(planesValidos('basura'), []);
  assert.equal(anadirPlan([a], { ...a, nota: 'otra' }, AHORA).length, 1, 'mismo id: se sustituye');
  const muchos = Array.from({ length: MAXIMO_PLANES + 5 }, (_, k) => plan({ ms: MANANA_10 + k * H }));
  assert.equal(planesValidos(muchos, AHORA).length, MAXIMO_PLANES);
});
