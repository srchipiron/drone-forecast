// La gráfica de un día: el viento y las rachas a la altura de vuelo, hora a
// hora, con las rayas de «cómodo» y «límite» del semáforo. Aquí solo se
// calculan las coordenadas; la app las pinta en SVG.

/**
 * @param {Array<{ms: number, vientoAlt: number|null, rachaAlt: number|null, estado: string}>} horas
 * @param {{comodo: number, limite: number}} umbrales  umbralesViento()
 */
export function graficaDia(horas, umbrales, { ancho = 340, alto = 120, margen = 6 } = {}) {
  const valores = horas.flatMap((h) => [h.vientoAlt, h.rachaAlt]).filter(Number.isFinite);
  const max = Math.max(umbrales.limite * 1.25, ...valores, 1);
  const paso = (ancho - 2 * margen) / Math.max(1, horas.length - 1);
  const x = (i) => margen + i * paso;
  const y = (v) => alto - margen - (Math.min(v, max) / max) * (alto - 2 * margen);
  const r = (n) => Math.round(n * 10) / 10;
  // Un hueco en los datos corta la línea en vez de unir dos puntos lejanos.
  const linea = (clave) => {
    const tramos = [];
    let pluma = false;
    horas.forEach((h, i) => {
      if (Number.isFinite(h[clave])) {
        tramos.push(`${pluma ? 'L' : 'M'}${r(x(i))},${r(y(h[clave]))}`);
        pluma = true;
      } else pluma = false;
    });
    return tramos.join(' ');
  };
  return {
    ancho,
    alto,
    max,
    viento: linea('vientoAlt'),
    rachas: linea('rachaAlt'),
    yComodo: r(y(umbrales.comodo)),
    yLimite: r(y(umbrales.limite)),
    // Una franja por hora con el color del semáforo, centrada en su punto.
    franjas: horas.map((h, i) => ({ x: r(x(i) - paso / 2), ancho: r(paso), ms: h.ms, estado: h.estado })),
    xDe: horas.map((h, i) => ({ ms: h.ms, x: r(x(i)) })),
  };
}

// Indicador circular (como un instrumento de cabina): un arco de 240° que
// empieza abajo a la izquierda y acaba abajo a la derecha, con el hueco
// abajo. fraccion 0 → vacío, 1 → arco completo. Ángulos en grados, 0° = las 3
// del reloj y creciendo en el sentido de las agujas (coordenadas SVG).
export const INDICADOR = { cx: 60, cy: 60, r: 48, desde: 150, barrido: 240 };

export function puntoIndicador(fraccion, { cx, cy, r, desde, barrido } = INDICADOR) {
  const a = ((desde + barrido * Math.min(1, Math.max(0, fraccion))) * Math.PI) / 180;
  return { x: Math.round((cx + r * Math.cos(a)) * 100) / 100, y: Math.round((cy + r * Math.sin(a)) * 100) / 100 };
}

export function arcoIndicador(fraccion, geo = INDICADOR) {
  const f = Math.min(1, Math.max(0, fraccion));
  if (!(f > 0)) return '';
  const p0 = puntoIndicador(0, geo);
  const p1 = puntoIndicador(f, geo);
  const grande = geo.barrido * f > 180 ? 1 : 0;
  return `M${p0.x},${p0.y} A${geo.r},${geo.r} 0 ${grande} 1 ${p1.x},${p1.y}`;
}
