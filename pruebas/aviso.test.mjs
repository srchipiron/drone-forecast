// Aviso de ventana: el motor (qué favoritos tienen mañana ventana verde) y el
// recorrido entero del instalador en Node, con red y Cache Storage de mentira.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AHORA, respuestaOpenMeteo } from './fixtures/sinteticos.mjs';
import { leerPrevision } from '../src/motor/meteo.js';
import { textoAviso, ventanasManana } from '../src/motor/aviso.js';

const BUENO = { nombre: 'Getafe', lat: 40.3, lon: -3.73 };
const MALO = { nombre: 'Tarifa', lat: 36.01, lon: -5.6 };
const meteo = { bueno: respuestaOpenMeteo({ viento: 3 }), malo: respuestaOpenMeteo({ viento: 20, racha: 25 }) };

test('motor: solo avisa de los favoritos con ventana VERDE mañana, la más larga primero', () => {
  const corto = respuestaOpenMeteo({ viento: (k) => (k >= 24 + 10 && k < 24 + 12 ? 3 : 20) });
  const v = ventanasManana(
    [
      { lugar: { nombre: 'Corto', lat: 40, lon: -3.7 }, meteo: leerPrevision(corto) },
      { lugar: MALO, meteo: leerPrevision(meteo.malo) },
      { lugar: { nombre: 'Ámbar', lat: 41, lon: -4 }, meteo: leerPrevision(respuestaOpenMeteo({ viento: 7, racha: 7 })) },
      { lugar: BUENO, meteo: leerPrevision(meteo.bueno) },
    ],
    { ajustes: {}, ahora: AHORA },
  );
  assert.deepEqual(v.map((x) => x.nombre), ['Getafe', 'Corto'], 'ni el de viento fuerte ni el que solo tiene ventana en ámbar');
  assert.equal(v[1].horas, 2);
  const t = textoAviso(v);
  assert.equal(t.titulo, 'Mañana se puede volar en 2 favoritos');
  assert.match(t.cuerpo, /^Getafe: \d\d:00–\d\d:00 \(\d+ h\) · Corto: 10:00–12:00 \(2 h\)$/);
});

test('motor: con un solo favorito lo nombra; sin ventanas no hay aviso', () => {
  assert.equal(textoAviso([{ nombre: 'Getafe', zona: 'Europe/Madrid', inicio: AHORA, fin: AHORA + 3600000, horas: 1 }]).titulo, 'Mañana se puede volar en Getafe');
  assert.equal(textoAviso([]), null);
});

test('motor: usa los ajustes de la app (con un dron de 5 m/s el día bueno deja de ser verde)', () => {
  const lugares = [{ lugar: BUENO, meteo: leerPrevision(respuestaOpenMeteo({ viento: 4, racha: 5 })) }];
  assert.equal(ventanasManana(lugares, { ajustes: {}, ahora: AHORA }).length, 1);
  const flojo = { dron: 'personalizado', personalizado: { maxViento: 5, tempMin: 0, tempMax: 40 } };
  assert.equal(ventanasManana(lugares, { ajustes: flojo, ahora: AHORA }).length, 0);
});

// ---- El recorrido del instalador ----
const cache = new Map();
globalThis.self = { location: { href: 'https://srchipiron.github.io/drone-forecast/sw-modulo.js' } };
globalThis.caches = {
  open: async () => ({ put: async (k, r) => cache.set(String(k), await r.text()) }),
  match: async (k) => (cache.has(String(k)) ? new Response(cache.get(String(k))) : undefined),
};
let caida = new Set();
const pedidas = [];
globalThis.fetch = async (url) => {
  const u = String(url);
  pedidas.push(u);
  const de = (l) => u.includes(`latitude=${l.lat}`);
  let cuerpo = null;
  if (u.includes('api.open-meteo.com')) cuerpo = de(BUENO) ? meteo.bueno : de(MALO) ? meteo.malo : null;
  if (!cuerpo || [...caida].some((l) => de(l))) return { ok: false, status: 503, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => cuerpo };
};
const { almacen } = await import('../src/app/almacen.js');
const { comprobarAvisos } = await import('../src/app/aviso.js');

function registro() {
  const avisos = [];
  return { avisos, showNotification: async (titulo, op) => avisos.push({ titulo, ...op }) };
}

test('instalador: apagado o sin favoritos no descarga nada', async () => {
  cache.clear();
  pedidas.length = 0;
  assert.equal((await comprobarAvisos(registro(), { ahora: AHORA })).estado, 'apagado');
  await almacen.guardarConfigAviso({ activo: true, ajustes: {}, favoritos: [] });
  assert.equal((await comprobarAvisos(registro(), { ahora: AHORA })).estado, 'sin-favoritos');
  assert.equal(pedidas.length, 0);
});

test('instalador: avisa una vez al día de los favoritos con ventana verde', async () => {
  cache.clear();
  caida = new Set();
  await almacen.guardarConfigAviso({ activo: true, ajustes: {}, favoritos: [BUENO, MALO] });
  const r = registro();
  assert.equal((await comprobarAvisos(r, { ahora: AHORA })).estado, 'avisado');
  assert.equal(r.avisos.length, 1);
  assert.equal(r.avisos[0].titulo, 'Mañana se puede volar en Getafe');
  assert.equal(r.avisos[0].tag, 'aviso-ventana');
  assert.equal((await almacen.configAviso()).ultimo, '2026-06-21');
  pedidas.length = 0;
  assert.equal((await comprobarAvisos(r, { ahora: AHORA + 3600000 })).estado, 'ya-avisado');
  assert.equal(pedidas.length, 0, 'el mismo día no vuelve a descargar');
  assert.equal(r.avisos.length, 1);
});

test('instalador: un favorito sin previsión no tapa a los demás; «Probar ahora» avisa aunque no haya ventana', async () => {
  cache.clear();
  caida = new Set([BUENO]);
  await almacen.guardarConfigAviso({ activo: true, ajustes: {}, favoritos: [BUENO, MALO] });
  const r = registro();
  assert.equal((await comprobarAvisos(r, { ahora: AHORA })).estado, 'sin-ventana');
  assert.equal(r.avisos.length, 0, 'sin ventana, en segundo plano no molesta');
  assert.equal((await comprobarAvisos(r, { forzar: true, ahora: AHORA })).estado, 'sin-ventana');
  assert.equal(r.avisos[0].titulo, 'Mañana no hay ventana verde');
  caida = new Set([BUENO, MALO]);
  assert.equal((await comprobarAvisos(registro(), { forzar: true, ahora: AHORA })).estado, 'sin-datos');
});
