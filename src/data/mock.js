/**
 * DATOS BASE — arranque en limpio.
 *
 * `empleadosBase` está vacío a propósito: todavía no se cargó el equipo real.
 * `periodosBase` trae un único período abierto (el actual, anclado a `HOY`),
 * sin historial de quincenas cerradas — el historial real se construye desde
 * cero a medida que se cierran períodos (ver `cerrarPeriodo` en App.jsx,
 * que ahora congela un snapshot real en vez de inventar una escala fija).
 *
 * Nada de lo que queda acá es información ficticia de negocio (nombres,
 * salarios, montos de CCSS/INS, historial de pagos): eso vive como estado
 * real y mutable en App.jsx, inicializado vacío y persistido en el
 * navegador. Cuando se incorpore el backend, este módulo sigue siendo el
 * único punto de arranque a sustituir (misma forma de objeto).
 */

/**
 * "Hoy" real del sistema — se lee del reloj real del navegador al cargar la
 * app, nunca una fecha fija. Antes quedaba anclado a "9 de agosto de 2026"
 * sin importar cuándo se abriera la app de verdad, así que el calendario,
 * el Timeline, los estados de vencimiento de CCSS/INS y las fechas por
 * defecto de los pagos quedaban desfasados del día real (corrección
 * "fecha real del sistema"). Se calcula una sola vez al cargar el módulo —
 * no es un reloj en vivo dentro de la sesión — igual que ya se usaba en
 * todos lados como una fecha fija de solo lectura.
 */
function hoyReal() {
  const ahora = new Date();
  return { anio: ahora.getFullYear(), mesIndice: ahora.getMonth(), dia: ahora.getDate() };
}

export const HOY = hoyReal();

/**
 * Usuario de la sesión (aún no hay autenticación). Es solo el valor de
 * ARRANQUE: el usuario real vive dentro de `config.usuario` y se edita desde
 * Configuración → "Usuario de la sesión" (antes este objeto se importaba
 * directo en el Sidebar y en 5 pantallas, así que el nombre, el rol y las
 * iniciales aparecían por toda la interfaz sin ningún lugar donde cambiarlos).
 */
export const usuarioBase = {
  nombre: 'Flor Damaris Espinoza',
  rol: 'Administrador',
  iniciales: 'FE',
};

/**
 * Configuración inicial de la empresa. Editable desde la pantalla
 * Configuración. `tasas.cargasPatronales` es exclusivamente CCSS patronal
 * (SEM+IVM+Banco Popular+FODESAF+IMAS+INA+FCL+FPC) — el INS (Riesgos del
 * Trabajo) NUNCA va mezclado ahí: en Costa Rica es un cargo patronal
 * totalmente aparte, cuya tasa depende de la actividad económica y sale
 * únicamente de `poliza.tasa` (ver investigación de Fase 4). `poliza.*`
 * sigue siendo de ejemplo — reemplazar con los datos reales de tu póliza.
 */
export const configuracionBase = {
  empresa: { nombre: 'POLLO Y MÁS', actividad: 'Comercio · carnicería' },
  modulo: 'GESTIÓN LABORAL',
  // Quién está usando el sistema — se muestra en el menú lateral y en el
  // encabezado de todas las pantallas editoriales. Editable desde
  // Configuración (ver `usuarioBase` arriba).
  usuario: { ...usuarioBase },
  tasas: {
    deduccionEmpleado: 0.1067, // CCSS obrera
    cargasPatronales: 0.2533, // CCSS patronal — sin INS (ver comentario arriba)
  },
  /**
   * Métodos con los que se registra un pago de salario. Es la lista que
   * ofrecen los modales "Marcar como pagada" de Planilla y de Pagos, y la
   * base de la sugerencia automática según la cuenta del empleado. Antes
   * vivía como una constante repetida dentro de cada pantalla, así que la
   * interfaz mostraba cuatro opciones fijas sin ninguna forma de cambiarlas.
   */
  metodosPago: ['Transferencia', 'Efectivo', 'Cheque', 'SINPE Móvil'],
  /**
   * Parámetros del cálculo de horas extra que la planilla ya venía usando y
   * mostrando en pantalla ("240h/mes", "1.5×") pero que estaban escritos
   * dentro del cálculo, sin ningún lugar donde ajustarlos:
   *  - `jornadaHorasMes`: horas ordinarias al mes con las que se deriva el
   *    valor de la hora (salario ÷ jornadaHorasMes).
   *  - `factorHoraExtra`: multiplicador aplicado a esa hora ordinaria.
   * Aproximación operativa del negocio, no un cálculo legal.
   */
  jornadaHorasMes: 240,
  factorHoraExtra: 1.5,
  periodoTipo: 'quincenal', // 'quincenal' | 'mensual'
  fechaCorte: 15,
  // Día del mes (1–28) en que vence cada obligación — sin configurar por
  // defecto (`null`): el vencimiento de CCSS depende del calendario de pago
  // que la CCSS asigna a cada patrono, y el del reporte INS depende de tu
  // póliza; ninguno de los dos es una fecha universal que se pueda inventar.
  // Mientras estén en `null`, las obligaciones muestran "Sin fecha
  // configurada" en vez de un vencido/próximo falso.
  ccssDiaVencimiento: null,
  insDiaVencimiento: null,
  poliza: {
    numero: 'N° 2647-8891',
    vigencia: '01 dic 2025 — 30 nov 2026',
    tasa: '2,00%', // tasa de riesgo INS de ejemplo — reemplazar por la real de tu póliza
  },
};

/**
 * Equipo inicial — vacío a propósito: todavía no se cargó el equipo real.
 * Los "Empleado 1-4" que había acá eran datos de prueba para las sesiones de
 * QA; se agrega el equipo real desde la pantalla Equipo ("Agregar persona").
 */
export const empleadosBase = [];

/**
 * Períodos de planilla: arranca con un único período `abierto` (el actual),
 * sin historial ficticio. Un período `cerrado` real siempre trae su propio
 * `snapshot` congelado (empleados + totales de ese momento) — ver
 * `cerrarPeriodo` en App.jsx y `buildPeriodoDetalle`/`buildHistorial` en
 * payroll.js, que ya no recalculan con la nómina actual ni con un `factor`
 * decorativo.
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
    snapshot: null, // los períodos abiertos no tienen snapshot: se leen en vivo
  },
];

/**
 * Obligaciones recurrentes del negocio — solo los "espacios" que siempre
 * existen (cuota CCSS del mes, pago de planilla, póliza INS vigente). Los
 * montos y fechas se resuelven en tiempo real a partir de la planilla y la
 * configuración (ver `buildObligaciones` en payroll.js); cuando no hay una
 * fecha de vencimiento configurada todavía, `fecha` queda en `null` y la
 * interfaz lo muestra como un estado honesto, no como una fecha inventada.
 *
 * A propósito NO incluye "eventos" fijos como un reporte INS vencido o una
 * cuota CCSS ya pagada — esos son hechos puntuales que solo deben aparecer
 * cuando existan de verdad en el historial real (todavía vacío).
 */
export const obligacionesBase = [
  {
    k: 'proximo',
    t: 'Cuota CCSS del mes',
    d: 'Seguro social — planilla mensual',
    monto: null, // se completa con las cargas reales calculadas de la planilla activa
    fecha: null, // sin fecha de vencimiento configurada todavía
    dias: null,
    target: 'ccss',
  },
  {
    k: 'pendiente',
    t: 'Pago de planilla',
    d: null, // se resuelve dinámicamente según cuántos falten por pagar
    monto: null, // se completa con el neto pendiente
    fecha: null, // se resuelve con la fecha real de cierre del período activo
    dias: null,
    target: 'pagos',
  },
  {
    // "aldia" (póliza vigente) y "reporte mensual regularizado" son hechos
    // distintos: la póliza puede estar vigente sin que el reporte del mes
    // ya se haya presentado. El estado base arranca honestamente pendiente
    // — igual que CCSS — y solo pasa a "aldia" cuando `insEstado.alDia` sea
    // real para el mes activo (ver App.jsx). Nunca queda "al día" por
    // defecto solo porque no haya día de vencimiento configurado.
    k: 'proximo',
    t: 'Póliza INS Riesgos del Trabajo',
    d: 'Riesgos del Trabajo — reporte mensual',
    monto: null, // se completa con buildInsMonto sobre la planilla activa
    fecha: null, // sin fecha de vencimiento configurada todavía
    dias: null,
    target: 'ins',
  },
];

/**
 * Las notificaciones de la campana (Fase 11, `NotificacionesPanel` en cada
 * masthead) no son una lista propia: se derivan en App.jsx de las
 * obligaciones reales por atender (vencidas, pendientes y próximas), con su
 * fecha, su monto y su destino de navegación. Nunca hubo ni hay acá un
 * arreglo de notificaciones — inventar una lista aparte habría duplicado la
 * fuente de verdad que ya usa "Atender" en el Home y en Obligaciones.
 */
