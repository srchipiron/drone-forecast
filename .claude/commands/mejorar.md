---
description: Mejora diaria de Drone Forecast (la lanza una tarea programada; también se puede lanzar a mano con /mejorar)
---

# Mejora diaria

Trabajas sin nadie mirando. Javi verá el resultado en un PR desde el móvil.
Haz **una** mejora pequeña y bien probada, o ninguna: un PR roto es peor que
un día sin PR.

## 0. Antes de nada

1. Lee `CLAUDE.md` y `docs/pendiente.md`.
2. Mira si hay PRs abiertos de ramas `auto/*`:
   - Si alguno tiene las pruebas en rojo, **arreglarlo es la tarea de hoy**
     (en su misma rama). No empieces nada nuevo.
   - Si hay uno en verde esperando a Javi, no abras otro: para y di que está
     esperando.
3. Mira el último despliegue de `main` (workflow Desplegar). Si está en rojo,
   arreglarlo es la tarea de hoy.

## 1. Elegir

La primera línea `- [ ]` de `docs/pendiente.md`. Si no queda ninguna, no
abras PR: termina diciendo que la lista está vacía.

Si al ponerte ves que no se puede hacer bien (falta un dato, una API no
responde, es demasiado grande para un PR), márcala `- [~]` con el motivo en
una línea y pasa a la siguiente. Una mejora grande se parte: haz la primera
parte y deja el resto como línea nueva justo debajo.

## 2. Hacer

- Rama `auto/AAAA-MM-DD-tema-corto` desde `main` actualizado.
- Respeta las reglas de `CLAUDE.md`: el motor puro, `prevision.js` como único
  cerebro, la persistencia solo en `almacen.js`, todo lo de fuera escapado
  con `esc`, módulo nuevo en la precarga de `sw.js`, API nueva en la CSP y en
  su prueba.
- **No toques** `.github/`, `.claude/` ni `CLAUDE.md`. Si la mejora lo
  necesita, márcala `[~]` explicando qué habría que cambiar ahí.
- **No cambies umbrales de seguridad** (viento, lluvia, Kp, satélites, luz, la
  ficha de un dron) sin una fuente que citar en el comentario. No inventes
  fichas técnicas.

## 3. Probar

- Prueba nueva para lo nuevo: en `pruebas/*.test.mjs` si es del motor o del
  script; en `pruebas/interfaz.e2e.mjs` si es de la pantalla.
- **Rómpela a propósito** (quita o cambia lo que vigila) y comprueba que
  falla. Luego déjalo bien. Si no falla, la prueba no vale: arréglala.
- `npm test` en verde. Y `npm run test:ui` en verde si hay un Chromium
  (`PLAYWRIGHT_CHROME=/opt/pw-browsers/chromium-*/chrome-linux/chrome` en el
  contenedor de Claude). Si no hay navegador, dilo en el PR.
- Si el contenedor no llega a una API, prueba con respuestas fabricadas que
  tengan la forma de las reales (`pruebas/fixtures/`), y dilo en el PR.

## 4. Entregar

- Versión: `0.X.0` si la app hace algo nuevo; `0.0.X` si es una corrección. En
  `package.json`, `src/version.js` y `sw.js`.
- Entrada en `CHANGELOG.md` escrita para quien **usa** la app, no para quien
  lee el código.
- Marca la línea `- [x]` en `docs/pendiente.md` con la versión.
- Un commit, push y PR contra `main`. En el PR: qué cambia para Javi en dos
  líneas, cómo se ha probado (incluida la mutación) y qué no se ha podido
  comprobar.
- Termina con un resumen de tres líneas: qué hiciste, el enlace al PR y qué
  tiene que mirar Javi en el móvil.
