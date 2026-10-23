# Cambios

Criterio de versión: `0.X.0` cuando cambia cómo decide la app o qué hace;
`0.0.X` para correcciones. La versión sale en el pie de la app.

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
