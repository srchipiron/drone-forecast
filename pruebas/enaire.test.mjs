import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAPAS, leerZonas, resumenZonas, urlConsultaEnaire } from '../src/motor/enaire.js';

test('la consulta es la estándar de ArcGIS: punto en WGS84, intersección, sin geometría', () => {
  const u = new URL(urlConsultaEnaire(2, 40.4168, -3.7038));
  assert.equal(u.origin, 'https://servais.enaire.es');
  assert.match(u.pathname, /\/SRV_UAS_ZG_data_V2\/FeatureServer\/2\/query$/);
  assert.equal(u.searchParams.get('geometry'), '-3.703800,40.416800', 'ArcGIS quiere x,y: longitud primero');
  assert.equal(u.searchParams.get('inSR'), '4326');
  assert.equal(u.searchParams.get('spatialRel'), 'esriSpatialRelIntersects');
  assert.equal(u.searchParams.get('returnGeometry'), 'false');
  assert.equal(u.searchParams.get('f'), 'json');
  assert.deepEqual(CAPAS.map((c) => c.id).sort(), [0, 1, 2, 3]);
});

test('lee nombre, restricción traducida, motivo y mensaje aunque los campos varíen', () => {
  const z = leerZonas({ features: [{ attributes: { identifier: 'LEMD-CTR', name: 'CTR Madrid', restriction: 'REQ_AUTHORIZATION', reason: 'AIR_TRAFFIC', message: 'Coordinar con ENAIRE' } }, { attributes: { NOMBRE_ZONA: 'Parque Natural', RESTRICCION: 'PROHIBITED' } }, { attributes: {} }] }, 'Aeronáutica');
  assert.deepEqual(z[0], { capa: 'Aeronáutica', nombre: 'CTR Madrid', restriccion: 'requiere autorización', motivo: 'tráfico aéreo', mensaje: 'Coordinar con ENAIRE' });
  assert.equal(z[1].nombre, 'Parque Natural');
  assert.equal(z[1].restriccion, 'prohibido volar');
  assert.equal(z[2].nombre, 'Zona sin nombre');
});

test('un error de ArcGIS (200 con {error}) es un fallo, no «cero zonas»', () => {
  assert.throws(() => leerZonas({ error: { code: 400, message: 'Invalid query' } }, 'Urbana'), /Invalid query/);
  assert.throws(() => leerZonas({}, 'Urbana'));
  assert.throws(() => leerZonas(null, 'Urbana'));
  assert.deepEqual(leerZonas({ features: [] }, 'Urbana'), []);
});

test('nunca dice «fuera» si alguna capa falló', () => {
  const ok = (capa, zonas = []) => ({ capa, ok: true, zonas });
  const mal = (capa) => ({ capa, ok: false });
  assert.equal(resumenZonas([ok('A'), ok('B')]).estado, 'fuera');
  assert.equal(resumenZonas([ok('A'), mal('B')]).estado, 'incompleto');
  assert.equal(resumenZonas([mal('A'), mal('B')]).estado, 'error');
  const r = resumenZonas([ok('A', [{ nombre: 'X' }]), mal('B')]);
  assert.equal(r.estado, 'dentro');
  assert.deepEqual(r.fallidas, ['B']);
});
