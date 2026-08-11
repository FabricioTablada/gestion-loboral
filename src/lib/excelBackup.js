/**
 * Respaldo completo del sistema en un único archivo Excel — pensado para
 * cuando no hay backend: todo vive en `localStorage` del navegador (ver
 * `STORAGE_KEY` en App.jsx), así que este es el mecanismo real para no
 * perder la información si se borra el caché, se formatea la computadora,
 * o se reinstala la app en otra máquina.
 *
 * El archivo trae dos tipos de hoja:
 *  - Hojas "bonitas" (Portada, Empleados, Historial de pagos, CCSS, INS,
 *    Configuración): para que la persona las lea o imprima. Son una
 *    representación legible, no la fuente de verdad para restaurar.
 *  - Una hoja oculta "Backup" con el estado completo en filas
 *    `clave | índice | json`: es la que lee `leerBackupXlsx` para
 *    reconstruir exactamente lo que había, sin importar cómo se vean o se
 *    reordenen las hojas bonitas. Los arrays que pueden crecer con los años
 *    (empleados, períodos, historial CCSS/INS) van una fila por elemento
 *    para no toparse con el límite de ~32.767 caracteres por celda de Excel.
 */
import ExcelJS from 'exceljs';

import { descargarBlob, sufijoFecha } from './export.js';

const HOJA_BACKUP = 'Backup (no editar)';

// Aproximación en hex de la paleta oklch "editorial" que ya usa el resto de
// la app (Panel.jsx, Configuracion.jsx, etc.) — Excel no soporta oklch.
const COLOR = {
  ink: 'FF2B2521',
  cream: 'FFF6F1EA',
  cream2: 'FFFBF8F3',
  gold: 'FFD9B36C',
  coral: 'FFD97757',
  muted: 'FF7A6F63',
  line: 'FFDDD3C7',
};

const CLAVES_ARRAY = ['empleados', 'periodos', 'ccssHistorial', 'insHistorial'];
const CLAVES_ESCALARES = ['empId', 'ajustes', 'config', 'ccssEstadoPorMes', 'insEstadoPorMes', 'notifLeidas'];

function estiloEncabezado(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLOR.cream } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.ink } };
    cell.alignment = { vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: COLOR.gold } } };
  });
  row.height = 22;
}

function fechaCorta(hoy) {
  return `${String(hoy.dia).padStart(2, '0')}/${String(hoy.mesIndice + 1).padStart(2, '0')}/${hoy.anio}`;
}

function agregarPortada(wb, datos, empresaNombre, hoy) {
  const ws = wb.addWorksheet('Portada', { properties: { tabColor: { argb: COLOR.gold } } });
  ws.columns = [{ width: 4 }, { width: 34 }, { width: 30 }, { width: 4 }];

  ws.mergeCells('B2:C2');
  ws.getCell('B2').value = empresaNombre || 'Gestión Laboral';
  ws.getCell('B2').font = { size: 22, bold: true, color: { argb: COLOR.ink } };

  ws.mergeCells('B3:C3');
  ws.getCell('B3').value = 'Respaldo completo del sistema';
  ws.getCell('B3').font = { italic: true, size: 12, color: { argb: COLOR.muted } };

  const filas = [
    ['Generado el', fechaCorta(hoy)],
    ['Empleados activos', (datos.empleados || []).filter((e) => e.activo).length],
    ['Períodos registrados', (datos.periodos || []).length],
    ['Períodos cerrados', (datos.periodos || []).filter((p) => p.estado === 'cerrado').length],
    ['Registros CCSS', (datos.ccssHistorial || []).length],
    ['Registros INS', (datos.insHistorial || []).length],
  ];
  let r = 5;
  filas.forEach(([label, valor]) => {
    const cLabel = ws.getCell(`B${r}`);
    const cValor = ws.getCell(`C${r}`);
    cLabel.value = label;
    cLabel.font = { bold: true, color: { argb: COLOR.ink } };
    cLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.cream2 } };
    cValor.value = valor;
    cValor.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.cream2 } };
    r += 1;
  });

  ws.mergeCells(`B${r + 1}:C${r + 3}`);
  const nota = ws.getCell(`B${r + 1}`);
  nota.value =
    'Este archivo es un respaldo completo del sistema. Para restaurarlo, abrí Configuración → Respaldo → "Importar desde Excel" y elegí este mismo archivo. No edites la hoja oculta "Backup (no editar)" — es la que se usa para restaurar todo tal cual estaba.';
  nota.font = { italic: true, size: 10, color: { argb: COLOR.muted } };
  nota.alignment = { wrapText: true, vertical: 'top' };
}

function agregarEmpleados(wb, empleados) {
  const ws = wb.addWorksheet('Empleados');
  ws.columns = [
    { header: 'Nombre', key: 'nombre', width: 32 },
    { header: 'Cédula', key: 'cedula', width: 16 },
    { header: 'Puesto', key: 'puesto', width: 20 },
    { header: 'Tipo', key: 'tipo', width: 16 },
    { header: 'Salario', key: 'salario', width: 16 },
    { header: 'Banco', key: 'banco', width: 20 },
    { header: 'Teléfono', key: 'tel', width: 14 },
    { header: 'Con vos desde', key: 'ingreso', width: 16 },
    { header: 'Activo', key: 'activo', width: 10 },
  ];
  estiloEncabezado(ws.getRow(1));
  (empleados || []).forEach((e) => {
    const row = ws.addRow({
      nombre: e.nombre,
      cedula: e.cedula,
      puesto: e.puesto,
      tipo: e.tipo,
      salario: e.salario,
      banco: e.banco,
      tel: e.tel,
      ingreso: e.ingreso,
      activo: e.activo ? 'Sí' : 'No',
    });
    row.getCell('salario').numFmt = '"₡"#,##0';
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function agregarHistorialPagos(wb, periodos) {
  const ws = wb.addWorksheet('Historial de pagos');
  ws.columns = [
    { header: 'Período', key: 'periodo', width: 26 },
    { header: 'Empleado', key: 'empleado', width: 30 },
    { header: 'Neto pagado', key: 'neto', width: 16 },
    { header: 'Método', key: 'metodo', width: 16 },
    { header: 'Fecha de pago', key: 'fechaPago', width: 16 },
    { header: 'Referencia', key: 'referencia', width: 18 },
    { header: 'Comisión', key: 'comision', width: 14 },
    { header: 'Conciliado', key: 'conciliado', width: 12 },
  ];
  estiloEncabezado(ws.getRow(1));
  (periodos || [])
    .filter((p) => p.estado === 'cerrado' && p.snapshot)
    .forEach((p) => {
      (p.snapshot.emps || [])
        .filter((e) => e.pago === 'pagado')
        .forEach((e) => {
          const row = ws.addRow({
            periodo: p.etiqueta || p.titulo,
            empleado: e.nombre,
            neto: e.neto,
            metodo: e.metodo,
            fechaPago: e.fechaPago,
            referencia: e.referenciaPago,
            comision: e.comisionPago || 0,
            conciliado: e.conciliado ? 'Sí' : 'No',
          });
          row.getCell('neto').numFmt = '"₡"#,##0';
          row.getCell('comision').numFmt = '"₡"#,##0';
        });
    });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function agregarObligacion(wb, nombreHoja, registros, columnasExtra, columnasMoneda) {
  const ws = wb.addWorksheet(nombreHoja);
  ws.columns = [
    { header: 'Período', key: 'periodo', width: 22 },
    { header: 'Fecha de pago', key: 'fechaPago', width: 16 },
    { header: 'Método', key: 'metodo', width: 16 },
    { header: 'Referencia', key: 'referencia', width: 18 },
    ...columnasExtra,
    { header: 'Monto', key: 'monto', width: 16 },
  ];
  estiloEncabezado(ws.getRow(1));
  (registros || []).forEach((r) => {
    const row = ws.addRow({ ...r, monto: r.monto });
    row.getCell('monto').numFmt = '"₡"#,##0';
    columnasMoneda.forEach((key) => {
      row.getCell(key).numFmt = '"₡"#,##0';
    });
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function agregarConfiguracion(wb, config) {
  const ws = wb.addWorksheet('Configuración');
  ws.columns = [
    { header: 'Campo', key: 'campo', width: 32 },
    { header: 'Valor', key: 'valor', width: 40 },
  ];
  estiloEncabezado(ws.getRow(1));
  const filas = [
    ['Nombre de la empresa', config?.empresa?.nombre],
    ['Actividad económica', config?.empresa?.actividad],
    ['Módulo', config?.modulo],
    ['Usuario', config?.usuario?.nombre],
    ['Rol', config?.usuario?.rol],
    ['Deducción del empleado (CCSS)', `${((config?.tasas?.deduccionEmpleado || 0) * 100).toFixed(2)}%`],
    ['Cargas patronales (CCSS)', `${((config?.tasas?.cargasPatronales || 0) * 100).toFixed(2)}%`],
    ['Métodos de pago', (config?.metodosPago || []).join(', ')],
    ['Jornada mensual (horas)', config?.jornadaHorasMes],
    ['Factor de hora extra', config?.factorHoraExtra],
    ['Tipo de período', config?.periodoTipo],
    ['Día de corte', config?.fechaCorte],
    ['Día de vencimiento CCSS', config?.ccssDiaVencimiento ?? 'Sin configurar'],
    ['Día de vencimiento INS', config?.insDiaVencimiento ?? 'Sin configurar'],
    ['Número de póliza INS', config?.poliza?.numero],
    ['Vigencia de póliza INS', config?.poliza?.vigencia],
    ['Tasa de póliza INS', config?.poliza?.tasa],
  ];
  filas.forEach(([campo, valor]) => ws.addRow({ campo, valor: valor ?? '—' }));
  ws.getColumn('campo').font = { bold: true, color: { argb: COLOR.ink } };
}

/** Trocea un array grande en filas `clave | índice | json` para no chocar con el límite de celda de Excel. */
function filasDeArray(clave, arr) {
  return (arr || []).map((item, i) => [clave, i, JSON.stringify(item)]);
}

function agregarHojaBackup(wb, datos) {
  const ws = wb.addWorksheet(HOJA_BACKUP);
  ws.columns = [
    { header: 'clave', key: 'clave', width: 20 },
    { header: 'indice', key: 'indice', width: 10 },
    { header: 'json', key: 'json', width: 60 },
  ];
  const filas = [
    ...CLAVES_ARRAY.flatMap((clave) => filasDeArray(clave, datos[clave])),
    ...CLAVES_ESCALARES.map((clave) => [clave, '', JSON.stringify(datos[clave] ?? null)]),
  ];
  filas.forEach(([clave, indice, json]) => ws.addRow({ clave, indice, json }));
  ws.state = 'hidden';
}

/** Genera y descarga el archivo de respaldo completo. `datos` es el mismo objeto que ya persiste App.jsx en `localStorage`. */
export async function exportarTodoXlsx(datos, empresaNombre, hoy) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestión Laboral';
  wb.created = new Date();

  agregarPortada(wb, datos, empresaNombre, hoy);
  agregarEmpleados(wb, datos.empleados);
  agregarHistorialPagos(wb, datos.periodos);
  agregarObligacion(
    wb,
    'CCSS',
    datos.ccssHistorial,
    [
      { header: 'Obrera', key: 'obrera', width: 16 },
      { header: 'Patronal', key: 'patronal', width: 16 },
    ],
    ['obrera', 'patronal'],
  );
  agregarObligacion(wb, 'INS', datos.insHistorial, [{ header: 'Tasa', key: 'tasa', width: 12 }], []);
  agregarConfiguracion(wb, datos.config);
  agregarHojaBackup(wb, datos);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  descargarBlob(blob, `respaldo-gestion-laboral-${sufijoFecha(hoy)}.xlsx`);
}

/**
 * Lee un archivo de respaldo generado por `exportarTodoXlsx` y devuelve el
 * objeto de datos reconstruido, listo para `JSON.stringify` en
 * `localStorage` bajo la misma clave que ya usa App.jsx. Lanza si el
 * archivo no trae la hoja técnica esperada (no es un respaldo válido).
 */
export async function leerBackupXlsx(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet(HOJA_BACKUP);
  if (!ws) throw new Error('Este archivo no parece ser un respaldo de Gestión Laboral (falta la hoja técnica).');

  const arrays = {};
  const escalares = {};
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // encabezado
    const clave = row.getCell(1).value;
    const indice = row.getCell(2).value;
    const json = row.getCell(3).value;
    if (!clave || json == null || json === '') return;
    const valor = JSON.parse(json);
    if (indice === '' || indice == null) {
      escalares[clave] = valor;
    } else {
      if (!arrays[clave]) arrays[clave] = [];
      arrays[clave][Number(indice)] = valor;
    }
  });

  const datos = { ...escalares };
  CLAVES_ARRAY.forEach((clave) => {
    datos[clave] = (arrays[clave] || []).filter((v) => v !== undefined);
  });
  datos._mesKeyFix = true; // el respaldo ya guarda las claves de mes corregidas
  return datos;
}
