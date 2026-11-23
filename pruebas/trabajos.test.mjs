import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerPrevision } from '../src/motor/meteo.js';
import { construirPrevision } from '../src/motor/prevision.js';
import { combinarPrevisiones, crearTrabajo, organizarTodos, fechasEntre, organizarTrabajo, planesDeTrabajo, trabajosValidos, valorarDia } from '../src/motor/trabajos.js';
import { AHORA, LUGAR, constelacionSintetica, respuestaOpenMeteo } from './fixtures/sinteticos.mjs';

// La previsión sintética empieza a las 00:00 del 21-06-2026 (Madrid) y trae
// 7 días; AHORA es el 21 a las 10:30. k = horas desde ese comienzo.
const sats = [...constelacionSintetica(AHORA, 'GPS'), ...constelacionSintetica(AHORA, 'Galileo', 3, 8)];
const dia = (k) => Math.floor(k / 24);
const horaDe = (k) => k % 24;
function prev(viento) {
  const meteo = leerPrevision(respuestaOpenMeteo({ viento, racha: (k) => viento(k) * 1.4 }));
  return construirPrevision({ meteo, kp: [], satelites: sats, lugar: LUGAR, ajustes: { modo: 'profesional', mision: 'general' }, ahora: AHORA });
}
// El 22 y el 24, vendaval todo el día; el resto, calma.
const p = prev((k) => ([1, 3].includes(dia(k)) ? 20 : 2));

const base = { nombre: 'Orto Getafe', lugar: LUGAR, tipo: 'general', desde: '2026-06-22', hasta: '2026-06-26', horaInicio: 9, horaFin: 14, jornadas: 2, horasJornada: 3, fraccionable: false, ajustes: { dron: 'mavic4pro', altitud: 100, misDrones: ['neo'] } };
const trabajo = (cambios = {}, ahora = AHORA) => {
  const r = crearTrabajo({ ...base, ...cambios }, ahora);
  assert.ok(r.trabajo, r.error);
  return r.trabajo;
};
const horaLocal = (ms) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23' }).format(ms));

test('trabajo: se valida y se normaliza lo que viene del formulario', () => {
  const t = trabajo({ jornadas: '2', horasJornada: '3', horaInicio: '9', horaFin: '14', nombre: '  Orto Getafe  ' });
  assert.equal(t.nombre, 'Orto Getafe');
  assert.deepEqual([t.jornadas, t.horasJornada, t.horaInicio, t.horaFin], [2, 3, 9, 14]);
  assert.deepEqual(t.ajustes, { dron: 'mavic4pro', altitud: 100, modo: 'profesional', mision: 'general' }, 'en profesional, con el tipo de misión y sin «Mis drones»');
  assert.equal(trabajo({ jornadas: 1, fraccionable: true }).fraccionable, false, 'una jornada no se parte');
  const error = (c) => crearTrabajo({ ...base, ...c }).error;
  assert.match(error({ nombre: ' ' }), /nombre/);
  assert.match(error({ lugar: null }), /Falta el sitio/);
  assert.match(error({ tipo: 'recreativo' }), /tipo/);
  assert.match(error({ desde: '2026-02-30' }), /fechas/, 'una fecha que no existe');
  assert.match(error({ hasta: '2026-06-21' }), /antes de empezar/);
  assert.match(error({ horaFin: 9 }), /después de empezar/);
  assert.match(error({ horasJornada: 6 }), /no caben 6 h/);
  assert.match(error({ jornadas: 6 }), /5 días: no caben 6 jornadas/);
  assert.match(error({ jornadas: 11 }), /De 1 a 10/);
  assert.deepEqual(fechasEntre('2026-06-29', '2026-07-02'), ['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02']);
  assert.equal(trabajosValidos([t, { nombre: 'roto' }, null]).length, 1, 'lo guardado que no vale se descarta');
});

test('trabajo de dos jornadas: seguidas, el primer par de días buenos; partido, los primeros días buenos sueltos', () => {
  const seguidas = organizarTrabajo(trabajo(), p, AHORA);
  assert.equal(seguidas.estado, 'ok');
  assert.deepEqual(seguidas.elegidos.map((d) => d.clave), ['2026-06-25', '2026-06-26'], 'el 22 y el 24 hay vendaval: el primer par seguido es 25-26');
  assert.deepEqual(seguidas.dias.map((d) => d.estado), ['no', 'ok', 'no', 'ok', 'ok']);
  assert.match(seguidas.dias[0].porQue, /^(viento|rachas)$/, 'los días malos dicen por qué');

  const partido = organizarTrabajo(trabajo({ fraccionable: true }), p, AHORA);
  assert.deepEqual(partido.elegidos.map((d) => d.clave), ['2026-06-23', '2026-06-25'], 'el martes y el jueves, por así decirlo');
  // Cada jornada: 3 h seguidas dentro del horario, desde la primera hora.
  for (const d of partido.elegidos) {
    assert.equal(horaLocal(d.inicio), 9);
    assert.equal(d.fin - d.inicio, 3 * 3600000);
  }
  assert.deepEqual(
    planesDeTrabajo(trabajo({ fraccionable: true }), partido).map((x) => [x.horas, x.nota]),
    [[3, 'Orto Getafe · jornada 1 de 2'], [3, 'Orto Getafe · jornada 2 de 2']],
  );
});

test('trabajo: el horario manda (viento por la mañana no estropea un trabajo de tarde)', () => {
  const pm = prev((k) => (dia(k) === 2 && horaDe(k) >= 8 && horaDe(k) < 13 ? 20 : 2));
  const manana = organizarTrabajo(trabajo({ desde: '2026-06-23', hasta: '2026-06-23', jornadas: 1, horaInicio: 9, horaFin: 13, horasJornada: 2 }), pm, AHORA);
  assert.equal(manana.estado, 'imposible');
  const tarde = organizarTrabajo(trabajo({ desde: '2026-06-23', hasta: '2026-06-23', jornadas: 1, horaInicio: 14, horaFin: 18, horasJornada: 2 }), pm, AHORA);
  assert.equal(tarde.estado, 'ok');
  assert.equal(horaLocal(tarde.elegidos[0].inicio), 14);
  // Con un hueco de viento a mitad de la franja no caben 4 h seguidas.
  const hueco = prev((k) => (dia(k) === 2 && horaDe(k) === 11 ? 20 : 2));
  const d = valorarDia(hueco.dias.find((x) => x.clave === '2026-06-23'), trabajo({ horasJornada: 4, horaInicio: 9, horaFin: 14 }), hueco.zona, AHORA);
  assert.deepEqual([d.estado, d.porQue], ['no', 'pocas horas']);
  // Si a la previsión le falta una hora, el tramo no salta por encima del hueco.
  const d23 = p.dias.find((x) => x.clave === '2026-06-23');
  const sinLas11 = { ...d23, horas: d23.horas.filter((h) => horaLocal(h.ms) !== 11) };
  assert.equal(horaLocal(valorarDia(sinLas11, trabajo({ horasJornada: 2, horaInicio: 9, horaFin: 14 }), p.zona, AHORA).inicio), 9);
  assert.equal(horaLocal(valorarDia(sinLas11, trabajo({ horasJornada: 3, horaInicio: 9, horaFin: 15 }), p.zona, AHORA).inicio), 12);
});

test('trabajo: más allá de la previsión, lo que aún no se sabe; y lo pasado', () => {
  // La previsión llega al 27. Permiso del 26 al 30.
  const t = { desde: '2026-06-26', hasta: '2026-06-30', jornadas: 3 };
  const seguidas = organizarTrabajo(trabajo(t), p, AHORA);
  assert.equal(seguidas.estado, 'pendiente');
  assert.equal(seguidas.hastaPrevision, '2026-06-27');
  assert.deepEqual(seguidas.dias.map((d) => d.estado), ['ok', 'ok', 'sin-prevision', 'sin-prevision', 'sin-prevision']);
  const partido = organizarTrabajo(trabajo({ ...t, fraccionable: true }), p, AHORA);
  assert.deepEqual([partido.estado, partido.faltan, partido.elegidos.length], ['incompleto', 1, 2]);
  // Sin días desconocidos y sin hueco: imposible.
  const malo = organizarTrabajo(trabajo({ desde: '2026-06-22', hasta: '2026-06-22', jornadas: 1 }), p, AHORA);
  assert.equal(malo.estado, 'imposible');
  // Hoy (21, 10:30) con horario de 8 a 10: ya pasó; el permiso que terminó, caducado.
  const hoy = organizarTrabajo(trabajo({ desde: '2026-06-20', hasta: '2026-06-21', jornadas: 1, horaInicio: 8, horaFin: 10, horasJornada: 1 }), p, AHORA);
  assert.deepEqual(hoy.dias.map((d) => [d.clave, d.porQue]), [['2026-06-21', 'ya pasó']], 'los días antes de hoy ni salen');
  assert.equal(organizarTrabajo(trabajo({ desde: '2026-06-19', hasta: '2026-06-20', jornadas: 1 }), p, AHORA).estado, 'caducado');
});

test('trabajo en una traza o en varios puntos: se guarda su forma y cada hora manda el punto peor', () => {
  const linea = [{ lat: 40.4, lon: -3.7 }, { lat: 40.4, lon: -3.6 }];
  const t = trabajo({ lugar: { nombre: 'Línea 3', forma: 'traza', puntos: linea }, fraccionable: true });
  assert.deepEqual(t.lugar, { nombre: 'Línea 3', lat: 40.4, lon: -3.7, forma: 'traza', puntos: linea }, 'el lugar de los vuelos planificados es el primer punto');
  assert.equal(trabajo({ lugar: { ...LUGAR, forma: 'raro', puntos: linea } }).lugar.forma, undefined, 'una forma desconocida es un punto');
  assert.match(crearTrabajo({ ...base, lugar: { forma: 'puntos', puntos: [linea[0]] } }).error, /al menos dos puntos/);
  assert.match(crearTrabajo({ ...base, lugar: { forma: 'traza', puntos: [] } }).error, /al menos dos puntos/);
  assert.equal(trabajosValidos([t])[0].lugar.puntos.length, 2, 'sobrevive a guardarse y leerse');

  // Un segundo punto con vendaval el 25: la traza entera no se puede ese día.
  const otro = prev((k) => (dia(k) === 4 ? 20 : 2));
  const juntos = combinarPrevisiones([p, otro]);
  assert.equal(juntos.puntos, 2);
  assert.equal(combinarPrevisiones([p]), p, 'con un punto, tal cual');
  const h = juntos.dias.find((d) => d.clave === '2026-06-25').horas[10];
  assert.equal(h.estado, 'no');
  assert.equal(h.puntoPeor, 1, 'dice qué punto la estropea');
  assert.equal(h.factores.find((f) => f.id === 'viento').estado, 'no', 'cada factor, el peor de los puntos');
  assert.equal(juntos.dias.find((d) => d.clave === '2026-06-23').horas[10].estado, 'ok', 'donde los dos están bien, bien');
  const org = organizarTrabajo(t, juntos, AHORA);
  assert.deepEqual(org.elegidos.map((d) => d.clave), ['2026-06-23', '2026-06-26'], 'el 22 y el 24 por el primer punto, el 25 por el segundo');
  assert.equal(organizarTrabajo({ ...t, fraccionable: false }, juntos, AHORA).estado, 'imposible', 'no quedan dos días seguidos');
  // Las horas que no tiene uno de los puntos no cuentan.
  const corto = { ...otro, horas: otro.horas.slice(0, 48) };
  assert.equal(combinarPrevisiones([p, corto]).horas.length, 48 - p.horas.indexOf(p.horas.find((x) => x.ms === corto.horas[0].ms)));
});

test('trabajos que no se pueden solapar (vais los dos): no comparten horas con otros', () => {
  // Dos trabajos de una jornada de 3 h, de 9 a 14, del 23 al 26 (el 24, vendaval).
  const comun = { desde: '2026-06-23', hasta: '2026-06-26', jornadas: 1, horasJornada: 3 };
  const a = trabajo({ ...comun, id: 'z', exclusivo: true, hasta: '2026-06-25' }); // el último por nombre, el primero por urgencia
  const b = trabajo({ ...comun, id: 'b' });
  const c = trabajo({ ...comun, id: 'c' });
  assert.equal(a.exclusivo, true);
  assert.equal(b.exclusivo, false);
  const inicio = (org) => [org.elegidos[0].clave, horaLocal(org.elegidos[0].inicio)];
  // Sin exclusivos, los tres el mismo día y a la misma hora (cada uno con su equipo).
  const libres = organizarTodos([b, c].map((t) => ({ trabajo: t, p })), AHORA);
  assert.deepEqual([inicio(libres.get('b')), inicio(libres.get('c'))], [['2026-06-23', 9], ['2026-06-23', 9]]);
  // Con «a» exclusivo: va primero (su permiso acaba antes) y los otros no
  // pueden pisar sus horas: de 9 a 12 el 23 está ocupado y de 12 a 14 no caben 3 h.
  const orgs = organizarTodos([b, c, a, { trabajo: trabajo({ ...comun, id: 'd' }), p: null }].map((x) => (x.trabajo ? x : { trabajo: x, p })), AHORA);
  assert.deepEqual(inicio(orgs.get('z')), ['2026-06-23', 9]);
  assert.deepEqual(inicio(orgs.get('b')), ['2026-06-25', 9], 'el 23 lo ocupa «a» y el 24 hay vendaval');
  assert.deepEqual(inicio(orgs.get('c')), ['2026-06-25', 9], 'b y c sí pueden coincidir entre ellos');
  assert.equal(orgs.get('b').dias.find((d) => d.clave === '2026-06-23').porQue, 'otro trabajo');
  assert.equal(orgs.has('d'), false, 'sin previsión todavía, no se organiza');
  // Un exclusivo tampoco pisa a los ya repartidos ni a los vuelos planificados a mano.
  const x = trabajo({ ...comun, id: 'x', exclusivo: true });
  const conPlan = organizarTodos([{ trabajo: b, p }, { trabajo: x, p }], AHORA, [{ inicio: Date.parse('2026-06-25T08:30:00Z'), fin: Date.parse('2026-06-25T09:00:00Z') }]);
  assert.deepEqual(inicio(conPlan.get('b')), ['2026-06-23', 9]);
  assert.deepEqual(inicio(conPlan.get('x')), ['2026-06-25', 11], 'el 23 lo tiene «b», el 24 viento y el 25 un vuelo a mano de 10:30 a 11 ocupa la hora de las 10: de 11 a 14');
});
