// Descarga las órbitas GNSS de CelesTrak y el Kp de NOAA a data/, para que
// la app los sirva desde su propio dominio (CelesTrak no siempre permite
// pedirlos desde el navegador). Lo corre el despliegue cada 6 horas.
//
// Si una fuente falla, se conserva lo que ya estaba publicado (PREVIO_URL):
// la app sigue con órbitas de hace unas horas, que valen igual.
//
//   node scripts/descargar-datos.mjs [--out data] [--previo https://.../data]

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { URL_KP, leerKp } from '../src/motor/kp.js';
import { desdeOMM, satValido } from '../src/motor/satelites.js';

const GRUPOS = { GPS: 'gps-ops', Galileo: 'galileo', GLONASS: 'glo-ops', BeiDou: 'beidou' };
const CELESTRAK = 'https://celestrak.org/NORAD/elements/gp.php';

function opcion(nombre, porDefecto) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : porDefecto;
}

const OUT = opcion('out', 'data');
const PREVIO = opcion('previo', process.env.PREVIO_URL ?? '');
const BASE_CELESTRAK = opcion('celestrak', CELESTRAK);
const BASE_KP = opcion('kp', URL_KP);

// «fetch failed» no dice nada: el motivo de verdad va en e.cause.
function motivo(e) {
  const c = e?.cause;
  return c ? `${e.message} (${c.code ?? ''} ${c.message ?? c})`.replace(/\s+\)/, ')') : e.message;
}

async function json(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'drone-forecast (GitHub Pages)' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

async function previo(fichero) {
  if (!PREVIO) return null;
  try {
    return await json(`${PREVIO.replace(/\/$/, '')}/${fichero}`);
  } catch (e) {
    console.warn(`No se pudo recuperar el ${fichero} publicado: ${e.message}`);
    return null;
  }
}

export async function descargarGnss() {
  const satelites = [];
  const fallos = [];
  for (const [constelacion, grupo] of Object.entries(GRUPOS)) {
    try {
      const lista = await json(`${BASE_CELESTRAK}?GROUP=${grupo}&FORMAT=json`);
      const validos = lista.map((o) => desdeOMM(o, constelacion)).filter(satValido);
      if (!validos.length) throw new Error('lista vacía');
      satelites.push(...validos);
      console.log(`${constelacion}: ${validos.length} satélites`);
    } catch (e) {
      fallos.push(constelacion);
      console.warn(`${constelacion}: ${motivo(e)}`);
    }
  }
  if (fallos.length) {
    const antes = await previo('gnss.json');
    const conservados = (antes?.satelites ?? []).filter((s) => fallos.includes(s.constelacion) && satValido(s));
    if (conservados.length) console.warn(`Se conservan ${conservados.length} satélites publicados de ${fallos.join(', ')}`);
    satelites.push(...conservados);
  }
  return { actualizado: new Date().toISOString(), satelites };
}

export async function descargarKp() {
  try {
    const crudo = await json(BASE_KP);
    if (!leerKp(crudo).length) throw new Error('sin tramos legibles');
    return crudo;
  } catch (e) {
    console.warn(`Kp: ${motivo(e)}`);
    return (await previo('kp.json')) ?? [];
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const [gnss, kp] = [await descargarGnss(), await descargarKp()];
  await writeFile(join(OUT, 'gnss.json'), JSON.stringify(gnss));
  await writeFile(join(OUT, 'kp.json'), JSON.stringify(kp));
  console.log(`Escrito: ${gnss.satelites.length} satélites, ${leerKp(kp).length} tramos de Kp`);
  // No se detiene el despliegue: sin órbitas la app enseña «sin dato», no miente.
  if (!gnss.satelites.length) console.warn('::warning::Sin órbitas GNSS: la app no contará satélites');
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
