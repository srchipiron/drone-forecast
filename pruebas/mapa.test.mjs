import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAM, aLatLon, aTesela, ampliarCaja, cajaDentro, cajaVisible, puntoEnPixel, rutaAnillos, teselasVisibles } from '../src/motor/mapa.js';

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

test('mapa: la caja visible rodea el centro y crece al alejar', () => {
  const c = aTesela(40.3, -3.7, 12);
  const k = cajaVisible(c.x, c.y, 12, 390, 300);
  assert.ok(k.oeste < -3.7 && k.este > -3.7 && k.sur < 40.3 && k.norte > 40.3);
  casi(k.este - k.oeste, (390 / TAM / 2 ** 12) * 360, 1e-9, 'ancho en grados');
  const lejos = cajaVisible(c.x / 2, c.y / 2, 11, 390, 300);
  assert.ok(lejos.este - lejos.oeste > (k.este - k.oeste) * 1.9);
});

test('mapa: una caja dentro de otra ampliada no hace falta pedirla otra vez', () => {
  const k = { oeste: -3.8, sur: 40.2, este: -3.6, norte: 40.4 };
  const a = ampliarCaja(k);
  casi(a.oeste, -3.9, 1e-9, 'medio ancho más a cada lado');
  casi(a.norte, 40.5, 1e-9, 'medio alto más arriba');
  assert.ok(cajaDentro(k, a));
  assert.ok(!cajaDentro(a, k));
  assert.ok(!cajaDentro({ ...k, este: -3.4 }, a), 'se sale por el este');
  assert.ok(!cajaDentro(k, null));
});

test('mapa: los anillos pasan a una ruta SVG en los mismos píxeles que las teselas', () => {
  const c = aTesela(40.3, -3.7, 14);
  // Un cuadrado alrededor del centro, y un punto repetido que no debe salir dos veces.
  const r = [[-3.701, 40.299], [-3.699, 40.299], [-3.699, 40.299], [-3.699, 40.301], [-3.701, 40.301]];
  const d = rutaAnillos([r, r], c.x, c.y, 14, 400, 300);
  const trozos = d.split('Z').filter(Boolean);
  assert.equal(trozos.length, 2, 'un subtrazo cerrado por anillo');
  const pts = trozos[0].slice(1).split('L').map((p) => p.split(' ').map(Number));
  assert.equal(pts.length, 4, 'el repetido se salta');
  // El centro de la caja (200, 150) queda dentro del cuadrado.
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  assert.ok(Math.min(...xs) < 200 && Math.max(...xs) > 200 && Math.min(...ys) < 150 && Math.max(...ys) > 150, d);
  // Norte arriba: la latitud mayor tiene la y menor.
  assert.ok(pts[2][1] < pts[0][1]);
  assert.equal(rutaAnillos([], c.x, c.y, 14, 400, 300), '');
});
