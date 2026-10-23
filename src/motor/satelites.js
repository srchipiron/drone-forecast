// Satélites GNSS visibles. Propagación kepleriana con la deriva secular de J2:
// para órbitas medias (GPS, Galileo...) el error a pocos días de la época es de
// decenas de km, que a 20.000 km de distancia no mueve un satélite de "visible"
// a "no visible" salvo justo en la máscara. No hace falta SGP4 completo.

import { gmst } from './astro.js';

const RAD = Math.PI / 180;
const MU = 398600.4418; // km³/s²
const RE = 6378.137; // km
const J2 = 1.08262668e-3;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);

export const CONSTELACIONES = ['GPS', 'Galileo', 'GLONASS', 'BeiDou'];

// sat: { epoca (ms UTC), n (vueltas/día), e, i, raan, argp, M (grados) }
export function posicionECI(sat, ms) {
  const n = (sat.n * 2 * Math.PI) / 86400;
  const a = Math.cbrt(MU / (n * n));
  const e = sat.e;
  const inc = sat.i * RAD;
  const dt = (ms - sat.epoca) / 1000;
  const p = a * (1 - e * e);
  const k = 1.5 * n * J2 * (RE / p) ** 2;
  const raan = sat.raan * RAD - k * Math.cos(inc) * dt;
  const argp = sat.argp * RAD + 0.5 * k * (5 * Math.cos(inc) ** 2 - 1) * dt;
  const M = (sat.M * RAD + n * dt) % (2 * Math.PI);
  let E = M;
  for (let it = 0; it < 10; it++) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  const u = argp + nu;
  const cO = Math.cos(raan);
  const sO = Math.sin(raan);
  const cu = Math.cos(u);
  const su = Math.sin(u);
  const ci = Math.cos(inc);
  return [r * (cO * cu - sO * su * ci), r * (sO * cu + cO * su * ci), r * su * Math.sin(inc)];
}

export function observadorECEF(lat, lon, alturaKm = 0) {
  const phi = lat * RAD;
  const lam = lon * RAD;
  const N = RE / Math.sqrt(1 - E2 * Math.sin(phi) ** 2);
  return [
    (N + alturaKm) * Math.cos(phi) * Math.cos(lam),
    (N + alturaKm) * Math.cos(phi) * Math.sin(lam),
    (N * (1 - E2) + alturaKm) * Math.sin(phi),
  ];
}

export function elevacion(sat, ms, lat, lon, alturaKm = 0) {
  const [x, y, z] = posicionECI(sat, ms);
  const th = gmst(ms);
  const xe = x * Math.cos(th) + y * Math.sin(th);
  const ye = -x * Math.sin(th) + y * Math.cos(th);
  const o = observadorECEF(lat, lon, alturaKm);
  const dx = xe - o[0];
  const dy = ye - o[1];
  const dz = z - o[2];
  const phi = lat * RAD;
  const lam = lon * RAD;
  const arriba =
    Math.cos(phi) * Math.cos(lam) * dx + Math.cos(phi) * Math.sin(lam) * dy + Math.sin(phi) * dz;
  return Math.asin(Math.max(-1, Math.min(1, arriba / Math.hypot(dx, dy, dz)))) / RAD;
}

// Cuántos hay por encima de la máscara (10° por defecto: por debajo, el
// receptor del dron apenas los usa y el terreno los tapa).
export function contarVisibles(sats, ms, lat, lon, alturaKm = 0, mascara = 10) {
  const porConstelacion = Object.fromEntries(CONSTELACIONES.map((c) => [c, 0]));
  let total = 0;
  for (const s of sats) {
    if (elevacion(s, ms, lat, lon, alturaKm) >= mascara) {
      total++;
      if (s.constelacion in porConstelacion) porConstelacion[s.constelacion]++;
    }
  }
  return { total, porConstelacion };
}

// Días desde la época más reciente: con más de ~30 la cuenta deja de valer.
export function antiguedadDias(sats, ms) {
  if (!sats.length) return Infinity;
  const ultima = Math.max(...sats.map((s) => s.epoca));
  return (ms - ultima) / 86400000;
}

// CelesTrak (JSON OMM) → nuestro formato. Sirve al script de descarga.
export function desdeOMM(omm, constelacion) {
  return {
    nombre: String(omm.OBJECT_NAME ?? ''),
    constelacion,
    epoca: Date.parse(/Z|[+-]\d\d:?\d\d$/.test(omm.EPOCH) ? omm.EPOCH : `${omm.EPOCH}Z`),
    n: Number(omm.MEAN_MOTION),
    e: Number(omm.ECCENTRICITY),
    i: Number(omm.INCLINATION),
    raan: Number(omm.RA_OF_ASC_NODE),
    argp: Number(omm.ARG_OF_PERICENTER),
    M: Number(omm.MEAN_ANOMALY),
  };
}

export function satValido(s) {
  return (
    s &&
    Number.isFinite(s.epoca) &&
    ['n', 'e', 'i', 'raan', 'argp', 'M'].every((k) => Number.isFinite(s[k])) &&
    s.n > 0.5 &&
    s.n < 17 &&
    s.e >= 0 &&
    s.e < 0.9
  );
}
