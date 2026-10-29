# Cambios

Criterio de versión: `0.X.0` cuando cambia cómo decide la app o qué hace;
`0.0.X` para correcciones. La versión sale en el pie de la app.

## 0.18.0

**Tus otros drones.**

- En **Ajustes → Mis drones** marca los que tienes. El cartel añade
  debajo de las condiciones cómo está ahora cada uno: «✓ Volar Parrot
  ANAFI UKR», «! Ojo DJI Matrice 4E / 4T (viento a 120 m, rachas)»,
  «✕ No DJI Neo». Sirve para saber, cuando el que tienes elegido no puede,
  si te vale llevar otro.
- Se calcula igual que el veredicto principal (mismo lugar, hora, altura y
  misión), solo cambia el dron.

## 0.17.0

- **Próxima ventana**, en lugar de «Mejor ventana hoy». Si hoy queda una
  ventana, sale la de hoy; si no, el primer día de la semana con horas en
  verde, por ejemplo «Sáb 31 · 08:00–14:00». Tócala y la tabla salta a ese
  día. Si en toda la semana no hay verde, sale la primera «con
  precaución»; y si no hay nada volable, lo dice («Ninguna en 7 días»).

## 0.16.0

- **El cielo de cada hora, con su icono**, como en UAV Forecast: en la
  tabla hora a hora, la columna «Cielo» enseña ☀️, ⛅, ☁️, 🌧️, ⛈️ o 🌙
  según la hora, en vez del porcentaje de nubes. Si la base de las nubes
  queda cerca de tu altura de vuelo, la celda sale en ámbar o rojo.
- Al abrir una hora, el detalle empieza por el cielo y la temperatura
  («⛅ Nubes y claros · 16 °C»).
- Arreglado el título de la tabla, que salía pegado («Hora a hora ·Hoy»).

## 0.15.1

- **Más rápida.** Calcular la previsión de la semana tarda menos de la
  mitad que antes: la app ya no rehace el formato de la fecha en cada hora.
  Se nota al abrirla, al cambiar de lugar o de ajustes y al ver los
  favoritos, sobre todo en móviles modestos.

## 0.15.0

**Pasar de día deslizando el dedo.**

- Desliza a la izquierda sobre la tabla hora a hora (o sobre los días) y
  pasas al día siguiente; a la derecha, vuelves al anterior. La tabla
  entra desde el lado hacia el que vas.
- Encima de la tabla sale el día que estás viendo, con flechas ‹ › a los
  lados para pasar de día con un toque.
- Bajar por la página sigue funcionando igual: solo cuenta como cambio de
  día un gesto rápido y claramente de lado.

## 0.14.1

- **Todos los días a la vista, sin deslizar.** En algunos móviles la tira de
  días no se movía con el dedo y no había forma de llegar a los últimos
  (por ejemplo, al miércoles). Ahora salen en filas de cuatro, todos a la
  vez: cada uno con su nombre, su ventana en corto («10–14 h», o «Sin
  vuelo») y la raya de colores de sus horas. Toca el que quieras.
- Lo mismo con los selectores de dron, misión y altura: en modo
  profesional, si no caben en una línea bajan a la siguiente en vez de
  esconderse por la derecha.

## 0.14.0

**Elegir el punto de vuelo en el mapa**, como en UAV Forecast.

- En el buscador de lugares, **Elegir en el mapa** abre un mapa de
  OpenStreetMap centrado donde estás mirando. Arrástralo con el dedo,
  acércate con + y −, y toca el sitio exacto donde vas a volar: sale una
  marca roja y sus coordenadas. **Usar este punto** lo pone como lugar
  («Punto del mapa») y descarga su previsión y sus zonas de ENAIRE.
- Sirve para parajes, fincas o cubiertas que el buscador no encuentra por
  nombre, y afina la consulta de ENAIRE, que depende del punto exacto.
- Se puede guardar en favoritos como cualquier otro lugar.

## 0.13.0

- **Compartir:** botón nuevo junto a «He volado». Abre el menú del móvil
  (WhatsApp, correo…) con un resumen listo para mandar: lugar, dron y
  altura, si se puede volar ahora (y por qué no, si no), el viento y las
  ventanas de hoy y mañana, con el enlace a la app.
- **La mejor ventana, marcada en la tabla:** las horas de la mejor ventana
  del día llevan una raya verde a la izquierda (ámbar si es «con
  precaución»), para encontrarla de un vistazo al bajar por la tabla.
- «Mejor ventana hoy» ya no se parte en dos líneas cuando no hay ventana:
  dice «Ninguna».

## 0.12.0

**Más como UAV Forecast.**

- **La semana de un vistazo:** cada día de la tira lleva debajo una raya por
  hora con el color de su semáforo. Sin abrir el día ya ves si hay verde y
  a qué horas (las horas que ya han pasado salen apagadas).
- **El cielo en el cartel:** debajo del veredicto, cómo está el cielo y la
  temperatura, por ejemplo «☀️ Despejado · 18 °C» (de noche, con luna).

## 0.11.0

**Aviso de ventana:** la app te avisa cuando mañana haya horas en verde en
alguno de tus favoritos.

- En **Ajustes → Aviso de ventana**, activa la casilla y da permiso de
  notificaciones. A partir de ahí, el móvil mira tus favoritos una o dos
  veces al día, con tu dron, tu altura y tus ajustes, y si mañana alguno
  tiene ventana verde te llega una notificación: «Mañana se puede volar en
  Getafe — Getafe: 08:00–14:00 (6 h)». Como mucho un aviso al día, y solo
  por ventanas verdes (las de «con precaución» no avisan).
- Tocar la notificación abre la app.
- **Probar ahora** mira los favoritos en el momento y te manda la
  notificación, haya ventana o no, para comprobar que llega.
- Funciona en Chrome de Android **con la app instalada** (menú ⋮ →
  «Instalar aplicación»). En los navegadores que no pueden mirar en segundo
  plano, la tarjeta no sale.
- El botón Diagnóstico dice si el aviso está activo y qué día avisó por
  última vez.

## 0.10.0

**La previsión se lee como en UAV Forecast.**

- **Cartel arriba del todo** con el veredicto en grande y del color del
  estado («Se puede volar», «Con precaución», «No vueles»), la hora, tu dron
  y la altura.
- **Condiciones ahora**: una fila por dato (viento con su flecha, rachas,
  lluvia, temperatura, visibilidad, nubes, luz, Kp, satélites, acuerdo
  entre modelos) con su marca ✓ ! ✕. Si algo no está en verde, debajo
  dice por qué. Ya no hay que abrir «Todos los factores».
- **Tabla hora a hora** en vez de la tira que había que deslizar de lado
  (y que en algunos móviles no se deslizaba): una fila por hora con viento
  y su dirección, racha, temperatura, lluvia, nubes, satélites y Kp. Cada
  dato que falla sale en ámbar o rojo, y las horas sin luz, en gris. Hoy
  empieza en la hora en curso. Cabe entera en un móvil de 360 px.
- Toca cualquier parte de una fila para ver su perfil de viento por
  alturas y el detalle de esa hora. La gráfica del día sigue ahí, plegada
  debajo de la tabla.
- Fuera el indicador circular.

## 0.9.0

**Pantalla nueva, pensada como un instrumento de vuelo:** se mira y se
decide en un segundo, a pleno sol.

- **Indicador circular de viento**: el viento a tu altura de vuelo frente al
  límite de tu dron, con marcas en «cómodo» y «límite», y el veredicto al
  lado en grande.
- **Lo importante, arriba del todo.** Modo, dron y altura van en una sola
  fila compacta; la altura se elige de una lista (20 a 120 m, o hasta 180 en
  profesional).
- **Horas en una tira deslizable**, que empieza en la hora actual, en vez de
  una lista larga de 24 filas. Al tocar una hora, debajo sale su perfil de
  viento y sus factores.
- **Pestañas abajo**: Previsión, Diario y Ajustes. Al guardar un vuelo, la
  app te lleva al diario.
- **El color solo marca el estado**: verde, ámbar o rojo. Todo lo demás es
  neutro, con bordes finos que al sol se ven mejor que las sombras. Las
  cifras son grandes y no bailan al cambiar.
- **Modo oscuro en azul noche**, como una cabina.

## 0.8.0

- **Diseño nuevo al estilo de las apps de Apple:**
  - Fondo gris agrupado de iOS y tarjetas redondeadas sin bordes.
  - Letra San Francisco y títulos grandes.
  - Barra superior translúcida, con desenfoque, como en iOS.
- **El veredicto ocupa una tarjeta a todo color**, como la app Tiempo: verde,
  naranja o roja según se pueda volar. Los datos (viento, rachas, satélites,
  Kp) van sobre un panel translúcido y las zonas de ENAIRE y los factores, en
  una tarjeta clara dentro.
- **Controles de iOS**: el selector Recreativo/Profesional es un control
  segmentado, las listas llevan separadores finos y los desplegables, la
  flecha «›» que gira.
- **Modo oscuro en negro puro**, como en el iPhone.
- **Los colores de iOS**, ajustados para leerse al sol: todos los textos
  cumplen el contraste recomendado (AA), en claro y en oscuro, y una prueba
  automática lo vigila.

## 0.7.1

Correcciones tras una revisión completa de la app:

- **Una hora sin dato de viento ya no sale en verde.** Si el modelo no da
  viento, la hora queda en ámbar («mira tú el viento antes de despegar»).
- **Cambiar de lugar rápido ya no mezcla previsiones.** Antes, si tocabas un
  favorito mientras se descargaba otro, podías ver el nombre del nuevo con
  el tiempo del anterior. Lo mismo con el GPS lento: si eliges un sitio a
  mano mientras busca, gana el tuyo.
- **Sin cobertura y con la previsión guardada de hace días**, la app ya no
  enseña una hora vieja como «ahora». Dice que no hay previsión para ahora y
  te ofrece reintentar.
- **Satélites siempre al día.** Si las órbitas del servidor tienen más de
  3 días, el móvil las pide directamente.
- **En recreativo, la altura no pasa de 120 m** aunque vengas del modo
  profesional con 180.
- **La pantalla ya no se rehace cada minuto**: «Todos los factores» no se
  cierra solo y no se borra lo que estás escribiendo en Ajustes. Con la app
  abierta, la previsión se refresca sola cada 30 minutos y el Kp cada 3 horas.
- **Recargar también vuelve a consultar ENAIRE** si antes falló.
- **Más legible al sol y para daltónicos:**
  - Mejor contraste en el modo oscuro.
  - Cada factor lleva su símbolo (✓, ! o ✕), no solo el color.
  - Los días dicen «con precaución» además de ir en ámbar.
  - Botones y casillas más grandes para el dedo.
- **Más rápida:** la previsión solo se recalcula cuando cambia algo.
- La lista de comprobación se vacía a medianoche de tu móvil, no a la 01:00.
- El modo sin cobertura se instala nada más abrir la app, y una actualización
  ya no puede mezclar ficheros de dos versiones.

## 0.7.0

- **Gráfica del día**, encima de la lista de horas: el viento (línea azul) y
  las rachas (discontinua) a tu altura de vuelo, con las rayas de «cómodo» y
  «límite» de tu dron. Debajo va una franja con el color del semáforo de cada
  hora y una marca en la hora actual.
- **Diario de vuelos.** Al terminar, pulsa «He volado» y valora el vuelo
  (bien, regular o mal), con una nota si quieres. Se guarda junto a lo que
  decía la app en ese momento. El diario resume cuántos vuelos salieron bien
  cuando la app decía verde o ámbar: así sabrás si el margen de viento te va
  corto o largo. Se puede exportar a JSON y borrar vuelo a vuelo.
- **Informe para el cliente** (modo profesional): un botón genera una página
  para imprimir o guardar en PDF desde el móvil. Lleva el lugar, la misión, el
  dron, el día, la mejor ventana, las zonas de ENAIRE, la tabla hora a hora y
  los factores.
- **Acuerdo entre modelos con detalle**: además de si coinciden, dice el
  viento que da cada modelo (ECMWF, GFS, ICON y Météo-France).

## 0.6.0

- **Perfil de viento.** Al tocar una hora, antes de los factores, sale el
  viento a 180, 120, 80 y 10 m, con tu altura de vuelo marcada. Cada altura
  lleva una barra verde, ámbar o roja con los mismos límites que el
  semáforo, así ves de un vistazo si bajando un poco el viento te deja volar.

## 0.5.0

- **Resumen de favoritos.** Al abrir «Lugar de vuelo», cada favorito enseña
  su mejor ventana de hoy y de mañana, en verde o ámbar, calculada con tu
  dron, tu misión y tu altura. Así eliges dónde volar sin abrirlos uno a uno.
  La previsión de cada favorito se guarda 30 minutos.

## 0.4.0

- **Zonas UAS de ENAIRE en la tarjeta principal.** La app pregunta a
  ENAIRE si el lugar cae en alguna zona geográfica UAS: aeronáutica,
  infraestructuras, urbana o medioambiental.
  - Si cae, te dice en cuáles, con su nombre y si piden autorización.
  - Si no consta en ninguna, lo dice, pero te manda igualmente al mapa
    oficial (NOTAM y zonas temporales).
  - Si ENAIRE no responde, dice «No se pudo consultar». Nunca dice «sin
    zonas» por un fallo.
  - Es informativo: no cambia el semáforo del tiempo. Lo que manda es el
    mapa de ENAIRE Drones.
- El Diagnóstico incluye lo que respondió ENAIRE.

## 0.3.0

- **Drones de la gama actual**, agrupados por marca en el selector:
  - **DJI:** Neo, Flip, Mini 4K, Mini 5 Pro, Air 3S, Mavic 4 Pro y Avata 360.
  - **DJI Enterprise:** Matrice 4E/4T, 4D/4TD, 5TD y 400.
  - **Otras marcas:** Autel EVO Max 4T, Skydio X10 y Parrot ANAFI UKR.

  Los límites de viento y temperatura salen de la ficha oficial de cada
  fabricante. Si la ficha da dos vientos, vale el más bajo.
- **Fuera los DJI viejos** (Mini 3, Mini 4 Pro, Air 3, Mavic 3, Avata 2,
  Mavic 3 Enterprise, Matrice 30 y 350). Si tenías uno elegido, la app pasa
  sola a su sucesor: el Mini 4 Pro al Mini 5 Pro, el Air 3 al Air 3S, el
  Matrice 350 al 400… Revisa en el selector que es el tuyo.
- Solo cuenta como «aguanta lluvia ligera» un IP55 o más. El IP43 del EVO Max
  y el IP53 del ANAFI UKR protegen de salpicaduras, no de lluvia, y la app los
  trata como drones sin protección.

## 0.2.1

- **El botón de ubicación ya no dice siempre «no hay permiso».** Ahora
  distingue qué pasa y te dice qué tocar: si Chrome no tiene permiso (y
  dónde dárselo), si la ubicación del móvil está apagada o si el GPS ha
  tardado. Si tarda, reintenta solo con el GPS fino antes de rendirse.
- Mientras busca, el icono de ubicación gira.
- El motivo exacto queda apuntado en el Diagnóstico.
- **ENAIRE Drones, a mano**: bajo el veredicto sale «¿Hace falta permiso
  aquí?», que abre el mapa de zonas UAS de ENAIRE. Antes solo estaba al
  final de la página.

## 0.2.0

- **Botón Diagnóstico**, al final de la página. Copia de un toque un texto
  corto con lo que la app sabe: versión, lugar, ajustes, de dónde y de cuándo
  es cada dato (previsión, Kp, órbitas), los factores de la hora actual, la
  mejor ventana y el último error. Si algo sale raro, pégalo en el chat. Si el
  navegador no deja copiar, el texto queda seleccionado para copiarlo a mano.
- Los fallos internos de la app quedan apuntados para el Diagnóstico, aunque
  en pantalla no se vean.

## 0.1.1

- **Satélites aunque el servidor no pueda bajar las órbitas.** CelesTrak no
  deja entrar a los servidores de GitHub, así que la primera versión salió sin
  órbitas y el recuento de satélites decía «sin dato». Ahora, si pasa eso, el
  móvil las pide él mismo a CelesTrak y las guarda 12 horas.
- El pie dice cuántas órbitas hay y de dónde salieron (del despliegue,
  de CelesTrak o guardadas), para saber desde el móvil que funciona.

## 0.1.0

Primera versión.

- **¿Se puede volar ahora?** Un semáforo (verde, ámbar, rojo) con el motivo,
  y debajo todos los factores: viento a tu altura de vuelo, rachas, lluvia,
  temperatura, visibilidad, base de nubes, luz, índice Kp, satélites visibles
  y acuerdo entre modelos.
- **Mejor ventana de cada día**, para los 7 próximos: el tramo seguido más
  largo en verde (o en ámbar, si no hay verde). La de hoy empieza en la hora
  en curso, nunca en una que ya pasó.
- **Hora a hora**: toca una hora para ver por qué está de ese color.
- **Tu dron decide**: límites de viento y temperatura de los DJI más comunes
  (Mini, Air, Mavic, Avata, Matrice) o uno personalizado. Un dron IP55 pasa
  de «no» a «precaución» con lluvia ligera.
- **Recreativo o profesional**, arriba del todo. En profesional eliges la
  misión (fotogrametría, termografía fotovoltaica, termografía de edificios,
  inspección) y el semáforo añade lo que exige ese trabajo: irradiancia,
  salto térmico, sol en fachada, sombras de nubes... También sale la lista
  de comprobación antes de despegar, que se vacía cada día.
- **Satélites GNSS** (GPS, Galileo, GLONASS, BeiDou) por encima de 10°,
  calculados en el móvil con las órbitas del día.
- **Funciona sin cobertura** con la última previsión guardada.
- Enlace a las zonas UAS de ENAIRE Drones.
