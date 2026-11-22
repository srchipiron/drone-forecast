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

// ---------- Nubes por altura (como el «airgram» de Windy) ----------

// Niveles de presión de Open-Meteo, de abajo arriba: de unos 100 m a 9 km.
export const NIVELES_HPA = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300];
const BASE = 'https://api.open-meteo.com/v1/forecast';

/** Nubosidad y altura de cada nivel, hora a hora (se pide aparte, al abrirlo). */
export function urlNubesAltura(lat, lon) {
  const vars = NIVELES_HPA.flatMap((p) => [`cloud_cover_${p}hPa`, `geopotential_height_${p}hPa`]);
  return `${BASE}?latitude=${Number(lat).toFixed(4)}&longitude=${Number(lon).toFixed(4)}&hourly=${vars.join(',')}&timezone=auto&timeformat=unixtime&forecast_days=7`;
}

/**
 * La respuesta → por hora, las capas con su altura SOBRE EL SUELO (la del
 * nivel menos la del terreno) y cuánto cubren. Los niveles bajo tierra (en
 * montaña, 1000 hPa queda por debajo del suelo) se quitan.
 */
export function leerNubesAltura(json) {
  const h = json?.hourly;
  if (!h || !Array.isArray(h.time)) throw new Error('La respuesta de Open-Meteo no trae horas');
  const suelo = Number.isFinite(json.elevation) ? json.elevation : 0;
  return h.time.map((t, k) => ({
    ms: t * 1000,
    capas: NIVELES_HPA.map((p) => ({ hpa: p, altura: h[`geopotential_height_${p}hPa`]?.[k], cobertura: h[`cloud_cover_${p}hPa`]?.[k] }))
      .filter((c) => Number.isFinite(c.altura) && Number.isFinite(c.cobertura) && c.altura > suelo)
      .map((c) => ({ hpa: c.hpa, altura: Math.round(c.altura - suelo), cobertura: Math.round(c.cobertura) })),
  }));
}

// Desde cuánto se cuenta como capa de nubes: con menos de un 30 % de un
// nivel cubierto hay nubes sueltas, no una capa (práctica de los meteogramas).
export const CAPA_MIN = 30;

/**
 * Las capas de nubes de una hora: tramos seguidos de niveles con nubes,
 * con su base y su tope (en m sobre el suelo, a medio camino entre niveles)
 * y lo densas que son (la cobertura máxima del tramo).
 */
export function capasDeNubes(capas) {
  const salida = [];
  let actual = null;
  capas.forEach((c, i) => {
    const abajo = i === 0 ? 0 : Math.round((capas[i - 1].altura + c.altura) / 2);
    const arriba = i === capas.length - 1 ? c.altura + 500 : Math.round((c.altura + capas[i + 1].altura) / 2);
    if (c.cobertura >= CAPA_MIN) {
      if (!actual) actual = { base: abajo, tope: arriba, densidad: c.cobertura };
      else {
        actual.tope = arriba;
        actual.densidad = Math.max(actual.densidad, c.cobertura);
      }
    } else if (actual) {
      salida.push(actual);
      actual = null;
    }
  });
  if (actual) salida.push(actual);
  return salida;
}

const DENSIDAD = (d) => (d >= 80 ? 'densa' : d >= 50 ? 'compacta' : 'dispersa');
const metros = (m) => `${Math.round(m / 50) * 50 >= 1000 ? (Math.round(m / 100) / 10).toLocaleString('es-ES') + ' km' : Math.round(m / 50) * 50 + ' m'}`;

/** «Capa densa de 600 m a 1,8 km · capa dispersa de 6 km a 8 km», o «Sin capas de nubes». */
export function textoCapas(capas, altitud) {
  const cs = capasDeNubes(capas);
  if (!cs.length) return 'Sin capas de nubes';
  const t = cs.map((c) => `capa ${DENSIDAD(c.densidad)} de ${metros(c.base)} a ${metros(c.tope)}`).join(' · ');
  const tuya = Number.isFinite(altitud) && cs.some((c) => c.base <= altitud && c.tope > altitud && c.densidad >= 50);
  return `${t[0].toUpperCase()}${t.slice(1)}${tuya ? ` · tu altura (${altitud} m) queda DENTRO de una capa` : ''}`;
}

// ---------- Mapa de nubes ----------

/** Una rejilla de n × n puntos que cubre la caja (los centros de las celdas). */
export function rejillaNubes(caja, n = 7) {
  const dx = (caja.este - caja.oeste) / n;
  const dy = (caja.norte - caja.sur) / n;
  const puntos = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++)
      puntos.push({ lat: caja.sur + (j + 0.5) * dy, lon: caja.oeste + (i + 0.5) * dx, oeste: caja.oeste + i * dx, este: caja.oeste + (i + 1) * dx, sur: caja.sur + j * dy, norte: caja.sur + (j + 1) * dy });
  return puntos;
}

/** Una sola petición para todos los puntos (Open-Meteo admite varias coordenadas). */
export function urlNubesRejilla(puntos) {
  const lat = puntos.map((p) => p.lat.toFixed(3)).join(',');
  const lon = puntos.map((p) => p.lon.toFixed(3)).join(',');
  return `${BASE}?latitude=${lat}&longitude=${lon}&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high&timezone=auto&timeformat=unixtime&forecast_days=3`;
}

/** La respuesta (una por punto, en el mismo orden) → celdas con sus series. */
export function leerNubesRejilla(json, puntos) {
  const lista = Array.isArray(json) ? json : [json];
  if (lista.length !== puntos.length) throw new Error('La rejilla de nubes no cuadra con los puntos pedidos');
  return lista.map((r, i) => {
    const h = r?.hourly ?? {};
    const serie = (k) => (Array.isArray(h[k]) ? h[k].map((v) => (Number.isFinite(v) ? v : null)) : []);
    return { ...puntos[i], horas: (h.time ?? []).map((t) => t * 1000), bajas: serie('cloud_cover_low'), medias: serie('cloud_cover_mid'), altas: serie('cloud_cover_high') };
  });
}

/** Cuánto cubre la capa en cada celda a la hora ms (la hora en curso de esa celda). */
export function celdasEnHora(celdas, capa, ms) {
  return celdas.map((c) => {
    const k = c.horas.findIndex((t) => ms >= t && ms < t + 3600000);
    return { oeste: c.oeste, este: c.este, sur: c.sur, norte: c.norte, cobertura: k >= 0 ? c[capa][k] : null };
  });
}
