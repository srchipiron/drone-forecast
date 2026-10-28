import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensajeUbicacion, pedirUbicacion } from '../src/app/ubicacion.js';

// Un navigator.geolocation de mentira que responde lo que se le diga, en orden.
function geoFalso(respuestas) {
  const llamadas = [];
  return {
    llamadas,
    getCurrentPosition(ok, mal, opciones) {
      llamadas.push(opciones);
      const r = respuestas[llamadas.length - 1];
      queueMicrotask(() => (r.code ? mal(r) : ok(r)));
    },
  };
}
const POS = { coords: { latitude: 40.3, longitude: -3.7 } };

test('permiso denegado: no se reintenta y el mensaje dice dónde darlo', async () => {
  const geo = geoFalso([{ code: 1, message: 'User denied' }]);
  await assert.rejects(pedirUbicacion(geo), (e) => e.code === 1);
  assert.equal(geo.llamadas.length, 1);
  assert.match(mensajeUbicacion({ code: 1 }), /Permisos → Ubicación → Permitir/);
});

test('si el GPS tarda, reintenta una vez con el GPS fino y más margen', async () => {
  const geo = geoFalso([{ code: 3, message: 'Timeout' }, POS]);
  assert.equal(await pedirUbicacion(geo), POS);
  assert.equal(geo.llamadas.length, 2);
  assert.equal(geo.llamadas[0].enableHighAccuracy, false);
  assert.equal(geo.llamadas[1].enableHighAccuracy, true);
  assert.ok(geo.llamadas[1].timeout > geo.llamadas[0].timeout);
});

test('ubicación del sistema apagada: también reintenta, y si sigue, pide activarla', async () => {
  const geo = geoFalso([{ code: 2 }, { code: 2 }]);
  await assert.rejects(pedirUbicacion(geo), (e) => e.code === 2);
  assert.equal(geo.llamadas.length, 2);
  assert.match(mensajeUbicacion({ code: 2 }), /activa la Ubicación/);
});

test('cada caso tiene su mensaje y ninguno dice «no hay permiso» si no es eso', () => {
  const textos = [1, 2, 3, 0].map((code) => mensajeUbicacion({ code }));
  assert.equal(new Set(textos).size, 4);
  for (const t of textos.slice(1)) assert.doesNotMatch(t, /permiso/i);
});

test('sin geolocalización en el navegador no revienta', async () => {
  await assert.rejects(pedirUbicacion(undefined));
});
