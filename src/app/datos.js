// Todo lo que viene de la red. Lo que llega de fuera son datos: se valida al
// leerlo (src/motor/*) y nunca se mete en la página sin escapar.

import { URL_KP, leerKp } from '../motor/kp.js';
import { leerBusqueda, leerConsenso, leerPrevision, urlBusqueda, urlConsenso, urlPrevision } from '../motor/meteo.js';
import { desdeOMM, satValido } from '../motor/satelites.js';
import { almacen } from './almacen.js';

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

const GRUPOS = { GPS: 'gps-ops', Galileo: 'galileo', GLONASS: 'glo-ops', BeiDou: 'beidou' };
const CELESTRAK = 'https://celestrak.org/NORAD/elements/gp.php';
const DOCE_HORAS = 12 * 3600000;

// Órbitas, por orden: las del despliegue; las guardadas en el móvil si tienen
// menos de 12 h; CelesTrak directo desde el móvil (CelesTrak no deja entrar a
// los servidores de GitHub, y pide no repetir descargas: por eso se guardan);
// y, si todo falla, las guardadas aunque sean viejas (el motor descarta las de
// más de 30 días).
export async function cargarSatelites() {
  try {
    const j = await pedir('data/gnss.json', 15000);
    const satelites = (j.satelites ?? []).filter(satValido);
    if (satelites.length) return { satelites, actualizado: j.actualizado ?? null, origen: 'despliegue' };
  } catch {
    /* siguiente fuente */
  }
  const guardadas = almacen.orbitas();
  const validas = guardadas ? (guardadas.satelites ?? []).filter(satValido) : [];
  const deGuardadas = () => ({ satelites: validas, actualizado: new Date(guardadas.guardado).toISOString(), origen: 'guardadas' });
  if (validas.length && Date.now() - guardadas.guardado < DOCE_HORAS) return deGuardadas();
  const satelites = [];
  for (const [constelacion, grupo] of Object.entries(GRUPOS)) {
    try {
      const lista = await pedir(`${CELESTRAK}?GROUP=${grupo}&FORMAT=json`, 15000);
      if (Array.isArray(lista)) satelites.push(...lista.map((o) => desdeOMM(o, constelacion)).filter(satValido));
    } catch {
      /* esa constelación se queda fuera */
    }
  }
  if (satelites.length) {
    const guardado = Date.now();
    almacen.guardarOrbitas({ guardado, satelites });
    return { satelites, actualizado: new Date(guardado).toISOString(), origen: 'celestrak' };
  }
  if (validas.length) return deGuardadas();
  return { satelites: [], actualizado: null, origen: null };
}

export async function buscarLugar(texto) {
  return leerBusqueda(await pedir(urlBusqueda(texto), 10000));
}
