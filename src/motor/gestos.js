// ¿Un movimiento del dedo es un deslizamiento lateral para cambiar de día?
// Puro: la app le pasa cuánto se movió y en cuánto tiempo.

export const MIN_PX = 50; // menos es un toque o un temblor
export const MAX_MS = 800; // más lento es arrastrar para leer, no pasar de día

/** 1 = siguiente (dedo hacia la izquierda), -1 = anterior, 0 = nada. */
export function sentidoDeslizar(dx, dy, ms) {
  if (!(ms <= MAX_MS) || !(Math.abs(dx) >= MIN_PX)) return 0;
  // Claramente de lado: si va casi en diagonal, es que se está bajando por la página.
  if (Math.abs(dx) < 1.5 * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}
