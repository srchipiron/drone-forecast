// Zonas geográficas UAS de ENAIRE: ¿el punto cae dentro de alguna?
//
// ENAIRE las publica en un servicio ArcGIS abierto (SRV_UAS_ZG_data_V2), una
// capa por tipo. Se pregunta con la consulta estándar de ArcGIS: qué
// elementos de la capa tocan este punto. Los nombres de los campos siguen
// ED-318 pero no están verificados desde aquí, así que se buscan por
// parecido y, si no aparecen, se enseña lo que haya.
//
// Regla de oro: nunca decir «no hay zonas» si alguna capa no respondió.

const BASE = 'https://servais.enaire.es/insigniads/rest/services/NSF_SRV/SRV_UAS_ZG_data_V2/FeatureServer';

export const CAPAS = [
  { id: 2, nombre: 'Aeronáutica' },
  { id: 0, nombre: 'Infraestructuras' },
  { id: 3, nombre: 'Urbana' },
  { id: 1, nombre: 'Medioambiental' },
];

export function urlConsultaEnaire(capa, lat, lon) {
  const p = new URLSearchParams({
    geometry: `${Number(lon).toFixed(6)},${Number(lat).toFixed(6)}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
    f: 'json',
  });
  return `${BASE}/${capa}/query?${p}`;
}

const RESTRICCIONES = {
  PROHIBITED: 'prohibido volar',
  REQ_AUTHORIZATION: 'requiere autorización',
  REQ_AUTHORISATION: 'requiere autorización',
  CONDITIONAL: 'condicionado',
  NO_RESTRICTION: 'sin restricción',
};

// Motivos de la norma ED-318 (los que se reconozcan; el resto, tal cual).
const MOTIVOS = {
  AIR_TRAFFIC: 'tráfico aéreo',
  SENSITIVE: 'zona sensible',
  PRIVACY: 'privacidad',
  POPULATION: 'población',
  NATURE: 'espacio natural',
  NOISE: 'ruido',
  FOREIGN_TERRITORY: 'territorio extranjero',
  EMERGENCY: 'emergencia',
  OTHER: 'otros',
};

function campo(attrs, patrones) {
  const claves = Object.keys(attrs);
  for (const p of patrones) {
    const k = claves.find((c) => p.test(c) && attrs[c] !== null && attrs[c] !== '');
    if (k) return String(attrs[k]);
  }
  return '';
}

// Una respuesta de ArcGIS → lista de zonas. ArcGIS contesta 200 con
// {"error": …} cuando falla: eso es un fallo, no «cero zonas».
export function leerZonas(json, capa) {
  if (!json || typeof json !== 'object' || json.error || !Array.isArray(json.features)) {
    throw new Error(json?.error?.message ?? 'respuesta de ENAIRE sin elementos');
  }
  return json.features.map((f) => {
    const a = f?.attributes ?? {};
    const restriccion = campo(a, [/^restriction$/i, /restric/i]);
    return {
      capa,
      nombre: campo(a, [/^name$/i, /nombre/i, /name/i, /^identifier$/i, /ident/i]) || 'Zona sin nombre',
      restriccion: RESTRICCIONES[restriccion.toUpperCase()] ?? restriccion.toLowerCase(),
      motivo: (() => {
        const m = campo(a, [/^reason$/i, /motivo/i, /reason/i]);
        return MOTIVOS[m.toUpperCase()] ?? m;
      })(),
      mensaje: campo(a, [/^message$/i, /mensaje/i, /message/i]),
    };
  });
}

/**
 * @param {Array<{capa: string, ok: boolean, zonas?: object[]}>} resultados  una por capa
 * @returns {{estado: 'dentro'|'fuera'|'incompleto'|'error', zonas: object[], fallidas: string[]}}
 */
export function resumenZonas(resultados) {
  const zonas = resultados.filter((r) => r.ok).flatMap((r) => r.zonas);
  const fallidas = resultados.filter((r) => !r.ok).map((r) => r.capa);
  let estado;
  if (zonas.length) estado = 'dentro';
  else if (!fallidas.length) estado = 'fuera';
  else if (fallidas.length < resultados.length) estado = 'incompleto';
  else estado = 'error';
  return { estado, zonas, fallidas };
}
