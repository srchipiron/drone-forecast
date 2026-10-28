// La persistencia, en un solo sitio. Todo con try/catch: en modo privado o
// con el almacenamiento lleno la app tiene que seguir funcionando.

const P = 'drone-forecast:';

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
};
