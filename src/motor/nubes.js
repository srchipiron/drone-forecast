// Las nubes por capas (bajas, medias y altas), como el mapa de nubes de
// Windy, y qué luz dan para las fotos. Es información, no veredicto: el
// semáforo de volar lo deciden la base de nubes y la visibilidad.
//
// Capas de Open-Meteo: bajas por debajo de unos 2 km, medias de 2 a 6 km y
// altas por encima de 6 km (cirros). Los cortes de la luz son de práctica
// fotográfica, a ojo: no deciden nada, solo describen.

const num = (v) => (Number.isFinite(v) ? Math.round(v) : null);

/** Qué luz dan las nubes de esa hora: {id, texto}, o null si no hay datos. */
export function luzNubes(h) {
  const b = h.nubesBajas;
  const m = h.nubesMedias;
  const a = h.nubesAltas;
  if (![b, m, a].some(Number.isFinite)) return null;
  if ((b ?? 0) >= 70) return { id: 'cubierto', texto: 'Encapotado de nubes bajas: luz plana y sin sombras (va bien para fotogrametría; para fotos, gris)' };
  if ((b ?? 0) >= 30) return { id: 'ratos', texto: 'Nubes bajas a ratos: sombras que se mueven y cambios de luz entre foto y foto' };
  if ((m ?? 0) >= 60) return { id: 'medias', texto: 'Capa de nubes medias: luz tamizada y suave, sin sol directo' };
  if ((a ?? 0) >= 40) return { id: 'altas', texto: 'Solo nubes altas finas: el sol pasa tamizado; al amanecer y al atardecer suelen dar color' };
  return { id: 'despejado', texto: 'Despejado: sol directo y sombras marcadas' };
}

/** Las tres capas de cada hora, en %, para la franja de nubes del día. */
export function capasNubes(horas) {
  const filas = horas.map((h) => ({ ms: h.ms, bajas: num(h.nubesBajas), medias: num(h.nubesMedias), altas: num(h.nubesAltas) }));
  return { horas: filas, hay: filas.some((f) => f.bajas !== null || f.medias !== null || f.altas !== null) };
}

/** Enlace al mapa de nubes de Windy centrado en el punto. */
export function urlWindyNubes(lat, lon) {
  return `https://www.windy.com/?clouds,${Number(lat).toFixed(3)},${Number(lon).toFixed(3)},9`;
}
