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
import { obligacionesBase, marcasCalendario, eventosBase, serieCostoMensual } from '../data/mock.js';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Añade a un estado sus tokens visuales (etiqueta, fondo, texto, punto). */
function withStatus(key) {
  const s = status[key];
  return { stL: s.l, stBg: s.bg, stC: s.c, stD: s.d };
}

/**
 * Empleados enriquecidos con los montos de la quincena y del mes, aplicando
 * los ajustes puntuales (horas extra, bono, deducción) sobre el salario
 * base. `tasas` viene de Configuración — nunca se importa un valor fijo
 * aquí, para que cambiarlas en esa pantalla recalcule todo lo demás.
 */
export function buildEmpleados(empleados, empIdSeleccionado, ajustesPorId = {}, tasas) {
  const DED = tasas.deduccionEmpleado;
  const CAR = tasas.cargasPatronales;

  return empleados.map((e, i) => {
    const ajuste = ajustesPorId[e.id] || {};
    const horasExtra = ajuste.horasExtra || 0;
    const bono = ajuste.bono || 0;
    const deduccionPuntual = ajuste.deduccion || 0;

    // Aproximación ilustrativa (240h/mes), no un cálculo legal de horas extra.
    const valorHoraOrdinaria = e.salario / 240;
    const pagoHorasExtra = valorHoraOrdinaria * 1.5 * horasExtra;

    const brutoBase = e.salario / 2; // quincena
    const bruto = Math.max(0, brutoBase + pagoHorasExtra + bono - deduccionPuntual);
    const ded = bruto * DED;
    const neto = bruto - ded;
    const car = bruto * CAR;
    const costo = bruto + car;
    const p = status[e.pago] || status.pendiente;
    const av = avatarPalette[i % avatarPalette.length];
    const seleccionado = e.id === empIdSeleccionado;
    const tieneAjuste = horasExtra > 0 || bono > 0 || deduccionPuntual > 0;

    return {
      ...e,
      ini: initials(e.nombre),
      avBg: av.bg,
      avC: av.c,

      // Ajustes puntuales de esta quincena
      horasExtra,
      bono,
      deduccionPuntual,
      tieneAjuste,

      // Quincena
      brutoQ: bruto,
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
      mCar: money(e.salario * CAR),
      mCosto: money(e.salario * (1 + CAR)),

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
  const totDed = emps.reduce((a, e) => a + (e.brutoQ - e.neto), 0);
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

/** Obligaciones con sus tokens de estado y el monto dinámico resuelto. */
export function buildObligaciones(totales) {
  return obligacionesBase.map((o) => {
    const monto = o.monto === null ? totales.pendiente : o.monto;
    return { ...o, monto, montoFmt: monto ? money(monto) : '—', ...withStatus(o.k) };
  });
}

/** Sólo lo accionable: vencido, próximo y pendiente. */
export function soloAtender(obligaciones) {
  return obligaciones.filter((o) => ['vencido', 'proximo', 'pendiente'].includes(o.k));
}

/**
 * Cuadrícula del calendario para el mes `(anio, mesIndice)`. Las marcas y el
 * resaltado de "hoy" solo existen para el mes de `hoy` — el mock no modela
 * otros meses, así que se muestran vacíos (responsabilidad de la pantalla
 * ofrecer un estado vacío, no de esta función inventar datos).
 */
export function buildCalendario(anio, mesIndice, hoy) {
  const esMesDeHoy = hoy && anio === hoy.anio && mesIndice === hoy.mesIndice;
  const primerDia = new Date(anio, mesIndice, 1).getDay();
  const diasDelMes = new Date(anio, mesIndice + 1, 0).getDate();
  const vacia = { empty: true, d: '', mk: false, bg: 'transparent', bd: 'transparent', num: 'oklch(70% 0 0)', wt: '400' };

  const celdas = [];
  for (let i = 0; i < primerDia; i++) celdas.push({ ...vacia, key: `pre-${i}` });

  for (let d = 1; d <= diasDelMes; d++) {
    const marca = esMesDeHoy && marcasCalendario[d] ? status[marcasCalendario[d]] : null;
    const esHoy = esMesDeHoy && d === hoy.dia;
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

/** Eventos del mes de `hoy` — array vacío para cualquier otro mes navegado. */
export function buildEventos(esMesDeHoy) {
  return esMesDeHoy ? eventosBase.map((e) => ({ ...e, ...withStatus(e.k) })) : [];
}

/** Nombre de mes + año para la cabecera del calendario. */
export function nombreMes(anio, mesIndice) {
  return `${MESES[mesIndice]} ${anio}`;
}

/** Barras del gráfico de costo laboral por mes; `rango` = cuántos meses recientes mostrar. */
export function buildBarras(rango = 6) {
  const serie = serieCostoMensual.slice(-rango);
  const max = Math.max(...serie.map(([, v]) => v));
  const ultimo = serie.length - 1;
  return serie.map(([m, v], i) => ({
    m,
    hStr: Math.round((v / max) * 100) + '%',
    vFmt: money(v * 1000),
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

/** Filas de Historial a partir de la lista de períodos — solo los `cerrado`. */
export function buildHistorial(periodos, totalesReferencia, empCount) {
  return periodos
    .filter((p) => p.estado === 'cerrado')
    .map((p) => ({
      id: p.id,
      periodo: p,
      p: p.titulo,
      empN: String(empCount),
      brutoFmt: money(totalesReferencia.sumBruto * p.factor),
      netoFmt: money(totalesReferencia.sumNeto * p.factor),
      costoFmt: money(totalesReferencia.totCosto * p.factor),
      ...withStatus('pagado'),
    }));
}

/**
 * Detalle por empleado de un período CERRADO — para "ver detalle de
 * planilla" (Historial, CCSS) y "ver historial" de un empleado. Reutiliza
 * `buildEmpleados`/`buildTotales` sobre la nómina actual, escalada por el
 * factor del período (mismo criterio que `buildHistorial`, a nivel de
 * empleado en vez de a nivel de total).
 */
export function buildPeriodoDetalle(periodoObj, empleados, tasas) {
  const base = buildEmpleados(empleados, null, {}, tasas);
  const factor = periodoObj.factor;
  const emps = base.map((e) => {
    const bruto = e.brutoQ * factor;
    const ded = bruto * tasas.deduccionEmpleado;
    const neto = bruto - ded;
    const car = bruto * tasas.cargasPatronales;
    const costo = bruto + car;
    return {
      ...e,
      brutoQ: bruto,
      neto,
      costoQ: costo,
      brutoFmt: money(bruto),
      dedFmt: money(ded),
      netoFmt: money(neto),
      carFmt: money(car),
      costoFmt: money(costo),
    };
  });
  return { emps, totales: buildTotales(emps), periodo: periodoObj };
}

/** Historial de un empleado a través de los períodos cerrados (Drawer "Ver historial"). */
export function buildHistorialEmpleado(empIdSeleccionado, periodos, empleados, tasas) {
  return periodos
    .filter((p) => p.estado === 'cerrado')
    .map((p) => {
      const det = buildPeriodoDetalle(p, empleados, tasas);
      const emp = det.emps.find((e) => e.id === empIdSeleccionado);
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
      factor: 1,
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
      factor: 1,
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
    factor: 1,
  };
}
