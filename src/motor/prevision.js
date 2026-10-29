// El único cerebro: junta tiempo, Kp, satélites y sol, evalúa cada hora y
// saca la mejor ventana de cada día. La app y las pruebas pasan por aquí;
// nada más monta el contexto por su cuenta.

import { eventosSol, posicionSol } from './astro.js';
import { dronPorId, idDron } from './drones.js';
import { kpEn } from './kp.js';
import { techoNubes } from './meteo.js';
import { misionActiva } from './misiones.js';
import { antiguedadDias, contarVisibles } from './satelites.js';
import { evaluarHora } from './veredicto.js';
import { mejorVentana } from './ventanas.js';
import { rachaEnAltura, vientoEnAltura } from './viento.js';

export const AJUSTES_INICIALES = {
  modo: 'recreativo',
  dron: 'mini5pro',
  personalizado: { maxViento: 10, tempMin: -10, tempMax: 40, ip: null },
  mision: 'recreativo',
  altitud: 120,
  unidades: 'kmh',
  margenViento: 70,
  minSats: 12,
  maxKp: 4,
  permitirNoche: false,
  tempInterior: 20,
};

export function normalizarAjustes(a = {}) {
  const r = { ...AJUSTES_INICIALES, ...a };
  r.personalizado = { ...AJUSTES_INICIALES.personalizado, ...(a.personalizado ?? {}) };
  const acotar = (v, min, max, def) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : def);
  r.altitud = acotar(r.altitud, 2, 500, 120);
  r.margenViento = acotar(r.margenViento, 30, 100, 70);
  r.minSats = acotar(r.minSats, 4, 40, 12);
  r.maxKp = acotar(r.maxKp, 1, 9, 4);
  r.tempInterior = acotar(r.tempInterior, 5, 35, 20);
  r.personalizado.maxViento = acotar(r.personalizado.maxViento, 2, 30, 10);
  r.personalizado.tempMin = acotar(r.personalizado.tempMin, -40, 20, -10);
  r.personalizado.tempMax = acotar(r.personalizado.tempMax, 10, 60, 40);
  if (!['recreativo', 'profesional'].includes(r.modo)) r.modo = 'recreativo';
  // Categoría abierta: 120 m como mucho. En profesional se deja hasta 180.
  r.altitud = Math.min(r.altitud, r.modo === 'profesional' ? 180 : 120);
  r.mision = misionActiva(r).id;
  r.dron = idDron(r.dron);
  r.permitirNoche = Boolean(r.permitirNoche);
  return r;
}

// Crear un Intl.DateTimeFormat cuesta (en el móvil, mucho): uno por zona y se reutiliza.
const formatosDia = new Map();

function claveDia(ms, zona) {
  let f = formatosDia.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' });
    formatosDia.set(zona, f);
  }
  return f.format(new Date(ms));
}

function sumaPrevia(horas, k, n) {
  let s = 0;
  let alguna = false;
  for (let j = Math.max(0, k - n); j < k; j++) {
    if (Number.isFinite(horas[j].lluvia)) {
      s += horas[j].lluvia;
      alguna = true;
    }
  }
  return alguna ? s : k === 0 ? 0 : null;
}

/**
 * @param {object} p
 * @param {{horas: object[], zona: string, elevacion: number}} p.meteo  leerPrevision()
 * @param {Map} [p.consenso]  leerConsenso()
 * @param {object[]} [p.kp]  leerKp()
 * @param {object[]} [p.satelites]  formato de data/gnss.json
 * @param {{lat: number, lon: number}} p.lugar
 * @param {object} p.ajustes
 * @param {number} [p.ahora]
 */
export function construirPrevision({ meteo, consenso = new Map(), kp = [], satelites = [], lugar, ajustes, ahora = Date.now() }) {
  const aj = normalizarAjustes(ajustes);
  const dron = dronPorId(aj.dron, aj.personalizado);
  const mision = misionActiva(aj);
  const ctx = { ajustes: aj, dron, mision };
  const sats = antiguedadDias(satelites, ahora) <= 30 ? satelites : [];
  const alturaKm = ((meteo.elevacion ?? 0) + aj.altitud) / 1000;

  const horas = meteo.horas.map((base, k, todas) => {
    const viento = vientoEnAltura(base.niveles, aj.altitud);
    const h = {
      ...base,
      viento10: base.niveles[10],
      vientoAlt: viento.valor,
      estimado: viento.estimado,
      rachaAlt: rachaEnAltura(base.racha10, base.niveles[10], viento.valor),
      dirAlt: aj.altitud >= 60 && Number.isFinite(base.dir120) ? base.dir120 : base.dir10,
      solElev: posicionSol(base.ms + 1800000, lugar.lat, lugar.lon).elevacion,
      techo: techoNubes(base.temp, base.td),
      kp: kpEn(kp, base.ms),
      sats: sats.length ? contarVisibles(sats, base.ms, lugar.lat, lugar.lon, alturaKm) : null,
      lluviaPrev3h: sumaPrevia(todas, k, 3),
      lluviaPrev6h: sumaPrevia(todas, k, 6),
      ...(consenso.get(base.ms) ?? { dispersion: null, modelos: 0 }),
    };
    return { ...h, ...evaluarHora(h, ctx) };
  });

  const porDia = new Map();
  for (const h of horas) {
    const c = claveDia(h.ms, meteo.zona);
    if (!porDia.has(c)) porDia.set(c, []);
    porDia.get(c).push(h);
  }
  const hoy = claveDia(ahora, meteo.zona);
  const dias = [...porDia.entries()]
    .filter(([c]) => c >= hoy)
    .map(([clave, hs]) => {
      // Para hoy, la ventana se busca desde la hora en curso: una pasada no sirve.
      const futuras = hs.filter((h) => h.ms + 3600000 > ahora);
      return { clave, horas: hs, ventana: mejorVentana(futuras), sol: eventosSol(hs[0].ms, lugar.lat, lugar.lon) };
    });

  const actual = horas.find((h) => ahora >= h.ms && ahora < h.ms + 3600000) ?? null;
  return {
    ajustes: aj,
    dron,
    mision,
    zona: meteo.zona,
    horas,
    dias,
    actual,
    satelitesDisponibles: sats.length > 0,
  };
}

// Lo que enseña un favorito en la lista: la mejor ventana de hoy y mañana.
// Sale de construirPrevision, como todo lo demás.
export function resumenDias(prevision, n = 2) {
  return prevision.dias.slice(0, n).map((d) => ({ clave: d.clave, ventana: d.ventana }));
}
