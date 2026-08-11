/**
 * Descargas reales del navegador — única fuente para todo lo que la interfaz
 * ofrece "descargar". Antes cada botón de exportar estaba deshabilitado con
 * un `title="Todavía no está conectado"` salvo el CSV de Planilla, que traía
 * su propia copia de esta lógica.
 *
 * No hay generación de PDF ni de XLSX: eso necesitaría una librería y un
 * backend que hoy no existen. Lo que sí se puede entregar de verdad con los
 * datos que ya viven en la app es CSV (abre directo en Excel/Sheets) y el
 * archivo adjunto original tal cual se guardó. Nada acá simula un éxito que
 * no ocurrió.
 */

/** Escapa un valor para CSV (comillas dobles + BOM lo hace legible en Excel). */
function celda(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/**
 * Descarga real de un CSV a partir de una matriz de filas.
 * `nombre` no lleva extensión — se le añade `.csv`.
 */
export function descargarCsv(nombre, filas) {
  const csv = filas.map((f) => f.map(celda).join(',')).join('\n');
  // BOM UTF-8 para que Excel respete tildes y el símbolo de colón.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  descargarBlob(blob, `${nombre}.csv`);
}

/** Descarga un Blob ya construido con el nombre de archivo dado. */
export function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Descarga el comprobante adjunto tal cual se guardó (su `dataUrl` en base64,
 * ver `leerArchivoAdjunto` en format.js). Devuelve `false` si ese adjunto no
 * tiene contenido real guardado — el llamador debe avisarlo, nunca simular
 * una descarga vacía.
 */
export function descargarAdjunto(archivo) {
  if (!archivo?.dataUrl) return false;
  const a = document.createElement('a');
  a.href = archivo.dataUrl;
  a.download = archivo.name || 'comprobante';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

/** "2026-08-11" — sufijo estable para los nombres de archivo exportados. */
export function sufijoFecha(hoy) {
  return `${hoy.anio}-${String(hoy.mesIndice + 1).padStart(2, '0')}-${String(hoy.dia).padStart(2, '0')}`;
}
