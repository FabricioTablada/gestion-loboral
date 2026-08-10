/**
 * Formato de moneda del prototipo: colones, sin decimales, punto como
 * separador de miles. Se mantiene idéntico al diseño original.
 */
export function money(n) {
  return '₡' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Iniciales a partir de los dos primeros nombres. */
export function initials(nombre) {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((x) => x[0])
    .join('');
}
