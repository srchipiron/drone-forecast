// La interfaz. Pinta lo que devuelve construirPrevision(); no decide nada.

import { informeDiagnostico } from '../motor/diagnostico.js';
import { VALORACIONES, anadirEntrada, crearEntrada, diarioValido, resumenDiario } from '../motor/diario.js';
import { graficaDia } from '../motor/grafica.js';
import { DRONES } from '../motor/drones.js';
import { MISIONES, MODOS } from '../motor/misiones.js';
import { construirPrevision, normalizarAjustes, resumenDias } from '../motor/prevision.js';
import { fmtViento } from '../motor/unidades.js';
import { umbralesViento } from '../motor/veredicto.js';
import { perfilViento } from '../motor/viento.js';
import { VERSION } from '../version.js';
import { almacen } from './almacen.js';
import { buscarLugar, cargarKp, cargarPrevision, cargarSatelites, cargarSoloPrevision, consultarEnaire, leerDescarga } from './datos.js';
import { mensajeUbicacion, pedirUbicacion } from './ubicacion.js';

const $ = (s) => document.querySelector(s);
const REFRESCO = 30 * 60000;

// Para que el estado no dependa solo del color (daltonismo, pleno sol).
const SIMBOLO = { ok: '✓', precaucion: '!', no: '✕', 'sin-dato': '–' };

// Iconos de línea (24×24), mismo trazo que los de la cabecera.
const ICONOS = {
  viento: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
  rachas: '<path d="M13 3 6 13h5l-1 8 7-10h-5z"/>',
  lluvia: '<path d="M7 15a5 5 0 1 1 9.6-2H17a3 3 0 0 1 0 6H8a4 4 0 0 1-1-4Z"/><path d="M9 21l1-2M13 21l1-2"/>',
  satelite: '<path d="m13 7 4 4-6 6-4-4z"/><path d="m16 4 4 4-2 2-4-4zM6 14l4 4-2 2-4-4zM15 15a4 4 0 0 1-2 3M19 15a8 8 0 0 1-4 6"/>',
  kp: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  ventana: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  sol: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 7V4M5.6 10.6 3.5 8.5M18.4 10.6l2.1-2.1"/>',
  zona: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  termometro: '<path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0Z"/><path d="M12 10v6"/>',
  ojo: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  nube: '<path d="M7 15a5 5 0 1 1 9.6-2H17a3 3 0 0 1 0 6H8a4 4 0 0 1-1-4Z"/>',
  modelos: '<path d="M4 18 9 9l4 6 3-4 4 7M4 6h4M4 10h2"/>',
  mision: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="m8 12 3 3 5-6"/>',
  amanecer: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 4v5M9 7l3-3 3 3"/>',
};

function icono(nombre) {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[nombre]}</svg>`;
}

// «13 km/h» → ['13', 'km/h'], para enseñar el número grande y la unidad pequeña.
function partesViento(ms, u) {
  const t = fmtViento(ms, u);
  const i = t.indexOf(' ');
  return i < 0 ? [t, ''] : [t.slice(0, i), t.slice(i + 1)];
}

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
  pedido: 0,
  vecesLugar: 0,
  // Pestaña abierta.
  vista: 'prevision',
  ultimoVeredicto: '',
  // Zonas de ENAIRE del lugar actual: null mientras se consulta.
  enaire: null,
  enaireDe: '',
  // Previsión de cada favorito para su resumen, por «lat,lon»: { meteo, t } o { error, t }.
  favMeteo: new Map(),
};

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function hora(ms, zona) {
  if (!Number.isFinite(ms)) return '—';
  try {
    return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: zona }).format(new Date(ms));
  } catch {
    // Zona horaria rara en una caché vieja: mejor la hora del móvil que congelarse.
    return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
  }
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
  if (!estado.lugar) return;
  // Cada descarga lleva su número: si mientras tanto se pide otra (otro lugar,
  // recargar), la vieja no pisa a la nueva al llegar tarde.
  const n = ++estado.pedido;
  estado.cargando = true;
  estado.error = '';
  pintar();
  const { lat, lon } = estado.lugar;
  try {
    const crudo = await cargarPrevision(lat, lon);
    if (n !== estado.pedido) return;
    Object.assign(estado, leerDescarga(crudo), { descargado: Date.now(), desdeCache: false });
    almacen.guardarCache({ lat, lon, guardado: estado.descargado, ...crudo });
  } catch (e) {
    if (n !== estado.pedido) return;
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
    if (n === estado.pedido) {
      estado.cargando = false;
      pintar();
    }
  }
}

function ponerLugar(lugar) {
  estado.vecesLugar++;
  estado.lugar = { nombre: lugar.nombre, zona: lugar.zona ?? '', lat: lugar.lat, lon: lugar.lon };
  almacen.guardarLugar(estado.lugar);
  estado.meteo = null;
  estado.dia = null;
  estado.abierta = null;
  descargar();
  cargarEnaire();
}

async function usarGPS() {
  if (!navigator.geolocation) {
    estado.error = 'Este navegador no da la ubicación: busca el lugar a mano.';
    pintar();
    return;
  }
  estado.error = '';
  $('#btn-gps').classList.add('girando');
  // Si mientras el GPS busca se elige un lugar a mano, gana el de a mano.
  const antes = estado.vecesLugar;
  try {
    const p = await pedirUbicacion(navigator.geolocation);
    if (estado.vecesLugar !== antes) return;
    ponerLugar({
      nombre: 'Mi ubicación',
      zona: `${p.coords.latitude.toFixed(3)}, ${p.coords.longitude.toFixed(3)}`,
      lat: p.coords.latitude,
      lon: p.coords.longitude,
    });
  } catch (e) {
    estado.error = mensajeUbicacion(e);
    estado.fallo = `Ubicación: código ${e?.code ?? '?'} ${e?.message ?? ''}`.trim();
    pintar();
  } finally {
    $('#btn-gps').classList.remove('girando');
  }
}

function cambiarAjustes(cambios) {
  estado.ajustes = normalizarAjustes({ ...estado.ajustes, ...cambios });
  almacen.guardarAjustes(estado.ajustes);
  pintar();
}

// ---------- Pintar ----------

// La previsión cuesta (satélites, sol de 7 días): se recalcula solo si cambia
// algún dato, el lugar, los ajustes o la hora en curso.
let memo = { clave: null, valor: null };

function prevision() {
  if (!estado.meteo || !estado.lugar) return null;
  const clave = [estado.meteo, estado.consenso, estado.kp, estado.gnss.satelites, estado.lugar, estado.ajustes, horaEnCurso()];
  if (memo.clave && memo.clave.every((x, i) => x === clave[i])) return memo.valor;
  const valor = construirPrevision({
    meteo: estado.meteo,
    consenso: estado.consenso,
    kp: estado.kp,
    satelites: estado.gnss.satelites,
    lugar: estado.lugar,
    ajustes: estado.ajustes,
  });
  memo = { clave, valor };
  return valor;
}

function horaEnCurso() {
  return Math.floor(Date.now() / 3600000);
}

// Fecha local del móvil (AAAA-MM-DD), no la UTC: la lista y el diario cambian
// de día a medianoche, no a la 01:00 o las 02:00.
function hoyLocal() {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function chipEstado(e, texto = ESTADOS[e].corto) {
  return `<span class="chip ${e}">${esc(texto)}</span>`;
}

// Cada fila de «Condiciones ahora», como en UAV Forecast: icono, dato, valor
// y su marca. El detalle solo sale cuando algo no está en verde: dice por qué.
const ICONO_FACTOR = {
  viento: 'viento',
  rachas: 'rachas',
  lluvia: 'lluvia',
  temperatura: 'termometro',
  visibilidad: 'ojo',
  techo: 'nube',
  luz: 'sol',
  kp: 'kp',
  satelites: 'satelite',
  consenso: 'modelos',
};

// Flecha hacia donde SOPLA el viento: la dirección meteorológica dice de dónde
// viene, y la flecha base (hacia abajo) es justo el viento del norte, 0°.
function flecha(grados) {
  if (!Number.isFinite(grados)) return '';
  return `<svg class="flecha" viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(${Math.round(grados)} 12 12)"><path d="M12 4v16M6 14l6 6 6-6"/></g></svg>`;
}

function listaCondiciones(h) {
  return `<ul class="condiciones">${h.factores
    .map(
      (f) => `<li class="condicion ${f.estado}" data-factor="${esc(f.id)}">
        ${icono(ICONO_FACTOR[f.id] ?? 'mision')}
        <span class="c-nombre">${esc(f.nombre)}</span>
        <span class="c-valor">${f.id === 'viento' ? flecha(h.dirAlt) : ''}${esc(f.valor)}</span>
        <span class="c-marca" aria-hidden="true">${SIMBOLO[f.estado]}</span><span class="visualmente-oculto">${ESTADOS[f.estado].corto}</span>
        ${f.detalle && f.estado !== 'ok' ? `<span class="c-detalle">${esc(f.detalle)}</span>` : ''}
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
  const h = p.actual ?? p.horas.find((x) => x.ms > Date.now());
  if (!h) {
    el.className = 'tarjeta veredicto';
    el.innerHTML = `<p class="grande">Sin previsión para ahora</p>
      <p>La previsión guardada ya no cubre la hora actual${estado.descargado ? ` (es de ${esc(hace(estado.descargado))})` : ''}. Necesitas cobertura para descargar una nueva.</p>
      <div class="acciones"><button type="button" data-accion="recargar">Reintentar</button></div>`;
    return;
  }
  const malos = h.factores.filter((f) => f.estado === h.estado && h.estado !== 'ok');
  const razon = h.estado === 'ok' ? 'Todo en verde para tu dron.' : malos.map((f) => `${f.nombre}: ${f.valor}`).join(' · ');
  const hoy = p.dias[0];
  el.className = `tarjeta veredicto ${h.estado}`;
  el.innerHTML = `
    <div class="cartel">
      <span class="simbolo" aria-hidden="true">${SIMBOLO[h.estado]}</span>
      <div>
        <p class="grande">${ESTADOS[h.estado].texto}</p>
        <p class="cuando">${p.actual ? 'Ahora' : 'Próxima hora'} · ${esc(hora(h.ms, p.zona))} · ${esc(p.dron.nombre)} a ${esc(p.ajustes.altitud)} m</p>
      </div>
    </div>
    ${h.estado === 'ok' ? '' : `<p class="razon">${esc(razon)}</p>`}
    <h2>Condiciones ahora</h2>
    ${listaCondiciones(h)}
    <ul class="filas">
      <li class="fila ventana-hoy ${esc(hoy?.ventana?.estado ?? 'no')}">${icono('ventana')}<span>Mejor ventana hoy</span>
        <strong>${hoy?.ventana ? `${esc(hora(hoy.ventana.inicio, p.zona))}–${esc(hora(hoy.ventana.fin, p.zona))}${hoy.ventana.estado === 'precaucion' ? ' · con precaución' : ''}` : 'Hoy no queda ninguna hora volable'}</strong></li>
      <li class="fila sol">${icono('amanecer')}<span>Amanecer · ocaso</span>
        <strong>${esc(hora(hoy?.sol.salida, p.zona))} · ${esc(hora(hoy?.sol.puesta, p.zona))}</strong></li>
      <li class="fila sol">${icono('sol')}<span>Hora dorada</span>
        <strong>${esc(hora(hoy?.sol.doradaTarde, p.zona))}</strong></li>
    </ul>
    ${bloqueEnaire()}
    <div class="acciones acciones-ahora">
      <button type="button" data-accion="volado" data-ms="${h.ms}">He volado</button>
      ${p.ajustes.modo === 'profesional' ? '<button type="button" data-accion="informe">Informe para el cliente</button>' : ''}
    </div>`;
  // El lector de pantalla solo oye el veredicto cuando cambia, no cada minuto.
  const anuncio = `${h.ms}-${h.estado}`;
  if (anuncio !== estado.ultimoVeredicto) {
    estado.ultimoVeredicto = anuncio;
    $('#anuncio').textContent = `${ESTADOS[h.estado].texto}. ${razon}`;
  }
}

const MAPA_ENAIRE = '<a href="https://drones.enaire.es/" target="_blank" rel="noopener noreferrer">mapa de ENAIRE Drones</a>';

function bloqueEnaire() {
  const z = estado.enaire;
  if (!z) return `<div class="enaire">${icono('zona')}<div><p>Zonas UAS: consultando ENAIRE…</p></div></div>`;
  if (z.estado === 'dentro') {
    const n = z.zonas.length;
    return `<div class="enaire dentro">${icono('zona')}<div><p><strong>Dentro de ${n} zona${n === 1 ? '' : 's'} UAS de ENAIRE</strong>${z.fallidas.length ? ' (y alguna capa no respondió)' : ''}:</p>
      <ul>${z.zonas
        .slice(0, 6)
        .map(
          (x) =>
            `<li><strong>${esc(x.nombre)}</strong> · ${esc(x.capa)}${x.restriccion ? ` · ${esc(x.restriccion)}` : ''}${x.motivo ? ` · ${esc(x.motivo)}` : ''}${x.mensaje ? `<br><span class="nota">${esc(x.mensaje)}</span>` : ''}</li>`,
        )
        .join('')}</ul>
      <p>Revisa las condiciones en el ${MAPA_ENAIRE} antes de volar.</p></div></div>`;
  }
  if (z.estado === 'fuera')
    return `<div class="enaire fuera">${icono('zona')}<div><p>No consta en ninguna zona UAS de ENAIRE. Compruébalo igualmente en el ${MAPA_ENAIRE} (NOTAM y zonas temporales).</p></div></div>`;
  return `<div class="enaire sin-dato">${icono('zona')}<div><p>${z.estado === 'incompleto' ? 'No se pudo consultar ENAIRE del todo' : 'No se pudo consultar ENAIRE'}: míralo en el ${MAPA_ENAIRE} antes de volar.</p></div></div>`;
}

async function cargarEnaire() {
  if (!estado.lugar) return;
  const clave = `${estado.lugar.lat},${estado.lugar.lon}`;
  // Ya consultado y con respuesta completa: no se repite. Tras un fallo, sí.
  if (estado.enaireDe === clave && estado.enaire && !['error', 'incompleto'].includes(estado.enaire.estado)) return;
  estado.enaireDe = clave;
  estado.enaire = null;
  const r = await consultarEnaire(estado.lugar.lat, estado.lugar.lon);
  if (estado.enaireDe !== clave) return; // el lugar cambió mientras tanto
  estado.enaire = r;
  pintar();
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
        <span class="d-horas">${v ? `${SIMBOLO[v.estado]} ${v.horas} h${v.estado === 'precaucion' ? ' con precaución' : ''}` : ''}</span>
      </button>`;
    })
    .join('');
}

// Viento por alturas en una hora. <meter> colorea solo: hasta «low» verde,
// hasta «high» ámbar, más allá rojo; con los mismos umbrales que el semáforo.
function bloquePerfil(h, p) {
  const filas = perfilViento(h.niveles, p.ajustes.altitud);
  if (!filas.length) return '';
  const { comodo, limite } = umbralesViento(p);
  const u = p.ajustes.unidades;
  const r = (x) => x.toFixed(2);
  return `<div class="perfil-viento"><p class="nota">Viento por alturas (límite del dron ${esc(fmtViento(limite, u))})</p><ul>${filas
    .map(
      (f) => `<li class="${f.vuelo ? 'vuelo' : ''}">
        <span class="pv-altura">${f.altura} m${f.vuelo ? ' · vuelo' : ''}</span>
        <meter min="0" max="${r(limite * 1.25)}" low="${r(comodo)}" high="${r(limite)}" optimum="0" value="${r(Math.min(f.valor, limite * 1.25))}"></meter>
        <span class="pv-valor">${esc(fmtViento(f.valor, u))}${f.estimado ? ' (est.)' : ''}</span>
      </li>`,
    )
    .join('')}</ul></div>`;
}

// Gráfica del día en SVG (atributos de presentación y clases: la CSP no deja
// estilos en línea). Debajo, una franja por hora con el color del semáforo.
function svgGrafica(dia, p) {
  const g = graficaDia(dia.horas, umbralesViento(p));
  const u = p.ajustes.unidades;
  const ahora = Date.now();
  const marcaAhora = g.xDe.find((m) => ahora >= m.ms && ahora < m.ms + 3600000);
  const etiquetas = g.xDe.filter((m, i) => i % 6 === 0);
  const alto = g.alto + 24;
  // La primera etiqueta se alinea a la izquierda para que no se corte.
  const ancla = (i) => (i === 0 ? ' class="inicio"' : '');
  return `<figure class="grafica">
    <svg viewBox="0 0 ${g.ancho} ${alto}" role="img" aria-label="Viento y rachas a ${esc(p.ajustes.altitud)} metros a lo largo del día">
      ${g.franjas.map((f) => `<rect class="franja ${esc(f.estado)}" x="${f.x}" y="${g.alto + 1}" width="${f.ancho}" height="5"></rect>`).join('')}
      <line class="umbral limite" x1="0" x2="${g.ancho}" y1="${g.yLimite}" y2="${g.yLimite}"></line>
      <line class="umbral comodo" x1="0" x2="${g.ancho}" y1="${g.yComodo}" y2="${g.yComodo}"></line>
      ${marcaAhora ? `<line class="ahora" x1="${marcaAhora.x}" x2="${marcaAhora.x}" y1="0" y2="${g.alto}"></line>` : ''}
      <path class="rachas" d="${g.rachas}"></path>
      <path class="viento" d="${g.viento}"></path>
      ${etiquetas.map((m, i) => `<text${ancla(i)} x="${m.x}" y="${alto - 3}">${esc(hora(m.ms, p.zona))}</text>`).join('')}
    </svg>
    <figcaption class="nota"><span class="ley viento"></span> viento · <span class="ley rachas"></span> rachas · rayas: cómodo ${esc(fmtViento(umbralesViento(p).comodo, u))} y límite ${esc(fmtViento(umbralesViento(p).limite, u))}</figcaption>
  </figure>`;
}

// La tabla hora a hora, como la de UAV Forecast: una fila por hora y cada
// dato en su columna, con el color de su factor. Tocar una fila la abre.
const TORMENTA = new Set([95, 96, 99]);
const COLUMNAS = [
  { id: 'viento', titulo: 'Viento', celda: (h, u) => `${flecha(h.dirAlt)}${esc(partesViento(h.vientoAlt, u)[0])}` },
  { id: 'rachas', titulo: 'Racha', celda: (h, u) => esc(partesViento(h.rachaAlt, u)[0]) },
  { id: 'temperatura', titulo: '°C', celda: (h) => (Number.isFinite(h.temp) ? Math.round(h.temp) : '—') },
  { id: 'lluvia', titulo: 'Lluvia', celda: (h) => (TORMENTA.has(h.codigo) ? '⚡' : `${h.probLluvia ?? '—'}%`) },
  { id: 'techo', titulo: 'Nubes', celda: (h) => `${Number.isFinite(h.nubes) ? Math.round(h.nubes) : '—'}%` },
  { id: 'satelites', titulo: 'Sats', celda: (h) => esc(h.sats?.total ?? '—') },
  { id: 'kp', titulo: 'Kp', celda: (h) => (Number.isFinite(h.kp) ? Math.round(h.kp) : '—') },
];

function filaHora(h, p, abierta) {
  const ahora = Date.now();
  const u = p.ajustes.unidades;
  const porId = Object.fromEntries(h.factores.map((f) => [f.id, f.estado]));
  const clases = ['hora', h.estado, ahora >= h.ms && ahora < h.ms + 3600000 ? 'actual' : '', porId.luz !== 'ok' ? 'noche' : '', h === abierta ? 'abierta' : '']
    .filter(Boolean)
    .join(' ');
  const fila = `<tr class="${clases}" data-hora="${h.ms}">
    <th scope="row"><button type="button" aria-expanded="${h === abierta}" aria-label="${esc(hora(h.ms, p.zona))}: ${esc(ESTADOS[h.estado].texto)}">${esc(hora(h.ms, p.zona))}</button></th>
    <td class="t-estado"><span aria-hidden="true">${SIMBOLO[h.estado]}</span></td>
    ${COLUMNAS.map((c) => `<td class="e-${esc(porId[c.id] ?? 'sin-dato')}">${c.celda(h, u)}</td>`).join('')}
  </tr>`;
  if (h !== abierta) return fila;
  return `${fila}<tr class="fila-detalle"><td colspan="${COLUMNAS.length + 2}"><div class="detalle-hora ${h.estado}">${bloquePerfil(h, p)}${listaCondiciones(h)}</div></td></tr>`;
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
  // Como en UAV Forecast, hoy empieza en la hora en curso: las pasadas ya no se vuelan.
  const ahora = Date.now();
  const horas = dia.horas.filter((h) => h.ms + 3600000 > ahora);
  const abierta = horas.find((h) => h.ms === estado.abierta);
  el.innerHTML = `<h2>Hora a hora <span class="nota">viento a ${esc(p.ajustes.altitud)} m en ${esc(partesViento(0, u)[1])}</span></h2>
    <div class="tabla-horas-marco">
      <table class="tabla-horas">
        <thead><tr><th scope="col">Hora</th><th scope="col"><span class="visualmente-oculto">Volar</span></th>${COLUMNAS.map((c) => `<th scope="col">${c.titulo}</th>`).join('')}</tr></thead>
        <tbody>${horas.map((h) => filaHora(h, p, abierta)).join('')}</tbody>
      </table>
    </div>
    <p class="nota pista-horas">Toca una hora para ver el detalle. En gris, las horas sin luz.</p>
    <details class="mas-grafica"><summary>Gráfica del viento del día</summary>${svgGrafica(dia, p)}</details>`;
}

function pintarChecklist() {
  const el = $('#checklist');
  el.hidden = estado.ajustes.modo !== 'profesional';
  if (el.hidden) return;
  const hoy = hoyLocal();
  let c = almacen.checklist();
  if (c.dia !== hoy) c = { dia: hoy, hechos: [] };
  const hechos = new Set(c.hechos);
  el.innerHTML = `<h2>Antes de despegar <span class="nota">${hechos.size}/${CHECKLIST.length}</span></h2>
    <ul class="lista-check">${CHECKLIST.map(
      (t, i) => `<li><label class="casilla"><input type="checkbox" data-check="${i}" ${hechos.has(i) ? 'checked' : ''}> ${esc(t)}</label></li>`,
    ).join('')}</ul>
    <p class="nota">Se vacía sola cada día.</p>`;
}

// No se pisa un campo que se está escribiendo (el que tiene el foco).
function ponerValor(sel, v) {
  const el = $(sel);
  if (el !== document.activeElement) el.value = v;
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
  // Agrupados por marca, en el orden de la lista.
  const marcas = [...new Set(DRONES.map((d) => d.marca))];
  ponerOpciones(
    selDron,
    marcas
      .map(
        (m) =>
          `<optgroup label="${esc(m)}">${DRONES.filter((d) => d.marca === m)
            .map((d) => `<option value="${esc(d.id)}">${esc(d.nombre)}</option>`)
            .join('')}</optgroup>`,
      )
      .join('') + '<option value="personalizado">Personalizado…</option>',
  );
  selDron.value = a.dron;
  const misiones = MODOS[a.modo].misiones;
  $('#campo-mision').hidden = misiones.length < 2;
  const selMision = $('#sel-mision');
  ponerOpciones(selMision, misiones.map((id) => `<option value="${esc(id)}">${esc(MISIONES[id].nombre)}</option>`).join(''));
  selMision.value = a.mision;
  $('#desc-mision').textContent = MISIONES[a.mision].descripcion;
  // En categoría abierta el tope son 120 m; el modo profesional deja hasta 180.
  const alturas = [20, 30, 40, 50, 60, 80, 100, 120, ...(a.modo === 'profesional' ? [150, 180] : [])];
  if (!alturas.includes(a.altitud)) alturas.push(a.altitud);
  alturas.sort((x, y) => x - y);
  const selAlt = $('#sel-altitud');
  ponerOpciones(selAlt, alturas.map((x) => `<option value="${x}">${x} m</option>`).join(''));
  selAlt.value = String(a.altitud);
  $('#aj-unidades').value = a.unidades;
  ponerValor('#aj-margen', a.margenViento);
  ponerValor('#aj-sats', a.minSats);
  ponerValor('#aj-kp', a.maxKp);
  $('#aj-noche').checked = a.permitirNoche;
  ponerValor('#aj-interior', a.tempInterior);
  $('#campo-interior').hidden = a.mision !== 'termografia_edificios';
  $('#dron-personalizado').hidden = a.dron !== 'personalizado';
  ponerValor('#pz-viento', a.personalizado.maxViento);
  ponerValor('#pz-tmin', a.personalizado.tempMin);
  ponerValor('#pz-tmax', a.personalizado.tempMax);
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

function cambiarVista(v) {
  estado.vista = v;
  pintarVistas();
  window.scrollTo(0, 0);
}

function pintarVistas() {
  for (const v of ['prevision', 'diario', 'ajustes']) {
    $(`#vista-${v}`).hidden = estado.vista !== v;
    $(`#pestana-${v}`).setAttribute('aria-selected', String(estado.vista === v));
  }
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
  pintarVistas();
  pintarDiario();
  pintarPie();
}

function recargarTodo() {
  descargar();
  cargarEnaire();
  cargarKp().then((kp) => {
    estado.kp = kp;
    estado.kpDescargado = Date.now();
    pintar();
  });
}

// ---------- Diario de vuelos ----------

const NOMBRE_ESTADO = { ok: 'verde', precaucion: 'ámbar', no: 'rojo' };

function fecha(ms) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));
}

function pintarDiario() {
  const diario = diarioValido(almacen.diario());
  $('#diario-cuenta').textContent = diario.length ? `(${diario.length})` : '';
  if (!diario.length) {
    $('#diario-cuerpo').innerHTML =
      '<p class="nota">Aún no hay vuelos. Pulsa «He volado» al terminar: con el tiempo verás si el semáforo acierta con tu dron.</p>';
    return;
  }
  const r = resumenDiario(diario);
  const filas = ['ok', 'precaucion', 'no']
    .filter((e) => r[e].total)
    .map(
      (e) =>
        `<li>${chipEstado(e, `En ${NOMBRE_ESTADO[e]}`)} ${r[e].total} vuelo${r[e].total === 1 ? '' : 's'}: ${r[e].bien} bien · ${r[e].regular} regular · ${r[e].mal} mal</li>`,
    )
    .join('');
  const u = estado.ajustes.unidades;
  $('#diario-cuerpo').innerHTML = `
    <ul class="resumen-diario">${filas}</ul>
    <ol class="lista-vuelos">${diario
      .slice(0, 30)
      .map(
        (e) => `<li>
          <div><strong>${esc(fecha(e.ms))}</strong> · ${esc(e.lugar.nombre)} ${chipEstado(e.prevision.estado, NOMBRE_ESTADO[e.prevision.estado] ?? '—')}
            <span class="valoracion-${esc(e.valoracion)}">${esc(VALORACIONES[e.valoracion])}</span></div>
          <div class="nota">${esc(e.dron)} · ${esc(e.altitud)} m · viento ${esc(fmtViento(e.prevision.vientoAlt, u))} · rachas ${esc(fmtViento(e.prevision.rachaAlt, u))}${e.nota ? ` · «${esc(e.nota)}»` : ''}</div>
          <button type="button" class="icono borrar" data-borrar-vuelo="${esc(e.id)}" aria-label="Borrar este vuelo">✕</button>
        </li>`,
      )
      .join('')}</ol>
    <div class="acciones"><button type="button" data-accion="exportar-diario">Exportar el diario (JSON)</button></div>`;
}

function abrirVuelo(ms) {
  const p = prevision();
  const h = p?.horas.find((x) => x.ms === ms);
  if (!h) return;
  estado.vueloMs = ms;
  $('#vuelo-prevision').textContent = `La app decía: ${ESTADOS[h.estado].texto.toLowerCase()} · viento ${fmtViento(h.vientoAlt, p.ajustes.unidades)} · rachas ${fmtViento(h.rachaAlt, p.ajustes.unidades)}`;
  $('#form-vuelo').reset();
  $('#dlg-vuelo').showModal();
}

function guardarVuelo(e) {
  e.preventDefault();
  const p = prevision();
  const h = p?.horas.find((x) => x.ms === estado.vueloMs);
  const valoracion = new FormData($('#form-vuelo')).get('valoracion');
  if (!h || !valoracion) return;
  const entrada = crearEntrada(p, h, estado.lugar, { valoracion, nota: $('#txt-vuelo').value, ms: Date.now() });
  almacen.guardarDiario(anadirEntrada(diarioValido(almacen.diario()), entrada));
  $('#dlg-vuelo').close();
  pintarDiario();
  cambiarVista('diario');
}

function exportarDiario() {
  const datos = JSON.stringify(diarioValido(almacen.diario()), null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([datos], { type: 'application/json' }));
  a.download = `diario-vuelos-${hoyLocal()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// ---------- Informe para el cliente ----------

function htmlInforme(p) {
  const dia = p.dias.find((d) => d.clave === estado.dia) ?? p.dias[0];
  const h = p.actual ?? dia.horas[0];
  const u = p.ajustes.unidades;
  const z = estado.enaire;
  const enaire = !z
    ? 'sin consultar'
    : z.estado === 'dentro'
      ? z.zonas.map((x) => `${x.nombre} (${x.capa}${x.restriccion ? `, ${x.restriccion}` : ''})`).join('; ')
      : z.estado === 'fuera'
        ? 'no consta en ninguna zona UAS'
        : 'no se pudo consultar';
  const v = dia.ventana;
  return `
    <h1>Condiciones de vuelo</h1>
    <p>${esc(estado.lugar.nombre)} (${esc(estado.lugar.lat.toFixed(5))}, ${esc(estado.lugar.lon.toFixed(5))}) · generado el ${esc(fecha(Date.now()))}</p>
    <table class="datos-informe">
      <tr><th>Misión</th><td>${esc(p.mision.nombre)}</td></tr>
      <tr><th>Dron</th><td>${esc(p.dron.nombre)} · altura ${esc(p.ajustes.altitud)} m</td></tr>
      <tr><th>Día</th><td>${esc(dia.clave)} · sol ${esc(hora(dia.sol.salida, p.zona))}–${esc(hora(dia.sol.puesta, p.zona))}</td></tr>
      <tr><th>Mejor ventana</th><td>${v ? `${esc(hora(v.inicio, p.zona))}–${esc(hora(v.fin, p.zona))} (${esc(NOMBRE_ESTADO[v.estado])})` : 'ninguna'}</td></tr>
      <tr><th>Zonas UAS (ENAIRE)</th><td>${esc(enaire)}</td></tr>
    </table>
    <h2>Hora a hora</h2>
    <table class="horas-informe">
      <tr><th>Hora</th><th>Semáforo</th><th>Viento</th><th>Rachas</th><th>Lluvia</th><th>Satélites</th></tr>
      ${dia.horas
        .map(
          (x) =>
            `<tr><td>${esc(hora(x.ms, p.zona))}</td><td>${esc(ESTADOS[x.estado].corto)}</td><td>${esc(fmtViento(x.vientoAlt, u))}</td><td>${esc(fmtViento(x.rachaAlt, u))}</td><td>${esc(x.probLluvia ?? '—')}%</td><td>${esc(x.sats?.total ?? '—')}</td></tr>`,
        )
        .join('')}
    </table>
    <h2>Factores a las ${esc(hora(h.ms, p.zona))}</h2>
    <table class="horas-informe">${h.factores
      .map((f) => `<tr><td>${esc(f.nombre)}</td><td>${esc(ESTADOS[f.estado].corto)}</td><td>${esc(f.valor)}</td><td>${esc(f.detalle)}</td></tr>`)
      .join('')}</table>
    <p class="nota">Fuentes: Open-Meteo, NOAA SWPC, CelesTrak, ENAIRE. Orientativo: la decisión y la responsabilidad del vuelo son del piloto.</p>`;
}

function imprimirInforme() {
  const p = prevision();
  if (!p || !estado.lugar) return;
  $('#informe').innerHTML = htmlInforme(p);
  window.print();
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
    enaire: estado.enaire,
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

const claveLugar = (l) => `${l.lat},${l.lon}`;

// «Hoy 10:00–14:00 · Mañana sin ventana», con el mismo motor y ajustes que la
// pantalla principal (dron, misión, altura), para cada favorito.
function resumenFavorito(l) {
  const c = estado.favMeteo.get(claveLugar(l));
  if (!c) return '<span class="resumen-fav nota">Calculando…</span>';
  if (c.error) return '<span class="resumen-fav nota">Sin previsión</span>';
  let dias;
  try {
    // Se recalcula solo si cambian los datos, los ajustes o la hora.
    const clave = [estado.kp, estado.gnss.satelites, estado.ajustes, horaEnCurso()];
    if (!c.memo || !c.memo.clave.every((x, i) => x === clave[i])) {
      c.memo = {
        clave,
        dias: resumenDias(
          construirPrevision({ meteo: c.meteo, kp: estado.kp, satelites: estado.gnss.satelites, lugar: l, ajustes: estado.ajustes }),
        ),
      };
    }
    dias = c.memo.dias;
  } catch {
    return '<span class="resumen-fav nota">Sin previsión</span>';
  }
  return `<span class="resumen-fav">${dias
    .map((d, k) => {
      const v = d.ventana;
      const e = v ? v.estado : 'no';
      return `<span class="chip ${e}">${k === 0 ? 'Hoy' : 'Mañana'} ${v ? `${esc(hora(v.inicio, c.meteo.zona))}–${esc(hora(v.fin, c.meteo.zona))}` : 'sin ventana'}</span>`;
    })
    .join(' ')}</span>`;
}

const FRESCO = 30 * 60000;

async function cargarResumenFavoritos() {
  const pendientes = estado.favoritos.filter((l) => {
    const c = estado.favMeteo.get(claveLugar(l));
    return !c || Date.now() - c.t > FRESCO;
  });
  await Promise.all(
    pendientes.map(async (l) => {
      try {
        estado.favMeteo.set(claveLugar(l), { meteo: await cargarSoloPrevision(l.lat, l.lon), t: Date.now() });
      } catch {
        estado.favMeteo.set(claveLugar(l), { error: true, t: Date.now() });
      }
    }),
  );
  if (pendientes.length && $('#dlg-lugar').open) pintarFavoritos();
}

function pintarFavoritos() {
  const es = (l) => estado.lugar && Math.abs(l.lat - estado.lugar.lat) < 1e-4 && Math.abs(l.lon - estado.lugar.lon) < 1e-4;
  const actualEsFav = estado.lugar && estado.favoritos.some(es);
  const items = estado.favoritos.map(
    (l, i) => `<li><button type="button" data-fav="${i}">${esc(l.nombre)} <span class="nota">${esc(l.zona)}</span>${resumenFavorito(l)}</button>
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
  cargarResumenFavoritos();
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
  $('#btn-recargar').addEventListener('click', recargarTodo);
  document.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => cambiarAjustes({ modo: b.dataset.modo })));
  $('#sel-dron').addEventListener('change', (e) => cambiarAjustes({ dron: e.target.value }));
  $('#sel-mision').addEventListener('change', (e) => cambiarAjustes({ mision: e.target.value }));
  $('#sel-altitud').addEventListener('change', (e) => cambiarAjustes({ altitud: Number(e.target.value) }));
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
    // Una fila de la tabla de horas se abre tocándola entera, no solo la hora.
    const fila = e.target.closest('tr[data-hora]');
    if (fila) {
      const ms = Number(fila.dataset.hora);
      estado.abierta = estado.abierta === ms ? null : ms;
      pintar();
      return;
    }
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.accion === 'lugar') abrirLugar();
    else if (b.dataset.accion === 'recargar') recargarTodo();
    else if (b.dataset.accion === 'volado') abrirVuelo(Number(b.dataset.ms));
    else if (b.dataset.accion === 'cerrar-vuelo') $('#dlg-vuelo').close();
    else if (b.dataset.accion === 'informe') imprimirInforme();
    else if (b.dataset.accion === 'exportar-diario') exportarDiario();
    else if (b.dataset.borrarVuelo) {
      almacen.guardarDiario(diarioValido(almacen.diario()).filter((e) => e.id !== b.dataset.borrarVuelo));
      pintarDiario();
    }
    else if (b.dataset.accion === 'gps') usarGPS();
    else if (b.dataset.vista) cambiarVista(b.dataset.vista);
    else if (b.dataset.dia) {
      estado.dia = b.dataset.dia;
      estado.abierta = null;
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
      cargarResumenFavoritos();
    }
  });
  $('#checklist').addEventListener('change', (e) => {
    const i = e.target.dataset.check;
    if (i === undefined) return;
    const hoy = hoyLocal();
    let c = almacen.checklist();
    if (c.dia !== hoy) c = { dia: hoy, hechos: [] };
    const hechos = new Set(c.hechos);
    if (e.target.checked) hechos.add(Number(i));
    else hechos.delete(Number(i));
    almacen.guardarChecklist({ dia: hoy, hechos: [...hechos] });
    pintarChecklist();
  });
  $('#form-vuelo').addEventListener('submit', guardarVuelo);
  $('#form-buscar').addEventListener('submit', (e) => {
    e.preventDefault();
    buscar($('#txt-buscar').value);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - estado.descargado > REFRESCO) descargar();
  });
  // Cada hora en punto cambia «ahora»: se repinta sin descargar.
  setInterval(tic, 60000);
}

// Cada minuto: repintar solo si ha cambiado la hora (no deshace lo que estás
// mirando) y, con la app a la vista, refrescar lo que tenga más de 30 min.
let horaPintada = horaEnCurso();

function tic() {
  if (horaEnCurso() !== horaPintada) {
    horaPintada = horaEnCurso();
    pintar();
  }
  if (document.visibilityState !== 'visible') return;
  if (estado.lugar && !estado.cargando && Date.now() - estado.descargado > REFRESCO) descargar();
  if (Date.now() - (estado.kpDescargado ?? 0) > 3 * 3600000) {
    estado.kpDescargado = Date.now();
    cargarKp().then((kp) => {
      estado.kp = kp;
      pintar();
    });
  }
}

async function arrancar() {
  // El instalador primero: si se cierra la app antes de que acabe todo lo
  // demás, que al menos quede para usarla sin cobertura.
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
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
  cargarEnaire();
  const [kp, gnss] = await Promise.all([cargarKp(), cargarSatelites(), descargar()]);
  estado.kp = kp;
  estado.kpDescargado = Date.now();
  estado.gnss = gnss;
  pintar();
}

arrancar();
