// Un mapa mínimo de OpenStreetMap para elegir el punto de vuelo: se arrastra
// con el dedo, se acerca con + y −, y tocar pone la marca. Sin librerías (la
// app no tiene dependencias) y sin estilos en línea en el HTML: las
// posiciones van por CSSOM (el.style), que la CSP sí deja.

import { TAM, ZOOM_MAX, ZOOM_MIN, aTesela, cajaVisible, puntoEnPixel, rutaAnillos, teselasVisibles } from '../motor/mapa.js';

const SVG = 'http://www.w3.org/2000/svg';

export const URL_TESELAS = 'https://tile.openstreetmap.org';

/**
 * @param {HTMLElement} caja  contenedor con tamaño (CSS)
 * @param {{lat: number, lon: number, z?: number, alMarcar: (p: {lat: number, lon: number}) => void,
 *   alVer?: (v: {caja: object, zoom: number}) => void}} op
 *   alVer: cuando la vista se queda quieta (al abrir, tras arrastrar o
 *   acercar), con el rectángulo que se ve: quien lo usa decide qué pedir.
 */
export function crearMapa(caja, { lat, lon, z = 12, alMarcar, alVer = () => {} }) {
  caja.innerHTML = `<div class="mapa-teselas"></div><svg class="mapa-nubes" aria-hidden="true"></svg><svg class="mapa-zonas" aria-hidden="true"></svg><svg class="mapa-flechas" aria-hidden="true"></svg><div class="mapa-marca" hidden></div>
    <div class="mapa-zoom"><button type="button" data-zoom="1" aria-label="Acercar">+</button><button type="button" data-zoom="-1" aria-label="Alejar">−</button></div>
    <p class="mapa-credito">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></p>`;
  const capa = caja.querySelector('.mapa-teselas');
  const marca = caja.querySelector('.mapa-marca');
  const svg = caja.querySelector('.mapa-zonas');
  const svgNubes = caja.querySelector('.mapa-nubes');
  const svgFlechas = caja.querySelector('.mapa-flechas');
  /** @type {{lat: number, lon: number, rumbo: number, texto: string, clase: string}[]} */
  let flechas = [];
  /** @type {{oeste: number, este: number, sur: number, norte: number, opacidad: number}[]} */
  let celdas = [];
  const imgs = new Map();
  /** @type {{anillos: number[][][], clase: string}[]} */
  let formas = [];
  let espera = 0;
  let fotograma = 0;
  let zoom = z;
  let c = aTesela(lat, lon, zoom);
  let marcado = null;

  function pintar() {
    const { width: ancho, height: alto } = caja.getBoundingClientRect();
    const vistas = new Set();
    for (const t of teselasVisibles(c.x, c.y, zoom, ancho, alto)) {
      const clave = `${t.z}/${t.i}/${t.y}`;
      vistas.add(clave);
      let img = imgs.get(clave);
      if (!img) {
        img = document.createElement('img');
        img.alt = '';
        img.draggable = false;
        img.src = `${URL_TESELAS}/${t.z}/${t.x}/${t.y}.png`;
        capa.append(img);
        imgs.set(clave, img);
      }
      img.style.transform = `translate(${t.izq}px, ${t.arriba}px)`;
    }
    for (const [clave, img] of imgs) if (!vistas.has(clave)) (img.remove(), imgs.delete(clave));
    pintarFormas(ancho, alto);
    pintarCeldas(ancho, alto);
    pintarFlechas(ancho, alto);
    marca.hidden = !marcado;
    if (marcado) {
      const m = aTesela(marcado.lat, marcado.lon, zoom);
      marca.style.transform = `translate(${Math.round((m.x - c.x) * TAM + ancho / 2)}px, ${Math.round((m.y - c.y) * TAM + alto / 2)}px)`;
    }
  }

  // Las zonas, un <path> por zona, reutilizados de una vez a otra. La regla
  // par-impar respeta los huecos de las zonas que los tienen.
  function pintarFormas(ancho, alto) {
    svg.setAttribute('width', String(Math.round(ancho)));
    svg.setAttribute('height', String(Math.round(alto)));
    const rutas = svg.children;
    formas.forEach((f, i) => {
      let r = rutas[i];
      if (!r) {
        r = document.createElementNS(SVG, 'path');
        r.setAttribute('fill-rule', 'evenodd');
        svg.append(r);
      }
      r.setAttribute('class', f.clase);
      r.setAttribute('d', rutaAnillos(f.anillos, c.x, c.y, zoom, ancho, alto));
    });
    while (rutas.length > formas.length) rutas[rutas.length - 1].remove();
  }

  // Las nubes: un rectángulo por celda de la rejilla, debajo de las zonas.
  function pintarCeldas(ancho, alto) {
    svgNubes.setAttribute('width', String(Math.round(ancho)));
    svgNubes.setAttribute('height', String(Math.round(alto)));
    const rects = svgNubes.children;
    celdas.forEach((k, i) => {
      let r = rects[i];
      if (!r) {
        r = document.createElementNS(SVG, 'rect');
        svgNubes.append(r);
      }
      r.setAttribute('class', `celda-nube${k.clase ? ` ${k.clase}` : ''}`);
      const a = aTesela(k.norte, k.oeste, zoom);
      const b = aTesela(k.sur, k.este, zoom);
      const x = (a.x - c.x) * TAM + ancho / 2;
      const y = (a.y - c.y) * TAM + alto / 2;
      r.setAttribute('x', x.toFixed(1));
      r.setAttribute('y', y.toFixed(1));
      r.setAttribute('width', ((b.x - a.x) * TAM).toFixed(1));
      r.setAttribute('height', ((b.y - a.y) * TAM).toFixed(1));
      r.setAttribute('fill-opacity', k.opacidad.toFixed(2));
    });
    while (rects.length > celdas.length) rects[rects.length - 1].remove();
  }

  // Flechas de viento: una por celda, rotada hacia donde va el viento, con
  // la fuerza escrita debajo. Se rehacen enteras (son 49 como mucho).
  function pintarFlechas(ancho, alto) {
    svgFlechas.setAttribute('width', String(Math.round(ancho)));
    svgFlechas.setAttribute('height', String(Math.round(alto)));
    svgFlechas.replaceChildren(
      ...flechas.map((f) => {
        const t = aTesela(f.lat, f.lon, zoom);
        const x = ((t.x - c.x) * TAM + ancho / 2).toFixed(1);
        const y = ((t.y - c.y) * TAM + alto / 2).toFixed(1);
        const g = document.createElementNS(SVG, 'g');
        g.setAttribute('class', `flecha ${f.clase}`);
        const cuerpo = document.createElementNS(SVG, 'g');
        cuerpo.setAttribute('transform', `translate(${x} ${y}) rotate(${Math.round(f.rumbo)})`);
        const palo = document.createElementNS(SVG, 'line');
        palo.setAttribute('x1', '0');
        palo.setAttribute('x2', '0');
        palo.setAttribute('y1', '9');
        palo.setAttribute('y2', '-6');
        const punta = document.createElementNS(SVG, 'polygon');
        punta.setAttribute('points', '0,-12 -5,-4 5,-4');
        cuerpo.append(palo, punta);
        const texto = document.createElementNS(SVG, 'text');
        texto.setAttribute('x', x);
        texto.setAttribute('y', (Number(y) + 22).toFixed(1));
        texto.textContent = f.texto;
        g.append(cuerpo, texto);
        return g;
      }),
    );
  }

  function avisarVista() {
    clearTimeout(espera);
    espera = setTimeout(() => {
      const { width, height } = caja.getBoundingClientRect();
      alVer({ caja: cajaVisible(c.x, c.y, zoom, width, height), zoom });
    }, 350);
  }

  function acercar(d) {
    const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom + d));
    if (nz === zoom) return;
    const f = 2 ** (nz - zoom);
    c = { x: c.x * f, y: c.y * f };
    zoom = nz;
    for (const img of imgs.values()) img.remove();
    imgs.clear();
    pintar();
    avisarVista();
  }

  // Arrastrar mueve; un toque sin moverse (menos de 6 px) pone la marca.
  let inicio = null;
  caja.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a')) return;
    caja.setPointerCapture(e.pointerId);
    inicio = { x: e.clientX, y: e.clientY, c: { ...c }, movido: false };
  });
  caja.addEventListener('pointermove', (e) => {
    if (!inicio) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    if (Math.hypot(dx, dy) > 6) inicio.movido = true;
    if (!inicio.movido) return;
    c = { x: inicio.c.x - dx / TAM, y: inicio.c.y - dy / TAM };
    // Una vez por fotograma como mucho: pointermove llega más a menudo, y
    // con muchas zonas rehacer todas las rutas en cada evento se arrastra.
    if (!fotograma) fotograma = requestAnimationFrame(() => ((fotograma = 0), pintar()));
  });
  caja.addEventListener('pointerup', (e) => {
    if (!inicio) return;
    const tocado = !inicio.movido;
    inicio = null;
    if (fotograma) (cancelAnimationFrame(fotograma), (fotograma = 0), pintar());
    if (!tocado) return avisarVista();
    const r = caja.getBoundingClientRect();
    marcado = puntoEnPixel(c.x, c.y, zoom, r.width, r.height, e.clientX - r.left, e.clientY - r.top);
    pintar();
    alMarcar(marcado);
  });
  caja.addEventListener('pointercancel', () => {
    if (inicio?.movido) avisarVista();
    inicio = null;
  });
  caja.addEventListener('click', (e) => {
    const b = e.target.closest('[data-zoom]');
    if (b) acercar(Number(b.dataset.zoom));
  });
  pintar();
  avisarVista();
  return {
    pintar,
    zoom: () => zoom,
    marcado: () => marcado,
    /** Pinta estas zonas (sustituye a las anteriores). */
    ponerFormas(nuevas) {
      formas = nuevas;
      pintar();
    },
    /** Pinta las flechas de viento (sustituye a las anteriores). */
    ponerFlechas(nuevas) {
      flechas = nuevas;
      pintar();
    },
    /** Pinta las celdas de nubes (sustituye a las anteriores). */
    ponerCeldas(nuevas) {
      celdas = nuevas;
      pintar();
    },
  };
}
