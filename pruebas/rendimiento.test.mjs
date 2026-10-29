// Lo que cuesta en el móvil: crear formateadores de fecha (Intl) es caro, y
// construirPrevision hace cientos de cuentas de fechas. Se cuentan los que se
// crean en vez de medir milisegundos, que dependen de la máquina.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const Original = Intl.DateTimeFormat;
let creados = 0;
Intl.DateTimeFormat = function (...a) {
  creados++;
  return new Original(...a);
};
Intl.DateTimeFormat.prototype = Original.prototype;
Intl.DateTimeFormat.supportedLocalesOf = Original.supportedLocalesOf;

const { leerPrevision } = await import('../src/motor/meteo.js');
const { construirPrevision } = await import('../src/motor/prevision.js');
const { fmtHora } = await import('../src/motor/unidades.js');
const { AHORA, LUGAR, respuestaOpenMeteo } = await import('./fixtures/sinteticos.mjs');

test('rendimiento: una previsión de 7 días no crea un formateador de fechas por hora', () => {
  const meteo = leerPrevision(respuestaOpenMeteo());
  construirPrevision({ meteo, lugar: LUGAR, ajustes: {}, ahora: AHORA });
  creados = 0;
  construirPrevision({ meteo, lugar: LUGAR, ajustes: {}, ahora: AHORA });
  assert.ok(creados <= 2, `${creados} formateadores para ${meteo.horas.length} horas`);
});

test('rendimiento: fmtHora reutiliza su formateador, y una zona rara no rompe', () => {
  fmtHora(AHORA, 'Europe/Madrid');
  creados = 0;
  for (let i = 0; i < 100; i++) fmtHora(AHORA + i * 3600000, 'Europe/Madrid');
  assert.equal(creados, 0);
  assert.equal(fmtHora(AHORA, 'Europe/Madrid'), '10:30');
  assert.match(fmtHora(AHORA, 'Zona/Inventada'), /^\d\d:\d\d$/, 'la hora del móvil antes que un fallo');
  assert.equal(fmtHora(NaN, 'Europe/Madrid'), '—');
});
