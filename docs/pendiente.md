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
- [x] **Aviso de ventana** (0.11.0): con la app instalada, si el navegador lo permite
  (Periodic Background Sync), una notificación cuando mañana haya una ventana
  verde en un favorito. Si no lo permite, el botón no sale.

### Propuestas (17-11-2026; Javi puede reordenarlas o tacharlas)

- [x] **Zonas de ENAIRE en el mapa** (0.23.0): al elegir el punto en el mapa, dibujar
  encima las zonas UAS que devuelve ENAIRE para la vista (consulta por
  rectángulo en vez de por punto), con su color por tipo. Sin librerías: SVG
  encima de las teselas.
- [ ] ~~**Autonomía estimada**~~ — **descartada** (18-11-2026): los
  fabricantes dicen que con frío y viento la batería dura menos, pero ninguno
  publica cuánto (ni DJI, ni Autel, ni Skydio, ni Parrot). Un «te quedan
  22 min» inventado es peor que nada en un trabajo; el aviso de frío del
  cartel («calienta las baterías») ya dice lo que sí está en las fichas.
- [x] **Diario a CSV** (0.24.0): además del JSON, exportar el diario como CSV para
  abrirlo en una hoja de cálculo (fecha, lugar, dron, misión, previsión y
  valoración).
- [x] **Vuelo planificado** (0.25.0): marcar un día y hora de vuelo (para un cliente)
  y que el aviso de ventana avise si la previsión de esa hora empeora a ámbar
  o rojo.
- [x] **Ventanas de la semana para todos mis drones** (0.26.0): en la vista de días,
  con «Mis drones» marcados, la mejor ventana de cada día para cada dron.

### Propuestas (19-11-2026; Javi puede reordenarlas o tacharlas)

- [x] **Vuelo planificado al calendario** (0.27.0): desde la tarjeta de planes, un
  botón que baje un `.ics` (fecha, hora, lugar con enlace al mapa y la nota)
  para meterlo en el calendario del móvil o mandárselo al cliente.
- [x] **Informe del vuelo planificado** (0.28.0): el «Informe para el cliente» de un
  plan (sus horas, no la hora de ahora), con las zonas de ENAIRE del punto.
- [ ] **Mejor día para un plan**: al planificar, sugerir los huecos verdes
  de la semana que cubren las horas pedidas (por ejemplo, «2 h seguidas»).
