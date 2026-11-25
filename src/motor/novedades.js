// Las novedades de la app: el CHANGELOG.md, leído y pasado a HTML para
// enseñarlo en el móvil. Solo lo que usa el fichero: títulos «## 0.X.Y ·
// dd-mm-aaaa», párrafos, listas (con sangría), **negrita** y `código`.
// Todo el texto se escapa antes de dar formato: nada del fichero llega a la
// página como HTML.

const VERSION = /^## (\d+\.\d+\.\d+)(?: · (\d{2}-\d{2}-\d{4}))?\s*$/;

const escapar = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Una línea de texto con **negrita** y `código` (ya escapada). */
function enLinea(texto) {
  return escapar(texto)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/** Un bloque de markdown sencillo → HTML: párrafos y listas de dos niveles. */
export function bloqueHtml(md) {
  const salida = [];
  let parrafo = [];
  let lista = null; // { items: [{ texto, sub: [] }] }
  const cerrarParrafo = () => {
    if (parrafo.length) salida.push(`<p>${enLinea(parrafo.join(' '))}</p>`);
    parrafo = [];
  };
  const cerrarLista = () => {
    if (!lista) return;
    salida.push(
      `<ul>${lista.items.map((i) => `<li>${enLinea(i.texto.join(' '))}${i.sub.length ? `<ul>${i.sub.map((x) => `<li>${enLinea(x.join(' '))}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ul>`,
    );
    lista = null;
  };
  for (const linea of md.split('\n')) {
    const vineta = linea.match(/^(\s*)- (.*)$/);
    if (vineta) {
      cerrarParrafo();
      lista ??= { items: [] };
      if (vineta[1].length >= 2 && lista.items.length) lista.items.at(-1).sub.push([vineta[2]]);
      else lista.items.push({ texto: [vineta[2]], sub: [] });
    } else if (!linea.trim()) {
      cerrarParrafo();
      cerrarLista();
    } else if (lista && /^\s+/.test(linea)) {
      // Continuación de la viñeta (o subviñeta) anterior.
      const ultimo = lista.items.at(-1);
      (ultimo.sub.length ? ultimo.sub.at(-1) : ultimo.texto).push(linea.trim());
    } else {
      cerrarLista();
      parrafo.push(linea.trim());
    }
  }
  cerrarParrafo();
  cerrarLista();
  return salida.join('');
}

/**
 * El CHANGELOG entero: lo destacado y cada versión, la más nueva primero.
 * @returns {{destacado: string, versiones: {version: string, fecha: string, html: string}[]}}
 */
export function leerNovedades(md) {
  const versiones = [];
  let destacado = '';
  let actual = null;
  let enDestacado = false;
  let trozo = [];
  const guardar = () => {
    if (actual) actual.html = bloqueHtml(trozo.join('\n'));
    else if (enDestacado) destacado = bloqueHtml(trozo.join('\n'));
    trozo = [];
  };
  for (const linea of String(md ?? '').split('\n')) {
    const v = linea.match(VERSION);
    if (v) {
      guardar();
      enDestacado = false;
      actual = { version: v[1], fecha: v[2] ?? '', html: '' };
      versiones.push(actual);
    } else if (/^## /.test(linea)) {
      guardar();
      actual = null;
      enDestacado = /lo más importante/i.test(linea);
    } else trozo.push(linea);
  }
  guardar();
  return { destacado, versiones };
}

/** Las versiones posteriores a `desde` (sin incluirla), hasta la actual. */
export function novedadesDesde(versiones, desde) {
  const num = (v) => v.split('.').map(Number);
  const mayor = (a, b) => {
    const [x, y] = [num(a), num(b)];
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
    return false;
  };
  return versiones.filter((v) => mayor(v.version, desde));
}
