import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MUESTRAS, aligerar, distanciaKm, leerTraza, limpiarPuntos, longitudKm, puntosTiempo, zoomParaVer } from '../src/motor/traza.js';

const KML_LINEA = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Línea &amp; torres</name>
<Placemark><name>tramo</name><LineString><coordinates>
  -3.7000,40.4000,650 -3.6000,40.4000,650
  -3.5000,40.4000,650
</coordinates></LineString></Placemark></Document></kml>`;

const KML_PUNTOS = `<kml><Document><name><![CDATA[Parcelas <norte>]]></name>
<Placemark><Point><coordinates>-3.70,40.40,0</coordinates></Point></Placemark>
<Placemark><Point><coordinates>-3.60,40.45</coordinates></Point></Placemark>
<Placemark><Point><coordinates>-3.50,40.50,0</coordinates></Point></Placemark></Document></kml>`;

// Así exporta DJI Pilot 2 (waylines.wpml dentro del KMZ): waypoints sueltos que se vuelan en orden.
const WPML = `<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2"><Document>
<Folder><wpml:templateId>0</wpml:templateId>
<Placemark><Point><coordinates>-3.7329,40.3057</coordinates></Point><wpml:index>0</wpml:index></Placemark>
<Placemark><Point><coordinates>-3.7300,40.3080</coordinates></Point><wpml:index>1</wpml:index></Placemark>
</Folder></Document></kml>`;

const GPX_TRACK = `<?xml version="1.0"?><gpx version="1.1" creator="x"><metadata><name>Ruta GPX</name></metadata>
<trk><trkseg><trkpt lat="40.40" lon="-3.70"><ele>650</ele></trkpt><trkpt lon="-3.65" lat="40.41"/><trkpt lat='40.42' lon='-3.60'/></trkseg></trk></gpx>`;

const GPX_WPT = `<gpx><wpt lat="40.40" lon="-3.70"><name>A</name></wpt><wpt lat="40.50" lon="-3.60"><name>B</name></wpt></gpx>`;

test('traza: lee KML (línea y puntos), la misión de DJI y GPX (track y waypoints)', () => {
  const linea = leerTraza(KML_LINEA);
  assert.equal(linea.forma, 'traza');
  assert.equal(linea.nombre, 'Línea & torres');
  assert.deepEqual(linea.puntos, [{ lat: 40.4, lon: -3.7 }, { lat: 40.4, lon: -3.6 }, { lat: 40.4, lon: -3.5 }]);

  const puntos = leerTraza(KML_PUNTOS);
  assert.deepEqual([puntos.forma, puntos.puntos.length, puntos.nombre], ['puntos', 3, 'Parcelas <norte>']);
  assert.deepEqual(puntos.puntos[1], { lat: 40.45, lon: -3.6 }, 'la altura, si viene, se ignora');

  const mision = leerTraza(WPML);
  assert.deepEqual([mision.forma, mision.puntos.length], ['traza', 2], 'una misión de DJI se vuela en orden: es una traza');
  assert.equal(leerTraza(WPML.replace(/<wpml:[^>]*>[^<]*<\/wpml:[^>]*>/g, '')).forma, 'traza', 'basta con el espacio de nombres de DJI');

  const gpx = leerTraza(GPX_TRACK);
  assert.deepEqual([gpx.forma, gpx.nombre], ['traza', 'Ruta GPX']);
  assert.deepEqual(gpx.puntos[1], { lat: 40.41, lon: -3.65 }, 'lat y lon en cualquier orden y con comillas simples');
  assert.deepEqual(leerTraza(GPX_WPT).forma, 'puntos');

  assert.match(leerTraza('').error, /vacío/);
  assert.match(leerTraza('<html>hola</html>').error, /coordenadas/);
  assert.match(leerTraza('<gpx></gpx>').error, /ningún punto/);
  assert.match(leerTraza('<kml><coordinates>999,999</coordinates></kml>').error, /no son válidas/);
});

test('traza: limpia, aligera y mide', () => {
  assert.deepEqual(limpiarPuntos([[40, -3], { lat: 40, lon: -3 }, { lat: 'x', lon: 1 }, { lat: 95, lon: 0 }, { lat: 40.123456789, lon: -3 }]), [{ lat: 40, lon: -3 }, { lat: 40.12346, lon: -3 }], 'sin repetidos seguidos, sin inválidos, a 5 decimales');
  const muchos = Array.from({ length: 1000 }, (_, i) => ({ lat: 40, lon: -3 + i / 1000 }));
  const pocos = aligerar(muchos, 10);
  assert.equal(pocos.length, 10);
  assert.deepEqual([pocos[0], pocos.at(-1)], [muchos[0], muchos.at(-1)], 'con el primero y el último');
  // Un grado de longitud a 40° N son unos 85 km.
  assert.ok(Math.abs(distanciaKm({ lat: 40, lon: -3 }, { lat: 40, lon: -2 }) - 85.2) < 0.5);
  assert.ok(Math.abs(longitudKm(leerTraza(KML_LINEA).puntos) - 17) < 0.3);
});

test('traza: en qué puntos se mira el tiempo', () => {
  // Traza de 17 km: uno cada 3 km, con los extremos.
  const corta = puntosTiempo({ forma: 'traza', puntos: leerTraza(KML_LINEA).puntos });
  assert.equal(corta.length, 7);
  assert.deepEqual([corta[0], corta.at(-1)], [{ lat: 40.4, lon: -3.7 }, { lat: 40.4, lon: -3.5 }]);
  for (let i = 1; i < corta.length - 1; i++) assert.ok(Math.abs(distanciaKm(corta[i - 1], corta[i]) - 3) < 0.05, `cada 3 km (${i})`);
  // Traza de 300 km: no más de MAX_MUESTRAS descargas, repartidas.
  const larga = puntosTiempo({ forma: 'traza', puntos: [{ lat: 40, lon: -5 }, { lat: 40, lon: -1.5 }] });
  assert.ok(larga.length <= MAX_MUESTRAS && larga.length >= MAX_MUESTRAS - 1, `${larga.length}`);
  assert.deepEqual(larga.at(-1), { lat: 40, lon: -1.5 });
  const huecos = larga.slice(1, -1).map((q, i) => distanciaKm(larga[i], q));
  assert.ok(Math.max(...huecos) - Math.min(...huecos) < 0.5, `igual de separados: ${huecos.map((x) => x.toFixed(1))}`);
  // Varios puntos: los que están a menos de 1 km de otro cuentan como uno.
  const sitios = puntosTiempo({ forma: 'puntos', puntos: [{ lat: 40, lon: -3 }, { lat: 40.001, lon: -3 }, { lat: 40.2, lon: -3 }] });
  assert.equal(sitios.length, 2);
  assert.deepEqual(puntosTiempo({ lat: 40, lon: -3 }), [{ lat: 40, lon: -3 }], 'un punto, él mismo');
});

test('traza: zoom para ver todos los puntos en el mapa', () => {
  const cerca = [{ lat: 40.3, lon: -3.73 }, { lat: 40.31, lon: -3.72 }];
  const lejos = [{ lat: 40, lon: -5 }, { lat: 41, lon: -1 }];
  assert.ok(zoomParaVer(cerca, 360, 260) > zoomParaVer(lejos, 360, 260));
  // A ese zoom, la caja de los puntos cabe en el 80 % del mapa.
  const z = zoomParaVer(lejos, 360, 260);
  assert.ok((4 / 360) * 256 * 2 ** z <= 360 * 0.8 && (4 / 360) * 256 * 2 ** (z + 1) > 360 * 0.8 * 0.5);
});
