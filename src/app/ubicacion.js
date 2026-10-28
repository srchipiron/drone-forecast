// La ubicación del móvil. Antes, cualquier fallo decía «no hay permiso»; en
// Android lo normal es otra cosa: la ubicación del sistema apagada o el GPS
// tardando. Aquí se distingue cada caso y se dice qué tocar.

// Códigos de GeolocationPositionError.
const DENEGADO = 1;
const NO_DISPONIBLE = 2;
const TIEMPO = 3;

export function mensajeUbicacion(error) {
  switch (error?.code) {
    case DENEGADO:
      return (
        'El navegador no tiene permiso para tu ubicación. En Chrome: toca el candado ' +
        '(o ⋮ → Información del sitio) → Permisos → Ubicación → Permitir. Si ya está ' +
        'permitido, revisa en Ajustes de Android → Aplicaciones → Chrome → Permisos → Ubicación. ' +
        'Mientras, busca el lugar a mano.'
      );
    case NO_DISPONIBLE:
      return 'El móvil no sabe dónde está: activa la Ubicación en los ajustes rápidos de Android y vuelve a pulsar el botón de ubicación.';
    case TIEMPO:
      return 'El GPS ha tardado demasiado. Prueba otra vez con el cielo despejado, o busca el lugar a mano.';
    default:
      return 'No se pudo obtener la ubicación. Busca el lugar a mano.';
  }
}

function una(geo, opciones) {
  return new Promise((resolver, fallar) => geo.getCurrentPosition(resolver, fallar, opciones));
}

// Primero rápida (red o última conocida); si se agota el tiempo, con el GPS
// fino y más margen. Un permiso denegado no se reintenta: daría lo mismo.
export async function pedirUbicacion(geo) {
  if (!geo) throw { code: 0, message: 'sin geolocalización' };
  try {
    return await una(geo, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  } catch (e) {
    if (e?.code !== TIEMPO && e?.code !== NO_DISPONIBLE) throw e;
    return una(geo, { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
  }
}
