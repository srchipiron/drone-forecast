// Un mapa mínimo de OpenStreetMap para elegir el punto de vuelo: se arrastra
// con el dedo, se acerca con + y −, y tocar pone la marca. Sin librerías (la
// app no tiene dependencias) y sin estilos en línea en el HTML: las
// posiciones van por CSSOM (el.style), que la CSP sí deja.

import { TAM, ZOOM_MAX, ZOOM_MIN, aTesela, puntoEnPixel, teselasVisibles } from '../motor/mapa.js';

export const URL_TESELAS = 'https://tile.openstreetmap.org';

/**
 * @param {HTMLElement} caja  contenedor con tamaño (CSS)
 * @param {{lat: number, lon: number, z?: number, alMarcar: (p: {lat: number, lon: number}) => void}} op
 */
export function crearMapa(caja, { lat, lon, z = 12, alMarcar }) {
  caja.innerHTML = `<div class="mapa-teselas"></div><div class="mapa-marca" hidden></div>
    <div class="mapa-zoom"><button type="button" data-zoom="1" aria-label="Acercar">+</button><button type="button" data-zoom="-1" aria-label="Alejar">−</button></div>
    <p class="mapa-credito">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></p>`;
  const capa = caja.querySelector('.mapa-teselas');
  const marca = caja.querySelector('.mapa-marca');
  const imgs = new Map();
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
    marca.hidden = !marcado;
    if (marcado) {
      const m = aTesela(marcado.lat, marcado.lon, zoom);
      marca.style.transform = `translate(${Math.round((m.x - c.x) * TAM + ancho / 2)}px, ${Math.round((m.y - c.y) * TAM + alto / 2)}px)`;
    }
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
    pintar();
  });
  caja.addEventListener('pointerup', (e) => {
    if (!inicio) return;
    const tocado = !inicio.movido;
    inicio = null;
    if (!tocado) return;
    const r = caja.getBoundingClientRect();
    marcado = puntoEnPixel(c.x, c.y, zoom, r.width, r.height, e.clientX - r.left, e.clientY - r.top);
    pintar();
    alMarcar(marcado);
  });
  caja.addEventListener('pointercancel', () => {
    inicio = null;
  });
  caja.addEventListener('click', (e) => {
    const b = e.target.closest('[data-zoom]');
    if (b) acercar(Number(b.dataset.zoom));
  });
  pintar();
  return { pintar, zoom: () => zoom, marcado: () => marcado };
}
