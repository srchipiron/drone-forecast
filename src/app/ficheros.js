// Leer el fichero de una traza que elige el usuario: KML, WPML y GPX son
// texto; un KMZ (Google Earth, misiones de DJI Pilot 2) es un ZIP con el KML
// dentro, que se abre aquí con DecompressionStream (sin librerías).

const MAX_BYTES = 20 * 1024 * 1024;

const u16 = (v, i) => v.getUint16(i, true);
const u32 = (v, i) => v.getUint32(i, true);

// Lo que se busca dentro del KMZ, por orden: la ruta que vuela el dron en
// una misión de DJI, la plantilla de la misión y, si no, el primer .kml.
const PREFERIDOS = [/(^|\/)waylines\.wpml$/i, /(^|\/)template\.kml$/i, /\.kml$/i, /\.wpml$/i];

/** Los ficheros de un ZIP (por su directorio central): nombre, método, tamaño, posición. */
export function entradasZip(datos) {
  const v = new DataView(datos.buffer, datos.byteOffset, datos.byteLength);
  // El final del directorio central está en los últimos 22 bytes (+ un comentario de hasta 64 kB).
  let fin = -1;
  for (let i = datos.length - 22; i >= Math.max(0, datos.length - 22 - 65535); i--)
    if (u32(v, i) === 0x06054b50) {
      fin = i;
      break;
    }
  if (fin < 0) throw new Error('El KMZ no es un ZIP válido.');
  const total = u16(v, fin + 10);
  let p = u32(v, fin + 16);
  const salida = [];
  for (let k = 0; k < total && p + 46 <= datos.length; k++) {
    if (u32(v, p) !== 0x02014b50) throw new Error('El KMZ está dañado.');
    const largoNombre = u16(v, p + 28);
    const nombre = new TextDecoder().decode(datos.subarray(p + 46, p + 46 + largoNombre));
    salida.push({ nombre, metodo: u16(v, p + 10), comprimido: u32(v, p + 20), local: u32(v, p + 42) });
    p += 46 + largoNombre + u16(v, p + 30) + u16(v, p + 32);
  }
  return salida;
}

async function sacarDelZip(datos, e) {
  const v = new DataView(datos.buffer, datos.byteOffset, datos.byteLength);
  if (u32(v, e.local) !== 0x04034b50) throw new Error('El KMZ está dañado.');
  const inicio = e.local + 30 + u16(v, e.local + 26) + u16(v, e.local + 28);
  const trozo = datos.subarray(inicio, inicio + e.comprimido);
  if (e.metodo === 0) return new TextDecoder().decode(trozo);
  if (e.metodo !== 8 || typeof DecompressionStream !== 'function') throw new Error('Este navegador no sabe abrir ese KMZ.');
  const flujo = new Blob([trozo]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(flujo).text();
}

/** El texto de la traza de un fichero elegido (KML, KMZ, WPML o GPX). */
export async function leerFicheroTraza(fichero) {
  if (fichero.size > MAX_BYTES) throw new Error('El fichero es demasiado grande (máximo 20 MB).');
  const datos = new Uint8Array(await fichero.arrayBuffer());
  // ZIP: empieza por «PK\x03\x04».
  if (datos[0] === 0x50 && datos[1] === 0x4b && datos[2] === 3 && datos[3] === 4) {
    const entradas = entradasZip(datos);
    for (const patron of PREFERIDOS) {
      const e = entradas.find((x) => patron.test(x.nombre));
      if (e) return sacarDelZip(datos, e);
    }
    throw new Error('El KMZ no trae ningún KML dentro.');
  }
  return new TextDecoder().decode(datos);
}
