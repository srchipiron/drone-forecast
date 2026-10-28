// La gama ACTUAL (octubre de 2026), con los límites de la ficha oficial de
// cada fabricante: resistencia al viento en m/s y temperatura de trabajo.
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
  // DJI, Enterprise. Su viento máximo está dado para despegue y aterrizaje.
  { id: 'm4et', marca: 'DJI Enterprise', nombre: 'DJI Matrice 4E / 4T', maxViento: 12, tempMin: -10, tempMax: 40, ip: null, fuente: 'https://enterprise.dji.com/matrice-4-series/specs' },
  // DJI no publica la temperatura del 4D/4TD aparte: se usa la de la serie Matrice 4.
  { id: 'm4td', marca: 'DJI Enterprise', nombre: 'DJI Matrice 4D / 4TD', maxViento: 12, tempMin: -10, tempMax: 40, ip: 'IP55', fuente: 'https://enterprise.dji.com/dock-3/faq' },
  { id: 'm5td', marca: 'DJI Enterprise', nombre: 'DJI Matrice 5TD', maxViento: 12, tempMin: -40, tempMax: 50, ip: 'IP55', fuente: 'https://enterprise.dji.com/dock-4/specs' },
  { id: 'm400', marca: 'DJI Enterprise', nombre: 'DJI Matrice 400', maxViento: 12, tempMin: -20, tempMax: 50, ip: 'IP55', fuente: 'https://enterprise.dji.com/matrice-400/specs' },
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
export const SUCESORES = {
  mini4pro: 'mini5pro',
  mini3: 'mini5pro',
  air3: 'air3s',
  mavic3: 'mavic4pro',
  avata2: 'avata360',
  m3e: 'm4et',
  m30: 'm4et',
  m350: 'm400',
};

export function idDron(id) {
  if (id === 'personalizado' || DRONES.some((d) => d.id === id)) return id;
  return SUCESORES[id] ?? DRONES[0].id;
}

export function dronPorId(id, personalizado = PERSONALIZADO) {
  const real = idDron(id);
  if (real === 'personalizado') return { ...PERSONALIZADO, ...personalizado, id: real, nombre: 'Personalizado' };
  return DRONES.find((d) => d.id === real);
}
