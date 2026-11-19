// Vuelos planificados: un día y unas horas en un lugar (el vuelo de un
// cliente). La app enseña cómo está la previsión de esas horas y el aviso
// en segundo plano avisa si empeora (de verde a ámbar o rojo, o de ámbar a
// rojo). El juicio de cada hora es el de construirPrevision: el mismo que
// enseña la pantalla.

import { fmtHora } from './unidades.js';

export const DURACIONES = [1, 2, 3, 4];
export const MAXIMO_PLANES = 20;
const HORA = 3600000;
const RANGO = { ok: 0, precaucion: 1, no: 2 };
export const NOMBRE_ESTADO = { ok: 'verde', precaucion: 'ámbar', no: 'rojo' };

/**
 * @param {{ms: number, horas: number, lugar: {nombre: string, lat: number, lon: number}, zona: string, estado?: string, nota?: string}} d
 *   ms: la primera hora (en punto); zona: la del lugar, para escribir la hora;
 *   estado: el de la previsión al planificarlo (la referencia para «empeora»).
 */
export function crearPlan({ ms, horas, lugar, zona, estado = null, nota = '' }) {
  const inicio = Math.floor(ms / HORA) * HORA;
  return {
    id: `${inicio}-${Math.round(lugar.lat * 1e4)}-${Math.round(lugar.lon * 1e4)}`,
    ms: inicio,
    horas: DURACIONES.includes(horas) ? horas : 1,
    lugar: { nombre: String(lugar.nombre ?? '').slice(0, 120), lat: lugar.lat, lon: lugar.lon },
    zona: String(zona ?? ''),
    estado: estado in RANGO ? estado : null,
    nota: String(nota).slice(0, 200),
  };
}

// Lo leído del almacenamiento son datos: fuera los rotos y los que ya pasaron.
export function planesValidos(lista, ahora = Date.now()) {
  if (!Array.isArray(lista)) return [];
  return lista
    .filter(
      (p) =>
        p &&
        typeof p.id === 'string' &&
        Number.isFinite(p.ms) &&
        DURACIONES.includes(p.horas) &&
        p.lugar &&
        Number.isFinite(p.lugar.lat) &&
        Number.isFinite(p.lugar.lon) &&
        p.ms + p.horas * HORA > ahora,
    )
    .sort((a, b) => a.ms - b.ms)
    .slice(0, MAXIMO_PLANES);
}

export function anadirPlan(lista, plan, ahora = Date.now()) {
  return planesValidos([plan, ...lista.filter((p) => p.id !== plan.id)], ahora);
}

/**
 * Cómo está la previsión de las horas del plan.
 * @param {object} plan
 * @param {object} p  construirPrevision() del lugar del plan
 * @returns {{estado: 'ok'|'precaucion'|'no'|'sin-prevision', cubiertas: number, motivos: string[]}}
 *   estado: el peor de sus horas; sin-prevision si la previsión aún no llega
 *   a ninguna (o no llega a todas: medio plan no se puede juzgar).
 */
export function valorarPlan(plan, p) {
  const fin = plan.ms + plan.horas * HORA;
  const horas = (p?.horas ?? []).filter((h) => h.ms >= plan.ms && h.ms < fin);
  if (horas.length < plan.horas) return { estado: 'sin-prevision', cubiertas: horas.length, motivos: [] };
  const peor = horas.reduce((e, h) => ((RANGO[h.estado] ?? 0) > RANGO[e] ? h.estado : e), 'ok');
  const motivos = peor === 'ok' ? [] : [...new Set(horas.flatMap((h) => h.factores.filter((f) => f.estado === peor).map((f) => f.nombre)))];
  return { estado: peor, cubiertas: horas.length, motivos };
}

/** ¿`ahora` es peor que `antes`? (lo que no se puede juzgar no empeora nada) */
export function empeora(antes, ahora) {
  return antes in RANGO && ahora in RANGO && RANGO[ahora] > RANGO[antes];
}

/** «jue 20, 10:00–12:00» en la zona del lugar. */
export function cuandoPlan(plan) {
  const zona = plan.zona || undefined;
  const dia = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: zona })
    .format(new Date(plan.ms))
    .replace(/,/g, ''); // «lun, 22 jun» → «lun 22 jun»
  return `${dia}, ${fmtHora(plan.ms, zona)}–${fmtHora(plan.ms + plan.horas * HORA, zona)}`;
}

/** La notificación de un plan que ha empeorado. */
export function textoEmpeora(plan, antes, val) {
  return {
    titulo: `Empeora tu vuelo en ${plan.lugar.nombre || 'el lugar planificado'}`,
    cuerpo: `${cuandoPlan(plan)}: de ${NOMBRE_ESTADO[antes]} a ${NOMBRE_ESTADO[val.estado]}${val.motivos.length ? ` (${val.motivos.join(', ').toLowerCase()})` : ''}.`,
  };
}
