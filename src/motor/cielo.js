// El cielo de una hora, de su código WMO (el que da Open-Meteo), en palabras
// y con un icono: lo que enseña el cartel, como hace UAV Forecast.
// Tabla de códigos: https://open-meteo.com/en/docs (WMO Weather interpretation codes).

const TABLA = [
  [[0], 'Despejado', '☀️', '🌙'],
  [[1], 'Poco nuboso', '🌤️', '🌙'],
  [[2], 'Nubes y claros', '⛅', '☁️'],
  [[3], 'Cubierto', '☁️', '☁️'],
  [[45, 48], 'Niebla', '🌫️', '🌫️'],
  [[51, 53, 55], 'Llovizna', '🌦️', '🌧️'],
  [[56, 57], 'Llovizna helada', '🌧️', '🌧️'],
  [[61], 'Lluvia débil', '🌦️', '🌧️'],
  [[63, 65], 'Lluvia', '🌧️', '🌧️'],
  [[66, 67], 'Lluvia helada', '🌧️', '🌧️'],
  [[71, 73, 75, 77], 'Nieve', '🌨️', '🌨️'],
  [[80, 81, 82], 'Chubascos', '🌦️', '🌧️'],
  [[85, 86], 'Chubascos de nieve', '🌨️', '🌨️'],
  [[95], 'Tormenta', '⛈️', '⛈️'],
  [[96, 99], 'Tormenta con granizo', '⛈️', '⛈️'],
];

/** @returns {{texto: string, icono: string} | null}  null si el código no se conoce */
export function cielo(codigo, deDia = true) {
  const fila = TABLA.find(([cs]) => cs.includes(codigo));
  return fila ? { texto: fila[1], icono: deDia ? fila[2] : fila[3] } : null;
}
