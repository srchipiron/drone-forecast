// El texto que se comparte (WhatsApp, correo...): lo esencial de la
// previsión en pocas líneas, para quien no tiene la app.

import { fmtHora, fmtViento } from './unidades.js';

const SIMBOLO = { ok: '✓', precaucion: '!', no: '✕', 'sin-dato': '–' };

// «sáb 31» de una clave AAAA-MM-DD (a mediodía UTC: el día no se mueve por la zona).
const diaCorto = (clave) => new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${clave}T12:00:00Z`));

const VEREDICTO = { ok: 'Se puede volar', precaucion: 'Con precaución', no: 'No volar', 'sin-dato': 'Sin datos' };

function ventana(d, zona) {
  const v = d?.ventana;
  if (!v) return 'sin ventana';
  return `${fmtHora(v.inicio, zona)}–${fmtHora(v.fin, zona)}${v.estado === 'precaucion' ? ' (con precaución)' : ''}`;
}

/**
 * @param {object} p  construirPrevision()
 * @param {{nombre: string}} lugar
 * @param {string} [url]  dirección de la app, al final
 */
export function textoCompartir(p, lugar, url = '') {
  const u = p.ajustes.unidades;
  const h = p.actual;
  const l = [`🚁 ${lugar.nombre} · ${p.dron.nombre} a ${p.ajustes.altitud} m`];
  if (h) {
    const malos = h.factores.filter((f) => f.estado === h.estado && h.estado !== 'ok').map((f) => `${f.nombre.toLowerCase()} ${f.valor}`);
    l.push(`Ahora (${fmtHora(h.ms, p.zona)}): ${VEREDICTO[h.estado]}${malos.length ? ` — ${malos.join(', ')}` : ''}`);
    l.push(`Viento ${fmtViento(h.vientoAlt, u)}, rachas ${fmtViento(h.rachaAlt, u)}`);
  }
  l.push(`Mejor ventana hoy: ${ventana(p.dias[0], p.zona)}`);
  if (p.dias[1]) l.push(`Mañana: ${ventana(p.dias[1], p.zona)}`);
  // Si ni hoy ni mañana hay verde, cuándo es la primera (o que no la hay en toda la previsión).
  const x = p.proxima;
  if (!x) l.push(`Sin ventana en los próximos ${p.dias.length} días`);
  else if (x.k > 1) l.push(`Próxima ventana: ${diaCorto(x.clave)} ${ventana(p.dias[x.k], p.zona)}`);
  if (p.otrosDrones?.length) l.push(`Otros drones ahora: ${p.otrosDrones.map((d) => `${d.nombre} ${SIMBOLO[d.estado]}`).join(', ')}`);
  if (url) l.push(url);
  return l.join('\n');
}
