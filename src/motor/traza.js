// Trazas y varios puntos para un trabajo: leer KML (Google Earth), WPML
// (misiones de DJI Pilot 2, dentro del KMZ) y GPX; medir; y elegir en qué
// puntos se mira el tiempo (el modelo tiene celdas de unos pocos km: con un
// punto cada pocos km de traza basta, y no más de MAX_MUESTRAS descargas).

export const MAX_PUNTOS = 500; // los que se guardan para dibujar
export const MAX_MUESTRAS = 12; // los puntos en los que se mira el tiempo
const R = 6371; // radio medio de la Tierra, km

export function distanciaKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function longitudKm(puntos) {
  let s = 0;
  for (let i = 1; i < puntos.length; i++) s += distanciaKm(puntos[i - 1], puntos[i]);
  return s;
}

const valido = (p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
const redondear = (p) => ({ lat: Math.round(p.lat * 1e5) / 1e5, lon: Math.round(p.lon * 1e5) / 1e5 });

/** Deja como mucho `max` puntos, repartidos y con el primero y el último. */
export function aligerar(puntos, max = MAX_PUNTOS) {
  if (puntos.length <= max) return puntos;
  const salida = [];
  for (let i = 0; i < max; i++) salida.push(puntos[Math.round((i * (puntos.length - 1)) / (max - 1))]);
  return salida;
}

/** Normaliza los puntos de una zona de trabajo (los que no valen, fuera). */
export function limpiarPuntos(lista) {
  const salida = [];
  for (const p of Array.isArray(lista) ? lista : []) {
    const q = Array.isArray(p) ? { lat: Number(p[0]), lon: Number(p[1]) } : { lat: Number(p?.lat), lon: Number(p?.lon) };
    if (!valido(q)) continue;
    const r = redondear(q);
    const ultimo = salida.at(-1);
    if (ultimo && ultimo.lat === r.lat && ultimo.lon === r.lon) continue; // repetido seguido
    salida.push(r);
  }
  return aligerar(salida);
}

const entidades = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

function primerNombre(texto) {
  const m = texto.match(/<name>([\s\S]*?)<\/name>/i);
  return m ? entidades(m[1]).replace(/\s+/g, ' ').slice(0, 80) : '';
}

/**
 * Lee un KML, WPML o GPX (el texto) y devuelve la forma y sus puntos.
 * Traza: una línea (LineString, track o ruta de GPX, misión de DJI, polígono).
 * Puntos: sitios sueltos (Placemark con Point, waypoints de GPX).
 * @returns {{forma: 'traza'|'puntos', puntos: {lat: number, lon: number}[], nombre: string} | {error: string}}
 */
export function leerTraza(texto) {
  if (typeof texto !== 'string' || !texto.trim()) return { error: 'El fichero está vacío.' };
  const nombre = primerNombre(texto);
  if (/<gpx[\s>]/i.test(texto)) {
    const leerPt = (etiqueta) =>
      [...texto.matchAll(new RegExp(`<${etiqueta}\\b([^>]*)>`, 'gi'))].map((m) => ({
        lat: Number(m[1].match(/\blat\s*=\s*["']([^"']+)["']/i)?.[1]),
        lon: Number(m[1].match(/\blon\s*=\s*["']([^"']+)["']/i)?.[1]),
      }));
    const linea = limpiarPuntos([...leerPt('trkpt'), ...leerPt('rtept')]);
    if (linea.length >= 2) return { forma: 'traza', puntos: linea, nombre };
    const sueltos = limpiarPuntos(leerPt('wpt'));
    if (sueltos.length) return { forma: sueltos.length === 1 ? 'traza' : 'puntos', puntos: sueltos, nombre };
    return { error: 'El GPX no trae ningún punto.' };
  }
  const bloques = [...texto.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/gi)].map((m) =>
    m[1]
      .trim()
      .split(/\s+/)
      .map((t) => t.split(','))
      .filter((x) => x.length >= 2)
      .map(([lon, lat]) => ({ lat: Number(lat), lon: Number(lon) })),
  );
  if (!bloques.length) return { error: 'No encuentro coordenadas: ¿es un KML, KMZ o GPX?' };
  // Una misión de DJI (WPML) son waypoints sueltos que se vuelan en orden: es una traza.
  const mision = /xmlns:wpml\s*=|<wpml:/i.test(texto);
  const lineas = bloques.filter((b) => b.length >= 2);
  if (lineas.length && !mision) {
    const puntos = limpiarPuntos(lineas.flat());
    if (puntos.length >= 2) return { forma: 'traza', puntos, nombre };
  }
  const puntos = limpiarPuntos(bloques.flat());
  if (!puntos.length) return { error: 'Las coordenadas del fichero no son válidas.' };
  return { forma: mision || puntos.length === 1 ? 'traza' : 'puntos', puntos, nombre };
}

/** Un punto cada `pasoKm` a lo largo de la línea, con el primero y el último. */
function aLoLargo(puntos, pasoKm) {
  const salida = [puntos[0]];
  let falta = pasoKm;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1];
    const b = puntos[i];
    const d = distanciaKm(a, b);
    let hecho = 0;
    while (d - hecho >= falta) {
      hecho += falta;
      const f = hecho / d;
      salida.push(redondear({ lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f }));
      falta = pasoKm;
    }
    falta -= d - hecho;
  }
  const ultimo = puntos.at(-1);
  if (distanciaKm(salida.at(-1), ultimo) > pasoKm * 0.3) salida.push(ultimo);
  return salida;
}

/**
 * Los puntos en los que se mira el tiempo de una zona de trabajo.
 * Traza: uno cada 3 km (o más separados, para no pasar de MAX_MUESTRAS).
 * Puntos: los que están a más de 1 km de otro ya elegido, hasta MAX_MUESTRAS.
 * @param {{forma?: string, puntos?: object[], lat: number, lon: number}} lugar
 */
export function puntosTiempo(lugar) {
  const puntos = lugar?.puntos?.length ? lugar.puntos : [{ lat: lugar.lat, lon: lugar.lon }];
  if (lugar?.forma === 'traza' && puntos.length >= 2) {
    const largo = longitudKm(puntos);
    const paso = Math.max(3, largo / (MAX_MUESTRAS - 1));
    return aligerar(aLoLargo(puntos, paso), MAX_MUESTRAS);
  }
  const salida = [];
  for (const p of puntos) if (!salida.some((q) => distanciaKm(p, q) < 1)) salida.push(p);
  return aligerar(salida, MAX_MUESTRAS);
}

/** El zoom con el que se ven todos los puntos en una caja de ancho × alto px. */
export function zoomParaVer(puntos, ancho, alto) {
  if (puntos.length < 2) return 14;
  const lats = puntos.map((p) => p.lat);
  const lons = puntos.map((p) => p.lon);
  const rad = Math.PI / 180;
  const y = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * rad) / 2));
  const fx = (Math.max(...lons) - Math.min(...lons)) / 360;
  const fy = (y(Math.max(...lats)) - y(Math.min(...lats))) / (2 * Math.PI);
  for (let z = 16; z > 3; z--) if (fx * 256 * 2 ** z <= ancho * 0.8 && fy * 256 * 2 ** z <= alto * 0.8) return z;
  return 3;
}

/** El centro de la caja que envuelve los puntos. */
export function centroDe(puntos) {
  const lats = puntos.map((p) => p.lat);
  const lons = puntos.map((p) => p.lon);
  return { lat: (Math.max(...lats) + Math.min(...lats)) / 2, lon: (Math.max(...lons) + Math.min(...lons)) / 2 };
}
