// El informe del botón Diagnóstico: un texto corto que Javi copia en el móvil
// y pega en el chat cuando algo sale raro (en el móvil no hay consola).
// Puro: recibe lo que la app sabe y devuelve texto. No lleva nada secreto.

const ICONO = { ok: 'OK', precaucion: 'OJO', no: 'NO', 'sin-dato': '--' };

function hace(ms, ahora) {
  if (!Number.isFinite(ms)) return 'nunca';
  const min = Math.round((ahora - ms) / 60000);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}

function hora(ms, zona) {
  if (!Number.isFinite(ms)) return '—';
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: zona }).format(new Date(ms));
}

function fecha(ms, zona) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: zona }).format(new Date(ms));
}

/**
 * @param {object} d
 * @param {string} d.version
 * @param {{nombre: string, lat: number, lon: number} | null} d.lugar
 * @param {object} d.ajustes  normalizados
 * @param {object | null} d.prevision  construirPrevision()
 * @param {{descargado: number, desdeCache: boolean, horas: number, elevacion: number | null}} d.meteo
 * @param {{tramos: number}} d.kp
 * @param {{total: number, origen: string | null, actualizado: string | null}} d.orbitas
 * @param {{estado: string, zonas: object[], motivos?: string[]} | null} [d.enaire]
 * @param {string} d.error
 * @param {string} [d.navegador]
 * @param {number} [d.ahora]
 */
export function informeDiagnostico(d) {
  const ahora = d.ahora ?? Date.now();
  const p = d.prevision;
  const zona = p?.zona ?? 'UTC';
  const a = d.ajustes;
  const l = [];
  l.push(`Drone Forecast v${d.version} · ${fecha(ahora, zona)} (${zona})`);
  l.push(
    d.lugar
      ? `Lugar: ${d.lugar.nombre} (${d.lugar.lat.toFixed(4)}, ${d.lugar.lon.toFixed(4)})${Number.isFinite(d.meteo.elevacion) ? ` · ${Math.round(d.meteo.elevacion)} m` : ''}`
      : 'Lugar: sin elegir',
  );
  l.push(`Modo ${a.modo} · misión ${a.mision} · dron ${a.dron}${p ? ` (máx ${p.dron.maxViento} m/s)` : ''} · altura ${a.altitud} m`);
  l.push(
    `Ajustes: viento ${a.margenViento}% · sats ≥${a.minSats} · Kp ≤${a.maxKp} · noche ${a.permitirNoche ? 'sí' : 'no'} · ${a.unidades}`,
  );
  l.push(
    d.meteo.descargado
      ? `Previsión: ${d.meteo.desdeCache ? 'GUARDADA' : 'de la red'} ${hace(d.meteo.descargado, ahora)} · ${d.meteo.horas} h`
      : 'Previsión: sin descargar',
  );
  l.push(`Kp: ${d.kp.tramos} tramos${p?.actual ? ` · ahora ${Number.isFinite(p.actual.kp) ? p.actual.kp.toFixed(1) : 'sin dato'}` : ''}`);
  l.push(
    `Órbitas: ${d.orbitas.total}${d.orbitas.origen ? ` (${d.orbitas.origen})` : ''}${d.orbitas.actualizado ? ` ${hace(Date.parse(d.orbitas.actualizado), ahora)}` : ''}${p && !p.satelitesDisponibles ? ' · NO SE USAN' : ''}`,
  );
  if (d.enaire) {
    const z = d.enaire;
    l.push(
      `ENAIRE: ${z.estado}${z.zonas?.length ? ` · ${z.zonas.length} zonas (${z.zonas.map((x) => x.nombre).slice(0, 3).join(', ')})` : ''}${z.motivos?.length ? ` · fallos: ${z.motivos.join('; ')}` : ''}`,
    );
  } else if (d.lugar) {
    l.push('ENAIRE: consultando');
  }
  if (p?.actual) {
    const h = p.actual;
    l.push(`Ahora ${hora(h.ms, zona)} → ${ICONO[h.estado]} ${h.estado}`);
    for (const f of h.factores) l.push(`  ${ICONO[f.estado].padEnd(3)} ${f.id}: ${f.valor}`);
  } else if (p) {
    l.push('Ahora: la previsión no cubre la hora actual');
  }
  const v = p?.dias[0]?.ventana;
  if (p) l.push(`Ventana hoy: ${v ? `${hora(v.inicio, zona)}–${hora(v.fin, zona)} (${v.estado}, ${v.horas} h)` : 'ninguna'}`);
  l.push(`Error: ${d.error || 'ninguno'}`);
  if (d.navegador) l.push(`Navegador: ${String(d.navegador).slice(0, 160)}`);
  return l.join('\n');
}
