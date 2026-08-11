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

/**
 * "2026-08-09" — la fecha de hoy de la app (el `HOY` de mock.js) en formato
 * ISO, para precargar inputs `type="date"`. Única fuente de "hoy" para
 * registrar un pago: antes cada pantalla usaba su propio reloj (Pagos.jsx
 * tomaba la fecha real del sistema, Planilla.jsx usaba `HOY`), así que un
 * pago podía quedar con una fecha distinta según por dónde se registrara.
 */
export function fechaISO(hoy) {
  return `${hoy.anio}-${String(hoy.mesIndice + 1).padStart(2, '0')}-${String(hoy.dia).padStart(2, '0')}`;
}

/**
 * Lee un comprobante adjunto (CCSS/INS) completo, no solo su nombre — antes
 * `onAdjuntar({ name, size })` descartaba el archivo real elegido y solo
 * dejaba el rótulo en pantalla (auditoría F15). Devuelve una promesa con el
 * contenido real en base64 (`dataUrl`) y sus metadatos reales, lista para
 * persistir. Si el navegador no puede leer el contenido, se resuelve igual
 * con `dataUrl: null` — nunca se inventa un contenido que no se pudo leer,
 * pero tampoco se pierden los metadatos reales del archivo.
 */
export function leerArchivoAdjunto(file) {
  return new Promise((resolve) => {
    const fecha = new Date().toISOString();
    const base = { name: file.name, size: file.size, type: file.type, fecha };
    const lector = new FileReader();
    lector.onload = () => resolve({ ...base, dataUrl: lector.result });
    lector.onerror = () => resolve({ ...base, dataUrl: null });
    lector.readAsDataURL(file);
  });
}
