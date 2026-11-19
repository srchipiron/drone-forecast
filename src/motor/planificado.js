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
export function crearPlan({ ms, horas, lugar, zona, estado = null, nota = '', ajustes = null }) {
  // ms es una hora de la previsión: tal cual (redondearla a la hora UTC
  // adelantaba 30 min los planes en husos de media hora).
  const inicio = ms;
  return {
    id: `${inicio}-${Math.round(lugar.lat * 1e4)}-${Math.round(lugar.lon * 1e4)}`,
    ms: inicio,
    horas: DURACIONES.includes(horas) ? horas : 1,
    lugar: { nombre: String(lugar.nombre ?? '').slice(0, 120), lat: lugar.lat, lon: lugar.lon },
    zona: String(zona ?? ''),
    estado: estado in RANGO ? estado : null,
    nota: String(nota).slice(0, 200),
    // El dron, la altura y la misión con que se planificó: el plan se juzga
    // siempre con ellos, aunque luego cambies de dron para otro trabajo.
    ajustes: ajustes && typeof ajustes === 'object' ? ajustesDelPlan(ajustes) : null,
  };
}

// Lo que decide el veredicto; sin «Mis drones» (no cuenta para un plan).
function ajustesDelPlan(a) {
  const { misDrones: _fuera, ...resto } = a;
  return JSON.parse(JSON.stringify(resto));
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

// ---------- Al calendario (.ics, RFC 5545) ----------

// Texto de una propiedad: \ ; , y saltos de línea van escapados.
const escIcs = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Las líneas de más de 75 octetos se doblan (CRLF + espacio). Se cuentan
// bytes de UTF-8, no letras: una «ñ» son dos, y un calendario estricto
// rechaza la línea si se pasa.
function doblar(linea) {
  const trozos = [];
  let actual = '';
  let bytes = 0;
  for (const c of linea) {
    const n = c.codePointAt(0) < 0x80 ? 1 : c.codePointAt(0) < 0x800 ? 2 : c.codePointAt(0) < 0x10000 ? 3 : 4;
    // La primera línea admite 75; las de continuación, 74 más el espacio.
    if (bytes + n > (trozos.length ? 74 : 75)) {
      trozos.push(actual);
      actual = '';
      bytes = 0;
    }
    actual += c;
    bytes += n;
  }
  trozos.push(actual);
  return trozos.join('\r\n ');
}

const fechaIcs = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * El plan como evento de calendario. Las horas van en UTC (sufijo Z): el
 * calendario las pone en la hora del móvil, sin líos de zonas.
 * @param {object} plan
 * @param {{estado?: string, motivos?: string[]}|null} val  valorarPlan() al exportarlo
 * @param {number} [ahora]
 */
export function icsPlan(plan, val = null, ahora = Date.now()) {
  const { lat, lon } = plan.lugar;
  const mapa = `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lon.toFixed(5)}#map=15/${lat.toFixed(5)}/${lon.toFixed(5)}`;
  const prevision =
    val && val.estado in NOMBRE_ESTADO
      ? `Previsión al exportarlo: ${NOMBRE_ESTADO[val.estado]}${val.motivos?.length ? ` (${val.motivos.join(', ').toLowerCase()})` : ''}.`
      : 'Previsión al exportarlo: aún no llega a ese día.';
  const descripcion = [plan.nota, prevision, 'Mírala otra vez en Drone Forecast antes de salir.', mapa].filter(Boolean).join('\n');
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Drone Forecast//Vuelo planificado//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${plan.id}@drone-forecast`,
    `DTSTAMP:${fechaIcs(ahora)}`,
    `DTSTART:${fechaIcs(plan.ms)}`,
    `DTEND:${fechaIcs(plan.ms + plan.horas * HORA)}`,
    `SUMMARY:${escIcs(`Vuelo con dron · ${plan.lugar.nombre || 'lugar planificado'}`)}`,
    `LOCATION:${escIcs(plan.lugar.nombre || `${lat.toFixed(5)}, ${lon.toFixed(5)}`)}`,
    `GEO:${lat.toFixed(6)};${lon.toFixed(6)}`,
    `DESCRIPTION:${escIcs(descripcion)}`,
    `URL:${mapa}`,
    // Un recordatorio la víspera: es cuando la previsión ya es fiable.
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escIcs('Mira la previsión del vuelo de mañana')}`,
    'TRIGGER:-PT18H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lineas.map(doblar).join('\r\n')}\r\n`;
}

// ---------- Huecos para un plan ----------

/**
 * Dónde cabe un vuelo de `horas` horas seguidas: el primer hueco de cada día
 * con todas sus horas en verde. Si en toda la previsión no hay ninguno
 * verde, los de ámbar (mejor eso que nada, y se dice).
 * @param {object} p  construirPrevision()
 * @param {number} horas
 * @param {number} [ahora]
 * @returns {Array<{ms: number, clave: string, estado: 'ok'|'precaucion'}>}  uno por día, en orden
 */
export function huecosPlan(p, horas, ahora = Date.now()) {
  const todas = p?.horas ?? [];
  const buscar = (vale) => {
    const salida = [];
    for (const dia of p?.dias ?? []) {
      const inicio = dia.horas.find((h) => {
        if (h.ms + HORA <= ahora) return false;
        const k = todas.indexOf(h);
        const tramo = todas.slice(k, k + horas);
        // Seguidas de verdad: sin huecos en la previsión entre una y otra.
        return tramo.length === horas && tramo.every((x, i) => vale(x.estado) && x.ms === h.ms + i * HORA);
      });
      if (inicio) salida.push({ ms: inicio.ms, clave: dia.clave });
    }
    return salida;
  };
  const verdes = buscar((e) => e === 'ok');
  if (verdes.length) return verdes.map((x) => ({ ...x, estado: 'ok' }));
  return buscar((e) => e === 'ok' || e === 'precaucion').map((x) => ({ ...x, estado: 'precaucion' }));
}

/**
 * Planes guardados antes de 0.29.1 no llevan sus ajustes y se juzgaban con
 * los del momento. Se les fijan los de ahora una vez (lo más parecido a los
 * de cuando se planificaron) para que dejen de cambiar con el dron puesto.
 * @returns {{planes: object[], cambiados: number}}
 */
export function fijarAjustesPlanes(planes, ajustes) {
  let cambiados = 0;
  const salida = (Array.isArray(planes) ? planes : []).map((p) => {
    if (!p || typeof p !== 'object' || (p.ajustes && typeof p.ajustes === 'object')) return p;
    cambiados++;
    return { ...p, ajustes: ajustesDelPlan(ajustes ?? {}) };
  });
  return { planes: salida, cambiados };
}
