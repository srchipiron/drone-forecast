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
// 24 h antes de ahora: así el día de hoy sale entero a cualquier hora.
const inicio = Math.floor(ahora / 3600000) * 3600000 - 24 * 3600000;

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

// Para que context.route también sirva las peticiones del instalador (aviso de ventana).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
const { chromium } = cargarPlaywright();
const navegador = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {});
const errores = [];
try {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', colorScheme: process.env.ESQUEMA === 'oscuro' ? 'dark' : 'light' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errores.push(m.text()));
  await page.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: r.request().url().includes('models=') ? { hourly: { time: meteo().hourly.time, wind_speed_10m_gfs_seamless: meteo().hourly.wind_speed_10m, wind_speed_10m_icon_seamless: meteo().hourly.wind_speed_10m } } : meteo() }));
  const zonaAero = { features: [{ attributes: { name: 'CTR Madrid<script>', restriction: 'REQ_AUTHORIZATION', reason: 'AIR_TRAFFIC' } }] };
  await page.route('https://servais.enaire.es/**', (r) => r.fulfill({ json: /FeatureServer\/2\/query/.test(r.request().url()) ? zonaAero : { features: [] } }));
  await page.route('https://geocoding-api.open-meteo.com/**', (r) => r.fulfill({ json: { results: [{ name: 'Getafe<img src=x onerror="window.__xss=1">', admin1: 'Madrid', country: 'España', latitude: 40.3057, longitude: -3.7329 }] } }));
  await page.route('https://services.swpc.noaa.gov/**', (r) => r.fulfill({ json: [['time_tag', 'kp', 'observed'], ...Array.from({ length: 40 }, (_, k) => [new Date(inicio + k * 3 * 3600000).toISOString().slice(0, 19).replace('T', ' '), '2.00', 'predicted'])] }));

  // Ubicación denegada tal como la da Android (código 1). Chromium sin
  // permiso se queda esperando en vez de fallar, por eso se simula.
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_ok, mal) => setTimeout(() => mal({ code: 1, message: 'User denied Geolocation' }), 10);
  });
  await page.goto(url);
  await page.getByText('¿Dónde vas a volar?').waitFor();

  // Ubicación denegada: el aviso dice dónde dar el permiso (no «busca a mano» a secas).
  await page.getByRole('button', { name: 'Usar mi ubicación' }).first().click();
  await page.locator('#aviso').filter({ hasText: 'Permisos → Ubicación → Permitir' }).waitFor();
  await page.getByRole('button', { name: 'Buscar lugar' }).click();
  await page.fill('#txt-buscar', 'Getafe');
  await page.press('#txt-buscar', 'Enter');
  await page.locator('[data-res="0"]').click();
  await page.locator('#ahora .grande').filter({ hasText: /volar|precaución|No vueles/ }).waitFor();
  assert.equal(await page.evaluate(() => window.__xss), undefined, 'XSS: el nombre del lugar se ejecutó');
  assert.match(await page.textContent('#nombre-lugar'), /Getafe<img/);
  // Los datos simulados empiezan 24 h antes de ahora (no a medianoche como los
  // reales), así que según la hora y el horario de verano caen en 7 u 8 días.
  const dias = await page.locator('#dias .dia').count();
  assert.ok(dias >= 7 && dias <= 8, `días: ${dias}`);
  // Como UAV Forecast: hoy empieza en la hora en curso; mañana trae sus 24 horas.
  assert.ok(await page.locator('#horas tr.hora').count() >= 1, 'horas de hoy');
  assert.match(await page.locator('#horas tr.hora').first().getAttribute('class'), /\bactual\b/, 'hoy empieza en la hora actual');
  const sats = await page.textContent('#ahora [data-factor="satelites"] .c-valor');
  assert.match(sats, /^\d+$/, `satélites: ${sats}`);
  assert.equal(await page.textContent('#ahora [data-factor="kp"] .c-valor'), '2.0');
  assert.ok(await page.locator('#ahora .cartel').isVisible(), 'cartel del veredicto');
  // Icono de día o de noche según la hora a la que corra la prueba.
  assert.match(await page.textContent('#ahora .cartel .cielo'), /^(🌤️|🌙) Poco nuboso · 18 °C$/, 'el cielo, como en UAV Forecast');
  // La semana de un vistazo: cada día con una raya por hora de su color.
  assert.ok((await page.locator('#dias .dia').nth(1).locator('.d-barra i').count()) >= 23, 'barra de horas de mañana');
  assert.ok((await page.locator('#dias .dia').nth(1).locator('.d-barra i.ok, .d-barra i.precaucion, .d-barra i.no').count()) >= 23, 'cada raya con su estado');
  await page.locator('#ahora .enaire.dentro').waitFor();
  const enaire = await page.textContent('#ahora .enaire');
  assert.match(enaire, /Dentro de 1 zona UAS de ENAIRE/);
  assert.match(enaire, /CTR Madrid<script> · Aeronáutica · requiere autorización/, 'nombre escapado, capa y restricción');
  assert.equal(await page.locator('#ahora .enaire script').count(), 0);
  assert.equal(await page.locator('#ahora .enaire a').getAttribute('href'), 'https://drones.enaire.es/', 'ENAIRE bajo el veredicto');

  // Selector de dron: la gama actual agrupada por marca, Mini 5 Pro por defecto.
  assert.equal(await page.inputValue('#sel-dron'), 'mini5pro');
  const marcas = await page.locator('#sel-dron optgroup').evaluateAll((g) => g.map((x) => x.label));
  assert.deepEqual(marcas, ['DJI', 'DJI Enterprise', 'Autel', 'Skydio', 'Parrot']);
  assert.equal(await page.locator('#sel-dron option[value="mini4pro"]').count(), 0, 'sin modelos viejos');

  // Modo profesional: aparece misión y checklist; termografía FV mira la irradiancia.
  assert.ok(await page.locator('#campo-mision').isHidden());
  await page.getByRole('radio', { name: 'Profesional' }).click();
  assert.ok(await page.locator('#campo-mision').isVisible());
  assert.ok(await page.locator('#checklist').isVisible());
  await page.selectOption('#sel-mision', 'termografia_fv');
  // Informe para el cliente: se rellena y se manda a imprimir.
  await page.evaluate(() => {
    window.__impreso = 0;
    window.print = () => window.__impreso++;
  });
  await page.locator('[data-accion="informe"]').click();
  assert.equal(await page.evaluate(() => window.__impreso), 1);
  const informe = await page.textContent('#informe');
  assert.match(informe, /Condiciones de vuelo[^]*Termografía fotovoltaica[^]*DJI Mini 5 Pro[^]*CTR Madrid/);
  assert.match(informe, /Irradiancia/);
  assert.equal(await page.locator('#informe').isVisible(), false, 'en pantalla no se ve');
  await page.locator('#ahora .condicion').filter({ hasText: 'Irradiancia' }).waitFor();
  await page.locator('[data-check="0"]').check();
  await page.reload();
  assert.ok(await page.locator('[data-check="0"]').isChecked(), 'la checklist se guarda');
  assert.equal(await page.inputValue('#sel-mision'), 'termografia_fv', 'los ajustes se guardan');
  await page.getByRole('radio', { name: 'Recreativo' }).click();
  assert.ok(await page.locator('#checklist').isHidden());

  // Tocar una fila (cualquier celda, no solo la hora) la abre con su perfil de viento y sus factores.
  await page.locator('#horas tr.hora').first().locator('td').nth(2).click();
  assert.ok((await page.locator('#horas .fila-detalle .condicion').count()) >= 10);
  assert.equal(await page.locator('#horas tr.hora').first().locator('button').getAttribute('aria-expanded'), 'true');
  const perfil = page.locator('#horas .perfil-viento li');
  assert.equal(await perfil.count(), 4, '180, 120, 80 y 10 m');
  assert.match(await page.textContent('#horas .perfil-viento li.vuelo'), /120 m · vuelo/);
  const barra = page.locator('#horas .perfil-viento li.vuelo meter');
  assert.equal(await barra.getAttribute('high'), '12.00', 'límite del Mini 5 Pro');
  assert.equal(await barra.getAttribute('low'), '8.40', '70% del límite');
  // Cambiar el margen en Ajustes mueve la barra igual que el semáforo.
  const margen = async (v) => page.evaluate((x) => {
    const i = document.querySelector('#aj-margen');
    i.value = x;
    i.dispatchEvent(new Event('change', { bubbles: true }));
  }, v);
  await margen('50');
  assert.equal(await page.locator('#horas .perfil-viento li.vuelo meter').getAttribute('low'), '6.00', 'sigue al margen');
  await margen('70');

  assert.match(await page.textContent('#fuentes'), /24 órbitas del despliegue/);

  // Diagnóstico: abre, trae lo importante y queda copiado (o seleccionado).
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: url.replace(/\/$/, '') });
  // Pestañas: el Diagnóstico vive en Ajustes; Previsión oculta mientras tanto.
  await page.locator('[data-vista="ajustes"]').click();
  assert.equal(await page.locator('#vista-prevision').isHidden(), true);
  assert.equal(await page.locator('[data-vista="ajustes"]').getAttribute('aria-selected'), 'true');
  // Aviso de ventana: Chromium tiene Periodic Background Sync, así que la
  // tarjeta sale; sin permiso de notificaciones no se queda activado.
  assert.ok(await page.locator('#avisos').isVisible(), 'tarjeta del aviso de ventana');
  await page.evaluate(() => {
    Notification.requestPermission = async () => 'denied';
  });
  await page.locator('#aj-aviso').click();
  await page.locator('#estado-aviso').filter({ hasText: 'Sin permiso de notificaciones' }).waitFor();
  assert.equal(await page.locator('#aj-aviso').isChecked(), false, 'sin permiso no se queda activado');
  await page.getByRole('button', { name: 'Diagnóstico' }).click();
  const diag = await page.inputValue('#txt-diagnostico');
  assert.match(diag, /^Drone Forecast v\d+\.\d+\.\d+/);
  assert.match(diag, /Lugar: Getafe/);
  assert.match(diag, /Órbitas: 24 \(despliegue\)/);
  assert.match(diag, /Ahora \d\d:\d\d → /);
  assert.match(diag, /ENAIRE: dentro · 1 zonas \(CTR Madrid<script>\)/);
  assert.match(diag, /Aviso de ventana: apagado/);
  await page.locator('#estado-diagnostico').filter({ hasText: /Copiado|Copiar/ }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), diag, 'el portapapeles tiene el informe');
  await page.locator('#dlg-diagnostico button[value="cerrar"]').click();
  await page.locator('[data-vista="prevision"]').click();

  // Nada ensancha la página, y la tabla de horas cabe entera sin deslizarla
  // de lado, también en un móvil estrecho de 360 px.
  for (const ancho of [390, 360]) {
    await page.setViewportSize({ width: ancho, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordamiento horizontal a ${ancho} px`);
    assert.ok(await page.evaluate(() => { const t = document.querySelector('#horas .tabla-horas-marco'); return t.scrollWidth <= t.clientWidth; }), `la tabla de horas cabe a ${ancho} px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  // Mañana trae el día entero.
  await page.locator('#dias .dia').nth(1).click();
  assert.ok(await page.locator('#horas tr.hora').count() >= 23, 'horas de mañana');

  // Gráfica del día, plegada debajo de la tabla.
  assert.equal(await page.locator('#horas .grafica svg path.viento').count(), 1);
  assert.match(await page.locator('#horas .grafica path.viento').getAttribute('d'), /^M[\d.]+,[\d.]+ L/);
  assert.ok((await page.locator('#horas .grafica rect.franja').count()) >= 23);
  if (process.env.CAPTURA_GRAFICA) await page.locator('#horas .grafica').screenshot({ path: process.env.CAPTURA_GRAFICA });
  if (process.env.CAPTURA_HORAS) await page.locator('#horas .tabla-horas').screenshot({ path: process.env.CAPTURA_HORAS });

  // Diario: «He volado» → valoración → aparece en el diario y en su resumen.
  await page.locator('[data-accion="volado"]').click();
  await page.locator('#dlg-vuelo input[value="regular"]').check();
  await page.fill('#txt-vuelo', 'Rachas en la cresta <b>');
  await page.locator('#form-vuelo button[type="submit"]').click();
  await page.locator('#diario .lista-vuelos li').first().waitFor();
  assert.equal(await page.locator('[data-vista="diario"]').getAttribute('aria-selected'), 'true', 'al guardar te lleva al diario');
  assert.match(await page.textContent('#diario .lista-vuelos'), /Getafe<img[^]*Regular[^]*«Rachas en la cresta <b>»/);
  assert.match(await page.textContent('#diario-cuenta'), /\(1\)/);
  assert.match(await page.textContent('#diario .resumen-diario'), /1 vuelo: 0 bien · 1 regular · 0 mal/);
  const descarga = page.waitForEvent('download');
  await page.locator('[data-accion="exportar-diario"]').click();
  assert.match((await descarga).suggestedFilename(), /^diario-vuelos-\d{4}-\d\d-\d\d\.json$/);
  await page.reload();
  assert.match(await page.textContent('#diario-cuenta'), /\(1\)/, 'el diario se guarda');
  await page.locator('[data-vista="diario"]').click();
  await page.locator('[data-borrar-vuelo]').click();
  assert.equal(await page.locator('#diario .lista-vuelos li').count(), 0);
  await page.locator('[data-vista="prevision"]').click();

  // Favorito: al guardarlo sale su resumen, y coincide con la pantalla principal.
  await page.locator('#btn-lugar').click();
  await page.locator('[data-accion="guardar-fav"]').click();
  const chips = page.locator('#favoritos .resumen-fav .chip');
  await chips.nth(1).waitFor();
  const resumen = await chips.allTextContents();
  assert.match(resumen[0], /^Hoy (\d\d:\d\d–\d\d:\d\d|sin ventana)$/);
  assert.match(resumen[1], /^Mañana (\d\d:\d\d–\d\d:\d\d|sin ventana)$/);
  const manana = (await page.locator('#dias .dia').nth(1).locator('.d-ventana').textContent()).trim();
  assert.equal(resumen[1].replace('Mañana ', ''), manana === 'Sin ventana' ? 'sin ventana' : manana, 'mismo cálculo que la pantalla principal');
  await page.keyboard.press('Escape');

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
  await p2.route('https://servais.enaire.es/**', (x) => x.abort());
  await p2.goto(url);
  await p2.locator('#fuentes').filter({ hasText: /24 órbitas de CelesTrak/ }).waitFor({ state: 'attached' });
  await p2.locator('#ahora .enaire.sin-dato').filter({ hasText: 'No se pudo consultar ENAIRE' }).waitFor();
  assert.match(await p2.textContent('#ahora [data-factor="satelites"] .c-valor'), /^\d+$/);
  const antes = pedidasCelestrak;
  await p2.unroute('https://celestrak.org/**');
  await p2.route('https://celestrak.org/**', (x) => x.abort());
  await p2.reload();
  await p2.locator('#fuentes').filter({ hasText: /24 órbitas guardadas/ }).waitFor({ state: 'attached' });
  assert.equal(antes, 4, 'una petición por constelación');
  gnssVacio = false;

  // Ubicación permitida: el botón pone «Mi ubicación» y descarga su previsión.
  const ctx3 = await navegador.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', permissions: ['geolocation'], geolocation: { latitude: 40.3057, longitude: -3.7329 } });
  const p3 = await ctx3.newPage();
  p3.on('pageerror', (e) => errores.push(e.message));
  for (const r of ['https://api.open-meteo.com/**', 'https://services.swpc.noaa.gov/**', 'https://celestrak.org/**']) await p3.route(r, (x) => x.fulfill({ json: r.includes('open-meteo') ? meteo() : [] }));
  await p3.route('https://servais.enaire.es/**', (x) => x.fulfill({ json: { features: [] } }));
  await p3.goto(url);
  await p3.getByRole('button', { name: 'Usar mi ubicación' }).first().click();
  await p3.locator('#nombre-lugar').filter({ hasText: 'Mi ubicación' }).waitFor();
  await p3.locator('#ahora .grande').filter({ hasText: /volar|precaución|No vueles/ }).waitFor();
  await p3.locator('#ahora .enaire.fuera').filter({ hasText: 'No consta en ninguna zona UAS de ENAIRE' }).waitFor();

  // Carrera: la previsión del lugar anterior llega tarde y no pisa la del nuevo.
  const ctx4 = await navegador.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx4.addInitScript(() => {
    if (!localStorage.getItem('drone-forecast:lugar'))
      localStorage.setItem('drone-forecast:lugar', JSON.stringify({ nombre: 'Lento', zona: '', lat: 40.3, lon: -3.7 }));
  });
  const p4 = await ctx4.newPage();
  p4.on('pageerror', (e) => errores.push(e.message));
  for (const r of ['https://services.swpc.noaa.gov/**', 'https://celestrak.org/**', 'https://servais.enaire.es/**']) await p4.route(r, (x) => x.fulfill({ json: r.includes('enaire') ? { features: [] } : [] }));
  await p4.route('https://api.open-meteo.com/**', async (x) => {
    const lento = x.request().url().includes('latitude=40.3000');
    const m = meteo();
    m.hourly.temperature_2m = m.hourly.temperature_2m.map(() => (lento ? 18 : 31));
    if (lento) await new Promise((r) => setTimeout(r, 1500));
    await x.fulfill({ json: m });
  });
  await p4.route('https://geocoding-api.open-meteo.com/**', (x) => x.fulfill({ json: { results: [] } }));
  await p4.goto(url);
  await p4.locator('#btn-lugar').click();
  await p4.fill('#txt-buscar', '1.5, 1.5');
  await p4.press('#txt-buscar', 'Enter');
  await p4.locator('[data-res="0"]').click();
  await p4.waitForTimeout(2500);
  assert.match(await p4.textContent('#nombre-lugar'), /1\.5000, 1\.5000/);
  assert.match(await p4.textContent('#ahora'), /31 °C/, 'la previsión es la del lugar nuevo');
  assert.doesNotMatch(await p4.textContent('#ahora'), /18 °C/, 'la del anterior, que llegó tarde, no la pisa');

  // Previsión caducada (sin cobertura y con lo guardado de hace días): no se
  // enseña una hora vieja como si fuera «ahora».
  const ctx5 = await navegador.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx5.addInitScript(() => {
    localStorage.setItem('drone-forecast:lugar', JSON.stringify({ nombre: 'Viejo', zona: '', lat: 40.3, lon: -3.7 }));
  });
  const p5 = await ctx5.newPage();
  p5.on('pageerror', (e) => errores.push(e.message));
  for (const r of ['https://services.swpc.noaa.gov/**', 'https://celestrak.org/**', 'https://servais.enaire.es/**']) await p5.route(r, (x) => x.fulfill({ json: r.includes('enaire') ? { features: [] } : [] }));
  await p5.route('https://api.open-meteo.com/**', (x) => {
    const m = meteo();
    m.hourly.time = m.hourly.time.map((t) => t - 10 * 86400);
    return x.fulfill({ json: m });
  });
  await p5.goto(url);
  await p5.locator('#ahora .grande').filter({ hasText: 'Sin previsión para ahora' }).waitFor();
  assert.equal(await p5.locator('#ahora [data-accion="recargar"]').count(), 1);

  // El instalador de verdad (sin bloquear): con Periodic Background Sync se
  // registra el de tipo módulo, guarda la app para abrir sin red y, al
  // despertar, avisa de la ventana verde de mañana en un favorito.
  const ctx6 = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  await ctx6.grantPermissions(['notifications'], { origin: url.replace(/\/$/, '') });
  const tranquilo = () => {
    const m = meteo();
    for (const k of ['wind_speed_10m', 'wind_speed_80m', 'wind_speed_120m', 'wind_speed_180m']) m.hourly[k] = m.hourly[k].map(() => 3);
    return m;
  };
  await ctx6.route('https://api.open-meteo.com/**', (x) => x.fulfill({ json: tranquilo() }));
  for (const r of ['https://services.swpc.noaa.gov/**', 'https://celestrak.org/**']) await ctx6.route(r, (x) => x.fulfill({ json: [] }));
  await ctx6.route('https://servais.enaire.es/**', (x) => x.fulfill({ json: { features: [] } }));
  await ctx6.addInitScript(() => {
    localStorage.setItem('drone-forecast:favoritos', JSON.stringify([{ nombre: 'Getafe', zona: 'Madrid', lat: 40.3, lon: -3.73 }]));
    localStorage.setItem('drone-forecast:aviso', 'true');
    // Con los 24 satélites de prueba se ven unos 7: el aviso usa estos ajustes, no los de fábrica.
    localStorage.setItem('drone-forecast:ajustes', JSON.stringify({ minSats: 4 }));
  });
  const p6 = await ctx6.newPage();
  p6.on('pageerror', (e) => errores.push(e.message));
  await p6.goto(url);
  const sw6 = await p6.evaluate(async () => (await navigator.serviceWorker.ready).active.scriptURL);
  assert.match(sw6, /\/sw-modulo\.js$/, 'en Chromium va el instalador con aviso');
  assert.ok(await p6.evaluate(async () => (await (await caches.open((await caches.keys()).find((k) => k.startsWith('drone-forecast-')))).keys()).length >= 25), 'el de tipo módulo también guarda la app');
  // La página le deja al instalador favoritos y ajustes.
  for (let i = 0; i < 40; i++) {
    const n = await p6.evaluate(async () => {
      const r = await caches.match(new URL('aviso-config.json', location.href).href, { cacheName: 'df-aviso' });
      return r ? ((await r.json()).favoritos ?? []).length : 0;
    });
    if (n === 1) break;
    assert.ok(i < 39, 'la página no le ha dejado los favoritos al instalador');
    await p6.waitForTimeout(250);
  }
  const cdp = await ctx6.newCDPSession(p6);
  const registros = new Promise((ok) => cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => e.registrations.length && ok(e.registrations)));
  await cdp.send('ServiceWorker.enable');
  const [reg6] = await registros;
  await cdp.send('ServiceWorker.dispatchPeriodicSyncEvent', { origin: url.replace(/\/$/, ''), registrationId: reg6.registrationId, tag: 'aviso-ventana' });
  // getNotifications() es asíncrona: se pregunta hasta que llega (15 s como mucho).
  let notif;
  for (let i = 0; i < 60 && !notif; i++) {
    [notif] = await p6.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ titulo: n.title, cuerpo: n.body })));
    if (!notif) await p6.waitForTimeout(250);
  }
  assert.ok(notif, 'el instalador no ha avisado');
  assert.equal(notif.titulo, 'Mañana se puede volar en Getafe');
  assert.match(notif.cuerpo, /^Getafe: \d\d:00–\d\d:00 \(\d+ h\)$/);
  // Sin red, la app abre desde lo guardado por el instalador.
  await ctx6.setOffline(true);
  await p6.reload();
  await p6.locator('#ahora').waitFor();

  if (process.env.CAPTURA) await page.screenshot({ path: process.env.CAPTURA, fullPage: true });
  assert.equal(errores.length, 0, errores.join('\n'));
  console.log('ok - interfaz');
} finally {
  await navegador.close();
  srv.close();
}
