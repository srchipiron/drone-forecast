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

test('plan: la hora elegida tal cual, duración válida, nombre y nota recortados, con sus ajustes', () => {
  // Una hora de la previsión en un huso de media hora (India): no se redondea a la hora UTC.
  const media = MANANA_10 + 30 * 60000;
  assert.equal(plan({ ms: media }).ms, media);
  assert.equal(cuandoPlan(plan({ ms: media, zona: 'Asia/Kolkata' })), 'lun 22 jun, 14:00–16:00');
  const p = plan({ horas: 9, nota: 'x'.repeat(300), lugar: { ...lugar, nombre: 'n'.repeat(200) }, ajustes: { dron: 'neo', altitud: 60, misDrones: ['flip'] } });
  assert.equal(p.ms, MANANA_10);
  assert.deepEqual(p.ajustes, { dron: 'neo', altitud: 60 }, 'con su dron y su altura, sin «Mis drones»');
  assert.equal(plan().ajustes, null);
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

test('calendario: un evento .ics válido, en UTC, con el lugar, la nota y la previsión', async () => {
  const { icsPlan } = await import('../src/motor/planificado.js');
  const p = plan({ nota: 'Cliente: Aeroscan; tejado, nave 3' });
  const ics = icsPlan(p, { estado: 'precaucion', motivos: ['Rachas'] }, Date.parse('2026-06-21T08:30:00Z'));
  assert.ok(ics.endsWith('\r\n'));
  assert.doesNotMatch(ics.replace(/\r\n/g, ''), /\n/, 'solo CRLF');
  // Se desdobla como lo haría un calendario y se leen las propiedades.
  const lineas = ics.replace(/\r\n /g, '').split('\r\n');
  const prop = (k) => lineas.find((l) => l.startsWith(`${k}:`))?.slice(k.length + 1);
  assert.equal(lineas[0], 'BEGIN:VCALENDAR');
  assert.equal(prop('DTSTART'), '20260622T080000Z');
  assert.equal(prop('DTEND'), '20260622T100000Z');
  assert.equal(prop('DTSTAMP'), '20260621T083000Z');
  assert.equal(prop('UID'), `${p.id}@drone-forecast`);
  assert.equal(prop('SUMMARY'), 'Vuelo con dron · Getafe');
  assert.equal(prop('GEO'), `${LUGAR.lat.toFixed(6)};${LUGAR.lon.toFixed(6)}`);
  assert.equal(prop('DESCRIPTION').split('\\n')[0], 'Cliente: Aeroscan\\; tejado\\, nave 3', '; y , escapados');
  assert.match(prop('DESCRIPTION'), /Previsión al exportarlo: ámbar \(rachas\)\./);
  assert.match(prop('URL'), /^https:\/\/www\.openstreetmap\.org\/\?mlat=40\.41680&mlon=-3\.70380/);
  assert.equal(lineas.filter((l) => l === 'BEGIN:VEVENT').length, 1);
  assert.ok(lineas.includes('TRIGGER:-PT18H'), 'recordatorio la víspera');
  assert.match(icsPlan(p, null).replace(/\r\n /g, ''), /aún no llega a ese día/);
});

test('calendario: ninguna línea pasa de 75 octetos, ni con acentos, y al desdoblar no se pierde nada', async () => {
  const { icsPlan } = await import('../src/motor/planificado.js');
  const nota = 'Inspección termográfica de la cubierta norte, ñandú ✈ — '.repeat(6).trim();
  const ics = icsPlan(plan({ nota: nota.slice(0, 200), lugar: { ...lugar, nombre: 'Polígono Industrial «Los Ángeles», nave número 14, Getafe (Madrid)' } }));
  for (const l of ics.split('\r\n')) assert.ok(Buffer.byteLength(l, 'utf8') <= 75, `${Buffer.byteLength(l, 'utf8')} octetos: ${l}`);
  const desdoblado = ics.replace(/\r\n /g, '');
  assert.ok(desdoblado.includes(`DESCRIPTION:${nota.slice(0, 200).replace(/,/g, '\\,')}`), 'la nota entera, sin cortes');
  assert.ok(desdoblado.includes('LOCATION:Polígono Industrial «Los Ángeles»\\, nave número 14\\, Getafe (Madrid)'));
});

test('huecos: el primer tramo verde de cada día con las horas pedidas seguidas', async () => {
  const { huecosPlan } = await import('../src/motor/planificado.js');
  // Verde (3 m/s) solo de 10 a 13 h de mañana (horas 34-36) y de 9 a 10 del día 23 (horas 57); el resto, 20 m/s.
  const p = prev({ viento: (k) => ((k >= 34 && k < 37) || k === 57 ? 3 : 20), racha: (k) => ((k >= 34 && k < 37) || k === 57 ? 4 : 25) });
  assert.deepEqual(huecosPlan(p, 2, AHORA), [{ ms: MANANA_10, clave: '2026-06-22', estado: 'ok' }], 'el día 23 solo tiene 1 h verde');
  assert.deepEqual(huecosPlan(p, 1, AHORA).map((x) => x.clave), ['2026-06-22', '2026-06-23']);
  assert.equal(huecosPlan(p, 3, AHORA)[0].ms, MANANA_10);
  assert.deepEqual(huecosPlan(p, 4, AHORA), [], 'cuatro seguidas no caben y no hay ámbar');
  // La última hora de la previsión no da para dos: no se inventa la que falta.
  // (Previsión mínima a mano: la última hora real de la sintética es de noche.)
  const ultima = [{ ms: MANANA_10, estado: 'precaucion' }, { ms: MANANA_10 + H, estado: 'ok' }];
  const final = { horas: ultima, dias: [{ clave: '2026-06-22', horas: ultima }] };
  assert.deepEqual(huecosPlan(final, 2, AHORA), [{ ms: MANANA_10, clave: '2026-06-22', estado: 'precaucion' }], 'en verde solo queda 1 h');
  assert.deepEqual(huecosPlan(final, 1, AHORA), [{ ms: MANANA_10 + H, clave: '2026-06-22', estado: 'ok' }]);
  // Un hueco en la previsión (falta una hora) corta el tramo.
  const rota = [{ ms: MANANA_10, estado: 'ok' }, { ms: MANANA_10 + 2 * H, estado: 'ok' }];
  assert.deepEqual(huecosPlan({ horas: rota, dias: [{ clave: '2026-06-22', horas: rota }] }, 2, AHORA), []);
  // Todo verde: un hueco por día, hoy desde la hora en curso (10:30 → 10:00).
  const todo = huecosPlan(prev({ viento: 3 }), 2, AHORA);
  assert.equal(todo.length, 7);
  assert.equal(todo[0].ms, Date.parse('2026-06-21T08:00:00Z'));
});

test('huecos: sin verde en toda la previsión, los de ámbar, y lo dice', async () => {
  const { huecosPlan } = await import('../src/motor/planificado.js');
  const p = prev({ viento: 7, racha: 7 }); // ámbar todo el tiempo para el Flip
  const h = huecosPlan(p, 2, AHORA);
  assert.ok(h.length >= 1);
  assert.ok(h.every((x) => x.estado === 'precaucion'));
  // Con un solo hueco verde, no se mezclan los ámbar.
  const uno = prev({ viento: (k) => (k === 40 || k === 41 ? 3 : 7), racha: (k) => (k === 40 || k === 41 ? 4 : 7) });
  assert.deepEqual(huecosPlan(uno, 2, AHORA).map((x) => x.estado), ['ok']);
});
