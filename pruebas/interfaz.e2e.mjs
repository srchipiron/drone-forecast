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
  // ENAIRE: la respuesta real de Getafe (capa aeronáutica), con un <script> metido en un nombre.
  const zonaAero = JSON.parse(await readFile(join(raiz, 'pruebas/fixtures/enaire-getafe-aero.json'), 'utf8'));
  zonaAero.features[0].attributes.name = 'MADRID/Getafe<script>';
  // Las formas para el mapa: las reales alrededor de Getafe, con HTML metido en un nombre.
  const formasAero = JSON.parse(await readFile(join(raiz, 'pruebas/fixtures/enaire-getafe-formas.json'), 'utf8'));
  formasAero.features.find((f) => f.attributes.identifier === 'LEMD_CT').attributes.name = 'CTR MADRID<img src=x onerror="window.__xss=2">';
  const capasPedidas = [];
  const enaireUrls = [];
  const formasPedidas = [];
  const enaireMapa = { urbanaCaida: false, lento: false };
  await page.route('https://servais.enaire.es/**', (r) => {
    const u = r.request().url();
    if (u.includes('esriGeometryEnvelope')) {
      formasPedidas.push(u);
      if (enaireMapa.urbanaCaida && /FeatureServer\/3\//.test(u)) return r.fulfill({ status: 500, body: '' });
      if (enaireMapa.lento) return new Promise((ok) => setTimeout(ok, 1500)).then(() => r.fulfill({ json: /FeatureServer\/2\/query/.test(u) ? formasAero : { features: [] } }));
      return r.fulfill({ json: /FeatureServer\/2\/query/.test(u) ? formasAero : { features: [] } });
    }
    enaireUrls.push(u);
    capasPedidas.push(u.match(/FeatureServer\/(\d+)\//)?.[1]);
    return r.fulfill({ json: /FeatureServer\/2\/query/.test(u) ? zonaAero : { features: [] } });
  });
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
  // Accesibilidad (lo que encontró axe-core): un h1 para orientarse, la barra
  // de pestañas como zona de navegación y el aria-checked solo en los botones del modo.
  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.locator('nav[aria-label="Secciones"] > [role="tablist"] [role="tab"]').count(), 3);
  assert.deepEqual(await page.locator('[aria-checked]').evaluateAll((xs) => xs.map((x) => x.dataset.modo)), ['recreativo', 'profesional']);
  assert.match(await page.textContent('#ahora .ventana-hoy strong'), /^Ninguna en [78] días$/, 'sin nada volable en la semana, lo dice');
  // Icono de día o de noche según la hora a la que corra la prueba.
  assert.match(await page.textContent('#ahora .cartel .cielo'), /^(🌤️|🌙) Poco nuboso · 18 °C$/, 'el cielo, como en UAV Forecast');
  // La semana de un vistazo: cada día con una raya por hora de su color.
  assert.ok((await page.locator('#dias .dia').nth(1).locator('.d-barra i').count()) >= 23, 'barra de horas de mañana');
  assert.ok((await page.locator('#dias .dia').nth(1).locator('.d-barra i.ok, .d-barra i.precaucion, .d-barra i.no').count()) >= 23, 'cada raya con su estado');
  // Zonas UAS: resumen a tu altura (120 m), una ficha por zona y lo que no te afecta aparte.
  await page.locator('#zonas .zonas-resumen.precaucion').waitFor();
  assert.deepEqual([...new Set(capasPedidas)].sort(), ['0', '2', '3'], 'solo las capas que existen');
  assert.equal(await page.textContent('#zonas .zonas-titulo'), 'Necesitas autorización a 120 m');
  assert.match(await page.textContent('#zonas .zonas-resumen'), /5 zonas te afectan\./);
  assert.equal(await page.locator('#zonas > .lista-zonas > .zona').count(), 5);
  assert.equal(await page.locator('#zonas .zonas-otras .zona').count(), 1, 'la TMA empieza a 305 m: aparte');
  const zonasTexto = await page.textContent('#zonas');
  assert.match(zonasTexto, /MADRID\/Getafe<script>/, 'el nombre escapado, tal cual');
  assert.equal(await page.locator('#zonas script').count(), 0);
  assert.doesNotMatch(zonasTexto, /<elem>|<font|<p>|&lt;/, 'el HTML de ENAIRE no se ve');
  assert.match(zonasTexto, /Desde 60 m hasta 305 m sobre el suelo/);
  assert.match(zonasTexto, /NO permitido el vuelo a drones excepto coordinación con el Aeródromo\./);
  assert.equal(await page.locator('#zonas .zona-destacado').filter({ hasText: 'altura máxima de 60m' }).count(), 1, 'la frase que repiten el CTR y la ATZ, una vez');
  assert.equal(await page.locator('#zonas a[href="mailto:seguridad_operacional_MCV@aena.es"]').count(), 1);
  assert.equal(await page.locator('#zonas a[href="tel:+34913210900"]').count(), 1);
  assert.equal(await page.locator('#zonas a[href="https://planea.enaire.es/nsf/login"]').first().getAttribute('rel'), 'noopener noreferrer');
  assert.equal(await page.textContent('#ahora .zonas-fila a'), 'Autorización (5) ›', 'resumen en el cartel');
  assert.equal(await page.locator('#ahora .zonas-fila a').getAttribute('href'), '#zonas');
  // A 30 m solo te afectan las dos que empiezan en el suelo.
  await page.selectOption('#sel-altitud', '30');
  assert.match(await page.textContent('#zonas .zonas-resumen'), /2 zonas te afectan\./);
  assert.equal(await page.locator('#zonas .zonas-otras .zona').count(), 4);
  await page.selectOption('#sel-altitud', '120');

  // Compartir: el menú del móvil con lugar, dron y ventanas.
  await page.evaluate(() => {
    navigator.share = async (d) => {
      window.__compartido = d;
    };
  });
  await page.locator('[data-accion="compartir"]').click();
  const compartido = await page.evaluate(() => window.__compartido);
  assert.match(compartido.title, /^Drone Forecast · Getafe/);
  assert.match(compartido.text, /^🚁 Getafe<img[^\n]* · DJI Mini 5 Pro a 120 m\nAhora \(\d\d:00\): [^\n]+\nViento \d+ km\/h, rachas \d+ km\/h\nMejor ventana hoy: [^\n]+\nMañana: [^\n]+\n(Sin ventana en los próximos [78] días\n)?http:\/\/127\.0\.0\.1:\d+\/$/);

  // La primera vez no había instalador: su llegada no es una «versión nueva».
  await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
  assert.ok(await page.locator('#actualizar').isHidden(), 'sin instalador previo no hay aviso de versión nueva');

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
  // En profesional son tres selectores: a 360 px bajan de línea en vez de salirse.
  await page.setViewportSize({ width: 360, height: 844 });
  assert.ok(
    await page.evaluate(() => {
      const t = document.querySelector('.selectores').getBoundingClientRect();
      return [...document.querySelectorAll('.selectores select')].every((x) => x.getBoundingClientRect().right <= t.right + 1);
    }),
    'los selectores caben a 360 px',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  // Informe para el cliente: se rellena y se manda a imprimir.
  await page.evaluate(() => {
    window.__impreso = 0;
    window.print = () => window.__impreso++;
  });
  await page.locator('[data-accion="informe"]').click();
  assert.equal(await page.evaluate(() => window.__impreso), 1);
  const informe = await page.textContent('#informe');
  assert.match(informe, /Condiciones de vuelo[^]*Termografía fotovoltaica[^]*DJI Mini 5 Pro[^]*CTR MADRID: requiere autorización, desde 60 m hasta 305 m sobre el suelo/);
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
  assert.match(await page.textContent('#horas .fila-detalle .cielo'), /Poco nuboso · 18 °C/, 'el detalle dice el cielo');
  // La columna del cielo: un icono por hora con su nombre para el lector de pantalla.
  assert.match(await page.locator('#horas tr.hora').first().locator('[role="img"]').getAttribute('aria-label'), /^Poco nuboso$/);
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
  // Instalar: sin invitación del navegador la tarjeta no sale; con ella, el
  // botón lanza la ventana de instalación del navegador.
  assert.ok(await page.locator('#instalar').isHidden(), 'sin invitación, nada que instalar');
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = async () => {
      window.__instalar = (window.__instalar ?? 0) + 1;
    };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
    window.__cancelada = e.defaultPrevented;
  });
  assert.equal(await page.evaluate(() => window.__cancelada), true, 'se guarda para el botón (no sale la barra del navegador)');
  await page.locator('#btn-instalar').click();
  await page.locator('#estado-instalar').filter({ hasText: 'Instalando' }).waitFor();
  assert.equal(await page.evaluate(() => window.__instalar), 1);
  assert.ok(await page.locator('#btn-instalar').isHidden(), 'la invitación solo sirve una vez');

  // Aviso de ventana: Chromium tiene Periodic Background Sync, así que la
  // tarjeta sale; sin permiso de notificaciones no se queda activado.
  assert.ok(await page.locator('#avisos').isVisible(), 'tarjeta del aviso de ventana');
  await page.evaluate(() => {
    Notification.requestPermission = async () => 'denied';
  });
  await page.locator('#aj-aviso').click();
  await page.locator('#estado-aviso').filter({ hasText: 'Sin permiso de notificaciones' }).waitFor();
  assert.equal(await page.locator('#aj-aviso').isChecked(), false, 'sin permiso no se queda activado');
  // Pantalla «al sol»: se aplica, se guarda y no hace que nada se salga a lo ancho.
  assert.equal(await page.inputValue('#aj-pantalla'), 'auto');
  await page.selectOption('#aj-pantalla', 'sol');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'sol');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(255, 255, 255)');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '18px', 'letra un poco más grande');
  await page.reload();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'sol', 'se guarda');
  await page.setViewportSize({ width: 360, height: 800 });
  for (const v of ['prevision', 'ajustes']) {
    await page.locator(`[data-vista="${v}"]`).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `al sol, nada se sale a 360 px (${v})`);
  }
  if (process.env.CAPTURA_SOL) {
    await page.locator('[data-vista="prevision"]').click();
    await page.screenshot({ path: process.env.CAPTURA_SOL });
    await page.locator('[data-vista="ajustes"]').click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.selectOption('#aj-pantalla', 'auto');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), undefined);
  // Mis drones: marcar uno en Ajustes lo compara en el cartel; el elegido no se repite.
  await page.locator('[data-mi-dron="neo"]').check();
  await page.locator('[data-mi-dron="mini5pro"]').check();
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('drone-forecast:ajustes')).misDrones), ['neo', 'mini5pro'], 'se guarda');
  const otros = page.locator('#ahora .otros-drones li');
  assert.equal(await otros.count(), 1, 'solo el Neo: el Mini 5 Pro es el que ya está elegido');
  assert.match(await otros.first().textContent(), /(Volar|Ojo|No)\s+DJI Neo/);
  // Y en la vista de días, su ventana de cada día; tocar uno abre ese día.
  await page.locator('[data-vista="prevision"]').click();
  assert.ok(await page.locator('#dias-drones').isVisible());
  assert.equal(await page.locator('#dias-drones li').count(), 1);
  assert.match(await page.textContent('#dias-drones li strong'), /^DJI Neo$/);
  if (process.env.CAPTURA_DRONES) await page.locator('#dias-drones').screenshot({ path: process.env.CAPTURA_DRONES });
  const chipsNeo = page.locator('#dias-drones .chip');
  assert.equal(await chipsNeo.count(), await page.locator('#dias .dia').count(), 'un día por cada día de la previsión');
  assert.match(await chipsNeo.nth(1).textContent(), /^Mañ\. (\d\d–\d\d h|—)$/);
  await chipsNeo.nth(2).click();
  assert.equal(await page.locator('#dias .dia').nth(2).getAttribute('aria-pressed'), 'true', 'el día tocado se abre');
  await page.locator('#dias .dia').first().click();
  await page.locator('[data-vista="ajustes"]').click();
  await page.locator('[data-mi-dron="neo"]').uncheck();
  assert.equal(await page.locator('#dias-drones').isVisible(), false, 'sin otros drones, no sale la tarjeta');
  assert.equal(await page.locator('#ahora .otros-drones').count(), 0, 'sin otros drones, no sale');
  await page.getByRole('button', { name: 'Diagnóstico' }).click();
  const diag = await page.inputValue('#txt-diagnostico');
  assert.match(diag, /^Drone Forecast v\d+\.\d+\.\d+/);
  assert.match(diag, /Lugar: Getafe/);
  assert.match(diag, /Órbitas: 24 \(despliegue\)/);
  assert.match(diag, /Ahora \d\d:\d\d → /);
  assert.match(diag, /ENAIRE: dentro · 6 zonas \(MADRID\/Getafe<script>, ATZ MADRID\/GETAFE, /);
  assert.match(diag, /Aviso de ventana: apagado/);
  await page.locator('#estado-diagnostico').filter({ hasText: /Copiado|Copiar/ }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), diag, 'el portapapeles tiene el informe');
  await page.locator('#dlg-diagnostico button[value="cerrar"]').click();
  await page.locator('[data-vista="prevision"]').click();

  // Nada ensancha la página ni a 320 px, y la tabla de horas cabe entera sin
  // deslizarla de lado en un móvil de 360 px (por debajo, se desliza en su marco).
  for (const ancho of [390, 360, 320]) {
    await page.setViewportSize({ width: ancho, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordamiento horizontal a ${ancho} px`);
    if (ancho >= 360)
      assert.ok(await page.evaluate(() => { const t = document.querySelector('#horas .tabla-horas-marco'); return t.scrollWidth <= t.clientWidth; }), `la tabla de horas cabe a ${ancho} px`);
    // Todos los días a la vista sin deslizar (en algunos móviles las tiras no se deslizan).
    assert.ok(
      await page.evaluate(() => {
        const t = document.querySelector('#dias').getBoundingClientRect();
        return [...document.querySelectorAll('#dias .dia')].every((d) => {
          const r = d.getBoundingClientRect();
          return r.left >= t.left - 1 && r.right <= t.right + 1 && r.width > 0;
        });
      }),
      `todos los días caben a ${ancho} px`,
    );
    if (ancho >= 360)
      assert.ok(await page.evaluate(() => [...document.querySelectorAll('#dias .dia .d-ventana, #dias .dia .d-nombre')].every((x) => x.scrollWidth <= x.clientWidth + 1)), `el texto de los días no se corta a ${ancho} px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  // Mañana trae el día entero.
  await page.locator('#dias .dia').nth(1).click();
  assert.ok(await page.locator('#horas tr.hora').count() >= 23, 'horas de mañana');
  // Cambiar de día deslizando el dedo (detectado por la app, no por el
  // desplazamiento del navegador) o con las flechas ‹ ›.
  const deslizar = (sel, dx, dy = 0) =>
    page.evaluate(
      ({ sel, dx, dy }) => {
        const el = document.querySelector(sel);
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + 40;
        const t = (cx, cy) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: cy });
        el.dispatchEvent(new TouchEvent('touchstart', { touches: [t(x, y)], changedTouches: [t(x, y)], bubbles: true }));
        el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(x + dx, y + dy)], bubbles: true }));
      },
      { sel, dx, dy },
    );
  const diaActivo = () => page.evaluate(() => [...document.querySelectorAll('#dias .dia')].findIndex((d) => d.classList.contains('activo')));
  assert.equal(await page.textContent('#horas .dia-tabla'), 'Mañana');
  await deslizar('#horas', -120);
  assert.equal(await diaActivo(), 2, 'dedo a la izquierda: día siguiente');
  assert.equal(await page.textContent('#horas .dia-tabla'), await page.locator('#dias .dia').nth(2).locator('.d-nombre').textContent());
  await deslizar('#horas', -100, 90);
  assert.equal(await diaActivo(), 2, 'en diagonal (bajando por la página) no cambia');
  await deslizar('#dias', 120);
  assert.equal(await diaActivo(), 1, 'sobre los días también, y a la derecha vuelve');
  await page.locator('#horas [data-dia-paso="-1"]').click();
  assert.equal(await diaActivo(), 0);
  assert.ok(await page.locator('#horas [data-dia-paso="-1"]').isDisabled(), 'en hoy no hay anterior');
  await deslizar('#horas', 120);
  assert.equal(await diaActivo(), 0, 'antes de hoy no hay nada');
  await page.locator('#horas [data-dia-paso="1"]').click();
  assert.equal(await diaActivo(), 1);

  // Gráfica del día, plegada debajo de la tabla.
  assert.equal(await page.locator('#horas .grafica svg path.viento').count(), 1);
  assert.match(await page.locator('#horas .grafica path.viento').getAttribute('d'), /^M[\d.]+,[\d.]+ L/);
  assert.ok((await page.locator('#horas .grafica rect.franja').count()) >= 23);
  if (process.env.CAPTURA_GRAFICA) await page.locator('#horas .grafica').screenshot({ path: process.env.CAPTURA_GRAFICA });
  if (process.env.CAPTURA_HORAS) await page.locator('#horas .tabla-horas').screenshot({ path: process.env.CAPTURA_HORAS });

  // Vuelo planificado: mañana de 10 a 12, con nota; sale en su tarjeta y se borra.
  // Con 4 satélites de mínimo (la constelación de prueba es pequeña) hay horas
  // en verde, y así se prueban los huecos; al acabar se deja como estaba.
  const minSatsAntes = await page.inputValue('#aj-sats');
  await page.locator('[data-vista="ajustes"]').click();
  await page.fill('#aj-sats', '4');
  await page.locator('#aj-sats').dispatchEvent('change');
  await page.locator('[data-vista="prevision"]').click();
  assert.equal(await page.locator('#planes').isVisible(), false, 'sin planes no hay tarjeta');
  await page.locator('[data-accion="planificar"]').click();
  await page.locator('#dlg-plan').waitFor();
  assert.match(await page.textContent('#plan-lugar'), /^En Getafe<img[^]*a 120 m\.$/);
  // Los huecos de la semana para las horas pedidas: tocar uno elige su día y su hora.
  const hueco = page.locator('#plan-huecos [data-hueco]').last();
  if ((await page.locator('#plan-huecos [data-hueco]').count()) > 0) {
    assert.match(await page.textContent('#plan-huecos .nota'), /^(Con 2 h seguidas en verde:|Ningún día tiene 2 h seguidas en verde; en ámbar:)$/);
    const [ms, k] = [await hueco.getAttribute('data-hueco'), await hueco.getAttribute('data-hueco-dia')];
    await hueco.click();
    assert.equal(await page.inputValue('#plan-dia'), k);
    assert.equal(await page.inputValue('#plan-hora'), ms);
    assert.match(await page.locator('#plan-huecos .chip.activo').getAttribute('data-hueco'), new RegExp(`^${ms}$`), 'el hueco elegido se marca');
  } else assert.fail(`sin huecos con 4 satélites de mínimo: ${await page.textContent('#plan-huecos')}`);
  if (process.env.CAPTURA_HUECOS) await page.locator('#dlg-plan').screenshot({ path: process.env.CAPTURA_HUECOS });
  // Con 4 h seguidas cambian (o desaparecen) los huecos.
  await page.selectOption('#plan-horas', '4');
  assert.match(await page.textContent('#plan-huecos'), /4 h seguidas/);
  await page.selectOption('#plan-dia', '1');
  const horasManana = await page.locator('#plan-hora option').count();
  assert.ok(horasManana >= 23 && horasManana <= 25, `mañana tiene todas sus horas (${horasManana}; 23 o 25 el día del cambio de hora)`);
  await page.selectOption('#plan-hora', { label: '10:00' });
  await page.selectOption('#plan-horas', '2');
  assert.match(await page.textContent('#plan-previa'), /^Ahora mismo: (verde|ámbar|rojo)/);
  await page.fill('#plan-nota', 'Cliente <b>');
  if (process.env.CAPTURA_PLAN) await page.locator('#dlg-plan').screenshot({ path: process.env.CAPTURA_PLAN.replace('.png', '-dialogo.png') });
  await page.locator('#form-plan button[type="submit"]').click();
  await page.locator('#planes .plan').waitFor();
  assert.equal(await page.locator('#dlg-plan').isVisible(), false);
  const textoPlan = await page.textContent('#planes .plan');
  assert.match(textoPlan, /\d{1,2} \w+, 10:00–12:00[^]*Getafe<img[^]*«Cliente <b>»/, textoPlan);
  assert.match(await page.textContent('#planes .estado-plan'), /^(Verde|Ámbar|Rojo)/);
  assert.match(textoPlan, /· DJI Mini 5 Pro a 120 m ·/, 'el plan dice con qué dron y a qué altura se juzga');
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  if (process.env.CAPTURA_PLAN) await page.locator('#planes').screenshot({ path: process.env.CAPTURA_PLAN });
  // Informe para el cliente del plan: sus dos horas, su peor hora y las zonas de su punto.
  await page.evaluate(() => {
    window.__impreso = 0;
    window.print = () => window.__impreso++;
  });
  await page.locator('[data-informe-plan]').click();
  await page.waitForFunction(() => window.__impreso === 1);
  const informePlan = await page.textContent('#informe');
  assert.match(informePlan, /^\s*Vuelo planificado\s*Getafe<img[^]*Vuelo\s*\w+ \d{1,2} \w+, 10:00–12:00 · Cliente <b>[^]*Previsión de esas horas\s*(Verde|Ámbar|Rojo)/);
  assert.match(informePlan, /CTR MADRID: requiere autorización/);
  assert.match(informePlan, /Las horas del vuelo/);
  assert.equal(await page.locator('#informe .horas-informe').first().locator('tr').count(), 3, 'cabecera y las dos horas del plan');
  assert.match(informePlan, /Factores a las 1[01]:00 \(la peor hora del vuelo\)/);
  // Al calendario: sin «Compartir» de ficheros (Chrome de escritorio), se descarga el .ics.
  const descargaIcs = page.waitForEvent('download');
  await page.locator('[data-calendario-plan]').click();
  const ics = await descargaIcs;
  assert.match(ics.suggestedFilename(), /^vuelo-\d{4}-\d\d-\d\d\.ics$/);
  const textoIcs = (await readFile(await ics.path(), 'utf8')).replace(/\r\n /g, '');
  assert.match(textoIcs, /^BEGIN:VCALENDAR\r\n/);
  assert.match(textoIcs, /\r\nDTSTART:\d{8}T\d{6}Z\r\n/);
  assert.match(textoIcs, /\r\nSUMMARY:Vuelo con dron · Getafe<img src=x onerror="window\.__xss=1">\r\n/);
  assert.match(textoIcs, /\r\nDESCRIPTION:Cliente <b>\\nPrevisión al exportarlo: (verde|ámbar|rojo)/);
  // Un plan en otro sitio: su previsión se baja aparte y el informe pregunta a ENAIRE por SU punto.
  await page.evaluate(() => {
    const planes = JSON.parse(localStorage.getItem('drone-forecast:planes'));
    planes.push({ ...planes[0], id: `${planes[0].id}-segovia`, lugar: { nombre: 'Segovia', lat: 40.95, lon: -4.12 }, nota: '' });
    localStorage.setItem('drone-forecast:planes', JSON.stringify(planes));
  });
  await page.reload();
  await page.locator('#planes [data-informe-plan$="-segovia"]').waitFor();
  assert.equal(await page.locator('#planes .plan').count(), 2);
  await page.evaluate(() => {
    window.__impreso = 0;
    window.print = () => window.__impreso++;
  });
  await page.locator('#planes [data-informe-plan$="-segovia"]').click();
  await page.waitForFunction(() => window.__impreso === 1);
  assert.match(await page.textContent('#informe'), /^\s*Vuelo planificado\s*Segovia \(40\.95000, -4\.12000\)/);
  assert.ok(enaireUrls.some((u) => u.includes('geometry=-4.120000%2C40.950000')), 'ENAIRE preguntado por el punto del plan');
  await page.locator('#planes [data-borrar-plan$="-segovia"]').click();
  await page.locator('#planes .plan').first().waitFor();
  await page.locator('[data-borrar-plan]').click();
  assert.equal(await page.locator('#planes').isVisible(), false, 'borrado el único plan, la tarjeta se va');
  // Con 20 planes (el tope) no se guarda otro a escondidas: lo dice y el diálogo sigue abierto.
  await page.evaluate(() => {
    const base = Math.ceil(Date.now() / 3600000) * 3600000 + 48 * 3600000;
    const planes = Array.from({ length: 20 }, (_, k) => ({ id: `p${k}`, ms: base + k * 3600000, horas: 1, lugar: { nombre: `Sitio ${k}`, lat: 40.3057, lon: -3.7329 }, zona: 'Europe/Madrid', estado: null, nota: '', ajustes: null }));
    localStorage.setItem('drone-forecast:planes', JSON.stringify(planes));
  });
  await page.reload();
  await page.locator('#planes .plan').first().waitFor();
  // Eran planes «de antes» (sin ajustes): al arrancar se quedan con el dron de ahora.
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('drone-forecast:planes')).filter((x) => x.ajustes?.dron === 'mini5pro').length), 20);
  await page.locator('[data-accion="planificar"]').click();
  await page.locator('#form-plan button[type="submit"]').click();
  assert.match(await page.textContent('#plan-previa'), /^Ya tienes 20 vuelos planificados: borra alguno para añadir otro\.$/);
  assert.ok(await page.locator('#dlg-plan').isVisible());
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('drone-forecast:planes')).length), 20);
  await page.locator('[data-accion="cerrar-plan"]').click();
  await page.evaluate(() => localStorage.removeItem('drone-forecast:planes'));
  await page.reload();
  await page.locator('#ahora .cartel').waitFor();
  await page.locator('[data-vista="ajustes"]').click();
  await page.fill('#aj-sats', minSatsAntes);
  await page.locator('#aj-sats').dispatchEvent('change');
  await page.locator('[data-vista="prevision"]').click();

  // Un plan en marcha y otro terminado: «He volado» / «Guardar en el diario» lo apunta con SU hora y se va de la tarjeta.
  await page.evaluate(() => {
    const H = 3600000;
    const hora = Math.floor(Date.now() / H) * H;
    const lugar = { nombre: 'Getafe plan', lat: 40.3057, lon: -3.7329 };
    const base = { horas: 1, lugar, zona: 'Europe/Madrid', estado: 'ok', ajustes: null };
    localStorage.setItem('drone-forecast:planes', JSON.stringify([
      { ...base, id: 'terminado', ms: hora - 3 * H, nota: 'Nave 3' },
      { ...base, id: 'en-marcha', ms: hora, nota: '' },
    ]));
  });
  await page.reload();
  await page.locator('#planes [data-volado-plan="terminado"]').waitFor();
  assert.equal(await page.textContent('#planes [data-volado-plan="terminado"]'), 'Guardar en el diario');
  assert.equal(await page.textContent('#planes [data-volado-plan="en-marcha"]'), 'He volado');
  assert.match(await page.locator('#planes .plan.e-terminado .estado-plan').textContent(), /^Terminado: ¿cómo ha ido\?$/);
  assert.equal(await page.locator('#planes .plan.e-terminado [data-calendario-plan]').count(), 0, 'pasado, sin calendario');
  await page.locator('#planes [data-volado-plan="terminado"]').click();
  await page.locator('#dlg-vuelo').waitFor();
  assert.match(await page.textContent('#vuelo-prevision'), /Getafe plan\. La app decía: /);
  assert.equal(await page.inputValue('#txt-vuelo'), 'Nave 3', 'la nota del plan, de partida');
  await page.locator('#dlg-vuelo input[value="bien"]').check();
  await page.locator('#form-vuelo button[type="submit"]').click();
  await page.locator('#diario .lista-vuelos li').first().waitFor();
  assert.match(await page.textContent('#diario .lista-vuelos li'), /Getafe plan[^]*Bien[^]*«Nave 3»/);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('drone-forecast:planes')).map((x) => x.id)), ['en-marcha'], 'el apuntado sale de los planes');
  // Se limpia para lo que sigue.
  await page.evaluate(() => {
    localStorage.removeItem('drone-forecast:planes');
    localStorage.removeItem('drone-forecast:diario');
  });
  await page.reload();
  await page.locator('#ahora .cartel').waitFor();

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
  const descargaCSV = page.waitForEvent('download');
  await page.locator('[data-accion="exportar-csv"]').click();
  const csv = await descargaCSV;
  assert.match(csv.suggestedFilename(), /^diario-vuelos-\d{4}-\d\d-\d\d\.csv$/);
  const lineasCSV = (await readFile(await csv.path(), 'utf8')).split('\r\n');
  assert.match(lineasCSV[0], /^\uFEFFFecha;Hora;Lugar;/, 'con BOM y separador «;»');
  assert.match(lineasCSV[1], /^\d{4}-\d\d-\d\d;\d\d:\d\d;"Getafe<img src=x onerror=""window\.__xss=1"">";40,30570;-3,73290;DJI [^;]+;[^;]+;120;(Verde|Ámbar|Rojo);[^]*;Regular;Rachas en la cresta <b>$/);
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
  const manana = await page.locator('#dias .dia').nth(1).getAttribute('data-ventana');
  assert.equal(resumen[1].replace('Mañana ', ''), manana === 'Sin ventana' ? 'sin ventana' : manana, 'mismo cálculo que la pantalla principal');
  await page.keyboard.press('Escape');

  // Mapa: arrastrar, acercar, tocar el punto y usarlo como lugar.
  const tesela = await readFile(join(raiz, 'icons/icono-192.png'));
  const teselasPedidas = [];
  await page.route('https://tile.openstreetmap.org/**', (x) => {
    teselasPedidas.push(x.request().url());
    return x.fulfill({ body: tesela, contentType: 'image/png' });
  });
  await page.locator('#btn-lugar').click();
  await page.locator('#btn-mapa').click();
  const caja = await page.locator('#mapa').boundingBox();
  assert.ok((await page.locator('#mapa .mapa-teselas img').count()) >= 4, 'teselas que tapan el mapa');
  assert.ok(teselasPedidas.every((u) => /^https:\/\/tile\.openstreetmap\.org\/13\/\d+\/\d+\.png$/.test(u)), 'teselas de OSM en z13');
  const centroX = caja.x + caja.width / 2;
  const centroY = caja.y + caja.height / 2;
  // Las zonas de ENAIRE encima: las 13 del rectángulo, de las tres capas.
  await page.locator('#zonas-mapa').filter({ hasText: 'Zonas de ENAIRE a la vista: 13' }).waitFor();
  assert.match(await page.textContent('#zonas-mapa'), /a 120 m, 12 te afectan\.$/, 'la TMA empieza en 305 m');
  assert.deepEqual([...new Set(formasPedidas.map((u) => u.match(/FeatureServer\/(\d+)\//)[1]))].sort(), ['0', '2', '3']);
  assert.equal(await page.locator('#mapa .mapa-zonas path').count(), 13);
  assert.equal(await page.locator('#mapa .mapa-zonas path.sin-efecto').count(), 1);
  assert.ok(Math.abs(Number(await page.locator('#mapa .mapa-zonas').getAttribute('width')) - caja.width) < 2, 'la capa de zonas mide lo que el mapa');
  // Tocar el centro marca el lugar actual (Getafe) y dice qué zonas lo tocan.
  await page.mouse.click(centroX, centroY);
  assert.equal(await page.textContent('#punto-mapa'), 'Punto: 40.3057, -3.7329');
  assert.ok(await page.locator('#mapa .mapa-marca').isVisible());
  // Las zonas del punto se preguntan a ENAIRE por ESE punto (geometría exacta), no a las formas del mapa.
  await page.locator('#punto-zonas li strong').first().waitFor();
  const enPunto = await page.locator('#punto-zonas li').allTextContents();
  assert.equal(enPunto.length, 6, enPunto.join(' | '));
  assert.ok(enaireUrls.some((u) => u.includes('esriGeometryPoint') && u.includes('geometry=-3.732900%2C40.305700')), 'consulta del punto tocado');
  assert.ok(enPunto.some((t) => t.startsWith('MADRID/Getafe<script>') && t.includes('te afecta a 120 m')), 'el HTML de fuera sale como texto');
  assert.match(enPunto.at(-1), /^TMA MADRID .*no te afecta a 120 m$/, 'lo que no te afecta, al final');
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  const pedidasAntes = formasPedidas.length;
  // Arrastrar 100 px a la derecha lleva el centro al oeste.
  await page.mouse.move(centroX, centroY);
  await page.mouse.down();
  await page.mouse.move(centroX + 50, centroY, { steps: 3 });
  await page.mouse.move(centroX + 100, centroY, { steps: 3 });
  await page.mouse.up();
  assert.equal(await page.textContent('#punto-mapa'), 'Punto: 40.3057, -3.7329', 'arrastrar no mueve la marca');
  await page.waitForTimeout(600);
  assert.equal(formasPedidas.length, pedidasAntes, 'arrastrar dentro de lo ya pedido no pide otra vez');
  await page.mouse.click(centroX, centroY);
  const [, latM, lonM] = (await page.textContent('#punto-mapa')).match(/Punto: ([\d.-]+), ([\d.-]+)/).map(Number);
  assert.ok(Math.abs(latM - 40.3057) < 1e-3 && lonM < -3.74, `el centro se fue al oeste: ${lonM}`);
  await page.locator('#mapa [data-zoom="1"]').click();
  assert.ok(teselasPedidas.some((u) => u.includes('/14/')), 'acercar pide teselas de z14');
  // Una capa que falla no deja esa parte por pedida: al moverse se vuelve a intentar.
  enaireMapa.urbanaCaida = true;
  await page.locator('#mapa [data-zoom="1"]').click(); // z15: dos más que lo pedido, se pide otra vez
  await page.locator('#zonas-mapa').filter({ hasText: 'Faltan las capas: Urbana.' }).waitFor();
  const conFallo = formasPedidas.length;
  await page.mouse.move(centroX, centroY);
  await page.mouse.down();
  await page.mouse.move(centroX + 20, centroY, { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  assert.ok(formasPedidas.length > conFallo, 'con Urbana caída, un arrastre vuelve a pedir');
  enaireMapa.urbanaCaida = false;
  // Una respuesta que llega tarde no pinta zonas cuando ya se ha alejado el mapa.
  for (let i = 0; i < 6; i++) await page.locator('#mapa [data-zoom="-1"]').click(); // z9
  enaireMapa.lento = true;
  await page.waitForTimeout(500); // la de z9 ya está en camino (tarda 1,5 s)
  await page.locator('#mapa [data-zoom="-1"]').click(); // z8: lejos
  await page.waitForTimeout(2200);
  assert.match(await page.textContent('#zonas-mapa'), /^Acerca el mapa/);
  assert.equal(await page.locator('#mapa .mapa-zonas path').count(), 0, 'nada pintado en z8');
  enaireMapa.lento = false;
  if (process.env.CAPTURA_MAPA) await page.locator('#panel-mapa').screenshot({ path: process.env.CAPTURA_MAPA });
  await page.locator('#btn-usar-punto').click();
  await page.locator('#nombre-lugar').filter({ hasText: 'Punto del mapa' }).waitFor();
  assert.equal(await page.locator('#dlg-lugar').isVisible(), false);
  await page.locator('#ahora .cartel').waitFor();

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
  await p2.locator('#zonas .zonas-resumen.sin-dato').filter({ hasText: 'No se pudo consultar ENAIRE' }).waitFor();
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
  await p3.locator('#zonas .zonas-resumen.ok').filter({ hasText: 'No consta en ninguna zona UAS' }).waitFor();

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
    localStorage.setItem('drone-forecast:lugar', JSON.stringify({ nombre: 'Getafe', zona: 'Madrid', lat: 40.3, lon: -3.73 }));
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
  // Próxima ventana: dice el día y las horas, y tocarla lleva a ese día.
  const proxima = p6.locator('#ahora .ventana-hoy button');
  assert.match(await proxima.textContent(), /^(Hoy|Mañana) · \d\d:00–\d\d:00 ›$/);
  const diaProxima = await proxima.getAttribute('data-dia');
  await proxima.click();
  assert.equal(await p6.locator('#dias .dia.activo').getAttribute('data-dia'), diaProxima, 'lleva al día de la ventana');

  // Mañana tiene ventana verde: sus horas llevan la raya de «mejor ventana».
  await p6.locator('#dias .dia').nth(1).click();
  const enVentana = p6.locator('#horas tr.en-ventana');
  assert.ok((await enVentana.count()) >= 2, 'horas de la mejor ventana marcadas');
  assert.equal(await p6.locator('#horas tr.en-ventana:not(.ok)').count(), 0, 'en una ventana verde todas sus horas son verdes');
  assert.equal(await p6.locator('#horas tr.en-ventana.v-ok').count(), await enVentana.count());

  // Sin red, la app abre desde lo guardado por el instalador.
  await ctx6.setOffline(true);
  await p6.reload();
  await p6.locator('#ahora').waitFor();
  // Versión nueva: con un instalador ya al mando, el relevo saca el aviso con su botón.
  assert.ok(await p6.locator('#actualizar').isHidden());
  assert.ok(await p6.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'la página ya la controla el instalador');
  await p6.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
  await p6.locator('#actualizar').filter({ hasText: 'Hay una versión nueva' }).waitFor();

  if (process.env.CAPTURA) await page.screenshot({ path: process.env.CAPTURA, fullPage: true });
  assert.equal(errores.length, 0, errores.join('\n'));
  console.log('ok - interfaz');
} finally {
  await navegador.close();
  srv.close();
}
