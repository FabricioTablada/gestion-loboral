/**
 * DATOS FICTICIOS — prototipo funcional.
 *
 * Nada de esto proviene de una base de datos ni representa información real.
 * Cuando se incorpore el backend, este módulo es el único que debe sustituirse
 * (misma forma de objeto), sin tocar pantallas ni componentes. El estado
 * *mutable* de la sesión (empleados editados, períodos cerrados, config
 * ajustada…) vive en App.jsx, inicializado a partir de estos arrays base.
 */

/** "Hoy" fijo del prototipo — ancla el calendario y el período activo. */
export const HOY = { anio: 2026, mesIndice: 7, dia: 9 }; // 9 de agosto de 2026

/** Usuario de la sesión (mock: aún no hay autenticación). */
export const usuario = {
  nombre: 'Flor Damaris Espinoza',
  rol: 'Administrador',
  iniciales: 'FE',
};

/**
 * Configuración inicial de la empresa. Editable desde la pantalla
 * Configuración; sustituye lo que antes eran constantes de código sueltas
 * (`empresa`, `tasasPrototipo`, datos de póliza dentro de `ins`).
 */
export const configuracionBase = {
  empresa: { nombre: 'POLLO Y MÁS', actividad: 'Comercio · carnicería' },
  modulo: 'GESTIÓN LABORAL',
  tasas: {
    deduccionEmpleado: 0.1067, // CCSS obrera
    cargasPatronales: 0.2867, // patronal + INS
  },
  periodoTipo: 'quincenal', // 'quincenal' | 'mensual'
  fechaCorte: 15,
  poliza: {
    numero: 'N° 2647-8891',
    vigencia: '01 dic 2025 — 30 nov 2026',
    tasa: '2,00%',
  },
};

/**
 * Plantilla de empleados. `activo:false` = dado de baja (se conserva su
 * historial, desaparece de la planilla/pagos activos).
 */
export const empleadosBase = [
  {
    id: 1,
    nombre: 'José Ramírez Soto',
    puesto: 'Carnicero encargado',
    ingreso: '12 mar 2021',
    salario: 620000,
    cedula: '1-1420-0356',
    tel: '8712-4590',
    banco: 'BAC · Cuenta planilla',
    tipo: 'Tiempo completo',
    activo: true,
    pago: 'pagado',
    metodo: 'Transferencia',
    fechaPago: '08 ago 2026',
  },
  {
    id: 2,
    nombre: 'María Fernández Vargas',
    puesto: 'Cajera',
    ingreso: '04 ene 2023',
    salario: 430000,
    cedula: '1-1688-0774',
    tel: '8890-1123',
    banco: 'BN · Cuenta planilla',
    tipo: 'Tiempo completo',
    activo: true,
    pago: 'pendiente',
    metodo: '—',
    fechaPago: '—',
  },
  {
    id: 3,
    nombre: 'Luis Mora Castro',
    puesto: 'Despachador',
    ingreso: '19 jul 2022',
    salario: 410000,
    cedula: '2-0755-0219',
    tel: '8455-7781',
    banco: 'BAC · Cuenta planilla',
    tipo: 'Tiempo completo',
    activo: true,
    pago: 'pendiente',
    metodo: '—',
    fechaPago: '—',
  },
  {
    id: 4,
    nombre: 'Kevin Jiménez Rojas',
    puesto: 'Ayudante de bodega',
    ingreso: '02 feb 2024',
    salario: 375000,
    cedula: '3-0512-0908',
    tel: '8321-6640',
    banco: 'Efectivo',
    tipo: 'Medio tiempo',
    activo: true,
    pago: 'pendiente',
    metodo: '—',
    fechaPago: '—',
  },
  {
    id: 5,
    nombre: 'Ana Vega Solano',
    puesto: 'Cajera',
    ingreso: '10 may 2023',
    salario: 415000,
    cedula: '1-1799-0442',
    tel: '8630-2214',
    banco: 'BN · Cuenta planilla',
    tipo: 'Tiempo completo',
    activo: true,
    pago: 'pendiente',
    metodo: '—',
    fechaPago: '—',
  },
  {
    id: 6,
    nombre: 'Diego Araya Bonilla',
    puesto: 'Despachador',
    ingreso: '21 ago 2023',
    salario: 400000,
    cedula: '2-0810-0337',
    tel: '8544-9012',
    banco: 'BAC · Cuenta planilla',
    tipo: 'Medio tiempo',
    activo: true,
    pago: 'pendiente',
    metodo: '—',
    fechaPago: '—',
  },
  {
    id: 7,
    nombre: 'Sofía Herrera Núñez',
    puesto: 'Cajera',
    ingreso: '03 nov 2022',
    salario: 420000,
    cedula: '1-1655-0128',
    tel: '8399-6650',
    banco: 'BN · Cuenta planilla',
    tipo: 'Tiempo completo',
    activo: false,
    pago: 'pendiente',
    metodo: '—',
    fechaPago: '—',
  },
];

/**
 * Obligaciones del período. `monto: null` significa que el importe se calcula
 * a partir de la planilla (p. ej. el neto pendiente por pagar). `target` es
 * la pantalla a la que navega "Atender".
 */
export const obligacionesBase = [
  {
    k: 'vencido',
    t: 'Reporte de salarios · INS Riesgos',
    d: 'Planilla Julio 2026 sin reportar',
    monto: 36700,
    fecha: 'Venció 05 ago 2026',
    dias: 'Hace 4 días',
    target: 'ins',
  },
  {
    k: 'proximo',
    t: 'Cuota CCSS · Julio 2026',
    d: 'Seguro social — planilla mensual',
    monto: 685189,
    fecha: 'Vence 20 ago 2026',
    dias: 'En 11 días',
    target: 'ccss',
  },
  {
    k: 'pendiente',
    t: 'Pago de planilla · Quincena 01–15 ago',
    d: '3 de 4 empleados por pagar',
    monto: null, // ← se completa con el neto pendiente
    fecha: 'Vence 15 ago 2026',
    dias: 'En 6 días',
    target: 'pagos',
  },
  {
    k: 'pagado',
    t: 'Cuota CCSS · Junio 2026',
    d: 'Pagada — comprobante disponible',
    monto: 672400,
    fecha: 'Pagada 17 jul 2026',
    dias: 'Conciliado',
    target: 'ccss',
  },
  {
    k: 'aldia',
    t: 'Póliza INS Riesgos del Trabajo',
    d: 'Vigente — sin pendientes',
    monto: 0,
    fecha: 'Renueva 30 nov 2026',
    dias: 'Al día',
    target: 'ins',
  },
];

/** Marcas del calendario: día del mes → estado. Solo aplican al mes de `HOY`. */
export const marcasCalendario = {
  5: 'vencido',
  15: 'pendiente',
  20: 'proximo',
  25: 'pendiente',
  30: 'aldia',
};

/** Eventos del mes de `HOY`, con la pantalla a la que navegan al hacer click. */
export const eventosBase = [
  { d: '05', mes: 'AGO', t: 'Reporte de salarios INS', k: 'vencido', target: 'ins' },
  { d: '15', mes: 'AGO', t: 'Pago de planilla — quincena', k: 'pendiente', target: 'pagos' },
  { d: '20', mes: 'AGO', t: 'Cuota CCSS — Julio', k: 'proximo', target: 'ccss' },
  { d: '25', mes: 'AGO', t: 'Reporte planilla INS', k: 'pendiente', target: 'ins' },
  { d: '30', mes: 'NOV', t: 'Renovación póliza INS', k: 'aldia', target: 'ins' },
];

/**
 * Serie del gráfico de costo laboral (valores en miles de colones), 12 meses
 * para soportar el selector 3/6/12 de Reportes. Termina en agosto 2026.
 */
export const serieCostoMensual = [
  ['Sep', 2190],
  ['Oct', 2205],
  ['Nov', 2230],
  ['Dic', 2340],
  ['Ene', 2265],
  ['Feb', 2250],
  ['Mar', 2280],
  ['Abr', 2361],
  ['May', 2361],
  ['Jun', 2361],
  ['Jul', 2455],
  ['Ago', 2361],
];

/**
 * Períodos de planilla: uno `abierto` (el activo, editable) y el resto
 * `cerrado` (historial, solo lectura). `factor` escala los totales actuales
 * para representar el monto de ese período — mismo criterio del prototipo
 * original, ahora modelado como una sola lista en vez de período+historial
 * separados. Cerrar el período activo mueve su entrada a `cerrado` y agrega
 * una nueva `abierta` (ver `payroll.js` → `nextPeriodo`).
 */
export const periodosBase = [
  {
    id: 'q-2026-08-a',
    etiqueta: 'Quincena · 01–15 ago 2026',
    titulo: 'Quincena 01–15 de agosto 2026',
    mes: 'Agosto 2026',
    anio: 2026,
    mesIndice: 7,
    mitad: 'a',
    estado: 'abierto',
    factor: 1,
  },
  {
    id: 'q-2026-07-b',
    etiqueta: 'Quincena · 16–31 jul 2026',
    titulo: 'Quincena 16–31 de julio 2026',
    mes: 'Julio 2026',
    anio: 2026,
    mesIndice: 6,
    mitad: 'b',
    estado: 'cerrado',
    factor: 1.0,
  },
  {
    id: 'q-2026-07-a',
    etiqueta: 'Quincena · 01–15 jul 2026',
    titulo: 'Quincena 01–15 de julio 2026',
    mes: 'Julio 2026',
    anio: 2026,
    mesIndice: 6,
    mitad: 'a',
    estado: 'cerrado',
    factor: 1.04,
  },
  {
    id: 'q-2026-06-b',
    etiqueta: 'Quincena · 16–30 jun 2026',
    titulo: 'Quincena 16–30 de junio 2026',
    mes: 'Junio 2026',
    anio: 2026,
    mesIndice: 5,
    mitad: 'b',
    estado: 'cerrado',
    factor: 0.97,
  },
  {
    id: 'q-2026-06-a',
    etiqueta: 'Quincena · 01–15 jun 2026',
    titulo: 'Quincena 01–15 de junio 2026',
    mes: 'Junio 2026',
    anio: 2026,
    mesIndice: 5,
    mitad: 'a',
    estado: 'cerrado',
    factor: 0.97,
  },
  {
    id: 'q-2026-05-b',
    etiqueta: 'Quincena · 16–31 may 2026',
    titulo: 'Quincena 16–31 de mayo 2026',
    mes: 'Mayo 2026',
    anio: 2026,
    mesIndice: 4,
    mitad: 'b',
    estado: 'cerrado',
    factor: 0.97,
  },
  {
    id: 'q-2026-05-a',
    etiqueta: 'Quincena · 01–15 may 2026',
    titulo: 'Quincena 01–15 de mayo 2026',
    mes: 'Mayo 2026',
    anio: 2026,
    mesIndice: 4,
    mitad: 'a',
    estado: 'cerrado',
    factor: 0.95,
  },
];

/** CCSS — cuota del período y su historial. */
export const ccss = {
  titulo: 'Cuota CCSS · Julio 2026',
  subtitulo: 'Planilla mensual reportada al seguro social',
  estado: 'proximo',
  estadoTexto: 'Próximo · vence 20 ago',
  cuotaObrera: 195795,
  cuotaPatronal: 489394,
  total: 685189,
  historial: [
    { periodo: 'Junio 2026', detalle: 'Pagada 17 jul 2026', monto: 672400 },
    { periodo: 'Mayo 2026', detalle: 'Pagada 18 jun 2026', monto: 651800 },
    { periodo: 'Abril 2026', detalle: 'Pagada 16 may 2026', monto: 651800 },
  ],
};

/** INS — reporte pendiente e historial. Los datos de póliza viven en `configuracionBase.poliza`. */
export const ins = {
  cubiertos: '4',
  reporte: {
    titulo: 'Reporte de planilla · Julio',
    venceTexto: '05 de agosto',
    montoEstimado: 36700,
  },
  historial: [
    { periodo: 'Junio 2026', detalle: 'Reportado 04 jul 2026 · comprobante', monto: 36700 },
    { periodo: 'Mayo 2026', detalle: 'Reportado 03 jun 2026 · comprobante', monto: 35560 },
  ],
};

/** Notificaciones del panel de la campana (TopBar). `target` navega a la pantalla correspondiente. */
export const notificacionesBase = [
  {
    id: 1,
    titulo: 'Reporte INS vencido',
    detalle: 'La planilla de julio no se ha reportado ante el INS',
    fecha: 'Hace 4 días',
    leida: false,
    tono: 'danger',
    target: 'ins',
  },
  {
    id: 2,
    titulo: 'Cuota CCSS próxima a vencer',
    detalle: 'La cuota de julio vence el 20 de agosto',
    fecha: 'Hace 1 día',
    leida: false,
    tono: 'warn',
    target: 'ccss',
  },
  {
    id: 3,
    titulo: 'Pago de planilla pendiente',
    detalle: '3 de 4 empleados sin pagar esta quincena',
    fecha: 'Hace 6 horas',
    leida: false,
    tono: 'warn',
    target: 'pagos',
  },
  {
    id: 4,
    titulo: 'Cuota CCSS de junio pagada',
    detalle: 'Comprobante disponible en el historial',
    fecha: 'Hace 3 semanas',
    leida: true,
    tono: 'default',
    target: 'ccss',
  },
];
