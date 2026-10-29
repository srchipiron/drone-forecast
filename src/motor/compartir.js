// El texto que se comparte (WhatsApp, correo...): lo esencial de la
// previsión en pocas líneas, para quien no tiene la app.

import { fmtHora, fmtViento } from './unidades.js';

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
  if (url) l.push(url);
  return l.join('\n');
}
