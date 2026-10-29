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
