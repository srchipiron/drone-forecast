// Planificador de trabajos: un encargo con su lugar, las fechas del permiso,
// el tipo de trabajo, el horario en que se puede volar y cuántas jornadas
// lleva. Con la previsión, elige los mejores días dentro del permiso:
// seguidos si el trabajo no se puede partir; sueltos (martes y jueves) si sí.

import { MODOS } from './misiones.js';
import { limpiarPuntos } from './traza.js';
import { porQueNo } from './ventanas.js';

const HORA = 3600000;
const RANGO = { ok: 0, precaucion: 1 };
export const MAXIMO_TRABAJOS = 30;
export const MAXIMO_JORNADAS = 10;
export const MAXIMO_HORAS_JORNADA = 8;
// Los tipos de trabajo son las misiones del modo profesional.
export const TIPOS_TRABAJO = MODOS.profesional.misiones;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const esFecha = (s) => typeof s === 'string' && FECHA.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
const entero = (v, min, max) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** Las fechas de un tramo, ambas incluidas («2026-11-24» … «2026-11-27»). */
export function fechasEntre(desde, hasta) {
  const salida = [];
  for (let ms = Date.parse(`${desde}T12:00:00Z`), fin = Date.parse(`${hasta}T12:00:00Z`); ms <= fin && salida.length < 400; ms += 24 * HORA)
    salida.push(new Date(ms).toISOString().slice(0, 10));
  return salida;
}

/**
 * Valida y normaliza un trabajo del formulario (o del almacén).
 * @returns {{trabajo: object} | {error: string}}
 */
export function crearTrabajo(d, ahora = Date.now()) {
  if (!d || typeof d !== 'object') return { error: 'Trabajo vacío' };
  const nombre = String(d.nombre ?? '').trim().slice(0, 80);
  if (!nombre) return { error: 'Ponle un nombre al trabajo (cliente u obra).' };
  const l = d.lugar;
  // Un punto, varios puntos o una traza: los dos últimos llevan su lista y
  // el lugar (para los vuelos planificados) es el primero.
  const forma = ['puntos', 'traza'].includes(l?.forma) ? l.forma : 'punto';
  const puntos = forma === 'punto' ? [] : limpiarPuntos(l.puntos);
  if (forma === 'puntos' && puntos.length < 2) return { error: 'Marca al menos dos puntos en el mapa (o elige «Un punto»).' };
  if (forma === 'traza' && puntos.length < 2) return { error: 'La traza necesita al menos dos puntos.' };
  const centro = puntos[0] ?? l;
  if (!centro || !Number.isFinite(centro.lat) || !Number.isFinite(centro.lon) || Math.abs(centro.lat) > 90 || Math.abs(centro.lon) > 180) return { error: 'Falta el sitio: búscalo, usa tu ubicación o tócalo en el mapa.' };
  if (!TIPOS_TRABAJO.includes(d.tipo)) return { error: 'Elige el tipo de trabajo.' };
  if (!esFecha(d.desde) || !esFecha(d.hasta)) return { error: 'Pon las fechas del permiso.' };
  if (d.hasta < d.desde) return { error: 'El permiso termina antes de empezar: revisa las fechas.' };
  const horaInicio = entero(d.horaInicio, 0, 23);
  const horaFin = entero(d.horaFin, 1, 24);
  if (horaInicio === null || horaFin === null || horaFin <= horaInicio) return { error: 'El horario tiene que acabar después de empezar.' };
  const horasJornada = entero(d.horasJornada, 1, MAXIMO_HORAS_JORNADA);
  if (horasJornada === null) return { error: `Cada jornada, de 1 a ${MAXIMO_HORAS_JORNADA} horas de vuelo.` };
  if (horasJornada > horaFin - horaInicio) return { error: `En el horario de ${horaInicio} a ${horaFin} h no caben ${horasJornada} h de vuelo.` };
  const jornadas = entero(d.jornadas, 1, MAXIMO_JORNADAS);
  if (jornadas === null) return { error: `De 1 a ${MAXIMO_JORNADAS} jornadas.` };
  const dias = fechasEntre(d.desde, d.hasta).length;
  if (jornadas > dias) return { error: `El permiso tiene ${dias} ${dias === 1 ? 'día' : 'días'}: no caben ${jornadas} jornadas.` };
  // El dron, la altura y la misión con que se juzga: los de ahora, en modo
  // profesional y con el tipo de trabajo como misión. Sin «Mis drones».
  const { misDrones: _fuera, ...resto } = d.ajustes && typeof d.ajustes === 'object' ? d.ajustes : {};
  const ajustes = JSON.parse(JSON.stringify({ ...resto, modo: 'profesional', mision: d.tipo }));
  return {
    trabajo: {
      id: typeof d.id === 'string' && d.id ? d.id.slice(0, 40) : `t${ahora.toString(36)}`,
      nombre,
      lugar: { nombre: String(l.nombre ?? '').slice(0, 120), lat: centro.lat, lon: centro.lon, ...(forma === 'punto' ? {} : { forma, puntos }) },
      tipo: d.tipo,
      desde: d.desde,
      hasta: d.hasta,
      horaInicio,
      horaFin,
      jornadas,
      horasJornada,
      fraccionable: jornadas > 1 && Boolean(d.fraccionable),
      // No comparte horas con ningún otro trabajo (p. ej. cuando vais los dos).
      exclusivo: Boolean(d.exclusivo),
      ajustes,
      // Los vuelos apuntados en «Vuelos planificados» desde este trabajo.
      planes: Array.isArray(d.planes) ? d.planes.filter((x) => typeof x === 'string').slice(0, MAXIMO_JORNADAS) : [],
    },
  };
}

/** Los trabajos guardados que siguen siendo válidos (lo que no, se descarta). */
export function trabajosValidos(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map((t) => crearTrabajo(t).trabajo)
    .filter(Boolean)
    .slice(0, MAXIMO_TRABAJOS);
}

const formatos = new Map();
function partesLocales(ms, zona) {
  let f = formatos.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
    formatos.set(zona, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { clave: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) };
}

/**
 * Un día del permiso: el primer tramo de `horasJornada` horas seguidas dentro
 * del horario, en verde si lo hay; si no, en ámbar. Sin tramo, el porqué.
 * @param {{clave: string, horas: object[]}} dia  un día de construirPrevision()
 */
export function valorarDia(dia, trabajo, zona, ahora = Date.now(), ocupado = []) {
  const enHorario = dia.horas.filter((h) => {
    const { hora } = partesLocales(h.ms, zona);
    return hora >= trabajo.horaInicio && hora < trabajo.horaFin;
  });
  const futuras = enHorario.filter((h) => h.ms + HORA > ahora);
  if (!futuras.length) return { clave: dia.clave, estado: 'no', porQue: enHorario.length ? 'ya pasó' : 'fuera de horario' };
  const n = trabajo.horasJornada;
  // Las horas en que ya vuela otro trabajo que no se puede solapar.
  const libre = (h) => !ocupado.some((o) => h.ms < o.fin && h.ms + HORA > o.inicio);
  const buscar = (vale, conLibre = true) => {
    for (let k = 0; k + n <= futuras.length; k++) {
      const tramo = futuras.slice(k, k + n);
      if (tramo.every((h, i) => vale(h.estado) && (!conLibre || libre(h)) && h.ms === tramo[0].ms + i * HORA)) return tramo;
    }
    return null;
  };
  const volable = (e) => e === 'ok' || e === 'precaucion';
  const verde = buscar((e) => e === 'ok');
  const tramo = verde ?? buscar(volable);
  if (!tramo && ocupado.length && buscar(volable, false)) return { clave: dia.clave, estado: 'no', porQue: 'otro trabajo' };
  if (!tramo) {
    // Quedan horas pero no seguidas: si alguna se puede volar, lo dice.
    const sueltas = futuras.some((h) => h.estado === 'ok' || h.estado === 'precaucion');
    return { clave: dia.clave, estado: 'no', porQue: (sueltas ? 'pocas horas' : porQueNo(futuras)) ?? 'pocas horas' };
  }
  const estado = verde ? 'ok' : 'precaucion';
  const motivos = verde ? [] : [...new Set(tramo.flatMap((h) => h.factores.filter((f) => f.estado === 'precaucion').map((f) => f.nombre)))];
  return { clave: dia.clave, estado, inicio: tramo[0].ms, fin: tramo[n - 1].ms + HORA, motivos };
}

const peorDe = (lista) => (lista.some((d) => d.estado === 'precaucion') ? 'precaucion' : 'ok');
const puntos = (lista) => lista.reduce((s, d) => s + RANGO[d.estado], 0);

/**
 * Organiza un trabajo con la previsión de su lugar.
 * @param {object} trabajo  crearTrabajo().trabajo
 * @param {{zona: string, dias: object[]}} p  construirPrevision() con los ajustes del trabajo
 * @returns {{estado: 'ok'|'precaucion'|'incompleto'|'pendiente'|'imposible'|'caducado',
 *   dias: object[], elegidos: object[], faltan: number, hastaPrevision: string|null}}
 *   dias: cada día del permiso que queda (ok, precaucion, no o sin-prevision);
 *   elegidos: las jornadas propuestas, por fecha.
 */
export function organizarTrabajo(trabajo, p, ahora = Date.now(), ocupado = []) {
  const hoy = partesLocales(ahora, p.zona).clave;
  const hastaPrevision = p.dias.at(-1)?.clave ?? null;
  if (trabajo.hasta < hoy) return { estado: 'caducado', dias: [], elegidos: [], faltan: trabajo.jornadas, hastaPrevision };
  const porClave = new Map(p.dias.map((d) => [d.clave, d]));
  const dias = fechasEntre(trabajo.desde > hoy ? trabajo.desde : hoy, trabajo.hasta).map((clave) => {
    const d = porClave.get(clave);
    // El último día de la previsión puede venir a medias: si no cubre el
    // horario entero, todavía no se sabe.
    const cubre = d && d.horas.some((h) => partesLocales(h.ms, p.zona).hora >= trabajo.horaFin - 1);
    return cubre ? valorarDia(d, trabajo, p.zona, ahora, ocupado) : { clave, estado: 'sin-prevision' };
  });
  const sinPrevision = dias.some((d) => d.estado === 'sin-prevision');
  const n = trabajo.jornadas;
  let elegidos = [];
  if (n === 1 || trabajo.fraccionable) {
    // Sueltos: los mejores días (verde antes que ámbar; a igualdad, antes).
    elegidos = dias
      .filter((d) => d.estado in RANGO)
      .sort((a, b) => RANGO[a.estado] - RANGO[b.estado] || (a.clave < b.clave ? -1 : 1))
      .slice(0, n)
      .sort((a, b) => (a.clave < b.clave ? -1 : 1));
  } else {
    // Seguidos: el tramo de n días volables con menos ámbar (a igualdad, antes).
    for (let k = 0; k + n <= dias.length; k++) {
      const tramo = dias.slice(k, k + n);
      if (tramo.every((d) => d.estado in RANGO) && (!elegidos.length || puntos(tramo) < puntos(elegidos))) elegidos = tramo;
    }
  }
  const faltan = n - elegidos.length;
  const estado = !faltan ? peorDe(elegidos) : sinPrevision ? (elegidos.length ? 'incompleto' : 'pendiente') : 'imposible';
  return { estado, dias, elegidos, faltan, hastaPrevision };
}

const GRAVEDAD = { ok: 0, 'sin-dato': 1, precaucion: 2, no: 3 };

/**
 * La previsión de una traza o de varios puntos: cada hora, la del punto
 * peor (si en un tramo no se puede, el trabajo ese rato no se puede). Cada
 * factor, el peor de todos los puntos; la temperatura, la más baja.
 * Solo las horas que tienen todos los puntos.
 * @param {Array<{zona: string, dias: object[]}>} lista  una construirPrevision() por punto
 */
export function combinarPrevisiones(lista) {
  if (lista.length === 1) return lista[0];
  const [primera, ...resto] = lista;
  const porMs = resto.map((p) => new Map(p.horas.map((h) => [h.ms, h])));
  const combinar = (h) => {
    const todas = [h, ...porMs.map((m) => m.get(h.ms))];
    if (todas.some((x) => !x)) return null;
    const peor = todas.reduce((a, b) => (GRAVEDAD[b.estado] > GRAVEDAD[a.estado] ? b : a));
    const factores = new Map();
    for (const x of todas)
      for (const f of x.factores) {
        const ya = factores.get(f.id);
        if (!ya || GRAVEDAD[f.estado] > GRAVEDAD[ya.estado]) factores.set(f.id, f);
      }
    const temps = todas.map((x) => x.temp).filter(Number.isFinite);
    return { ...peor, ms: h.ms, estado: peor.estado, factores: [...factores.values()], temp: temps.length ? Math.min(...temps) : peor.temp, puntoPeor: todas.indexOf(peor) };
  };
  const dias = primera.dias
    .map((d) => ({ ...d, horas: d.horas.map(combinar).filter(Boolean) }))
    .filter((d) => d.horas.length);
  return { ...primera, horas: dias.flatMap((d) => d.horas), dias, puntos: lista.length };
}

/**
 * Organiza todos los trabajos a la vez para que los que no se pueden solapar
 * no compartan horas con ningún otro. Va primero el permiso que antes acaba
 * (el más urgente); cada uno ve ocupadas las jornadas ya repartidas con las
 * que no puede coincidir (las de cualquiera si él es exclusivo; si no, las
 * de los exclusivos) y, si es exclusivo, también los vuelos planificados a
 * mano (`otros`).
 * @param {Array<{trabajo: object, p: object|null}>} lista  p null: aún sin previsión (no se organiza)
 * @param {{inicio: number, fin: number}[]} otros
 * @returns {Map<string, object>}  por id de trabajo, su organizarTrabajo()
 */
export function organizarTodos(lista, ahora = Date.now(), otros = []) {
  const orden = lista
    .filter((x) => x.p)
    .sort((a, b) => (a.trabajo.hasta < b.trabajo.hasta ? -1 : a.trabajo.hasta > b.trabajo.hasta ? 1 : a.trabajo.desde < b.trabajo.desde ? -1 : a.trabajo.desde > b.trabajo.desde ? 1 : a.trabajo.id < b.trabajo.id ? -1 : 1));
  const repartidas = [];
  const salida = new Map();
  for (const { trabajo, p } of orden) {
    const ocupado = trabajo.exclusivo ? [...repartidas, ...otros] : repartidas.filter((r) => r.exclusivo);
    const org = organizarTrabajo(trabajo, p, ahora, ocupado);
    salida.set(trabajo.id, org);
    for (const d of org.elegidos) repartidas.push({ inicio: d.inicio, fin: d.fin, exclusivo: trabajo.exclusivo });
  }
  return salida;
}

/** Los vuelos planificados de una propuesta: uno por jornada. */
export function planesDeTrabajo(trabajo, org) {
  return org.elegidos.map((d, k) => ({
    ms: d.inicio,
    horas: trabajo.horasJornada,
    nota: `${trabajo.nombre}${trabajo.jornadas > 1 ? ` · jornada ${k + 1} de ${trabajo.jornadas}` : ''}`,
  }));
}
