import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLUMNAS_CSV, MAXIMO_ENTRADAS, anadirEntrada, crearEntrada, diarioCSV, diarioValido, resumenDiario } from '../src/motor/diario.js';
import { graficaDia } from '../src/motor/grafica.js';
import { leerPrevision } from '../src/motor/meteo.js';
import { construirPrevision } from '../src/motor/prevision.js';
import { AHORA, LUGAR, constelacionSintetica, respuestaOpenMeteo } from './fixtures/sinteticos.mjs';

const p = construirPrevision({ meteo: leerPrevision(respuestaOpenMeteo({ viento: 6, racha: 9 })), satelites: constelacionSintetica(), lugar: LUGAR, ajustes: { dron: 'flip' }, ahora: AHORA });

test('una entrada del diario guarda lo que decía la app y por qué avisaba', () => {
  const e = crearEntrada(p, p.actual, { nombre: 'Madrid', ...LUGAR }, { valoracion: 'regular', nota: 'rachas', ms: AHORA });
  assert.equal(e.dron, 'DJI Flip');
  assert.equal(e.prevision.estado, p.actual.estado);
  assert.equal(e.prevision.vientoAlt, p.actual.vientoAlt);
  assert.ok(e.prevision.avisos.includes('viento'), `avisos: ${e.prevision.avisos}`);
  assert.equal(e.valoracion, 'regular');
  assert.throws(() => crearEntrada(p, p.actual, LUGAR, { valoracion: 'genial', ms: AHORA }));
});

test('el diario pone lo nuevo delante, no repite y tiene tope', () => {
  const e1 = crearEntrada(p, p.actual, { nombre: 'A', ...LUGAR }, { valoracion: 'bien', ms: 1 });
  const e2 = crearEntrada(p, p.actual, { nombre: 'B', ...LUGAR }, { valoracion: 'mal', ms: 2 });
  let d = anadirEntrada(anadirEntrada([], e1), e2);
  assert.deepEqual(d.map((e) => e.lugar.nombre), ['B', 'A']);
  d = anadirEntrada(d, e2);
  assert.equal(d.length, 2);
  const mucho = Array.from({ length: MAXIMO_ENTRADAS + 10 }, (_, k) => ({ ...e1, id: String(k) }));
  assert.equal(anadirEntrada(mucho, e2).length, MAXIMO_ENTRADAS);
});

test('el resumen cuenta cómo salieron los vuelos según el color que daba la app', () => {
  const mk = (estado, valoracion) => ({ prevision: { estado }, valoracion });
  const r = resumenDiario([mk('ok', 'bien'), mk('ok', 'regular'), mk('precaucion', 'bien'), mk('raro', 'bien'), mk('no', 'fatal')]);
  assert.deepEqual(r.ok, { bien: 1, regular: 1, mal: 0, total: 2 });
  assert.deepEqual(r.precaucion, { bien: 1, regular: 0, mal: 0, total: 1 });
  assert.equal(r.no.total, 0);
});

test('lo leído del almacenamiento se valida: las entradas rotas se descartan', () => {
  const buena = crearEntrada(p, p.actual, { nombre: 'A', ...LUGAR }, { valoracion: 'bien', ms: 1 });
  assert.deepEqual(diarioValido([buena, null, { id: 1 }, { ...buena, valoracion: 'x' }]), [buena]);
  assert.deepEqual(diarioValido('basura'), []);
});

test('gráfica: los puntos caen dentro del dibujo y el límite queda por encima de «cómodo»', () => {
  const dia = p.dias[0];
  const g = graficaDia(dia.horas, { comodo: 7.5, limite: 10.7 });
  assert.match(g.viento, /^M[\d.]+,[\d.]+( L[\d.]+,[\d.]+){23}$/, '24 horas, una línea');
  for (const [, x, y] of g.viento.matchAll(/([\d.]+),([\d.]+)/g)) {
    assert.ok(+x >= 0 && +x <= g.ancho && +y >= 0 && +y <= g.alto, `${x},${y}`);
  }
  assert.ok(g.yLimite < g.yComodo, 'más viento = más arriba');
  assert.equal(g.franjas.length, 24);
  assert.equal(g.franjas[0].estado, dia.horas[0].estado);
});

test('gráfica: un hueco en los datos corta la línea', () => {
  const horas = [3, 4, null, 5].map((v, i) => ({ ms: i, vientoAlt: v, rachaAlt: v, estado: 'ok' }));
  const g = graficaDia(horas, { comodo: 7, limite: 10 });
  assert.equal((g.viento.match(/M/g) ?? []).length, 2);
});

test('CSV: cabecera, «;» y coma decimal, fecha en la zona pedida, avisos en palabras', () => {
  const e = crearEntrada(p, p.actual, { nombre: 'Getafe', ...LUGAR }, { valoracion: 'regular', nota: 'rachas', ms: Date.UTC(2026, 10, 18, 8, 5) });
  const texto = diarioCSV([e], 'Europe/Madrid');
  assert.ok(texto.startsWith('\uFEFF'), 'BOM: sin él Excel lee mal los acentos');
  assert.ok(texto.endsWith('\r\n'));
  const [cab, fila, ...resto] = texto.slice(1).split('\r\n');
  assert.deepEqual(resto, ['']);
  assert.deepEqual(cab.split(';'), COLUMNAS_CSV);
  const c = fila.split(';');
  assert.equal(c.length, COLUMNAS_CSV.length);
  assert.deepEqual(c.slice(0, 3), ['2026-11-18', '09:05', 'Getafe'], 'hora de Madrid, no UTC');
  assert.equal(c[3], LUGAR.lat.toFixed(5).replace('.', ','));
  assert.equal(c[5], 'DJI Flip');
  assert.equal(c[9], e.prevision.vientoAlt.toFixed(1).replace('.', ','));
  assert.ok(c[13].split(', ').includes('viento'), c[13]);
  assert.deepEqual(c.slice(14), ['Regular', 'rachas']);
  assert.equal(diarioCSV([], 'Europe/Madrid'), `\uFEFF${COLUMNAS_CSV.join(';')}\r\n`);
});

test('CSV: el texto de fuera no rompe columnas ni se ejecuta como fórmula', () => {
  const base = crearEntrada(p, p.actual, { nombre: 'X', ...LUGAR }, { valoracion: 'bien', ms: AHORA });
  const e = { ...base, lugar: { ...base.lugar, nombre: '=HYPERLINK("http://x";"y")' }, nota: 'dos;\nlíneas "y" comillas', prevision: { ...base.prevision, avisos: ['techo', 'raro'] } };
  const fila = diarioCSV([e], 'UTC').slice(1).split('\r\n').slice(1).join('\r\n');
  assert.ok(fila.includes(`"'=HYPERLINK(""http://x"";""y"")"`), 'apóstrofo delante y entre comillas por el «;»');
  assert.ok(fila.includes('"dos;\nlíneas ""y"" comillas"'));
  assert.ok(fila.includes(';nubes bajas, raro;'));
  const salto = diarioCSV([{ ...base, nota: 'una\notra' }], 'UTC');
  assert.ok(salto.includes(';"una\notra"\r\n'), 'un salto de línea suelto también va entre comillas');
  for (const peligro of ['+1', '-1', '@SUM(A1)']) {
    const f = diarioCSV([{ ...base, nota: peligro }], 'UTC').trim().split('\r\n')[1];
    assert.ok(f.endsWith(`;'${peligro}`), f);
  }
  // Las coordenadas negativas son números: no llevan apóstrofo.
  const oeste = diarioCSV([{ ...base, lugar: { ...base.lugar, lon: -3.7 } }], 'UTC').split('\r\n')[1];
  assert.ok(oeste.includes(';-3,70000;'), oeste);
  // Sin datos de previsión, celdas vacías (no «NaN» ni «undefined»).
  const vacio = diarioCSV([{ ...base, prevision: { estado: 'ok' } }], 'UTC').split('\r\n')[1];
  assert.doesNotMatch(vacio, /NaN|undefined|null/);
});
