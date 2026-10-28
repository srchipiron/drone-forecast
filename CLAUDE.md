# Contexto del proyecto

**Drone Forecast**: ¿se puede volar con tu dron, aquí y ahora, y cuándo es
la mejor ventana? Inspirada en UAV Forecast, pero pensada para España, para
el dron concreto de cada uno y para trabajo profesional (Aeroscan:
fotogrametría, termografía, inspección). Es de Javi (GitHub `srchipiron`).

Javi trabaja **solo desde el móvil** (Termux). Por eso: sin paso de
compilación, sin dependencias, y las pruebas automáticas importan más que
nunca. Lo que no se ve en el móvil no se puede depurar.

## Reglas

- **`npm test` antes de subir nada.** Sube la versión en `package.json`,
  `src/version.js` y `sw.js`, y documéntala en `CHANGELOG.md` (para quien USA
  la app). La prueba de estructura falla si no cuadran.
- **`src/motor/` es puro**: sin `window`, `document`, `fetch` ni
  `localStorage`. La red está en `src/app/datos.js`; la persistencia, solo en
  `src/app/almacen.js` (claves `drone-forecast:*`, no las renombres).
- **`src/motor/prevision.js` es el único cerebro.** La app y las pruebas
  llaman a `construirPrevision`; nada monta el contexto por su cuenta.
- **Un módulo nuevo en `src/` va en la precarga de `sw.js`** (hay prueba).
- **Lo de fuera son datos**: lo que devuelven las APIs se valida al leerlo y
  se escapa (`esc`) antes de meterlo en la página. La CSP de `index.html` solo
  deja hablar con Open-Meteo, NOAA y CelesTrak; si añades una API, añádela
  allí y en su prueba.
- **Un umbral nuevo lleva su porqué** en el comentario o en el detalle del
  factor (de dónde sale: ficha del fabricante, norma, práctica).
- Este contenedor de desarrollo puede no llegar a las APIs: las pruebas usan
  respuestas fabricadas con la forma de las reales (`pruebas/fixtures/`). Si
  cambia la forma de una respuesta real, cambia el fixture a la vez.

## Mejora diaria

Una tarea programada lanza cada mañana `/mejorar`
(`.claude/commands/mejorar.md`): coge la primera línea pendiente de
`docs/pendiente.md`, la hace con sus pruebas y abre un PR en una rama
`auto/*`. La lista es de Javi: él decide el orden.

**Los PR los fusiona Claude** (Javi, 28-10-2026), con todas las pruebas de
GitHub en verde y sin conflictos. Un PR que toque `.github/`, `.claude/` o
`CLAUDE.md` no se fusiona solo: lo decide Javi.
