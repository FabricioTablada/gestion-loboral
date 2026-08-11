import { useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { color, status as statusTokens } from './theme/tokens.js';
import { screens, defaultScreen } from './navigation.js';
import { empleadosBase, configuracionBase, periodosBase, HOY } from './data/mock.js';
import {
  buildEmpleados,
  buildTotales,
  buildCcssCuota,
  buildInsMonto,
  parseTasaPorcentaje,
  buildObligaciones,
  soloAtender,
  buildCalendario,
  buildMarcasCalendario,
  buildEventosMes,
  nombreMes,
  buildSerieMensual,
  buildBarras,
  buildDistribucion,
  buildCostoPorEmpleado,
  buildHistorial,
  buildPeriodoDetalle,
  buildHistorialEmpleado,
  nextPeriodo,
} from './lib/payroll.js';

import { SidebarContent } from './components/Sidebar.jsx';
import { Drawer } from './components/ui/Drawer.jsx';
import { IconMenu } from './components/ui/Icons.jsx';
import { ToastProvider, useToast } from './components/ui/Toast.jsx';

import Panel from './screens/Panel.jsx';
import Empleados from './screens/Empleados.jsx';
import Planilla from './screens/Planilla.jsx';
import Pagos from './screens/Pagos.jsx';
import Calendario from './screens/Calendario.jsx';
import Reportes from './screens/Reportes.jsx';
import Historial from './screens/Historial.jsx';
import Configuracion from './screens/Configuracion.jsx';

/**
 * Destinos que ya no son pantallas propias: las viejas `#ccss` y `#ins` eran
 * paneles standalone con exactamente los mismos datos que los dossiers de
 * Obligaciones. Se conservan como *alias* para que un enlace guardado o una
 * obligación con `target: 'ccss'` sigan llevando al lugar correcto, ahora
 * dentro de Obligaciones.
 */
const DOSSIER_ALIAS = { ccss: 'ccss', ins: 'ins' };

/** Lee la pantalla desde el hash de la URL, si es válida. */
function screenFromHash() {
  const key = window.location.hash.replace('#', '');
  if (screens[key]) return key;
  if (DOSSIER_ALIAS[key]) return 'calendario'; // enlace viejo #ccss / #ins
  return defaultScreen;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Persistencia mínima de la sesión — mientras no hay backend, el estado
 * mutable (empleados, períodos con sus snapshots, config, CCSS/INS…) se
 * guarda en `localStorage` para sobrevivir a un refresh. Un solo blob, leído
 * una vez al montar y reescrito cada vez que algo mutable cambia.
 */
const STORAGE_KEY = 'gl-datos-v2'; // v2: se cargaron los 4 trabajadores reales iniciales

// Tamaño máximo real de un comprobante que se guarda con su contenido
// (dataUrl en base64) dentro del mismo blob de localStorage — deja margen
// dentro de la cuota típica del navegador (5–10MB) compartida con el resto
// de los datos de la app. Un archivo más grande igual guarda sus metadatos
// reales (nombre, tamaño, tipo, fecha), solo que sin el contenido.
const ARCHIVO_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Corrige la clave de mes off-by-one que tenía la versión anterior de
 * `mesKeyDe` (usaba el índice de mes base-0 sin +1, así que un pago de
 * agosto — mesIndice 7 — quedaba archivado bajo la clave "2026-07", julio).
 * Se aplica una sola vez sobre datos ya guardados: el blob persistido lleva
 * la marca `_mesKeyFix` para no volver a correr la corrección sobre datos
 * que ya están bien (ver auditoría C5).
 */
function corregirClavesDeMes(porMes) {
  if (!porMes) return porMes;
  const out = {};
  for (const [key, val] of Object.entries(porMes)) {
    const m = /^(\d{4})-(\d{2})$/.exec(key);
    if (!m) {
      out[key] = val; // clave con forma inesperada — se conserva tal cual, no se inventa una corrección
      continue;
    }
    let anio = parseInt(m[1], 10);
    let mes = parseInt(m[2], 10) + 1; // la clave vieja guardaba el mesIndice (base-0) directo
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
    out[`${anio}-${String(mes).padStart(2, '0')}`] = val;
  }
  return out;
}

/**
 * Migra `ajustes` del formato viejo (un único objeto `{horasExtra, bono,
 * deduccion}` por empleado, que el siguiente ajuste reemplazaba entero) al
 * formato de movimientos acumulables (lista de ajustes firmados, cada uno
 * con su propio timestamp real — ver auditoría F14). Idempotente: un valor
 * que ya es un arreglo se deja tal cual.
 */
function migrarAjustes(ajustes) {
  if (!ajustes) return ajustes;
  const out = {};
  for (const [id, val] of Object.entries(ajustes)) {
    if (Array.isArray(val)) {
      out[id] = val;
      continue;
    }
    if (val && typeof val === 'object') {
      const horasExtra = val.horasExtra || 0;
      const bono = val.bono || 0;
      const deduccion = val.deduccion || 0;
      if (horasExtra || bono || deduccion) {
        // Sin timestamp real de cuándo se firmó originalmente — se usa el
        // momento de la migración en vez de inventar una fecha pasada.
        out[id] = [{ horasExtra, bono, deduccion, fecha: Date.now() }];
      }
    }
  }
  return out;
}

/**
 * Rellena la configuración guardada con las claves que se agregaron después
 * (usuario de la sesión, métodos de pago, parámetros de horas extra). Una
 * sesión guardada antes de que existieran no las trae, y sin esto la app
 * arrancaba con `config.usuario` en `undefined` y reventaba al leer su
 * nombre. Solo completa lo que falta — nunca pisa un valor ya elegido.
 */
function completarConfig(config) {
  if (!config) return clone(configuracionBase);
  return {
    ...clone(configuracionBase),
    ...config,
    empresa: { ...configuracionBase.empresa, ...config.empresa },
    tasas: { ...configuracionBase.tasas, ...config.tasas },
    poliza: { ...configuracionBase.poliza, ...config.poliza },
    usuario: { ...configuracionBase.usuario, ...config.usuario },
    metodosPago:
      Array.isArray(config.metodosPago) && config.metodosPago.length > 0 ? config.metodosPago : [...configuracionBase.metodosPago],
  };
}

/** Migraciones de compatibilidad sobre el blob persistido — nunca se pierde
 * un dato real, solo se corrige su forma. */
function migrarGuardado(datos) {
  if (!datos) return datos;
  let out = datos;
  if (out.config) out = { ...out, config: completarConfig(out.config) };
  if (!out._mesKeyFix) {
    out = {
      ...out,
      ccssEstadoPorMes: corregirClavesDeMes(out.ccssEstadoPorMes),
      insEstadoPorMes: corregirClavesDeMes(out.insEstadoPorMes),
      _mesKeyFix: true,
    };
  }
  if (out.ajustes) out = { ...out, ajustes: migrarAjustes(out.ajustes) };
  return out;
}

function cargarGuardado() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? migrarGuardado(JSON.parse(raw)) : null;
  } catch {
    return null; // datos corruptos o storage no disponible — se arranca desde la base
  }
}

/** "09 ago 2026" — mismo formato corto que ya usan fechaPago/ingreso en el resto de la app. */
const MESES_ABR_APP = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaCortaHoy() {
  return `${String(HOY.dia).padStart(2, '0')} ${MESES_ABR_APP[HOY.mesIndice]} ${HOY.anio}`;
}

/** Clave del mes real ("2026-08") del período dado — ancla CCSS/INS a un mes concreto, nunca a un booleano global. */
function mesKeyDe(periodo) {
  if (!periodo) return null;
  return `${periodo.anio}-${String(periodo.mesIndice + 1).padStart(2, '0')}`;
}

function shiftMonth({ anio, mesIndice }, delta) {
  let m = mesIndice + delta;
  let a = anio;
  while (m > 11) {
    m -= 12;
    a += 1;
  }
  while (m < 0) {
    m += 12;
    a -= 1;
  }
  return { anio: a, mesIndice: m };
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}

function AppShell() {
  const toast = useToast();

  const [screen, setScreen] = useState(screenFromHash);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // "Base de datos" de la sesión — mutable, persistida en localStorage (ver
  // `cargarGuardado`/efecto de guardado más abajo) hasta que haya backend.
  const [guardado] = useState(cargarGuardado); // se lee una sola vez al montar

  const [empleados, setEmpleados] = useState(() => guardado?.empleados ?? empleadosBase.map((e) => ({ ...e })));
  const [empId, setEmpId] = useState(() => guardado?.empId ?? (empleadosBase.find((e) => e.activo) || empleadosBase[0])?.id ?? null);
  const [ajustes, setAjustes] = useState(() => guardado?.ajustes ?? {}); // { [empId]: { horasExtra, bono, deduccion } } del período activo
  const [periodos, setPeriodos] = useState(() => guardado?.periodos ?? periodosBase.map((p) => ({ ...p })));
  const [periodoVerId, setPeriodoVerId] = useState(null); // null = período activo
  const [config, setConfig] = useState(() => guardado?.config ?? clone(configuracionBase));
  // CCSS/INS son obligaciones MENSUALES, independientes del ciclo quincenal
  // de planilla — el estado se guarda por mes ("2026-07": {...}), nunca como
  // un solo booleano global. Un mes sin entrada todavía es honestamente
  // "pendiente" (no se inventa ni se arrastra el estado del mes anterior).
  const [ccssEstadoPorMes, setCcssEstadoPorMes] = useState(() => guardado?.ccssEstadoPorMes ?? {});
  const [insEstadoPorMes, setInsEstadoPorMes] = useState(() => guardado?.insEstadoPorMes ?? {});
  // Historial real de pagos CCSS/INS — arranca vacío, ya no viene de mock.js.
  const [ccssHistorial, setCcssHistorial] = useState(() => guardado?.ccssHistorial ?? []);
  const [insHistorial, setInsHistorial] = useState(() => guardado?.insHistorial ?? []);
  // Notificaciones (Fase 11): no son una lista propia — se derivan más abajo
  // de las obligaciones reales (misma fuente que "Atender"). Lo único que se
  // guarda acá es qué ids ya se leyeron; el id de cada notificación incluye
  // el mes/período real, así que un mismo evento activo nunca vuelve a
  // aparecer sin leer dos veces, y una escalada real (p. ej. "próximo" →
  // "vencido") sí genera un id nuevo — es un hecho distinto, no un duplicado.
  const [notifLeidas, setNotifLeidas] = useState(() => guardado?.notifLeidas ?? []);
  const [calMes, setCalMes] = useState({ anio: HOY.anio, mesIndice: HOY.mesIndice });
  const [reportesRango, setReportesRango] = useState(6);
  const [dossierInicial, setDossierInicial] = useState(null); // 'ccss' | 'ins' — tab a abrir al entrar a Obligaciones desde fuera
  const [abrirNuevoEmpleado, setAbrirNuevoEmpleado] = useState(false); // true = abrir el modal de alta al entrar a Equipo desde fuera

  // Guarda cada cambio de estado mutable — así sobrevive a un refresh.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        // `_mesKeyFix: true` marca que las claves de mes de este blob ya
        // están corregidas (ver `corregirClavesDeMes`) — así una recarga no
        // vuelve a desplazarlas un mes.
        JSON.stringify({ empleados, empId, ajustes, periodos, config, ccssEstadoPorMes, insEstadoPorMes, ccssHistorial, insHistorial, notifLeidas, _mesKeyFix: true }),
      );
    } catch {
      // almacenamiento no disponible (modo privado, cuota llena…) — no interrumpe la app
    }
  }, [empleados, empId, ajustes, periodos, config, ccssEstadoPorMes, insEstadoPorMes, ccssHistorial, insHistorial, notifLeidas]);

  // El hash mantiene la pantalla al recargar y hace funcionar el botón atrás.
  // Este listener solo sincroniza `screen` — no pasa por `navigate()`, así
  // que el efecto de abajo es la única fuente que limpia `periodoVerId`.
  useEffect(() => {
    const sync = () => setScreen(screenFromHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  // `periodoVerId` solo tiene sentido dentro de Planilla (ver `verPeriodo`).
  // Antes se limpiaba solo dentro de `navigate()`, así que llegar a otra
  // pantalla por el botón atrás/adelante del navegador (evento `hashchange`,
  // que no pasa por `navigate()`) lo dejaba pegado: el selector de período
  // de CCSS/INS/Configuración seguía mostrando el archivado que se estaba
  // viendo en Planilla (auditoría F9). Fuente única: cualquier pantalla que
  // no sea Planilla siempre muestra el período activo.
  useEffect(() => {
    if (screen !== 'planilla') setPeriodoVerId(null);
  }, [screen]);

  function navigate(key) {
    if (!screens[key]) return;
    setPeriodoVerId(null); // volver a Planilla desde el menú siempre muestra el período activo
    window.location.hash = key;
    setScreen(key);
  }

  /** Abre Planilla mostrando un período concreto (activo o cerrado, solo lectura). */
  function verPeriodo(periodoId) {
    setPeriodoVerId(periodoId);
    window.location.hash = 'planilla';
    setScreen('planilla');
  }

  /** Entra a Obligaciones y abre directamente el dossier de CCSS o INS —
   *  usado desde el Home, mismo criterio que "Atender X" dentro de Obligaciones. */
  function irADossier(tab) {
    setDossierInicial(tab);
    navigate('calendario');
  }

  /**
   * Punto único para "llevame a este destino", donde el destino puede venir
   * de una obligación (`target: 'ccss' | 'ins' | 'pagos'`), de una
   * notificación o de un enlace viejo. `ccss`/`ins` ya no son pantallas: se
   * resuelven abriendo su dossier dentro de Obligaciones.
   */
  function irATarget(target) {
    if (DOSSIER_ALIAS[target]) irADossier(DOSSIER_ALIAS[target]);
    else navigate(target);
  }

  /** "Agregar empleado" desde las acciones rápidas del Home: antes solo
   *  navegaba a Equipo sin abrir el formulario. Mismo mecanismo que
   *  `irADossier` para CCSS/INS. */
  function irAAgregarEmpleado() {
    setAbrirNuevoEmpleado(true);
    navigate('empleados');
  }

  function navigateFromMobileNav(key) {
    navigate(key);
    setMobileNavOpen(false);
  }

  // Al cambiar de pantalla el contenido vuelve arriba. `useLayoutEffect` (no
  // `useEffect`) para que el scroll quede en 0 ANTES de que el navegador
  // pinte la pantalla nueva — si no, se alcanzaba a ver la pantalla nueva
  // montada en la posición de scroll de la pantalla anterior durante un
  // frame, y recién ahí "saltaba" arriba (la transición se sentía rota).
  useLayoutEffect(() => {
    document.getElementById('app-content')?.scrollTo({ top: 0 });
  }, [screen]);

  useEffect(() => {
    document.title = `${screens[screen].title} · Gestión Laboral`;
  }, [screen]);

  // Todos los datos derivados en un solo paso, a partir del estado mutable.
  const data = useMemo(() => {
    const periodoActivo = periodos.find((p) => p.estado === 'abierto');
    const periodoMostrado = periodoVerId ? periodos.find((p) => p.id === periodoVerId) || periodoActivo : periodoActivo;
    const esActivoMostrado = periodoMostrado?.id === periodoActivo?.id;

    // Tasa real de la póliza INS (Riesgos del Trabajo) — cargo patronal
    // aparte de la CCSS, nunca mezclado en una sola cifra (ver Fase 4).
    const tasaIns = parseTasaPorcentaje(config.poliza.tasa);
    // Para pantallas que solo necesitan "el % combinado de cargas" (Reportes:
    // deriva bruto desde el costo total, que ya incluye CCSS patronal + INS
    // sumadas) — nunca se usa para CCSS-solo (eso sigue siendo config.tasas).
    const tasasCostos = { ...config.tasas, cargasPatronales: config.tasas.cargasPatronales + tasaIns };
    const horasExtraParams = { jornadaHorasMes: config.jornadaHorasMes, factorHoraExtra: config.factorHoraExtra };
    const emps = buildEmpleados(empleados, empId, ajustes, config.tasas, tasaIns, horasExtraParams);
    const empsActivos = emps.filter((e) => e.activo);
    const totales = buildTotales(empsActivos);

    // Cuota CCSS real del MES (obrera + patronal) — la CCSS se paga mensual,
    // no por quincena; misma fórmula que usa el dossier de Obligaciones,
    // única fuente para toda la app (nada de montos fijos ni la mitad de
    // una quincena representando el mes completo).
    const ccssCuota = buildCcssCuota(empsActivos, config.tasas);
    // Monto estimado real del reporte INS del mes — única fuente, misma
    // función que usan Ins.jsx y el dossier de INS en Calendario.jsx.
    const insMonto = buildInsMonto(empsActivos, config.poliza);

    // CCSS/INS son obligaciones del mes real del período activo — nunca un
    // booleano global. Un mes sin entrada todavía (nuevo mes, o ninguno
    // registrado aún) es honestamente "pendiente"/"no regularizado".
    const mesActualKey = mesKeyDe(periodoActivo);
    const ccssEstado = ccssEstadoPorMes[mesActualKey] || { pagada: false, archivo: null };
    const insEstado = insEstadoPorMes[mesActualKey] || { alDia: false, archivo: null };
    // El hecho real congelado del mes activo (si ya se pagó/regularizó) —
    // única fuente para mostrar montos ya ocurridos, nunca la cuota en vivo
    // recalculada con las tasas de hoy (auditoría C1). `mesKey` ancla el
    // registro al mes real en vez de a un texto de período.
    const ccssPagoDelMes = ccssHistorial.find((h) => h.mesKey === mesActualKey) || null;
    const insPagoDelMes = insHistorial.find((h) => h.mesKey === mesActualKey) || null;

    // Las obligaciones de CCSS/INS/planilla se resuelven con lo que ya pasó
    // en esas pantallas — el Panel y el Calendario nunca quedan desactualizados.
    const obligaciones = buildObligaciones(totales, empsActivos.length, periodoActivo, config, ccssCuota, insMonto).map((o) => {
      let k = o.k;
      if (o.target === 'ccss' && (o.k === 'proximo' || o.k === 'vencido') && ccssEstado.pagada) k = 'pagado';
      else if (o.target === 'ins' && (o.k === 'proximo' || o.k === 'vencido') && insEstado.alDia) k = 'aldia';
      else if (o.target === 'pagos' && o.k === 'pendiente' && totales.pendCount === 0) k = 'pagado';
      if (k === o.k) return o;
      const s = statusTokens[k];
      return { ...o, k, stL: s.l, stBg: s.bg, stC: s.c, stD: s.d };
    });

    const planillaVista = esActivoMostrado
      ? { emps: empsActivos, totales, periodo: periodoMostrado, readOnly: false }
      : (() => {
          const det = buildPeriodoDetalle(periodoMostrado);
          return { emps: det.emps, totales: det.totales, periodo: periodoMostrado, readOnly: true };
        })();

    const serieMensual = buildSerieMensual(periodos, totales);

    return {
      emps,
      empsActivos,
      totales,
      ccssCuota,
      insMonto,
      tasasCostos,
      ccssEstado,
      insEstado,
      ccssPagoDelMes,
      insPagoDelMes,
      insObligacion: obligaciones.find((o) => o.target === 'ins') || null,
      mesActualKey,
      obligaciones,
      atender: soloAtender(obligaciones),
      // Notificaciones reales (Fase 11): una por cada obligación realmente
      // por atender (vencida/próxima/pendiente), con su monto, fecha y
      // origen — misma fuente que "Atender" en el Home y en Obligaciones,
      // nunca un evento inventado. El id ancla el mes/período real de cada
      // obligación (CCSS/INS son mensuales; el pago de planilla es por
      // período), así que mientras el mismo evento siga activo con el mismo
      // estado, conserva el mismo id — no se duplica — y si escala (p. ej.
      // "próximo" pasa a "vencido") el id cambia, porque es un hecho
      // realmente distinto. `leida` se resuelve fuera de este memo (ver más
      // abajo) para que marcar una como leída no recalcule toda la planilla.
      notificaciones: soloAtender(obligaciones).map((o) => ({
        id: `${o.target}-${o.k}-${o.target === 'pagos' ? periodoActivo?.id || 'sin-periodo' : mesActualKey || 'sin-mes'}`,
        titulo: o.t,
        detalle: o.d || '',
        montoFmt: o.montoFmt,
        fecha: o.fecha,
        tono: o.k,
        target: o.target,
      })),
      semanas: buildCalendario(calMes.anio, calMes.mesIndice, HOY, buildMarcasCalendario(obligaciones, calMes.anio, calMes.mesIndice)),
      eventos: buildEventosMes(obligaciones, calMes.anio, calMes.mesIndice),
      mesLabel: nombreMes(calMes.anio, calMes.mesIndice),
      barras: buildBarras(serieMensual, reportesRango),
      // Serie de hasta 12 meses reales para el gráfico "El pulso" del Home —
      // independiente del selector 3/6/12 de Reportes, para no acoplar ambas pantallas.
      barrasHome: buildBarras(serieMensual, 12),
      distribucion: buildDistribucion(totales),
      costoPorEmpleado: buildCostoPorEmpleado(empsActivos),
      historial: buildHistorial(periodos),
      selEmp: emps.find((e) => e.id === empId) || emps[0],
      periodoActivo,
      periodoMostrado,
      planillaVista,
    };
  }, [empleados, empId, ajustes, config, periodos, periodoVerId, calMes, reportesRango, ccssEstadoPorMes, insEstadoPorMes, ccssHistorial, insHistorial]);

  // Ver comentario en `data.notificaciones` — separado del memo pesado de
  // arriba para que marcar una notificación como leída no vuelva a calcular
  // toda la planilla.
  const notificaciones = data.notificaciones.map((n) => ({ ...n, leida: notifLeidas.includes(n.id) }));

  /**
   * Marca una notificación como leída (persistente) y navega a su pantalla
   * real — CCSS/INS resuelven al dossier de Obligaciones (`irATarget` ya
   * hace ese alias), Planilla navega directo.
   */
  function irANotificacion(n) {
    setNotifLeidas((list) => (list.includes(n.id) ? list : [...list, n.id]));
    irATarget(n.target);
  }

  /* ---------------------------------------------------------
     Empleados
     --------------------------------------------------------- */
  function crearEmpleado(datos) {
    setEmpleados((list) => {
      const nextId = list.reduce((max, e) => Math.max(max, e.id), 0) + 1;
      return [
        ...list,
        {
          id: nextId,
          activo: true,
          pago: 'pendiente',
          metodo: '—',
          fechaPago: '—',
          // Registro financiero manual (Fase 10) — mismo criterio de
          // "placeholder honesto" que `metodo`/`fechaPago`: vacío hasta que
          // haya un pago real que lo llene.
          referenciaPago: '—',
          comisionPago: 0,
          conciliado: false,
          conciliadoFecha: '—',
          ...datos,
        },
      ];
    });
    toast.push('Empleado agregado', { tone: 'success' });
  }

  function editarEmpleado(id, datos) {
    setEmpleados((list) => list.map((e) => (e.id === id ? { ...e, ...datos } : e)));
    toast.push('Cambios guardados', { tone: 'success' });
  }

  function alternarActivoEmpleado(id) {
    let activo = true;
    setEmpleados((list) =>
      list.map((e) => {
        if (e.id !== id) return e;
        activo = !e.activo;
        return { ...e, activo };
      }),
    );
    toast.push(activo ? 'Empleado reactivado' : 'Empleado dado de baja', { tone: activo ? 'success' : 'default' });
  }

  /** Un empleado con historial en algún período cerrado no se puede borrar de verdad — se da de baja. */
  function tienePeriodosCerrados(id) {
    return periodos.some((p) => p.estado === 'cerrado' && p.snapshot?.emps?.some((e) => e.id === id));
  }

  function eliminarEmpleado(id) {
    if (tienePeriodosCerrados(id)) {
      toast.push('No se puede eliminar: tiene historial de períodos cerrados. Dalo de baja en su lugar.', { tone: 'danger' });
      return;
    }
    setEmpleados((list) => list.filter((e) => e.id !== id));
    // Sin esto, el ajuste del empleado eliminado quedaba huérfano en
    // `ajustes` (y por lo tanto en localStorage) para siempre — nadie podía
    // volver a leerlo ni limpiarlo.
    setAjustes((a) => {
      if (!(id in a)) return a;
      const { [id]: _eliminado, ...resto } = a;
      return resto;
    });
    if (empId === id) {
      const restante = empleados.find((e) => e.id !== id);
      setEmpId(restante ? restante.id : null);
    }
    toast.push('Empleado eliminado', { tone: 'default' });
  }

  function getHistorialEmpleado(id) {
    return buildHistorialEmpleado(id, periodos);
  }

  /* ---------------------------------------------------------
     Planilla
     --------------------------------------------------------- */
  /**
   * Registra un movimiento nuevo (horas extra / bono / deducción) para el
   * período abierto. Se acumula sobre los movimientos ya firmados en vez de
   * reemplazarlos — antes un segundo bono borraba al primero porque
   * `ajustes[idEmp]` guardaba un único objeto que cada "Registrar ajuste"
   * pisaba entero (auditoría F14). Cada movimiento lleva su timestamp real
   * de cuándo se firmó, no una posición inventada en un timeline.
   */
  function guardarAjuste(idEmp, ajuste) {
    const horasExtra = ajuste.horasExtra || 0;
    const bono = ajuste.bono || 0;
    const deduccion = ajuste.deduccion || 0;
    if (!horasExtra && !bono && !deduccion) return; // nada real que firmar
    setAjustes((a) => ({
      ...a,
      [idEmp]: [...(a[idEmp] || []), { horasExtra, bono, deduccion, fecha: Date.now() }],
    }));
    toast.push('Ajuste aplicado a la planilla', { tone: 'success' });
  }

  function cerrarPeriodo() {
    const activo = data.periodoActivo;
    if (!activo) return;
    // Snapshot real, congelado en este instante — el período cerrado ya no
    // se vuelve a calcular con la nómina de más adelante (ver payroll.js).
    // Conserva a cualquiera con actividad real en ESTE período (sigue activo,
    // o ya se le pagó) — no solo a quien siga activo en el instante exacto
    // de cerrar. Dar de baja a alguien después de pagarle no debe borrar ese
    // pago del historial: solo saca a quien nunca tuvo actividad real acá.
    const empsAlCierre = buildEmpleados(empleados, null, ajustes, config.tasas, parseTasaPorcentaje(config.poliza.tasa), {
      jornadaHorasMes: config.jornadaHorasMes,
      factorHoraExtra: config.factorHoraExtra,
    }).filter((e) => e.activo || e.pago === 'pagado');
    const snapshot = { emps: empsAlCierre, totales: buildTotales(empsAlCierre) };
    const siguiente = nextPeriodo(activo, config.periodoTipo);
    setPeriodos((list) => [siguiente, ...list.map((p) => (p.id === activo.id ? { ...p, estado: 'cerrado', snapshot } : p))]);
    setAjustes({});
    setPeriodoVerId(null);
    // El estado de pago es de ESTE período, nunca del siguiente — se resetea
    // para todos al abrir el próximo (también para quien esté dado de baja,
    // para que no reaparezca "pagado" sin serlo si se reactiva más adelante).
    // El registro financiero manual (referencia, comisión, conciliación) es
    // del mismo pago que se resetea acá — nunca debe sobrevivir pegado a un
    // período distinto; ya quedó congelado en `empsAlCierre` arriba.
    setEmpleados((list) =>
      list.map((e) => ({
        ...e,
        pago: 'pendiente',
        metodo: '—',
        fechaPago: '—',
        referenciaPago: '—',
        comisionPago: 0,
        conciliado: false,
        conciliadoFecha: '—',
      })),
    );
    toast.push(`Período cerrado. Se abrió ${siguiente.etiqueta}`, { tone: 'success' });
  }

  /* ---------------------------------------------------------
     Pagos
     --------------------------------------------------------- */
  /**
   * `referencia`/`comision` son el registro financiero manual (Fase 10):
   * ambos opcionales, nunca inventados si no llegan del modal. `conciliado`
   * arranca siempre en `false` — confirmar contra el estado de cuenta es una
   * acción manual posterior y separada (ver `alternarConciliacion`), nunca
   * algo que "marcar como pagado" pueda dar por hecho.
   */
  function marcarPagado(idEmp, { metodo, fecha, referencia, comision }) {
    setEmpleados((list) =>
      list.map((e) =>
        e.id === idEmp
          ? { ...e, pago: 'pagado', metodo, fechaPago: fecha, referenciaPago: referencia?.trim() || '—', comisionPago: Number(comision) || 0, conciliado: false, conciliadoFecha: '—' }
          : e,
      ),
    );
    toast.push('Pago registrado', { tone: 'success' });
  }

  function marcarPagadoLote(ids, { metodo, fecha, referencia, comision }) {
    setEmpleados((list) =>
      list.map((e) =>
        ids.includes(e.id)
          ? { ...e, pago: 'pagado', metodo, fechaPago: fecha, referenciaPago: referencia?.trim() || '—', comisionPago: Number(comision) || 0, conciliado: false, conciliadoFecha: '—' }
          : e,
      ),
    );
    toast.push(`${ids.length} pagos registrados`, { tone: 'success' });
  }

  /**
   * Conciliación manual (Fase 10): confirma o revierte a mano que este pago
   * ya apareció en el estado de cuenta del banco. No hay integración
   * bancaria que lo verifique solo — es exactamente lo que el cliente pidió,
   * un estado que la persona marca ella misma después de revisar. Solo tiene
   * sentido sobre un pago que ya salió; no hace nada si todavía no se marcó
   * como pagado.
   */
  function alternarConciliacion(idEmp) {
    let conciliado = true;
    setEmpleados((list) =>
      list.map((e) => {
        if (e.id !== idEmp || e.pago !== 'pagado') return e;
        conciliado = !e.conciliado;
        return { ...e, conciliado, conciliadoFecha: conciliado ? fechaCortaHoy() : '—' };
      }),
    );
    toast.push(conciliado ? 'Pago conciliado' : 'Conciliación revertida', { tone: conciliado ? 'success' : 'default' });
  }

  /* ---------------------------------------------------------
     CCSS / INS
     --------------------------------------------------------- */
  function adjuntarCcssArchivo(archivo) {
    const mes = data.mesActualKey;
    if (!mes) return;
    // El contenido real (dataUrl en base64) solo se guarda si entra en el
    // presupuesto de localStorage — de lo contrario se pierde el adjunto
    // completo, así que se conservan igual los metadatos reales (nombre,
    // tamaño, tipo, fecha) en vez de descartar todo (auditoría F15).
    const cabe = !archivo.size || archivo.size <= ARCHIVO_MAX_BYTES;
    const guardado = cabe ? archivo : { ...archivo, dataUrl: null };
    setCcssEstadoPorMes((m) => ({ ...m, [mes]: { ...(m[mes] || { pagada: false, archivo: null }), archivo: guardado } }));
    toast.push(cabe ? 'Comprobante adjuntado' : 'Comprobante adjuntado (archivo muy pesado: se guardó el nombre, no el contenido)');
  }

  /**
   * `datos` viene del modal de registro real (Calendario.jsx →
   * `RegistroComprobanteModal`): fecha, monto y método elegidos a mano, más
   * una referencia opcional — Fase 9. Antes esta función no recibía nada y
   * congelaba en silencio la fecha de hoy (`fechaCortaHoy()`) y el total
   * calculado, sin poder registrar cómo ni con qué referencia se pagó.
   * Sigue siendo defensiva ante una llamada sin `datos` (no debería ocurrir
   * con el flujo nuevo) para no perder el registro por un dato faltante.
   */
  function marcarCcssPagada(datos) {
    const mes = data.mesActualKey;
    if (!mes) return;
    setCcssEstadoPorMes((m) => ({ ...m, [mes]: { ...(m[mes] || { pagada: false, archivo: null }), pagada: true } }));
    const monto = Number.isFinite(datos?.monto) ? datos.monto : data.ccssCuota.total;
    const fechaPago = datos?.fecha || fechaCortaHoy();
    const metodo = datos?.metodo || '';
    const referencia = datos?.referencia?.trim() || '';
    // Congela el hecho completo, no solo el total: monto real pagado,
    // desglose obrera/patronal y las tasas realmente aplicadas ese día — así,
    // si Configuración cambia las tasas después, el dossier puede seguir
    // mostrando exactamente lo que se pagó en su momento, en vez de
    // recalcularlo con la tasa de hoy (auditoría C1). `mesKey` es la clave
    // real de ancla (ver `mesKeyDe`), para que la pantalla pueda encontrar
    // este pago sin depender del texto de `periodo`.
    setCcssHistorial((list) => [
      {
        id: `ccss-${Date.now()}`,
        mesKey: mes,
        periodo: data.periodoActivo?.mes || '',
        detalle: `Pagada ${fechaPago}${metodo ? ` · ${metodo}` : ''}${referencia ? ` · Ref. ${referencia}` : ''}`,
        fechaPago,
        metodo,
        referencia,
        monto,
        obrera: data.ccssCuota.obrera,
        patronal: data.ccssCuota.patronal,
        tasaObrera: config.tasas.deduccionEmpleado,
        tasaPatronal: config.tasas.cargasPatronales,
      },
      ...list,
    ]);
    toast.push('Cuota CCSS registrada como pagada', { tone: 'success' });
  }

  function adjuntarInsArchivo(archivo) {
    const mes = data.mesActualKey;
    if (!mes) return;
    const cabe = !archivo.size || archivo.size <= ARCHIVO_MAX_BYTES;
    const guardado = cabe ? archivo : { ...archivo, dataUrl: null };
    setInsEstadoPorMes((m) => ({ ...m, [mes]: { ...(m[mes] || { alDia: false, archivo: null }), archivo: guardado } }));
    toast.push(cabe ? 'Comprobante adjuntado' : 'Comprobante adjuntado (archivo muy pesado: se guardó el nombre, no el contenido)');
  }

  /** Mismo criterio que `marcarCcssPagada` — ver ese comentario. */
  function regularizarIns(datos) {
    const mes = data.mesActualKey;
    if (!mes) return;
    setInsEstadoPorMes((m) => ({ ...m, [mes]: { ...(m[mes] || { alDia: false, archivo: null }), alDia: true } }));
    const monto = Number.isFinite(datos?.monto) ? datos.monto : data.insMonto.monto;
    const fechaPago = datos?.fecha || fechaCortaHoy();
    const metodo = datos?.metodo || '';
    const referencia = datos?.referencia?.trim() || '';
    // Mismo criterio que CCSS: se congela el monto real Y la tasa aplicada
    // ese día (`tasa`), para que un cambio posterior de `poliza.tasa` en
    // Configuración nunca reescriba un reporte ya regularizado (auditoría C1).
    setInsHistorial((list) => [
      {
        id: `ins-${Date.now()}`,
        mesKey: mes,
        periodo: data.periodoActivo?.mes || '',
        detalle: `Regularizado ${fechaPago}${metodo ? ` · ${metodo}` : ''}${referencia ? ` · Ref. ${referencia}` : ''}`,
        fechaPago,
        metodo,
        referencia,
        monto,
        tasa: data.insMonto.tasa,
      },
      ...list,
    ]);
    toast.push('Reporte INS registrado como regularizado', { tone: 'success' });
  }

  /* ---------------------------------------------------------
     Configuración
     --------------------------------------------------------- */
  function actualizarConfig(patch) {
    setConfig((c) => ({ ...c, ...patch }));
    toast.push('Configuración guardada', { tone: 'success' });
  }

  const vistas = {
    panel: (
      <Panel
        emps={data.empsActivos}
        totales={data.totales}
        atender={data.atender}
        distribucion={data.distribucion}
        barras={data.barrasHome}
        periodoActivo={data.periodoActivo}
        usuario={config.usuario}
        empresaNombre={config.empresa.nombre}
        poliza={config.poliza}
        ccssCuota={data.ccssCuota}
        notificaciones={notificaciones}
        onNotifClick={irANotificacion}
        onNavigate={navigate}
        onAbrirDossier={irADossier}
        onAgregarEmpleado={irAAgregarEmpleado}
        onSeleccionarEmpleado={(id) => {
          setEmpId(id);
          navigate('empleados');
        }}
      />
    ),
    empleados: (
      <Empleados
        emps={data.emps}
        selEmp={data.selEmp}
        onSelect={setEmpId}
        onCrear={crearEmpleado}
        onEditar={editarEmpleado}
        onAlternarActivo={alternarActivoEmpleado}
        onEliminar={eliminarEmpleado}
        getHistorial={getHistorialEmpleado}
        tasas={config.tasas}
        usuario={config.usuario}
        empresaNombre={config.empresa.nombre}
        actividad={config.empresa.actividad}
        notificaciones={notificaciones}
        onNotifClick={irANotificacion}
        onNavigate={navigate}
        abrirNuevo={abrirNuevoEmpleado}
        onNuevoAbierto={() => setAbrirNuevoEmpleado(false)}
      />
    ),
    planilla: (
      <Planilla
        vista={data.planillaVista}
        periodoTipo={config.periodoTipo}
        periodos={periodos}
        periodoActivoId={data.periodoActivo?.id}
        atender={data.atender}
        barras={data.barrasHome}
        metodosPago={config.metodosPago}
        notificaciones={notificaciones}
        onNotifClick={irANotificacion}
        onSeleccionarPeriodo={verPeriodo}
        onAjustar={guardarAjuste}
        onMarcarPagado={marcarPagado}
        onAlternarConciliacion={alternarConciliacion}
        onCerrarPeriodo={cerrarPeriodo}
        onVolverActivo={() => setPeriodoVerId(null)}
        onNavigate={navigate}
      />
    ),
    pagos: (
      <Pagos
        emps={data.empsActivos}
        totales={data.totales}
        atender={data.atender}
        periodoActivo={data.periodoActivo}
        periodos={periodos}
        tasas={config.tasas}
        metodosPago={config.metodosPago}
        empresaNombre={config.empresa.nombre}
        notificaciones={notificaciones}
        onNotifClick={irANotificacion}
        onMarcarPagado={marcarPagado}
        onMarcarPagadoLote={marcarPagadoLote}
        onAlternarConciliacion={alternarConciliacion}
        onNavigate={navigate}
      />
    ),
    calendario: (
      <Calendario
        semanas={data.semanas}
        eventos={data.eventos}
        mesLabel={data.mesLabel}
        obligaciones={data.obligaciones}
        atender={data.atender}
        empsActivos={data.empsActivos}
        totales={data.totales}
        tasas={config.tasas}
        poliza={config.poliza}
        actividad={config.empresa.actividad}
        ccssEstado={data.ccssEstado}
        insEstado={data.insEstado}
        ccssCuota={data.ccssCuota}
        ccssHistorial={ccssHistorial}
        insHistorial={insHistorial}
        // Comprobantes reales adjuntos por mes — el archivo de Obligaciones
        // los necesita para poder descargar el original guardado en vez de
        // ofrecer un "Descargar PDF" que no descargaba nada.
        ccssPagoDelMes={data.ccssPagoDelMes}
        insPagoDelMes={data.insPagoDelMes}
        ccssArchivosPorMes={ccssEstadoPorMes}
        insArchivosPorMes={insEstadoPorMes}
        mesActualKey={data.mesActualKey}
        metodosPago={config.metodosPago}
        usuario={config.usuario}
        notificaciones={notificaciones}
        onNotifClick={irANotificacion}
        periodoActivo={data.periodoActivo}
        onAdjuntarCcss={adjuntarCcssArchivo}
        onMarcarCcssPagada={marcarCcssPagada}
        onAdjuntarIns={adjuntarInsArchivo}
        onRegularizarIns={regularizarIns}
        onPrevMes={() => setCalMes((m) => shiftMonth(m, -1))}
        onNextMes={() => setCalMes((m) => shiftMonth(m, 1))}
        onEventoClick={irATarget}
        onNavigate={navigate}
        dossierInicial={dossierInicial}
        onDossierAbierto={() => setDossierInicial(null)}
      />
    ),
    reportes: (
      <Reportes
        barras={data.barras}
        distribucion={data.distribucion}
        distTotalFmt={data.totales.totCostoFmt}
        costoPorEmpleado={data.costoPorEmpleado}
        emps={data.emps}
        empsActivos={data.empsActivos}
        obligaciones={data.obligaciones}
        totales={data.totales}
        tasas={data.tasasCostos}
        rango={reportesRango}
        ccssHistorial={ccssHistorial}
        insHistorial={insHistorial}
        usuario={config.usuario}
        empresaNombre={config.empresa.nombre}
        notificaciones={notificaciones}
        onNotifClick={irANotificacion}
        onRangoChange={setReportesRango}
        onEmpleadoClick={(id) => {
          setEmpId(id);
          navigate('empleados');
        }}
        onNavigate={navigate}
      />
    ),
    historial: (
      <Historial
        historial={data.historial}
        periodos={periodos}
        empleados={empleados}
        tasas={config.tasas}
        periodoTipo={config.periodoTipo}
        ccssHistorial={ccssHistorial}
        insHistorial={insHistorial}
        usuario={config.usuario}
        empresaNombre={config.empresa.nombre}
        notificaciones={notificaciones}
        onNotifClick={irANotificacion}
        onVerDetalle={verPeriodo}
        onNavigate={navigate}
      />
    ),
    configuracion: (
      <Configuracion
        config={config}
        onGuardar={actualizarConfig}
        notificaciones={notificaciones}
        onNotifClick={irANotificacion}
        onNavigate={navigate}
      />
    ),
  };

  // Ya no hay dos shells: TODAS las pantallas son composiciones editoriales
  // de pantalla completa, cada una con su propio masthead. Configuración era
  // la última que quedaba en el shell viejo (sidebar oscuro + barra
  // superior), y con ella se retiraron también `Sidebar` y `TopBar` del
  // render. `SidebarContent` sobrevive porque el Drawer móvil lo reutiliza:
  // bajo 1180px los mastheads ocultan su navegación (ver global.css) y ese
  // Drawer es la única forma de moverse entre pantallas.
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>
      {/* Navegación móvil — único lugar donde sigue viviendo el menú completo. */}
      <Drawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} side="left" width={280} background={color.ink}>
        <SidebarContent
          current={screen}
          onNavigate={navigateFromMobileNav}
          empresaNombre={config.empresa.nombre}
          modulo={config.modulo}
          usuario={config.usuario}
        />
      </Drawer>

      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'oklch(96% 0.015 60)',
        }}
      >
        <div id="app-content" className="app-content" style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {/* `key` reinicia la animación de entrada en cada cambio de pantalla. */}
          <div key={screen} style={{ display: 'contents' }}>
            <button
              type="button"
              className="menu-toggle btn btn--icon btn--icon-size"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Abrir menú de navegación"
              style={{ position: 'fixed', top: 16, left: 16, zIndex: 30 }}
            >
              <IconMenu size={18} stroke="oklch(40% 0.015 95)" />
            </button>
            {vistas[screen]}
          </div>
        </div>
      </main>
    </div>
  );
}
