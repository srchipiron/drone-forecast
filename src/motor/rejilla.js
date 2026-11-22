// El mapa de «dónde se puede volar»: el semáforo de cada celda de una
// rejilla sobre el mapa, con tu dron, tu altura y tus límites. Cada celda
// pasa por construirPrevision como el punto de la pantalla: el mismo juicio.
//
// Lo que no cambia de un sitio a otro a esta escala (unos 30 km) no se pide
// por celda: los satélites (sin órbitas aquí el factor queda «sin dato» y
// no decide) y el Kp (el mismo para todos).

import { VARIABLES, leerPrevision } from './meteo.js';
import { construirPrevision } from './prevision.js';

const BASE = 'https://api.open-meteo.com/v1/forecast';

/** Una petición con el tiempo de todos los puntos (dos días bastan). */
export function urlRejillaTiempo(puntos) {
  const lat = puntos.map((p) => p.lat.toFixed(3)).join(',');
  const lon = puntos.map((p) => p.lon.toFixed(3)).join(',');
  return `${BASE}?latitude=${lat}&longitude=${lon}&hourly=${VARIABLES.join(',')}&wind_speed_unit=ms&timezone=auto&timeformat=unixtime&forecast_days=2`;
}

/**
 * La respuesta (una por punto, en orden) → por celda, el estado de cada hora
 * y, de cada hora que no es verde, el porqué (los factores que la ponen así).
 * Un punto con una respuesta rota se queda sin horas (no se inventa nada).
 */
export function veredictosRejilla(json, puntos, { ajustes, kp = [], ahora = Date.now() }) {
  const lista = Array.isArray(json) ? json : [json];
  if (lista.length !== puntos.length) throw new Error('La rejilla del tiempo no cuadra con los puntos pedidos');
  return lista.map((r, i) => {
    const p = puntos[i];
    try {
      const prev = construirPrevision({ meteo: leerPrevision(r), kp, satelites: [], lugar: { lat: p.lat, lon: p.lon }, ajustes, ahora });
      return {
        oeste: p.oeste, este: p.este, sur: p.sur, norte: p.norte, lat: p.lat, lon: p.lon,
        horas: prev.horas.map((h) => ({
          ms: h.ms,
          estado: h.estado,
          motivos: h.estado === 'ok' ? [] : h.factores.filter((f) => f.estado === h.estado).map((f) => f.nombre),
        })),
      };
    } catch {
      return { oeste: p.oeste, este: p.este, sur: p.sur, norte: p.norte, lat: p.lat, lon: p.lon, horas: [] };
    }
  });
}

/** El estado de cada celda a la hora ms (null si esa hora no está). */
export function celdasVeredicto(celdas, ms) {
  return celdas.map((c) => {
    const h = c.horas.find((x) => ms >= x.ms && ms < x.ms + 3600000);
    return { oeste: c.oeste, este: c.este, sur: c.sur, norte: c.norte, lat: c.lat, lon: c.lon, estado: h?.estado ?? null, motivos: h?.motivos ?? [] };
  });
}

/** Resumen: cuántas celdas en verde, ámbar y rojo, y el porqué más repetido del rojo. */
export function resumenVeredictos(celdas) {
  const cuenta = { ok: 0, precaucion: 0, no: 0 };
  const porque = new Map();
  for (const c of celdas) {
    if (!(c.estado in cuenta)) continue;
    cuenta[c.estado]++;
    if (c.estado === 'no') for (const m of c.motivos) porque.set(m, (porque.get(m) ?? 0) + 1);
  }
  const masRojo = [...porque.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { ...cuenta, masRojo };
}
