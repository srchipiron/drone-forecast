# Pendiente

La lista de la mejora diaria (`.claude/commands/mejorar.md`). Se hace la
**primera sin marcar**, una por día. Javi puede reordenarla, tacharla o
añadir líneas desde el móvil: el orden es suyo.

Formato: `- [ ]` pendiente, `- [x]` hecha (con la versión), `- [~]`
bloqueada (con el motivo, y se pasa a la siguiente).

## Lista

- [x] **Botón Diagnóstico** (0.2.0): en el pie, un botón que copia al portapapeles un
  texto corto con versión, lugar, ajustes, origen y antigüedad de cada dato
  (previsión, Kp, órbitas), los factores de la hora actual y el último error.
  Es lo que Javi pega en el chat cuando algo sale raro, porque en el móvil no
  hay consola.
- [x] **Zonas UAS de ENAIRE** (0.4.0; Javi lo pidió primero: ahí se ve si un vuelo necesita permiso): comprobar si ENAIRE publica las zonas
  geográficas UAS en un servicio abierto con CORS. Si sí, decir en el
  veredicto si el punto cae dentro de una zona (sin mapa todavía). Si no se
  puede, marcar `[~]` con lo que se ha probado.
- [x] **Resumen de favoritos** (0.5.0): en el diálogo de lugar, cada favorito con su
  mejor ventana de hoy y mañana (una descarga por favorito, con caché), para
  elegir dónde volar sin abrirlos uno a uno.
- [x] **Perfil de viento** (0.6.0): al abrir una hora, el viento a 10, 80, 120 y 180 m
  y la altura de vuelo marcada, en una barra horizontal por nivel (sin
  estilos en línea: la CSP los bloquea).
- [x] **Gráfica del día** (0.7.0): una línea SVG del viento a la altura de vuelo y de
  las rachas a lo largo del día, con el límite del dron como raya, encima de
  la lista de horas.
- [x] **Diario de vuelos** (0.7.0): botón «He volado» en la hora actual que guarda
  fecha, lugar, dron, misión, la previsión de esa hora y una nota y valoración
  (bien / regular / mal). Lista de vuelos en Ajustes y exportar a JSON.
  Persistencia en `almacen.js`.
- [x] **Informe para el cliente** (0.7.0) (modo profesional): botón que abre una vista
  imprimible (CSS `@media print`) con lugar, fecha, misión, ventana elegida y
  la tabla de factores, para guardarla como PDF desde el móvil.
- [x] **Detalle por modelo** (0.7.0): en «Acuerdo entre modelos», el viento de cada
  modelo (ECMWF, GFS, ICON, Météo-France) en vez de solo la dispersión.
- [ ] **Aviso de ventana**: con la app instalada, si el navegador lo permite
  (Periodic Background Sync), una notificación cuando mañana haya una ventana
  verde en un favorito. Si no lo permite, el botón no sale.
