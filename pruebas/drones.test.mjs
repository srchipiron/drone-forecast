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
    assert.match(d.fuente, /^https:\/\/(www\.|enterprise\.)?(dji|autelrobotics|skydio|parrot)\.com\//, `${d.id}: la fuente es la web del fabricante`);
    assert.ok(d.maxViento >= 5 && d.maxViento <= 20, `${d.id}: viento ${d.maxViento}`);
    assert.ok(d.tempMin < d.tempMax && d.tempMin >= -40 && d.tempMax <= 60, `${d.id}: temperatura`);
    assert.ok(d.ip === null || /^IP\d5$|^IP\d[6-8]$/.test(d.ip), `${d.id}: solo IPx5 o más cuenta como lluvia`);
  }
});

test('ya no están los modelos viejos', () => {
  for (const viejo of Object.keys(SUCESORES)) assert.equal(DRONES.some((d) => d.id === viejo), false, viejo);
});

test('un dron viejo guardado pasa a su sucesor, no al primero de la lista', () => {
  assert.equal(idDron('mini4pro'), 'mini5pro');
  assert.equal(idDron('m350'), 'm400');
  assert.equal(normalizarAjustes({ dron: 'air3' }).dron, 'air3s');
  assert.equal(dronPorId('mavic3').nombre, 'DJI Mavic 4 Pro');
  for (const nuevo of Object.values(SUCESORES)) assert.ok(DRONES.some((d) => d.id === nuevo), `sucesor inexistente: ${nuevo}`);
});

test('un id desconocido cae en un dron real y el personalizado se respeta', () => {
  assert.ok(DRONES.some((d) => d.id === idDron('inventado')));
  assert.equal(dronPorId('personalizado', { maxViento: 9 }).maxViento, 9);
});
