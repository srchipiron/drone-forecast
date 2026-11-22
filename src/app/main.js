// La interfaz. Pinta lo que devuelve construirPrevision(); no decide nada.

import { cielo } from '../motor/cielo.js';
import { capasNubes, celdasEnHora, luzNubes, textoCapas, urlWindyNubes } from '../motor/nubes.js';
import { celdasVeredicto, flechasViento, resumenVeredictos } from '../motor/rejilla.js';
import { sentidoDeslizar } from '../motor/gestos.js';
import { textoCompartir } from '../motor/compartir.js';
import { informeDiagnostico } from '../motor/diagnostico.js';
import { alturasZona, aplica, valorarZonas } from '../motor/enaire.js';
import { VALORACIONES, anadirEntrada, crearEntrada, diarioCSV, diarioValido, resumenDiario } from '../motor/diario.js';
import { graficaDia } from '../motor/grafica.js';
import { DRONES } from '../motor/drones.js';
import { MISIONES, MODOS } from '../motor/misiones.js';
import { MARGEN_DIARIO, MAXIMO_PLANES, NOMBRE_ESTADO, anadirPlan, crearPlan, cuandoPlan, empeora, fasePlan, fijarAjustesPlanes, huecosPlan, icsPlan, planesValidos, valorarPlan } from '../motor/planificado.js';
import { construirPrevision, normalizarAjustes, resumenDias } from '../motor/prevision.js';
import { fmtHora as hora, fmtViento } from '../motor/unidades.js';
import { umbralesViento } from '../motor/veredicto.js';
import { perfilViento } from '../motor/viento.js';
import { VERSION } from '../version.js';
import { almacen } from './almacen.js';
import { ETIQUETA, INTERVALO, comprobarAvisos } from './aviso.js';
import { crearMapa } from './mapa.js';
import { ampliarCaja, cajaDentro } from '../motor/mapa.js';
import { buscarLugar, cargarKp, cargarPrevision, cargarSatelites, cargarFormasEnaire, cargarNubesAltura, cargarNubesRejilla, cargarRejillaVuelo, cargarSoloPrevision, consultarEnaire, leerDescarga } from './datos.js';
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
  correo: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  telefono: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  enlace: '<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
  termometro: '<path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0Z"/><path d="M12 10v6"/>',
  ojo: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  nube: '<path d="M7 15a5 5 0 1 1 9.6-2H17a3 3 0 0 1 0 6H8a4 4 0 0 1-1-4Z"/>',
  modelos: '<path d="M4 18 9 9l4 6 3-4 4 7M4 6h4M4 10h2"/>',
  mision: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="m8 12 3 3 5-6"/>',
  turbulencia: '<path d="M3 8c3-3 5 3 8 0s5-3 8 0M3 13c3-3 5 3 8 0s5-3 8 0M3 18c3-3 5 3 8 0"/>',
  tormenta: '<path d="M7 14a5 5 0 1 1 9.6-2H17a3 3 0 0 1 0 6h-1"/><path d="m12 13-2 4h3l-2 4"/>',
  hielo: '<path d="M12 2v20M4 7l16 10M20 7 4 17M9 4l3 2 3-2M9 20l3-2 3 2"/>',
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
  // Último día que el instalador miró los favoritos (aviso de ventana).
  avisoUltimo: '',
};

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
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
  sincronizarAviso();
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
  turbulencia: 'turbulencia',
  tormenta: 'tormenta',
  hielo: 'hielo',
};

// Flecha hacia donde SOPLA el viento: la dirección meteorológica dice de dónde
// viene, y la flecha base (hacia abajo) es justo el viento del norte, 0°.
function flecha(grados) {
  if (!Number.isFinite(grados)) return '';
  return `<svg class="flecha" viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(${Math.round(grados)} 12 12)"><path d="M12 4v16M6 14l6 6 6-6"/></g></svg>`;
}

// Las condiciones: primero lo que no está en verde (lo peor arriba), que es
// lo que hay que leer; lo que está en verde, plegado debajo con su cuenta.
const ORDEN_FACTOR = { no: 0, precaucion: 1, 'sin-dato': 2, ok: 3 };
function filaCondicion(f, h) {
  return `<li class="condicion ${f.estado}" data-factor="${esc(f.id)}">
        ${icono(ICONO_FACTOR[f.id] ?? 'mision')}
        <span class="c-nombre">${esc(f.nombre)}</span>
        <span class="c-valor">${f.id === 'viento' ? flecha(h.dirAlt) : ''}${esc(f.valor)}</span>
        <span class="c-marca" aria-hidden="true">${SIMBOLO[f.estado]}</span><span class="visualmente-oculto">${ESTADOS[f.estado].corto}</span>
        ${f.detalle && f.estado !== 'ok' ? `<span class="c-detalle">${esc(f.detalle)}</span>` : ''}
      </li>`;
}

function listaCondiciones(h) {
  const orden = [...h.factores].sort((a, b) => ORDEN_FACTOR[a.estado] - ORDEN_FACTOR[b.estado]);
  // «Sin dato» no decide la hora: va con las verdes, plegado.
  const malos = orden.filter((f) => f.estado === 'no' || f.estado === 'precaucion');
  const verdes = orden.filter((f) => f.estado === 'ok' || f.estado === 'sin-dato');
  const sinDato = verdes.some((f) => f.estado === 'sin-dato');
  const resumen = malos.length ? `${verdes.length} condiciones más, en verde${sinDato ? ' o sin dato' : ''}` : `Todas en verde${sinDato ? ' o sin dato' : ''} (${verdes.length})`;
  const plegadas = verdes.length ? `<details class="condiciones-verdes"><summary>${resumen}</summary><ul class="condiciones">${verdes.map((f) => filaCondicion(f, h)).join('')}</ul></details>` : '';
  return `${malos.length ? `<ul class="condiciones">${malos.map((f) => filaCondicion(f, h)).join('')}</ul>` : ''}${plegadas}`;
}

// «☀️ Despejado · 18 °C», como la cabecera de UAV Forecast.
function lineaCielo(h, conCapas = false) {
  const c = cielo(h.codigo, h.solElev >= -0.833);
  const t = Number.isFinite(h.temp) ? `${Math.round(h.temp)} °C` : '';
  if (!c && !t) return '';
  // Las capas de nubes y su luz, solo en el detalle de una hora (en el cartel estorban).
  const luz = conCapas ? luzNubes(h) : null;
  const capas = luz ? `<p class="nota luz-nubes">Nubes: bajas ${h.nubesBajas ?? '—'} % · medias ${h.nubesMedias ?? '—'} % · altas ${h.nubesAltas ?? '—'} %. ${esc(luz.texto)}.</p>` : '';
  return `<p class="cielo">${c ? `<span aria-hidden="true">${c.icono}</span> ${esc(c.texto)}` : ''}${c && t ? ' · ' : ''}${esc(t)}</p>${capas}`;
}

// «Próxima ventana»: la de hoy si queda; si no, el primer día con verde, y
// tocarla lleva a ese día en la tabla.
function filaProxima(p) {
  const x = p.proxima;
  const clase = x ? x.ventana.estado : 'no';
  if (!x) return `<li class="fila ventana-hoy no">${icono('ventana')}<span>Próxima ventana</span><strong>Ninguna en ${p.dias.length} días</strong></li>`;
  const texto = `${etiquetaDia(x.clave, x.k)} · ${hora(x.ventana.inicio, p.zona)}–${hora(x.ventana.fin, p.zona)}${x.ventana.estado === 'precaucion' ? ' · con precaución' : ''}`;
  return `<li class="fila ventana-hoy ${esc(clase)}">${icono('ventana')}<span>Próxima ventana</span>
    <strong><button type="button" class="enlace" data-dia="${esc(x.clave)}" data-ir="horas">${esc(texto)} ›</button></strong></li>`;
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
        ${lineaCielo(h)}
      </div>
    </div>
    ${h.estado === 'ok' ? '' : `<p class="razon">${esc(razon)}</p>`}
    <h2>Condiciones ahora</h2>
    ${listaCondiciones(h)}
    ${filaOtrosDrones(p)}
    <ul class="filas">
      ${filaProxima(p)}
      ${filaZonas(p)}
      <li class="fila sol">${icono('amanecer')}<span>Amanecer · ocaso</span>
        <strong>${esc(hora(hoy?.sol.salida, p.zona))} · ${esc(hora(hoy?.sol.puesta, p.zona))}</strong></li>
      <li class="fila sol">${icono('sol')}<span>Hora dorada</span>
        <strong>${esc(hora(hoy?.sol.doradaTarde, p.zona))}</strong></li>
    </ul>
    <div class="acciones acciones-ahora">
      <button type="button" data-accion="volado" data-ms="${h.ms}">He volado</button>
      <button type="button" data-accion="compartir">Compartir</button>
      <button type="button" data-accion="planificar">Planificar vuelo</button>
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

// ---------- Zonas UAS (ENAIRE) ----------

// Color de una zona: por lo dura que es su restricción; gris si a tu altura no te afecta.
const CLASE_NIVEL = { 3: 'no', 2: 'precaucion', 1: 'precaucion', 0: 'ok' };
const claseZona = (z) => (z.aplica === 'no' ? 'sin-dato' : (CLASE_NIVEL[z.restriccion.nivel] ?? 'precaucion'));

// `vistos`: los destacados ya enseñados (el CTR y la ATZ suelen repetir la misma frase).
function zonaHtml(z, altitud, vistos = new Set()) {
  const clase = claseZona(z);
  const chip = z.aplica === 'no' ? `No te afecta a ${altitud} m` : z.aplica === 'quiza' ? `¿${z.restriccion.texto}?` : z.restriccion.texto;
  const datos = [alturasZona(z), z.clase && !z.nombre.startsWith(z.clase) ? z.clase : '', z.motivos.join(', '), z.horario ?? ''].filter(Boolean);
  // Contactos que se tocan: correo, teléfono y los enlaces https del mensaje (ya filtrados en el motor).
  const contactos = [
    ...z.emails.map((e) => `<a class="contacto" href="mailto:${esc(e)}">${icono('correo')}<span>${esc(e)}</span></a>`),
    ...z.telefonos.map((t) => `<a class="contacto" href="tel:${esc(t.replace(/[^\d+]/g, ''))}">${icono('telefono')}<span>${esc(t)}</span></a>`),
    ...z.enlaces.map((e) => `<a class="contacto" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${icono('enlace')}<span>${esc(e.texto)}</span></a>`),
  ].join('');
  // Plegada: a la vista, qué pide, cómo se llama y de qué altura a qué altura;
  // al tocarla, lo que dice ENAIRE y a quién llamar.
  const destacado = z.aplica !== 'no' && z.destacado && !vistos.has(z.destacado) && vistos.add(z.destacado) ? `<p class="zona-destacado">${esc(z.destacado)}</p>` : '';
  return `<li class="zona ${clase}"><details>
    <summary><span class="zona-cabecera"><span class="chip ${clase}">${esc(chip)}</span> <strong>${esc(z.nombre)}</strong></span>
    <span class="zona-datos">${esc(datos.join(' · '))}</span></summary>
    ${destacado}
    ${contactos ? `<div class="zona-contactos">${contactos}</div>` : ''}
    ${z.texto.length ? `<div class="zona-texto">${z.texto.map((t) => `<p>${esc(t)}</p>`).join('')}</div>` : ''}
  </details></li>`;
}

// Lo que dice el resumen de arriba, y la fila corta del cartel.
function resumenZonasUAS(p) {
  const z = estado.enaire;
  const alt = p.ajustes.altitud;
  if (!z) return { clase: 'sin-dato', titulo: 'Consultando ENAIRE…', corto: 'Consultando…' };
  if (z.estado === 'error') return { clase: 'sin-dato', titulo: 'No se pudo consultar ENAIRE', sub: `Míralo en el ${MAPA_ENAIRE} antes de volar.`, corto: 'Sin datos' };
  const v = valorarZonas(z.zonas, { altitud: alt, elevacion: estado.meteo?.elevacion ?? null });
  const n = v.zonas.length;
  const k = v.afectan.length;
  const libre = v.libreHasta > 0 && v.libreHasta < alt ? ` Por debajo de ${v.libreHasta} m no te afecta ninguna.` : '';
  const quiza = v.afectan.some((x) => x.aplica === 'quiza') ? ' Alguna va referida al nivel del mar y no se pudo comprobar con el terreno: revísala.' : '';
  const plural = (x, s, p) => `${x} ${x === 1 ? s : p}`;
  let r;
  if (!n) r = { clase: 'ok', titulo: 'No consta en ninguna zona UAS', sub: `Revisa igualmente NOTAM y zonas temporales en el ${MAPA_ENAIRE}.`, corto: 'Sin zonas' };
  else if (!k) {
    const desde = Math.min(...v.zonas.map((x) => x.inferior.m ?? 0));
    r = { clase: 'ok', titulo: `A ${alt} m no te afecta ninguna zona UAS`, sub: `Aquí ${n === 1 ? 'hay una zona' : `hay ${n} zonas`}, pero empiezan más arriba (desde ${desde} m).`, corto: 'No te afecta' };
  } else if (v.peor.nivel >= 3) r = { clase: 'no', titulo: `Prohibido volar a ${alt} m`, sub: `${plural(k, 'zona te afecta', 'zonas te afectan')}.${libre}${quiza}`, corto: 'Prohibido' };
  else if (v.peor.nivel === 2) r = { clase: 'precaucion', titulo: `Necesitas autorización a ${alt} m`, sub: `${plural(k, 'zona te afecta', 'zonas te afectan')}.${libre}${quiza}`, corto: `Autorización (${k})` };
  else r = { clase: 'precaucion', titulo: `Vuelo con condiciones a ${alt} m`, sub: `${plural(k, 'zona te afecta', 'zonas te afectan')}.${libre}${quiza}`, corto: `Condiciones (${k})` };
  if (z.estado === 'incompleto' || z.fallidas?.length) r.sub = `${r.sub ?? ''} Alguna capa de ENAIRE no respondió: puede faltar alguna zona.`.trim();
  return { ...r, v };
}

function filaZonas(p) {
  const r = resumenZonasUAS(p);
  return `<li class="fila zonas-fila ${r.clase}">${icono('zona')}<span>Zonas UAS</span><strong><a class="enlace" href="#zonas">${esc(r.corto)} ›</a></strong></li>`;
}

function pintarZonas(p) {
  const el = $('#zonas');
  el.hidden = !estado.lugar || !p;
  if (el.hidden) return;
  const r = resumenZonasUAS(p);
  const alt = p.ajustes.altitud;
  const zonas = r.v?.zonas ?? [];
  const afectan = zonas.filter((z) => z.aplica !== 'no');
  const otras = zonas.filter((z) => z.aplica === 'no');
  const vistos = new Set();
  el.innerHTML = `<h2 id="titulo-zonas">Zonas UAS · ENAIRE</h2>
    <div class="zonas-resumen ${r.clase}">${icono('zona')}<div><p class="zonas-titulo">${esc(r.titulo)}</p>${r.sub ? `<p class="nota">${r.sub.includes('<a ') ? r.sub : esc(r.sub)}</p>` : ''}</div></div>
    ${afectan.length ? `<ul class="lista-zonas">${afectan.map((z) => zonaHtml(z, alt, vistos)).join('')}</ul>` : ''}
    ${otras.length ? `<details class="zonas-otras"><summary>${otras.length === 1 ? 'Una zona no te afecta' : `${otras.length} zonas no te afectan`} a ${alt} m</summary><ul class="lista-zonas">${otras.map((z) => zonaHtml(z, alt)).join('')}</ul></details>` : ''}
    ${zonas.length ? `<p class="nota">Las alturas y textos son de ENAIRE. Consulta también NOTAM y zonas temporales en el ${MAPA_ENAIRE}.</p>` : ''}`;
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
  const ahora = Date.now();
  el.innerHTML = p.dias
    .map((d, k) => {
      const v = d.ventana;
      const e = v ? v.estado : 'no';
      // Compacto para que quepan cuatro por fila: «10–14 h» (las ventanas van por horas enteras).
      const corta = v ? `${hora(v.inicio, p.zona).slice(0, 2)}–${hora(v.fin, p.zona).slice(0, 2).replace(/^00$/, '24')} h` : 'Sin vuelo';
      const larga = v ? `${hora(v.inicio, p.zona)}–${hora(v.fin, p.zona)}` : 'Sin ventana';
      const detalle = v ? `${larga}, ${v.horas} h${v.estado === 'precaucion' ? ' con precaución' : ''}` : 'sin ventana';
      return `<button type="button" class="dia ${e}${d.clave === estado.dia ? ' activo' : ''}" data-dia="${esc(d.clave)}" data-ventana="${esc(larga)}" aria-pressed="${d.clave === estado.dia}" aria-label="${esc(etiquetaDia(d.clave, k))}: ${esc(detalle)}">
        <span class="d-nombre">${esc(etiquetaDia(d.clave, k))}</span>
        <span class="d-ventana">${esc(corta)}</span>
        <span class="d-barra" aria-hidden="true">${d.horas.map((h) => `<i class="${esc(h.estado)}${h.ms + 3600000 <= ahora ? ' pasada' : ''}"></i>`).join('')}</span>
      </button>`;
    })
    .join('');
}

// Con «Mis drones» marcados: la ventana de cada día para cada uno de los
// otros. Tocar un día lo abre, como en la fila de arriba.
function pintarDiasDrones(p) {
  const caja = $('#dias-drones');
  const filas = p?.ventanasDrones ?? [];
  caja.hidden = !filas.length;
  if (!filas.length) return;
  const nombreDia = (clave, k) => (k === 1 ? 'Mañ.' : etiquetaDia(clave, k));
  caja.innerHTML = `<h2 id="titulo-dias-drones">Con tus otros drones</h2><ul class="lista-dias-drones">${filas
    .map(
      (f) => `<li><strong>${esc(f.nombre)}</strong><span class="dias-dron">${f.dias
        .map((d, k) => {
          const v = d.ventana;
          const rango = v ? `${hora(v.inicio, p.zona).slice(0, 2)}–${hora(v.fin, p.zona).slice(0, 2).replace(/^00$/, '24')} h` : '—';
          const detalle = v ? `${hora(v.inicio, p.zona)}–${hora(v.fin, p.zona)}${v.estado === 'precaucion' ? ' con precaución' : ''}` : 'sin ventana';
          return `<button type="button" class="chip ${v ? v.estado : 'no'}${d.clave === estado.dia ? ' activo' : ''}" data-dia="${esc(d.clave)}" data-ir="horas" aria-label="${esc(f.nombre)}, ${esc(etiquetaDia(d.clave, k))}: ${esc(detalle)}">${esc(nombreDia(d.clave, k))} ${esc(rango)}</button>`;
        })
        .join('')}</span></li>`,
    )
    .join('')}</ul>`;
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

// Las nubes del día por capas, como el mapa de nubes de Windy: una fila por
// capa (altas arriba, bajas abajo) y una celda por hora, más opaca cuanto
// más cubre. Con el enlace al mapa de Windy en ese punto.
function svgNubes(dia, p) {
  const c = capasNubes(dia.horas);
  if (!c.hay) return '';
  // En HTML, no en SVG: el texto sale nítido y a tamaño de leer, y las celdas
  // se reparten el ancho. La opacidad va por clases (la CSP no deja estilos
  // en línea): nd-0 … nd-10, de 10 en 10 %.
  const nivel = (v) => (v === null ? 'nd-x' : `nd-${Math.round(v / 10)}`);
  const capas = [['altas', 'Altas'], ['medias', 'Medias'], ['bajas', 'Bajas']];
  const filas = capas
    .map(([k, t]) => `<span class="nd-capa">${t}</span><span class="nd-celdas">${c.horas.map((h) => `<i class="${nivel(h[k])}"></i>`).join('')}</span>`)
    .join('');
  const horas = c.horas.map((h, i) => `<span>${i % 6 === 0 ? esc(hora(h.ms, p.zona)) : ''}</span>`).join('');
  const resumen = capas.map(([k, t]) => {
    const vals = c.horas.map((h) => h[k]).filter((v) => v !== null);
    return vals.length ? `${t.toLowerCase()} hasta ${Math.max(...vals)} %` : null;
  }).filter(Boolean).join(', ');
  return `<figure class="nubes-dia">
    <div class="nd-rejilla" role="img" aria-label="Nubes a lo largo del día: ${esc(resumen)}">${filas}<span></span><span class="nd-horas">${horas}</span></div>
    <figcaption class="nota">Más oscuro, más cubierto. Bajas: tapan y dan luz plana. Altas (cirros): dejan pasar el sol.
      <a href="${esc(urlWindyNubes(estado.lugar.lat, estado.lugar.lon))}" target="_blank" rel="noopener noreferrer">Mapa de nubes en Windy</a></figcaption>
  </figure>`;
}

// Nubes por altura (como el «airgram» de Windy): horas a lo ancho, altura
// sobre el suelo a lo alto, cada nivel más opaco cuanto más cubre, y tu
// altura de vuelo marcada. La escala de alturas es de raíz cuadrada: lo de
// abajo, que es lo que afecta al dron, se ve más grande.
const nubesAltura = { clave: '', horas: null, estado: 'nada', abierta: false };
const H_MAX = 9000;

function svgAltura(horas, p) {
  const ancho = 340;
  const izq = 44;
  const alto = 150;
  const y = (m) => Math.round((1 - Math.sqrt(Math.min(Math.max(m, 0), H_MAX) / H_MAX)) * alto * 10) / 10;
  const paso = (ancho - izq) / Math.max(1, horas.length);
  const porMs = new Map(nubesAltura.horas.map((h) => [h.ms, h.capas]));
  const celdas = horas
    .map((h, i) => {
      const capas = porMs.get(h.ms) ?? [];
      return capas
        .map((c, j) => {
          if (c.cobertura < 5) return '';
          const abajo = j === 0 ? 0 : (capas[j - 1].altura + c.altura) / 2;
          const arriba = j === capas.length - 1 ? c.altura + 500 : (c.altura + capas[j + 1].altura) / 2;
          return `<rect class="nube-altura" x="${(izq + i * paso).toFixed(1)}" y="${y(arriba)}" width="${(paso - 0.4).toFixed(1)}" height="${Math.max(0.5, y(abajo) - y(arriba)).toFixed(1)}" fill-opacity="${(c.cobertura / 100).toFixed(2)}"></rect>`;
        })
        .join('');
    })
    .join('');
  const marcas = [100, 1000, 2000, 5000]
    .map((m) => `<line class="rejilla" x1="${izq}" x2="${ancho}" y1="${y(m)}" y2="${y(m)}"></line><text x="0" y="${y(m) + 3}">${m >= 1000 ? `${m / 1000} km` : `${m} m`}</text>`)
    .join('');
  const alt = p.ajustes.altitud;
  const etiquetas = horas.map((h, i) => ({ h, i })).filter(({ i }) => i % 6 === 0);
  return `<svg viewBox="0 0 ${ancho} ${alto + 16}" role="img" aria-label="Nubes por altura a lo largo del día">
      ${marcas}${celdas}
      <line class="vuelo" x1="${izq}" x2="${ancho}" y1="${y(alt)}" y2="${y(alt)}"></line>
      ${etiquetas.map(({ h, i }) => `<text x="${(izq + i * paso).toFixed(1)}" y="${alto + 13}">${esc(hora(h.ms, p.zona))}</text>`).join('')}
    </svg>`;
}

function bloqueAltura(horas, p, abierta) {
  const clave = `${estado.lugar.lat},${estado.lugar.lon}`;
  let cuerpo = '';
  if (nubesAltura.clave !== clave || nubesAltura.estado === 'nada') cuerpo = '<p class="nota">Ábrelo para cargar las nubes por altura.</p>';
  else if (nubesAltura.estado === 'cargando') cuerpo = '<p class="nota">Cargando las nubes por altura…</p>';
  else if (nubesAltura.estado === 'error') cuerpo = '<p class="nota">No se pudieron descargar las nubes por altura.</p>';
  else {
    const h = abierta ?? horas[0];
    const capas = nubesAltura.horas.find((x) => x.ms === h?.ms)?.capas ?? [];
    cuerpo = `${svgAltura(horas, p)}
      <p class="nota"><span class="ley vuelo"></span> tu altura (${esc(p.ajustes.altitud)} m) · más oscuro, nube más densa.</p>
      <p class="capas-hora"><strong>${esc(hora(h.ms, p.zona))}:</strong> ${esc(textoCapas(capas, p.ajustes.altitud))}.</p>`;
  }
  return `<details class="mas-altura"${nubesAltura.abierta ? ' open' : ''}><summary>Nubes por altura (a qué altura y lo densas que son)</summary>${cuerpo}</details>`;
}

async function cargarAltura() {
  const clave = `${estado.lugar.lat},${estado.lugar.lon}`;
  if (nubesAltura.clave === clave && (nubesAltura.estado === 'listo' || nubesAltura.estado === 'cargando')) return;
  Object.assign(nubesAltura, { clave, estado: 'cargando', horas: null });
  pintarHoras(prevision());
  try {
    const horas = await cargarNubesAltura(estado.lugar.lat, estado.lugar.lon);
    if (nubesAltura.clave !== clave) return;
    Object.assign(nubesAltura, { horas, estado: 'listo' });
  } catch {
    if (nubesAltura.clave === clave) nubesAltura.estado = 'error';
  }
  pintarHoras(prevision());
}

// La tabla hora a hora, como la de UAV Forecast: una fila por hora y cada
// dato en su columna, con el color de su factor. Tocar una fila la abre.
const TORMENTA = new Set([95, 96, 99]);
const COLUMNAS = [
  { id: 'viento', titulo: 'Viento', celda: (h, u) => `${flecha(h.dirAlt)}${esc(partesViento(h.vientoAlt, u)[0])}` },
  { id: 'rachas', titulo: 'Racha', celda: (h, u) => esc(partesViento(h.rachaAlt, u)[0]) },
  { id: 'temperatura', titulo: '°C', celda: (h) => (Number.isFinite(h.temp) ? Math.round(h.temp) : '—') },
  { id: 'lluvia', titulo: 'Lluvia', celda: (h) => (TORMENTA.has(h.codigo) ? '⚡' : `${h.probLluvia ?? '—'}%`) },
  // El cielo con su icono, como UAV Forecast; el color de la celda es el del techo de nubes.
  {
    id: 'techo',
    titulo: 'Cielo',
    celda: (h) => {
      const c = cielo(h.codigo, h.solElev >= -0.833);
      return c ? `<span role="img" aria-label="${esc(c.texto)}" title="${esc(c.texto)}">${c.icono}</span>` : `${Number.isFinite(h.nubes) ? Math.round(h.nubes) : '—'}%`;
    },
  },
  { id: 'satelites', titulo: 'Sats', celda: (h) => esc(h.sats?.total ?? '—') },
  { id: 'kp', titulo: 'Kp', celda: (h) => (Number.isFinite(h.kp) ? Math.round(h.kp) : '—') },
];

function filaHora(h, p, abierta, ventana) {
  const ahora = Date.now();
  const u = p.ajustes.unidades;
  const porId = Object.fromEntries(h.factores.map((f) => [f.id, f.estado]));
  const enVentana = ventana && h.ms >= ventana.inicio && h.ms < ventana.fin;
  const clases = ['hora', h.estado, ahora >= h.ms && ahora < h.ms + 3600000 ? 'actual' : '', porId.luz !== 'ok' ? 'noche' : '', enVentana ? `en-ventana v-${ventana.estado}` : '', h === abierta ? 'abierta' : '']
    .filter(Boolean)
    .join(' ');
  const fila = `<tr class="${clases}" data-hora="${h.ms}">
    <th scope="row"><button type="button" aria-expanded="${h === abierta}" aria-label="${esc(hora(h.ms, p.zona))}: ${esc(ESTADOS[h.estado].texto)}">${esc(hora(h.ms, p.zona))}</button></th>
    <td class="t-estado"><span aria-hidden="true">${SIMBOLO[h.estado]}</span></td>
    ${COLUMNAS.map((c) => `<td class="e-${esc(porId[c.id] ?? 'sin-dato')}">${c.celda(h, u)}</td>`).join('')}
  </tr>`;
  if (h !== abierta) return fila;
  return `${fila}<tr class="fila-detalle"><td colspan="${COLUMNAS.length + 2}"><div class="detalle-hora ${h.estado}">${lineaCielo(h, true)}${bloquePerfil(h, p)}${listaCondiciones(h)}</div></td></tr>`;
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
  const k = p.dias.indexOf(dia);
  el.innerHTML = `<div class="horas-cabecera">
      <button type="button" class="icono" data-dia-paso="-1" aria-label="Día anterior"${k === 0 ? ' disabled' : ''}>‹</button>
      <h2>Hora a hora · <span class="dia-tabla">${esc(etiquetaDia(dia.clave, k))}</span></h2>
      <button type="button" class="icono" data-dia-paso="1" aria-label="Día siguiente"${k === p.dias.length - 1 ? ' disabled' : ''}>›</button>
    </div>
    <p class="nota unidades-horas">Viento a ${esc(p.ajustes.altitud)} m en ${esc(partesViento(0, u)[1])}. Desliza a los lados para cambiar de día.</p>
    <div class="tabla-horas-marco">
      <table class="tabla-horas">
        <thead><tr><th scope="col">Hora</th><th scope="col"><span class="visualmente-oculto">Volar</span></th>${COLUMNAS.map((c) => `<th scope="col">${c.titulo}</th>`).join('')}</tr></thead>
        <tbody>${horas.map((h) => filaHora(h, p, abierta, dia.ventana)).join('')}</tbody>
      </table>
    </div>
    <p class="nota pista-horas">Toca una hora para ver el detalle. En gris, las horas sin luz${dia.ventana ? '; con raya a la izquierda, la mejor ventana' : ''}.</p>
    ${bloqueAltura(horas, p, abierta)}
    ${svgNubes(dia, p) ? `<details class="mas-nubes" open><summary>Nubes del día: bajas, medias y altas</summary>${svgNubes(dia, p)}</details>` : ''}
    <details class="mas-grafica"><summary>Gráfica del viento del día</summary>${svgGrafica(dia, p)}</details>`;
}

// Pasar de día con las flechas o deslizando el dedo. La animación dice hacia
// dónde se ha ido (y se la salta quien pide menos movimiento, por CSS).
function cambiarDia(paso) {
  const p = prevision();
  if (!p) return;
  const k = p.dias.findIndex((d) => d.clave === estado.dia);
  const nuevo = p.dias[k + paso];
  if (!nuevo) return;
  estado.dia = nuevo.clave;
  estado.abierta = null;
  pintar();
  const el = $('#horas');
  el.classList.remove('entra-der', 'entra-izq');
  void el.offsetWidth; // reinicia la animación
  el.classList.add(paso > 0 ? 'entra-der' : 'entra-izq');
}

// Deslizar lo detectamos nosotros con touchstart/touchend: en algunos móviles
// el desplazamiento lateral del navegador no responde al dedo.
function alDeslizar(el, alPasar) {
  let ini = null;
  el.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches.length === 1 ? e.touches[0] : null;
      ini = t ? { x: t.clientX, y: t.clientY, ms: Date.now() } : null;
    },
    { passive: true },
  );
  el.addEventListener(
    'touchend',
    (e) => {
      if (!ini) return;
      const t = e.changedTouches[0];
      const paso = sentidoDeslizar(t.clientX - ini.x, t.clientY - ini.y, Date.now() - ini.ms);
      ini = null;
      if (paso) alPasar(paso);
    },
    { passive: true },
  );
  el.addEventListener('touchcancel', () => (ini = null), { passive: true });
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

// Ajustes → Mis drones: una casilla por dron de la lista (y el personalizado).
function pintarMisDrones() {
  const el = $('#lista-mis-drones');
  if (el.contains(document.activeElement)) return; // no se repinta bajo el dedo
  const mios = new Set(estado.ajustes.misDrones);
  el.innerHTML = [...DRONES, { id: 'personalizado', nombre: 'Personalizado' }]
    .map((d) => `<label class="casilla"><input type="checkbox" data-mi-dron="${esc(d.id)}"${mios.has(d.id) ? ' checked' : ''}> ${esc(d.nombre)}</label>`)
    .join('');
}

// En el cartel: el veredicto de ahora con cada uno de tus otros drones.
function filaOtrosDrones(p) {
  if (!p.otrosDrones.length) return '';
  return `<div class="otros-drones"><p class="nota">Ahora, con tus otros drones:</p><ul>${p.otrosDrones
    .map((d) => `<li>${chipEstado(d.estado, `${SIMBOLO[d.estado]} ${ESTADOS[d.estado].corto}`)} <span>${esc(d.nombre)}</span>${d.motivos.length ? ` <span class="nota">(${esc(d.motivos.join(', ').toLowerCase())})</span>` : ''}</li>`)
    .join('')}</ul></div>`;
}

function pintarPerfil() {
  const a = estado.ajustes;
  document.querySelectorAll('.modo [data-modo]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.modo === a.modo)));
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
  pintarZonas(p);
  pintarPlanes();
  pintarDias(p);
  pintarDiasDrones(p);
  pintarHoras(p);
  pintarChecklist();
  pintarVistas();
  pintarDiario();
  pintarMisDrones();
  pintarInstalar();
  pintarAvisoVentana();
  pintarPie();
}

function recargarTodo() {
  meteoPlanes.clear();
  descargar();
  cargarEnaire();
  cargarKp().then((kp) => {
    estado.kp = kp;
    estado.kpDescargado = Date.now();
    pintar();
  });
}

// ---------- Diario de vuelos ----------

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
    <div class="acciones"><button type="button" data-accion="exportar-csv">Exportar a hoja de cálculo (CSV)</button><button type="button" data-accion="exportar-diario">Copia de seguridad (JSON)</button></div>`;
}

function abrirVuelo(ms) {
  const p = prevision();
  const h = p?.horas.find((x) => x.ms === ms);
  if (!h) return;
  estado.vueloMs = ms;
  estado.vueloPlan = null;
  $('#vuelo-prevision').textContent = `La app decía: ${ESTADOS[h.estado].texto.toLowerCase()} · viento ${fmtViento(h.vientoAlt, p.ajustes.unidades)} · rachas ${fmtViento(h.rachaAlt, p.ajustes.unidades)}`;
  $('#form-vuelo').reset();
  $('#dlg-vuelo').showModal();
}

// Un vuelo planificado, al diario: con la previsión de SU peor hora (la que
// decidía), su lugar y su hora, no la de ahora.
function abrirVueloPlan(id) {
  const plan = planesGuardados().find((x) => x.id === id);
  if (!plan) return;
  const pp = previsionPlan(plan);
  const p = pp && pp !== 'error' ? pp : null;
  const rango = { ok: 0, precaucion: 1, no: 2 };
  const horas = (p?.horas ?? []).filter((x) => x.ms >= plan.ms && x.ms < plan.ms + plan.horas * 3600000);
  // Si la previsión ya no trae esas horas (de ayer), se guarda igual, sin datos.
  const h = horas.reduce((a, x) => (!a || (rango[x.estado] ?? 0) > (rango[a.estado] ?? 0) ? x : a), null) ?? {
    ms: plan.ms, estado: 'sin-dato', vientoAlt: null, rachaAlt: null, kp: null, sats: null, factores: [],
  };
  const pe = p ?? { dron: { nombre: DRONES.find((d) => d.id === plan.ajustes?.dron)?.nombre ?? '—' }, ajustes: { modo: plan.ajustes?.modo, altitud: plan.ajustes?.altitud ?? null, unidades: estado.ajustes.unidades }, mision: { nombre: '—' } };
  estado.vueloPlan = { id, p: pe, h, lugar: plan.lugar, ms: plan.ms };
  const u = pe.ajustes.unidades ?? estado.ajustes.unidades;
  $('#vuelo-prevision').textContent = `${cuandoPlan(plan)} · ${plan.lugar.nombre}. ${
    h.estado === 'sin-dato' ? 'La previsión de esas horas ya no está.' : `La app decía: ${ESTADOS[h.estado].texto.toLowerCase()} · viento ${fmtViento(h.vientoAlt, u)} · rachas ${fmtViento(h.rachaAlt, u)}`
  }`;
  $('#form-vuelo').reset();
  if (plan.nota) $('#txt-vuelo').value = plan.nota;
  $('#dlg-vuelo').showModal();
}

// ---------- Vuelos planificados ----------

// Los de la tarjeta: los que vienen y los terminados hace menos de MARGEN_DIARIO.
const planesGuardados = () => planesValidos(almacen.planes(), Date.now(), MARGEN_DIARIO);
const mismoSitio = (a, b) => Boolean(a && b) && Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lon - b.lon) < 1e-4;
// Los planes se juzgan COMO EL INSTALADOR que avisa en segundo plano: con
// el dron y la altura del plan y sin el acuerdo entre modelos (que el
// instalador no descarga). Si no, la tarjeta diría «ha empeorado» por cosas
// que nunca llegarían como aviso, o al revés.
const memoPlanes = new Map();
function previsionParaPlan(meteo, lugar, ajustes) {
  const clave = JSON.stringify([lugar.lat, lugar.lon, ajustes, horaEnCurso()]);
  const m = memoPlanes.get(clave);
  if (m && m.meteo === meteo && m.kp === estado.kp && m.sats === estado.gnss.satelites) return m.valor;
  const valor = construirPrevision({ meteo, kp: estado.kp, satelites: estado.gnss.satelites, lugar, ajustes });
  if (memoPlanes.size > 40) memoPlanes.clear();
  memoPlanes.set(clave, { meteo, kp: estado.kp, sats: estado.gnss.satelites, valor });
  return valor;
}

// Previsión de los lugares de los planes que no son el de la pantalla: una
// descarga por lugar, que caduca como la de la pantalla (REFRESCO). La app
// puede seguir abierta días en Android: sin caducar, la tarjeta y el informe
// para el cliente enseñarían una previsión vieja.
const meteoPlanes = new Map();

function previsionPlan(plan) {
  const ajustes = plan.ajustes ?? estado.ajustes;
  if (mismoSitio(plan.lugar, estado.lugar)) return estado.meteo ? previsionParaPlan(estado.meteo, plan.lugar, ajustes) : null;
  const clave = `${plan.lugar.lat},${plan.lugar.lon}`;
  const m = meteoPlanes.get(clave);
  if (!m || (m.estado !== 'cargando' && Date.now() - m.ms > REFRESCO)) {
    meteoPlanes.set(clave, { estado: 'cargando', meteo: m?.meteo ?? null, ms: Date.now() });
    cargarSoloPrevision(plan.lugar.lat, plan.lugar.lon)
      .then((meteo) => meteoPlanes.set(clave, { estado: 'listo', meteo, ms: Date.now() }))
      .catch(() => meteoPlanes.set(clave, { estado: 'error', meteo: null, ms: Date.now() }))
      .finally(() => pintarPlanes());
  }
  const actual = meteoPlanes.get(clave);
  if (actual.meteo) return previsionParaPlan(actual.meteo, plan.lugar, ajustes);
  return actual.estado === 'error' ? 'error' : null;
}

function textoValoracion(val) {
  if (val.estado === 'sin-prevision') return val.cubiertas ? 'La previsión aún no llega a todas las horas' : 'Aún sin previsión para ese día';
  const nombre = NOMBRE_ESTADO[val.estado];
  return `${nombre[0].toUpperCase()}${nombre.slice(1)}${val.motivos.length ? `: ${val.motivos.join(', ').toLowerCase()}` : ''}`;
}

function pintarPlanes() {
  const caja = $('#planes');
  const planes = planesGuardados();
  caja.hidden = !planes.length;
  if (!planes.length) return;
  const filas = planes.map((plan) => {
    const pp = previsionPlan(plan);
    const fase = fasePlan(plan, Date.now());
    const val = pp && pp !== 'error' && fase !== 'terminado' ? valorarPlan(plan, pp) : null;
    const txt =
      fase === 'terminado' ? 'Terminado: ¿cómo ha ido?' : pp === 'error' ? 'No se pudo descargar la previsión' : val ? `${fase === 'en-marcha' ? 'En marcha · ' : ''}${textoValoracion(val)}` : 'Mirando la previsión…';
    const peor = val && empeora(plan.estado, val.estado);
    return `<li class="plan e-${esc(fase === 'terminado' ? 'terminado' : (val?.estado ?? 'sin-dato'))}">
      <div><strong>${esc(cuandoPlan(plan))}</strong> · ${esc(plan.lugar.nombre)}${pp && pp !== 'error' ? ` · ${esc(pp.dron.nombre)} a ${esc(pp.ajustes.altitud)} m` : ''}${plan.nota ? ` · «${esc(plan.nota)}»` : ''}</div>
      <div class="estado-plan">${esc(txt)}</div>
      ${peor ? `<div class="empeora">Ha empeorado: al planificarlo estaba en ${esc(NOMBRE_ESTADO[plan.estado])}.</div>` : ''}
      <button type="button" class="icono" data-borrar-plan="${esc(plan.id)}" aria-label="Borrar el plan del ${esc(cuandoPlan(plan))}">✕</button>
      <div class="acciones-plan">${
        fase === 'pendiente'
          ? `<button type="button" class="enlace" data-calendario-plan="${esc(plan.id)}">Al calendario</button>${val && val.estado !== 'sin-prevision' ? `<button type="button" class="enlace" data-informe-plan="${esc(plan.id)}">Informe para el cliente</button>` : ''}`
          : `<button type="button" class="enlace" data-volado-plan="${esc(plan.id)}">${fase === 'terminado' ? 'Guardar en el diario' : 'He volado'}</button>`
      }</div>
    </li>`;
  });
  const aviso = !CON_AVISO
    ? 'Este navegador no deja avisar en segundo plano: mira aquí antes del vuelo.'
    : almacen.aviso()
      ? 'Si la previsión de un plan empeora, te llega una notificación.'
      : 'Para que te avise si empeora aunque no abras la app, activa el aviso en Ajustes.';
  caja.innerHTML = `<h2 id="titulo-planes">Vuelos planificados</h2><ul class="lista-planes">${filas.join('')}</ul><p class="nota">${esc(aviso)}</p>`;
}

// El plan como .ics: con «Compartir» del móvil si deja mandar ficheros (al
// calendario o al cliente por WhatsApp o correo); si no, se descarga.
async function planAlCalendario(id) {
  const plan = planesGuardados().find((x) => x.id === id);
  if (!plan) return;
  const pp = previsionPlan(plan);
  const ics = icsPlan(plan, pp && pp !== 'error' ? valorarPlan(plan, pp) : null);
  const nombre = `vuelo-${new Date(plan.ms).toISOString().slice(0, 10)}.ics`;
  const fichero = typeof File === 'function' ? new File([ics], nombre, { type: 'text/calendar' }) : null;
  try {
    if (fichero && navigator.canShare?.({ files: [fichero] })) {
      await navigator.share({ files: [fichero], title: `Vuelo · ${plan.lugar.nombre}` });
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return; // cerró el menú de compartir
    estado.fallo = `Calendario: ${e?.message ?? e}`;
  }
  bajarFichero(ics, 'text/calendar;charset=utf-8', nombre);
}

// Informe de un plan. Las zonas de ENAIRE son las de SU punto: si no es el
// de la pantalla, se preguntan a ENAIRE en el momento.
async function informePlan(id, boton) {
  const plan = planesGuardados().find((x) => x.id === id);
  const pp = plan && previsionPlan(plan);
  if (!pp || pp === 'error') return;
  const aqui = mismoSitio(plan.lugar, estado.lugar);
  let enaireZonas = estado.enaire;
  if (!aqui) {
    boton.textContent = 'Preguntando a ENAIRE…';
    enaireZonas = await consultarEnaire(plan.lugar.lat, plan.lugar.lon).catch(() => ({ estado: 'error' }));
  }
  const elevacion = aqui ? (estado.meteo?.elevacion ?? null) : (meteoPlanes.get(`${plan.lugar.lat},${plan.lugar.lon}`)?.meteo?.elevacion ?? null);
  $('#informe').innerHTML = htmlInforme(pp, { plan, enaireZonas, elevacion });
  boton.textContent = 'Informe para el cliente';
  window.print();
}

function abrirPlan() {
  const p = prevision();
  if (!p || !estado.lugar) return;
  $('#form-plan').reset();
  $('#plan-lugar').textContent = `En ${estado.lugar.nombre}, con ${p.dron.nombre} a ${p.ajustes.altitud} m.`;
  const k = Math.max(0, p.dias.findIndex((d) => d.clave === estado.dia));
  $('#plan-dia').innerHTML = p.dias.map((d, i) => `<option value="${i}"${i === k ? ' selected' : ''}>${esc(etiquetaDia(d.clave, i))}</option>`).join('');
  horasPlan(p);
  $('#dlg-plan').showModal();
}

// Las horas del día elegido (las que quedan, si es hoy), empezando por la ventana si la hay.
function horasPlan(p = prevision()) {
  const d = p?.dias[Number($('#plan-dia').value)];
  if (!d) return;
  const horas = d.horas.filter((h) => h.ms + 3600000 > Date.now());
  const elegida = d.ventana?.inicio ?? horas[0]?.ms;
  $('#plan-hora').innerHTML = horas.map((h) => `<option value="${h.ms}"${h.ms === elegida ? ' selected' : ''}>${esc(hora(h.ms, p.zona))}</option>`).join('');
  previaPlan(p);
}

function planDelFormulario(p) {
  const ms = Number($('#plan-hora').value);
  if (!Number.isFinite(ms) || !ms) return null;
  const borrador = crearPlan({ ms, horas: Number($('#plan-horas').value), lugar: estado.lugar, zona: p.zona, nota: $('#plan-nota').value, ajustes: estado.ajustes });
  // La referencia de «empeora», calculada igual que la calculará el instalador.
  const val = valorarPlan(borrador, previsionPlan(borrador) ?? p);
  return { plan: { ...borrador, estado: val.estado in NOMBRE_ESTADO ? val.estado : null }, val };
}

function previaPlan(p = prevision()) {
  const r = p && planDelFormulario(p);
  $('#plan-previa').textContent = r ? `Ahora mismo: ${textoValoracion(r.val).toLowerCase()}.` : 'No quedan horas ese día.';
  pintarHuecos(p);
}

// Los huecos de la semana donde caben las horas pedidas; tocar uno lo elige.
function pintarHuecos(p = prevision()) {
  const caja = $('#plan-huecos');
  if (!p) return void (caja.innerHTML = '');
  const n = Number($('#plan-horas').value);
  const huecos = huecosPlan(p, n);
  const k = (clave) => p.dias.findIndex((d) => d.clave === clave);
  const elegido = Number($('#plan-hora').value);
  caja.innerHTML = !huecos.length
    ? `<p class="nota">En toda la previsión no hay ${n} h seguidas en las que se pueda volar.</p>`
    : `<p class="nota">${huecos[0].estado === 'ok' ? `Con ${n} h seguidas en verde:` : `Ningún día tiene ${n} h seguidas en verde; en ámbar:`}</p>
      <div class="huecos">${huecos
        .map((x) => `<button type="button" class="chip ${x.estado}${x.ms === elegido ? ' activo' : ''}" data-hueco="${x.ms}" data-hueco-dia="${k(x.clave)}">${esc(etiquetaDia(x.clave, k(x.clave)))} ${esc(hora(x.ms, p.zona))}</button>`)
        .join('')}</div>`;
}

function elegirHueco(b) {
  $('#plan-dia').value = b.dataset.huecoDia;
  horasPlan();
  $('#plan-hora').value = b.dataset.hueco;
  previaPlan();
}

function guardarPlan(e) {
  e.preventDefault();
  const p = prevision();
  const r = p && planDelFormulario(p);
  if (!r) return;
  const lista = planesGuardados();
  if (!lista.some((x) => x.id === r.plan.id) && lista.length >= MAXIMO_PLANES) {
    $('#plan-previa').textContent = `Ya tienes ${MAXIMO_PLANES} vuelos planificados: borra alguno para añadir otro.`;
    return;
  }
  almacen.guardarPlanes(anadirPlan(lista, r.plan, Date.now(), MARGEN_DIARIO));
  $('#dlg-plan').close();
  sincronizarAviso([r.plan.id]); // guardado otra vez: lo visto antes ya no vale
  pintarPlanes();
  $('#planes').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function guardarVuelo(e) {
  e.preventDefault();
  const vp = estado.vueloPlan;
  const p = vp ? vp.p : prevision();
  const h = vp ? vp.h : p?.horas.find((x) => x.ms === estado.vueloMs);
  const valoracion = new FormData($('#form-vuelo')).get('valoracion');
  if (!h || !valoracion) return;
  const entrada = crearEntrada(p, h, vp ? vp.lugar : estado.lugar, { valoracion, nota: $('#txt-vuelo').value, ms: vp ? vp.ms : Date.now() });
  almacen.guardarDiario(anadirEntrada(diarioValido(almacen.diario()), entrada));
  if (vp) {
    // Apuntado: el plan ya ha cumplido.
    almacen.guardarPlanes(planesGuardados().filter((x) => x.id !== vp.id));
    estado.vueloPlan = null;
    sincronizarAviso([vp.id]);
    pintarPlanes();
  }
  $('#dlg-vuelo').close();
  pintarDiario();
  cambiarVista('diario');
}

function bajarFichero(datos, tipo, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([datos], { type: tipo }));
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

function exportarDiario() {
  bajarFichero(JSON.stringify(diarioValido(almacen.diario()), null, 2), 'application/json', `diario-vuelos-${hoyLocal()}.json`);
}

function exportarCSV() {
  bajarFichero(diarioCSV(diarioValido(almacen.diario())), 'text/csv;charset=utf-8', `diario-vuelos-${hoyLocal()}.csv`);
}

// ---------- Informe para el cliente ----------

// El informe para el cliente: el del día que se mira (por defecto) o el de
// un vuelo planificado (sus horas, su lugar y sus zonas de ENAIRE).
function htmlInforme(p, { plan = null, enaireZonas = estado.enaire, elevacion = estado.meteo?.elevacion ?? null } = {}) {
  const lugar = plan?.lugar ?? estado.lugar;
  const fin = plan ? plan.ms + plan.horas * 3600000 : 0;
  const dia = (plan ? p.dias.find((d) => d.horas.some((x) => x.ms === plan.ms)) : p.dias.find((d) => d.clave === estado.dia)) ?? p.dias[0];
  const horas = plan ? p.horas.filter((x) => x.ms >= plan.ms && x.ms < fin) : dia.horas;
  const rango = { ok: 0, precaucion: 1, no: 2 };
  // Con un plan, los factores de su peor hora: es la que decide.
  const h = plan ? horas.reduce((a, x) => ((rango[x.estado] ?? 0) > (rango[a.estado] ?? 0) ? x : a), horas[0]) : (p.actual ?? dia.horas[0]);
  const u = p.ajustes.unidades;
  const z = enaireZonas;
  const enaire = !z
    ? 'sin consultar'
    : z.estado === 'dentro'
      ? valorarZonas(z.zonas, { altitud: p.ajustes.altitud, elevacion })
          .zonas.map((x) => `${x.nombre}: ${x.restriccion.texto.toLowerCase()}, ${alturasZona(x).toLowerCase()}${x.aplica === 'no' ? ` (no afecta a ${p.ajustes.altitud} m)` : ''}`)
          .join('; ')
      : z.estado === 'fuera'
        ? 'no consta en ninguna zona UAS'
        : 'no se pudo consultar';
  const v = dia.ventana;
  const val = plan ? valorarPlan(plan, p) : null;
  return `
    <h1>${plan ? 'Vuelo planificado' : 'Condiciones de vuelo'}</h1>
    <p>${esc(lugar.nombre)} (${esc(lugar.lat.toFixed(5))}, ${esc(lugar.lon.toFixed(5))}) · generado el ${esc(fecha(Date.now()))}</p>
    <table class="datos-informe">
      ${plan ? `<tr><th>Vuelo</th><td>${esc(cuandoPlan(plan))}${plan.nota ? ` · ${esc(plan.nota)}` : ''}</td></tr><tr><th>Previsión de esas horas</th><td>${esc(textoValoracion(val))}</td></tr>` : ''}
      <tr><th>Misión</th><td>${esc(p.mision.nombre)}</td></tr>
      <tr><th>Dron</th><td>${esc(p.dron.nombre)} · altura ${esc(p.ajustes.altitud)} m</td></tr>
      <tr><th>Día</th><td>${esc(dia.clave)} · sol ${esc(hora(dia.sol.salida, p.zona))}–${esc(hora(dia.sol.puesta, p.zona))}</td></tr>
      <tr><th>Mejor ventana</th><td>${v ? `${esc(hora(v.inicio, p.zona))}–${esc(hora(v.fin, p.zona))} (${esc(NOMBRE_ESTADO[v.estado])})` : 'ninguna'}</td></tr>
      <tr><th>Zonas UAS (ENAIRE)</th><td>${esc(enaire)}</td></tr>
    </table>
    <h2>${plan ? 'Las horas del vuelo' : 'Hora a hora'}</h2>
    <table class="horas-informe">
      <tr><th>Hora</th><th>Semáforo</th><th>Viento</th><th>Rachas</th><th>Lluvia</th><th>Satélites</th></tr>
      ${horas
        .map(
          (x) =>
            `<tr><td>${esc(hora(x.ms, p.zona))}</td><td>${esc(ESTADOS[x.estado].corto)}</td><td>${esc(fmtViento(x.vientoAlt, u))}</td><td>${esc(fmtViento(x.rachaAlt, u))}</td><td>${esc(x.probLluvia ?? '—')}%</td><td>${esc(x.sats?.total ?? '—')}</td></tr>`,
        )
        .join('')}
    </table>
    <h2>Factores a las ${esc(hora(h.ms, p.zona))}${plan && horas.length > 1 ? ' (la peor hora del vuelo)' : ''}</h2>
    <table class="horas-informe">${h.factores
      .map((f) => `<tr><td>${esc(f.nombre)}</td><td>${esc(ESTADOS[f.estado].corto)}</td><td>${esc(f.valor)}</td><td>${esc(f.detalle)}</td></tr>`)
      .join('')}</table>
    <p class="nota">Fuentes: Open-Meteo, NOAA SWPC, CelesTrak, ENAIRE. Orientativo: la decisión y la responsabilidad del vuelo son del piloto.</p>`;
}

// Compartir: el menú del móvil (WhatsApp, correo...) si lo hay; si no, al portapapeles.
async function compartir(boton) {
  const p = prevision();
  if (!p || !estado.lugar) return;
  const texto = textoCompartir(p, estado.lugar, location.href.split(/[?#]/)[0]);
  try {
    if (navigator.share) await navigator.share({ title: `Drone Forecast · ${estado.lugar.nombre}`, text: texto });
    else {
      await navigator.clipboard.writeText(texto);
      boton.textContent = 'Copiado';
      setTimeout(() => pintar(), 2000);
    }
  } catch (e) {
    // Cerrar el menú de compartir no es un fallo.
    if (e?.name !== 'AbortError') estado.fallo = `Compartir: ${e?.message ?? e}`;
  }
}

function imprimirInforme() {
  const p = prevision();
  if (!p || !estado.lugar) return;
  $('#informe').innerHTML = htmlInforme(p);
  window.print();
}

// ---------- Diagnóstico ----------

function textoDiagnostico(aviso = null) {
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
    aviso,
    error: [estado.error, estado.fallo].filter(Boolean).join(' | '),
    navegador: navigator.userAgent,
  });
}

async function abrirDiagnostico() {
  const texto = textoDiagnostico({ disponible: CON_AVISO, activo: almacen.aviso(), ultimo: estado.avisoUltimo });
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

// ---------- Instalar la app ----------

// Chrome avisa de que la app se puede instalar (beforeinstallprompt); se
// guarda el aviso para lanzarlo desde el botón en vez de esconderlo en el menú ⋮.
let invitacion = null;

const instalada = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

// Lo último que pasó al instalar (se queda aunque se repinte la pantalla).
let mensajeInstalar = '';

function pintarInstalar() {
  const el = $('#instalar');
  el.hidden = !invitacion && !instalada() && !mensajeInstalar;
  if (el.hidden) return;
  $('#btn-instalar').hidden = !invitacion;
  $('#estado-instalar').textContent =
    mensajeInstalar ||
    (invitacion
      ? 'Se abre desde la pantalla de inicio como una app más, sin la barra del navegador; funciona sin cobertura con la última previsión y permite el aviso de ventana.'
      : 'Instalada: ábrela desde el icono de la pantalla de inicio.');
}

async function instalar() {
  if (!invitacion) return;
  const i = invitacion;
  invitacion = null;
  await i.prompt();
  const { outcome } = await i.userChoice;
  mensajeInstalar =
    outcome === 'accepted'
      ? 'Instalando: en unos segundos tendrás el icono en la pantalla de inicio.'
      : 'Cancelado. Si cambias de idea, está en el menú ⋮ → «Instalar aplicación».';
  pintarInstalar();
}

// ---------- Aviso de ventana ----------

// Solo donde el navegador puede despertar a la app en segundo plano (Chrome
// de Android con la app instalada); en el resto la tarjeta no sale.
const CON_AVISO =
  'serviceWorker' in navigator &&
  'Notification' in window &&
  'periodicSync' in (window.ServiceWorkerRegistration?.prototype ?? {}) &&
  'showNotification' in (window.ServiceWorkerRegistration?.prototype ?? {});

// El instalador no ve lo guardado por la página: se le copia lo que necesita cada vez que cambia.
// olvidar: planes recién guardados o borrados, cuyo último estado visto ya
// no sirve de referencia (si no, un plan rojo que se vuelve a guardar en
// verde no avisaría al pasar a ámbar).
async function sincronizarAviso(olvidar = []) {
  if (!CON_AVISO) return;
  const antes = (await almacen.configAviso()) ?? {};
  // Para el Diagnóstico, que se monta sin esperas (el portapapeles no espera).
  estado.avisoUltimo = antes.ultimo ?? '';
  const vistos = Object.fromEntries(Object.entries(antes.vistos ?? {}).filter(([id]) => !olvidar.includes(id)));
  await almacen.guardarConfigAviso({ ultimo: antes.ultimo ?? '', vistos, activo: almacen.aviso(), ajustes: estado.ajustes, favoritos: estado.favoritos, planes: planesValidos(almacen.planes()) });
}

function pintarAvisoVentana(texto) {
  $('#avisos').hidden = !CON_AVISO;
  if (!CON_AVISO) return;
  const activo = almacen.aviso();
  $('#aj-aviso').checked = activo;
  const n = estado.favoritos.length;
  $('#estado-aviso').textContent =
    texto ??
    (!activo
      ? 'Mira tus favoritos un par de veces al día, con tu dron y tus ajustes, y te avisa si mañana alguno tiene horas en verde.'
      : n
        ? `Activo: mira ${n} favorito${n === 1 ? '' : 's'}. El móvil decide cuándo (suele ser una o dos veces al día) y avisa como mucho una vez al día.`
        : 'Activo, pero aún no tienes favoritos: guarda algún lugar con ☆ en el buscador de lugares.');
}

async function activarAviso(si) {
  const reg = await navigator.serviceWorker.getRegistration();
  if (si) {
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      pintarAvisoVentana('Sin permiso de notificaciones. Dalo en los ajustes del navegador (Configuración de sitios → Notificaciones) y vuelve a intentarlo.');
      $('#aj-aviso').checked = false;
      return;
    }
    try {
      if (!reg?.periodicSync) throw new Error('sin instalador');
      await reg.periodicSync.register(ETIQUETA, { minInterval: INTERVALO });
    } catch (e) {
      estado.fallo = `Aviso: ${e?.name ?? ''} ${e?.message ?? e}`.trim();
      pintarAvisoVentana('El navegador no deja mirar en segundo plano. Instala la app (menú ⋮ → «Instalar aplicación» o «Añadir a pantalla de inicio») y vuelve a activarlo.');
      $('#aj-aviso').checked = false;
      return;
    }
  } else await reg?.periodicSync?.unregister(ETIQUETA).catch(() => {});
  almacen.guardarAviso(si);
  await sincronizarAviso();
  pintarAvisoVentana();
}

async function probarAviso() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    pintarAvisoVentana('El instalador aún no está listo: recarga la app y prueba otra vez.');
    return;
  }
  if ((await Notification.requestPermission()) !== 'granted') {
    pintarAvisoVentana('Sin permiso de notificaciones: no se puede probar.');
    return;
  }
  await sincronizarAviso();
  pintarAvisoVentana('Mirando tus favoritos…');
  try {
    const r = await comprobarAvisos(reg, { forzar: true });
    const textos = {
      'sin-favoritos': 'No tienes favoritos: guarda algún lugar con ☆ en el buscador de lugares.',
      'sin-datos': 'No se pudo descargar la previsión de ningún favorito. ¿Hay cobertura?',
      avisado: 'Hecho: te ha llegado la notificación con las ventanas de mañana.',
      'sin-ventana': 'Hecho: mañana ningún favorito tiene ventana verde (te ha llegado la notificación que lo dice).',
    };
    pintarAvisoVentana(textos[r.estado] ?? r.estado);
  } catch (e) {
    estado.fallo = `Aviso: ${e?.message ?? e}`;
    pintarAvisoVentana(`No se pudo probar: ${e?.message ?? e}`);
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

// El mapa se crea al abrirlo (no antes: sin tamaño no sabe qué teselas pedir),
// centrado en el lugar actual o, si no hay, en el centro de la Península.
let mapa = null;
let puntoMapa = null;

// Las zonas de ENAIRE encima del mapa. Por debajo de este zoom el
// rectángulo abarca media España y la respuesta sería enorme (y el servicio
// corta en 300): se pide acercar.
const ZOOM_ZONAS = 9;
const formasMapa = { zonas: [], caja: null, zoom: 0, fallidas: [], cortadas: [], pidiendo: 0, estado: 'lejos', cancelar: null };
// Las zonas del punto tocado: se preguntan a ENAIRE por ESE punto (geometría
// exacta, como la tarjeta «Zonas UAS»), no se sacan de las formas del mapa,
// que están simplificadas para pintar (en zoom bajo borran zonas pequeñas),
// pueden ser de otra parte del mapa o venir cortadas por el tope.
const zonasPunto = { turno: 0, p: null, r: null };

function claseForma(z, alt) {
  return `zona-mapa n${z.restriccion.nivel}${aplica(z, alt, null) === 'no' ? ' sin-efecto' : ''}`;
}

function pintarFormasMapa() {
  if (!mapa) return;
  const alt = estado.ajustes.altitud;
  // Las que no te afectan, debajo; las más duras, encima.
  const orden = [...formasMapa.zonas].sort((a, b) => (aplica(b, alt, null) === 'no') - (aplica(a, alt, null) === 'no') || a.restriccion.nivel - b.restriccion.nivel);
  mapa.ponerFormas(orden.map((z) => ({ anillos: z.anillos, clase: claseForma(z, alt) })));
  const alt2 = `${alt} m`;
  const afectan = formasMapa.zonas.filter((z) => aplica(z, alt, null) !== 'no').length;
  const texto = {
    lejos: 'Acerca el mapa para ver las zonas de ENAIRE.',
    cargando: 'Cargando las zonas de ENAIRE…',
    error: 'No se pudieron cargar las zonas de ENAIRE. Mira el punto en la tarjeta «Zonas UAS» al elegirlo.',
    listo: !formasMapa.zonas.length
      ? 'Sin zonas de ENAIRE en esta parte del mapa.'
      : `Zonas de ENAIRE a la vista: ${formasMapa.zonas.length}; a ${alt2}, ${afectan === 0 ? 'ninguna te afecta' : afectan === 1 ? '1 te afecta' : `${afectan} te afectan`}.`,
  }[formasMapa.estado];
  const falta =
    formasMapa.estado !== 'listo'
      ? ''
      : (formasMapa.fallidas.length ? ` Faltan las capas: ${formasMapa.fallidas.join(', ')}.` : '') +
        (formasMapa.cortadas.length ? ` Hay más zonas de las que caben (${formasMapa.cortadas.join(', ')}): acerca el mapa para verlas todas.` : '');
  $('#zonas-mapa').textContent = texto + falta;
  pintarPuntoMapa();
}

// Qué zonas tocan el punto marcado, contadas a tu altura.
async function consultarPunto(p) {
  const turno = ++zonasPunto.turno;
  Object.assign(zonasPunto, { p, r: { estado: 'mirando' } });
  pintarPuntoMapa();
  const r = await consultarEnaire(p.lat, p.lon).catch(() => ({ estado: 'error', zonas: [], fallidas: [] }));
  if (turno !== zonasPunto.turno) return; // ya han tocado otro punto
  zonasPunto.r = r;
  pintarPuntoMapa();
}

function pintarPuntoMapa() {
  const caja = $('#punto-zonas');
  const { p, r } = zonasPunto;
  if (!p || !puntoMapa || p !== puntoMapa || !r) return void (caja.hidden = true);
  caja.hidden = false;
  const alt = estado.ajustes.altitud;
  const falta = r.fallidas?.length ? ` (no han respondido: ${r.fallidas.join(', ')})` : '';
  if (r.estado === 'mirando') return void (caja.innerHTML = '<li>Preguntando a ENAIRE por este punto…</li>');
  if (r.estado === 'error') return void (caja.innerHTML = '<li>No se pudo preguntar a ENAIRE por este punto. Mira la tarjeta «Zonas UAS» al elegirlo.</li>');
  if (!r.zonas?.length) {
    caja.innerHTML = r.estado === 'fuera' ? '<li>Fuera de las zonas de ENAIRE.</li>' : `<li>Ninguna zona en las capas que han respondido${esc(falta)}: no se puede decir que esté fuera.</li>`;
    return;
  }
  caja.innerHTML =
    valorarZonas(r.zonas, { altitud: alt, elevacion: null })
      .zonas.map((z) => {
        const efecto = z.aplica === 'no' ? `no te afecta a ${alt} m` : z.aplica === 'quiza' ? 'puede afectarte' : `te afecta a ${alt} m`;
        return `<li class="${claseForma(z, alt)}"><strong>${esc(z.nombre)}</strong> · ${esc(z.restriccion.texto)} · ${esc(alturasZona(z).toLowerCase())} · <em>${esc(efecto)}</em></li>`;
      })
      .join('') + (falta ? `<li>Puede haber más${esc(falta)}.</li>` : '');
}

async function verZonasMapa({ caja, zoom }) {
  if (zoom < ZOOM_ZONAS) {
    // Lo que estuviera en camino ya no sirve: que no llegue y pinte.
    formasMapa.pidiendo++;
    formasMapa.cancelar?.abort();
    Object.assign(formasMapa, { estado: 'lejos', zonas: [], caja: null, cancelar: null });
    return pintarFormasMapa();
  }
  // Lo ya pedido vale mientras la vista quepa dentro y no se haya acercado
  // tanto que la simplificación se note (dos niveles: 4 veces más detalle).
  if (formasMapa.estado === 'listo' && cajaDentro(caja, formasMapa.caja) && zoom < formasMapa.zoom + 2) return;
  const pedida = ampliarCaja(caja);
  const turno = ++formasMapa.pidiendo;
  formasMapa.cancelar?.abort(); // en 4G, no seguir bajando lo que ya no se mira
  const cancelar = typeof AbortController === 'function' ? new AbortController() : null;
  formasMapa.cancelar = cancelar;
  formasMapa.estado = 'cargando';
  pintarFormasMapa();
  // Un píxel en grados en este zoom: menos detalle no se vería.
  const r = await cargarFormasEnaire(pedida, Number((360 / (256 * 2 ** zoom)).toPrecision(2)), cancelar?.signal);
  if (turno !== formasMapa.pidiendo) return; // llegó tarde: hay otra más nueva
  // Con una capa caída o cortada no se da por pedida esta parte: al moverse
  // se vuelve a intentar.
  const completa = !r.fallidas.length && !r.cortadas.length;
  Object.assign(formasMapa, { zonas: r.zonas, fallidas: r.fallidas, cortadas: r.cortadas, caja: completa ? pedida : null, zoom, estado: r.error ? 'error' : 'listo', cancelar: null });
  pintarFormasMapa();
}

// El mapa del tiempo: una rejilla de 7 × 7 puntos sobre lo que se ve. O el
// semáforo de cada celda con tu dron («dónde se puede volar»), o las nubes
// de una capa (más oscuro, más cubierto), a la hora de la barra.
const nubesMapa = { celdas: null, caja: null, volar: null, cajaVolar: null, claveVolar: '', pidiendo: 0, vista: null, enCurso: null };
const NOMBRE_CAPA = { bajas: 'Nubes bajas', medias: 'Nubes medias', altas: 'Nubes altas' };

function cuandoMapa(ms) {
  const zona = prevision()?.zona;
  return `${new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', timeZone: zona }).format(new Date(ms))} a las ${hora(ms, zona)}`;
}

function pintarNubesMapa() {
  if (!mapa) return;
  const activo = $('#mapa-nubes').checked;
  $('#mapa-nubes-capa').disabled = !activo;
  $('#mapa-nubes-hora').disabled = !activo;
  const capa = $('#mapa-nubes-capa').value;
  const deVuelo = capa === 'volar' || capa === 'viento';
  const datos = deVuelo ? nubesMapa.volar : nubesMapa.celdas;
  mapa.ponerFlechas([]);
  if (!activo || !datos) {
    mapa.ponerCeldas([]);
    if (!activo) $('#mapa-nubes-texto').textContent = '';
    return;
  }
  const ms = Math.floor(Date.now() / 3600000) * 3600000 + Number($('#mapa-nubes-hora').value) * 3600000;
  if (capa === 'viento') {
    const u = estado.ajustes.unidades;
    const fl = flechasViento(datos, ms);
    mapa.ponerCeldas([]);
    mapa.ponerFlechas(fl.map((f) => ({ ...f, texto: partesViento(f.viento, u)[0], clase: `f-${f.estado}` })));
    const vs = fl.map((f) => f.viento);
    const rs = fl.map((f) => f.racha).filter(Number.isFinite);
    $('#mapa-nubes-texto').textContent = fl.length
      ? `Viento a ${estado.ajustes.altitud} m · ${cuandoMapa(ms)}: de ${fmtViento(Math.min(...vs), u)} a ${fmtViento(Math.max(...vs), u)}${rs.length ? `, rachas hasta ${fmtViento(Math.max(...rs), u)}` : ''}. Las flechas apuntan hacia donde va el viento; el color, como el semáforo con tu dron.`
      : `Sin previsión de viento para ${cuandoMapa(ms)}.`;
    return;
  }
  if (capa === 'volar') {
    const celdas = celdasVeredicto(datos, ms).filter((c) => c.estado);
    mapa.ponerCeldas(celdas.map((c) => ({ ...c, opacidad: 0.45, clase: `v-${c.estado}` })));
    const r = resumenVeredictos(celdas);
    const p = prevision();
    $('#mapa-nubes-texto').textContent = celdas.length
      ? `Dónde se puede volar${p ? ` con tu ${p.dron.nombre} a ${p.ajustes.altitud} m` : ''} · ${cuandoMapa(ms)}: ${r.ok} en verde, ${r.precaucion} en ámbar, ${r.no} en rojo${r.masRojo ? ` (el rojo, sobre todo por ${r.masRojo.toLowerCase()})` : ''}. Por el tiempo; las zonas de ENAIRE van aparte.`
      : `Sin previsión para ${cuandoMapa(ms)}.`;
    return;
  }
  const celdas = celdasEnHora(datos, capa, ms).filter((c) => c.cobertura !== null);
  mapa.ponerCeldas(celdas.map((c) => ({ ...c, opacidad: (c.cobertura / 100) * 0.75 })));
  const media = celdas.length ? Math.round(celdas.reduce((s, c) => s + c.cobertura, 0) / celdas.length) : null;
  $('#mapa-nubes-texto').textContent = `${NOMBRE_CAPA[capa]} · ${cuandoMapa(ms)}${media !== null ? ` · cubren de media un ${media} %` : ''}. Más oscuro, más cubierto.`;
}

async function verNubesMapa(v = nubesMapa.vista) {
  if (v) nubesMapa.vista = v;
  if (!$('#mapa-nubes').checked || !nubesMapa.vista) return pintarNubesMapa();
  const { caja, zoom } = nubesMapa.vista;
  if (zoom < 7) {
    Object.assign(nubesMapa, { celdas: null, volar: null });
    pintarNubesMapa();
    $('#mapa-nubes-texto').textContent = 'Acerca un poco el mapa para verlo.';
    return;
  }
  const volar = ['volar', 'viento'].includes($('#mapa-nubes-capa').value);
  // El semáforo depende de tu dron y tus ajustes: si cambian, se vuelve a pedir.
  const clave = JSON.stringify(estado.ajustes);
  const vale = volar ? nubesMapa.volar && nubesMapa.claveVolar === clave && cajaDentro(caja, nubesMapa.cajaVolar) : nubesMapa.celdas && cajaDentro(caja, nubesMapa.caja);
  if (vale) return pintarNubesMapa();
  // Si ya hay una descarga en camino que cubre esta vista, se espera a esa.
  const tipo = volar ? `volar:${clave}` : 'nubes';
  if (nubesMapa.enCurso && nubesMapa.enCurso.tipo === tipo && cajaDentro(caja, nubesMapa.enCurso.caja)) return;
  const pedida = ampliarCaja(caja, 0.25);
  const turno = ++nubesMapa.pidiendo;
  nubesMapa.enCurso = { tipo, caja: pedida, turno };
  $('#mapa-nubes-texto').textContent = volar ? 'Mirando el tiempo de toda la zona…' : 'Cargando el mapa de nubes…';
  try {
    if (volar) {
      const celdas = await cargarRejillaVuelo(pedida, { ajustes: estado.ajustes, kp: estado.kp });
      if (turno !== nubesMapa.pidiendo) return;
      Object.assign(nubesMapa, { volar: celdas, cajaVolar: pedida, claveVolar: clave });
    } else {
      const celdas = await cargarNubesRejilla(pedida);
      if (turno !== nubesMapa.pidiendo) return;
      Object.assign(nubesMapa, { celdas, caja: pedida });
    }
  } catch {
    if (turno !== nubesMapa.pidiendo) return;
    nubesMapa.enCurso = null;
    mapa.ponerCeldas([]);
    $('#mapa-nubes-texto').textContent = 'No se pudo descargar el mapa del tiempo.';
    return;
  } finally {
    if (nubesMapa.enCurso?.turno === turno) nubesMapa.enCurso = null;
  }
  pintarNubesMapa();
}

function abrirMapa() {
  const panel = $('#panel-mapa');
  panel.hidden = !panel.hidden;
  $('#btn-mapa').setAttribute('aria-expanded', String(!panel.hidden));
  if (panel.hidden) return;
  if (mapa) return pintarFormasMapa(); // la altura pudo cambiar desde la última vez
  const centro = estado.lugar ?? { lat: 40.2, lon: -3.7 };
  mapa = crearMapa($('#mapa'), {
    lat: centro.lat,
    lon: centro.lon,
    z: estado.lugar ? 13 : 6,
    alMarcar: (p) => {
      puntoMapa = p;
      $('#punto-mapa').textContent = `Punto: ${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`;
      $('#btn-usar-punto').disabled = false;
      consultarPunto(p);
    },
    alVer: (v) => {
      verZonasMapa(v);
      verNubesMapa(v);
    },
  });
}

function usarPuntoMapa() {
  if (!puntoMapa) return;
  const { lat, lon } = puntoMapa;
  ponerLugar({ nombre: 'Punto del mapa', zona: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) });
  $('#dlg-lugar').close();
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
  $('#btn-mapa').addEventListener('click', abrirMapa);
  alDeslizar($('#horas'), cambiarDia);
  alDeslizar($('#dias'), cambiarDia);
  $('#btn-usar-punto').addEventListener('click', usarPuntoMapa);
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
  document.querySelectorAll('.modo [data-modo]').forEach((b) => b.addEventListener('click', () => cambiarAjustes({ modo: b.dataset.modo })));
  $('#sel-dron').addEventListener('change', (e) => cambiarAjustes({ dron: e.target.value }));
  $('#sel-mision').addEventListener('change', (e) => cambiarAjustes({ mision: e.target.value }));
  $('#sel-altitud').addEventListener('change', (e) => cambiarAjustes({ altitud: Number(e.target.value) }));
  $('#aj-unidades').addEventListener('change', (e) => cambiarAjustes({ unidades: e.target.value }));
  $('#aj-pantalla').addEventListener('change', (e) => almacen.guardarPantalla(ponerPantalla(e.target.value)));
  const numero = (id, clave) => $(id).addEventListener('change', (e) => cambiarAjustes({ [clave]: Number(e.target.value) }));
  numero('#aj-margen', 'margenViento');
  numero('#aj-sats', 'minSats');
  numero('#aj-kp', 'maxKp');
  numero('#aj-interior', 'tempInterior');
  $('#aj-noche').addEventListener('change', (e) => cambiarAjustes({ permitirNoche: e.target.checked }));
  $('#lista-mis-drones').addEventListener('change', (e) => {
    const id = e.target.dataset.miDron;
    if (!id) return;
    const mios = new Set(estado.ajustes.misDrones);
    if (e.target.checked) mios.add(id);
    else mios.delete(id);
    cambiarAjustes({ misDrones: [...mios] });
  });
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
    else if (b.dataset.accion === 'planificar') abrirPlan();
    else if (b.dataset.accion === 'cerrar-plan') $('#dlg-plan').close();
    else if (b.dataset.hueco) elegirHueco(b);
    else if (b.dataset.calendarioPlan) planAlCalendario(b.dataset.calendarioPlan);
    else if (b.dataset.voladoPlan) abrirVueloPlan(b.dataset.voladoPlan);
    else if (b.dataset.informePlan) informePlan(b.dataset.informePlan, b);
    else if (b.dataset.borrarPlan) {
      almacen.guardarPlanes(planesGuardados().filter((x) => x.id !== b.dataset.borrarPlan));
      sincronizarAviso([b.dataset.borrarPlan]);
      pintarPlanes();
    }
    else if (b.dataset.accion === 'informe') imprimirInforme();
    else if (b.dataset.accion === 'compartir') compartir(b);
    else if (b.dataset.diaPaso) cambiarDia(Number(b.dataset.diaPaso));
    else if (b.dataset.accion === 'exportar-diario') exportarDiario();
    else if (b.dataset.accion === 'exportar-csv') exportarCSV();
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
      if (b.dataset.ir) $(`#${b.dataset.ir}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      sincronizarAviso();
    } else if (b.dataset.accion === 'guardar-fav') {
      estado.favoritos.push({ ...estado.lugar });
      almacen.guardarFavoritos(estado.favoritos);
      pintarFavoritos();
      sincronizarAviso();
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
  $('#form-plan').addEventListener('submit', guardarPlan);
  $('#mapa-nubes').addEventListener('change', () => verNubesMapa());
  $('#mapa-nubes-capa').addEventListener('change', () => verNubesMapa());
  $('#mapa-nubes-hora').addEventListener('input', pintarNubesMapa);
  // <details> no avisa con «click» fiable ni burbujea «toggle»: se escucha en captura.
  document.addEventListener(
    'toggle',
    (e) => {
      if (!e.target.matches?.('details.mas-altura')) return;
      nubesAltura.abierta = e.target.open;
      if (e.target.open) cargarAltura();
    },
    true,
  );
  $('#plan-dia').addEventListener('change', () => horasPlan());
  $('#plan-hora').addEventListener('change', () => previaPlan());
  $('#plan-horas').addEventListener('change', () => previaPlan());
  $('#aj-aviso').addEventListener('change', (e) => activarAviso(e.target.checked));
  $('#btn-probar-aviso').addEventListener('click', probarAviso);
  $('#btn-instalar').addEventListener('click', instalar);
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    invitacion = e;
    pintarInstalar();
  });
  window.addEventListener('appinstalled', () => {
    invitacion = null;
    mensajeInstalar = 'Instalada: ábrela desde el icono de la pantalla de inicio.';
    pintarInstalar();
  });
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

// Versión nueva: el instalador nuevo toma el control en cuanto se instala
// (skipWaiting + clients.claim), pero la página abierta sigue siendo la vieja
// hasta recargarla. Si ya había un instalador (no es la primera vez), se
// avisa con un botón en vez de recargar a mitad de algo. Y al volver a la app
// se pregunta si hay versión nueva (como mucho cada media hora): una app
// instalada que nunca se cierra si no, no se entera.
let ultimaComprobacion = 0;

function vigilarVersionNueva() {
  if (!('serviceWorker' in navigator)) return;
  const habiaControlador = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (habiaControlador) $('#actualizar').hidden = false;
  });
  $('#btn-actualizar').addEventListener('click', () => location.reload());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - ultimaComprobacion < REFRESCO) return;
    ultimaComprobacion = Date.now();
    navigator.serviceWorker
      .getRegistration()
      .then((r) => r?.update())
      .catch(() => {});
  });
}

// Pantalla: la del móvil, clara, oscura o «al sol». Va en <html data-theme>,
// que es lo que leen los colores de styles.css.
const PANTALLAS = ['auto', 'light', 'dark', 'sol'];
function ponerPantalla(v) {
  const valor = PANTALLAS.includes(v) ? v : 'auto';
  if (valor === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = valor;
  $('#aj-pantalla').value = valor;
  return valor;
}

async function arrancar() {
  ponerPantalla(almacen.pantalla());
  // Planes de antes de 0.29.1: se quedan con los ajustes de ahora (una vez).
  const migrados = fijarAjustesPlanes(almacen.planes(), estado.ajustes);
  if (migrados.cambiados) almacen.guardarPlanes(migrados.planes);
  // El instalador primero: si se cierra la app antes de que acabe todo lo
  // demás, que al menos quede para usarla sin cobertura.
  // Con aviso de ventana, el instalador de tipo módulo (lleva sw.js dentro);
  // en el resto, sw.js como siempre.
  if ('serviceWorker' in navigator)
    navigator.serviceWorker
      .register(CON_AVISO ? 'sw-modulo.js' : 'sw.js', CON_AVISO ? { type: 'module' } : undefined)
      .then(() => sincronizarAviso())
      .catch((e) => {
        estado.fallo = `Instalador: ${e?.message ?? e}`;
      });
  vigilarVersionNueva();
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
