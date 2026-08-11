/**
 * Derivación de los valores que muestra la interfaz.
 *
 * IMPORTANTE: esto NO es lógica contable. Reproduce exactamente las cifras
 * del prototipo para que la interfaz se pueda ver y probar. Cuando llegue el
 * motor real de planilla (CCSS, INS, salarios), sustituye este módulo.
 *
 * Todas las funciones son puras: reciben los arrays/objetos mutables que
 * vive en App.jsx (empleados, períodos, tasas de configuración…) y devuelven
 * datos derivados — nunca leen ni escriben estado por su cuenta.
 */

import { money, initials } from './format.js';
import { status, avatarPalette } from '../theme/tokens.js';
import { obligacionesBase, HOY } from '../data/mock.js';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_ABR_IDX = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };

/** Añade a un estado sus tokens visuales (etiqueta, fondo, texto, punto). */
function withStatus(key) {
  const s = status[key];
  return { stL: s.l, stBg: s.bg, stC: s.c, stD: s.d };
}

/** Extrae {dia, mesIndice, anio} de cadenas reales tipo "Vence 15 ago 2026". Null si no hay fecha (honesto). */
function parseFecha(fecha) {
  const m = /(\d{1,2})\s+([a-záéíóúñ]{3})\s+(\d{4})/i.exec(fecha || '');
  if (!m) return null;
  const mesIndice = MESES_ABR_IDX[m[2].toLowerCase()];
  if (mesIndice === undefined) return null;
  return { dia: parseInt(m[1], 10), mesIndice, anio: parseInt(m[3], 10) };
}

/** "En N días" / "Hace N días" / "Hoy", calculado contra `HOY` — nunca un texto fijo. */
function diasRelativos(anio, mesIndice, dia) {
  const objetivo = new Date(anio, mesIndice, dia);
  const hoy = new Date(HOY.anio, HOY.mesIndice, HOY.dia);
  const diff = Math.round((objetivo - hoy) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff > 0) return `En ${diff} ${diff === 1 ? 'día' : 'días'}`;
  return `Hace ${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'día' : 'días'}`;
}

/** Último día del período (criterio quincenal/mensual real de Configuración, sin inventar reglas nuevas). */
function finDePeriodo(periodo, periodoTipo) {
  if (!periodo) return null;
  const diasEnMes = new Date(periodo.anio, periodo.mesIndice + 1, 0).getDate();
  if (periodoTipo === 'mensual') return diasEnMes;
  return periodo.mitad === 'b' ? diasEnMes : 15;
}

/**
 * Convierte una tasa en formato real de póliza ("2,00%") a decimal (0.02).
 * Nunca inventa un valor: si no hay tasa configurada o no se puede leer,
 * devuelve 0 (sin cargo INS) en vez de un porcentaje de relleno. Única
 * fuente de este parseo — antes vivía duplicado (y uno de los casos con un
 * error de coma decimal) en `Ins.jsx` y `Calendario.jsx`.
 */
export function parseTasaPorcentaje(str) {
  const n = parseFloat(String(str || '').replace(',', '.'));
  return Number.isFinite(n) ? n / 100 : 0;
}

/**
 * Sugiere el método de pago coherente con la cuenta real del empleado,
 * eligiendo SIEMPRE dentro de la lista configurada (`config.metodosPago`) —
 * antes cada pantalla traía su propia copia de esta función devolviendo
 * cuatro textos fijos, así que cambiar los métodos en Configuración no
 * cambiaba la sugerencia. Si ningún método configurado coincide con la
 * cuenta, devuelve el primero de la lista en vez de inventar uno.
 */
export function sugerirMetodoPago(banco, metodos = []) {
  const lista = Array.isArray(metodos) && metodos.length > 0 ? metodos : ['Transferencia'];
  const b = (banco || '').toLowerCase();
  const buscar = (frag) => lista.find((m) => m.toLowerCase().includes(frag));
  if (b.includes('efectivo')) return buscar('efectivo') || lista[0];
  if (b.includes('sinpe')) return buscar('sinpe') || lista[0];
  if (b.includes('cheque')) return buscar('cheque') || lista[0];
  return buscar('transferencia') || lista[0];
}

/**
 * Empleados enriquecidos con los montos de la quincena y del mes, aplicando
 * los ajustes puntuales (horas extra, bono, deducción) sobre el salario
 * base. `tasas` viene de Configuración — nunca se importa un valor fijo
 * aquí, para que cambiarlas en esa pantalla recalcule todo lo demás.
 *
 * `tasaIns` (decimal, ver `parseTasaPorcentaje`) es la tasa real de la
 * póliza de Riesgos del Trabajo — un cargo patronal aparte de la CCSS, que
 * en Costa Rica nunca va mezclado en una sola cifra (ver investigación de
 * Fase 4). `tasas.cargasPatronales` es exclusivamente CCSS patronal.
 *
 * `ajustesPorId[e.id]` es una lista de movimientos reales del período
 * (cada "Registrar ajuste" firmado, con su propio timestamp) — nunca un
 * único valor que el siguiente ajuste reemplaza. Los tres montos que se
 * muestran (horas extra, bono, deducción) son la suma de todos los
 * movimientos firmados en el período, así que dos bonos en la misma
 * quincena se acumulan en vez de que el segundo borre al primero.
 */
export function buildEmpleados(empleados, empIdSeleccionado, ajustesPorId = {}, tasas, tasaIns = 0, horasExtraParams = {}) {
  const DED = tasas.deduccionEmpleado;
  const CAR = tasas.cargasPatronales; // CCSS patronal, sin INS
  const INS = tasaIns || 0; // tasa real de la póliza INS — 0 si no hay ninguna configurada, nunca inventada
  // Parámetros reales de horas extra (Configuración) — antes eran dos
  // números escritos a mano acá y recalculados por separado en 8 lugares más
  // (Planilla, Pagos, Empleados, Reportes), así que "240h" y "1.5×" se
  // mostraban en pantalla sin ninguna forma de ajustarlos.
  const JORNADA = Number(horasExtraParams.jornadaHorasMes) > 0 ? Number(horasExtraParams.jornadaHorasMes) : 240;
  const FACTOR = Number(horasExtraParams.factorHoraExtra) > 0 ? Number(horasExtraParams.factorHoraExtra) : 1.5;

  return empleados.map((e, i) => {
    const movimientos = ajustesPorId[e.id] || [];
    const horasExtra = movimientos.reduce((a, m) => a + (m.horasExtra || 0), 0);
    const bono = movimientos.reduce((a, m) => a + (m.bono || 0), 0);
    const deduccionPuntual = movimientos.reduce((a, m) => a + (m.deduccion || 0), 0);

    // Aproximación operativa con los parámetros configurados, no un cálculo
    // legal de horas extra.
    const valorHoraOrdinaria = e.salario / JORNADA;
    const pagoHorasExtra = valorHoraOrdinaria * FACTOR * horasExtra;

    const brutoBase = e.salario / 2; // quincena
    // Bruto devengado: base + horas extra + bono — sin la deducción puntual.
    // CCSS y cargas patronales se calculan sobre lo devengado, no sobre lo
    // que la persona recibe después de un adelanto/préstamo puntual.
    const bruto = Math.max(0, brutoBase + pagoHorasExtra + bono);
    const ded = bruto * DED;
    // "Cargas patronales" mostradas en la interfaz = CCSS patronal + INS,
    // dos tasas reales separadas sumadas — nunca una sola cifra mezclada.
    const car = bruto * (CAR + INS);
    const costo = bruto + car;
    // La deducción puntual solo afecta lo que la persona recibe en mano.
    const neto = Math.max(0, bruto - ded - deduccionPuntual);
    const p = status[e.pago] || status.pendiente;
    const av = avatarPalette[i % avatarPalette.length];
    const seleccionado = e.id === empIdSeleccionado;
    const tieneAjuste = horasExtra > 0 || bono > 0 || deduccionPuntual > 0;

    return {
      ...e,
      ini: initials(e.nombre),
      avBg: av.bg,
      avC: av.c,

      // Ajustes puntuales de esta quincena — totales acumulados y el
      // detalle real de movimientos que los componen (con su timestamp).
      horasExtra,
      bono,
      deduccionPuntual,
      tieneAjuste,
      movimientosAjuste: movimientos,

      // Valores derivados de los parámetros de horas extra configurados —
      // única fuente para toda la app. Las pantallas los leen de acá en vez
      // de repetir `salario / 240 * 1.5`, que ignoraba Configuración.
      jornadaHorasMes: JORNADA,
      factorHoraExtra: FACTOR,
      valorHora: valorHoraOrdinaria,
      montoHorasExtra: pagoHorasExtra,

      // Quincena
      brutoQ: bruto,
      ded,
      car,
      neto,
      costoQ: costo,
      salarioFmt: money(e.salario),
      brutoFmt: money(bruto),
      dedFmt: money(ded),
      netoFmt: money(neto),
      carFmt: money(car),
      costoFmt: money(costo),

      // Mensual (ficha del empleado) — sin ajustes puntuales, es el salario base.
      mBruto: money(e.salario),
      mDed: money(e.salario * DED),
      mNeto: money(e.salario * (1 - DED)),
      mCar: money(e.salario * (CAR + INS)),
      mCosto: money(e.salario * (1 + CAR + INS)),

      // Estado de pago
      pgL: p.l,
      pgBg: p.bg,
      pgC: p.c,
      pgD: p.d,

      seleccionado,
    };
  });
}

/** Totales de la planilla de la quincena. */
export function buildTotales(emps) {
  const sumBruto = emps.reduce((a, e) => a + e.brutoQ, 0);
  const sumNeto = emps.reduce((a, e) => a + e.neto, 0);
  // CCSS pura (no la deducción puntual, que ya solo vive en `neto`) — ver `ded` en buildEmpleados.
  const totDed = emps.reduce((a, e) => a + (e.ded ?? e.brutoQ - e.neto), 0);
  const totCar = emps.reduce((a, e) => a + (e.costoQ - e.brutoQ), 0);
  const totCosto = sumBruto + totCar;
  const pagado = emps.filter((e) => e.pago === 'pagado').reduce((a, e) => a + e.neto, 0);
  const pendiente = sumNeto - pagado;
  const pendCount = emps.filter((e) => e.pago !== 'pagado').length;

  return {
    sumBruto,
    sumNeto,
    totDed,
    totCar,
    totCosto,
    pagado,
    pendiente,
    pendCount,
    sumBrutoFmt: money(sumBruto),
    sumNetoFmt: money(sumNeto),
    totDedFmt: money(totDed),
    totCarFmt: money(totCar),
    totCostoFmt: money(totCosto),
    pagadoFmt: money(pagado),
    pendFmt: money(pendiente),
    pagoPct: sumNeto > 0 ? ((pagado / sumNeto) * 100).toFixed(0) + '%' : '0%',
  };
}

/**
 * Cuota CCSS real del MES (obrera + patronal) — la CCSS se reporta y paga
 * mensualmente, no por quincena, así que se calcula sobre el salario
 * mensual completo de cada persona activa (misma fórmula que ya usaba el
 * dossier de Obligaciones). Única fuente de este número en todo el sistema
 * — Home, Obligaciones y la pantalla CCSS deben leerlo de acá, nunca de una
 * sola quincena.
 */
export function buildCcssCuota(empsActivos, tasas) {
  const obrera = (empsActivos || []).reduce((a, e) => a + e.salario * tasas.deduccionEmpleado, 0);
  const patronal = (empsActivos || []).reduce((a, e) => a + e.salario * tasas.cargasPatronales, 0);
  return { obrera, patronal, total: obrera + patronal };
}

/**
 * Monto estimado real del reporte mensual INS Riesgos del Trabajo: tasa de
 * la póliza (Configuración, `poliza.tasa`) sobre la planilla mensual de las
 * personas activas — nunca una cifra fija ni una tasa inventada. Única
 * fuente de este número en todo el sistema (App.jsx, Calendario.jsx,
 * Ins.jsx) — antes vivía calculado por separado en cada uno de los tres.
 */
/**
 * Vigencia REAL de la póliza INS — un hecho distinto de "el reporte mensual
 * ya se regularizó" (`insEstado.alDia`): la póliza puede seguir vigente sin
 * que el reporte de este mes se haya presentado, y el reporte puede estar
 * regularizado con una póliza ya vencida (auditoría F2, antes el chip
 * "Al día" de la póliza estaba hardcodeado y no validaba nada). Se calcula
 * contra la fecha de fin real de `poliza.vigencia`
 * ("01 dic 2025 — 30 nov 2026"); sin una fecha de fin parseable, no se
 * inventa vigencia — `vigente` queda `null` (desconocida, honesto).
 */
export function buildPolizaVigencia(poliza) {
  const fin = parseFecha((poliza?.vigencia || '').split('—')[1]);
  if (!fin) return { vigente: null, fecha: null };
  const objetivo = new Date(fin.anio, fin.mesIndice, fin.dia);
  const hoy = new Date(HOY.anio, HOY.mesIndice, HOY.dia);
  return { vigente: hoy <= objetivo, fecha: poliza.vigencia };
}

export function buildInsMonto(empsActivos, poliza) {
  const tasa = parseTasaPorcentaje(poliza?.tasa);
  const monto = (empsActivos || []).reduce((a, e) => a + e.salario, 0) * tasa;
  return { monto, tasa };
}

/**
 * Estado + fecha real de una obligación MENSUAL (CCSS/INS) según el día de
 * vencimiento configurado (1–28) y el mes del período activo. Sin día
 * configurado (o sin período activo), no inventa ninguna fecha ni estado —
 * devuelve el estado base tal cual traía la obligación.
 */
function estadoObligacionMensual(diaVencimiento, periodoActivo, estadoBase) {
  if (!diaVencimiento || !periodoActivo) return { fecha: null, dias: null, k: estadoBase };
  const diasEnMes = new Date(periodoActivo.anio, periodoActivo.mesIndice + 1, 0).getDate();
  const dia = Math.min(diaVencimiento, diasEnMes); // por si el mes tiene menos días que el configurado
  const fecha = `Vence ${String(dia).padStart(2, '0')} ${MESES_ABR[periodoActivo.mesIndice]} ${periodoActivo.anio}`;
  const dias = diasRelativos(periodoActivo.anio, periodoActivo.mesIndice, dia);
  const objetivo = new Date(periodoActivo.anio, periodoActivo.mesIndice, dia);
  const hoy = new Date(HOY.anio, HOY.mesIndice, HOY.dia);
  const k = hoy > objetivo ? 'vencido' : estadoBase;
  return { fecha, dias, k };
}

/**
 * Obligaciones con sus tokens de estado y montos/fechas resueltos en tiempo
 * real (nunca inventados): la cuota CCSS es la real del mes (`ccssCuota`,
 * ver `buildCcssCuota` — misma fuente que Home/Ccss.jsx, nunca la mitad de
 * una quincena), el pago de planilla usa el neto pendiente real y la fecha
 * real de cierre del período. CCSS e INS son obligaciones mensuales: si hay
 * un día de vencimiento configurado (`config.ccssDiaVencimiento`/
 * `insDiaVencimiento`), el estado (próximo/vencido) se calcula contra la
 * fecha real de ese mes; sin configurar, queda `null`/`'—'` en vez de un
 * valor inventado (la póliza INS, si no hay día configurado, sigue
 * mostrando su fecha de renovación como referencia). `insMonto` viene de
 * `buildInsMonto` — misma fuente que usan Ins.jsx y el dossier de INS.
 */
export function buildObligaciones(totales, empCount, periodoActivo, config, ccssCuota, insMonto) {
  const finPeriodo = finDePeriodo(periodoActivo, config?.periodoTipo);
  const vigenciaFin = (config?.poliza?.vigencia || '').split('—')[1]?.trim() || null;

  return obligacionesBase.map((o) => {
    let monto = o.monto;
    let fecha = o.fecha;
    let dias = o.dias;
    let d = o.d;
    let k = o.k;

    if (o.target === 'ccss') {
      monto = ccssCuota?.total || 0;
      const r = estadoObligacionMensual(config?.ccssDiaVencimiento, periodoActivo, k);
      k = r.k;
      fecha = r.fecha;
      dias = r.dias;
    } else if (o.target === 'pagos') {
      monto = totales.pendiente;
      d =
        totales.pendCount > 0
          ? `${totales.pendCount} de ${empCount} empleados por pagar`
          : empCount > 0
            ? 'Todos pagados'
            : 'Sin empleados activos todavía';
      if (finPeriodo && periodoActivo) {
        fecha = `Vence ${String(finPeriodo).padStart(2, '0')} ${MESES_ABR[periodoActivo.mesIndice]} ${periodoActivo.anio}`;
        dias = diasRelativos(periodoActivo.anio, periodoActivo.mesIndice, finPeriodo);
      }
    } else if (o.target === 'ins') {
      monto = insMonto?.monto || 0;
      const r = estadoObligacionMensual(config?.insDiaVencimiento, periodoActivo, k);
      k = r.k;
      if (r.fecha) {
        fecha = r.fecha;
        dias = r.dias;
      } else if (vigenciaFin) {
        fecha = `Renueva ${vigenciaFin}`;
      }
    }

    // `fecha`/`dias` se usan como texto en toda la app (Home, Obligaciones…)
    // — nunca deben quedar `null` aunque no haya una fecha real configurada
    // todavía. Un texto sin forma de fecha tampoco genera marca falsa en el
    // calendario (`parseFecha` simplemente no la reconoce).
    fecha = fecha || 'Sin fecha configurada';
    dias = dias || 'Sin fecha configurada';

    return { ...o, k, monto, fecha, dias, d, montoFmt: monto ? money(monto) : '—', ...withStatus(k) };
  });
}

/** Marcas del calendario para (anio, mesIndice) derivadas de las obligaciones reales — sin mapa fijo. */
export function buildMarcasCalendario(obligaciones, anio, mesIndice) {
  const marcas = {};
  obligaciones.forEach((o) => {
    const f = parseFecha(o.fecha);
    if (f && f.anio === anio && f.mesIndice === mesIndice) marcas[f.dia] = o.k;
  });
  return marcas;
}

/** Eventos del mes (anio, mesIndice) derivados de las obligaciones reales — sin lista fija. */
export function buildEventosMes(obligaciones, anio, mesIndice) {
  return obligaciones
    .map((o) => {
      const f = parseFecha(o.fecha);
      if (!f || f.anio !== anio || f.mesIndice !== mesIndice) return null;
      return { d: String(f.dia).padStart(2, '0'), mes: MESES_ABR[mesIndice].toUpperCase(), t: o.t, k: o.k, target: o.target };
    })
    .filter(Boolean)
    .map((e) => ({ ...e, ...withStatus(e.k) }));
}

/** Sólo lo accionable: vencido, próximo y pendiente. */
export function soloAtender(obligaciones) {
  return obligaciones.filter((o) => ['vencido', 'proximo', 'pendiente'].includes(o.k));
}

/**
 * Cuadrícula del calendario para el mes `(anio, mesIndice)`. `marcas` viene
 * de `buildMarcasCalendario` (derivado de las obligaciones reales) — si un
 * mes no tiene ninguna obligación con fecha real, se muestra vacío en vez
 * de inventar marcas.
 */
export function buildCalendario(anio, mesIndice, hoy, marcas = {}) {
  const primerDia = new Date(anio, mesIndice, 1).getDay();
  const diasDelMes = new Date(anio, mesIndice + 1, 0).getDate();
  const vacia = { empty: true, d: '', mk: false, bg: 'transparent', bd: 'transparent', num: 'oklch(70% 0 0)', wt: '400' };

  const celdas = [];
  for (let i = 0; i < primerDia; i++) celdas.push({ ...vacia, key: `pre-${i}` });

  for (let d = 1; d <= diasDelMes; d++) {
    const marca = marcas[d] ? status[marcas[d]] : null;
    const esHoy = hoy && anio === hoy.anio && mesIndice === hoy.mesIndice && d === hoy.dia;
    celdas.push({
      key: `d-${d}`,
      empty: false,
      d: String(d),
      hoy: esHoy,
      mk: !!marca,
      dot: marca ? marca.d : 'transparent',
      bg: esHoy ? 'oklch(96% 0.02 84)' : 'oklch(99.5% 0.006 95)',
      bd: esHoy ? 'oklch(78% 0.14 82)' : 'oklch(92% 0.012 95)',
      num: esHoy ? 'oklch(30% 0.06 70)' : 'oklch(35% 0.015 95)',
      wt: esHoy ? '700' : '500',
    });
  }

  while (celdas.length % 7) celdas.push({ ...vacia, key: `post-${celdas.length}` });

  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) {
    semanas.push({ key: `w-${i}`, days: celdas.slice(i, i + 7) });
  }
  return semanas;
}

/** Nombre de mes + año para la cabecera del calendario. */
export function nombreMes(anio, mesIndice) {
  return `${MESES[mesIndice]} ${anio}`;
}

/**
 * Serie mensual real de costo laboral: agrupa los períodos por mes (usa el
 * snapshot congelado de los cerrados y los totales en vivo del abierto).
 * Sin períodos reales todavía, queda corta/vacía — no se inventan meses
 * que nunca se trabajaron.
 *
 * Guarda también el BRUTO real de cada mes (`bruto`), no solo el costo —
 * un mes cerrado se pagó con las tasas vigentes en su momento, así que su
 * bruto real nunca se debe re-derivar dividiendo el costo por la tasa de
 * HOY (auditoría C3): eso reescribe la historia cada vez que Configuración
 * cambia una tasa.
 */
export function buildSerieMensual(periodos, totalesActivo) {
  const porMes = new Map();
  (periodos || []).forEach((p) => {
    const totales = p.estado === 'abierto' ? totalesActivo : p.snapshot ? p.snapshot.totales : null;
    const costo = totales ? totales.totCosto : 0;
    const bruto = totales ? totales.sumBruto : 0;
    const key = `${p.anio}-${p.mesIndice}`;
    const actual = porMes.get(key) || { anio: p.anio, mesIndice: p.mesIndice, costo: 0, bruto: 0 };
    actual.costo += costo;
    actual.bruto += bruto;
    porMes.set(key, actual);
  });
  return [...porMes.values()].sort((a, b) => a.anio - b.anio || a.mesIndice - b.mesIndice);
}

/** Barras del gráfico de costo laboral por mes a partir de la serie real; `rango` = cuántos meses recientes mostrar. */
export function buildBarras(serieMensual, rango = 6) {
  const serie = (serieMensual || []).slice(-rango);
  if (serie.length === 0) return [];
  const max = Math.max(...serie.map((s) => s.costo), 1);
  const ultimo = serie.length - 1;
  return serie.map((s, i) => ({
    m: MESES_ABR[s.mesIndice].charAt(0).toUpperCase() + MESES_ABR[s.mesIndice].slice(1),
    // Mes/año reales de cada barra — los rótulos de rango de las gráficas
    // los necesitan para no imprimir años fijos que no corresponden.
    anio: s.anio,
    mesIndice: s.mesIndice,
    v: s.costo,
    // Bruto real del mes (snapshot congelado) y cargas derivadas de esa
    // misma cifra real — nunca de la tasa actual de Configuración.
    b: s.bruto,
    cargas: s.costo - s.bruto,
    hStr: Math.round((s.costo / max) * 100) + '%',
    vFmt: money(s.costo),
    bFmt: money(s.bruto),
    actual: i === ultimo,
    barBg: i === ultimo ? 'oklch(84% 0.19 80.46)' : 'oklch(88% 0.05 84)',
  }));
}

/** Distribución del costo de la quincena. */
export function buildDistribucion(totales) {
  return [
    { l: 'Salarios netos', v: totales.sumNeto, c: 'oklch(84% 0.19 80.46)' },
    { l: 'Deducciones CCSS (empleado)', v: totales.totDed, c: 'oklch(70% 0.12 188)' },
    { l: 'Cargas patronales + INS', v: totales.totCar, c: 'oklch(55% 0.02 95)' },
  ].map((x) => ({
    ...x,
    w: totales.totCosto > 0 ? ((x.v / totales.totCosto) * 100).toFixed(1) + '%' : '0%',
    vFmt: money(x.v),
  }));
}

/** Costo por empleado, normalizado al mayor para dibujar las barras. */
export function buildCostoPorEmpleado(emps) {
  const max = Math.max(...emps.map((e) => e.costoQ), 1);
  return emps.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    ini: e.ini,
    avBg: e.avBg,
    avC: e.avC,
    costoFmt: e.costoFmt,
    w: ((e.costoQ / max) * 100).toFixed(0) + '%',
  }));
}

/**
 * Filas de Historial a partir de la lista de períodos — solo los `cerrado`
 * que ya tienen un `snapshot` real (congelado al momento de cerrar, ver
 * `cerrarPeriodo` en App.jsx). Nunca se recalcula con la nómina actual.
 *
 * `empN` es la cantidad de personas en la planilla de ese período (para
 * textos tipo "4 personas · archivada"). `pagadosN` es distinto: cuántas de
 * esas personas tenían `pago === 'pagado'` al momento real de cerrar — nada
 * impide cerrar un período con alguien todavía sin pagar, así que un texto
 * de "pagos ejecutados" debe usar `pagadosN`, nunca `empN`.
 */
export function buildHistorial(periodos) {
  return (periodos || [])
    .filter((p) => p.estado === 'cerrado' && p.snapshot)
    .map((p) => {
      // `neto` es el neto TOTAL de la planilla de ese período (todas las
      // personas, se les haya pagado o no antes del cierre) — `netoPagado`
      // es el dinero que realmente salió, la suma real de quienes sí
      // tenían `pago === 'pagado'` al momento de cerrar (mismo criterio que
      // `pagadosN`). Son dos hechos distintos: mostrar el total bajo una
      // etiqueta que dice "pagado" es lo que hacía que la misma tarjeta
      // pareciera contradecirse a sí misma (auditoría C6).
      const pagadosEmps = p.snapshot.emps.filter((e) => e.pago === 'pagado');
      const netoPagado = pagadosEmps.reduce((a, e) => a + e.neto, 0);
      return {
        id: p.id,
        periodo: p,
        p: p.titulo,
        empN: String(p.snapshot.emps.length),
        pagadosN: String(pagadosEmps.length),
        bruto: p.snapshot.totales.sumBruto,
        neto: p.snapshot.totales.sumNeto,
        netoPagado,
        costo: p.snapshot.totales.totCosto,
        brutoFmt: money(p.snapshot.totales.sumBruto),
        netoFmt: money(p.snapshot.totales.sumNeto),
        netoPagadoFmt: money(netoPagado),
        costoFmt: money(p.snapshot.totales.totCosto),
        ...withStatus('pagado'),
      };
    });
}

/**
 * Detalle por empleado de un período — el `abierto` se lee en vivo (no pasa
 * por acá, ver `data.planillaVista` en App.jsx); un `cerrado` real siempre
 * trae su propio `snapshot` congelado al momento del cierre, así que se
 * devuelve tal cual, sin recalcular con la nómina de hoy. Un `cerrado` sin
 * snapshot (no debería ocurrir con el flujo nuevo) devuelve vacío en vez de
 * inventar cifras.
 */
export function buildPeriodoDetalle(periodoObj) {
  if (periodoObj?.snapshot) return { emps: periodoObj.snapshot.emps, totales: periodoObj.snapshot.totales, periodo: periodoObj };
  return { emps: [], totales: buildTotales([]), periodo: periodoObj };
}

/** Historial de un empleado a través de los períodos cerrados reales (Drawer "Ver historial"). */
export function buildHistorialEmpleado(empIdSeleccionado, periodos) {
  return (periodos || [])
    .filter((p) => p.estado === 'cerrado' && p.snapshot)
    .map((p) => {
      const emp = p.snapshot.emps.find((e) => e.id === empIdSeleccionado);
      return emp ? { periodo: p, ...emp } : null;
    })
    .filter(Boolean);
}

/**
 * Siguiente período al cerrar el actual. Solo quincenal/mensual (los dos
 * tipos que ofrece Configuración) — sin pretensión de calendario legal.
 */
export function nextPeriodo(actual, tipo = 'quincenal') {
  const { anio, mesIndice } = actual;

  if (tipo === 'mensual') {
    let nMes = mesIndice + 1;
    let nAnio = anio;
    if (nMes > 11) {
      nMes = 0;
      nAnio += 1;
    }
    return {
      id: `m-${nAnio}-${nMes}`,
      etiqueta: `${MESES[nMes]} ${nAnio}`,
      titulo: `Mes de ${MESES[nMes].toLowerCase()} ${nAnio}`,
      mes: `${MESES[nMes]} ${nAnio}`,
      anio: nAnio,
      mesIndice: nMes,
      mitad: 'a',
      estado: 'abierto',
      snapshot: null,
    };
  }

  if (actual.mitad === 'a') {
    const ultimoDia = new Date(anio, mesIndice + 1, 0).getDate();
    return {
      id: `q-${anio}-${mesIndice}-b`,
      etiqueta: `Quincena · 16–${ultimoDia} ${MESES_ABR[mesIndice]} ${anio}`,
      titulo: `Quincena 16–${ultimoDia} de ${MESES[mesIndice].toLowerCase()} ${anio}`,
      mes: `${MESES[mesIndice]} ${anio}`,
      anio,
      mesIndice,
      mitad: 'b',
      estado: 'abierto',
      snapshot: null,
    };
  }

  let nMes = mesIndice + 1;
  let nAnio = anio;
  if (nMes > 11) {
    nMes = 0;
    nAnio += 1;
  }
  return {
    id: `q-${nAnio}-${nMes}-a`,
    etiqueta: `Quincena · 01–15 ${MESES_ABR[nMes]} ${nAnio}`,
    titulo: `Quincena 01–15 de ${MESES[nMes].toLowerCase()} ${nAnio}`,
    mes: `${MESES[nMes]} ${nAnio}`,
    anio: nAnio,
    mesIndice: nMes,
    mitad: 'a',
    estado: 'abierto',
    snapshot: null,
  };
}
