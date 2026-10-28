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
