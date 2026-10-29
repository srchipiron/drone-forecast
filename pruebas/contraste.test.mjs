// Contraste de los colores de styles.css, en claro y en oscuro (WCAG AA:
// 4,5:1 para texto; 3:1 para símbolos y gráficos). La app se usa al sol.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('styles.css', 'utf8');

function tokens(cabecera) {
  const i = css.indexOf(cabecera);
  assert.ok(i >= 0, `no está ${cabecera}`);
  const bloque = css.slice(i, css.indexOf('}', i));
  return Object.fromEntries([...bloque.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]));
}

const claro = tokens(':root {');
const oscuro = { ...claro, ...tokens(':root[data-theme="dark"] {') };

function luminancia(hex) {
  const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const TEXTO = [
  ['texto', 'fondo'], ['texto', 'tarjeta'], ['texto', 'tarjeta-2'],
  ['suave', 'tarjeta'], ['suave', 'tarjeta-2'], ['suave', 'fondo'],
  ['acento', 'tarjeta'], ['acento', 'tarjeta-2'],
  ['sobre-boton', 'boton'],
  ['ok', 'tarjeta'], ['precaucion', 'tarjeta'], ['no', 'tarjeta'], ['sin-dato', 'tarjeta-2'],
  ['ok', 'ok-fondo'], ['precaucion', 'precaucion-fondo'], ['no', 'no-fondo'],
  ['texto', 'precaucion-fondo'], ['acento', 'fondo'],
  // El cartel del veredicto: texto en --tarjeta sobre el color del estado.
  ['tarjeta', 'ok'], ['tarjeta', 'precaucion'], ['tarjeta', 'no'], ['tarjeta', 'sin-dato'],
  // Las horas sin luz de la tabla.
  ['texto', 'separador'], ['suave', 'separador'],
];
const SIMBOLOS = [['tarjeta', 'ok'], ['tarjeta', 'precaucion'], ['tarjeta', 'no'], ['tarjeta', 'sin-dato'], ['ok', 'tarjeta-2'], ['precaucion', 'tarjeta-2'], ['no', 'tarjeta-2']];

for (const [nombre, t] of [['claro', claro], ['oscuro', oscuro]]) {
  test(`modo ${nombre}: todo el texto pasa 4,5:1`, () => {
    for (const [a, b] of TEXTO) {
      const c = contraste(t[a], t[b]);
      assert.ok(c >= 4.5, `${a} (${t[a]}) sobre ${b} (${t[b]}): ${c.toFixed(2)}:1`);
    }
  });
  test(`modo ${nombre}: los símbolos ✓ ! ✕ pasan 3:1`, () => {
    for (const [a, b] of SIMBOLOS) {
      const c = contraste(t[a], t[b]);
      assert.ok(c >= 3, `${a} sobre ${b}: ${c.toFixed(2)}:1`);
    }
  });
}

test('el modo oscuro del sistema y el forzado usan los mismos colores', () => {
  assert.deepEqual(tokens(':root:not([data-theme="light"]) {'), tokens(':root[data-theme="dark"] {'));
});
