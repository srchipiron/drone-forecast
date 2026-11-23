// Open-Meteo: qué se pide y cómo se lee. Las horas llegan en tiempo Unix
// (timeformat=unixtime) para que el cambio de hora no descuadre nada; la zona
// horaria del sitio (timezone=auto) solo sirve para enseñarlas y partir días.

export const VARIABLES = [
  'temperature_2m',
  'dew_point_2m',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'visibility',
  'wind_speed_10m',
  'wind_speed_80m',
  'wind_speed_120m',
  'wind_speed_180m',
  'wind_direction_10m',
  'wind_direction_120m',
  'wind_gusts_10m',
  'shortwave_radiation',
  // Para el riesgo de tormenta aunque el modelo no la pinte: energía
  // disponible para la convección y estabilidad del aire.
  'cape',
  'lifted_index',
  // Nubes bajas (por debajo de unos 2 km): las que pueden tapar el dron. Las
  // altas (cirros) dan igual para volar.
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
];

// Modelos para medir el acuerdo: si discrepan, la previsión vale menos.
export const MODELOS_CONSENSO = ['ecmwf_ifs025', 'gfs_seamless', 'icon_seamless', 'meteofrance_seamless'];

export const NOMBRES_MODELO = {
  ecmwf_ifs025: 'ECMWF',
  gfs_seamless: 'GFS',
  icon_seamless: 'ICON',
  meteofrance_seamless: 'Météo-France',
};

const BASE = 'https://api.open-meteo.com/v1/forecast';
const COMUNES = 'wind_speed_unit=ms&timezone=auto&timeformat=unixtime&forecast_days=7';

function coord(x) {
  return Number(x).toFixed(4);
}

export function urlPrevision(lat, lon) {
  return `${BASE}?latitude=${coord(lat)}&longitude=${coord(lon)}&hourly=${VARIABLES.join(',')}&${COMUNES}`;
}

/** Lo mismo para varios puntos en una sola petición (la respuesta es una lista, en orden). */
export function urlPrevisionVarios(puntos) {
  return `${BASE}?latitude=${puntos.map((p) => coord(p.lat)).join(',')}&longitude=${puntos.map((p) => coord(p.lon)).join(',')}&hourly=${VARIABLES.join(',')}&${COMUNES}`;
}

export function urlConsenso(lat, lon) {
  return `${BASE}?latitude=${coord(lat)}&longitude=${coord(lon)}&hourly=wind_speed_10m,wind_gusts_10m&models=${MODELOS_CONSENSO.join(',')}&${COMUNES}`;
}

export function urlBusqueda(texto) {
  return `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(texto)}&count=8&language=es&format=json`;
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function leerPrevision(json) {
  const h = json?.hourly;
  if (!h || !Array.isArray(h.time)) throw new Error('La respuesta de Open-Meteo no trae horas');
  const col = (k) => (Array.isArray(h[k]) ? h[k] : []);
  const horas = h.time.map((t, k) => ({
    ms: t * 1000,
    temp: num(col('temperature_2m')[k]),
    td: num(col('dew_point_2m')[k]),
    probLluvia: num(col('precipitation_probability')[k]),
    lluvia: num(col('precipitation')[k]),
    codigo: num(col('weather_code')[k]),
    nubes: num(col('cloud_cover')[k]),
    visibilidad: num(col('visibility')[k]),
    niveles: {
      10: num(col('wind_speed_10m')[k]),
      80: num(col('wind_speed_80m')[k]),
      120: num(col('wind_speed_120m')[k]),
      180: num(col('wind_speed_180m')[k]),
    },
    racha10: num(col('wind_gusts_10m')[k]),
    dir10: num(col('wind_direction_10m')[k]),
    dir120: num(col('wind_direction_120m')[k]),
    radiacion: num(col('shortwave_radiation')[k]),
    cape: num(col('cape')[k]),
    li: num(col('lifted_index')[k]),
    nubesBajas: num(col('cloud_cover_low')[k]),
    nubesMedias: num(col('cloud_cover_mid')[k]),
    nubesAltas: num(col('cloud_cover_high')[k]),
  }));
  return {
    horas,
    zona: typeof json.timezone === 'string' ? json.timezone : 'UTC',
    elevacion: num(json.elevation) ?? 0,
  };
}

// Devuelve, por instante (ms), la dispersión (máx − mín) del viento a 10 m
// entre los modelos que tienen dato y cuántos son.
export function leerConsenso(json) {
  const h = json?.hourly;
  if (!h || !Array.isArray(h.time)) return new Map();
  const serie = (prefijo) =>
    Object.keys(h)
      .filter((k) => k.startsWith(prefijo))
      .map((k) => [k.slice(prefijo.length), h[k]]);
  const series = serie('wind_speed_10m_');
  const seriesRacha = serie('wind_gusts_10m_');
  const salida = new Map();
  h.time.forEach((t, i) => {
    const valores = {};
    for (const [modelo, s] of series) {
      const v = num(s?.[i]);
      if (v !== null) valores[modelo] = v;
    }
    // Las rachas de cada modelo: la peor se mira aparte (fRachas), para que
    // no se escape un modelo que ve rachas fuertes.
    const rachas = {};
    for (const [modelo, s] of seriesRacha) {
      const v = num(s?.[i]);
      if (v !== null) rachas[modelo] = v;
    }
    const vals = Object.values(valores);
    if (vals.length >= 2)
      salida.set(t * 1000, { dispersion: Math.max(...vals) - Math.min(...vals), modelos: vals.length, valores, rachas });
    else if (Object.keys(rachas).length) salida.set(t * 1000, { dispersion: null, modelos: vals.length, valores, rachas });
  });
  return salida;
}

export function leerBusqueda(json) {
  return (json?.results ?? [])
    .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
    .map((r) => ({
      nombre: String(r.name ?? ''),
      zona: [r.admin1, r.country].filter(Boolean).map(String).join(', '),
      lat: r.latitude,
      lon: r.longitude,
    }));
}

// Base de nubes por la fórmula de Espy: ~125 m por cada grado entre
// temperatura y punto de rocío.
export function techoNubes(temp, td) {
  if (!Number.isFinite(temp) || !Number.isFinite(td)) return null;
  return Math.max(0, (temp - td) * 125);
}
