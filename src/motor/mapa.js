// Las cuentas del mapa (proyección web Mercator de OpenStreetMap): de
// latitud/longitud a coordenadas de tesela y vuelta, y qué teselas caben en
// pantalla. Sin DOM: la app las pinta (src/app/mapa.js).

export const TAM = 256; // píxeles por tesela
export const ZOOM_MIN = 3;
export const ZOOM_MAX = 18;
const LAT_MAX = 85.05112878; // donde Mercator se corta

/** Coordenadas de tesela (con decimales) de un punto en el zoom z. */
export function aTesela(lat, lon, z) {
  const n = 2 ** z;
  const la = (Math.max(-LAT_MAX, Math.min(LAT_MAX, lat)) * Math.PI) / 180;
  return { x: ((lon + 180) / 360) * n, y: ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n };
}

/** El punto de unas coordenadas de tesela; la longitud vuelve a [-180, 180). */
export function aLatLon(x, y, z) {
  const n = 2 ** z;
  const lon = (((((x / n) * 360) % 360) + 360) % 360) - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { lat, lon };
}

/**
 * Las teselas que tapan un rectángulo de ancho×alto píxeles centrado en
 * (cx, cy) tesela, con su posición en píxeles. x da la vuelta al mundo (i es
 * la columna sin dar la vuelta, para distinguir dos copias del mismo sitio); las
 * filas fuera del mapa (polos) no se piden.
 */
export function teselasVisibles(cx, cy, z, ancho, alto) {
  const n = 2 ** z;
  const x0 = Math.floor(cx - ancho / 2 / TAM);
  const x1 = Math.floor(cx + ancho / 2 / TAM);
  const y0 = Math.max(0, Math.floor(cy - alto / 2 / TAM));
  const y1 = Math.min(n - 1, Math.floor(cy + alto / 2 / TAM));
  const salida = [];
  for (let i = x0; i <= x1; i++)
    for (let j = y0; j <= y1; j++)
      salida.push({ z, i, x: ((i % n) + n) % n, y: j, izq: Math.round((i - cx) * TAM + ancho / 2), arriba: Math.round((j - cy) * TAM + alto / 2) });
  return salida;
}

/** El punto bajo un píxel (px, py) del rectángulo. */
export function puntoEnPixel(cx, cy, z, ancho, alto, px, py) {
  return aLatLon(cx + (px - ancho / 2) / TAM, cy + (py - alto / 2) / TAM, z);
}
