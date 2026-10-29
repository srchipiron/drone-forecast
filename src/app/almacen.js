// La persistencia, en un solo sitio. Todo con try/catch: en modo privado o
// con el almacenamiento lleno la app tiene que seguir funcionando.

const P = 'drone-forecast:';

// No empieza por «drone-forecast-»: el instalador borra esas cachés al
// cambiar de versión, y esto tiene que sobrevivir.
const CACHE_AVISO = 'df-aviso';
// Misma carpeta para la página y para el instalador (los dos viven en la raíz de la app).
const URL_AVISO = () => new URL('aviso-config.json', self.location.href).href;

function leer(clave, porDefecto) {
  try {
    const v = localStorage.getItem(P + clave);
    return v === null ? porDefecto : JSON.parse(v);
  } catch {
    return porDefecto;
  }
}

function escribir(clave, valor) {
  try {
    localStorage.setItem(P + clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export const almacen = {
  ajustes: () => leer('ajustes', {}),
  guardarAjustes: (a) => escribir('ajustes', a),
  lugar: () => leer('lugar', null),
  guardarLugar: (l) => escribir('lugar', l),
  favoritos: () => leer('favoritos', []),
  guardarFavoritos: (f) => escribir('favoritos', f),
  // La última previsión descargada, para enseñar algo sin cobertura.
  cache: () => leer('cache', null),
  guardarCache: (c) => escribir('cache', c),
  // Órbitas bajadas de CelesTrak desde el móvil (unos 20 kB).
  orbitas: () => leer('orbitas', null),
  guardarOrbitas: (o) => escribir('orbitas', o),
  diario: () => leer('diario', []),
  guardarDiario: (d) => escribir('diario', d),
  checklist: () => leer('checklist', { dia: '', hechos: [] }),
  guardarChecklist: (c) => escribir('checklist', c),
  aviso: () => leer('aviso', false) === true,
  guardarAviso: (v) => escribir('aviso', Boolean(v)),
  // El instalador no ve localStorage: lo que necesita el aviso de ventana
  // (ajustes, favoritos, último día avisado) va también en Cache Storage.
  configAviso: async () => {
    try {
      const r = await caches.match(URL_AVISO(), { cacheName: CACHE_AVISO });
      return r ? await r.json() : null;
    } catch {
      return null;
    }
  },
  guardarConfigAviso: async (c) => {
    try {
      const cache = await caches.open(CACHE_AVISO);
      await cache.put(URL_AVISO(), new Response(JSON.stringify(c), { headers: { 'Content-Type': 'application/json' } }));
      return true;
    } catch {
      return false;
    }
  },
};
