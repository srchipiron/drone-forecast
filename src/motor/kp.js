// Índice Kp de NOAA SWPC (observado y previsto, tramos de 3 horas).
// NOAA ha servido este producto como lista de listas con cabecera y como
// lista de objetos: se aceptan los dos.

export const URL_KP = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';
const TRAMO = 3 * 3600000;

function instante(texto) {
  const s = String(texto).trim().replace(' ', 'T');
  return Date.parse(/Z|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
}

export function leerKp(json) {
  if (!Array.isArray(json)) return [];
  let filas = json;
  if (Array.isArray(json[0])) {
    const cab = json[0].map((c) => String(c).toLowerCase());
    const it = cab.indexOf('time_tag');
    const ik = cab.indexOf('kp');
    const io = cab.indexOf('observed');
    filas = json.slice(1).map((f) => ({ time_tag: f[it], kp: f[ik], observed: io >= 0 ? f[io] : null }));
  }
  return filas
    .map((f) => ({
      desde: instante(f.time_tag),
      kp: Number(f.kp ?? f.Kp),
      observado: String(f.observed ?? '').toLowerCase() === 'observed',
    }))
    .filter((t) => Number.isFinite(t.desde) && Number.isFinite(t.kp))
    .sort((a, b) => a.desde - b.desde);
}

export function kpEn(tramos, ms) {
  for (const t of tramos) if (ms >= t.desde && ms < t.desde + TRAMO) return t.kp;
  return null;
}
