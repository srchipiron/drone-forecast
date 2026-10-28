# Cambios

Criterio de versión: `0.X.0` cuando cambia cómo decide la app o qué hace;
`0.0.X` para correcciones. La versión sale en el pie de la app.

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
