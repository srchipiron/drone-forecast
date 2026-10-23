// La interfaz. Pinta lo que devuelve construirPrevision(); no decide nada.

import { informeDiagnostico } from '../motor/diagnostico.js';
import { DRONES } from '../motor/drones.js';
import { MISIONES, MODOS } from '../motor/misiones.js';
import { construirPrevision, normalizarAjustes } from '../motor/prevision.js';
import { fmtViento } from '../motor/unidades.js';
import { VERSION } from '../version.js';
import { almacen } from './almacen.js';
import { buscarLugar, cargarKp, cargarPrevision, cargarSatelites, leerDescarga } from './datos.js';

const $ = (s) => document.querySelector(s);
const REFRESCO = 30 * 60000;

const ESTADOS = {
  ok: { texto: 'Se puede volar', corto: 'Volar' },
  precaucion: { texto: 'Con precaución', corto: 'Ojo' },
  no: { texto: 'No vueles', corto: 'No' },
  'sin-dato': { texto: 'Sin datos', corto: '—' },
};

const CHECKLIST = [
  'Zona geográfica UAS y NOTAM consultados en ENAIRE Drones',
  'Registro de operador vigente y número visible en el dron',
  'Seguro de responsabilidad civil en vigor',
  'Categoría y escenario de la operación claros (abierta / específica)',
  'Permiso del titular del terreno o del cliente',
  'Baterías cargadas y a temperatura, hélices sin daños',
  'Brújula calibrada y punto de regreso (RTH) a altura segura',
  'Zona de despegue despejada y terceros informados',
];

const estado = {
  ajustes: normalizarAjustes(almacen.ajustes()),
  lugar: almacen.lugar(),
  favoritos: almacen.favoritos(),
  meteo: null,
  consenso: new Map(),
  descargado: 0,
  desdeCache: false,
  error: '',
  cargando: false,
  kp: [],
  gnss: { satelites: [], actualizado: null, origen: null },
  dia: null,
  abierta: null,
  fallo: '',
};

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function hora(ms, zona) {
  if (!Number.isFinite(ms)) return '—';
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: zona }).format(new Date(ms));
}

function etiquetaDia(clave, k) {
  if (k === 0) return 'Hoy';
  if (k === 1) return 'Mañana';
  const d = new Date(`${clave}T12:00:00Z`);
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(d);
}

function hace(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}

// ---------- Datos ----------

async function descargar() {
  if (!estado.lugar || estado.cargando) return;
  estado.cargando = true;
  estado.error = '';
  pintar();
  const { lat, lon } = estado.lugar;
  try {
    const crudo = await cargarPrevision(lat, lon);
    Object.assign(estado, leerDescarga(crudo), { descargado: Date.now(), desdeCache: false });
    almacen.guardarCache({ lat, lon, guardado: estado.descargado, ...crudo });
  } catch (e) {
    const c = almacen.cache();
    if (c && c.lat === lat && c.lon === lon) {
      try {
        Object.assign(estado, leerDescarga(c), { descargado: c.guardado, desdeCache: true });
      } catch {
        /* caché rota: se queda el error */
      }
    }
    estado.error = `No se pudo descargar la previsión (${e.message}).`;
  } finally {
    estado.cargando = false;
    pintar();
  }
}

function ponerLugar(lugar) {
  estado.lugar = { nombre: lugar.nombre, zona: lugar.zona ?? '', lat: lugar.lat, lon: lugar.lon };
  almacen.guardarLugar(estado.lugar);
  estado.meteo = null;
  estado.dia = null;
  estado.abierta = null;
  descargar();
}

function usarGPS() {
  if (!navigator.geolocation) {
    estado.error = 'Este navegador no da la ubicación.';
    pintar();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (p) =>
      ponerLugar({
        nombre: 'Mi ubicación',
        zona: `${p.coords.latitude.toFixed(3)}, ${p.coords.longitude.toFixed(3)}`,
        lat: p.coords.latitude,
        lon: p.coords.longitude,
      }),
    () => {
      estado.error = 'No hay permiso para la ubicación: busca el lugar a mano.';
      pintar();
    },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
  );
}

function cambiarAjustes(cambios) {
  estado.ajustes = normalizarAjustes({ ...estado.ajustes, ...cambios });
  almacen.guardarAjustes(estado.ajustes);
  pintar();
}

// ---------- Pintar ----------

function prevision() {
  if (!estado.meteo || !estado.lugar) return null;
  return construirPrevision({
    meteo: estado.meteo,
    consenso: estado.consenso,
    kp: estado.kp,
    satelites: estado.gnss.satelites,
    lugar: estado.lugar,
    ajustes: estado.ajustes,
  });
}

function chipEstado(e, texto = ESTADOS[e].corto) {
  return `<span class="chip ${e}">${esc(texto)}</span>`;
}

function listaFactores(h) {
  return `<ul class="factores">${h.factores
    .map(
      (f) => `<li class="factor ${f.estado}">
        <span class="punto" aria-hidden="true"></span>
        <span class="f-nombre">${esc(f.nombre)}</span>
        <span class="f-valor">${esc(f.valor)}</span>
        ${f.detalle ? `<span class="f-detalle">${esc(f.detalle)}</span>` : ''}
      </li>`,
    )
    .join('')}</ul>`;
}

function pintarAhora(p) {
  const el = $('#ahora');
  if (!estado.lugar) {
    el.className = 'tarjeta veredicto';
    el.innerHTML = `<p class="grande">¿Dónde vas a volar?</p><p>Elige un lugar o usa tu ubicación para ver si se puede volar.</p>
      <div class="acciones"><button type="button" data-accion="lugar">Buscar lugar</button><button type="button" data-accion="gps">Usar mi ubicación</button></div>`;
    return;
  }
  if (!p) {
    el.className = 'tarjeta veredicto';
    el.innerHTML = `<p class="grande">${estado.cargando ? 'Descargando previsión…' : 'Sin previsión'}</p>`;
    return;
  }
  const h = p.actual ?? p.horas.find((x) => x.ms > Date.now()) ?? p.horas[0];
  const malos = h.factores.filter((f) => f.estado === h.estado && h.estado !== 'ok');
  const razon = h.estado === 'ok' ? 'Todo en verde para tu dron.' : malos.map((f) => `${f.nombre}: ${f.valor}`).join(' · ');
  const hoy = p.dias[0];
  el.className = `tarjeta veredicto ${h.estado}`;
  el.innerHTML = `
    <p class="cuando">Ahora · ${esc(hora(h.ms, p.zona))} · ${esc(p.dron.nombre)}${p.ajustes.modo === 'profesional' ? ` · ${esc(p.mision.nombre)}` : ''}</p>
    <p class="grande">${ESTADOS[h.estado].texto}</p>
    <p class="razon">${esc(razon)}</p>
    <div class="resumen">
      <div><span>Viento ${esc(p.ajustes.altitud)} m</span><strong>${esc(fmtViento(h.vientoAlt, p.ajustes.unidades))}</strong></div>
      <div><span>Rachas</span><strong>${esc(fmtViento(h.rachaAlt, p.ajustes.unidades))}</strong></div>
      <div><span>Satélites</span><strong>${esc(h.sats?.total ?? '—')}</strong></div>
      <div><span>Kp</span><strong>${esc(Number.isFinite(h.kp) ? h.kp.toFixed(1) : '—')}</strong></div>
    </div>
    ${
      hoy?.ventana
        ? `<p class="ventana-hoy">Mejor ventana hoy: <strong>${esc(hora(hoy.ventana.inicio, p.zona))}–${esc(hora(hoy.ventana.fin, p.zona))}</strong>${hoy.ventana.estado === 'precaucion' ? ' (con precaución)' : ''}</p>`
        : '<p class="ventana-hoy">Hoy no queda ninguna hora volable.</p>'
    }
    <p class="sol">☀ ${esc(hora(hoy?.sol.salida, p.zona))} – ${esc(hora(hoy?.sol.puesta, p.zona))} · hora dorada desde ${esc(hora(hoy?.sol.doradaTarde, p.zona))}</p>
    <details><summary>Todos los factores</summary>${listaFactores(h)}</details>`;
}

function pintarDias(p) {
  const el = $('#dias');
  if (!p) {
    el.innerHTML = '';
    return;
  }
  if (!p.dias.some((d) => d.clave === estado.dia)) estado.dia = p.dias[0]?.clave ?? null;
  el.innerHTML = p.dias
    .map((d, k) => {
      const v = d.ventana;
      const e = v ? v.estado : 'no';
      return `<button type="button" class="dia ${e}${d.clave === estado.dia ? ' activo' : ''}" data-dia="${esc(d.clave)}" aria-pressed="${d.clave === estado.dia}">
        <span class="d-nombre">${esc(etiquetaDia(d.clave, k))}</span>
        <span class="d-ventana">${v ? `${esc(hora(v.inicio, p.zona))}–${esc(hora(v.fin, p.zona))}` : 'Sin ventana'}</span>
        <span class="d-horas">${v ? `${v.horas} h` : ''}</span>
      </button>`;
    })
    .join('');
}

function pintarHoras(p) {
  const el = $('#horas');
  const dia = p?.dias.find((d) => d.clave === estado.dia);
  if (!dia) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const u = p.ajustes.unidades;
  el.innerHTML = `<h2>Hora a hora</h2><ol class="lista-horas">${dia.horas
    .map((h) => {
      const abierta = estado.abierta === h.ms;
      const pasada = h.ms + 3600000 <= Date.now();
      return `<li class="hora ${h.estado}${pasada ? ' pasada' : ''}">
        <button type="button" data-hora="${h.ms}" aria-expanded="${abierta}">
          <span class="h-hora">${esc(hora(h.ms, p.zona))}</span>
          ${chipEstado(h.estado)}
          <span class="h-dato" title="Viento a la altura de vuelo">${esc(fmtViento(h.vientoAlt, u))}</span>
          <span class="h-dato" title="Rachas">↯ ${esc(fmtViento(h.rachaAlt, u))}</span>
          <span class="h-dato" title="Probabilidad de lluvia">☂ ${esc(h.probLluvia ?? '—')}%</span>
          <span class="h-dato" title="Satélites">🛰 ${esc(h.sats?.total ?? '—')}</span>
        </button>
        ${abierta ? listaFactores(h) : ''}
      </li>`;
    })
    .join('')}</ol>`;
}

function pintarChecklist() {
  const el = $('#checklist');
  el.hidden = estado.ajustes.modo !== 'profesional';
  if (el.hidden) return;
  const hoy = new Date().toISOString().slice(0, 10);
  let c = almacen.checklist();
  if (c.dia !== hoy) c = { dia: hoy, hechos: [] };
  const hechos = new Set(c.hechos);
  el.innerHTML = `<h2>Antes de despegar <span class="nota">${hechos.size}/${CHECKLIST.length}</span></h2>
    <ul class="lista-check">${CHECKLIST.map(
      (t, i) => `<li><label class="casilla"><input type="checkbox" data-check="${i}" ${hechos.has(i) ? 'checked' : ''}> ${esc(t)}</label></li>`,
    ).join('')}</ul>
    <p class="nota">Se vacía sola cada día.</p>`;
}

function ponerOpciones(sel, html) {
  if (sel.dataset.opciones !== html) {
    sel.innerHTML = html;
    sel.dataset.opciones = html;
  }
}

function pintarPerfil() {
  const a = estado.ajustes;
  document.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.modo === a.modo)));
  document.body.dataset.modo = a.modo;
  const selDron = $('#sel-dron');
  // Solo se rehacen las opciones si cambian: rehacerlas cierra el desplegable abierto.
  ponerOpciones(selDron, [...DRONES, { id: 'personalizado', nombre: 'Personalizado…' }]
    .map((d) => `<option value="${esc(d.id)}">${esc(d.nombre)}</option>`)
    .join(''));
  selDron.value = a.dron;
  const misiones = MODOS[a.modo].misiones;
  $('#campo-mision').hidden = misiones.length < 2;
  const selMision = $('#sel-mision');
  ponerOpciones(selMision, misiones.map((id) => `<option value="${esc(id)}">${esc(MISIONES[id].nombre)}</option>`).join(''));
  selMision.value = a.mision;
  $('#desc-mision').textContent = MISIONES[a.mision].descripcion;
  const rng = $('#rng-altitud');
  // En categoría abierta el tope son 120 m; el modo profesional deja hasta 180.
  rng.max = a.modo === 'profesional' ? '180' : '120';
  rng.value = String(Math.min(a.altitud, Number(rng.max)));
  $('#val-altitud').textContent = `${a.altitud} m`;
  $('#aj-unidades').value = a.unidades;
  $('#aj-margen').value = a.margenViento;
  $('#aj-sats').value = a.minSats;
  $('#aj-kp').value = a.maxKp;
  $('#aj-noche').checked = a.permitirNoche;
  $('#aj-interior').value = a.tempInterior;
  $('#campo-interior').hidden = a.mision !== 'termografia_edificios';
  $('#dron-personalizado').hidden = a.dron !== 'personalizado';
  $('#pz-viento').value = a.personalizado.maxViento;
  $('#pz-tmin').value = a.personalizado.tempMin;
  $('#pz-tmax').value = a.personalizado.tempMax;
  $('#pz-ip').checked = Boolean(a.personalizado.ip);
}

function pintarAviso(p) {
  const el = $('#aviso');
  const avisos = [];
  if (estado.error) avisos.push(estado.error);
  if (estado.desdeCache) avisos.push(`Enseñando la previsión guardada ${hace(estado.descargado)}.`);
  if (p && !p.satelitesDisponibles) avisos.push('Sin órbitas de satélites recientes: el recuento GNSS no está disponible.');
  el.hidden = !avisos.length;
  el.innerHTML = avisos.map((a) => `<p>${esc(a)}</p>`).join('');
}

function pintarPie() {
  $('#version').textContent = `v${VERSION}`;
  const partes = ['Tiempo: Open-Meteo', 'Kp: NOAA SWPC', 'Órbitas: CelesTrak'];
  if (estado.descargado) partes.push(`previsión ${hace(estado.descargado)}`);
  if (estado.gnss.actualizado) {
    const origen = { despliegue: 'del despliegue', guardadas: 'guardadas', celestrak: 'de CelesTrak' }[estado.gnss.origen] ?? '';
    partes.push(`${estado.gnss.satelites.length} órbitas ${origen} ${hace(Date.parse(estado.gnss.actualizado))}`);
  }
  $('#fuentes').textContent = partes.join(' · ');
}

function pintar() {
  const nombre = estado.lugar ? estado.lugar.nombre : 'Elegir lugar';
  $('#nombre-lugar').textContent = nombre;
  $('#btn-recargar').classList.toggle('girando', estado.cargando);
  pintarPerfil();
  let p = null;
  try {
    p = prevision();
  } catch (e) {
    estado.error = `No se pudo calcular la previsión: ${e.message}`;
  }
  pintarAviso(p);
  pintarAhora(p);
  pintarDias(p);
  pintarHoras(p);
  pintarChecklist();
  pintarPie();
}

// ---------- Diagnóstico ----------

function textoDiagnostico() {
  let p = null;
  try {
    p = prevision();
  } catch {
    /* el error ya está en estado.error */
  }
  return informeDiagnostico({
    version: VERSION,
    lugar: estado.lugar,
    ajustes: estado.ajustes,
    prevision: p,
    meteo: {
      descargado: estado.descargado,
      desdeCache: estado.desdeCache,
      horas: estado.meteo?.horas.length ?? 0,
      elevacion: estado.meteo?.elevacion ?? null,
    },
    kp: { tramos: estado.kp.length },
    orbitas: { total: estado.gnss.satelites.length, origen: estado.gnss.origen, actualizado: estado.gnss.actualizado },
    error: [estado.error, estado.fallo].filter(Boolean).join(' | '),
    navegador: navigator.userAgent,
  });
}

async function abrirDiagnostico() {
  const texto = textoDiagnostico();
  $('#txt-diagnostico').value = texto;
  $('#estado-diagnostico').textContent = '';
  $('#dlg-diagnostico').showModal();
  await copiarDiagnostico(texto);
}

async function copiarDiagnostico(texto = $('#txt-diagnostico').value) {
  try {
    await navigator.clipboard.writeText(texto);
    $('#estado-diagnostico').textContent = 'Copiado. Pégalo en el chat.';
  } catch {
    // Sin permiso de portapapeles: se deja seleccionado para copiarlo a mano.
    $('#txt-diagnostico').select();
    $('#estado-diagnostico').textContent = 'Mantén pulsado el texto y elige «Copiar».';
  }
}

// ---------- Lugar ----------

function pintarFavoritos() {
  const es = (l) => estado.lugar && Math.abs(l.lat - estado.lugar.lat) < 1e-4 && Math.abs(l.lon - estado.lugar.lon) < 1e-4;
  const actualEsFav = estado.lugar && estado.favoritos.some(es);
  const items = estado.favoritos.map(
    (l, i) => `<li><button type="button" data-fav="${i}">${esc(l.nombre)} <span class="nota">${esc(l.zona)}</span></button>
      <button type="button" class="icono" data-quitar="${i}" aria-label="Quitar ${esc(l.nombre)}">✕</button></li>`,
  );
  if (estado.lugar && !actualEsFav)
    items.unshift(`<li><button type="button" data-accion="guardar-fav">☆ Guardar «${esc(estado.lugar.nombre)}»</button></li>`);
  $('#favoritos').innerHTML = items.join('') || '<li class="nota">Aún no tienes favoritos.</li>';
}

let resultados = [];

async function buscar(texto) {
  const t = texto.trim();
  const coords = t.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (coords) {
    const lat = Number(coords[1]);
    const lon = Number(coords[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      resultados = [{ nombre: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, zona: 'Coordenadas', lat, lon }];
      pintarResultados();
      return;
    }
  }
  if (t.length < 2) return;
  $('#resultados').innerHTML = '<li class="nota">Buscando…</li>';
  try {
    resultados = await buscarLugar(t);
    pintarResultados();
  } catch (e) {
    $('#resultados').innerHTML = `<li class="nota">No se pudo buscar (${esc(e.message)}).</li>`;
  }
}

function pintarResultados() {
  $('#resultados').innerHTML = resultados.length
    ? resultados.map((r, i) => `<li><button type="button" data-res="${i}">${esc(r.nombre)} <span class="nota">${esc(r.zona)}</span></button></li>`).join('')
    : '<li class="nota">Nada con ese nombre.</li>';
}

function abrirLugar() {
  pintarFavoritos();
  $('#dlg-lugar').showModal();
  $('#txt-buscar').focus();
}

// ---------- Eventos ----------

function enlazar() {
  $('#btn-lugar').addEventListener('click', abrirLugar);
  $('#btn-gps').addEventListener('click', usarGPS);
  $('#btn-diagnostico').addEventListener('click', abrirDiagnostico);
  $('#btn-copiar-diagnostico').addEventListener('click', () => copiarDiagnostico());
  // Un fallo de JavaScript no se ve en el móvil: se guarda para el Diagnóstico.
  window.addEventListener('error', (e) => {
    estado.fallo = `${e.message} (${String(e.filename ?? '').split('/').pop()}:${e.lineno ?? '?'})`;
  });
  window.addEventListener('unhandledrejection', (e) => {
    estado.fallo = `Promesa: ${e.reason?.message ?? e.reason}`;
  });
  $('#btn-recargar').addEventListener('click', () => {
    descargar();
    cargarKp().then((kp) => {
      estado.kp = kp;
      pintar();
    });
  });
  document.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => cambiarAjustes({ modo: b.dataset.modo })));
  $('#sel-dron').addEventListener('change', (e) => cambiarAjustes({ dron: e.target.value }));
  $('#sel-mision').addEventListener('change', (e) => cambiarAjustes({ mision: e.target.value }));
  $('#rng-altitud').addEventListener('input', (e) => {
    $('#val-altitud').textContent = `${e.target.value} m`;
  });
  $('#rng-altitud').addEventListener('change', (e) => cambiarAjustes({ altitud: Number(e.target.value) }));
  $('#aj-unidades').addEventListener('change', (e) => cambiarAjustes({ unidades: e.target.value }));
  const numero = (id, clave) => $(id).addEventListener('change', (e) => cambiarAjustes({ [clave]: Number(e.target.value) }));
  numero('#aj-margen', 'margenViento');
  numero('#aj-sats', 'minSats');
  numero('#aj-kp', 'maxKp');
  numero('#aj-interior', 'tempInterior');
  $('#aj-noche').addEventListener('change', (e) => cambiarAjustes({ permitirNoche: e.target.checked }));
  const pz = (id, clave, leer = (t) => Number(t.value)) =>
    $(id).addEventListener('change', (e) =>
      cambiarAjustes({ personalizado: { ...estado.ajustes.personalizado, [clave]: leer(e.target) } }),
    );
  pz('#pz-viento', 'maxViento');
  pz('#pz-tmin', 'tempMin');
  pz('#pz-tmax', 'tempMax');
  pz('#pz-ip', 'ip', (t) => (t.checked ? 'IP45' : null));

  document.body.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.accion === 'lugar') abrirLugar();
    else if (b.dataset.accion === 'gps') usarGPS();
    else if (b.dataset.dia) {
      estado.dia = b.dataset.dia;
      estado.abierta = null;
      pintar();
    } else if (b.dataset.hora) {
      const ms = Number(b.dataset.hora);
      estado.abierta = estado.abierta === ms ? null : ms;
      pintar();
    } else if (b.dataset.res) {
      ponerLugar(resultados[Number(b.dataset.res)]);
      $('#dlg-lugar').close();
    } else if (b.dataset.fav) {
      ponerLugar(estado.favoritos[Number(b.dataset.fav)]);
      $('#dlg-lugar').close();
    } else if (b.dataset.quitar) {
      estado.favoritos.splice(Number(b.dataset.quitar), 1);
      almacen.guardarFavoritos(estado.favoritos);
      pintarFavoritos();
    } else if (b.dataset.accion === 'guardar-fav') {
      estado.favoritos.push({ ...estado.lugar });
      almacen.guardarFavoritos(estado.favoritos);
      pintarFavoritos();
    }
  });
  $('#checklist').addEventListener('change', (e) => {
    const i = e.target.dataset.check;
    if (i === undefined) return;
    const hoy = new Date().toISOString().slice(0, 10);
    let c = almacen.checklist();
    if (c.dia !== hoy) c = { dia: hoy, hechos: [] };
    const hechos = new Set(c.hechos);
    if (e.target.checked) hechos.add(Number(i));
    else hechos.delete(Number(i));
    almacen.guardarChecklist({ dia: hoy, hechos: [...hechos] });
    pintarChecklist();
  });
  $('#form-buscar').addEventListener('submit', (e) => {
    e.preventDefault();
    buscar($('#txt-buscar').value);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - estado.descargado > REFRESCO) descargar();
  });
  // Cada hora en punto cambia «ahora»: se repinta sin descargar.
  setInterval(pintar, 60000);
}

async function arrancar() {
  enlazar();
  pintar();
  const c = almacen.cache();
  if (estado.lugar && c && c.lat === estado.lugar.lat && c.lon === estado.lugar.lon) {
    try {
      Object.assign(estado, leerDescarga(c), { descargado: c.guardado, desdeCache: true });
      pintar();
    } catch {
      /* se descarga de nuevo */
    }
  }
  const [kp, gnss] = await Promise.all([cargarKp(), cargarSatelites(), descargar()]);
  estado.kp = kp;
  estado.gnss = gnss;
  pintar();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

arrancar();
