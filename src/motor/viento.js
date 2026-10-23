// Viento a la altura de vuelo a partir de los niveles que da el modelo
// (10, 80, 120 y 180 m). Entre niveles se interpola en logaritmo de la altura,
// que es como crece el viento cerca del suelo.

export const NIVELES = [10, 80, 120, 180];
const ALFA = 0.14; // ley potencial en terreno abierto, para lo que no da el modelo

export function vientoEnAltura(niveles, altura) {
  const pares = NIVELES.map((h) => [h, niveles[h]]).filter(([, v]) => Number.isFinite(v));
  if (!pares.length) return { valor: null, estimado: true };
  const h = Math.max(2, altura);
  if (pares.length === 1 || h <= pares[0][0]) {
    const [h0, v0] = pares[0];
    return { valor: v0 * (h / h0) ** ALFA, estimado: h !== h0 };
  }
  for (let k = 0; k < pares.length - 1; k++) {
    const [h1, v1] = pares[k];
    const [h2, v2] = pares[k + 1];
    if (h <= h2) {
      const f = (Math.log(h) - Math.log(h1)) / (Math.log(h2) - Math.log(h1));
      return { valor: v1 + (v2 - v1) * f, estimado: false };
    }
  }
  const [hN, vN] = pares[pares.length - 1];
  return { valor: vN * (h / hN) ** ALFA, estimado: true };
}

// Rachas en altura: el modelo solo da la racha a 10 m. Se suma el mismo
// exceso sobre el viento medio, lo prudente: arriba el exceso suele ser menor.
export function rachaEnAltura(racha10, viento10, vientoAlt) {
  if (!Number.isFinite(racha10)) return null;
  if (!Number.isFinite(viento10) || !Number.isFinite(vientoAlt)) return racha10;
  return Math.max(vientoAlt, vientoAlt + (racha10 - viento10));
}
