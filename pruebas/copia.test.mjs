import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARCA, crearCopia, leerCopia } from '../src/motor/copia.js';
import { crearPlan } from '../src/motor/planificado.js';
import { crearTrabajo } from '../src/motor/trabajos.js';

const AHORA = Date.parse('2026-11-25T10:00:00Z');
const getafe = { nombre: 'Getafe', zona: 'Madrid', lat: 40.3057, lon: -3.7329 };
const plan = crearPlan({ ms: AHORA + 86400000, horas: 2, lugar: getafe, zona: 'Europe/Madrid', estado: 'ok', ajustes: { dron: 'mini5pro' } });
const trabajo = crearTrabajo({ nombre: 'Orto', lugar: getafe, tipo: 'fotogrametria', desde: '2026-11-25', hasta: '2026-11-30', horaInicio: 9, horaFin: 14, jornadas: 2, horasJornada: 2, fraccionable: true, ajustes: {} }, AHORA).trabajo;
const vuelo = { id: 'v1', ms: AHORA - 86400000, lugar: getafe, dron: 'mini5pro', mision: 'recreativo', valoracion: 'bien', nota: '', prevision: { estado: 'ok' } };
const datos = { ajustes: { dron: 'mini5pro', altitud: 90 }, lugar: getafe, favoritos: [getafe], diario: [vuelo], planes: [plan], trabajos: [trabajo], pantalla: 'sol', aviso: true };

test('copia: lo que se exporta vuelve igual al importarlo', () => {
  const texto = crearCopia(datos, { version: '0.45.0', ahora: AHORA });
  const j = JSON.parse(texto);
  assert.equal(j.app, MARCA);
  assert.equal(j.version, '0.45.0');
  const r = leerCopia(texto, AHORA);
  assert.equal(r.creada, '2026-11-25');
  assert.equal(r.datos.ajustes.dron, 'mini5pro');
  assert.equal(r.datos.ajustes.altitud, 90);
  assert.deepEqual(r.datos.lugar, getafe);
  assert.deepEqual(r.datos.favoritos, [getafe]);
  assert.deepEqual(r.datos.planes, [plan]);
  assert.deepEqual(r.datos.trabajos, [trabajo]);
  assert.deepEqual(r.datos.diario, [vuelo]);
  assert.deepEqual([r.datos.pantalla, r.datos.aviso], ['sol', true]);
  assert.equal(r.resumen, '1 favorito, 1 vuelo en el diario, 1 vuelo planificado, 1 trabajo');
});

test('copia: un fichero que no es una copia, o manipulado, no mete nada raro', () => {
  assert.match(leerCopia('esto no es json').error, /no es JSON/);
  assert.match(leerCopia('{"app":"otra","datos":{}}').error, /no es una copia/);
  assert.match(leerCopia(JSON.stringify({ app: MARCA })).error, /no es una copia/);
  const malo = leerCopia(
    JSON.stringify({
      app: MARCA,
      datos: {
        ajustes: { altitud: 99999, dron: '<script>' },
        lugar: { nombre: 'x', lat: 'no', lon: 1 },
        favoritos: [getafe, { lat: 200, lon: 0 }, null, 'texto'],
        planes: [{ id: 'roto' }, plan],
        diario: [vuelo, { id: 'x', ms: 1 }],
        trabajos: [{ nombre: 'sin nada' }],
        pantalla: 'naranja',
        aviso: 'sí',
        extra: 'ignorado',
      },
    }),
    AHORA,
  );
  assert.ok(malo.datos.ajustes.altitud <= 120, 'ajustes acotados');
  assert.notEqual(malo.datos.ajustes.dron, '<script>');
  assert.equal(malo.datos.lugar, null);
  assert.deepEqual(malo.datos.favoritos, [getafe]);
  assert.deepEqual(malo.datos.planes, [plan]);
  assert.deepEqual(malo.datos.diario, [vuelo]);
  assert.deepEqual(malo.datos.trabajos, []);
  assert.deepEqual([malo.datos.pantalla, malo.datos.aviso], ['auto', false]);
  assert.equal('extra' in malo.datos, false);
});
