import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NIVELES_HPA, capasNubes, luzNubes, urlWindyNubes, capasDeNubes, celdasEnHora, leerNubesAltura, leerNubesRejilla, rejillaNubes, textoCapas, urlNubesAltura, urlNubesRejilla } from '../src/motor/nubes.js';
import { leerPrevision } from '../src/motor/meteo.js';
import { respuestaOpenMeteo } from './fixtures/sinteticos.mjs';

test('luz de las nubes: de encapotado bajo a despejado, por capas', () => {
  const l = (b, m, a) => luzNubes({ nubesBajas: b, nubesMedias: m, nubesAltas: a })?.id;
  assert.equal(l(85, 0, 0), 'cubierto');
  assert.equal(l(40, 0, 0), 'ratos');
  assert.equal(l(10, 70, 0), 'medias');
  assert.equal(l(5, 10, 80), 'altas', 'cirros: el sol pasa');
  assert.equal(l(0, 0, 10), 'despejado');
  assert.equal(l(85, 90, 90), 'cubierto', 'las bajas mandan: tapan todo lo demás');
  assert.equal(luzNubes({}), null, 'sin datos, nada');
  assert.match(luzNubes({ nubesBajas: 85 }).texto, /fotogrametría/);
});

test('capas: se leen de Open-Meteo y se redondean; sin datos no hay franja', () => {
  const r = respuestaOpenMeteo();
  r.hourly.cloud_cover_low = r.hourly.time.map(() => 12.4);
  r.hourly.cloud_cover_mid = r.hourly.time.map(() => 50);
  r.hourly.cloud_cover_high = r.hourly.time.map(() => 88.6);
  const horas = leerPrevision(r).horas.slice(0, 24);
  const c = capasNubes(horas);
  assert.equal(c.hay, true);
  assert.deepEqual(c.horas[0], { ms: horas[0].ms, bajas: 12, medias: 50, altas: 89 });
  assert.equal(capasNubes(leerPrevision(respuestaOpenMeteo()).horas).hay, false);
});

test('Windy: el mapa de nubes en el punto', () => {
  assert.equal(urlWindyNubes(40.41679, -3.70379), 'https://www.windy.com/?clouds,40.417,-3.704,9');
});


// Una respuesta de niveles con la forma de Open-Meteo: terreno a 600 m.
function niveles(coberturas, alturas = [110, 320, 540, 590, 990, 1460, 1950, 3010, 4200, 5570, 7180, 9160]) {
  const hourly = { time: [1782115200] };
  NIVELES_HPA.forEach((p, i) => {
    hourly[`cloud_cover_${p}hPa`] = [coberturas[i]];
    hourly[`geopotential_height_${p}hPa`] = [alturas[i]];
  });
  return { elevation: 600, hourly };
}

test('nubes por altura: se piden los 12 niveles con su altura y se quitan los que quedan bajo tierra', () => {
  const u = new URL(urlNubesAltura(40.3, -3.7));
  assert.equal(u.searchParams.get('hourly').split(',').length, 24);
  assert.match(u.searchParams.get('hourly'), /cloud_cover_850hPa,geopotential_height_850hPa/);
  const [h] = leerNubesAltura(niveles([0, 0, 0, 0, 0, 90, 95, 20, 0, 40, 60, 10]));
  assert.equal(h.capas[0].hpa, 900, 'con el terreno a 600 m, 1000-925 hPa están bajo tierra');
  assert.deepEqual(h.capas[0], { hpa: 900, altura: 390, cobertura: 0 }, 'altura sobre el suelo');
  assert.throws(() => leerNubesAltura({}), /no trae horas/);
});

test('capas: tramos seguidos con base, tope y densidad; dice si tu altura cae dentro', () => {
  const [h] = leerNubesAltura(niveles([0, 0, 0, 0, 0, 90, 95, 20, 0, 40, 60, 10]));
  const cs = capasDeNubes(h.capas);
  assert.equal(cs.length, 2);
  assert.equal(cs[0].densidad, 95);
  // 900 hPa a 390 m, 850 a 860 y 800 a 1350: la capa va de entre 900 y 850 hPa a entre 800 y 700.
  assert.deepEqual([cs[0].base, cs[0].tope], [625, 1880]);
  assert.equal(cs[1].densidad, 60);
  assert.match(textoCapas(h.capas, 120), /^Capa densa de 650 m a 1,9 km · capa compacta de 4,3 km a 7,6 km$/);
  assert.doesNotMatch(textoCapas(h.capas, 120), /DENTRO/);
  // Nube pegada al suelo (niebla alta, 900 hPa a 390 m): tu altura de 120 m cae dentro.
  const [baja] = leerNubesAltura(niveles([0, 0, 0, 0, 85, 80, 0, 0, 0, 0, 0, 0]));
  assert.match(textoCapas(baja.capas, 120), /tu altura \(120 m\) queda DENTRO de una capa/);
  assert.equal(textoCapas(leerNubesAltura(niveles(Array(12).fill(5)))[0].capas, 120), 'Sin capas de nubes');
});

test('mapa de nubes: rejilla que cubre la caja, una sola petición y celdas a una hora', () => {
  const caja = { oeste: -4, este: -3, sur: 40, norte: 41 };
  const ps = rejillaNubes(caja, 2);
  assert.equal(ps.length, 4);
  assert.deepEqual([ps[0].lat, ps[0].lon, ps[0].oeste, ps[0].este], [40.25, -3.75, -4, -3.5]);
  const u = new URL(urlNubesRejilla(ps));
  assert.equal(u.searchParams.get('latitude'), '40.250,40.250,40.750,40.750');
  assert.equal(u.searchParams.get('hourly'), 'cloud_cover_low,cloud_cover_mid,cloud_cover_high');
  const respuesta = ps.map((_, i) => ({ hourly: { time: [0, 3600], cloud_cover_low: [i * 10, 99], cloud_cover_mid: [1, 2], cloud_cover_high: [null, 5] } }));
  const celdas = leerNubesRejilla(respuesta, ps);
  assert.deepEqual(celdasEnHora(celdas, 'bajas', 1000).map((c) => c.cobertura), [0, 10, 20, 30]);
  assert.deepEqual(celdasEnHora(celdas, 'altas', 0).map((c) => c.cobertura), [null, null, null, null]);
  assert.deepEqual(celdasEnHora(celdas, 'bajas', 999999999).map((c) => c.cobertura), [null, null, null, null], 'fuera de la previsión');
  assert.throws(() => leerNubesRejilla(respuesta.slice(1), ps), /no cuadra/);
});
