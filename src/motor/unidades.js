// Todo el motor trabaja en m/s; esto es solo para enseñarlo.

export const UNIDADES = {
  kmh: { id: 'kmh', nombre: 'km/h', factor: 3.6 },
  ms: { id: 'ms', nombre: 'm/s', factor: 1 },
  kn: { id: 'kn', nombre: 'nudos', factor: 1.943844 },
};

export function fmtViento(ms, unidades = 'kmh') {
  if (!Number.isFinite(ms)) return '—';
  const u = UNIDADES[unidades] ?? UNIDADES.kmh;
  const v = ms * u.factor;
  return `${u.id === 'ms' ? v.toFixed(1) : Math.round(v)} ${u.nombre}`;
}

export const PUNTOS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

export function puntoCardinal(grados) {
  if (!Number.isFinite(grados)) return '';
  return PUNTOS[Math.round((((grados % 360) + 360) % 360) / 45) % 8];
}
