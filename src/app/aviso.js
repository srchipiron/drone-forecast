// Aviso de ventana: lo corre el instalador (sw-modulo.js) cuando el navegador
// le da permiso para despertar en segundo plano (Periodic Background Sync), y
// la página con «Probar ahora». Sin window ni almacenamiento propio: lo que necesita
// está en almacen.configAviso().

import { textoAviso, ventanasManana } from '../motor/aviso.js';
import { almacen } from './almacen.js';
import { cargarKp, cargarSatelites, cargarSoloPrevision } from './datos.js';

export const ETIQUETA = 'aviso-ventana';
// Lo mínimo que acepta Chrome; luego despierta cuando él decide (suele ser 1-2 veces al día).
export const INTERVALO = 12 * 3600000;

const hoy = (ahora) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ahora));

/**
 * Mira los favoritos y, si mañana alguno tiene ventana verde, notifica. Una
 * vez al día como mucho, salvo al probarlo a mano (forzar).
 * @returns {Promise<{estado: string, ventanas?: object[]}>}
 */
export async function comprobarAvisos(registro, { forzar = false, ahora = Date.now() } = {}) {
  const cfg = await almacen.configAviso();
  if (!cfg || (!cfg.activo && !forzar)) return { estado: 'apagado' };
  const favoritos = Array.isArray(cfg.favoritos) ? cfg.favoritos.filter((l) => Number.isFinite(l?.lat) && Number.isFinite(l?.lon)) : [];
  if (!favoritos.length) return { estado: 'sin-favoritos' };
  if (!forzar && cfg.ultimo === hoy(ahora)) return { estado: 'ya-avisado' };
  const [kp, gnss, lugares] = await Promise.all([
    cargarKp(),
    cargarSatelites(),
    Promise.all(
      favoritos.map(async (lugar) => {
        try {
          return { lugar, meteo: await cargarSoloPrevision(lugar.lat, lugar.lon) };
        } catch {
          return null; // un favorito sin previsión no tapa a los demás
        }
      }),
    ),
  ]);
  const validos = lugares.filter(Boolean);
  if (!validos.length) return { estado: 'sin-datos' };
  const ventanas = ventanasManana(validos, { ajustes: cfg.ajustes ?? {}, kp, satelites: gnss.satelites, ahora });
  const texto = textoAviso(ventanas);
  if (texto) await registro.showNotification(texto.titulo, { body: texto.cuerpo, icon: 'icons/icono-192.png', badge: 'icons/icono-192.png', tag: ETIQUETA });
  else if (forzar)
    await registro.showNotification('Mañana no hay ventana verde', { body: `Ninguno de tus ${validos.length} favoritos tiene mañana horas en verde para tu dron.`, icon: 'icons/icono-192.png', tag: ETIQUETA });
  // Sin ventana también cuenta como «mirado hoy»: no se repite la descarga.
  if (!forzar) await almacen.guardarConfigAviso({ ...cfg, ultimo: hoy(ahora) });
  return { estado: texto ? 'avisado' : 'sin-ventana', ventanas };
}
