import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INDICADOR, arcoIndicador, puntoIndicador } from '../src/motor/grafica.js';

test('el indicador va de abajo a la izquierda a abajo a la derecha pasando por arriba', () => {
  const ini = puntoIndicador(0);
  const mitad = puntoIndicador(0.5);
  const fin = puntoIndicador(1);
  assert.deepEqual(mitad, { x: INDICADOR.cx, y: INDICADOR.cy - INDICADOR.r }, 'a mitad, arriba del todo');
  assert.ok(ini.x < INDICADOR.cx && ini.y > INDICADOR.cy, 'empieza abajo a la izquierda');
  assert.ok(fin.x > INDICADOR.cx && fin.y > INDICADOR.cy, 'acaba abajo a la derecha');
  assert.equal(ini.y, fin.y, 'simétrico');
});

test('el arco: vacío con 0, arco grande solo pasado de 180°, y se recorta a [0, 1]', () => {
  assert.equal(arcoIndicador(0), '');
  assert.equal(arcoIndicador(-1), '');
  assert.match(arcoIndicador(0.5), / 0 0 1 /, 'medio arco (120°): arco pequeño');
  assert.match(arcoIndicador(0.9), / 0 1 1 /, '216°: arco grande');
  assert.equal(arcoIndicador(2), arcoIndicador(1), 'más del límite no da la vuelta');
});
