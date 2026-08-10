import { useEffect, useMemo, useState } from 'react';

import { color, status as statusTokens } from './theme/tokens.js';
import { screens, defaultScreen } from './navigation.js';
import { empleadosBase, configuracionBase, periodosBase, notificacionesBase, HOY } from './data/mock.js';
import {
  buildEmpleados,
  buildTotales,
  buildObligaciones,
  soloAtender,
  buildCalendario,
  buildEventos,
  nombreMes,
  buildBarras,
  buildDistribucion,
  buildCostoPorEmpleado,
  buildHistorial,
  buildPeriodoDetalle,
  buildHistorialEmpleado,
  nextPeriodo,
} from './lib/payroll.js';

import Sidebar, { SidebarContent } from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import { Drawer } from './components/ui/Drawer.jsx';
import { ToastProvider, useToast } from './components/ui/Toast.jsx';

import Panel from './screens/Panel.jsx';
import Empleados from './screens/Empleados.jsx';
import Planilla from './screens/Planilla.jsx';
import Pagos from './screens/Pagos.jsx';
import Ccss from './screens/Ccss.jsx';
import Ins from './screens/Ins.jsx';
import Calendario from './screens/Calendario.jsx';
import Reportes from './screens/Reportes.jsx';
import Historial from './screens/Historial.jsx';
import Configuracion from './screens/Configuracion.jsx';

/** Lee la pantalla desde el hash de la URL, si es válida. */
function screenFromHash() {
  const key = window.location.hash.replace('#', '');
  return screens[key] ? key : defaultScreen;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
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

  // "Base de datos" mock de la sesión — mutable, se reemplazará por
  // llamadas a backend más adelante sin cambiar la forma de estos datos.
  const [empleados, setEmpleados] = useState(() => empleadosBase.map((e) => ({ ...e })));
  const [empId, setEmpId] = useState(() => (empleadosBase.find((e) => e.activo) || empleadosBase[0]).id);
  const [ajustes, setAjustes] = useState({}); // { [empId]: { horasExtra, bono, deduccion } } del período activo
  const [periodos, setPeriodos] = useState(() => periodosBase.map((p) => ({ ...p })));
  const [periodoVerId, setPeriodoVerId] = useState(null); // null = período activo
  const [config, setConfig] = useState(() => clone(configuracionBase));
  const [ccssEstado, setCcssEstado] = useState({ pagada: false, archivo: null });
  const [insEstado, setInsEstado] = useState({ alDia: false, archivo: null });
  const [notificaciones, setNotificaciones] = useState(() => notificacionesBase.map((n) => ({ ...n })));
  const [calMes, setCalMes] = useState({ anio: HOY.anio, mesIndice: HOY.mesIndice });
  const [reportesRango, setReportesRango] = useState(6);

  // El hash mantiene la pantalla al recargar y hace funcionar el botón atrás.
  useEffect(() => {
    const sync = () => setScreen(screenFromHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

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

  function navigateFromMobileNav(key) {
    navigate(key);
    setMobileNavOpen(false);
  }

  // Al cambiar de pantalla el contenido vuelve arriba.
  useEffect(() => {
    document.getElementById('app-content')?.scrollTo({ top: 0 });
    document.title = `${screens[screen].title} · Gestión Laboral`;
  }, [screen]);

  // Todos los datos derivados en un solo paso, a partir del estado mutable.
  const data = useMemo(() => {
    const periodoActivo = periodos.find((p) => p.estado === 'abierto');
    const periodoMostrado = periodoVerId ? periodos.find((p) => p.id === periodoVerId) || periodoActivo : periodoActivo;
    const esActivoMostrado = periodoMostrado?.id === periodoActivo?.id;

    const emps = buildEmpleados(empleados, empId, ajustes, config.tasas);
    const empsActivos = emps.filter((e) => e.activo);
    const totales = buildTotales(empsActivos);

    // Las obligaciones de CCSS/INS/planilla se resuelven con lo que ya pasó
    // en esas pantallas — el Panel y el Calendario nunca quedan desactualizados.
    const obligaciones = buildObligaciones(totales).map((o) => {
      let k = o.k;
      if (o.target === 'ccss' && o.k === 'proximo' && ccssEstado.pagada) k = 'pagado';
      else if (o.target === 'ins' && o.k === 'vencido' && insEstado.alDia) k = 'aldia';
      else if (o.target === 'pagos' && o.k === 'pendiente' && totales.pendCount === 0) k = 'pagado';
      if (k === o.k) return o;
      const s = statusTokens[k];
      return { ...o, k, stL: s.l, stBg: s.bg, stC: s.c, stD: s.d };
    });
    const esMesDeHoy = calMes.anio === HOY.anio && calMes.mesIndice === HOY.mesIndice;

    const planillaVista = esActivoMostrado
      ? { emps: empsActivos, totales, periodo: periodoMostrado, readOnly: false }
      : (() => {
          const det = buildPeriodoDetalle(periodoMostrado, empleados.filter((e) => e.activo), config.tasas);
          return { emps: det.emps, totales: det.totales, periodo: periodoMostrado, readOnly: true };
        })();

    return {
      emps,
      empsActivos,
      totales,
      obligaciones,
      atender: soloAtender(obligaciones),
      semanas: buildCalendario(calMes.anio, calMes.mesIndice, HOY),
      eventos: buildEventos(esMesDeHoy),
      mesLabel: nombreMes(calMes.anio, calMes.mesIndice),
      barras: buildBarras(reportesRango),
      distribucion: buildDistribucion(totales),
      costoPorEmpleado: buildCostoPorEmpleado(empsActivos),
      historial: buildHistorial(periodos, totales, empsActivos.length),
      selEmp: emps.find((e) => e.id === empId) || emps[0],
      periodoActivo,
      periodoMostrado,
      planillaVista,
    };
  }, [empleados, empId, ajustes, config.tasas, periodos, periodoVerId, calMes, reportesRango, ccssEstado, insEstado]);

  const meta = screens[screen];

  /* ---------------------------------------------------------
     Empleados
     --------------------------------------------------------- */
  function crearEmpleado(datos) {
    setEmpleados((list) => {
      const nextId = list.reduce((max, e) => Math.max(max, e.id), 0) + 1;
      return [...list, { id: nextId, activo: true, pago: 'pendiente', metodo: '—', fechaPago: '—', ...datos }];
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

  function getHistorialEmpleado(id) {
    return buildHistorialEmpleado(id, periodos, empleados.filter((e) => e.activo || e.id === id), config.tasas);
  }

  /* ---------------------------------------------------------
     Planilla
     --------------------------------------------------------- */
  function guardarAjuste(idEmp, ajuste) {
    setAjustes((a) => ({ ...a, [idEmp]: ajuste }));
    toast.push('Ajuste aplicado a la planilla', { tone: 'success' });
  }

  function cerrarPeriodo() {
    const activo = data.periodoActivo;
    if (!activo) return;
    const siguiente = nextPeriodo(activo, config.periodoTipo);
    setPeriodos((list) => [siguiente, ...list.map((p) => (p.id === activo.id ? { ...p, estado: 'cerrado' } : p))]);
    setAjustes({});
    setPeriodoVerId(null);
    // El estado de pago vive en el empleado (mock sin tablas por período):
    // al abrir el siguiente período, todos los activos vuelven a "pendiente".
    setEmpleados((list) => list.map((e) => (e.activo ? { ...e, pago: 'pendiente', metodo: '—', fechaPago: '—' } : e)));
    toast.push(`Período cerrado. Se abrió ${siguiente.etiqueta}`, { tone: 'success' });
  }

  /* ---------------------------------------------------------
     Pagos
     --------------------------------------------------------- */
  function marcarPagado(idEmp, { metodo, fecha }) {
    setEmpleados((list) => list.map((e) => (e.id === idEmp ? { ...e, pago: 'pagado', metodo, fechaPago: fecha } : e)));
    toast.push('Pago registrado', { tone: 'success' });
  }

  function marcarPagadoLote(ids, { metodo, fecha }) {
    setEmpleados((list) => list.map((e) => (ids.includes(e.id) ? { ...e, pago: 'pagado', metodo, fechaPago: fecha } : e)));
    toast.push(`${ids.length} pagos registrados`, { tone: 'success' });
  }

  /* ---------------------------------------------------------
     CCSS / INS
     --------------------------------------------------------- */
  function adjuntarCcssArchivo(archivo) {
    setCcssEstado((s) => ({ ...s, archivo }));
    toast.push('Comprobante adjuntado');
  }

  function marcarCcssPagada() {
    setCcssEstado((s) => ({ ...s, pagada: true }));
    toast.push('Cuota CCSS marcada como pagada', { tone: 'success' });
  }

  function adjuntarInsArchivo(archivo) {
    setInsEstado((s) => ({ ...s, archivo }));
    toast.push('Comprobante adjuntado');
  }

  function regularizarIns() {
    setInsEstado((s) => ({ ...s, alDia: true }));
    toast.push('Reporte INS regularizado — póliza al día', { tone: 'success' });
  }

  /* ---------------------------------------------------------
     Configuración
     --------------------------------------------------------- */
  function actualizarConfig(patch) {
    setConfig((c) => ({ ...c, ...patch }));
    toast.push('Configuración guardada', { tone: 'success' });
  }

  /* ---------------------------------------------------------
     Notificaciones / Calendario
     --------------------------------------------------------- */
  function marcarNotifLeida(id) {
    setNotificaciones((list) => list.map((n) => (n.id === id ? { ...n, leida: true } : n)));
  }

  function irANotificacion(n) {
    marcarNotifLeida(n.id);
    navigate(n.target);
  }

  const vistas = {
    panel: (
      <Panel emps={data.empsActivos} totales={data.totales} atender={data.atender} barras={data.barras} onNavigate={navigate} />
    ),
    empleados: (
      <Empleados
        emps={data.emps}
        selEmp={data.selEmp}
        onSelect={setEmpId}
        onCrear={crearEmpleado}
        onEditar={editarEmpleado}
        onAlternarActivo={alternarActivoEmpleado}
        getHistorial={getHistorialEmpleado}
      />
    ),
    planilla: (
      <Planilla
        vista={data.planillaVista}
        periodoTipo={config.periodoTipo}
        onAjustar={guardarAjuste}
        onCerrarPeriodo={cerrarPeriodo}
        onVolverActivo={() => setPeriodoVerId(null)}
      />
    ),
    pagos: (
      <Pagos emps={data.empsActivos} totales={data.totales} onMarcarPagado={marcarPagado} onMarcarPagadoLote={marcarPagadoLote} />
    ),
    ccss: (
      <Ccss
        estado={ccssEstado}
        onAdjuntar={adjuntarCcssArchivo}
        onMarcarPagada={marcarCcssPagada}
        onVerDetalle={() => navigate('planilla')}
      />
    ),
    ins: (
      <Ins
        estado={insEstado}
        poliza={config.poliza}
        actividad={config.empresa.actividad}
        cubiertos={data.empsActivos.length}
        onAdjuntar={adjuntarInsArchivo}
        onRegularizar={regularizarIns}
      />
    ),
    calendario: (
      <Calendario
        semanas={data.semanas}
        eventos={data.eventos}
        mesLabel={data.mesLabel}
        onPrevMes={() => setCalMes((m) => shiftMonth(m, -1))}
        onNextMes={() => setCalMes((m) => shiftMonth(m, 1))}
        onEventoClick={(target) => navigate(target)}
      />
    ),
    reportes: (
      <Reportes
        barras={data.barras}
        distribucion={data.distribucion}
        distTotalFmt={data.totales.totCostoFmt}
        costoPorEmpleado={data.costoPorEmpleado}
        rango={reportesRango}
        onRangoChange={setReportesRango}
        onEmpleadoClick={(id) => {
          setEmpId(id);
          navigate('empleados');
        }}
      />
    ),
    historial: <Historial historial={data.historial} onVerDetalle={verPeriodo} />,
    configuracion: <Configuracion config={config} onGuardar={actualizarConfig} />,
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>
      <Sidebar current={screen} onNavigate={navigate} empresaNombre={config.empresa.nombre} modulo={config.modulo} />

      {/* Bajo 900px el sidebar fijo desaparece (global.css); este Drawer
          reutiliza el mismo contenido de navegación (Fase 1 · B.4 / F.1). */}
      <Drawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} side="left" width={280} background={color.ink}>
        <SidebarContent
          current={screen}
          onNavigate={navigateFromMobileNav}
          empresaNombre={config.empresa.nombre}
          modulo={config.modulo}
        />
      </Drawer>

      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          background: color.canvas,
        }}
      >
        <TopBar
          title={meta.title}
          subtitle={meta.sub}
          onMenuClick={() => setMobileNavOpen(true)}
          periodos={periodos}
          periodoMostrado={data.periodoMostrado}
          periodoActivoId={data.periodoActivo?.id}
          onSeleccionarPeriodo={verPeriodo}
          notificaciones={notificaciones}
          onNotifClick={irANotificacion}
        />

        <div id="app-content" className="app-content" style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 40px' }}>
          {/* `key` reinicia la animación de entrada en cada cambio de pantalla. */}
          <div key={screen} style={{ display: 'contents' }}>
            {vistas[screen]}
          </div>
        </div>
      </main>
    </div>
  );
}
