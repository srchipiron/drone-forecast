// Un factor es una cosa que se mira en cada hora (viento, lluvia, Kp...).
// Su estado es 'ok', 'precaucion', 'no' o 'sin-dato'; la hora vale lo que
// valga su peor factor. 'sin-dato' no bloquea: se enseña, pero no decide.

export const ORDEN = { 'sin-dato': 0, ok: 1, precaucion: 2, no: 3 };

export function factor(id, nombre, estado, valor, detalle = '') {
  return { id, nombre, estado, valor, detalle };
}

export function peor(factores) {
  let estado = 'ok';
  for (const f of factores) if (ORDEN[f.estado] > ORDEN[estado]) estado = f.estado;
  return estado;
}

// Escalón «hasta a es ok, hasta b precaución, si no, no» (para "cuanto menos, mejor").
export function escalonMax(valor, a, b) {
  if (!Number.isFinite(valor)) return 'sin-dato';
  if (valor <= a) return 'ok';
  if (valor <= b) return 'precaucion';
  return 'no';
}

// Lo mismo para "cuanto más, mejor".
export function escalonMin(valor, a, b) {
  if (!Number.isFinite(valor)) return 'sin-dato';
  if (valor >= a) return 'ok';
  if (valor >= b) return 'precaucion';
  return 'no';
}
