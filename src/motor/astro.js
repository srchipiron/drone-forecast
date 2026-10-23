// Sol y tiempo sidéreo. Precisión de décimas de grado: de sobra para saber
// si es de día, si hay hora dorada o si el sol da de lleno en un panel.

const RAD = Math.PI / 180;

export function diasJ2000(ms) {
  return ms / 86400000 + 2440587.5 - 2451545.0;
}

// Ángulo de rotación terrestre (≈ GMST), en radianes.
export function gmst(ms) {
  const t = diasJ2000(ms);
  const vueltas = 0.779057273264 + 1.00273781191135448 * t;
  return 2 * Math.PI * (((vueltas % 1) + 1) % 1);
}

export function posicionSol(ms, lat, lon) {
  const d = diasJ2000(ms);
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const H = gmst(ms) + lon * RAD - ra;
  const phi = lat * RAD;
  const elev = Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H),
  );
  const az = Math.atan2(
    -Math.sin(H),
    Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H),
  );
  return { elevacion: elev / RAD, azimut: ((az / RAD) % 360 + 360) % 360 };
}

// Salida y puesta (sol a -0,833°) y hora dorada dentro de [desde, desde+24h).
// Se busca por muestreo cada 2 minutos: funciona también sin salida ni puesta.
export function eventosSol(desde, lat, lon) {
  const PASO = 2 * 60000;
  const cruces = (umbral) => {
    const subidas = [];
    const bajadas = [];
    let prev = posicionSol(desde, lat, lon).elevacion;
    for (let t = desde + PASO; t <= desde + 86400000; t += PASO) {
      const ahora = posicionSol(t, lat, lon).elevacion;
      if ((prev - umbral) * (ahora - umbral) < 0 || (ahora === umbral && prev !== umbral)) {
        const f = (umbral - prev) / (ahora - prev);
        const cuando = Math.round(t - PASO + f * PASO);
        (ahora > prev ? subidas : bajadas).push(cuando);
      }
      prev = ahora;
    }
    return { subidas, bajadas };
  };
  const horizonte = cruces(-0.833);
  const dorada = cruces(6);
  return {
    salida: horizonte.subidas[0] ?? null,
    puesta: horizonte.bajadas[0] ?? null,
    doradaManana: dorada.subidas[0] ?? null,
    doradaTarde: dorada.bajadas[0] ?? null,
  };
}

// Qué luz hay: 'dia', 'dorada' (sol bajo, -4° a 6°), 'crepusculo' o 'noche'.
export function tipoLuz(elevacion) {
  if (elevacion >= 6) return 'dia';
  if (elevacion >= -0.833) return 'dorada';
  if (elevacion >= -6) return 'crepusculo';
  return 'noche';
}
