// La mejor ventana de un día: el tramo seguido más largo de horas en verde.
// Si no hay ninguna, el más largo en ámbar (se avisa de que es con precaución).
// A igual duración gana la que empieza antes.

function tramos(horas, aceptable) {
  const salida = [];
  let actual = null;
  for (const h of horas) {
    if (aceptable(h.estado)) {
      if (actual && h.ms - actual.ultima <= 3600000) {
        actual.ultima = h.ms;
        actual.horas++;
      } else {
        actual = { inicio: h.ms, ultima: h.ms, horas: 1 };
        salida.push(actual);
      }
    } else actual = null;
  }
  return salida;
}

function masLarga(lista) {
  let mejor = null;
  for (const t of lista) if (!mejor || t.horas > mejor.horas) mejor = t;
  return mejor;
}

export function mejorVentana(horas) {
  const verde = masLarga(tramos(horas, (e) => e === 'ok'));
  if (verde) return { inicio: verde.inicio, fin: verde.ultima + 3600000, horas: verde.horas, estado: 'ok' };
  const ambar = masLarga(tramos(horas, (e) => e === 'ok' || e === 'precaucion'));
  if (ambar) return { inicio: ambar.inicio, fin: ambar.ultima + 3600000, horas: ambar.horas, estado: 'precaucion' };
  return null;
}

/**
 * La próxima ventana a partir de hoy: la primera VERDE de los días que vienen
 * (la de hoy ya cuenta solo desde la hora en curso); si en toda la previsión
 * no hay ninguna verde, la primera en ámbar. null si no hay nada volable.
 * @param {Array<{clave: string, ventana: object|null}>} dias  construirPrevision().dias
 */
export function proximaVentana(dias) {
  for (const estado of ['ok', 'precaucion']) {
    const k = dias.findIndex((d) => d.ventana?.estado === estado);
    if (k >= 0) return { k, clave: dias[k].clave, ventana: dias[k].ventana };
  }
  return null;
}
