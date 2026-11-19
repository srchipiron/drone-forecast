// datos.js en Node, con fetch y localStorage de mentira.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const guardado = new Map();
globalThis.localStorage = {
  getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
  setItem: (k, v) => guardado.set(k, String(v)),
};
let respuestas = {};
const pedidas = [];
globalThis.fetch = async (url) => {
  pedidas.push(String(url));
  const clave = Object.keys(respuestas).find((k) => String(url).includes(k));
  if (!clave) throw new Error(`sin respuesta para ${url}`);
  const [estado, cuerpo] = respuestas[clave];
  return { ok: estado === 200, status: estado, json: async () => cuerpo };
};

const { cargarFormasEnaire, cargarSatelites } = await import('../src/app/datos.js');
const sat = (epoca, nombre = 'GPS-1') => ({ nombre, constelacion: 'GPS', epoca, n: 2.0056, e: 0.01, i: 55, raan: 1, argp: 2, M: 3 });
const omm = { OBJECT_NAME: 'GPS NUEVO', EPOCH: new Date().toISOString().replace('Z', ''), MEAN_MOTION: 2.0056, ECCENTRICITY: 0.01, INCLINATION: 55, RA_OF_ASC_NODE: 1, ARG_OF_PERICENTER: 2, MEAN_ANOMALY: 3 };

test('órbitas recientes del despliegue: se usan sin molestar a CelesTrak', async () => {
  guardado.clear();
  pedidas.length = 0;
  respuestas = { 'data/gnss.json': [200, { actualizado: new Date().toISOString(), satelites: [sat(Date.now() - 86400000)] }] };
  const r = await cargarSatelites();
  assert.equal(r.origen, 'despliegue');
  assert.equal(pedidas.some((u) => u.includes('celestrak')), false);
});

test('órbitas del despliegue de hace días: el móvil las pide a CelesTrak', async () => {
  guardado.clear();
  pedidas.length = 0;
  respuestas = {
    'data/gnss.json': [200, { actualizado: new Date().toISOString(), satelites: [sat(Date.now() - 10 * 86400000)] }],
    'GROUP=gps-ops': [200, [omm]],
    celestrak: [503, {}],
  };
  const r = await cargarSatelites();
  assert.equal(r.origen, 'celestrak');
  assert.equal(r.satelites[0].nombre, 'GPS NUEVO');
});

test('una fecha de guardado rota no tumba la carga', async () => {
  guardado.clear();
  guardado.set('drone-forecast:orbitas', JSON.stringify({ guardado: 'basura', satelites: [sat(Date.now())] }));
  respuestas = { 'data/gnss.json': [404, {}], celestrak: [503, {}] };
  const r = await cargarSatelites();
  assert.equal(r.origen, 'guardadas');
  assert.equal(r.actualizado, null);
});

test('formas de ENAIRE: una capa cortada por el tope (exceededTransferLimit) no cuenta como completa', async () => {
  const zona = { attributes: { identifier: 'A', type: 'PROHIBITED' }, geometry: { rings: [[[0, 0], [1, 0], [1, 1]]] } };
  respuestas = {
    'FeatureServer/2/query': [200, { features: [zona], exceededTransferLimit: true }],
    'FeatureServer/0/query': [200, { features: [] }],
    'FeatureServer/3/query': [500, {}],
  };
  const r = await cargarFormasEnaire({ oeste: -4, sur: 40, este: -3, norte: 41 }, 0.001);
  assert.deepEqual(r.cortadas, ['Aeronáutica']);
  assert.deepEqual(r.fallidas, ['Urbana']);
  assert.equal(r.zonas.length, 1);
  assert.equal(r.error, false);
});

test('formas de ENAIRE: se pueden cancelar (el mapa cancela lo que ya no se mira)', async () => {
  const fetchAntes = globalThis.fetch;
  const vistas = [];
  globalThis.fetch = async (url, op) => {
    vistas.push(op?.signal);
    return new Promise((_, mal) => op.signal.addEventListener('abort', () => mal(op.signal.reason)));
  };
  try {
    const cancelar = new AbortController();
    const prometida = cargarFormasEnaire({ oeste: -4, sur: 40, este: -3, norte: 41 }, 0.001, cancelar.signal);
    cancelar.abort();
    const r = await prometida;
    assert.equal(r.error, true, 'cancelado: ninguna capa llega');
    assert.equal(vistas.length, 3);
  } finally {
    globalThis.fetch = fetchAntes;
  }
});
