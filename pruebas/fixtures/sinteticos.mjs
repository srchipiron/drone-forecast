// Datos de prueba fabricados (el contenedor de desarrollo no llega a las APIs).
// La forma es la de las respuestas reales; si cambia la real, cambia esto.

export const AHORA = Date.parse('2026-06-21T08:30:00Z'); // 10:30 en Madrid
export const LUGAR = { lat: 40.4168, lon: -3.7038 };

// 7 días de Open-Meteo en horas Unix, Madrid (UTC+2 en verano).
export function respuestaOpenMeteo({ viento = 3, racha = 5, lluvia = 0, prob = 0, nubes = 10, temp = 22, td = 10, vis = 24000, radiacion = 700 } = {}) {
  const inicio = Date.parse('2026-06-20T22:00:00Z') / 1000; // 00:00 local del 21
  const n = 168;
  const t = Array.from({ length: n }, (_, k) => inicio + k * 3600);
  const fill = (v) => t.map((_, k) => (typeof v === 'function' ? v(k) : v));
  return {
    latitude: 40.42, longitude: -3.7, elevation: 657, timezone: 'Europe/Madrid', utc_offset_seconds: 7200,
    hourly: {
      time: t,
      temperature_2m: fill(temp), dew_point_2m: fill(td), precipitation_probability: fill(prob), precipitation: fill(lluvia),
      weather_code: fill(1), cloud_cover: fill(nubes), visibility: fill(vis),
      wind_speed_10m: fill(viento), wind_speed_80m: fill((k) => (typeof viento === 'function' ? viento(k) : viento) * 1.3),
      wind_speed_120m: fill((k) => (typeof viento === 'function' ? viento(k) : viento) * 1.4),
      wind_speed_180m: fill((k) => (typeof viento === 'function' ? viento(k) : viento) * 1.5),
      wind_direction_10m: fill(270), wind_direction_120m: fill(280), wind_gusts_10m: fill(racha), shortwave_radiation: fill(radiacion),
    },
  };
}

// Constelación tipo GPS: 6 planos a 55°, 4 satélites por plano, órbita de 12 h.
export function constelacionSintetica(epoca = AHORA, constelacion = 'GPS', planos = 6, porPlano = 4) {
  const sats = [];
  for (let p = 0; p < planos; p++)
    for (let s = 0; s < porPlano; s++)
      sats.push({ nombre: `${constelacion}-${p}-${s}`, constelacion, epoca, n: 2.00563, e: 0.005, i: 55, raan: p * (360 / planos), argp: 0, M: s * (360 / porPlano) + p * 15 });
  return sats;
}
