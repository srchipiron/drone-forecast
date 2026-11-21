// Toda la gama de DJI, la actual y la anterior que sigue volando (Javi,
// 21-11-2026: «que no quede ningún dron»), y los profesionales de otras
// marcas, con los límites de la ficha oficial de cada fabricante:
// resistencia al viento en m/s y temperatura de trabajo.
// Los modelos anteriores (21-11-2026) salen de los extractos de las fichas
// oficiales de DJI (la web de DJI no deja leerla desde el entorno de
// desarrollo); donde la ficha no da la cifra se dice abajo qué se usa.
// Cada dron lleva la página de la que sale (fuente): si cambia, se cambia aquí.
//
// ip: solo si aguanta lluvia ligera (segunda cifra IP 5 o más: IP55). Un IP43
// o IP53 aguanta salpicaduras, no lluvia, y cuenta como sin protección.
// Cuando la ficha da dos vientos (despegue y crucero), vale el más bajo.

export const DRONES = [
  // DJI, consumo
  { id: 'neo', marca: 'DJI', nombre: 'DJI Neo', maxViento: 8, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/neo/specs' },
  { id: 'flip', marca: 'DJI', nombre: 'DJI Flip', maxViento: 10.7, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/flip/specs' },
  { id: 'mini4k', marca: 'DJI', nombre: 'DJI Mini 4K', maxViento: 10.7, tempMin: 0, tempMax: 40, ip: null, fuente: 'https://www.dji.com/mini-2-se/specs' },
  { id: 'mini5pro', marca: 'DJI', nombre: 'DJI Mini 5 Pro', maxViento: 12, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/de/support/product/mini-5-pro' },
  { id: 'air3s', marca: 'DJI', nombre: 'DJI Air 3S', maxViento: 12, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/air-3s/specs' },
  { id: 'mavic4pro', marca: 'DJI', nombre: 'DJI Mavic 4 Pro', maxViento: 12, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/nl/support/product/mavic-4-pro' },
  { id: 'avata360', marca: 'DJI', nombre: 'DJI Avata 360', maxViento: 10.7, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/nl/support/product/avata-360' },
  // DJI, modelos anteriores (ya no se venden, pero vuelan). Ficha con rango
  // de viento → el valor bajo.
  { id: 'mini2', marca: 'DJI (anteriores)', nombre: 'DJI Mini 2', maxViento: 8.5, tempMin: 0, tempMax: 40, ip: null, fuente: 'https://www.dji.com/support/product/mini-2' },
  { id: 'minise', marca: 'DJI (anteriores)', nombre: 'DJI Mini SE', maxViento: 8.5, tempMin: 0, tempMax: 40, ip: null, fuente: 'https://www.dji.com/support/product/mini-se' },
  { id: 'mini2se', marca: 'DJI (anteriores)', nombre: 'DJI Mini 2 SE', maxViento: 10.7, tempMin: 0, tempMax: 40, ip: null, fuente: 'https://www.dji.com/mini-2-se/specs' },
  { id: 'mini3', marca: 'DJI (anteriores)', nombre: 'DJI Mini 3', maxViento: 10.7, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/mini-3/specs' },
  { id: 'mini3pro', marca: 'DJI (anteriores)', nombre: 'DJI Mini 3 Pro', maxViento: 10.7, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/support/product/mini-3-pro' },
  { id: 'mini4pro', marca: 'DJI (anteriores)', nombre: 'DJI Mini 4 Pro', maxViento: 10.7, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/mini-4-pro/specs' },
  { id: 'air2', marca: 'DJI (anteriores)', nombre: 'DJI Mavic Air 2', maxViento: 8.5, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/support/product/mavic-air-2' },
  { id: 'air2s', marca: 'DJI (anteriores)', nombre: 'DJI Air 2S', maxViento: 10.7, tempMin: 0, tempMax: 40, ip: null, fuente: 'https://www.dji.com/support/product/air-2s' },
  { id: 'air3', marca: 'DJI (anteriores)', nombre: 'DJI Air 3', maxViento: 12, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/air-3/specs' },
  // Mavic 2 Pro y Zoom: 29-38 km/h → 29 km/h = 8,1 m/s.
  { id: 'mavic2pro', marca: 'DJI (anteriores)', nombre: 'DJI Mavic 2 Pro', maxViento: 8.1, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/support/product/mavic-2' },
  { id: 'mavic2zoom', marca: 'DJI (anteriores)', nombre: 'DJI Mavic 2 Zoom', maxViento: 8.1, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/support/product/mavic-2' },
  { id: 'mavic3', marca: 'DJI (anteriores)', nombre: 'DJI Mavic 3', maxViento: 12, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/support/product/mavic-3' },
  { id: 'mavic3classic', marca: 'DJI (anteriores)', nombre: 'DJI Mavic 3 Classic', maxViento: 12, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/mavic-3-classic/specs' },
  { id: 'mavic3pro', marca: 'DJI (anteriores)', nombre: 'DJI Mavic 3 Pro', maxViento: 12, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/mavic-3-pro/specs' },
  { id: 'avata', marca: 'DJI (anteriores)', nombre: 'DJI Avata', maxViento: 10.7, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/support/product/avata' },
  { id: 'avata2', marca: 'DJI (anteriores)', nombre: 'DJI Avata 2', maxViento: 10.7, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/avata-2/specs' },
  // DJI FPV: la ficha dice «nivel 6» (Beaufort 6: 10,8-13,8 m/s) → 10,8.
  { id: 'fpv', marca: 'DJI (anteriores)', nombre: 'DJI FPV', maxViento: 10.8, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/dji-fpv/specs' },
  { id: 'p4pro2', marca: 'DJI (anteriores)', nombre: 'DJI Phantom 4 Pro V2.0', maxViento: 10, tempMin: 0, tempMax: 40, ip: null, fuente: 'https://www.dji.com/support/product/phantom-4-pro-v2' },
  // Phantom 4 RTK y Multispectral: DJI no publica el viento; se usa el del
  // Phantom 4 Pro V2.0, el mismo aparato (10 m/s).
  { id: 'p4rtk', marca: 'DJI (anteriores)', nombre: 'DJI Phantom 4 RTK', maxViento: 10, tempMin: 0, tempMax: 40, ip: null, fuente: 'https://www.dji.com/support/product/phantom-4-rtk' },
  { id: 'p4m', marca: 'DJI (anteriores)', nombre: 'DJI Phantom 4 Multispectral', maxViento: 10, tempMin: 0, tempMax: 40, ip: null, fuente: 'https://ag.dji.com/p4-multispectral/specs' },
  { id: 'inspire2', marca: 'DJI (anteriores)', nombre: 'DJI Inspire 2', maxViento: 10, tempMin: -20, tempMax: 40, ip: null, fuente: 'https://www.dji.com/support/product/inspire-2' },
  // Inspire 3: 14 m/s en vuelo, 12 en despegue y aterrizaje → 12.
  { id: 'inspire3', marca: 'DJI', nombre: 'DJI Inspire 3', maxViento: 12, tempMin: -20, tempMax: 40, ip: null, fuente: 'https://www.dji.com/inspire-3/specs' },
  // DJI, Enterprise. Su viento máximo está dado para despegue y aterrizaje.
  // Mavic 3 Enterprise (M3E / M3T): ya no se vende, pero Aeroscan lo usa (Javi, 17-11-2026). 12 m/s, -10 a 40 °C, sin IP.
  { id: 'm3e', marca: 'DJI Enterprise', nombre: 'DJI Mavic 3 Enterprise (M3E / M3T)', maxViento: 12, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://enterprise.dji.com/mavic-3-enterprise/specs' },
  { id: 'm2ea', marca: 'DJI Enterprise', nombre: 'DJI Mavic 2 Enterprise Advanced', maxViento: 10, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://www.dji.com/global/mavic-2-enterprise-advanced/specs' },
  // Mavic 3 Multispectral: 12 m/s solo en despegue y aterrizaje (nota de la ficha).
  { id: 'm3m', marca: 'DJI Enterprise', nombre: 'DJI Mavic 3 Multispectral (M3M)', maxViento: 12, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://ag.dji.com/mavic-3-m/specs' },
  // M30, M300 y M350: 12 m/s de la ficha (los 15 que da algún folleto, no).
  // El IP baja con el desgaste: DJI no lo da por permanente.
  { id: 'm30', marca: 'DJI Enterprise', nombre: 'DJI Matrice 30 / 30T', maxViento: 12, tempMin: -20, tempMax: 50, ip: 'IP55', fuente: 'https://enterprise.dji.com/matrice-30/specs' },
  { id: 'm300', marca: 'DJI Enterprise', nombre: 'DJI Matrice 300 RTK', maxViento: 12, tempMin: -20, tempMax: 50, ip: 'IP45', fuente: 'https://www.dji.com/global/support/product/matrice-300' },
  { id: 'm350', marca: 'DJI Enterprise', nombre: 'DJI Matrice 350 RTK', maxViento: 12, tempMin: -20, tempMax: 50, ip: 'IP55', fuente: 'https://enterprise.dji.com/matrice-350-rtk/specs' },
  // Matrice 3D / 3TD (Dock 2): 8 m/s en despegue y aterrizaje (12 en
  // operación) → 8. IP54: salpicaduras, no lluvia.
  { id: 'm3d', marca: 'DJI Enterprise', nombre: 'DJI Matrice 3D / 3TD', maxViento: 8, tempMin: -20, tempMax: 45, ip: null, fuente: 'https://enterprise.dji.com/news/detail/dji-dock-2-release' },
  { id: 'm4et', marca: 'DJI Enterprise', nombre: 'DJI Matrice 4E / 4T', maxViento: 12, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://enterprise.dji.com/matrice-4-series/specs' },
  // DJI no publica la temperatura del 4D/4TD aparte: se usa la de la serie Matrice 4.
  { id: 'm4td', marca: 'DJI Enterprise', nombre: 'DJI Matrice 4D / 4TD', maxViento: 12, tempMin: -10, tempMax: 40, ip: 'IP55', fuente: 'https://enterprise.dji.com/dock-3/faq' },
  { id: 'm5td', marca: 'DJI Enterprise', nombre: 'DJI Matrice 5TD', maxViento: 12, tempMin: -40, tempMax: 50, ip: 'IP55', fuente: 'https://enterprise.dji.com/dock-4/specs' },
  { id: 'm400', marca: 'DJI Enterprise', nombre: 'DJI Matrice 400', maxViento: 12, tempMin: -20, tempMax: 50, ip: 'IP55', fuente: 'https://enterprise.dji.com/matrice-400/specs' },
  // DJI, carga y agricultura.
  { id: 'flycart30', marca: 'DJI Agras y FlyCart', nombre: 'DJI FlyCart 30', maxViento: 12, tempMin: -20, tempMax: 45, ip: 'IP55', fuente: 'https://www.dji.com/flycart-30/specs' },
  // Agras: 6 m/s de la ficha (para fumigar). La ficha no da la temperatura de
  // la aeronave (solo la del mando); se usa la del T25P, 0 a 40 °C. El IP67
  // es del sistema de esparcido, no del aparato entero: no cuenta.
  { id: 'agrast50', marca: 'DJI Agras y FlyCart', nombre: 'DJI Agras T50', maxViento: 6, tempMin: 0, tempMax: 40, ip: null, fuente: 'https://ag.dji.com/t50/specs' },
  { id: 'agrast25', marca: 'DJI Agras y FlyCart', nombre: 'DJI Agras T25', maxViento: 6, tempMin: 0, tempMax: 40, ip: null, fuente: 'https://ag.dji.com/t25/specs' },
  // Otras marcas profesionales
  // EVO Max 4T: 10,7 m/s en despegue y aterrizaje (12 en crucero); -20 a 40 °C con carga completa; IP43.
  { id: 'evomax4t', marca: 'Autel', nombre: 'Autel EVO Max 4T', maxViento: 10.7, tempMin: -20, tempMax: 40, ip: null, fuente: 'https://www.autelrobotics.com/productdetail/evo-max-4t/' },
  { id: 'x10', marca: 'Skydio', nombre: 'Skydio X10', maxViento: 12, tempMin: -20, tempMax: 45, ip: 'IP55', fuente: 'https://www.skydio.com/x10/technical-specs' },
  // ANAFI UKR: IP53 (salpicaduras), no cuenta para lluvia.
  { id: 'anafiukr', marca: 'Parrot', nombre: 'Parrot ANAFI UKR', maxViento: 15, tempMin: -36, tempMax: 50, ip: null, fuente: 'https://www.parrot.com/en/anafi-ukr-technical-specifications' },
];

export const PERSONALIZADO = {
  id: 'personalizado',
  nombre: 'Personalizado',
  maxViento: 10,
  tempMin: -10,
  tempMax: 40,
  ip: null,
};

// Los modelos que se quitaron pasan a su sucesor (o al más prudente de la
// gama actual): quien tenía uno guardado no se queda con un dron que no existe.
// (Desde 21-11-2026 los modelos anteriores de DJI están en la lista: quien
// tenga uno lo encuentra tal cual. Aquí solo van los que se quiten.)
export const SUCESORES = {};

export function idDron(id) {
  if (id === 'personalizado' || DRONES.some((d) => d.id === id)) return id;
  return SUCESORES[id] ?? DRONES[0].id;
}

export function dronPorId(id, personalizado = PERSONALIZADO) {
  const real = idDron(id);
  if (real === 'personalizado') return { ...PERSONALIZADO, ...personalizado, id: real, nombre: 'Personalizado' };
  return DRONES.find((d) => d.id === real);
}
