// Prueba de navegador: la app entera con las APIs simuladas. No va en npm test
// (necesita un Chromium): npm run test:ui. Usa playwright si está instalado
// (global o local) y PLAYWRIGHT_CHROME si se quiere otro navegador.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';

function cargarPlaywright() {
  const require = createRequire(import.meta.url);
  for (const base of [process.cwd(), execSync('npm root -g').toString().trim()]) {
    try {
      return createRequire(join(base, 'x.js'))('playwright');
    } catch {
      /* siguiente */
    }
  }
  return require('playwright-core');
}

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const raiz = process.cwd();
const ahora = Date.now();
const inicio = Math.floor(ahora / 3600000) * 3600000 - 12 * 3600000;

function meteo() {
  const t = Array.from({ length: 168 }, (_, k) => inicio / 1000 + k * 3600);
  const f = (v) => t.map(() => v);
  return { elevation: 650, timezone: 'Europe/Madrid', hourly: { time: t, temperature_2m: f(18), dew_point_2m: f(8), precipitation_probability: f(5), precipitation: f(0), weather_code: f(1), cloud_cover: f(10), visibility: f(30000), wind_speed_10m: t.map((_, k) => (k % 24 < 12 ? 2 : 9)), wind_speed_80m: f(3), wind_speed_120m: t.map((_, k) => (k % 24 < 12 ? 3.5 : 12)), wind_speed_180m: f(4), wind_direction_10m: f(90), wind_direction_120m: f(95), wind_gusts_10m: f(4), shortwave_radiation: f(650) } };
}
const gnss = { actualizado: new Date(ahora).toISOString(), satelites: Array.from({ length: 24 }, (_, k) => ({ nombre: `GPS-${k}`, constelacion: 'GPS', epoca: ahora, n: 2.00563, e: 0.005, i: 55, raan: (k % 6) * 60, argp: 0, M: Math.floor(k / 6) * 90 + (k % 6) * 15 })) };

let gnssVacio = false;
const srv = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/, '');
  if (p === 'data/gnss.json') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(gnssVacio ? { satelites: [] } : gnss));
  try {
    const cuerpo = await readFile(join(raiz, p || 'index.html'));
    res.writeHead(200, { 'content-type': TIPOS[extname(p || 'index.html')] ?? 'application/octet-stream' }).end(cuerpo);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/`;

const { chromium } = cargarPlaywright();
const navegador = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {});
const errores = [];
try {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errores.push(m.text()));
  await page.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: r.request().url().includes('models=') ? { hourly: { time: meteo().hourly.time, wind_speed_10m_gfs_seamless: meteo().hourly.wind_speed_10m, wind_speed_10m_icon_seamless: meteo().hourly.wind_speed_10m } } : meteo() }));
  await page.route('https://geocoding-api.open-meteo.com/**', (r) => r.fulfill({ json: { results: [{ name: 'Getafe<img src=x onerror="window.__xss=1">', admin1: 'Madrid', country: 'España', latitude: 40.3057, longitude: -3.7329 }] } }));
  await page.route('https://services.swpc.noaa.gov/**', (r) => r.fulfill({ json: [['time_tag', 'kp', 'observed'], ...Array.from({ length: 40 }, (_, k) => [new Date(inicio + k * 3 * 3600000).toISOString().slice(0, 19).replace('T', ' '), '2.00', 'predicted'])] }));

  await page.goto(url);
  await page.getByText('¿Dónde vas a volar?').waitFor();
  await page.getByRole('button', { name: 'Buscar lugar' }).click();
  await page.fill('#txt-buscar', 'Getafe');
  await page.press('#txt-buscar', 'Enter');
  await page.locator('[data-res="0"]').click();
  await page.locator('#ahora .grande').filter({ hasText: /volar|precaución|No vueles/ }).waitFor();
  assert.equal(await page.evaluate(() => window.__xss), undefined, 'XSS: el nombre del lugar se ejecutó');
  assert.match(await page.textContent('#nombre-lugar'), /Getafe<img/);
  assert.equal(await page.locator('#dias .dia').count(), 7, 'siete días');
  assert.ok(await page.locator('#horas .hora').count() >= 23, 'horas del día');
  const sats = await page.textContent('#ahora .resumen');
  assert.match(sats, /Satélites\s*\d+/, `satélites: ${sats}`);
  assert.match(await page.textContent('#ahora .resumen'), /Kp\s*2\.0/);

  // Modo profesional: aparece misión y checklist; termografía FV mira la irradiancia.
  assert.ok(await page.locator('#campo-mision').isHidden());
  await page.getByRole('radio', { name: 'Profesional' }).click();
  assert.ok(await page.locator('#campo-mision').isVisible());
  assert.ok(await page.locator('#checklist').isVisible());
  await page.selectOption('#sel-mision', 'termografia_fv');
  await page.locator('#ahora summary').click();
  await page.getByText('Irradiancia').first().waitFor();
  await page.locator('[data-check="0"]').check();
  await page.reload();
  assert.ok(await page.locator('[data-check="0"]').isChecked(), 'la checklist se guarda');
  assert.equal(await page.inputValue('#sel-mision'), 'termografia_fv', 'los ajustes se guardan');
  await page.getByRole('radio', { name: 'Recreativo' }).click();
  assert.ok(await page.locator('#checklist').isHidden());

  // Tocar una hora la abre con sus factores.
  await page.locator('#horas .hora button').nth(3).click();
  assert.ok((await page.locator('#horas .factor').count()) >= 10);

  assert.match(await page.textContent('#fuentes'), /24 órbitas del despliegue/);

  // Despliegue sin órbitas (CelesTrak no deja entrar a GitHub): el móvil las
  // pide él mismo, las guarda y, si CelesTrak cae, tira de las guardadas.
  gnssVacio = true;
  const ctx2 = await navegador.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx2.addInitScript(() => {
    if (!localStorage.getItem('drone-forecast:lugar'))
      localStorage.setItem('drone-forecast:lugar', JSON.stringify({ nombre: 'Getafe', zona: '', lat: 40.3057, lon: -3.7329 }));
  });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => errores.push(e.message));
  for (const r of ['https://api.open-meteo.com/**', 'https://services.swpc.noaa.gov/**']) await p2.route(r, (x) => x.fulfill({ json: r.includes('noaa') ? [] : meteo() }));
  let pedidasCelestrak = 0;
  const omm = (k) => ({ OBJECT_NAME: `SAT ${k}`, EPOCH: new Date(ahora).toISOString().replace('Z', ''), MEAN_MOTION: 2.00563, ECCENTRICITY: 0.005, INCLINATION: 55, RA_OF_ASC_NODE: (k % 6) * 60, ARG_OF_PERICENTER: 0, MEAN_ANOMALY: Math.floor(k / 6) * 90 + (k % 6) * 15 });
  await p2.route('https://celestrak.org/**', (x) => {
    pedidasCelestrak++;
    return x.request().url().includes('gps-ops') ? x.fulfill({ json: Array.from({ length: 24 }, (_, k) => omm(k)) }) : x.fulfill({ status: 503, body: '' });
  });
  await p2.goto(url);
  await p2.locator('#fuentes').filter({ hasText: /24 órbitas de CelesTrak/ }).waitFor();
  assert.match(await p2.textContent('#ahora .resumen'), /Satélites\s*\d+/);
  const antes = pedidasCelestrak;
  await p2.unroute('https://celestrak.org/**');
  await p2.route('https://celestrak.org/**', (x) => x.abort());
  await p2.reload();
  await p2.locator('#fuentes').filter({ hasText: /24 órbitas guardadas/ }).waitFor();
  assert.equal(antes, 4, 'una petición por constelación');
  gnssVacio = false;

  if (process.env.CAPTURA) await page.screenshot({ path: process.env.CAPTURA, fullPage: true });
  assert.equal(errores.length, 0, errores.join('\n'));
  console.log('ok - interfaz');
} finally {
  await navegador.close();
  srv.close();
}
