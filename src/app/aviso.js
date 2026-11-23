// Aviso de ventana: lo corre el instalador (sw-modulo.js) cuando el navegador
// le da permiso para despertar en segundo plano (Periodic Background Sync), y
// la página con «Probar ahora». Sin window ni almacenamiento propio: lo que necesita
// está en almacen.configAviso().

import { textoAviso, ventanasManana } from '../motor/aviso.js';
import { empeora, planesValidos, puntosPlan, textoEmpeora, valorarPlan } from '../motor/planificado.js';
import { combinarPrevisiones } from '../motor/trabajos.js';
import { construirPrevision } from '../motor/prevision.js';
import { almacen } from './almacen.js';
import { cargarKp, cargarPrevisionVarios, cargarSatelites, cargarSoloPrevision } from './datos.js';

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
  let cfg = await almacen.configAviso();
  if (!cfg || (!cfg.activo && !forzar)) return { estado: 'apagado' };
  // Kp y órbitas, una vez para los planes y los favoritos.
  let ctx = null;
  const contexto = () => (ctx ??= Promise.all([cargarKp(), cargarSatelites()]));
  // Los vuelos planificados se miran cada vez (no una al día): lo que importa
  // es enterarse en cuanto empeoran.
  const sinPlanes = cfg;
  cfg = await revisarPlanes(registro, cfg, contexto, ahora).catch(() => sinPlanes); // un fallo aquí no tapa el aviso de ventana
  const favoritos = Array.isArray(cfg.favoritos) ? cfg.favoritos.filter((l) => Number.isFinite(l?.lat) && Number.isFinite(l?.lon)) : [];
  if (!favoritos.length) return { estado: 'sin-favoritos' };
  if (!forzar && cfg.ultimo === hoy(ahora)) return { estado: 'ya-avisado' };
  const [[kp, gnss], lugares] = await Promise.all([
    contexto(),
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
  if (!forzar) await guardarSobreLoNuevo({ ultimo: hoy(ahora) }, cfg, ahora);
  return { estado: texto ? 'avisado' : 'sin-ventana', ventanas };
}

/**
 * Los vuelos planificados: si alguno ha empeorado desde lo último que se
 * sabía (al planificarlo, o el último aviso), notifica. Devuelve la
 * configuración con lo visto guardado.
 */
export async function revisarPlanes(registro, cfg, contexto, ahora = Date.now()) {
  const planes = planesValidos(cfg.planes, ahora);
  if (!planes.length) {
    if (!Object.keys(cfg.vistos ?? {}).length) return cfg;
    return guardarSobreLoNuevo({ vistos: {} }, cfg, ahora); // los planes ya pasados se olvidan
  }
  const vistos = { ...(cfg.vistos ?? {}) };
  const [kp, gnss] = await contexto();
  // Una descarga por sitio (o por juego de puntos de una traza), aunque haya varios planes en él.
  const clave = (plan) => puntosPlan(plan).map((q) => `${q.lat},${q.lon}`).join(';');
  const porLugar = new Map();
  for (const plan of planes) if (!porLugar.has(clave(plan))) porLugar.set(clave(plan), cargarPrevisionVarios(puntosPlan(plan)).catch(() => null));
  for (const plan of planes) {
    const lista = await porLugar.get(clave(plan));
    if (!lista) continue;
    // Con el dron y la altura del plan (los de cuando se planificó), no los
    // de ahora; en una traza, cada hora la del peor punto.
    const puntos = puntosPlan(plan);
    const p = combinarPrevisiones(lista.map((meteo, i) => construirPrevision({ meteo, kp, satelites: gnss.satelites, lugar: { ...plan.lugar, ...puntos[i] }, ajustes: plan.ajustes ?? cfg.ajustes ?? {}, ahora })));
    const val = valorarPlan(plan, p);
    if (val.estado === 'sin-prevision') continue;
    const antes = vistos[plan.id] ?? plan.estado;
    const tag = `plan-${plan.id}`;
    if (empeora(antes, val.estado)) {
      const t = textoEmpeora(plan, antes, val);
      // renotify: con la misma etiqueta, sin él el aviso nuevo (de ámbar a
      // rojo) sustituye al viejo SIN sonar ni vibrar.
      await registro.showNotification(t.titulo, { body: t.cuerpo, icon: 'icons/icono-192.png', badge: 'icons/icono-192.png', tag, renotify: true });
    } else if (empeora(val.estado, antes)) {
      // Ha mejorado: el aviso de «empeora» ya no es verdad.
      for (const n of (await registro.getNotifications?.({ tag })) ?? []) n.close();
    }
    // También si mejora: así, si luego vuelve a empeorar, se avisa otra vez.
    vistos[plan.id] = val.estado;
  }
  return guardarSobreLoNuevo({ vistos }, cfg, ahora);
}

// Mirar tarda (descargas de hasta un minuto) y entretanto la página puede
// haber cambiado la configuración (un plan borrado o nuevo, otro dron). Se
// vuelve a leer justo antes de escribir y solo se ponen encima `vistos` y
// `ultimo`, que son lo que escribe el instalador: si no, resucitaría el plan
// borrado con la copia vieja. `vistos` se queda solo con los planes que hay.
async function guardarSobreLoNuevo(cambios, leida, ahora = Date.now()) {
  const fresca = (await almacen.configAviso()) ?? leida;
  const nueva = { ...fresca, ...cambios };
  if (cambios.vistos) {
    const ids = new Set(planesValidos(fresca.planes, ahora).map((p) => p.id));
    nueva.vistos = Object.fromEntries(Object.entries(cambios.vistos).filter(([id]) => ids.has(id)));
  }
  await almacen.guardarConfigAviso(nueva);
  return nueva;
}
