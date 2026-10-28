import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerPrevision } from '../src/motor/meteo.js';
import { construirPrevision, normalizarAjustes, resumenDias } from '../src/motor/prevision.js';
import { mejorVentana } from '../src/motor/ventanas.js';
import { AHORA, LUGAR, constelacionSintetica, respuestaOpenMeteo } from './fixtures/sinteticos.mjs';

const sats = [...constelacionSintetica(AHORA, 'GPS'), ...constelacionSintetica(AHORA, 'Galileo', 3, 8)];
const kp = [{ desde: AHORA - 3600000, kp: 2, observado: true }];

function prev(opciones = {}, ajustes = {}, extra = {}) {
  return construirPrevision({ meteo: leerPrevision(respuestaOpenMeteo(opciones)), kp, satelites: sats, lugar: LUGAR, ajustes, ahora: AHORA, ...extra });
}
const f = (hora, id) => hora.factores.find((x) => x.id === id);

test('día tranquilo de junio a las 10:30: verde y con la hora en curso localizada', () => {
  const p = prev();
  assert.equal(p.actual.ms, Date.parse('2026-06-21T08:00:00Z'));
  assert.equal(p.actual.estado, 'ok', JSON.stringify(p.actual.factores.filter((x) => x.estado !== 'ok' && x.estado !== 'sin-dato')));
  assert.equal(f(p.actual, 'kp').estado, 'ok');
  assert.ok(p.actual.sats.total >= 8);
});

test('los días se parten en hora local y la ventana de hoy no empieza en el pasado', () => {
  const p = prev();
  assert.equal(p.dias[0].clave, '2026-06-21');
  assert.equal(p.dias[0].horas.length, 24);
  assert.ok(p.dias[0].ventana.inicio >= Date.parse('2026-06-21T08:00:00Z'));
  assert.equal(p.dias.length, 7);
});

test('de noche no se vuela salvo que se permita (y entonces es precaución)', () => {
  const noche = (p) => p.horas.find((h) => h.ms === Date.parse('2026-06-21T23:00:00Z'));
  assert.equal(f(noche(prev()), 'luz').estado, 'no');
  assert.equal(f(noche(prev({}, { permitirNoche: true })), 'luz').estado, 'precaucion');
});

test('el viento en altura decide con el límite del dron', () => {
  // 10 m: 6 m/s → 120 m: 8,4 m/s. Mini 5 Pro (12): 70% = 8,4 → justo ok; Flip (10,7): 7,5 → precaución.
  // ANAFI UKR (15): ok. A 8 m/s → 11,2 m/s: Flip no; Mini 5 Pro precaución.
  assert.equal(f(prev({ viento: 6, racha: 6 }, { dron: 'flip' }).actual, 'viento').estado, 'precaucion');
  assert.equal(f(prev({ viento: 6, racha: 6 }, { dron: 'anafiukr' }).actual, 'viento').estado, 'ok');
  assert.equal(f(prev({ viento: 8, racha: 8 }, { dron: 'flip' }).actual, 'viento').estado, 'no');
  assert.equal(f(prev({ viento: 8, racha: 8 }, { dron: 'mini5pro' }).actual, 'viento').estado, 'precaucion');
});

test('más altitud, más viento', () => {
  const bajo = prev({ viento: 5 }, { altitud: 30 }).actual.vientoAlt;
  const alto = prev({ viento: 5 }, { altitud: 120 }).actual.vientoAlt;
  assert.ok(alto > bajo);
});

test('lluvia: un dron IP55 pasa a precaución donde un Mini no vuela', () => {
  assert.equal(f(prev({ lluvia: 1, prob: 90 }).actual, 'lluvia').estado, 'no');
  assert.equal(f(prev({ lluvia: 1, prob: 90 }, { dron: 'm400' }).actual, 'lluvia').estado, 'precaucion');
});

test('Kp alto bloquea; sin dato de Kp no bloquea', () => {
  const p = construirPrevision({ meteo: leerPrevision(respuestaOpenMeteo()), kp: [{ desde: AHORA - 3600000, kp: 7 }], satelites: sats, lugar: LUGAR, ajustes: {}, ahora: AHORA });
  assert.equal(f(p.actual, 'kp').estado, 'no');
  const sin = construirPrevision({ meteo: leerPrevision(respuestaOpenMeteo()), satelites: sats, lugar: LUGAR, ajustes: {}, ahora: AHORA });
  assert.equal(f(sin.actual, 'kp').estado, 'sin-dato');
  assert.equal(sin.actual.estado, 'ok');
});

test('órbitas de hace más de 30 días no se usan', () => {
  const p = construirPrevision({ meteo: leerPrevision(respuestaOpenMeteo()), satelites: constelacionSintetica(AHORA - 40 * 86400000), lugar: LUGAR, ajustes: {}, ahora: AHORA });
  assert.equal(p.satelitesDisponibles, false);
  assert.equal(f(p.actual, 'satelites').estado, 'sin-dato');
});

test('modo recreativo ignora una misión profesional guardada', () => {
  const a = normalizarAjustes({ modo: 'recreativo', mision: 'termografia_fv' });
  assert.equal(a.mision, 'recreativo');
  const b = normalizarAjustes({ modo: 'profesional', mision: 'recreativo' });
  assert.equal(b.mision, 'general');
});

test('termografía FV: con poca irradiancia no vale aunque se pueda volar', () => {
  const pro = { modo: 'profesional', mision: 'termografia_fv' };
  assert.equal(f(prev({ radiacion: 700 }, pro).actual, 'irradiancia').estado, 'ok');
  const malo = prev({ radiacion: 300 }, pro).actual;
  assert.equal(f(malo, 'irradiancia').estado, 'no');
  assert.equal(malo.estado, 'no');
  // En recreativo la irradiancia ni se mira.
  assert.equal(f(prev({ radiacion: 300 }).actual, 'irradiancia'), undefined);
});

test('termografía de edificios: de noche y con frío es su momento', () => {
  const pro = { modo: 'profesional', mision: 'termografia_edificios' };
  const p = prev({ temp: 5, td: 0 }, pro);
  const madrugada = p.horas.find((h) => h.ms === Date.parse('2026-06-22T02:00:00Z'));
  assert.equal(f(madrugada, 'delta-t').estado, 'ok');
  assert.equal(f(madrugada, 'sol-fachada').estado, 'ok');
  assert.equal(f(madrugada, 'luz').estado, 'precaucion');
  assert.equal(f(p.actual, 'sol-fachada').estado, 'no');
});

test('fotogrametría: sol bajo es precaución o no; cubierto uniforme vale', () => {
  const pro = { modo: 'profesional', mision: 'fotogrametria' };
  const p = prev({}, pro);
  const temprano = p.horas.find((h) => h.ms === Date.parse('2026-06-21T05:00:00Z')); // 07:00
  assert.notEqual(f(temprano, 'luz-foto').estado, 'ok');
  const cub = prev({ nubes: 95 }, pro).horas.find((h) => h.ms === Date.parse('2026-06-21T05:00:00Z'));
  assert.equal(f(cub, 'luz-foto').estado, 'ok');
});

test('consenso: modelos que discrepan dejan en precaución', () => {
  const consenso = new Map([[Date.parse('2026-06-21T08:00:00Z'), { dispersion: 6, modelos: 4 }]]);
  const p = prev({}, {}, { consenso });
  assert.equal(f(p.actual, 'consenso').estado, 'precaucion');
});

test('mejor ventana: el tramo verde más largo; si no hay verde, el ámbar', () => {
  const H = 3600000;
  const hs = ['no', 'ok', 'ok', 'no', 'ok', 'ok', 'ok', 'precaucion'].map((estado, k) => ({ ms: k * H, estado }));
  assert.deepEqual(mejorVentana(hs), { inicio: 4 * H, fin: 7 * H, horas: 3, estado: 'ok' });
  const amb = ['no', 'precaucion', 'precaucion', 'no'].map((estado, k) => ({ ms: k * H, estado }));
  assert.equal(mejorVentana(amb).estado, 'precaucion');
  assert.equal(mejorVentana([{ ms: 0, estado: 'no' }]), null);
});

test('ajustes absurdos se acotan', () => {
  const a = normalizarAjustes({ altitud: 9999, margenViento: 'x', modo: 'hacker' });
  assert.equal(a.altitud, 500);
  assert.equal(a.margenViento, 70);
  assert.equal(a.modo, 'recreativo');
});

test('resumen de un favorito: hoy y mañana con su ventana, desde la misma previsión', () => {
  const p = prev();
  const r = resumenDias(p);
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((d) => d.clave), ['2026-06-21', '2026-06-22']);
  assert.deepEqual(r[0].ventana, p.dias[0].ventana);
  assert.deepEqual(r[1].ventana, p.dias[1].ventana);
  assert.equal(resumenDias(p, 1).length, 1);
});

test('el perfil y el semáforo usan los mismos umbrales de viento', async () => {
  const { umbralesViento } = await import('../src/motor/veredicto.js');
  const p = prev({}, { dron: 'mini5pro', margenViento: 70 });
  assert.deepEqual(umbralesViento(p), { comodo: 12 * 0.7, limite: 12 });
  const foto = prev({}, { modo: 'profesional', mision: 'fotogrametria', dron: 'mini5pro' });
  assert.deepEqual(umbralesViento(foto), { comodo: 6, limite: 12 }, 'la fotogrametría usa el 50%');
  assert.match(foto.actual.factores.find((f) => f.id === 'viento').detalle, /Cómodo hasta 22 km\/h/);
});
