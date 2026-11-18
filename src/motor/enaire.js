// Zonas geográficas UAS de ENAIRE: ¿el punto cae dentro de alguna, y a tu
// altura de vuelo te afecta?
//
// ENAIRE las publica en un servicio ArcGIS abierto (SRV_UAS_ZG_data_V2), una
// capa por tipo. Se pregunta con la consulta estándar de ArcGIS: qué
// elementos de la capa tocan este punto. Los campos son los de ED-318,
// comprobados contra respuestas reales (pruebas/fixtures/enaire-getafe-aero.json).
//
// Reglas de oro:
// - nunca decir «no hay zonas» si alguna capa no respondió;
// - lo que llega de ENAIRE son datos: el mensaje viene en HTML y aquí se
//   convierte en texto plano; de sus enlaces solo se aceptan los https.

const BASE = 'https://servais.enaire.es/insigniads/rest/services/NSF_SRV/SRV_UAS_ZG_data_V2/FeatureServer';

// Las capas que publica el servicio (FeatureServer?f=json, 17-11-2026: 0, 2 y 3).
// La 1 no existe: pedirla daba siempre error y la consulta salía «incompleta».
export const CAPAS = [
  { id: 2, nombre: 'Aeronáutica' },
  { id: 0, nombre: 'Infraestructuras' },
  { id: 3, nombre: 'Urbana' },
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

// Las formas de las zonas que tocan un rectángulo (para pintarlas en el
// mapa). Solo los campos que hacen falta para colorear y la geometría
// simplificada: `simplificar` es la tolerancia en grados (ArcGIS
// maxAllowableOffset), del orden de un píxel en el zoom que se mira, para no
// bajar miles de vértices que no se verían.
export function urlFormasEnaire(capa, { oeste, sur, este, norte }, simplificar = 0.0005) {
  const g = (v) => Number(v).toFixed(5);
  const p = new URLSearchParams({
    geometry: [oeste, sur, este, norte].map(g).join(','),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'identifier,name,type,lower,lowerReference,upper,upperReference,uom,extendedProperties',
    returnGeometry: 'true',
    outSR: '4326',
    maxAllowableOffset: String(simplificar),
    geometryPrecision: '5',
    resultRecordCount: '300',
    f: 'json',
  });
  return `${BASE}/${capa}/query?${p}`;
}

// La geometría de ArcGIS es {rings: [[[lon, lat], …], …]}; aquí se queda
// solo lo que son números de verdad. Un anillo con menos de 3 puntos no
// encierra nada y se descarta.
function anillosDe(geo) {
  if (!geo || !Array.isArray(geo.rings)) return [];
  return geo.rings
    .map((r) => (Array.isArray(r) ? r.filter((pt) => Array.isArray(pt) && Number.isFinite(pt[0]) && Number.isFinite(pt[1]) && Math.abs(pt[0]) <= 180 && Math.abs(pt[1]) <= 90).map((pt) => [pt[0], pt[1]]) : []))
    .filter((r) => r.length >= 3);
}

/** Respuesta de la consulta de formas → zonas (como leerZonas) con `anillos`. */
export function leerFormas(json, capa) {
  const zonas = leerZonas(json, capa);
  return zonas
    .map((z, i) => ({ capa: z.capa, id: z.id, nombre: z.nombre, restriccion: z.restriccion, inferior: z.inferior, superior: z.superior, anillos: anillosDe(json.features[i]?.geometry) }))
    .filter((z) => z.anillos.length);
}

// ¿El punto está dentro? Regla par-impar sobre todos los anillos, que es
// como ArcGIS dibuja los huecos (un anillo dentro de otro lo vacía).
export function puntoEnFormas(anillos, lat, lon) {
  let dentro = false;
  for (const r of anillos)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
  return dentro;
}

// El campo `type` de ED-318: qué hace falta para volar dentro.
const RESTRICCIONES = {
  PROHIBITED: { texto: 'Prohibido volar', nivel: 3 },
  REQ_AUTHORIZATION: { texto: 'Requiere autorización', nivel: 2 },
  REQ_AUTHORISATION: { texto: 'Requiere autorización', nivel: 2 },
  CONDITIONAL: { texto: 'Con condiciones', nivel: 1 },
  NO_RESTRICTION: { texto: 'Sin restricción', nivel: 0 },
};

// Motivos de ED-318 (los que se reconozcan; el resto, tal cual).
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

// `extendedProperties`: la clase de zona en palabras.
const CLASES = {
  CTR: 'CTR (zona de control)',
  CTA: 'CTA (área de control)',
  ATZ: 'ATZ (zona de tránsito de aeródromo)',
  TMA: 'TMA (área de control terminal)',
  RVF: 'Restricción al vuelo fotográfico',
};

// «R-Restringida», «TSA-Temporalmente Segregada»... → «Restringida (R)».
function clase(c) {
  if (CLASES[c]) return CLASES[c];
  const m = /^([A-Z]{1,4})-(.+)$/.exec(c);
  return m ? `${m[2].trim()} (${m[1]})` : c;
}

const DIAS = { MON: 'lunes', TUE: 'martes', WED: 'miércoles', THU: 'jueves', FRI: 'viernes', SAT: 'sábado', SUN: 'domingo', WEEKDAYS: 'de lunes a viernes', WEEKEND: 'fines de semana' };

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', iquest: '¿', iexcl: '¡', ordm: 'º', ordf: 'ª', euro: '€', deg: '°' };

function decodificar(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 31 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTIDADES[e] ?? m;
  });
}

/** El mensaje HTML de ENAIRE en párrafos de texto plano (sin una sola etiqueta). */
export function textoPlano(html) {
  if (typeof html !== 'string' || !html.trim()) return [];
  const conSaltos = html.replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\s*\/?\s*(p|div|li|tr|h\d)\b[^>]*>/gi, '\n');
  return decodificar(conSaltos.replace(/<[^>]*>/g, ''))
    .replace(/[<>]/g, '') // por si quedaba media etiqueta
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l && l !== '.');
}

/**
 * El párrafo que ENAIRE resalta (en rojo o en negrita) y no es el del contacto:
 * suele ser lo que hay que hacer («NO permitido el vuelo a drones excepto
 * coordinación con el Aeródromo»). '' si no resalta nada.
 */
export function destacadoDe(html) {
  if (typeof html !== 'string') return '';
  for (const [, , dentro] of html.matchAll(/<(font\b[^>]*color\s*=\s*["']#dc143c["'][^>]*|b)>([\s\S]*?)<\/(?:font|b)>/gi)) {
    const t = textoPlano(dentro).join(' ');
    if (t.length < 8 || /^contacto/i.test(t)) continue;
    // Si resalta solo un trozo («Por encima de 45m»), el párrafo entero que lo contiene.
    const parrafo = textoPlano(html).find((p) => p.includes(t));
    return parrafo && parrafo.length <= 320 ? parrafo : t;
  }
  return '';
}

/** Los enlaces https del mensaje, con su texto. Ningún otro esquema. */
export function enlacesDe(html) {
  if (typeof html !== 'string') return [];
  const vistos = new Set();
  const salida = [];
  for (const [, url, texto] of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["'](https:\/\/[^"'\s<>]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (vistos.has(url)) continue;
    vistos.add(url);
    salida.push({ url, texto: textoPlano(texto).join(' ') || new URL(url).hostname });
  }
  return salida;
}

const metros = (v, uom) => {
  const n = Number(v);
  if (v === null || v === '' || !Number.isFinite(n)) return null;
  return /^ft$/i.test(String(uom ?? '').trim()) ? Math.round(n * 0.3048) : n;
};
const referencia = (r) => (/amsl|msl/i.test(String(r ?? '')) ? 'AMSL' : 'AGL');

function horario(a) {
  const partes = [];
  const desde = a.validFrom || a.startDateTime;
  const hasta = a.validTo || a.endDateTime;
  if (desde || hasta) partes.push(`${desde ? `desde ${String(desde).slice(0, 10)}` : ''}${desde && hasta ? ' ' : ''}${hasta ? `hasta ${String(hasta).slice(0, 10)}` : ''}`);
  const dia = String(a.day ?? '').toUpperCase();
  if (dia && dia !== 'ANY') partes.push(DIAS[dia] ?? dia.toLowerCase());
  if (a.startTime || a.endTime) partes.push(`de ${a.startTime || '?'} a ${a.endTime || '?'}`);
  return partes.length ? partes.join(', ') : null;
}

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());
const EMAIL = /^[^\s@<>"'()]+@[^\s@<>"'()]+\.[a-z]{2,}$/i;

// Una respuesta de ArcGIS → lista de zonas. ArcGIS contesta 200 con
// {"error": …} cuando falla: eso es un fallo, no «cero zonas».
export function leerZonas(json, capa) {
  if (!json || typeof json !== 'object' || json.error || !Array.isArray(json.features)) {
    throw new Error(json?.error?.message ?? 'respuesta de ENAIRE sin elementos');
  }
  return json.features.map((f) => {
    const a = f?.attributes ?? {};
    const codigo = texto(a.type ?? a.restriction).toUpperCase();
    const cls = clase(texto(a.extendedProperties));
    const id = texto(a.identifier);
    const html = texto(a.message);
    return {
      capa,
      id,
      nombre: texto(a.name) || [cls, id].filter(Boolean).join(' ') || 'Zona sin nombre',
      clase: cls,
      restriccion: { codigo, ...(RESTRICCIONES[codigo] ?? { texto: codigo.toLowerCase() || 'sin dato', nivel: 1 }) },
      motivos: texto(a.reasons ?? a.reason)
        .split(/[,;]/)
        .map((m) => m.trim())
        .filter(Boolean)
        .map((m) => MOTIVOS[m.toUpperCase()] ?? m.toLowerCase()),
      inferior: { m: metros(a.lower, a.uom), ref: referencia(a.lowerReference) },
      superior: { m: metros(a.upper, a.uom), ref: referencia(a.upperReference) },
      horario: horario(a),
      destacado: destacadoDe(html),
      texto: textoPlano(html),
      enlaces: enlacesDe(html),
      // Puede traer varios («a@x.es;b@y.es»); solo los que tienen forma de correo.
      emails: [...new Set(texto(a.email).split(/[;,/\s]+/).filter((e) => EMAIL.test(e)))],
      telefonos: texto(a.phone)
        .split(/[;,/]/)
        .map((t) => t.trim())
        .filter((t) => /^\+?[\d\s-]{6,20}$/.test(t)),
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

// ¿La zona te afecta volando a `altitud` metros sobre el suelo? Sus límites
// pueden ir sobre el suelo (AGL) o sobre el nivel del mar (AMSL): para estos
// hace falta la elevación del terreno; sin ella, «quizá» (nunca «no»).
// En el límite exacto no aplica: «altura máxima de 60 m» deja volar a 60.
export function aplica(z, altitud, elevacion) {
  const alturaRespecto = (ref) => (ref === 'AMSL' ? (Number.isFinite(elevacion) ? elevacion + altitud : null) : altitud);
  const inf = z.inferior?.m ?? 0;
  if (inf > 0) {
    const h = alturaRespecto(z.inferior.ref);
    if (h === null) return 'quiza';
    if (h <= inf) return 'no';
  }
  const sup = z.superior?.m;
  if (Number.isFinite(sup)) {
    const h = alturaRespecto(z.superior.ref);
    if (h === null) return 'quiza';
    if (h > sup) return 'no';
  }
  return 'si';
}

// Desde qué altura sobre el suelo empieza una zona (null si no se sabe).
function empiezaA(z, elevacion) {
  const inf = z.inferior?.m ?? 0;
  if (z.inferior?.ref === 'AMSL') return Number.isFinite(elevacion) ? Math.max(0, inf - elevacion) : null;
  return inf;
}

/**
 * Las zonas ordenadas por lo que importan a tu altura, y el resumen.
 * @param {object[]} zonas  leerZonas()
 * @param {{altitud: number, elevacion?: number|null}} vuelo
 * @returns {{zonas: object[], afectan: object[], peor: object|null, libreHasta: number|null}}
 *   peor: la restricción más dura de las que te afectan; libreHasta: por
 *   debajo de esa altura (m sobre el suelo) no te afecta ninguna zona con
 *   restricción (null si alguna no se puede calcular).
 */
export function valorarZonas(zonas, { altitud, elevacion = null }) {
  const orden = { si: 0, quiza: 1, no: 2 };
  const valoradas = zonas
    .map((z) => ({ ...z, aplica: aplica(z, altitud, elevacion) }))
    .sort((a, b) => orden[a.aplica] - orden[b.aplica] || b.restriccion.nivel - a.restriccion.nivel || (a.inferior.m ?? 0) - (b.inferior.m ?? 0));
  const afectan = valoradas.filter((z) => z.aplica !== 'no');
  const peor = afectan.reduce((p, z) => (!p || z.restriccion.nivel > p.nivel ? z.restriccion : p), null);
  const limites = valoradas.filter((z) => z.restriccion.nivel > 0).map((z) => empiezaA(z, elevacion));
  const libreHasta = !limites.length || limites.includes(null) ? null : Math.min(...limites);
  return { zonas: valoradas, afectan, peor, libreHasta };
}

/** «Desde 60 m hasta 305 m sobre el suelo», «Desde el suelo hasta 900 m»... */
export function alturasZona(z) {
  const conInf = Boolean(z.inferior?.m);
  const conSup = Number.isFinite(z.superior?.m);
  const ref = (r) => (r === 'AMSL' ? ' sobre el nivel del mar' : ' sobre el suelo');
  const num = (m) => `${Math.round(m).toLocaleString('es-ES')} m`;
  // Con referencias distintas, cada límite lleva la suya; si no, una sola al final
  // («desde el suelo hasta 900 m» no la necesita si es sobre el suelo).
  const mixta = conInf && conSup && z.inferior.ref !== z.superior.ref;
  const inf = conInf ? `desde ${num(z.inferior.m)}${mixta ? ref(z.inferior.ref) : ''}` : 'desde el suelo';
  const sup = conSup ? ` hasta ${num(z.superior.m)}${mixta ? ref(z.superior.ref) : ''}` : '';
  const unica = conSup ? z.superior.ref : z.inferior?.ref;
  const final = mixta || (!conInf && unica !== 'AMSL') ? '' : ref(unica);
  const s = `${inf}${sup}${final}`;
  return s[0].toUpperCase() + s.slice(1);
}
