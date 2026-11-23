// Todo lo que viene de la red. Lo que llega de fuera son datos: se valida al
// leerlo (src/motor/*) y nunca se mete en la página sin escapar.

import { CAPAS, leerFormas, leerZonas, resumenZonas, urlConsultaEnaire, urlFormasEnaire } from '../motor/enaire.js';
import { URL_KP, leerKp } from '../motor/kp.js';
import { leerNubesAltura, leerNubesRejilla, rejillaNubes, urlNubesAltura, urlNubesRejilla } from '../motor/nubes.js';
import { urlRejillaTiempo, veredictosRejilla } from '../motor/rejilla.js';
import { leerBusqueda, leerConsenso, leerPrevision, urlBusqueda, urlConsenso, urlPrevision, urlPrevisionVarios } from '../motor/meteo.js';
import { antiguedadDias, desdeOMM, satValido } from '../motor/satelites.js';
import { almacen } from './almacen.js';

// signal: para cancelar desde fuera (el mapa cancela lo que ya no se mira).
async function pedir(url, ms = 15000, signal = null) {
  const tiempo = AbortSignal.timeout(ms);
  const r = await fetch(url, { signal: signal && AbortSignal.any ? AbortSignal.any([tiempo, signal]) : tiempo });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function cargarPrevision(lat, lon) {
  const [base, consenso] = await Promise.allSettled([pedir(urlPrevision(lat, lon)), pedir(urlConsenso(lat, lon))]);
  if (base.status === 'rejected') throw base.reason;
  return { meteo: base.value, consenso: consenso.status === 'fulfilled' ? consenso.value : null };
}

// Solo la previsión, sin el consenso entre modelos: para el resumen de los
// favoritos basta y es la mitad de peticiones.
export async function cargarSoloPrevision(lat, lon) {
  return leerPrevision(await pedir(urlPrevision(lat, lon)));
}

// El historial de cambios (va en la precarga: se lee también sin conexión).
export async function cargarNovedades() {
  const r = await fetch('CHANGELOG.md', { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

// La previsión de varios puntos (una traza, varios sitios) en una petición.
export async function cargarPrevisionVarios(puntos) {
  if (puntos.length === 1) return [await cargarSoloPrevision(puntos[0].lat, puntos[0].lon)];
  const json = await pedir(urlPrevisionVarios(puntos), 25000);
  const lista = Array.isArray(json) ? json : [json];
  if (lista.length !== puntos.length) throw new Error('La previsión no cuadra con los puntos pedidos');
  return lista.map((r) => leerPrevision(r));
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
    // Si CelesTrak lleva días bloqueando al despliegue, lo publicado envejece:
    // con más de 3 días se piden al móvil, que sí llega.
    if (satelites.length && antiguedadDias(satelites, Date.now()) < 3)
      return { satelites, actualizado: j.actualizado ?? null, origen: 'despliegue' };
  } catch {
    /* siguiente fuente */
  }
  const guardadas = almacen.orbitas();
  const validas = guardadas ? (guardadas.satelites ?? []).filter(satValido) : [];
  const deGuardadas = () => ({
    satelites: validas,
    actualizado: Number.isFinite(guardadas.guardado) ? new Date(guardadas.guardado).toISOString() : null,
    origen: 'guardadas',
  });
  if (validas.length && Number.isFinite(guardadas.guardado) && Date.now() - guardadas.guardado < DOCE_HORAS) return deGuardadas();
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

// Zonas UAS de ENAIRE en el punto, capa a capa. Una capa que falla queda
// como fallida: resumenZonas no dirá «fuera de zonas» con un hueco.
export async function consultarEnaire(lat, lon) {
  const resultados = await Promise.all(
    CAPAS.map(async (c) => {
      try {
        return { capa: c.nombre, ok: true, zonas: leerZonas(await pedir(urlConsultaEnaire(c.id, lat, lon), 15000), c.nombre) };
      } catch (e) {
        return { capa: c.nombre, ok: false, motivo: e.message };
      }
    }),
  );
  return { ...resumenZonas(resultados), motivos: resultados.filter((r) => !r.ok).map((r) => `${r.capa}: ${r.motivo}`) };
}

// Las formas de las zonas que tocan un rectángulo, para el mapa. Igual que
// arriba: una capa que falla no tumba las demás, pero se dice cuál faltó.
// ArcGIS corta en resultRecordCount y lo dice con exceededTransferLimit:
// esa capa está «cortada» (faltan zonas), no completa.
export async function cargarFormasEnaire(caja, simplificar, signal = null) {
  const resultados = await Promise.all(
    CAPAS.map(async (c) => {
      try {
        const json = await pedir(urlFormasEnaire(c.id, caja, simplificar), 20000, signal);
        return { capa: c.nombre, ok: true, zonas: leerFormas(json, c.nombre), cortada: json?.exceededTransferLimit === true };
      } catch {
        return { capa: c.nombre, ok: false };
      }
    }),
  );
  const fallidas = resultados.filter((r) => !r.ok).map((r) => r.capa);
  const cortadas = resultados.filter((r) => r.ok && r.cortada).map((r) => r.capa);
  return { zonas: resultados.filter((r) => r.ok).flatMap((r) => r.zonas), fallidas, cortadas, error: fallidas.length === CAPAS.length };
}

// Nubes por altura del punto (se pide al abrir esa sección).
export async function cargarNubesAltura(lat, lon) {
  return leerNubesAltura(await pedir(urlNubesAltura(lat, lon), 20000));
}

// La rejilla de nubes para el mapa: una petición para los 49 puntos.
export async function cargarNubesRejilla(caja, signal = null) {
  const puntos = rejillaNubes(caja, 7);
  return leerNubesRejilla(await pedir(urlNubesRejilla(puntos), 20000, signal), puntos);
}

// El mapa de «dónde se puede volar»: el tiempo de los 49 puntos, juzgado con
// tus ajustes (una petición).
export async function cargarRejillaVuelo(caja, { ajustes, kp }) {
  const puntos = rejillaNubes(caja, 7);
  return veredictosRejilla(await pedir(urlRejillaTiempo(puntos), 25000), puntos, { ajustes, kp });
}
