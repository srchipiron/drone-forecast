import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAM, aLatLon, aTesela, puntoEnPixel, teselasVisibles } from '../src/motor/mapa.js';

const casi = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} frente a ${b}`);

test('mapa: el (0, 0) cae en el centro del mundo y Madrid en su tesela de OSM', () => {
  assert.deepEqual(aTesela(0, 0, 1), { x: 1, y: 1 });
  const m = aTesela(40.4168, -3.7038, 10);
  // Tesela de OSM de la Puerta del Sol en z10: 501/386.
  assert.equal(Math.floor(m.x), 501);
  assert.equal(Math.floor(m.y), 386);
});

test('mapa: ida y vuelta sin perder el punto; la longitud da la vuelta al mundo', () => {
  for (const [lat, lon] of [[40.4168, -3.7038], [28.1, -15.4], [-33.9, 151.2], [64.1, -21.9]]) {
    const t = aTesela(lat, lon, 14);
    const p = aLatLon(t.x, t.y, 14);
    casi(p.lat, lat, 1e-9, 'lat');
    casi(p.lon, lon, 1e-9, 'lon');
  }
  casi(aLatLon(2 ** 5 + 1, 16, 5).lon, aLatLon(1, 16, 5).lon, 1e-9, 'una vuelta al mundo es el mismo sitio');
});

test('mapa: las teselas visibles tapan el rectángulo, dan la vuelta en x y no salen de los polos', () => {
  const v = teselasVisibles(10.5, 10.5, 5, 400, 300);
  for (const t of v) assert.ok(t.izq < 400 && t.izq + TAM > 0 && t.arriba < 300 && t.arriba + TAM > 0, 'cada tesela se ve');
  assert.ok(v.some((t) => t.izq <= 0) && v.some((t) => t.izq + TAM >= 400), 'tapan de lado a lado');
  const borde = teselasVisibles(0.2, 0.2, 3, 400, 400);
  assert.ok(borde.some((t) => t.x === 7), 'a la izquierda de la 0 está la última');
  assert.ok(borde.every((t) => t.y >= 0), 'nada por encima del polo');
});

test('mapa: el píxel del centro es el centro, y un píxel a la derecha es un poco más al este', () => {
  const c = aTesela(40.3, -3.73, 12);
  const p = puntoEnPixel(c.x, c.y, 12, 360, 300, 180, 150);
  casi(p.lat, 40.3, 1e-9, 'lat');
  casi(p.lon, -3.73, 1e-9, 'lon');
  assert.ok(puntoEnPixel(c.x, c.y, 12, 360, 300, 181, 150).lon > -3.73);
  assert.ok(puntoEnPixel(c.x, c.y, 12, 360, 300, 180, 151).lat < 40.3, 'hacia abajo es hacia el sur');
});
