import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bloqueHtml, leerNovedades, novedadesDesde } from '../src/motor/novedades.js';

const cambios = readFileSync('CHANGELOG.md', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

test('novedades: el CHANGELOG entero, con lo destacado y cada versión con su fecha', () => {
  const { destacado, versiones } = leerNovedades(cambios);
  assert.equal(versiones[0].version, pkg.version, 'la más nueva primero, la de package.json');
  assert.equal(versiones.at(-1).version, '0.1.0', 'desde la primera');
  assert.equal(versiones.length, (cambios.match(/^## \d+\.\d+\.\d+/gm) ?? []).length);
  for (const v of versiones) {
    assert.match(v.fecha, /^\d{2}-\d{2}-\d{4}$/, `la ${v.version} lleva fecha («## ${v.version} · dd-mm-aaaa»)`);
    assert.ok(v.html.length > 20, `la ${v.version} dice algo`);
  }
  // Las fechas van de la más nueva a la más vieja.
  const dia = (f) => f.split('-').reverse().join('');
  for (let i = 1; i < versiones.length; i++) assert.ok(dia(versiones[i - 1].fecha) >= dia(versiones[i].fecha), `${versiones[i - 1].version} antes que ${versiones[i].version}`);
  assert.match(destacado, /^<ul><li><strong>El semáforo de vuelo<\/strong>/);
  assert.match(destacado, /Planificador de trabajos/);
});

test('novedades: markdown sencillo a HTML, con todo escapado', () => {
  const html = bloqueHtml('Intro con `código` y **negrita**\nque sigue.\n\n- Uno <script>alert(1)</script>\n  sigue uno\n  - sub **a**\n- Dos & "tres"\n\nFinal');
  assert.equal(
    html,
    '<p>Intro con <code>código</code> y <strong>negrita</strong> que sigue.</p><ul><li>Uno &lt;script&gt;alert(1)&lt;/script&gt; sigue uno<ul><li>sub <strong>a</strong></li></ul></li><li>Dos &amp; &quot;tres&quot;</li></ul><p>Final</p>',
  );
  assert.deepEqual(leerNovedades('## 1.0.0 · 01-01-2027\n- <img src=x onerror=1>').versiones[0].html, '<ul><li>&lt;img src=x onerror=1&gt;</li></ul>');
});

test('novedades: las versiones posteriores a la que tenías (0.10 va después de 0.9)', () => {
  const vs = ['0.10.1', '0.10.0', '0.9.2', '0.9.0'].map((version) => ({ version }));
  assert.deepEqual(novedadesDesde(vs, '0.9.0').map((v) => v.version), ['0.10.1', '0.10.0', '0.9.2']);
  assert.deepEqual(novedadesDesde(vs, '0.10.1'), []);
});
