// La descarga entera contra una API simulada en local: lo que sale tiene que
// ser lo que sirvió la API, y lo que falló se rellena con lo publicado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const omm = (nombre) => ({ OBJECT_NAME: nombre, EPOCH: '2026-10-22T12:00:00.000000', MEAN_MOTION: 2.0056, ECCENTRICITY: 0.01, INCLINATION: 55, RA_OF_ASC_NODE: 10, ARG_OF_PERICENTER: 20, MEAN_ANOMALY: 30 });

test('descarga: fuentes vivas, una caída rellenada con lo publicado, Kp leído', async () => {
  const srv = createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const enviar = (cod, cuerpo) => { res.writeHead(cod, { 'content-type': 'application/json' }); res.end(JSON.stringify(cuerpo)); };
    if (u.pathname === '/gp.php') {
      const g = u.searchParams.get('GROUP');
      if (g === 'beidou') return enviar(503, {});
      return enviar(200, [omm(`${g}-1`), omm(`${g}-2`), { OBJECT_NAME: 'roto' }]);
    }
    if (u.pathname === '/kp') return enviar(200, [['time_tag', 'kp', 'observed'], ['2026-10-23 00:00:00', '3.00', 'observed']]);
    if (u.pathname === '/previo/gnss.json')
      return enviar(200, { satelites: [{ nombre: 'BEIDOU-viejo', constelacion: 'BeiDou', epoca: 1, n: 1.86, e: 0.001, i: 55, raan: 1, argp: 2, M: 3 }, { nombre: 'GPS-viejo', constelacion: 'GPS', epoca: 1, n: 2, e: 0, i: 55, raan: 0, argp: 0, M: 0 }] });
    enviar(404, {});
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const out = await mkdtemp(join(tmpdir(), 'df-'));
  try {
    await promisify(execFile)(process.execPath, ['scripts/descargar-datos.mjs', '--out', out, '--celestrak', `${base}/gp.php`, '--kp', `${base}/kp`, '--previo', `${base}/previo`]);
    const gnss = JSON.parse(await readFile(join(out, 'gnss.json'), 'utf8'));
    const nombres = gnss.satelites.map((s) => s.nombre).sort();
    assert.deepEqual(nombres, ['BEIDOU-viejo', 'galileo-1', 'galileo-2', 'glo-ops-1', 'glo-ops-2', 'gps-ops-1', 'gps-ops-2']);
    assert.equal(gnss.satelites.find((s) => s.nombre === 'gps-ops-1').constelacion, 'GPS');
    const kp = JSON.parse(await readFile(join(out, 'kp.json'), 'utf8'));
    assert.equal(kp[1][1], '3.00');
  } finally {
    srv.close();
  }
});

test('descarga: si no se baja nada nuevo, conserva también la fecha de lo publicado', async () => {
  const srv = createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const enviar = (cod, cuerpo) => { res.writeHead(cod, { 'content-type': 'application/json' }); res.end(JSON.stringify(cuerpo)); };
    if (u.pathname === '/gp.php') return enviar(503, {});
    if (u.pathname === '/kp') return enviar(503, {});
    if (u.pathname === '/previo/gnss.json') return enviar(200, { actualizado: '2026-09-01T00:00:00.000Z', satelites: [{ nombre: 'GPS-viejo', constelacion: 'GPS', epoca: 1, n: 2, e: 0, i: 55, raan: 0, argp: 0, M: 0 }] });
    enviar(404, {});
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const out = await mkdtemp(join(tmpdir(), 'df-'));
  try {
    await promisify(execFile)(process.execPath, ['scripts/descargar-datos.mjs', '--out', out, '--celestrak', `${base}/gp.php`, '--kp', `${base}/kp`, '--previo', `${base}/previo`]);
    const gnss = JSON.parse(await readFile(join(out, 'gnss.json'), 'utf8'));
    assert.equal(gnss.actualizado, '2026-09-01T00:00:00.000Z', 'no finge que son de hoy');
    assert.equal(gnss.satelites.length, 1);
  } finally {
    srv.close();
  }
});
