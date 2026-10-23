// Límites del fabricante (resistencia al viento en m/s y rango de
// temperatura de trabajo). Son los de la ficha técnica: revísalos con la tuya.
// ip: si aguanta lluvia ligera (IP45 o más). El perfil «personalizado» se
// edita en Ajustes.

export const DRONES = [
  { id: 'mini4pro', nombre: 'DJI Mini 4 Pro', maxViento: 10.7, tempMin: -10, tempMax: 40, ip: null },
  { id: 'mini3', nombre: 'DJI Mini 3 / 3 Pro', maxViento: 10.7, tempMin: -10, tempMax: 40, ip: null },
  { id: 'air3', nombre: 'DJI Air 3 / Air 3S', maxViento: 12, tempMin: -10, tempMax: 40, ip: null },
  { id: 'mavic3', nombre: 'DJI Mavic 3 / 3 Pro', maxViento: 12, tempMin: -10, tempMax: 40, ip: null },
  { id: 'avata2', nombre: 'DJI Avata 2', maxViento: 10.7, tempMin: -10, tempMax: 40, ip: null },
  { id: 'm3e', nombre: 'DJI Mavic 3 Enterprise / 3T', maxViento: 12, tempMin: -10, tempMax: 40, ip: null },
  { id: 'm30', nombre: 'DJI Matrice 30 / 30T', maxViento: 15, tempMin: -20, tempMax: 50, ip: 'IP55' },
  { id: 'm350', nombre: 'DJI Matrice 350 RTK', maxViento: 12, tempMin: -20, tempMax: 50, ip: 'IP55' },
];

export const PERSONALIZADO = {
  id: 'personalizado',
  nombre: 'Personalizado',
  maxViento: 10,
  tempMin: -10,
  tempMax: 40,
  ip: null,
};

export function dronPorId(id, personalizado = PERSONALIZADO) {
  if (id === 'personalizado') return { ...PERSONALIZADO, ...personalizado, id, nombre: 'Personalizado' };
  return DRONES.find((d) => d.id === id) ?? DRONES[0];
}
