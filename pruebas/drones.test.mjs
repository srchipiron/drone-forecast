import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRONES, SUCESORES, dronPorId, idDron } from '../src/motor/drones.js';
import { normalizarAjustes } from '../src/motor/prevision.js';

test('cada dron tiene marca, fuente oficial y límites con sentido', () => {
  const ids = new Set();
  for (const d of DRONES) {
    assert.ok(!ids.has(d.id), `id repetido: ${d.id}`);
    ids.add(d.id);
    assert.ok(d.marca && d.nombre, d.id);
    assert.match(d.fuente, /^https:\/\/(www\.|enterprise\.|ag\.)?(dji|autelrobotics|skydio|parrot)\.com\//, `${d.id}: la fuente es la web del fabricante`);
    assert.ok(d.maxViento >= 5 && d.maxViento <= 20, `${d.id}: viento ${d.maxViento}`);
    assert.ok(d.tempMin < d.tempMax && d.tempMin >= -40 && d.tempMax <= 60, `${d.id}: temperatura`);
    assert.ok(d.ip === null || /^IP\d5$|^IP\d[6-8]$/.test(d.ip), `${d.id}: solo IPx5 o más cuenta como lluvia`);
  }
});

test('ya no están los modelos viejos', () => {
  for (const viejo of Object.keys(SUCESORES)) assert.equal(DRONES.some((d) => d.id === viejo), false, viejo);
});

test('los DJI anteriores están tal cual (Javi: que no falte ninguno)', () => {
  for (const id of ['mini2', 'minise', 'mini3', 'mini3pro', 'mini4pro', 'air2s', 'air3', 'mavic2pro', 'mavic3', 'mavic3pro', 'avata2', 'fpv', 'p4pro2', 'p4rtk', 'inspire2', 'inspire3', 'm2ea', 'm3m', 'm30', 'm300', 'm350', 'm3d', 'flycart30', 'agrast50']) {
    assert.equal(idDron(id), id, id);
  }
  assert.equal(normalizarAjustes({ dron: 'air3' }).dron, 'air3', 'quien tenía un Air 3 sigue con su Air 3');
  assert.equal(dronPorId('mavic2pro').maxViento, 8.1, '29 km/h, el bajo del rango');
  assert.equal(dronPorId('m300').ip, 'IP45', 'IPx5 cuenta como lluvia ligera');
  assert.equal(dronPorId('m3d').ip, null, 'IP54: salpicaduras, no lluvia');
  for (const nuevo of Object.values(SUCESORES)) assert.ok(DRONES.some((d) => d.id === nuevo), `sucesor inexistente: ${nuevo}`);
});

test('un id desconocido cae en un dron real y el personalizado se respeta', () => {
  assert.ok(DRONES.some((d) => d.id === idDron('inventado')));
  assert.equal(dronPorId('personalizado', { maxViento: 9 }).maxViento, 9);
});

test('el Mavic 3 Enterprise de Aeroscan está en la lista y no se cambia por otro', () => {
  assert.equal(idDron('m3e'), 'm3e');
  assert.equal(normalizarAjustes({ dron: 'm3e' }).dron, 'm3e');
  const d = dronPorId('m3e');
  assert.equal(d.nombre, 'DJI Mavic 3 Enterprise (M3E / M3T)');
  assert.equal(d.maxViento, 12);
  assert.deepEqual(normalizarAjustes({ misDrones: ['m3e', 'm4et'] }).misDrones, ['m3e', 'm4et']);
});
