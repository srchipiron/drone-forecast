// El semáforo de UNA hora: los factores de siempre más los de la misión.

import { escalonMax, escalonMin, factor, peor } from './factores.js';
import { fmtViento, puntoCardinal } from './unidades.js';

const TORMENTA = new Set([95, 96, 99]);
const NIEBLA = new Set([45, 48]);
const NIEVE = new Set([71, 73, 75, 77, 85, 86]);

function fViento(h, ctx) {
  const { dron, ajustes, mision } = ctx;
  const fraccion = mision.fraccionViento ?? ajustes.margenViento / 100;
  const estado = escalonMax(h.vientoAlt, dron.maxViento * fraccion, dron.maxViento);
  const dir = puntoCardinal(h.dirAlt);
  return factor(
    'viento',
    `Viento a ${ajustes.altitud} m`,
    estado,
    `${fmtViento(h.vientoAlt, ajustes.unidades)}${dir ? ` ${dir}` : ''}`,
    `Cómodo hasta ${fmtViento(dron.maxViento * fraccion, ajustes.unidades)} · límite del dron ${fmtViento(dron.maxViento, ajustes.unidades)}${h.estimado ? ' · estimado' : ''}`,
  );
}

function fRachas(h, ctx) {
  const { dron, ajustes } = ctx;
  return factor(
    'rachas',
    'Rachas',
    escalonMax(h.rachaAlt, dron.maxViento * 0.8, dron.maxViento),
    fmtViento(h.rachaAlt, ajustes.unidades),
    'Estimadas en altura a partir de la racha a 10 m',
  );
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

function fVisibilidad(h) {
  if (NIEBLA.has(h.codigo)) return factor('visibilidad', 'Visibilidad', 'no', 'Niebla', 'Sin contacto visual no se vuela');
  const km = Number.isFinite(h.visibilidad) ? h.visibilidad / 1000 : null;
  return factor(
    'visibilidad',
    'Visibilidad',
    escalonMin(km, 5, 1.5),
    km === null ? '—' : km >= 10 ? '> 10 km' : `${km.toFixed(1)} km`,
    'Hace falta ver el dron (vuelo en VLOS)',
  );
}

function fTecho(h, ctx) {
  if (!Number.isFinite(h.techo) || !Number.isFinite(h.nubes))
    return factor('techo', 'Base de nubes', 'sin-dato', '—');
  if (h.nubes < 30) return factor('techo', 'Base de nubes', 'ok', 'Sin techo bajo', 'Pocas nubes');
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
    `${h.modelos} modelos: ${h.dispersion >= 4 ? 'discrepan en el viento, fíate menos' : 'coinciden en el viento'}`,
  );
}

export function evaluarHora(h, ctx) {
  const factores = [
    fViento(h, ctx),
    fRachas(h, ctx),
    fLluvia(h, ctx),
    fTemperatura(h, ctx),
    fVisibilidad(h),
    fTecho(h, ctx),
    fLuz(h, ctx),
    fKp(h, ctx),
    fSatelites(h, ctx),
    fConsenso(h, ctx),
    ...(ctx.mision.extra ? ctx.mision.extra(h, ctx) : []),
  ];
  return { factores, estado: peor(factores) };
}
