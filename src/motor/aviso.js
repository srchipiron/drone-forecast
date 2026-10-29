// Aviso de ventana: qué favoritos tienen mañana una ventana VERDE y qué dice
// la notificación. Sale de construirPrevision con los mismos ajustes que la
// pantalla, así que avisa de lo mismo que luego enseña la app.

import { construirPrevision } from './prevision.js';
import { fmtHora } from './unidades.js';

/**
 * @param {Array<{lugar: {nombre: string, lat: number, lon: number}, meteo: object}>} lugares  leerPrevision() de cada favorito
 * @param {{ajustes: object, kp?: object[], satelites?: object[], ahora?: number}} ctx
 */
export function ventanasManana(lugares, { ajustes, kp = [], satelites = [], ahora = Date.now() }) {
  const salida = [];
  for (const { lugar, meteo } of lugares) {
    const v = construirPrevision({ meteo, kp, satelites, lugar, ajustes, ahora }).dias[1]?.ventana;
    // Solo verde: un aviso «con precaución» al día acabaría ignorándose.
    if (v?.estado === 'ok') salida.push({ nombre: String(lugar.nombre ?? ''), zona: meteo.zona, inicio: v.inicio, fin: v.fin, horas: v.horas });
  }
  // La ventana más larga primero: es la que más merece el viaje.
  return salida.sort((a, b) => b.horas - a.horas);
}

export function textoAviso(ventanas) {
  if (!ventanas.length) return null;
  return {
    titulo: ventanas.length === 1 ? `Mañana se puede volar en ${ventanas[0].nombre}` : `Mañana se puede volar en ${ventanas.length} favoritos`,
    cuerpo: ventanas.map((v) => `${v.nombre}: ${fmtHora(v.inicio, v.zona)}–${fmtHora(v.fin, v.zona)} (${v.horas} h)`).join(' · '),
  };
}
