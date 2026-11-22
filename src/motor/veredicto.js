// El semáforo de UNA hora: los factores de siempre más los de la misión.

import { escalonMax, escalonMin, factor, peor } from './factores.js';
import { NOMBRES_MODELO } from './meteo.js';
import { fmtViento, puntoCardinal } from './unidades.js';

const TORMENTA = new Set([95, 96, 99]);
const NIEBLA = new Set([45, 48]);
const NIEVE = new Set([71, 73, 75, 77, 85, 86]);
// Engelante: llovizna o lluvia que se congela al tocar (WMO 56, 57, 66, 67).
const ENGELANTE = new Set([56, 57, 66, 67]);
// Humedad visible (niebla, llovizna, lluvia, nieve, chubascos): lo que hace
// falta, con frío, para que se forme hielo.
const HUMEDAD_VISIBLE = new Set([45, 48, 51, 53, 55, 61, 63, 65, 71, 73, 75, 77, 80, 81, 82, 85, 86]);

// Los dos umbrales del viento: hasta «comodo» es verde, hasta «limite»
// ámbar. Los usa el factor y el perfil de viento, para que digan lo mismo.
export function umbralesViento({ dron, ajustes, mision }) {
  const fraccion = mision.fraccionViento ?? ajustes.margenViento / 100;
  return { comodo: dron.maxViento * fraccion, limite: dron.maxViento };
}

function fViento(h, ctx) {
  const { dron, ajustes } = ctx;
  const { comodo, limite } = umbralesViento(ctx);
  // Sin dato de viento no se puede decir que se puede volar: ámbar, nunca verde.
  if (!Number.isFinite(h.vientoAlt))
    return factor('viento', `Viento a ${ajustes.altitud} m`, 'precaucion', '—', 'Sin dato de viento: mira tú el viento antes de despegar');
  const estado = escalonMax(h.vientoAlt, comodo, limite);
  const dir = puntoCardinal(h.dirAlt);
  return factor(
    'viento',
    `Viento a ${ajustes.altitud} m`,
    estado,
    `${fmtViento(h.vientoAlt, ajustes.unidades)}${dir ? ` ${dir}` : ''}`,
    `Cómodo hasta ${fmtViento(comodo, ajustes.unidades)} · límite del dron ${fmtViento(limite, ajustes.unidades)}${h.estimado ? ' · estimado' : ''}`,
  );
}

// El rojo sale de la previsión principal (la que mejor acierta en el sitio):
// si ella dice que las rachas pasan el límite del dron, no se vuela. Si solo
// otro modelo las ve así, ámbar: no se esconde, pero tampoco se da por hecho.
function fRachas(h, ctx) {
  const { dron, ajustes } = ctx;
  let estado = escalonMax(h.rachaAlt, dron.maxViento * 0.8, dron.maxViento);
  let detalle = 'Estimadas en altura a partir de la racha a 10 m';
  const m = h.rachaModelos;
  if (m && Number.isFinite(m.valor) && m.valor > dron.maxViento && (estado === 'ok' || estado === 'precaucion')) {
    estado = 'precaucion';
    detalle = `${NOMBRES_MODELO[m.modelo] ?? m.modelo} ve rachas de ${fmtViento(m.valor, ajustes.unidades)}, por encima del límite de tu dron`;
  }
  return factor('rachas', 'Rachas', estado, fmtViento(h.rachaAlt, ajustes.unidades), detalle);
}

// Tormenta posible aunque el modelo no la pinte (CAPE y índice de elevación,
// lo que miran Windy o Meteoblue para las tormentas de tarde). Umbrales del
// NOAA SPC: CAPE > 1000 J/kg es inestabilidad moderada; índice de
// elevación ≤ −2, aire inestable. Ámbar, no rojo: indica que PUEDEN
// formarse, no que vaya a haber; el rojo lo pone la tormenta prevista.
function fTormenta(h) {
  if (!Number.isFinite(h.cape)) return null;
  if (TORMENTA.has(h.codigo)) return null; // ya la pone en rojo fLluvia
  const li = Number.isFinite(h.li) ? h.li : null;
  const valor = `CAPE ${Math.round(h.cape)} J/kg${li !== null ? ` · índice ${li.toFixed(1)}` : ''}`;
  if (h.cape >= 1000 && (li === null || li <= -2))
    return factor('tormenta', 'Riesgo de tormenta', 'precaucion', valor, 'Aire muy inestable: pueden formarse tormentas de repente. Mira el cielo y ten un plan para aterrizar rápido');
  if (h.cape >= 300 && li !== null && li <= 0 && (h.probLluvia ?? 0) >= 30)
    return factor('tormenta', 'Riesgo de tormenta', 'precaucion', valor, 'Aire inestable y chubascos posibles: puede caer alguno tormentoso');
  return factor('tormenta', 'Riesgo de tormenta', 'ok', valor, 'Atmósfera estable');
}

const giro = (a, b) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};

// Turbulencia: lo que no dice el viento medio. Factor de racha (racha ÷
// viento a 10 m): sobre tierra lo normal es 1,3-1,5 (OMM, Guía de
// instrumentos, 8.ª ed.); desde 1,7 con rachas de 7 m/s o más el aire va
// a golpes. Y cizalladura: el viento que gira 60° o más entre el suelo y
// los 120 m, o que aumenta 6 m/s o más, sacude el dron al subir.
function fTurbulencia(h, ctx) {
  const v10 = h.niveles?.[10];
  if (!Number.isFinite(v10) || !Number.isFinite(h.racha10)) return null;
  const avisos = [];
  const fr = v10 >= 3 ? h.racha10 / v10 : null;
  if (fr !== null && fr >= 1.7 && h.racha10 >= 7) avisos.push(`viento racheado (rachas ${fr.toFixed(1)} veces el viento medio)`);
  if (ctx.ajustes.altitud >= 60 && Number.isFinite(h.dir10) && Number.isFinite(h.dir120) && Number.isFinite(h.vientoAlt) && h.vientoAlt >= 5 && giro(h.dir10, h.dir120) >= 60)
    avisos.push(`el viento gira ${Math.round(giro(h.dir10, h.dir120))}° entre el suelo y 120 m`);
  if (Number.isFinite(h.vientoAlt) && h.vientoAlt - v10 >= 6) avisos.push(`a tu altura sopla ${fmtViento(h.vientoAlt - v10, ctx.ajustes.unidades)} más que en el suelo`);
  if (!avisos.length) return factor('turbulencia', 'Turbulencia', 'ok', 'Sin señales', 'Viento regular y sin cambios bruscos con la altura');
  return factor('turbulencia', 'Turbulencia', 'precaucion', avisos.length === 1 ? 'Posible' : 'Probable', `${avisos.join('; ')}. Despega y prueba a poca altura antes de subir`);
}

function fLluvia(h, ctx) {
  if (TORMENTA.has(h.codigo)) return factor('lluvia', 'Lluvia', 'no', 'Tormenta', 'Rayos y rachas: no se vuela');
  const ip = Boolean(ctx.dron.ip);
  const prob = Number.isFinite(h.probLluvia) ? h.probLluvia : null;
  const mm = Number.isFinite(h.lluvia) ? h.lluvia : null;
  if (prob === null && mm === null) return factor('lluvia', 'Lluvia', 'sin-dato', '—');
  let estado = 'ok';
  if ((mm ?? 0) > 0.3 || (prob ?? 0) >= 70 || NIEVE.has(h.codigo)) estado = ip ? 'precaucion' : 'no';
  else if ((mm ?? 0) > 0 || (prob ?? 0) >= 30) estado = 'precaucion';
  return factor(
    'lluvia',
    'Lluvia',
    estado,
    `${prob ?? '—'}% · ${(mm ?? 0).toFixed(1)} mm`,
    ip ? `Tu dron es ${ctx.dron.ip}: aguanta lluvia ligera` : 'Tu dron no está protegido contra el agua',
  );
}

function fTemperatura(h, ctx) {
  const { tempMin, tempMax } = ctx.dron;
  const t = h.temp;
  if (!Number.isFinite(t)) return factor('temperatura', 'Temperatura', 'sin-dato', '—');
  let estado = 'ok';
  let detalle = `Rango del dron: ${tempMin} a ${tempMax} °C`;
  if (t < tempMin || t > tempMax) estado = 'no';
  else if (t < 5 || t > tempMax - 5) {
    estado = 'precaucion';
    detalle = t < 5 ? 'Frío: calienta las baterías antes de despegar' : 'Calor: vigila la temperatura de las baterías';
  }
  return factor('temperatura', 'Temperatura', estado, `${Math.round(t)} °C`, detalle);
}

// Hielo en las hélices (como «icing» en Aloft o UAV Forecast). El hielo se
// forma con humedad visible y temperatura entre 0 y −20 °C (FAA, Aviation
// Weather Handbook, FAA-H-8083-28, cap. 18); se avisa ya desde +3 °C
// porque a la altura de vuelo hace algo más de frío (−0,65 °C cada 100 m) y
// la pala, al girar, se enfría por evaporación. Por debajo de −20 °C el agua
// ya está congelada y no se pega. Un poco de hielo en las palas basta para
// que pierdan sustentación. Solo sale cuando hay frío: con calor, no estorba.
function fHielo(h, ctx) {
  if (!Number.isFinite(h.temp)) return null;
  const t = h.temp - 0.0065 * ctx.ajustes.altitud;
  if (t > 3 || t < -20) return null;
  const valor = `${Math.round(t)} °C a ${ctx.ajustes.altitud} m`;
  if (ENGELANTE.has(h.codigo)) return factor('hielo', 'Hielo en las hélices', 'no', valor, 'Lluvia o llovizna engelante: el hielo se forma seguro');
  const saturado = Number.isFinite(h.td) && h.temp - h.td <= 1;
  const enNube = Number.isFinite(h.techo) && (Number.isFinite(h.nubesBajas) ? h.nubesBajas : (h.nubes ?? 0)) >= 50 && h.techo <= ctx.ajustes.altitud;
  if (HUMEDAD_VISIBLE.has(h.codigo) || saturado || enNube)
    return factor(
      'hielo',
      'Hielo en las hélices',
      'precaucion',
      valor,
      `Frío con ${enNube ? 'nubes a tu altura' : saturado ? 'el aire saturado' : 'humedad visible'}: puede formarse hielo en las palas. Mira las hélices antes y después de cada vuelo`,
    );
  return factor('hielo', 'Hielo en las hélices', 'ok', valor, 'Hace frío pero el aire está seco: sin riesgo de hielo');
}

// Niebla que se puede formar aunque el modelo no la pinte: la de radiación
// nace con el aire casi saturado (rocío a 1 °C o menos), viento flojo (hasta
// 2 m/s) y sin sol (noche, amanecer). Ámbar: avisa, no la da por hecha.
function nieblaPosible(h) {
  return Number.isFinite(h.temp) && Number.isFinite(h.td) && h.temp - h.td <= 1 && Number.isFinite(h.niveles?.[10]) && h.niveles[10] <= 2 && Number.isFinite(h.solElev) && h.solElev < 5;
}

function fVisibilidad(h) {
  if (NIEBLA.has(h.codigo)) return factor('visibilidad', 'Visibilidad', 'no', 'Niebla', 'Sin contacto visual no se vuela');
  const km = Number.isFinite(h.visibilidad) ? h.visibilidad / 1000 : null;
  let estado = escalonMin(km, 5, 1.5);
  let detalle = 'Hace falta ver el dron (vuelo en VLOS)';
  if (nieblaPosible(h) && (estado === 'ok' || estado === 'sin-dato')) {
    estado = 'precaucion';
    detalle = 'Aire saturado, sin viento y sin sol: puede formarse niebla de repente';
  }
  return factor('visibilidad', 'Visibilidad', estado, km === null ? '—' : km >= 10 ? '> 10 km' : `${km.toFixed(1)} km`, detalle);
}

// Con el dato de nubes BAJAS se juzga con ellas: un cielo cubierto de cirros
// no tapa el dron. Sin él, con la nubosidad total (más prudente).
function fTecho(h, ctx) {
  const cob = Number.isFinite(h.nubesBajas) ? h.nubesBajas : h.nubes;
  if (!Number.isFinite(h.techo) || !Number.isFinite(cob))
    return factor('techo', 'Base de nubes', 'sin-dato', '—');
  if (cob < 30) return factor('techo', 'Base de nubes', 'ok', 'Sin techo bajo', Number.isFinite(h.nubesBajas) ? `Nubes bajas: ${Math.round(h.nubesBajas)} %` : 'Pocas nubes');
  const margen = h.techo - ctx.ajustes.altitud;
  return factor(
    'techo',
    'Base de nubes',
    margen < 30 ? 'no' : margen < 150 ? 'precaucion' : 'ok',
    `≈ ${Math.round(h.techo / 10) * 10} m`,
    'Estimada a partir de temperatura y punto de rocío',
  );
}

function fKp(h, ctx) {
  const max = ctx.ajustes.maxKp;
  return factor(
    'kp',
    'Índice Kp',
    escalonMax(h.kp, max, max + 1),
    Number.isFinite(h.kp) ? h.kp.toFixed(1) : '—',
    Number.isFinite(h.kp)
      ? 'Actividad geomagnética: con Kp alto el GPS y la brújula fallan más'
      : 'NOAA solo predice unos 3 días',
  );
}

function fSatelites(h, ctx) {
  const min = ctx.ajustes.minSats;
  const total = h.sats?.total;
  const detalle = h.sats
    ? Object.entries(h.sats.porConstelacion)
        .map(([c, n]) => `${c} ${n}`)
        .join(' · ')
    : 'Sin órbitas descargadas';
  return factor('satelites', 'Satélites (>10°)', escalonMin(total, min, Math.ceil(min * 0.67)), total ?? '—', detalle);
}

function fLuz(h, ctx) {
  const e = h.solElev;
  if (e >= -0.833) return factor('luz', 'Luz', 'ok', e >= 6 ? 'De día' : 'Hora dorada', '');
  if (e >= -6) return factor('luz', 'Luz', 'precaucion', 'Crepúsculo', 'Poca luz: cuesta ver el dron');
  const permitido = ctx.ajustes.permitirNoche || ctx.mision.nocturna;
  return factor(
    'luz',
    'Luz',
    permitido ? 'precaucion' : 'no',
    'Noche',
    permitido
      ? 'Vuelo nocturno: revisa los requisitos de tu categoría (luz, autorización)'
      : 'Activa «permitir vuelo nocturno» en Ajustes si vas a volar de noche',
  );
}

function fConsenso(h, ctx) {
  if (!Number.isFinite(h.dispersion) || !(h.modelos >= 2))
    return factor('consenso', 'Acuerdo entre modelos', 'sin-dato', '—');
  return factor(
    'consenso',
    'Acuerdo entre modelos',
    h.dispersion >= 4 ? 'precaucion' : 'ok',
    `±${fmtViento(h.dispersion / 2, ctx.ajustes.unidades)}`,
    `${h.modelos} modelos: ${h.dispersion >= 4 ? 'discrepan en el viento, fíate menos' : 'coinciden en el viento'}${
      h.valores
        ? ` (a 10 m: ${Object.entries(h.valores)
            .map(([m, x]) => `${NOMBRES_MODELO[m] ?? m} ${fmtViento(x, ctx.ajustes.unidades)}`)
            .join(' · ')})`
        : ''
    }`,
  );
}

export function evaluarHora(h, ctx) {
  const factores = [
    fViento(h, ctx),
    fRachas(h, ctx),
    fTurbulencia(h, ctx),
    fLluvia(h, ctx),
    fTormenta(h),
    fTemperatura(h, ctx),
    fHielo(h, ctx),
    fVisibilidad(h),
    fTecho(h, ctx),
    fLuz(h, ctx),
    fKp(h, ctx),
    fSatelites(h, ctx),
    fConsenso(h, ctx),
    ...(ctx.mision.extra ? ctx.mision.extra(h, ctx) : []),
  ].filter(Boolean);
  return { factores, estado: peor(factores) };
}
