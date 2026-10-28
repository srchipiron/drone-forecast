# Drone Forecast

¿Se puede volar? Semáforo por horas para tu dron con viento en altura, rachas,
lluvia, Kp, satélites GNSS y la mejor ventana de cada día. Modo recreativo y
profesional (fotogrametría, termografía, inspección).

**App:** https://srchipiron.github.io/drone-forecast/ (en el móvil: menú del
navegador → «Instalar aplicación»).

## De dónde salen los datos

| Dato | Fuente |
|---|---|
| Tiempo, viento a 10/80/120/180 m, rachas, radiación | [Open-Meteo](https://open-meteo.com) (desde el navegador) |
| Acuerdo entre modelos | Open-Meteo: ECMWF, GFS, ICON y Météo-France |
| Índice Kp | [NOAA SWPC](https://www.swpc.noaa.gov) (navegador; si no deja, copia del despliegue) |
| Órbitas GNSS | [CelesTrak](https://celestrak.org): las baja el despliegue cada 6 h; si no puede, el móvil directamente (se guardan 12 h) |
| Sol, satélites visibles | Calculados en el móvil |

## Desarrollo

Sin compilación ni dependencias: HTML, CSS y módulos JavaScript tal cual.

```sh
npm test          # pruebas del motor y guardarraíles (Node 20+)
npm run datos     # baja órbitas y Kp a data/
npm run servir    # http://localhost:8080
npm run test:ui   # prueba en navegador con las APIs simuladas (necesita Chromium)
```

El despliegue (`.github/workflows/desplegar.yml`) pasa `npm test`, baja los
datos y publica en GitHub Pages en cada push a `main` y cada 6 horas.

Orientativo: la decisión y la responsabilidad del vuelo son del piloto.
