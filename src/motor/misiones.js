// Modos y tipos de misión. El modo recreativo tiene una sola misión y el
// semáforo de siempre; el profesional añade las condiciones que exige cada
// trabajo (luz para fotogrametría, irradiancia para termografía FV...).
// Los umbrales de termografía siguen la práctica habitual (IEC TS 62446-3 para
// fotovoltaica): son orientativos y se pueden discutir con el cliente.

import { escalonMax, escalonMin, factor } from './factores.js';
import { fmtViento } from './unidades.js';

const KMH = 3.6;

function fotogrametria(h) {
  const cubierto = Number.isFinite(h.nubes) && h.nubes >= 85;
  let estado;
  let detalle;
  if (cubierto && h.solElev >= 5) {
    estado = 'ok';
    detalle = 'Cielo cubierto uniforme: luz sin sombras';
  } else {
    estado = escalonMin(h.solElev, 25, 15);
    detalle = estado === 'ok' ? 'Sol alto: sombras cortas' : 'Sol bajo: sombras largas en el modelo';
  }
  const nubes = Number.isFinite(h.nubes)
    ? h.nubes <= 20 || h.nubes >= 85
      ? 'ok'
      : 'precaucion'
    : 'sin-dato';
  return [
    factor('luz-foto', 'Luz para fotogrametría', estado, `${Math.round(h.solElev)}° de sol`, detalle),
    factor(
      'nubes-foto',
      'Nubes',
      nubes,
      Number.isFinite(h.nubes) ? `${Math.round(h.nubes)}%` : '—',
      nubes === 'precaucion' ? 'Nubes sueltas: la luz cambia entre fotos' : '',
    ),
  ];
}

function termografiaFV(h, ctx) {
  return [
    factor(
      'irradiancia',
      'Irradiancia',
      escalonMin(h.radiacion, 600, 500),
      Number.isFinite(h.radiacion) ? `${Math.round(h.radiacion)} W/m²` : '—',
      'Hace falta ≥ 600 W/m² para ver defectos en los módulos',
    ),
    factor(
      'nubes-fv',
      'Nubes',
      escalonMax(h.nubes, 25, 50),
      Number.isFinite(h.nubes) ? `${Math.round(h.nubes)}%` : '—',
      'Las nubes cambian la irradiancia entre una fila y otra',
    ),
    factor(
      'viento-suelo',
      'Viento en los paneles',
      escalonMax(h.viento10, 28 / KMH, 28 / KMH),
      fmtViento(h.viento10, ctx.ajustes.unidades),
      'Por encima de 28 km/h el viento enfría los módulos',
    ),
    factor(
      'mojado-fv',
      'Paneles secos',
      escalonMax(h.lluviaPrev3h, 0, 0.2),
      Number.isFinite(h.lluviaPrev3h) ? `${h.lluviaPrev3h.toFixed(1)} mm en 3 h` : '—',
      'Agua en el vidrio falsea la lectura',
    ),
  ];
}

function termografiaEdificios(h, ctx) {
  const delta = Number.isFinite(h.temp) ? ctx.ajustes.tempInterior - h.temp : null;
  const solDirecto =
    h.solElev <= 0 ? 'ok' : Number.isFinite(h.nubes) && h.nubes >= 60 ? 'precaucion' : 'no';
  return [
    factor(
      'delta-t',
      'Salto térmico',
      escalonMin(delta, 10, 7),
      Number.isFinite(delta) ? `${Math.round(delta)} °C` : '—',
      `Interior ${ctx.ajustes.tempInterior} °C: hace falta ≥ 10 °C de diferencia`,
    ),
    factor(
      'sol-fachada',
      'Sin sol en fachada',
      solDirecto,
      h.solElev <= 0 ? 'Sol bajo el horizonte' : `${Math.round(h.solElev)}° de sol`,
      'El sol calienta la fachada y tapa los puentes térmicos',
    ),
    factor(
      'mojado-fachada',
      'Fachada seca',
      escalonMax(h.lluviaPrev6h, 0, 0.2),
      Number.isFinite(h.lluviaPrev6h) ? `${h.lluviaPrev6h.toFixed(1)} mm en 6 h` : '—',
      'La humedad enfría la superficie al evaporarse',
    ),
    factor(
      'viento-fachada',
      'Viento en superficie',
      escalonMax(h.viento10, 5, 8),
      fmtViento(h.viento10, ctx.ajustes.unidades),
      'El viento enfría la fachada y borra las diferencias',
    ),
  ];
}

function inspeccion(h, ctx) {
  const exceso = Number.isFinite(h.racha10) && Number.isFinite(h.viento10) ? h.racha10 - h.viento10 : null;
  return [
    factor(
      'turbulencia',
      'Turbulencia',
      escalonMax(exceso, 4, 7),
      Number.isFinite(exceso) ? `+${fmtViento(exceso, ctx.ajustes.unidades)} en rachas` : '—',
      'Cerca de estructuras las rachas golpean más',
    ),
  ];
}

export const MISIONES = {
  recreativo: {
    id: 'recreativo',
    nombre: 'Vuelo recreativo',
    descripcion: 'Foto, vídeo y disfrutar: el semáforo de siempre',
  },
  general: {
    id: 'general',
    nombre: 'Operación general',
    descripcion: 'Semáforo completo con margen profesional',
  },
  fotogrametria: {
    id: 'fotogrametria',
    nombre: 'Fotogrametría / ortofoto',
    descripcion: 'Luz estable, sol alto o cubierto uniforme, poco viento',
    fraccionViento: 0.5,
    extra: fotogrametria,
  },
  termografia_fv: {
    id: 'termografia_fv',
    nombre: 'Termografía fotovoltaica',
    descripcion: 'Irradiancia ≥ 600 W/m², cielo despejado, módulos secos',
    extra: termografiaFV,
  },
  termografia_edificios: {
    id: 'termografia_edificios',
    nombre: 'Termografía de edificios',
    descripcion: 'Sin sol, salto térmico ≥ 10 °C, fachada seca: mejor antes del amanecer',
    nocturna: true,
    extra: termografiaEdificios,
  },
  inspeccion: {
    id: 'inspeccion',
    nombre: 'Inspección / vídeo técnico',
    descripcion: 'Margen de viento extra y ojo a la turbulencia',
    fraccionViento: 0.6,
    extra: inspeccion,
  },
};

export const MODOS = {
  recreativo: { id: 'recreativo', nombre: 'Recreativo', misiones: ['recreativo'] },
  profesional: {
    id: 'profesional',
    nombre: 'Profesional',
    misiones: ['general', 'fotogrametria', 'termografia_fv', 'termografia_edificios', 'inspeccion'],
  },
};

export function misionActiva(ajustes) {
  const modo = MODOS[ajustes.modo] ?? MODOS.recreativo;
  const id = modo.misiones.includes(ajustes.mision) ? ajustes.mision : modo.misiones[0];
  return MISIONES[id];
}
