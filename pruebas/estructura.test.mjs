// Guardarraíles de forma: versión documentada, instalador completo y motor puro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const leer = (f) => readFileSync(f, 'utf8');
const pkg = JSON.parse(leer('package.json'));

function recorrer(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? recorrer(p) : [p];
  });
}

test('la versión es la misma en package.json, src/version.js y sw.js, y tiene entrada en el CHANGELOG', () => {
  assert.match(leer('src/version.js'), new RegExp(`'${pkg.version.replace(/\./g, '\\.')}'`));
  assert.match(leer('sw.js'), new RegExp(`const VERSION = '${pkg.version.replace(/\./g, '\\.')}'`));
  assert.match(leer('CHANGELOG.md'), new RegExp(`^## ${pkg.version.replace(/\./g, '\\.')}\\b`, 'm'));
});

test('el instalador precarga todos los módulos de src/ y nada que no exista', () => {
  const sw = leer('sw.js');
  const lista = [...sw.matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]);
  for (const f of recorrer('src')) assert.ok(lista.includes(f), `falta ${f} en la precarga de sw.js`);
  for (const f of lista) if (f !== './') assert.ok(existsSync(f), `${f} no existe`);
});

test('el motor no importa de la app ni usa el navegador o Node', () => {
  for (const f of recorrer('src/motor')) {
    const s = leer(f);
    assert.doesNotMatch(s, /from '\.\.\/app\//, `${f} importa de la app`);
    assert.doesNotMatch(s, /from 'node:/, `${f} importa de Node`);
    assert.doesNotMatch(s, /\b(window|document|localStorage|fetch)\b/, `${f} usa el navegador`);
  }
});

test('solo almacen.js toca localStorage', () => {
  for (const f of recorrer('src/app')) if (!f.endsWith('almacen.js')) assert.doesNotMatch(leer(f), /localStorage/, f);
});

test('la política de contenido solo deja hablar con las APIs que se usan', () => {
  const csp = leer('index.html').match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|\*/);
  const conecta = csp.match(/connect-src ([^;]+)/)[1].split(/\s+/);
  assert.deepEqual(conecta.sort(), ["'self'", 'https://api.open-meteo.com', 'https://geocoding-api.open-meteo.com', 'https://services.swpc.noaa.gov', 'https://celestrak.org'].sort());
});

test('sin estilos en línea (la CSP los bloquearía)', () => {
  assert.doesNotMatch(leer('index.html'), /style="/);
  for (const f of recorrer('src')) assert.doesNotMatch(leer(f), /style="/, f);
});
