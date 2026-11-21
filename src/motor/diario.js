// Diario de vuelos: cada vuelo guarda lo que decía la app en esa hora y cómo
// fue de verdad. Con el tiempo dice si los umbrales encajan con la
// experiencia: si los vuelos en ámbar salen siempre bien, el margen es
// demasiado prudente; si los verdes salen regular, demasiado optimista.

export const VALORACIONES = { bien: 'Bien', regular: 'Regular', mal: 'Mal' };
export const MAXIMO_ENTRADAS = 500;

/**
 * @param {object} p  construirPrevision()
 * @param {object} h  la hora volada (de p.horas)
 * @param {{nombre: string, lat: number, lon: number}} lugar
 * @param {{valoracion: string, nota: string, ms: number}} vuelo
 */
export function crearEntrada(p, h, lugar, { valoracion, nota = '', ms }) {
  if (!(valoracion in VALORACIONES)) throw new Error(`valoración desconocida: ${valoracion}`);
  return {
    id: `${ms}-${Math.round(lugar.lat * 1e4)}-${Math.round(lugar.lon * 1e4)}`,
    ms,
    lugar: { nombre: String(lugar.nombre ?? ''), lat: lugar.lat, lon: lugar.lon },
    dron: p.dron.nombre,
    modo: p.ajustes.modo,
    mision: p.mision.nombre,
    altitud: p.ajustes.altitud,
    prevision: {
      estado: h.estado,
      vientoAlt: h.vientoAlt,
      rachaAlt: h.rachaAlt,
      kp: h.kp,
      sats: h.sats?.total ?? null,
      // Los factores que no estaban en verde, para saber por qué avisaba.
      avisos: h.factores.filter((f) => f.estado === 'precaucion' || f.estado === 'no').map((f) => f.id),
    },
    valoracion,
    nota: String(nota).slice(0, 500),
  };
}

// Lo nuevo delante y con tope: el almacenamiento del móvil no es infinito.
export function anadirEntrada(diario, entrada) {
  return [entrada, ...diario.filter((e) => e.id !== entrada.id)].slice(0, MAXIMO_ENTRADAS);
}

// Cuántos vuelos salieron bien/regular/mal según lo que decía la app.
export function resumenDiario(diario) {
  const tabla = {};
  for (const estado of ['ok', 'precaucion', 'no']) tabla[estado] = { bien: 0, regular: 0, mal: 0, total: 0 };
  for (const e of diario) {
    const fila = tabla[e?.prevision?.estado];
    if (!fila || !(e.valoracion in VALORACIONES)) continue;
    fila[e.valoracion]++;
    fila.total++;
  }
  return tabla;
}

// Lo leído del almacenamiento son datos: se descartan las entradas rotas.
export function diarioValido(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.filter(
    (e) =>
      e &&
      typeof e.id === 'string' &&
      Number.isFinite(e.ms) &&
      e.lugar &&
      Number.isFinite(e.lugar.lat) &&
      e.valoracion in VALORACIONES &&
      e.prevision &&
      typeof e.prevision.estado === 'string',
  );
}

// ---------- Exportar a hoja de cálculo ----------

const NOMBRE_ESTADO = { ok: 'Verde', precaucion: 'Ámbar', no: 'Rojo', 'sin-dato': 'Sin dato' };
const NOMBRE_AVISO = {
  viento: 'viento',
  rachas: 'rachas',
  lluvia: 'lluvia',
  temperatura: 'temperatura',
  hielo: 'hielo en las hélices',
  visibilidad: 'visibilidad',
  techo: 'nubes bajas',
  kp: 'Kp',
  satelites: 'satélites',
  luz: 'luz',
  'luz-foto': 'luz para fotogrametría',
  consenso: 'desacuerdo entre modelos',
};

export const COLUMNAS_CSV = ['Fecha', 'Hora', 'Lugar', 'Latitud', 'Longitud', 'Dron', 'Misión', 'Altura (m)', 'Previsión', 'Viento (m/s)', 'Rachas (m/s)', 'Kp', 'Satélites', 'Avisos', 'Valoración', 'Nota'];

// Una celda de texto. Separador «;» y coma decimal: es lo que esperan Excel y
// Hojas de cálculo en español (con «,» meterían todo en una columna). El
// texto que empieza por = + - @ se lleva un apóstrofo delante: el nombre del
// lugar viene de fuera y la nota la escribe cualquiera, y una hoja de cálculo
// ejecutaría «=HIPERVINCULO(…)» como fórmula (inyección CSV, OWASP).
function celdaTexto(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function celdaNumero(v, decimales) {
  return Number.isFinite(v) ? v.toFixed(decimales).replace('.', ',') : '';
}

function partesFecha(ms, zona) {
  const f = new Intl.DateTimeFormat('es-ES', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return [`${p.year}-${p.month}-${p.day}`, `${p.hour}:${p.minute}`];
}

/**
 * El diario como CSV (texto, con BOM para que Excel lea bien los acentos).
 * @param {object[]} diario  diarioValido()
 * @param {string} [zona]  zona horaria de las fechas (la del móvil si no se da)
 */
export function diarioCSV(diario, zona) {
  const filas = [COLUMNAS_CSV.map(celdaTexto).join(';')];
  for (const e of diario) {
    const pr = e.prevision ?? {};
    filas.push(
      [
        ...partesFecha(e.ms, zona).map(celdaTexto),
        celdaTexto(e.lugar?.nombre),
        celdaNumero(e.lugar?.lat, 5),
        celdaNumero(e.lugar?.lon, 5),
        celdaTexto(e.dron),
        celdaTexto(e.mision),
        celdaNumero(e.altitud, 0),
        celdaTexto(NOMBRE_ESTADO[pr.estado] ?? pr.estado),
        celdaNumero(pr.vientoAlt, 1),
        celdaNumero(pr.rachaAlt, 1),
        celdaNumero(pr.kp, 1),
        celdaNumero(pr.sats, 0),
        celdaTexto((Array.isArray(pr.avisos) ? pr.avisos : []).map((a) => NOMBRE_AVISO[a] ?? a).join(', ')),
        celdaTexto(VALORACIONES[e.valoracion] ?? e.valoracion),
        celdaTexto(e.nota),
      ].join(';'),
    );
  }
  return `\uFEFF${filas.join('\r\n')}\r\n`;
}
