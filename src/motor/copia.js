// Copia de seguridad de todo lo tuyo: un fichero JSON con ajustes, lugar,
// favoritos, diario, vuelos planificados, trabajos y preferencias. Sirve
// para cambiar de móvil o de dirección de la app (lo guardado en el
// navegador no viaja solo). Al leerla, cada parte pasa por su validación:
// un fichero roto o manipulado no mete nada raro.

import { diarioValido } from './diario.js';
import { MARGEN_DIARIO, planesValidos } from './planificado.js';
import { normalizarAjustes } from './prevision.js';
import { trabajosValidos } from './trabajos.js';

export const MARCA = 'drone-forecast-copia';
const PANTALLAS = ['auto', 'light', 'dark', 'sol'];

const lugarValido = (l) =>
  l && typeof l === 'object' && Number.isFinite(l.lat) && Number.isFinite(l.lon) && Math.abs(l.lat) <= 90 && Math.abs(l.lon) <= 180
    ? { nombre: String(l.nombre ?? '').slice(0, 120), zona: String(l.zona ?? '').slice(0, 120), lat: l.lat, lon: l.lon }
    : null;

/** Lo que se guarda en la copia, ya validado (lo que no vale, fuera). */
function validar(d, ahora) {
  return {
    ajustes: normalizarAjustes(d.ajustes && typeof d.ajustes === 'object' ? d.ajustes : {}),
    lugar: lugarValido(d.lugar),
    favoritos: (Array.isArray(d.favoritos) ? d.favoritos : []).map(lugarValido).filter(Boolean).slice(0, 50),
    diario: diarioValido(d.diario),
    planes: planesValidos(d.planes, ahora, MARGEN_DIARIO),
    trabajos: trabajosValidos(d.trabajos),
    pantalla: PANTALLAS.includes(d.pantalla) ? d.pantalla : 'auto',
    aviso: d.aviso === true,
  };
}

/** El fichero de la copia (texto JSON) a partir de lo guardado. */
export function crearCopia(datos, { version = '', ahora = Date.now() } = {}) {
  return JSON.stringify({ app: MARCA, version, creada: new Date(ahora).toISOString(), datos: validar(datos, ahora) }, null, 2);
}

/**
 * Lee el fichero de una copia.
 * @returns {{datos: object, resumen: string, creada: string} | {error: string}}
 */
export function leerCopia(texto, ahora = Date.now()) {
  let j;
  try {
    j = JSON.parse(texto);
  } catch {
    return { error: 'El fichero no es una copia de Drone Forecast (no es JSON).' };
  }
  if (!j || j.app !== MARCA || !j.datos || typeof j.datos !== 'object') return { error: 'El fichero no es una copia de Drone Forecast.' };
  const datos = validar(j.datos, ahora);
  const n = (x, uno, varios) => `${x} ${x === 1 ? uno : varios}`;
  const resumen = [
    n(datos.favoritos.length, 'favorito', 'favoritos'),
    n(datos.diario.length, 'vuelo en el diario', 'vuelos en el diario'),
    n(datos.planes.length, 'vuelo planificado', 'vuelos planificados'),
    n(datos.trabajos.length, 'trabajo', 'trabajos'),
  ].join(', ');
  return { datos, resumen, creada: typeof j.creada === 'string' ? j.creada.slice(0, 10) : '' };
}
