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

const { cargarSatelites } = await import('../src/app/datos.js');
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
