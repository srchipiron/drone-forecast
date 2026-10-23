// Todo lo que viene de la red. Lo que llega de fuera son datos: se valida al
// leerlo (src/motor/*) y nunca se mete en la página sin escapar.

import { URL_KP, leerKp } from '../motor/kp.js';
import { leerBusqueda, leerConsenso, leerPrevision, urlBusqueda, urlConsenso, urlPrevision } from '../motor/meteo.js';
import { satValido } from '../motor/satelites.js';

async function pedir(url, ms = 15000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function cargarPrevision(lat, lon) {
  const [base, consenso] = await Promise.allSettled([pedir(urlPrevision(lat, lon)), pedir(urlConsenso(lat, lon))]);
  if (base.status === 'rejected') throw base.reason;
  return { meteo: base.value, consenso: consenso.status === 'fulfilled' ? consenso.value : null };
}

export function leerDescarga({ meteo, consenso }) {
  return { meteo: leerPrevision(meteo), consenso: consenso ? leerConsenso(consenso) : new Map() };
}

// Kp: primero NOAA directo (lo más fresco); si no deja, la copia del despliegue.
export async function cargarKp() {
  for (const url of [URL_KP, 'data/kp.json']) {
    try {
      const t = leerKp(await pedir(url, 10000));
      if (t.length) return t;
    } catch {
      /* siguiente fuente */
    }
  }
  return [];
}

export async function cargarSatelites() {
  try {
    const j = await pedir('data/gnss.json', 15000);
    return { satelites: (j.satelites ?? []).filter(satValido), actualizado: j.actualizado ?? null };
  } catch {
    return { satelites: [], actualizado: null };
  }
}

export async function buscarLugar(texto) {
  return leerBusqueda(await pedir(urlBusqueda(texto), 10000));
}
