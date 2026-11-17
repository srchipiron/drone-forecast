import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAPAS, alturasZona, destacadoDe, enlacesDe, leerZonas, resumenZonas, textoPlano, urlConsultaEnaire, valorarZonas } from '../src/motor/enaire.js';

// Respuesta real de la capa aeronáutica en Getafe (17-11-2026): seis zonas.
const GETAFE = JSON.parse(readFileSync(new URL('./fixtures/enaire-getafe-aero.json', import.meta.url)));
const zonas = () => leerZonas(GETAFE, 'Aeronáutica');
const por = (id) => zonas().find((z) => z.id === id);

test('la consulta es la estándar de ArcGIS: punto en WGS84, intersección, sin geometría', () => {
  const u = new URL(urlConsultaEnaire(2, 40.4168, -3.7038));
  assert.equal(u.origin, 'https://servais.enaire.es');
  assert.match(u.pathname, /\/SRV_UAS_ZG_data_V2\/FeatureServer\/2\/query$/);
  assert.equal(u.searchParams.get('geometry'), '-3.703800,40.416800', 'ArcGIS quiere x,y: longitud primero');
  assert.equal(u.searchParams.get('inSR'), '4326');
  assert.equal(u.searchParams.get('spatialRel'), 'esriSpatialRelIntersects');
  assert.equal(u.searchParams.get('returnGeometry'), 'false');
  assert.equal(u.searchParams.get('f'), 'json');
});

test('solo se piden las capas que existen (0, 2 y 3): la 1 daba error siempre y dejaba la consulta «incompleta»', () => {
  assert.deepEqual(CAPAS.map((c) => c.id).sort(), [0, 2, 3]);
});

test('datos reales: nombre, restricción (campo type), motivo, clase y límites de altura', () => {
  assert.equal(zonas().length, 6);
  const ctr = por('LEMD_CT');
  assert.equal(ctr.nombre, 'CTR MADRID');
  assert.deepEqual(ctr.restriccion, { codigo: 'REQ_AUTHORIZATION', texto: 'Requiere autorización', nivel: 2 });
  assert.deepEqual(ctr.motivos, ['tráfico aéreo']);
  assert.equal(ctr.clase, 'CTR (zona de control)');
  assert.deepEqual(ctr.inferior, { m: 60, ref: 'AGL' });
  assert.deepEqual(ctr.superior, { m: 305, ref: 'AGL' });
  assert.equal(ctr.horario, null, 'day ANY y sin horas: siempre');
  // La zona fotográfica no tiene nombre: se nombra por su clase e identificador; sus límites van en pies.
  const rvf = por('0582-1');
  assert.equal(rvf.nombre, 'Restricción al vuelo fotográfico 0582-1');
  assert.deepEqual(rvf.motivos, ['privacidad']);
  assert.deepEqual(rvf.superior, { m: 914, ref: 'AGL' }, '3000 ft');
  assert.deepEqual(por('LECM_TMA').superior, { m: 7468, ref: 'AMSL' });
});

test('el mensaje HTML de ENAIRE llega como texto limpio, sin una etiqueta', () => {
  for (const z of zonas()) for (const p of z.texto) assert.doesNotMatch(p, /[<>]|&[a-z]+;/, `${z.id}: ${p}`);
  assert.equal(por('LEGT0').texto[1], 'NO permitido el vuelo a drones excepto coordinación con el Aeródromo.');
  assert.ok(por('LEMD_CT').texto.includes('Nivel superior: 1000ft AGL'));
});

test('lo que ENAIRE resalta se saca aparte, con el párrafo entero si resalta un trozo', () => {
  assert.equal(por('LEGT0').destacado, 'NO permitido el vuelo a drones excepto coordinación con el Aeródromo.');
  assert.match(por('LEMD_CT').destacado, /^Están permitidas las operaciones VLOS a una altura máxima de 60m/);
  assert.match(por('LECU/LEVS45').destacado, /^Por encima de 45m medidos desde el punto de referencia del aeródromo \(692m\), realice su solicitud ÚNICAMENTE/);
  assert.equal(por('0582-1').destacado, '', 'si no resalta nada, nada');
  assert.equal(destacadoDe('<p><b>Contacto:</b> x</p>'), '', 'el «Contacto:» en negrita no cuenta');
});

test('contactos: correo, teléfonos separados y los enlaces https del mensaje', () => {
  const cv = por('LECU/LEVS45');
  assert.equal(cv.email, 'seguridad_operacional_MCV@aena.es');
  assert.deepEqual(cv.telefonos, ['+34-913 210 900', '+34-916 493 000']);
  assert.equal(cv.enlaces[0].texto, 'Aena');
  assert.match(cv.enlaces[0].url, /^https:\/\/www\.aena\.es\//);
  assert.deepEqual(por('LEMD_CT').enlaces, [{ url: 'https://planea.enaire.es/nsf/login', texto: 'ENAIRE Planea' }]);
  assert.equal(por('LEGT0').email, 'RPAS_LEGT@mde.es');
});

test('lo de fuera son datos: ni scripts, ni enlaces que no sean https, ni correos raros', () => {
  const z = leerZonas(
    {
      features: [
        {
          attributes: {
            name: 'Zona <b>X</b>',
            type: 'PROHIBITED',
            message: '<script>alert(1)</script><p onclick="x()">Hola &amp; adiós &#8212; <img src=x onerror=alert(1)></p><a href="javascript:alert(1)">mal</a><a href="http://inseguro.es">http</a><a href=\'https://bien.es/a\'>bien</a>',
            email: 'a@b.es" onmouseover="x',
            phone: 'llama<script>',
          },
        },
      ],
    },
    'Urbana',
  )[0];
  assert.equal(z.nombre, 'Zona <b>X</b>', 'el nombre se guarda tal cual: se escapa al pintarlo');
  assert.ok(z.texto.every((p) => !/[<>]/.test(p)));
  assert.ok(z.texto.join(' ').includes('Hola & adiós —'));
  assert.deepEqual(z.enlaces, [{ url: 'https://bien.es/a', texto: 'bien' }]);
  assert.equal(z.email, '');
  assert.deepEqual(z.telefonos, []);
  assert.deepEqual(textoPlano(null), []);
  assert.deepEqual(enlacesDe(undefined), []);
});

test('a tu altura: qué zonas te afectan (en el límite exacto no) y desde qué altura empiezan', () => {
  const a = (alt) => valorarZonas(zonas(), { altitud: alt, elevacion: 620 });
  const ids = (v) => v.afectan.map((z) => z.id).sort();
  // A 30 m: el aeródromo de Getafe y la zona fotográfica, que empiezan en el suelo.
  assert.deepEqual(ids(a(30)), ['0582-1', 'LEGT0']);
  // A 45 m justos Cuatro Vientos aún no; a 50 sí. A 60 justos el CTR y la ATZ aún no; a 120 sí.
  assert.deepEqual(ids(a(45)), ['0582-1', 'LEGT0']);
  assert.deepEqual(ids(a(60)), ['0582-1', 'LECU/LEVS45', 'LEGT0']);
  assert.deepEqual(ids(a(120)), ['0582-1', 'LECU/LEVS45', 'LEGT AT', 'LEGT0', 'LEMD_CT']);
  assert.equal(a(120).peor.texto, 'Requiere autorización');
  assert.equal(a(120).zonas.at(-1).id, 'LECM_TMA', 'la que no te afecta, al final');
  assert.equal(a(120).libreHasta, 0, 'hay zonas desde el suelo');
  // Sin las que empiezan en el suelo, libre hasta 45 m (Cuatro Vientos).
  const sinSuelo = zonas().filter((z) => (z.inferior.m ?? 0) > 0);
  assert.equal(valorarZonas(sinSuelo, { altitud: 120, elevacion: 620 }).libreHasta, 45);
});

test('límites sobre el nivel del mar: con el terreno se decide; sin él, «quizá», nunca «no»', () => {
  const z = { restriccion: { nivel: 3, texto: 'Prohibido volar' }, inferior: { m: 800, ref: 'AMSL' }, superior: { m: 2000, ref: 'AMSL' } };
  assert.equal(valorarZonas([z], { altitud: 120, elevacion: 700 }).afectan.length, 1, '700 + 120 = 820 > 800');
  assert.equal(valorarZonas([z], { altitud: 50, elevacion: 700 }).afectan.length, 0, '750 < 800');
  assert.equal(valorarZonas([z], { altitud: 50, elevacion: null }).afectan[0].aplica, 'quiza');
  assert.equal(valorarZonas([z], { altitud: 50, elevacion: 700 }).libreHasta, 100);
  assert.equal(valorarZonas([z], { altitud: 50, elevacion: null }).libreHasta, null);
});

test('alturas en palabras', () => {
  assert.equal(alturasZona(por('LEGT0')), 'Desde el suelo hasta 900 m');
  assert.equal(alturasZona(por('LEMD_CT')), 'Desde 60 m hasta 305 m sobre el suelo');
  assert.equal(alturasZona(por('LECM_TMA')), 'Desde 305 m sobre el suelo hasta 7468 m sobre el nivel del mar');
});

test('un error de ArcGIS (200 con {error}) es un fallo, no «cero zonas»', () => {
  assert.throws(() => leerZonas({ error: { code: 400, message: 'Invalid query' } }, 'Urbana'), /Invalid query/);
  assert.throws(() => leerZonas({}, 'Urbana'));
  assert.throws(() => leerZonas(null, 'Urbana'));
  assert.deepEqual(leerZonas({ features: [] }, 'Urbana'), []);
});

test('nunca dice «fuera» si alguna capa falló', () => {
  const ok = (capa, zs = []) => ({ capa, ok: true, zonas: zs });
  const mal = (capa) => ({ capa, ok: false });
  assert.equal(resumenZonas([ok('A'), ok('B')]).estado, 'fuera');
  assert.equal(resumenZonas([ok('A'), mal('B')]).estado, 'incompleto');
  assert.equal(resumenZonas([mal('A'), mal('B')]).estado, 'error');
  const r = resumenZonas([ok('A', [{ nombre: 'X' }]), mal('B')]);
  assert.equal(r.estado, 'dentro');
  assert.deepEqual(r.fallidas, ['B']);
});
