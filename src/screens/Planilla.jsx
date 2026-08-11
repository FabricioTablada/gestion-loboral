import { useEffect, useRef, useState } from 'react';

import { HOY } from '../data/mock.js';
import { money, fechaISO } from '../lib/format.js';
import { sugerirMetodoPago } from '../lib/payroll.js';
import { descargarCsv } from '../lib/export.js';
import { IconSearch, IconCheck, IconChevronDown, IconChevronRight } from '../components/ui/Icons.jsx';
import { Modal, ConfirmDialog } from '../components/ui/Modal.jsx';
import { NotificacionesPanel } from '../components/ui/NotificacionesPanel.jsx';
import ScrollRail from '../components/ScrollRail.jsx';

/**
 * Planilla — herramienta editorial de cierre de quincena. Mismo lenguaje
 * visual que el Home (paleta cream/coral/lilac, Instrument Serif + JetBrains
 * Mono, motion `ed-*` de global.css) pero composición propia: no es un
 * dashboard de métricas, es el libro de trabajo de la quincena — el equipo
 * en el centro, cada fila se abre para trabajarla, y el cierre es un paso,
 * no una tarjeta más.
 *
 * Los datos y la lógica son exactamente los que ya existían (`vista`,
 * `onAjustar`, `onCerrarPeriodo`, `onVolverActivo`, exportar CSV): esto es
 * solo una nueva presentación sobre las mismas props.
 */
const pal = {
  ink: 'oklch(20% 0.02 30)',
  ink2: 'oklch(26% 0.03 25)',
  cream: 'oklch(96% 0.015 60)',
  cream2: 'oklch(98% 0.008 65)',
  line: 'oklch(85% 0.015 55)',
  line2: 'oklch(90% 0.012 55)',
  muted: 'oklch(48% 0.02 40)',
  muted2: 'oklch(62% 0.02 40)',
  coral: 'oklch(70% 0.16 30)',
  peach: 'oklch(85% 0.10 55)',
  blush: 'oklch(88% 0.06 20)',
  lilac: 'oklch(82% 0.06 320)',
  sage: 'oklch(72% 0.12 145)',
  gold: 'oklch(85% 0.14 75)',
  sky: 'oklch(80% 0.09 220)',
  surface: 'oklch(99% 0.006 70)',
};

const serif = { fontFamily: "'Instrument Serif', serif", fontWeight: 400 };
const mono = {
  fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  fontSize: 11,
  color: pal.muted,
};

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Guarda para los `onMouseEnter`/`onMouseLeave` que mutan `style` directo:
// en touch, un tap dispara `mouseenter` sin el `mouseleave` correspondiente
// y el elemento queda con el efecto "pegado" hasta el próximo tap en otro
// lado (revisión de motion). Sin esto no hay forma de gatear ese JS como sí
// se gatea un `:hover` de CSS con `@media (hover: hover)`.
const hoverFino = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * Movimientos reales de la quincena (horas extra / bono / deducción por
 * empleado) — una fila por tipo con monto acumulado > 0. Única fuente del
 * "cuántos ajustes/movimientos" en toda la pantalla: antes cada sección
 * contaba distinto (personas con `tieneAjuste` vs. filas de este rail), así
 * que la misma quincena se describía como "1 movimiento" en una parte y "3
 * movimientos firmados" en otra (auditoría F16). No hay fechas exactas por
 * movimiento individual en los datos — se muestran agrupados por tipo, sin
 * inventar horas o firmas que no existen.
 */
function buildMovimientosRail(emps) {
  const list = [];
  emps.forEach((e) => {
    if (e.horasExtra > 0) {
      // Monto y factor reales de Configuración (ver `buildEmpleados`) — antes
      // se recalculaba acá con 240h y 1.5× fijos.
      list.push({ id: `${e.id}-he`, e, tipo: 'Horas extras', signo: 1, monto: e.montoHorasExtra, desc: `${e.horasExtra}h extra a ${e.factorHoraExtra}× esta quincena.` });
    }
    if (e.bono > 0) {
      list.push({ id: `${e.id}-bono`, e, tipo: 'Bono', signo: 1, monto: e.bono, desc: 'Bono puntual de la quincena.' });
    }
    if (e.deduccionPuntual > 0) {
      list.push({ id: `${e.id}-ded`, e, tipo: 'Deducción', signo: -1, monto: e.deduccionPuntual, desc: 'Deducción puntual de la quincena.' });
    }
  });
  return list;
}

/** Cuenta hacia el valor real al montar/cambiar — mismo mecanismo que el resto de la app. */
function useCountUp(target, { duration = 900, format = (n) => String(Math.round(n)) } = {}) {
  const [display, setDisplay] = useState(() => (reducedMotion() ? target : 0));
  const prevRef = useRef(reducedMotion() ? target : 0);

  useEffect(() => {
    if (reducedMotion()) {
      setDisplay(target);
      prevRef.current = target;
      return undefined;
    }
    const from = prevRef.current;
    const to = target;
    if (from === to) return undefined;
    const start = performance.now();
    let raf;
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return format(display);
}

function Dot({ c = pal.coral, glow = false, size = 6 }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: c,
        display: 'inline-block',
        flexShrink: 0,
        animation: glow ? 'ed-dot-glow 2.5s ease-in-out infinite' : undefined,
      }}
    />
  );
}

function diasEnMes(anio, mesIndice) {
  return new Date(anio, mesIndice + 1, 0).getDate();
}

/** Extrae el día numérico de cadenas tipo "Vence 20 ago 2026" / "Venció 05 ago 2026". */
function diaDe(fecha) {
  const m = /(\d{1,2})/.exec(fecha || '');
  return m ? parseInt(m[1], 10) : null;
}

const NAV_ITEMS = [
  { key: 'panel', label: 'Hoy' },
  { key: 'planilla', label: 'Planilla' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'empleados', label: 'Equipo' },
  { key: 'calendario', label: 'Obligaciones' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'historial', label: 'Historial' },
];

/* ---------------------------------------------------------
   Exportar CSV — misma lógica que ya existía
   --------------------------------------------------------- */

function exportarPlanillaCsv(vista) {
  // "Deducción CCSS" es solo la CCSS obrera (`e.ded`) — antes esta columna
  // se calculaba como `brutoQ - neto`, que en realidad incluye también la
  // deducción puntual (adelantos, préstamos) si la persona tenía una esa
  // quincena, así que un adelanto se reportaba como si fuera CCSS. Ahora
  // cada deducción real tiene su propia columna, y "Salario neto" sigue
  // reconciliando: bruto − CCSS − deducción puntual.
  const totalDeduccionPuntual = vista.emps.reduce((a, e) => a + (e.deduccionPuntual || 0), 0);
  const filas = [
    [
      'Empleado', 'Puesto', 'Salario bruto', 'Deducción CCSS', 'Deducción puntual', 'Salario neto', 'Cargas patronales', 'Costo total',
      'Estado de pago', 'Fecha de pago', 'Método', 'Referencia bancaria', 'Comisión bancaria', 'Conciliado', 'Fecha de conciliación',
    ],
    ...vista.emps.map((e) => [
      e.nombre,
      e.puesto,
      e.brutoQ.toFixed(0),
      e.ded.toFixed(0),
      (e.deduccionPuntual || 0).toFixed(0),
      e.neto.toFixed(0),
      e.car.toFixed(0),
      e.costoQ.toFixed(0),
      e.pago === 'pagado' ? 'Pagado' : 'Pendiente',
      e.fechaPago && e.fechaPago !== '—' ? e.fechaPago : '',
      e.metodo && e.metodo !== '—' ? e.metodo : '',
      e.referenciaPago && e.referenciaPago !== '—' ? e.referenciaPago : '',
      e.comisionPago ? e.comisionPago.toFixed(0) : '',
      e.conciliado ? 'Sí' : 'No',
      e.conciliado && e.conciliadoFecha !== '—' ? e.conciliadoFecha : '',
    ]),
    [
      'Totales',
      '',
      vista.totales.sumBruto.toFixed(0),
      vista.totales.totDed.toFixed(0),
      totalDeduccionPuntual.toFixed(0),
      vista.totales.sumNeto.toFixed(0),
      vista.totales.totCar.toFixed(0),
      vista.totales.totCosto.toFixed(0),
    ],
  ];
  descargarCsv(`planilla-${vista.periodo.id}`, filas);
}

/* ---------------------------------------------------------
   Masthead — mismo lenguaje del Home, con selector de período real
   --------------------------------------------------------- */

function PeriodoDropdown({ periodos, periodoMostrado, periodoActivoId, onSeleccionar }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Mismo patrón que `Modal.jsx`: entra animado pero antes desaparecía de
  // golpe al cerrar — se mantiene montado un instante más para que la
  // salida también anime (revisión de motion).
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setRendered(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = setTimeout(() => setRendered(false), 160);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 9px',
          border: `1px solid ${pal.line}`,
          borderRadius: 999,
          background: 'transparent',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: '0.16em',
          color: pal.muted,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: 999, background: periodoMostrado?.id === periodoActivoId ? pal.sage : pal.gold }} />
        {periodoMostrado?.etiqueta.replace('Quincena · ', '')}
        <IconChevronDown size={11} stroke="currentColor" />
      </button>

      {rendered && (
        <div
          role="listbox"
          className={`ed-pop-in${visible ? ' ed-pop-in--visible' : ''}`}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            width: 280,
            maxHeight: 340,
            overflowY: 'auto',
            background: pal.surface,
            border: `1px solid ${pal.line}`,
            borderRadius: 14,
            boxShadow: '0 24px 48px -18px oklch(20% 0.02 30 / 0.28)',
            zIndex: 50,
            transformOrigin: 'top left',
          }}
        >
          {periodos.map((p) => {
            const selected = p.id === periodoMostrado?.id;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onSeleccionar(p.id);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 14px',
                  border: 'none',
                  borderBottom: `1px solid ${pal.line2}`,
                  background: selected ? pal.cream2 : 'transparent',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  color: pal.ink,
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: p.estado === 'abierto' ? pal.sage : pal.line2 }} />
                  {p.etiqueta}
                </span>
                {selected && <IconCheck size={13} stroke={pal.coral} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Masthead({ periodos, periodoMostrado, periodoActivoId, onSeleccionarPeriodo, onNavigate, atender, busqueda, onBusquedaChange, notificaciones, onNotifClick }) {
  return (
    <>
      <header
        style={{
          padding: '24px 56px 18px',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: 24,
          alignItems: 'center',
          borderBottom: `1px solid ${pal.line}`,
          position: 'relative',
          zIndex: 5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: pal.ink,
              color: pal.gold,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              flexShrink: 0,
              ...serif,
            }}
          >
            ◐
          </div>
          <span style={{ fontSize: 22, fontStyle: 'italic', letterSpacing: '-0.01em', ...serif }}>Gestión Laboral</span>

          {periodos && periodoMostrado && (
            <PeriodoDropdown
              periodos={periodos}
              periodoMostrado={periodoMostrado}
              periodoActivoId={periodoActivoId}
              onSeleccionar={onSeleccionarPeriodo}
            />
          )}
        </div>

        <nav className="ed-masthead-nav" style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 13 }}>
          {NAV_ITEMS.map((item) => {
            const active = item.key === 'planilla';
            return (
              <a
                key={item.key}
                href={`#${item.key}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.key);
                }}
                style={{ color: active ? pal.ink : pal.muted, fontWeight: active ? 600 : 400, position: 'relative' }}
              >
                {item.label}
                {active && (
                  <span style={{ position: 'absolute', bottom: -22, left: 0, right: 0, height: 2, background: pal.coral }} />
                )}
              </a>
            );
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
          {/* Buscador real sobre el índice del taller (nombre, puesto o
              cédula). Antes era un div decorativo con `cursor: not-allowed`. */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px',
              background: pal.cream2,
              border: `1px solid ${pal.line}`,
              borderRadius: 999,
              fontSize: 12,
              color: pal.muted,
              minWidth: 180,
            }}
          >
            <IconSearch size={13} stroke="currentColor" />
            <input
              type="search"
              value={busqueda}
              onChange={(ev) => onBusquedaChange(ev.target.value)}
              placeholder="Buscar empleado"
              aria-label="Buscar empleado en la planilla"
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', font: 'inherit', color: pal.ink }}
            />
          </label>
          <NotificacionesPanel notificaciones={notificaciones} onNotifClick={onNotifClick} />
        </div>
      </header>
    </>
  );
}


/* ---------------------------------------------------------
   Barra de estado — fila mono bajo el masthead
   --------------------------------------------------------- */

function StatusBar({ emps, readOnly }) {
  const pagados = emps.filter((e) => e.pago === 'pagado').length;
  const pendientes = emps.length - pagados;
  // Cuenta real de movimientos firmados (ver `buildMovimientosRail`), no de
  // personas — "N ajustes firmados" debe coincidir con el rail de abajo.
  const ajustes = buildMovimientosRail(emps).length;

  return (
    <div
      style={{
        padding: '10px 56px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: pal.muted,
        borderBottom: `1px solid ${pal.line2}`,
        position: 'relative',
        zIndex: 5,
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <span>{fechaLarga(HOY)}</span>
      <span style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        <span style={{ color: 'oklch(38% 0.11 145)' }}>
          ● {pagados} {pagados === 1 ? 'pagada' : 'pagadas'}
        </span>
        <span style={{ color: 'oklch(50% 0.13 65)' }}>
          ● {pendientes} {pendientes === 1 ? 'espera' : 'esperan'} turno
        </span>
        <span style={{ color: pal.muted }}>
          ● {ajustes} {ajustes === 1 ? 'ajuste firmado' : 'ajustes firmados'}
        </span>
      </span>
      <span>{readOnly ? 'Archivada · solo lectura' : 'Período abierto'}</span>
    </div>
  );
}

const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function fechaLarga(hoy) {
  const weekday = new Date(hoy.anio, hoy.mesIndice, hoy.dia).toLocaleDateString('es-CR', { weekday: 'long' });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap} · ${String(hoy.dia).padStart(2, '0')} ${MESES_LARGO[hoy.mesIndice]} ${hoy.anio}`;
}

/* ---------------------------------------------------------
   Sección 01 — Hero editorial de período (paisaje + instrumento)
   --------------------------------------------------------- */

/** Paisaje al amanecer, idéntico al del Home pero recortado para la cabecera de Planilla. */
function LandscapeHero() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: 40,
          right: -40,
          width: 780,
          height: 500,
          background:
            'radial-gradient(ellipse at 30% 40%, oklch(90% 0.10 55 / 0.45), transparent 55%), radial-gradient(ellipse at 70% 60%, oklch(85% 0.09 320 / 0.32), transparent 60%)',
          animation: 'ed-aurora 12s ease-in-out infinite',
          filter: 'blur(2px)',
        }}
      />
      <div style={{ position: 'absolute', top: 50, right: 0, width: 780, height: 480 }}>
        <svg viewBox="0 0 780 480" width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="ep-m1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="oklch(72% 0.09 320)" stopOpacity="0.32" />
              <stop offset="1" stopColor="oklch(72% 0.09 320)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="ep-m2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="oklch(60% 0.07 315)" stopOpacity="0.45" />
              <stop offset="1" stopColor="oklch(60% 0.07 315)" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <g style={{ animation: 'ed-sun-breathe 6s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
            <circle cx={580} cy={220} r={100} fill="oklch(88% 0.13 65 / 0.15)" style={{ animation: 'ed-sun-halo 6s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />
            <circle cx={580} cy={220} r={66} fill="oklch(88% 0.13 65 / 0.30)" />
            <circle cx={580} cy={220} r={42} fill="oklch(90% 0.14 68)" />
          </g>
          <path d="M0,310 L100,250 L200,290 L300,230 L400,270 L500,215 L600,260 L700,225 L780,265 L780,480 L0,480 Z" fill="url(#ep-m1)" />
          <path d="M0,360 L120,300 L220,340 L340,280 L440,320 L560,280 L700,320 L780,300 L780,480 L0,480 Z" fill="url(#ep-m2)" />
          <g style={{ animation: 'ed-wave-drift 7s ease-in-out infinite alternate' }}>
            <path d="M-10,430 Q100,425 220,432 T460,428 T800,434" stroke="oklch(80% 0.06 30)" strokeWidth="1" fill="none" opacity="0.55" />
            <path d="M-10,445 Q100,440 220,447 T460,442 T800,448" stroke="oklch(80% 0.06 30)" strokeWidth="1" fill="none" opacity="0.4" />
          </g>
          {/* Línea de luz dorada, desplazándose lento sobre el paisaje */}
          <path
            d="M-10,385 Q200,345 400,365 T800,345"
            stroke={pal.gold}
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
            style={{ animation: 'ed-wave-drift-2 6s ease-in-out infinite' }}
          />
          <g style={{ animation: 'ed-bird-glide 8s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
            <path
              d="M170,130 q5,-5 10,0 q5,-5 10,0"
              stroke="oklch(35% 0.02 30)"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
              style={{ animation: 'ed-bird-flap 1.2s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }}
            />
          </g>
          <g style={{ animation: 'ed-bird-glide 9s ease-in-out infinite reverse 1.4s', transformBox: 'fill-box', transformOrigin: 'center' }}>
            <path
              d="M250,158 q4,-4 8,0 q4,-4 8,0"
              stroke="oklch(35% 0.02 30)"
              strokeWidth="1"
              fill="none"
              strokeLinecap="round"
              style={{ animation: 'ed-bird-flap 1.1s ease-in-out infinite 0.2s', transformBox: 'fill-box', transformOrigin: 'center' }}
            />
          </g>
        </svg>
      </div>
    </div>
  );
}

/** Instrumento "la quincena, en cinco movimientos" — onda orgánica con los 5 días clave del período. */
function OndaInstrumento({ periodo, periodoTipo, atender }) {
  const inicioDia = periodoTipo === 'mensual' ? 1 : periodo.mitad === 'b' ? 16 : 1;
  const finDia =
    periodoTipo === 'mensual'
      ? diasEnMes(periodo.anio, periodo.mesIndice)
      : periodo.mitad === 'b'
        ? diasEnMes(periodo.anio, periodo.mesIndice)
        : 15;

  const vencidoDia = diaDe((atender || []).find((o) => o.k === 'vencido')?.fecha);
  const proximoDia = diaDe((atender || []).find((o) => o.k === 'proximo')?.fecha);
  // HOY es una fecha simulada fija (mock.js) — al cerrar quincenas el
  // período activo avanza, pero HOY no. Si el período activo ya no incluye
  // ese día (p. ej. quincena 16–31 mientras HOY sigue en el 09), el marcador
  // "HOY" no tiene un lugar real en esta onda — mostrarlo en un slot fijo de
  // todas formas lo dejaba flotando fuera de orden (auditoría F12).
  const hoyEnRango = HOY.dia >= inicioDia && HOY.dia <= finDia;

  // 5 "movimientos": apertura, un evento temprano, hoy (si aplica), un evento tardío, cierre.
  const movs = [
    { dia: inicioDia, x: 30, y: 110, r: 4, c: 'oklch(70% 0.15 320)', label: String(inicioDia).padStart(2, '0') },
    {
      dia: vencidoDia && vencidoDia >= inicioDia && vencidoDia <= finDia ? vencidoDia : Math.round(inicioDia + (finDia - inicioDia) * 0.27),
      x: 135,
      y: 80,
      r: 5,
      c: pal.coral,
      label: null,
    },
    { dia: HOY.dia, x: 260, y: 75, r: 10, c: pal.ink, label: null, hoy: true, visible: hoyEnRango },
    {
      dia: proximoDia && proximoDia >= inicioDia && proximoDia <= finDia ? proximoDia : Math.round(inicioDia + (finDia - inicioDia) * 0.73),
      x: 375,
      y: 50,
      r: 4,
      c: pal.sage,
      label: null,
    },
    { dia: finDia, x: 450, y: 75, r: 4, c: 'oklch(70% 0.09 320)', label: String(finDia).padStart(2, '0') },
  ];
  movs[1].label = String(movs[1].dia).padStart(2, '0');
  movs[3].label = String(movs[3].dia).padStart(2, '0');

  return (
    <div
      style={{
        position: 'relative',
        width: 395,
        padding: '24px 24px 20px',
        background: 'rgba(255, 253, 249, 0.98)',
        border: `1px solid ${pal.line2}`,
        borderRadius: 24,
        boxShadow: '0 20px 50px -16px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.02)',
        animation: 'ed-float-slow 6s ease-in-out infinite',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ ...mono, fontSize: 9, letterSpacing: '0.08em' }}>LA QUINCENA, EN CINCO MOVIMIENTOS</span>
        <span style={{ ...mono, fontSize: 9.5, color: pal.coral, fontWeight: 700 }}>HOY · {String(HOY.dia).padStart(2, '0')}</span>
      </div>

      <svg viewBox="0 0 480 145" width="100%" height={145} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="ep-wave-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="oklch(78% 0.16 25)" stopOpacity="0.28" />
            <stop offset="1" stopColor="oklch(78% 0.16 25)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ep-wave-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="oklch(70% 0.15 320)" />
            <stop offset=".5" stopColor="oklch(70% 0.16 30)" />
            <stop offset="1" stopColor="oklch(85% 0.14 75)" />
          </linearGradient>
        </defs>
        <g style={{ animation: 'ed-wave-drift 7s ease-in-out infinite alternate' }}>
          <path
            d="M20,110 Q60,100 96,90 T172,65 T244,55 T288,75 T360,45 T436,75 T460,95 L460,135 L20,135 Z"
            fill="url(#ep-wave-fill)"
          />
          <path
            d="M20,110 Q60,100 96,90 T172,65 T244,55 T288,75 T360,45 T436,75 T460,95"
            stroke="url(#ep-wave-line)"
            strokeWidth="2.2"
            fill="none"
            strokeDasharray="1400"
            style={{ animation: 'ed-stroke-draw 2s ease-out both, ed-line-pulse 6s ease-in-out infinite' }}
          />
        </g>

        {movs.map((m) => {
          if (m.visible === false) return null;
          return m.hoy ? (
            <g key="hoy">
              <circle cx={m.x} cy={m.y} r={10} fill={pal.ink} />
              <circle
                cx={m.x}
                cy={m.y}
                r={10}
                fill={pal.ink}
                style={{ animation: 'ed-pulse-ring 2s ease-out infinite', transformOrigin: `${m.x}px ${m.y}px` }}
              />
              <circle cx={m.x} cy={m.y} r={4} fill={pal.gold} />
            </g>
          ) : (
            <circle key={m.x} cx={m.x} cy={m.y} r={m.r} fill={m.c} />
          );
        })}

        <g fontFamily="JetBrains Mono, monospace" fontSize="9.5" fill="oklch(45% 0.02 40)">
          <text x={movs[0].x - 6} y={142}>{movs[0].label}</text>
          <text x={movs[1].x - 8} y={142}>{movs[1].label}</text>
          {hoyEnRango && (
            <text x={movs[2].x - 18} y={142} fill={pal.ink} fontWeight="700">
              {String(HOY.dia).padStart(2, '0')}·HOY
            </text>
          )}
          <text x={movs[3].x - 6} y={142}>{movs[3].label}</text>
          <text x={movs[4].x - 6} y={142}>{movs[4].label}</text>
        </g>
      </svg>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${pal.line2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ ...mono, fontSize: 8.5, color: pal.muted }}>PERÍODO EN COMPOSICIÓN</span>
        <div style={{ fontStyle: 'italic', fontSize: 13, color: 'oklch(40% 0.03 30)', ...serif }}>
          cinco movimientos en {finDia - inicioDia + 1} días trabajados
        </div>
      </div>
    </div>
  );
}

function Seccion01Hero({ periodo, periodoTipo, readOnly, emps, atender, onExportar, onAbrirCerrar, onVolverActivo, onIrAlEquipo }) {
  const pendientes = emps.filter((e) => e.pago !== 'pagado');
  const pagados = emps.length - pendientes.length;
  // Misma fuente que el rail de ajustes (§ 04) — ver `buildMovimientosRail`.
  const ajustes = buildMovimientosRail(emps).length;
  const primerPendiente = pendientes[0];
  const primerNombre = primerPendiente ? primerPendiente.nombre.split(' ')[0] : null;
  const mesLabel = (periodo.mes || '').split(' ')[0].toLowerCase();

  return (
    <section style={{ position: 'relative', padding: '44px 56px 44px', overflow: 'hidden' }}>
      <LandscapeHero />

      <div className="ed-grid-hero" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 395px', gap: 44, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
            <span style={{ width: 32, height: 1, background: pal.ink }} />
            <span style={{ ...mono, color: pal.ink }}>Planilla · sección 01</span>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: pal.coral, animation: 'ed-dot-glow 2.5s ease-in-out infinite' }} />
            <span style={{ ...mono, color: pal.coral }}>{readOnly ? 'Archivada' : 'En composición'}</span>
          </div>

          <h1
            className="ed-hero-title"
            style={{ fontSize: 104, lineHeight: 0.92, margin: '0 0 18px', letterSpacing: '-0.03em', color: pal.ink, animation: 'ed-fade-up 900ms ease-out both', ...serif }}
          >
            <em
              style={{
                fontStyle: 'italic',
                background: 'linear-gradient(135deg, oklch(55% 0.15 25), oklch(50% 0.13 320))',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
              }}
            >
              {readOnly ? 'Así quedó' : 'Compongamos'}
            </em>
            <br />
            la quincena de {mesLabel}.
          </h1>

          <p
            style={{
              fontSize: 24,
              fontStyle: 'italic',
              lineHeight: 1.35,
              // Reserva el alto de 2 líneas (como en la referencia) para que una
              // oración real más corta no descoloque la tarjeta: la grilla usa
              // align-items:end, así que la altura de esta columna define dónde
              // "flota" la tarjeta sobre el paisaje.
              minHeight: '2.7em',
              margin: '0 0 32px',
              maxWidth: 600,
              color: 'oklch(35% 0.03 30)',
              animation: 'ed-fade-up 900ms ease-out 200ms both',
              ...serif,
            }}
          >
            {readOnly
              ? `Del ${periodo.titulo.replace(/^.*?(\d.*)$/, '$1')}. ${pagados} de ${emps.length} quedaron pagadas antes del cierre.`
              : `${periodo.titulo.match(/\d{2}[–-]\d{2}/)?.[0] ? `Del ${periodo.titulo.match(/\d{2}[–-]\d{2}/)[0].replace('–', ' al ')}.` : ''} ${pagados} ${pagados === 1 ? 'persona ya está lista' : 'personas ya están listas'}, ${pendientes.length} ${pendientes.length === 1 ? 'espera' : 'esperan'} su turno${ajustes > 0 ? `, ${ajustes} ${ajustes === 1 ? 'ajuste ya firmaste' : 'ajustes ya firmaste'} vos.` : '.'}`}
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {readOnly ? (
              <button
                type="button"
                onClick={onVolverActivo}
                style={{ padding: '14px 26px', background: pal.ink, color: pal.cream, border: 'none', borderRadius: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: '0 12px 30px -14px oklch(20% 0.02 30 / 0.4)' }}
              >
                Volver al período activo
              </button>
            ) : (
              <button
                type="button"
                onClick={onIrAlEquipo}
                style={{
                  padding: '14px 26px',
                  background: pal.ink,
                  color: pal.cream,
                  border: 'none',
                  borderRadius: 14,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: '0 12px 30px -14px oklch(20% 0.02 30 / 0.4)',
                }}
              >
                {primerNombre ? `Empezar por ${primerNombre}` : 'Revisar el equipo'}
                <IconChevronRight size={14} stroke="currentColor" />
              </button>
            )}
            <button
              type="button"
              onClick={onIrAlEquipo}
              style={{ padding: '14px 22px', background: pal.cream2, color: pal.ink, border: `1px solid ${pal.line}`, borderRadius: 14, fontSize: 14, cursor: 'pointer' }}
            >
              Ver el equipo completo ↓
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={onExportar}
                style={{ padding: '14px 18px', background: 'transparent', color: pal.muted, border: 'none', borderRadius: 14, fontSize: 13, cursor: 'pointer' }}
              >
                Exportar CSV
              </button>
            )}
          </div>
        </div>

        <OndaInstrumento periodo={periodo} periodoTipo={periodoTipo} atender={atender} />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   § 02 — El estado: franja oscura viva
   Progreso del cierre (izq) · El acuerdo del período (centro) · Pulso de
   ajustes (der). Composición 1:1 con Planilla.dc.html §02; todos los
   números y estados salen de `emps`/`totales`/`barras` reales.
   --------------------------------------------------------- */

/** ₡1.223k — mismo formato que la referencia (miles, sin decimales). */
function formatK(n) {
  const miles = Math.round(n / 1000);
  return '₡' + miles.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'k';
}

function ProgresoCierre({ emps }) {
  const total = emps.length || 1;
  const pagados = emps.filter((e) => e.pago === 'pagado').length;
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pagados / total);

  return (
    <div>
      <div style={{ ...mono, color: 'oklch(75% 0.03 60)', marginBottom: 16 }}>Progreso del cierre</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
          <svg viewBox="0 0 100 100" style={{ width: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r={r} stroke="oklch(38% 0.02 30)" strokeWidth="6" fill="none" />
            <circle
              cx="50"
              cy="50"
              r={r}
              stroke={pal.sage}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              style={{ animation: 'ed-stroke-draw-sm 1.6s ease-out both' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 36, lineHeight: 1, ...serif }}>
              {pagados}
              <span style={{ color: 'oklch(72% 0.03 60)', fontSize: 22 }}>/{total}</span>
            </div>
            <div style={{ ...mono, fontSize: 9, marginTop: 2, color: 'oklch(75% 0.03 60)' }}>Revisadas</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, minWidth: 0 }}>
          {emps.map((e, i) => {
            const listo = e.pago === 'pagado';
            const enRevision = !listo && e.tieneAjuste;
            const c = listo ? pal.sage : enRevision ? pal.gold : 'oklch(50% 0.02 30)';
            const textColor = listo || enRevision ? 'oklch(90% 0.02 60)' : 'oklch(75% 0.03 60)';
            return (
              <div
                key={e.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, animation: `ed-fade-up 500ms ease-out ${200 + i * 100}ms both`, whiteSpace: 'nowrap' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: c, flexShrink: 0 }} />
                <span style={{ color: textColor }}>
                  {e.ini} · {listo ? 'listo' : enRevision ? 'en revisión' : 'esperando'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AcuerdoPeriodo({ totales, emps, ajustes, periodoDias, trendDeltaPct }) {
  const netoDisplay = useCountUp(totales.sumNeto, { duration: 900, format: formatK });
  const dedDisplay = useCountUp(totales.totDed, { duration: 900, format: formatK });
  const carDisplay = useCountUp(totales.totCar, { duration: 900, format: formatK });
  const costoDisplay = useCountUp(totales.totCosto, { duration: 1000, format: formatK });

  return (
    <div>
      <div style={{ ...mono, color: 'oklch(75% 0.03 60)', marginBottom: 14 }}>El acuerdo del período</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1.35fr', gap: 14, alignItems: 'start' }}>
        <div style={{ animation: 'ed-count-in 900ms cubic-bezier(.16,1,.3,1) both' }}>
          <div style={{ ...mono, fontSize: 9, color: 'oklch(75% 0.03 60)', marginBottom: 6 }}>Neto</div>
          <div style={{ fontSize: 38, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', ...serif }}>
            {netoDisplay}
          </div>
        </div>
        <div style={{ fontSize: 30, color: pal.gold, alignSelf: 'center', marginTop: 10, animation: 'ed-fade-in 500ms ease-out 400ms both', ...serif }}>+</div>
        <div style={{ animation: 'ed-count-in 900ms cubic-bezier(.16,1,.3,1) 300ms both' }}>
          <div style={{ ...mono, fontSize: 9, color: 'oklch(75% 0.03 60)', marginBottom: 6 }}>Deducciones</div>
          <div style={{ fontSize: 38, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', ...serif }}>
            {dedDisplay}
          </div>
        </div>
        <div style={{ fontSize: 30, color: pal.gold, alignSelf: 'center', marginTop: 10, animation: 'ed-fade-in 500ms ease-out 700ms both', ...serif }}>+</div>
        <div style={{ animation: 'ed-count-in 900ms cubic-bezier(.16,1,.3,1) 600ms both' }}>
          <div style={{ ...mono, fontSize: 9, color: 'oklch(75% 0.03 60)', marginBottom: 6 }}>Cargas</div>
          <div style={{ fontSize: 38, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', ...serif }}>
            {carDisplay}
          </div>
        </div>
        <div style={{ alignSelf: 'center', marginTop: 10, animation: 'ed-fade-in 500ms ease-out 1000ms both' }}>
          <svg width="34" height="24" viewBox="0 0 40 30" fill="none">
            <path
              d="M6,10 L34,10 M6,20 L34,20"
              stroke={pal.gold}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="80"
              style={{ animation: 'ed-stroke-draw-tiny 900ms ease-out 1200ms both' }}
            />
          </svg>
        </div>
        <div style={{ animation: 'ed-count-in 1s cubic-bezier(.16,1,.3,1) 1400ms both' }}>
          <div style={{ ...mono, fontSize: 9, color: pal.gold, marginBottom: 6 }}>Costo total</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.02em', color: pal.gold, fontVariantNumeric: 'tabular-nums', ...serif }}>
            {costoDisplay}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, fontSize: 12, color: 'oklch(80% 0.03 60)', flexWrap: 'wrap' }}>
        {trendDeltaPct !== null && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              borderRadius: 999,
              background: trendDeltaPct >= 0 ? 'oklch(70% 0.13 145 / 0.22)' : 'oklch(60% 0.15 25 / 0.22)',
              color: trendDeltaPct >= 0 ? 'oklch(82% 0.14 145)' : 'oklch(82% 0.14 55)',
            }}
          >
            {trendDeltaPct >= 0 ? '↑' : '↓'} {Math.abs(trendDeltaPct).toFixed(1)}% vs Q anterior
          </span>
        )}
        <span>
          {emps.length} {emps.length === 1 ? 'persona' : 'personas'} · {periodoDias} días · {ajustes} {ajustes === 1 ? 'movimiento' : 'movimientos'}
        </span>
      </div>
    </div>
  );
}

function PulsoAjustes({ periodo, periodoTipo, emps, ajustes, netoAjustes }) {
  const inicioDia = periodoTipo === 'mensual' ? 1 : periodo.mitad === 'b' ? 16 : 1;
  const finDia =
    periodoTipo === 'mensual'
      ? diasEnMes(periodo.anio, periodo.mesIndice)
      : periodo.mitad === 'b'
        ? diasEnMes(periodo.anio, periodo.mesIndice)
        : 15;
  const totalDias = Math.max(1, finDia - inicioDia + 1);
  const hoyIdx = HOY.dia >= inicioDia && HOY.dia <= finDia ? HOY.dia - inicioDia : -1;

  // Cuántas barras "movimiento" (sage) mostrar, distribuidas en los días ya
  // transcurridos — la cantidad es real (ajustes firmados), la distribución
  // es puramente visual (no tenemos fecha exacta de cada ajuste).
  const diasTranscurridos = hoyIdx >= 0 ? hoyIdx + 1 : totalDias;
  const destacadosSet = new Set();
  if (ajustes > 0 && diasTranscurridos > 1) {
    const paso = diasTranscurridos / Math.min(ajustes, diasTranscurridos);
    for (let k = 0; k < Math.min(ajustes, diasTranscurridos); k++) {
      destacadosSet.add(Math.min(diasTranscurridos - 1, Math.round(k * paso)));
    }
  }

  const barras = [];
  for (let i = 0; i < totalDias; i++) {
    const esHoy = i === hoyIdx;
    const esFuturo = hoyIdx >= 0 && i > hoyIdx;
    const destacado = destacadosSet.has(i) && !esHoy;
    // Pulso decorativo suave (no son datos, es la "forma" del pulso — igual que en la referencia).
    const base = 20 + Math.round(18 * Math.abs(Math.sin(i * 0.9)));
    const alto = esHoy ? 55 : destacado ? 70 + (i % 2) * 10 : base;
    barras.push({ i, esHoy, esFuturo, destacado, alto });
  }

  return (
    <div>
      <div style={{ ...mono, color: 'oklch(75% 0.03 60)', marginBottom: 14 }}>Pulso de ajustes</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${totalDias}, 1fr)`, gap: 3, height: 60, alignItems: 'end' }}>
        {barras.map((b) => (
          <div key={b.i} style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'end' }}>
            <div
              style={{
                width: '100%',
                height: `${b.alto}%`,
                background: b.esHoy ? pal.gold : b.destacado ? pal.sage : 'oklch(45% 0.02 30)',
                borderRadius: 2,
                opacity: b.esFuturo ? Math.max(0.25, 0.5 - b.i * 0.02) : 1,
                transformOrigin: 'bottom',
                animation: `ed-bar-grow 500ms cubic-bezier(.16,1,.3,1) ${200 + b.i * 40}ms both${
                  b.esHoy || b.destacado ? `, ed-bar-wave ${4 + (b.i % 3)}s ease-in-out infinite ${b.i * 0.2}s` : ''
                }`,
              }}
            />
            {b.esHoy && (
              <span
                style={{
                  position: 'absolute',
                  top: -14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8,
                  color: pal.gold,
                  letterSpacing: '0.1em',
                }}
              >
                HOY
              </span>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'oklch(72% 0.03 60)' }}>
        <span>{String(inicioDia).padStart(2, '0')}</span>
        <span>{String(Math.min(finDia, inicioDia + 4)).padStart(2, '0')}</span>
        <span>{String(Math.min(finDia, inicioDia + 9)).padStart(2, '0')}</span>
        <span>{String(finDia).padStart(2, '0')}</span>
      </div>
      <div style={{ fontSize: 15, fontStyle: 'italic', marginTop: 12, color: 'oklch(88% 0.02 60)', ...serif }}>
        {ajustes} {ajustes === 1 ? 'movimiento' : 'movimientos'} ·{' '}
        <span style={{ color: pal.gold }}>
          {netoAjustes >= 0 ? '+' : '−'}
          {money(Math.abs(netoAjustes))}
        </span>{' '}
        netos
      </div>
    </div>
  );
}

function EstadoBand({ totales, emps, periodo, periodoTipo, barras }) {
  // Misma fuente que el rail de ajustes (§ 04) — ver `buildMovimientosRail`.
  const ajustes = buildMovimientosRail(emps).length;
  // Efecto neto REAL de los ajustes sobre lo que la persona recibe: horas
  // extra + bono, MENOS la deducción puntual. Antes se llamaba "netos" pero
  // solo sumaba `brutoQ - salario/2` (horas extra + bono), ignorando
  // cualquier deducción registrada — "netos" mostraba en realidad el bruto
  // de los ajustes (auditoría F17).
  const netoAjustes = emps.reduce((acc, e) => {
    const montoHorasExtra = e.montoHorasExtra || 0;
    return acc + montoHorasExtra + (e.bono || 0) - (e.deduccionPuntual || 0);
  }, 0);

  const inicioDia = periodoTipo === 'mensual' ? 1 : periodo.mitad === 'b' ? 16 : 1;
  const finDia =
    periodoTipo === 'mensual'
      ? diasEnMes(periodo.anio, periodo.mesIndice)
      : periodo.mitad === 'b'
        ? diasEnMes(periodo.anio, periodo.mesIndice)
        : 15;
  const periodoDias = finDia - inicioDia + 1;

  const trendPoints = (barras || []).map((b) => parseFloat(b.hStr));
  const trendDeltaPct =
    trendPoints.length >= 2 && trendPoints[trendPoints.length - 2] !== 0
      ? ((trendPoints[trendPoints.length - 1] - trendPoints[trendPoints.length - 2]) / trendPoints[trendPoints.length - 2]) * 100
      : null;

  return (
    <section
      style={{
        margin: '20px 56px 0',
        position: 'relative',
        borderRadius: 32,
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${pal.ink} 0%, ${pal.ink2} 100%)`,
        color: pal.cream,
        padding: '44px 48px 40px',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '120%', background: 'radial-gradient(circle, oklch(75% 0.16 30 / 0.35), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora 10s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '-10%', right: '-15%', width: '55%', height: '110%', background: 'radial-gradient(circle, oklch(70% 0.15 320 / 0.32), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora-2 12s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-30%', left: '40%', width: '45%', height: '80%', background: 'radial-gradient(circle, oklch(80% 0.14 65 / 0.28), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora 14s ease-in-out infinite reverse' }} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(115deg, transparent 40%, oklch(100% 0 0 / 0.05) 48%, oklch(100% 0 0 / 0.08) 50%, oklch(100% 0 0 / 0.05) 52%, transparent 60%)',
            backgroundSize: '200% 100%',
            animation: 'ed-shimmer 8s ease-in-out infinite',
            mixBlendMode: 'overlay',
          }}
        />
      </div>

      <div className="ed-grid-estado" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '3fr 6fr 3fr', gap: 48, alignItems: 'center' }}>
        <ProgresoCierre emps={emps} />
        <AcuerdoPeriodo totales={totales} emps={emps} ajustes={ajustes} periodoDias={periodoDias} trendDeltaPct={trendDeltaPct} />
        <PulsoAjustes periodo={periodo} periodoTipo={periodoTipo} emps={emps} ajustes={ajustes} netoAjustes={netoAjustes} />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Empleados — el centro de la pantalla, expandibles inline con waterfall
   --------------------------------------------------------- */

function MiniNumberField({ label, help, value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 140 }}>
      <span style={{ ...mono, fontSize: 9 }}>{label}</span>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '9px 12px',
          borderRadius: 10,
          border: `1px solid ${pal.line}`,
          background: pal.surface,
          fontSize: 14,
          fontFamily: 'inherit',
          color: pal.ink,
        }}
      />
      {help && <span style={{ fontSize: 10.5, color: pal.muted2 }}>{help}</span>}
    </label>
  );
}

/* ---------------------------------------------------------
   Modal de pago — mismo flujo real que Pagos.jsx: método de pago real
   (nunca la cuenta bancaria del empleado) y la misma fecha "hoy" de la
   app (`fechaISO(HOY)`). Antes este botón pagaba directo con
   `metodo: e.banco`, mezclando la cuenta del empleado con el método.
   --------------------------------------------------------- */
const HOY_ISO = fechaISO(HOY);

/**
 * Métodos de pago disponibles: los que estén configurados en Configuración →
 * "Métodos de pago". Antes era una constante fija dentro de este archivo (y
 * otra idéntica dentro de Pagos.jsx), así que la interfaz ofrecía cuatro
 * opciones que no se podían cambiar desde ningún lado.
 */
function listaMetodos(metodos) {
  return Array.isArray(metodos) && metodos.length > 0 ? metodos : ['Transferencia'];
}

function PagoModal({ open, sugerido, metodos, onClose, onConfirmar }) {
  const METODOS_PAGO = listaMetodos(metodos);
  const [metodo, setMetodo] = useState(sugerido || METODOS_PAGO[0]);
  const [fecha, setFecha] = useState(HOY_ISO);
  // Fase 10 — registro financiero manual: referencia y comisión son
  // opcionales (no todo pago trae una, y no todo canal cobra comisión), pero
  // antes no existía ningún campo para dejarlas anotadas.
  const [referencia, setReferencia] = useState('');
  const [comision, setComision] = useState('');

  useEffect(() => {
    if (open) {
      setMetodo(sugerido || METODOS_PAGO[0]);
      setFecha(HOY_ISO);
      setReferencia('');
      setComision('');
    }
    // `METODOS_PAGO` se recalcula en cada render pero su contenido solo cambia
    // cuando cambia la configuración, que ya llega por `sugerido`/`metodos`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sugerido]);

  // Nunca una fecha futura ni vacía — un pago no puede haber ocurrido
  // "mañana" (auditoría F5).
  const fechaInvalida = !fecha || fecha > HOY_ISO;
  const comisionNum = comision.trim() === '' ? 0 : Number(comision);
  const comisionInvalida = comision.trim() !== '' && (Number.isNaN(comisionNum) || comisionNum < 0);

  const campoStyle = { padding: '9px 12px', borderRadius: 10, border: `1px solid ${pal.line}`, background: pal.surface, fontSize: 14, fontFamily: 'inherit', color: pal.ink };

  return (
    <Modal open={open} onClose={onClose} title="Marcar como pagada" width={380}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ ...mono, fontSize: 9 }}>Método de pago</span>
          <select value={metodo} onChange={(ev) => setMetodo(ev.target.value)} style={campoStyle}>
            {METODOS_PAGO.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ ...mono, fontSize: 9 }}>Fecha de pago</span>
          <input type="date" value={fecha} max={HOY_ISO} onChange={(ev) => setFecha(ev.target.value)} style={campoStyle} />
          {fechaInvalida && <span style={{ fontSize: 10.5, color: 'oklch(50% 0.15 25)' }}>La fecha no puede ser futura ni estar vacía.</span>}
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ ...mono, fontSize: 9 }}>Referencia bancaria (opcional)</span>
          <input type="text" value={referencia} onChange={(ev) => setReferencia(ev.target.value)} placeholder="Ej. 000123456" style={campoStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ ...mono, fontSize: 9 }}>Comisión bancaria ₡ (si corresponde)</span>
          <input type="number" min="0" step="1" value={comision} onChange={(ev) => setComision(ev.target.value)} placeholder="0" style={campoStyle} />
          {comisionInvalida && <span style={{ fontSize: 10.5, color: 'oklch(50% 0.15 25)' }}>Ingresá un monto válido.</span>}
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 16px', background: 'transparent', color: pal.muted, border: `1px solid ${pal.line}`, borderRadius: 10, fontSize: 12, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={fechaInvalida || comisionInvalida}
            onClick={() => {
              if (fechaInvalida || comisionInvalida) return;
              const fechaFmt = new Date(fecha + 'T00:00:00').toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
              onConfirmar({ metodo, fecha: fechaFmt, referencia: referencia.trim(), comision: comisionNum });
            }}
            style={{ padding: '10px 20px', background: pal.ink, color: pal.cream, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: fechaInvalida || comisionInvalida ? 0.5 : 1 }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   § 03 — El taller: índice editorial + página de detalle de
   la persona seleccionada. Los empleados viven únicamente acá
   (no hay una sección global "el equipo").
   --------------------------------------------------------- */

function IndiceFila({ e, i, activo, onClick }) {
  if (activo) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          position: 'relative',
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '20px 4px 20px 24px',
          background: `linear-gradient(90deg, oklch(97% 0.015 65) 0%, transparent 100%)`,
          borderRadius: '16px 0 0 16px',
          marginLeft: -8,
          border: 'none',
          borderLeft: `3px solid ${pal.coral}`,
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: 'inset 4px 0 10px oklch(93% 0.03 60 / 0.15)',
        }}
      >
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontStyle: 'italic', color: pal.coral, fontSize: 28, ...serif }}>{String(i + 1).padStart(2, '0')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <Dot c={e.pago === 'pagado' ? pal.sage : e.tieneAjuste ? pal.gold : 'oklch(60% 0.02 55)'} glow={e.pago !== 'pagado' && e.tieneAjuste} size={8} />
            <span style={{ color: e.pago === 'pagado' ? 'oklch(38% 0.11 145)' : e.tieneAjuste ? 'oklch(48% 0.11 55)' : pal.muted, fontWeight: 600 }}>
              {e.pago === 'pagado' ? 'Listo' : e.tieneAjuste ? 'En revisión' : 'Esperando'}
            </span>
          </span>
        </span>
        <div style={{ fontSize: 24, lineHeight: 1.1, marginTop: 4, color: pal.ink, ...serif }}>{e.nombre}</div>
        <div style={{ fontSize: 12, color: pal.muted, marginTop: 4 }}>
          {e.puesto} · {e.tipo === 'Medio tiempo' ? 'MT' : 'TC'} · {e.banco.split(' ')[0]}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <span style={{ fontSize: 20, color: pal.ink, fontVariantNumeric: 'tabular-nums', ...serif }}>{e.netoFmt}</span>
          <svg width="100" height="22" viewBox="0 0 100 22" fill="none" style={{ overflow: 'visible' }}>
            <path d="M2,12 Q16,4 32,10 T62,8 T96,14" stroke={pal.coral} strokeWidth="2.2" fill="none" opacity="0.8" />
            <circle
              cx="0"
              cy="0"
              r="3"
              fill={pal.coral}
              style={{
                animation: 'ed-dot-slide 3.5s ease-in-out infinite alternate',
                offsetPath: "path('M2,12 Q16,4 32,10 T62,8 T96,14')",
              }}
            />
          </svg>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '16px 4px 16px 20px',
        border: 'none',
        borderBottomWidth: 1,
        borderBottomStyle: 'solid',
        borderBottomColor: pal.line2,
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background-color 200ms ease',
      }}
      onMouseEnter={(el) => {
        if (!hoverFino()) return;
        el.currentTarget.style.background = 'oklch(97% 0.015 65 / 0.4)';
      }}
      onMouseLeave={(el) => {
        el.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontStyle: 'italic', color: 'oklch(60% 0.05 40)', fontSize: 22, ...serif }}>{String(i + 1).padStart(2, '0')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <Dot c={e.pago === 'pagado' ? pal.sage : e.tieneAjuste ? pal.gold : 'oklch(75% 0.02 55)'} size={7} />
          <span style={{ color: e.pago === 'pagado' ? 'oklch(38% 0.11 145)' : e.tieneAjuste ? 'oklch(48% 0.11 55)' : pal.muted }}>
            {e.pago === 'pagado' ? 'Listo' : e.tieneAjuste ? 'En revisión' : 'Esperando'}
          </span>
        </span>
      </span>
      <div style={{ fontSize: 19, lineHeight: 1.15, marginTop: 2, color: pal.ink, ...serif }}>{e.nombre}</div>
      <div style={{ fontSize: 11, color: pal.muted, marginTop: 2 }}>
        {e.puesto} · {e.tipo === 'Medio tiempo' ? 'MT' : 'TC'} · {e.banco.split(' ')[0]}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ fontSize: 16, color: pal.muted2, fontVariantNumeric: 'tabular-nums', ...serif }}>{e.netoFmt}</span>
        <svg width="80" height="16" viewBox="0 0 80 16" fill="none">
          <path d="M2,8 Q14,4 26,8 T50,7 T78,9" stroke={pal.muted2} strokeWidth="1.4" fill="none" opacity="0.4" />
        </svg>
      </div>
    </button>
  );
}

function PaginaEmpleado({ e, index, readOnly, periodoDias, metodosPago, onAjustar, onMarcarPagado, onAlternarConciliacion, onNavigate }) {
  // Estos campos son el PRÓXIMO movimiento a firmar, no una edición del
  // total ya acumulado (los ajustes se suman entre sí — ver App.jsx
  // `guardarAjuste`, auditoría F14). Por eso arrancan vacíos en vez de
  // precargar `e.horasExtra`/`e.bono`/`e.deduccionPuntual`: precargar el
  // total invitaba a "corregirlo", y esa corrección se sumaba en vez de
  // reemplazarlo, duplicando el monto.
  const [horasExtra, setHorasExtra] = useState('');
  const [bono, setBono] = useState('');
  const [deduccion, setDeduccion] = useState('');
  const [pagando, setPagando] = useState(false);

  // Al cambiar de persona (o justo después de firmar, cuando el total ya
  // acumulado cambia) se limpia el formulario para el siguiente movimiento.
  useEffect(() => {
    setHorasExtra('');
    setBono('');
    setDeduccion('');
  }, [e.id, e.horasExtra, e.bono, e.deduccionPuntual]);

  function aplicar() {
    onAjustar(e.id, { horasExtra: Number(horasExtra) || 0, bono: Number(bono) || 0, deduccion: Number(deduccion) || 0 });
  }

  const valorHora = e.valorHora || 0;
  const montoHorasExtra = e.montoHorasExtra || 0;

  const movimientos = [];
  if (e.horasExtra > 0) movimientos.push({ tipo: 'Horas extras', signo: 1, monto: montoHorasExtra, desc: `${e.horasExtra}h extra a ${e.factorHoraExtra}× esta quincena.` });
  if (e.bono > 0) movimientos.push({ tipo: 'Bono', signo: 1, monto: e.bono, desc: 'Bono puntual de la quincena.' });
  if (e.deduccionPuntual > 0) movimientos.push({ tipo: 'Deducción', signo: -1, monto: e.deduccionPuntual, desc: 'Deducción puntual de la quincena.' });

  const waterfallRows = [
    { label: 'Salario bruto', value: e.brutoFmt, color: pal.ink },
    { label: 'Deducción CCSS', value: `− ${e.dedFmt}`, color: pal.sky },
    ...movimientos.map((m) => ({ label: m.tipo, value: `${m.signo > 0 ? '+' : '−'} ${money(m.monto)}`, color: m.signo > 0 ? pal.sage : 'oklch(55% 0.13 25)' })),
    { label: 'Salario neto', value: e.netoFmt, color: pal.ink, bold: true },
  ];

  return (
    <div>
      {/* Retrato + identidad */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, paddingBottom: 32, borderBottom: `1px solid ${pal.line}`, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
          {/* Anillo de resplandor rotatorio premium */}
          <div
            style={{
              position: 'absolute',
              inset: -5,
              borderRadius: 999,
              background: `linear-gradient(135deg, ${e.avBg}, oklch(85% 0.12 60))`,
              opacity: 0.45,
              filter: 'blur(3px)',
              animation: 'ed-spin-slow 10s linear infinite',
            }}
          />
          {/* Máscara de fondo */}
          <div
            style={{
              position: 'absolute',
              inset: -1.5,
              borderRadius: 999,
              background: pal.cream,
            }}
          />
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: 999,
              background: e.avBg,
              color: e.avC,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 44,
              fontStyle: 'italic',
              boxShadow: '0 6px 18px -4px oklch(0% 0 0 / 0.1)',
              ...serif,
            }}
          >
            {e.ini}
          </div>
          <span
            style={{
              position: 'absolute',
              bottom: 6,
              right: 6,
              width: 20,
              height: 20,
              borderRadius: 999,
              background: e.pgD,
              border: `3px solid ${pal.cream}`,
              animation: e.pago !== 'pagado' ? 'ed-dot-glow 2.4s ease-in-out infinite' : undefined,
              boxShadow: '0 2px 8px oklch(0% 0 0 / 0.15)',
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ ...mono, marginBottom: 8 }}>
            {String(index + 1).padStart(2, '0')} · {e.pgL.toLowerCase()}
          </div>
          <div style={{ fontSize: 44, lineHeight: 0.98, letterSpacing: '-0.02em', color: pal.ink, animation: 'ed-fade-up 700ms ease-out both', ...serif }}>
            {e.nombre.split(' ')[0]} <em style={{ fontStyle: 'italic' }}>{e.nombre.split(' ').slice(1).join(' ')}</em>
          </div>
          <div style={{ fontSize: 16, fontStyle: 'italic', color: 'oklch(35% 0.03 30)', marginTop: 6, ...serif }}>
            {e.puesto} · {e.tipo.toLowerCase()} · con vos desde {e.ingreso}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 12px', border: `1px solid ${pal.line}`, borderRadius: 999, fontSize: 11.5, color: pal.ink, background: pal.cream2 }}>
              {e.banco}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 12px', border: `1px solid ${pal.line}`, borderRadius: 999, fontSize: 11.5, color: pal.ink, background: pal.cream2 }}>
              {periodoDias} días del período
            </span>
            {movimientos.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', border: `1px solid ${pal.line}`, borderRadius: 999, fontSize: 11.5, color: pal.ink, background: pal.cream2 }}>
                <span style={{ color: pal.sage, fontWeight: 700 }}>{movimientos.length}</span> {movimientos.length === 1 ? 'ajuste' : 'ajustes'} este período
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...mono, marginBottom: 4 }}>Recibirá</div>
          <div style={{ fontSize: 40, lineHeight: 1, color: pal.ink, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', animation: 'ed-count-in 900ms cubic-bezier(.16,1,.3,1) both', ...serif }}>
            {e.netoFmt}
          </div>
          <div style={{ fontSize: 12, color: pal.muted, marginTop: 6 }}>de un bruto de {e.brutoFmt}</div>
        </div>
      </div>

      {/* Desglose bruto → neto */}
      <div style={{ padding: '32px 0 8px' }}>
        <div style={{ ...mono, marginBottom: 6 }}>Desglose · bruto → neto</div>
        <div style={{ fontSize: 24, letterSpacing: '-0.01em', color: pal.ink, marginBottom: 18, ...serif }}>De lo que gana, a lo que recibe.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, background: pal.cream2, borderRadius: 18, padding: '16px 20px', border: `1px solid ${pal.line}` }}>
          {waterfallRows.map((r) => (
            <div
              key={r.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                padding: '10px 12px',
                borderRadius: 10,
                borderBottom: r.bold ? 'none' : `1px solid ${pal.line}`,
                transition: 'all 200ms ease',
                cursor: 'default',
              }}
              onMouseEnter={(el) => {
                if (!hoverFino()) return;
                el.currentTarget.style.background = 'oklch(96% 0.01 65)';
                el.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(el) => {
                el.currentTarget.style.background = 'transparent';
                el.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <span style={{ color: r.bold ? pal.ink : pal.muted, fontWeight: r.bold ? 700 : 400 }}>{r.label}</span>
              <span style={{ fontWeight: r.bold ? 700 : 600, color: r.color, fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
            </div>
          ))}
        </div>

        {/* Epílogo: lo que la empresa suma — Contenedor glassmorphic premium con shimmer */}
        <div
          style={{
            marginTop: 24,
            padding: '24px 28px',
            background: `linear-gradient(135deg, ${pal.cream2} 0%, oklch(98% 0.01 60 / 0.8) 100%)`,
            border: `1px solid ${pal.line}`,
            borderRadius: 20,
            boxShadow: '0 4px 14px -4px oklch(0% 0 0 / 0.04)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 24,
            flexWrap: 'wrap',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent, oklch(100% 0 0 / 0.3) 50%, transparent)',
              backgroundSize: '200% 100%',
              animation: 'ed-shimmer 8s linear infinite',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ ...mono, marginBottom: 6 }}>Epílogo · lo que la empresa suma</div>
            <div style={{ fontSize: 15, fontStyle: 'italic', color: 'oklch(35% 0.03 30)', maxWidth: 420, ...serif }}>
              Además del neto, la empresa aporta cargas patronales por {e.nombre.split(' ')[0]}.
            </div>
          </div>
          <div style={{ textAlign: 'right', position: 'relative', zIndex: 2 }}>
            <div style={{ ...mono, marginBottom: 4, color: 'oklch(45% 0.09 30)' }}>Costo total para la empresa</div>
            <div style={{ fontSize: 32, lineHeight: 1, letterSpacing: '-0.02em', color: 'oklch(35% 0.10 30)', fontStyle: 'italic', fontVariantNumeric: 'tabular-nums', ...serif }}>
              {e.costoFmt}
            </div>
            <div style={{ fontSize: 11, color: pal.muted, marginTop: 4 }}>cargas patronales + INS: {e.carFmt}</div>
          </div>
        </div>
      </div>

      {/* Ajustes de esta persona */}
      <div style={{ padding: '28px 0 8px', borderTop: `1px solid ${pal.line}` }}>
        <div style={{ ...mono, marginBottom: 6 }}>
          Ajustes de esta quincena · {movimientos.length} {movimientos.length === 1 ? 'firmado' : 'firmados'}
        </div>
        <div style={{ fontSize: 20, marginBottom: 16, ...serif }}>
          Lo que <em style={{ fontStyle: 'italic' }}>movió</em> el resultado
        </div>

        {movimientos.length === 0 && <div style={{ fontSize: 13, color: pal.muted, marginBottom: 8 }}>Sin ajustes puntuales todavía.</div>}

        {movimientos.map((m) => (
          <div
            key={m.tipo}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 16,
              alignItems: 'center',
              padding: '14px 18px',
              background: pal.cream2,
              border: `1px solid ${pal.line}`,
              borderRadius: 14,
              marginBottom: 8,
              transition: 'all 200ms ease',
            }}
            onMouseEnter={(el) => {
              if (!hoverFino()) return;
              el.currentTarget.style.transform = 'translateY(-2px)';
              el.currentTarget.style.boxShadow = '0 4px 12px -4px oklch(0% 0 0 / 0.06)';
              el.currentTarget.style.borderColor = pal.gold;
            }}
            onMouseLeave={(el) => {
              el.currentTarget.style.transform = 'translateY(0)';
              el.currentTarget.style.boxShadow = 'none';
              el.currentTarget.style.borderColor = pal.line;
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ width: 18, height: 18, borderRadius: 6, background: m.signo > 0 ? 'oklch(94% 0.08 145)' : 'oklch(94% 0.06 25)', color: m.signo > 0 ? 'oklch(38% 0.11 145)' : 'oklch(50% 0.13 25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>
                  {m.signo > 0 ? '+' : '−'}
                </span>
                <span style={{ ...mono, fontSize: 9, color: m.signo > 0 ? 'oklch(38% 0.11 145)' : 'oklch(50% 0.13 25)' }}>{m.tipo}</span>
              </div>
              <div style={{ fontSize: 14, fontStyle: 'italic', color: pal.ink, ...serif }}>{m.desc}</div>
            </div>
            <span style={{ fontSize: 20, color: m.signo > 0 ? 'oklch(38% 0.12 145)' : 'oklch(45% 0.13 25)', fontVariantNumeric: 'tabular-nums', ...serif }}>
              {m.signo > 0 ? '+' : '−'}
              {money(m.monto)}
            </span>
          </div>
        ))}

        {!readOnly && (
          <div style={{ marginTop: 12, padding: '16px 18px', border: `1px dashed ${pal.line}`, borderRadius: 16 }}>
            <div style={{ ...mono, fontSize: 9, marginBottom: 10 }}>Ajustar esta quincena</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <MiniNumberField label="Horas extra" help={`Se pagan a ${e.factorHoraExtra}×`} value={horasExtra} onChange={setHorasExtra} />
              <MiniNumberField label="Bono (₡)" value={bono} onChange={setBono} />
              <MiniNumberField label="Deducción (₡)" help="Adelantos, préstamos…" value={deduccion} onChange={setDeduccion} />
            </div>
            <button
              type="button"
              onClick={aplicar}
              style={{
                marginTop: 14,
                padding: '11px 22px',
                background: pal.ink,
                color: pal.cream,
                border: 'none',
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 200ms ease',
                boxShadow: '0 2px 8px oklch(20% 0.02 30 / 0.1)',
              }}
              onMouseEnter={(e) => {
                if (!hoverFino()) return;
                e.currentTarget.style.transform = 'translateY(-1.5px)';
                e.currentTarget.style.boxShadow = '0 6px 14px oklch(20% 0.02 30 / 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px oklch(20% 0.02 30 / 0.1)';
              }}
            >
              Firmar y guardar
            </button>
          </div>
        )}
      </div>

      {/* Estado y acciones — Rediseñado Premium con Doble Aurora Rotatoria */}
      <div
        style={{
          marginTop: 28,
          position: 'relative',
          padding: '30px 36px',
          background: e.pago === 'pagado' ? 'linear-gradient(160deg, oklch(93% 0.05 145) 0%, oklch(89% 0.08 150) 100%)' : 'linear-gradient(160deg, oklch(92% 0.06 55) 0%, oklch(87% 0.11 30) 100%)',
          borderRadius: 22,
          overflow: 'hidden',
          boxShadow: '0 4px 20px -6px oklch(0% 0 0 / 0.08)',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {/* Doble aurora bioluminiscente rotatoria */}
          <div style={{ position: 'absolute', top: '-40%', right: '-15%', width: '55%', height: '180%', background: `radial-gradient(circle, ${e.pago === 'pagado' ? 'oklch(85% 0.10 145 / 0.4)' : 'oklch(90% 0.14 55 / 0.5)'}, transparent 65%)`, filter: 'blur(20px)', animation: 'ed-aurora 8s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '-40%', left: '-10%', width: '50%', height: '160%', background: `radial-gradient(circle, ${e.pago === 'pagado' ? 'oklch(88% 0.08 145 / 0.3)' : 'oklch(91% 0.11 55 / 0.4)'}, transparent 70%)`, filter: 'blur(24px)', animation: 'ed-aurora-2 11s ease-in-out infinite' }} />
        </div>
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'center', flexWrap: 'wrap' }} className="ed-grid-2">
          <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: -10, borderRadius: 999, background: `radial-gradient(circle, ${e.pgD} / 0.45, transparent 70%)`, animation: 'ed-sun-halo 5s ease-in-out infinite alternate' }} />
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                borderRadius: 999,
                background: e.pago === 'pagado' ? `linear-gradient(135deg, ${pal.sage}, oklch(60% 0.13 145))` : `linear-gradient(135deg, ${pal.gold}, oklch(75% 0.16 55))`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontStyle: 'italic',
                fontSize: 18,
                color: pal.ink,
                boxShadow: '0 4px 12px oklch(0% 0 0 / 0.12)',
                ...serif,
              }}
            >
              {e.pgL}
            </div>
          </div>
          <div>
            <div style={{ ...mono, color: 'oklch(35% 0.06 30)', marginBottom: 6 }}>Estado · {e.pago === 'pagado' ? 'pagada' : movimientos.length > 0 ? 'en revisión → lista' : 'esperando turno'}</div>
            <div style={{ fontSize: 20, fontStyle: 'italic', lineHeight: 1.3, color: pal.ink, maxWidth: 480, ...serif }}>
              {e.pago === 'pagado'
                ? `${e.nombre.split(' ')[0]} ya está pagada${e.fechaPago !== '—' ? ` · ${e.fechaPago}` : ''}${e.metodo !== '—' ? ` · ${e.metodo}` : ''}.`
                : `${e.nombre.split(' ')[0]} está lista para recibir su pago. Al marcarla como pagada, se cierra su parte del período.`}
            </div>
          </div>
          {!readOnly && e.pago !== 'pagado' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
              <button
                type="button"
                onClick={() => setPagando(true)}
                style={{
                  padding: '12px 20px',
                  background: pal.ink,
                  color: pal.cream,
                  border: 'none',
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                  boxShadow: '0 2px 8px oklch(20% 0.02 30 / 0.12)',
                }}
                onMouseEnter={(el) => {
                  if (!hoverFino()) return;
                  el.currentTarget.style.transform = 'translateY(-1.5px)';
                  el.currentTarget.style.boxShadow = '0 6px 14px oklch(20% 0.02 30 / 0.2)';
                }}
                onMouseLeave={(el) => {
                  el.currentTarget.style.transform = 'translateY(0)';
                  el.currentTarget.style.boxShadow = '0 2px 8px oklch(20% 0.02 30 / 0.12)';
                }}
              >
                Marcar como pagada
              </button>
              <button type="button" aria-disabled="true" title="Todavía no está conectado" style={{ padding: '10px 18px', background: pal.surface, color: pal.muted, border: `1px solid ${pal.line}`, borderRadius: 12, fontSize: 12, cursor: 'not-allowed', opacity: 0.6 }}>
                Enviar recibo por SINPE
              </button>
              <button
                type="button"
                onClick={() => onNavigate('empleados')}
                style={{
                  padding: '8px 18px',
                  background: 'transparent',
                  color: 'oklch(35% 0.06 30)',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'opacity 180ms ease',
                }}
                onMouseEnter={(el) => { if (hoverFino()) el.currentTarget.style.opacity = 0.75; }}
                onMouseLeave={(el) => { el.currentTarget.style.opacity = 1; }}
              >
                Ver ficha completa ↗
              </button>
            </div>
          )}
          {/* Registro financiero manual (Fase 10): referencia y comisión que
              se anotaron al marcar el pago, más el estado de conciliación —
              distinto y posterior al hecho de "ya se pagó": conciliar es
              confirmar a mano que el movimiento apareció en el estado de
              cuenta, así que es una acción separada y reversible. */}
          {!readOnly && e.pago === 'pagado' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
              <div style={{ fontSize: 11.5, color: 'oklch(35% 0.06 30)', lineHeight: 1.7 }}>
                <div>Ref. {e.referenciaPago && e.referenciaPago !== '—' ? e.referenciaPago : 'sin registrar'}</div>
                <div>Comisión: {e.comisionPago ? money(e.comisionPago) : 'sin comisión registrada'}</div>
              </div>
              <button
                type="button"
                onClick={() => onAlternarConciliacion(e.id)}
                style={{
                  padding: '10px 16px',
                  background: e.conciliado ? 'oklch(94% 0.06 145)' : pal.surface,
                  color: e.conciliado ? 'oklch(38% 0.11 145)' : pal.ink,
                  border: `1px solid ${e.conciliado ? pal.sage : pal.line}`,
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {e.conciliado ? `Conciliado ✓ · ${e.conciliadoFecha}` : 'Marcar como conciliado'}
              </button>
            </div>
          )}
        </div>
      </div>

      <PagoModal
        open={pagando}
        metodos={metodosPago}
        sugerido={sugerirMetodoPago(e.banco, metodosPago)}
        onClose={() => setPagando(false)}
        onConfirmar={(datos) => {
          onMarcarPagado(e.id, datos);
          setPagando(false);
        }}
      />
    </div>
  );
}

function TallerSection({ emps, totales, readOnly, periodoDias, metodosPago, busqueda, onAjustar, onMarcarPagado, onAlternarConciliacion, onNavigate }) {
  const [filtro, setFiltro] = useState('todos');
  const [selectedId, setSelectedId] = useState(() => (emps.find((e) => e.pago !== 'pagado') || emps[0])?.id);

  useEffect(() => {
    if (!emps.find((e) => e.id === selectedId)) setSelectedId(emps[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emps]);

  const porRevisar = emps.filter((e) => e.pago !== 'pagado').length;
  const conAjustes = emps.filter((e) => e.tieneAjuste).length;
  // El buscador del encabezado filtra este mismo índice (nombre, puesto o
  // cédula). La persona abierta a la derecha no cambia sola por escribir:
  // sigue siendo la seleccionada hasta que se elija otra del índice.
  const q = (busqueda || '').trim().toLowerCase();
  const visibles = emps
    .filter((e) => (filtro === 'revisar' ? e.pago !== 'pagado' : filtro === 'ajustes' ? e.tieneAjuste : true))
    .filter((e) => !q || e.nombre.toLowerCase().includes(q) || (e.puesto || '').toLowerCase().includes(q) || (e.cedula || '').toLowerCase().includes(q));
  const selected = emps.find((e) => e.id === selectedId) || emps[0];
  const selectedIndex = emps.findIndex((e) => e.id === selected?.id);

  return (
    <section id="planilla-taller" style={{ padding: '0 56px 56px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 03 · el taller</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            {emps.length === 1 ? 'Una persona' : `${emps.length === 6 ? 'Seis' : emps.length} personas`}, <em style={{ fontStyle: 'italic' }}>una a una</em>
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <div style={{ display: 'inline-flex', padding: 3, background: pal.cream2, border: `1px solid ${pal.line}`, borderRadius: 10, fontSize: 12 }}>
          {[
            { k: 'todos', l: `Todos · ${emps.length}` },
            { k: 'revisar', l: `Por revisar · ${porRevisar}` },
            { k: 'ajustes', l: `Con ajustes · ${conAjustes}` },
          ].map((f) => (
            <button
              key={f.k}
              type="button"
              onClick={() => setFiltro(f.k)}
              style={{
                padding: '5px 12px',
                border: 'none',
                background: filtro === f.k ? pal.ink : 'transparent',
                color: filtro === f.k ? pal.cream : pal.muted,
                borderRadius: 7,
                cursor: 'pointer',
                fontWeight: filtro === f.k ? 600 : 400,
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                if (hoverFino() && filtro !== f.k) e.currentTarget.style.color = pal.ink;
              }}
              onMouseLeave={(e) => {
                if (filtro !== f.k) e.currentTarget.style.color = pal.muted;
              }}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      <div className="ed-grid-taller" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 36, alignItems: 'start' }}>
        <div>
          <div style={{ ...mono, marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${pal.line}` }}>Índice del equipo</div>
          {visibles.map((e) => (
            <IndiceFila key={e.id} e={e} i={emps.indexOf(e)} activo={e.id === selected?.id} onClick={() => setSelectedId(e.id)} />
          ))}
          {visibles.length === 0 && (
            <div style={{ padding: '18px 4px', fontSize: 13, fontStyle: 'italic', color: pal.muted, ...serif }}>
              Nadie coincide con ese filtro o esa búsqueda.
            </div>
          )}
        </div>

        {selected && (
          <PaginaEmpleado
            key={selected.id}
            e={selected}
            index={selectedIndex}
            readOnly={readOnly}
            periodoDias={periodoDias}
            metodosPago={metodosPago}
            onAjustar={onAjustar}
            onMarcarPagado={onMarcarPagado}
            onAlternarConciliacion={onAlternarConciliacion}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   § 04 — Rail de ajustes: timeline horizontal de los movimientos
   reales de la quincena (`buildMovimientosRail`, definido arriba).
   --------------------------------------------------------- */

const RAIL_FILTROS = ['Todos', 'Horas extras', 'Bono', 'Deducción'];

function RailAjustes({ emps, readOnly, onIrAlTaller }) {
  const [filtro, setFiltro] = useState('Todos');
  const movimientos = buildMovimientosRail(emps);
  const visibles = filtro === 'Todos' ? movimientos : movimientos.filter((m) => m.tipo === filtro);

  const sumados = movimientos.filter((m) => m.signo > 0).reduce((a, m) => a + m.monto, 0);
  const deducidos = movimientos.filter((m) => m.signo < 0).reduce((a, m) => a + m.monto, 0);
  const neto = sumados - deducidos;

  // Animación CountUp de totales
  const sumadosDisplay = useCountUp(sumados, { duration: 900, format: money });
  const deducidosDisplay = useCountUp(deducidos, { duration: 900, format: money });
  const netoDisplay = useCountUp(Math.abs(neto), { duration: 1000, format: money });

  return (
    <section style={{ padding: '0 56px 56px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 04 · rail de ajustes</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            {movimientos.length === 0 ? 'Ningún' : movimientos.length}{' '}
            <em style={{ fontStyle: 'italic' }}>{movimientos.length === 1 || movimientos.length === 0 ? 'movimiento' : 'movimientos'}</em>{' '}
            {movimientos.length === 1 || movimientos.length === 0 ? 'firmado' : 'firmados'}
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <div style={{ display: 'inline-flex', padding: 3, background: pal.cream2, border: `1px solid ${pal.line}`, borderRadius: 10, fontSize: 11 }}>
          {RAIL_FILTROS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              style={{
                padding: '5px 10px',
                border: 'none',
                background: filtro === f ? pal.ink : 'transparent',
                color: filtro === f ? pal.cream : pal.muted,
                borderRadius: 7,
                cursor: 'pointer',
                fontWeight: filtro === f ? 600 : 400,
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                if (hoverFino() && filtro !== f) e.currentTarget.style.color = pal.ink;
              }}
              onMouseLeave={(e) => {
                if (filtro !== f) e.currentTarget.style.color = pal.muted;
              }}
            >
              {f === 'Todos' ? `Todos · ${movimientos.length}` : f}
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <div style={{ padding: '32px 28px', borderRadius: 18, background: pal.cream2, border: `1px solid ${pal.line}`, color: pal.muted, fontSize: 14 }}>
          Todavía no hay ajustes firmados esta quincena — se registran desde la ficha de cada persona en{' '}
          <a href="#taller" onClick={(ev) => { ev.preventDefault(); onIrAlTaller(); }}>
            El taller
          </a>
          .
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Línea horizontal desvanecida en los extremos */}
          <div style={{ position: 'absolute', top: 82, left: 0, right: 0, height: 1.5, background: `linear-gradient(90deg, transparent, ${pal.line} 15%, ${pal.line} 85%, transparent)`, zIndex: 0 }} />
          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fit, minmax(230px, 1fr))`,
              gap: 20,
              alignItems: 'start',
            }}
          >
            {visibles.map((m, i) => {
              const signColor = m.signo > 0 ? pal.sage : 'oklch(70% 0.15 25)';
              return (
                <div
                  key={m.id}
                  style={{
                    position: 'relative',
                    padding: '22px 20px',
                    background: pal.cream2,
                    border: `1px solid ${pal.line}`,
                    borderRadius: 18,
                    transition: 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)',
                    animation: `ed-fade-up 500ms ease-out ${150 + i * 100}ms both`,
                    cursor: 'default',
                    zIndex: 2,
                  }}
                  onMouseEnter={(el) => {
                    if (!hoverFino()) return;
                    el.currentTarget.style.transform = 'translateY(-4px)';
                    el.currentTarget.style.boxShadow = '0 6px 18px -4px oklch(0% 0 0 / 0.08)';
                    el.currentTarget.style.borderColor = pal.gold;
                  }}
                  onMouseLeave={(el) => {
                    el.currentTarget.style.transform = 'translateY(0)';
                    el.currentTarget.style.boxShadow = 'none';
                    el.currentTarget.style.borderColor = pal.line;
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                    <span style={{ ...mono, fontSize: 10 }}>{fechaLarga(HOY).split('·')[1]?.trim() || 'Esta quincena'}</span>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        background: signColor,
                        border: `3px solid ${pal.cream2}`,
                        boxShadow: `0 0 0 1px ${signColor}`,
                        animation: 'ed-pulse-glow 3.5s ease-in-out infinite',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        background: m.signo > 0 ? 'oklch(94% 0.08 145)' : 'oklch(94% 0.06 25)',
                        color: m.signo > 0 ? 'oklch(38% 0.11 145)' : 'oklch(50% 0.13 25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {m.signo > 0 ? '+' : '−'}
                    </span>
                    <span style={{ ...mono, fontSize: 9, color: m.signo > 0 ? 'oklch(38% 0.11 145)' : 'oklch(50% 0.13 25)' }}>{m.tipo}</span>
                  </div>
                  <div style={{ fontSize: 19, lineHeight: 1.2, marginBottom: 6, ...serif }}>{m.e.nombre}</div>
                  <div style={{ fontSize: 14, fontStyle: 'italic', color: 'oklch(35% 0.03 30)', lineHeight: 1.35, ...serif }}>{m.desc}</div>
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${pal.line}`, display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 22, color: m.signo > 0 ? 'oklch(38% 0.12 145)' : 'oklch(45% 0.13 25)', fontVariantNumeric: 'tabular-nums', ...serif }}>
                      {m.signo > 0 ? '+' : '−'}
                      {money(m.monto)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer totalizador en contenedor glassmorphic con destello shimmer y countUp */}
      <div
        className="ed-grid-2"
        style={{
          marginTop: 32,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 32,
          alignItems: 'center',
          padding: '24px 30px',
          borderRadius: 22,
          background: `linear-gradient(135deg, ${pal.cream2} 0%, oklch(98% 0.01 60 / 0.8) 100%)`,
          border: `1px solid ${pal.line}`,
          boxShadow: '0 4px 14px -4px oklch(0% 0 0 / 0.04)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent, oklch(100% 0 0 / 0.25) 50%, transparent)',
            backgroundSize: '200% 100%',
            animation: 'ed-shimmer 9s linear infinite',
            pointerEvents: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 36, alignItems: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 2 }}>
          <div>
            <div style={{ ...mono, marginBottom: 4 }}>Sumados</div>
            <div style={{ fontSize: 32, color: 'oklch(38% 0.12 145)', fontVariantNumeric: 'tabular-nums', ...serif }}>
              +{sumadosDisplay}
            </div>
          </div>
          <div style={{ width: 1, height: 40, background: pal.line }} />
          <div>
            <div style={{ ...mono, marginBottom: 4 }}>Deducidos</div>
            <div style={{ fontSize: 32, color: 'oklch(45% 0.13 25)', fontVariantNumeric: 'tabular-nums', ...serif }}>
              −{deducidosDisplay}
            </div>
          </div>
          <div style={{ width: 1, height: 40, background: pal.line }} />
          <div>
            <div style={{ ...mono, marginBottom: 4 }}>Efecto neto</div>
            <div style={{ fontSize: 32, color: pal.ink, fontVariantNumeric: 'tabular-nums', ...serif }}>
              {neto >= 0 ? '+' : '−'}
              {netoDisplay}
            </div>
          </div>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={onIrAlTaller}
            style={{
              padding: '13px 22px',
              background: pal.ink,
              color: pal.cream,
              border: 'none',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 200ms ease',
              boxShadow: '0 2px 8px oklch(20% 0.02 30 / 0.12)',
              position: 'relative',
              zIndex: 2,
            }}
            onMouseEnter={(el) => {
              if (!hoverFino()) return;
              el.currentTarget.style.transform = 'translateY(-1.5px)';
              el.currentTarget.style.boxShadow = '0 6px 14px oklch(20% 0.02 30 / 0.2)';
            }}
            onMouseLeave={(el) => {
              el.currentTarget.style.transform = 'translateY(0)';
              el.currentTarget.style.boxShadow = '0 2px 8px oklch(20% 0.02 30 / 0.12)';
            }}
          >
            + Registrar ajuste en el taller
          </button>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   § 05 — El pulso del año: últimas 6 quincenas (reutiliza
   `periodos`, igual que Historial) con composición y tendencia.
   --------------------------------------------------------- */

function PulsoAno({ periodos, totales, emps }) {
  const [activeIdx, setActiveIdx] = useState((periodos || []).slice(0, 6).length - 1);
  const ultimas = (periodos || []).slice(0, 6);
  const ordenadas = [...ultimas].reverse(); // más antigua primero, como la referencia

  // El período abierto se lee en vivo (`totales`, el que ya muestra esta
  // pantalla); un cerrado real trae su propio snapshot congelado — nunca se
  // recalcula con la planilla de hoy.
  const puntos = ordenadas.map((p) => {
    const t = p.estado === 'abierto' ? totales : p.snapshot ? p.snapshot.totales : { totCosto: 0, sumBruto: 0, totCar: 0, totDed: 0 };
    // `bruto` acá es lo que alimenta la franja "Salarios" de la composición
    // de abajo (card + gráfico apilado): usa el bruto YA MENOS deducciones
    // (=neto) porque el bruto completo ya las incluye — apilarlo tal cual
    // junto a Cargas y Deducciones duplicaba el monto de las deducciones y
    // no dejaba espacio real para su franja (Neto + Deducciones + Cargas si
    // suma exactamente el Costo Total; Bruto + Cargas + Deducciones no).
    return { p, costo: t.totCosto, bruto: t.sumBruto - t.totDed, car: t.totCar, ded: t.totDed };
  });
  const maxCosto = Math.max(...puntos.map((x) => x.costo), 1);

  const empCount = emps.length || 1;
  const costoPromedio = puntos.reduce((a, x) => a + x.costo, 0) / (puntos.length || 1) / empCount;

  const trendDeltaPct =
    puntos.length >= 2 && puntos[puntos.length - 2].costo !== 0
      ? ((puntos[puntos.length - 1].costo - puntos[puntos.length - 2].costo) / puntos[puntos.length - 2].costo) * 100
      : null;

  const ultimoCerrado = (periodos || []).find((p) => p.estado === 'cerrado');
  let diasDesdeCierre = null;
  let etiquetaCierre = '';
  if (ultimoCerrado) {
    const finDia = ultimoCerrado.mitad === 'b' ? diasEnMes(ultimoCerrado.anio, ultimoCerrado.mesIndice) : 15;
    const fechaFin = new Date(ultimoCerrado.anio, ultimoCerrado.mesIndice, finDia);
    const fechaHoy = new Date(HOY.anio, HOY.mesIndice, HOY.dia);
    diasDesdeCierre = Math.max(0, Math.round((fechaHoy - fechaFin) / 86400000));
    etiquetaCierre = `${ultimoCerrado.etiqueta.replace('Quincena · ', '')} cerrada el ${String(finDia).padStart(2, '0')} ${MESES_LARGO[ultimoCerrado.mesIndice].slice(0, 3)}`;
  }

  // línea de tendencia sobre los puntos del gráfico (proporcional al costo de cada quincena)
  const w = 600;
  const h = 220;
  const trendPath = puntos
    .map((x, i) => {
      const px = 50 + (i * (w - 100)) / Math.max(1, puntos.length - 1);
      const py = h - 30 - (x.costo / maxCosto) * (h - 60);
      return `${i === 0 ? 'M' : 'L'}${px.toFixed(0)},${py.toFixed(0)}`;
    })
    .join(' ');
  const lastPt = puntos.length
    ? { x: 50 + ((puntos.length - 1) * (w - 100)) / Math.max(1, puntos.length - 1), y: h - 30 - (puntos[puntos.length - 1].costo / maxCosto) * (h - 60) }
    : { x: w - 50, y: h - 30 };

  const ptSel = puntos[activeIdx] || puntos[puntos.length - 1] || { costo: 0, bruto: 0, car: 0, ded: 0, p: { mesIndice: 0, mitad: 'a' } };

  return (
    <section style={{ padding: '0 56px 56px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 05 · el pulso</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            Las <em style={{ fontStyle: 'italic' }}>últimas {ultimas.length === 6 ? 'seis' : ultimas.length}</em> quincenas
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <span style={mono}>Costos completos</span>
      </div>

      <div className="ed-grid-pulso-ano" style={{ display: 'grid', gridTemplateColumns: '3.8fr 8.2fr', gap: 36, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Card interactiva de composición de período seleccionado */}
          <div
            style={{
              background: `linear-gradient(135deg, ${pal.cream2} 0%, oklch(98% 0.01 60 / 0.8) 100%)`,
              border: `1px solid ${pal.line}`,
              borderRadius: 20,
              padding: '20px 24px',
              boxShadow: '0 4px 16px -6px oklch(0% 0 0 / 0.04)',
              transition: 'all 240ms ease',
            }}
          >
            <div style={{ ...mono, fontSize: 9, color: pal.gold, marginBottom: 8 }}>Composición de período</div>
            <div style={{ fontSize: 22, color: pal.ink, ...serif, marginBottom: 12 }}>
              Q {String(ptSel.p.mitad === 'b' ? 16 : 1).padStart(2, '0')} {MESES_LARGO[ptSel.p.mesIndice]}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: pal.muted }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'oklch(78% 0.11 30)' }} />
                  Salarios
                </span>
                <span style={{ fontWeight: 600, color: pal.ink, fontVariantNumeric: 'tabular-nums' }}>{money(ptSel.bruto)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: pal.muted }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'oklch(70% 0.09 320)' }} />
                  Cargas
                </span>
                <span style={{ fontWeight: 600, color: pal.ink, fontVariantNumeric: 'tabular-nums' }}>{money(ptSel.car)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: pal.muted }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'oklch(80% 0.11 65)' }} />
                  Deducciones
                </span>
                <span style={{ fontWeight: 600, color: pal.ink, fontVariantNumeric: 'tabular-nums' }}>{money(ptSel.ded)}</span>
              </div>
              <div style={{ height: 1, background: pal.line, margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
                <span style={{ color: pal.ink }}>Costo Total</span>
                <span style={{ color: pal.gold, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{money(ptSel.costo)}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ ...mono, fontSize: 9 }}>Costo promedio por persona</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: pal.ink, fontVariantNumeric: 'tabular-nums', ...serif }}>
                {money(costoPromedio)}
              </span>
            </div>
            {trendDeltaPct !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ ...mono, fontSize: 9 }}>Variación vs Q anterior</span>
                <span style={{ fontSize: 18, color: trendDeltaPct >= 0 ? 'oklch(38% 0.11 145)' : 'oklch(45% 0.13 25)', fontWeight: 600, ...serif }}>
                  {trendDeltaPct >= 0 ? '+' : '−'}
                  {Math.abs(trendDeltaPct).toFixed(1)}% {trendDeltaPct >= 0 ? '↑' : '↓'}
                </span>
              </div>
            )}
            {ultimoCerrado && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ ...mono, fontSize: 9 }}>Último cierre</span>
                <span style={{ fontSize: 13, color: pal.muted }}>
                  {etiquetaCierre.replace('cerrada el', '·')}
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ position: 'relative', padding: '28px 32px 24px', background: pal.cream2, border: `1px solid ${pal.line}`, borderRadius: 24, minHeight: 340 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 20, ...serif }}>Composición por período</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: pal.muted, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'oklch(78% 0.11 30)' }} />
                Salarios
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'oklch(70% 0.09 320)' }} />
                Cargas
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'oklch(80% 0.11 65)' }} />
                Deducciones
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 2, background: pal.coral }} />
                Tendencia
              </span>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            {/* Líneas de guía horizontales de fondo */}
            <div style={{ position: 'absolute', inset: '30px 0 30px 0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none', zIndex: 0 }}>
              <div style={{ height: 1, background: pal.line, opacity: 0.35 }} />
              <div style={{ height: 1, background: pal.line, opacity: 0.35 }} />
              <div style={{ height: 1, background: pal.line, opacity: 0.35 }} />
              <div style={{ height: 1, background: pal.line, opacity: 0.35 }} />
            </div>

            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${puntos.length || 1}, 1fr)`, gap: 24, alignItems: 'end', height: 220, zIndex: 2 }}>
              {puntos.map((x, i) => {
                const esSeleccionado = i === activeIdx;
                const alturaPct = Math.max(15, (x.costo / maxCosto) * 100);
                const flexBruto = Math.round((x.bruto / x.costo) * 100) || 1;
                const flexCar = Math.round((x.car / x.costo) * 100) || 1;
                const flexDed = Math.max(1, 100 - flexBruto - flexCar);
                return (
                  <div
                    key={x.p.id}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => setActiveIdx(i)}
                    style={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      gap: 6,
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                  >
                    {esSeleccionado && (
                      <div
                        style={{
                          position: 'absolute',
                          top: -34,
                          padding: '5px 12px',
                          background: pal.ink,
                          color: pal.cream,
                          borderRadius: 8,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10,
                          whiteSpace: 'nowrap',
                          boxShadow: '0 4px 12px oklch(0% 0 0 / 0.15)',
                          zIndex: 10,
                          animation: 'ed-fade-up 150ms ease-out both',
                        }}
                      >
                        {formatK(x.costo)}
                      </div>
                    )}
                    <div
                      style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        height: `${alturaPct}%`,
                        transformOrigin: 'bottom',
                        animation: `ed-bar-grow 800ms cubic-bezier(.16,1,.3,1) ${i * 100}ms both`,
                        boxShadow: esSeleccionado ? `0 0 0 2px ${pal.gold}, 0 4px 20px oklch(75% 0.13 60 / 0.25)` : 'none',
                        borderRadius: '6px 6px 3px 3px',
                        overflow: 'hidden',
                        opacity: esSeleccionado ? 1 : 0.65,
                        transition: 'all 240ms ease',
                      }}
                    >
                      <div style={{ flex: flexBruto, background: esSeleccionado ? `linear-gradient(180deg, oklch(80% 0.14 25), oklch(72% 0.16 25))` : 'oklch(78% 0.11 30)' }} />
                      <div style={{ flex: flexCar, background: esSeleccionado ? 'oklch(65% 0.11 320)' : 'oklch(70% 0.09 320)' }} />
                      <div style={{ flex: flexDed, background: esSeleccionado ? 'oklch(75% 0.13 65)' : 'oklch(80% 0.11 65)' }} />
                    </div>
                    <div style={{ ...mono, fontSize: 9, color: esSeleccionado ? pal.ink : pal.muted, fontWeight: esSeleccionado ? 700 : 400, transition: 'color 200ms ease' }}>
                      Q {String(x.p.mitad === 'b' ? 16 : 1).padStart(2, '0')}{MESES_LARGO[x.p.mesIndice].slice(0, 3).toUpperCase()}
                    </div>
                  </div>
                );
              })}
            </div>

            <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: 220, pointerEvents: 'none', overflow: 'visible' }}>
              <path
                d={trendPath}
                stroke={pal.coral}
                strokeWidth="2.5"
                fill="none"
                strokeDasharray={w + h}
                style={{
                  animation: 'ed-stroke-draw 2.4s ease-out 400ms both, ed-line-pulse 4s ease-in-out infinite',
                }}
              />
              <circle cx={lastPt.x} cy={lastPt.y} r={6} fill={pal.coral} opacity="0.9" />
              <circle cx={lastPt.x} cy={lastPt.y} r={6} fill={pal.coral} style={{ animation: 'ed-pulse-ring 2s ease-out infinite', transformOrigin: `${lastPt.x}px ${lastPt.y}px` }} />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   § 06 — Cierre de período: sección final con respiración ambiental sutil
   --------------------------------------------------------- */

function CierrePeriodo({ periodo, periodoTipo, readOnly, totales, emps, onAbrirCerrar, onVolverActivo }) {
  const pagados = emps.filter((e) => e.pago === 'pagado').length;
  const pctPagados = emps.length ? Math.min(100, Math.round((pagados / emps.length) * 100)) : 0;

  return (
    <section style={{ padding: '40px 56px 88px', position: 'relative', animation: 'ed-fade-up 700ms ease-out 320ms both' }}>
      <div
        style={{
          position: 'relative',
          background: readOnly
            ? 'linear-gradient(160deg, oklch(93% 0.02 145) 0%, oklch(90% 0.04 150) 100%)'
            : 'linear-gradient(160deg, oklch(91% 0.08 38) 0%, oklch(86% 0.11 58) 45%, oklch(81% 0.13 28) 100%)',
          borderRadius: 32,
          padding: '52px 56px',
          overflow: 'hidden',
          boxShadow: '0 24px 50px -16px oklch(20% 0.02 30 / 0.12)',
        }}
      >
        {/* Auroras ecológicas continuas y shimmer diagonal en fondo */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              top: '-35%',
              right: '-12%',
              width: '60%',
              height: '130%',
              background: readOnly ? 'radial-gradient(circle, oklch(85% 0.1 145 / 0.4), transparent 65%)' : 'radial-gradient(circle, oklch(95% 0.14 65 / 0.5), transparent 65%)',
              filter: 'blur(32px)',
              animation: 'ed-aurora 7.5s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-30%',
              left: '-10%',
              width: '50%',
              height: '120%',
              background: readOnly ? 'radial-gradient(circle, oklch(88% 0.08 140 / 0.35), transparent 65%)' : 'radial-gradient(circle, oklch(90% 0.13 32 / 0.45), transparent 65%)',
              filter: 'blur(32px)',
              animation: 'ed-aurora-2 10.5s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(115deg, transparent 40%, oklch(100% 0 0 / 0.12) 48%, oklch(100% 0 0 / 0.18) 50%, oklch(100% 0 0 / 0.12) 52%, transparent 60%)',
              backgroundSize: '200% 100%',
              animation: 'ed-shimmer 6s linear infinite',
              mixBlendMode: 'overlay',
            }}
          />
        </div>

        <div className="ed-grid-2" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '8fr 4fr', gap: 48, alignItems: 'end' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ width: 24, height: 1, background: readOnly ? 'oklch(30% 0.06 145)' : 'oklch(28% 0.06 30)' }} />
              <span style={{ ...mono, color: readOnly ? 'oklch(30% 0.06 145)' : 'oklch(28% 0.06 30)' }}>
                Sección 06 · {readOnly ? 'período archivado' : 'cierre'}
              </span>
            </div>
            {readOnly ? (
              <>
                <div style={{ fontSize: 44, lineHeight: 1.05, letterSpacing: '-0.02em', color: pal.ink, marginBottom: 16, ...serif }}>
                  Esta quincena ya <em style={{ fontStyle: 'italic', color: 'oklch(30% 0.10 145)' }}>quedó cerrada</em>.
                </div>
                <p style={{ ...serif, fontSize: 17, fontStyle: 'italic', lineHeight: 1.5, color: 'oklch(28% 0.04 145)', maxWidth: 560, margin: '0 0 24px' }}>
                  Se conserva como referencia de solo lectura. Para seguir trabajando, volvé al período activo.
                </p>
                <button
                  type="button"
                  onClick={onVolverActivo}
                  style={{
                    padding: '14px 26px',
                    background: pal.ink,
                    color: pal.cream,
                    border: 'none',
                    borderRadius: 14,
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                    boxShadow: '0 10px 24px -6px oklch(20% 0.02 30 / 0.35)',
                    transition: 'all 200ms ease',
                  }}
                >
                  Volver al período activo
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 44, lineHeight: 1.05, letterSpacing: '-0.02em', color: pal.ink, marginBottom: 16, ...serif }}>
                  Cuando el equipo esté <em style={{ fontStyle: 'italic', color: 'oklch(35% 0.10 30)' }}>listo</em>, cerrá la quincena.
                </div>
                <p style={{ ...serif, fontSize: 17, fontStyle: 'italic', lineHeight: 1.5, color: 'oklch(30% 0.04 30)', maxWidth: 560, margin: '0 0 24px' }}>
                  Al cerrar, esta planilla pasa al historial como solo lectura y se abre automáticamente el próximo período{' '}
                  {periodoTipo === 'mensual' ? 'mensual' : 'quincenal'}. No se puede deshacer.
                </p>
                <button
                  type="button"
                  onClick={onAbrirCerrar}
                  style={{
                    padding: '14px 28px',
                    background: pal.ink,
                    color: pal.cream,
                    border: 'none',
                    borderRadius: 14,
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                    boxShadow: '0 12px 28px -6px oklch(20% 0.02 30 / 0.4)',
                    transition: 'all 200ms ease',
                    position: 'relative',
                  }}
                  onMouseEnter={(eBtn) => {
                    if (!hoverFino()) return;
                    eBtn.currentTarget.style.transform = 'translateY(-2px)';
                    eBtn.currentTarget.style.boxShadow = '0 16px 36px -8px oklch(20% 0.02 30 / 0.5)';
                  }}
                  onMouseLeave={(eBtn) => {
                    eBtn.currentTarget.style.transform = 'none';
                    eBtn.currentTarget.style.boxShadow = '0 12px 28px -6px oklch(20% 0.02 30 / 0.4)';
                  }}
                >
                  Cerrar período
                </button>
              </>
            )}
          </div>

          <div>
            {/* Tarjeta Glassmorphic Levitando en Loop Continuo */}
            <div
              style={{
                background: 'oklch(99% 0.006 70 / 0.72)',
                backdropFilter: 'blur(24px)',
                border: '1px solid oklch(99% 0.006 70 / 0.85)',
                borderRadius: 24,
                padding: '24px 26px',
                animation: 'ed-float-slow 6.5s ease-in-out infinite',
                boxShadow: '0 16px 36px -12px oklch(20% 0.02 30 / 0.15)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ ...mono, color: readOnly ? 'oklch(30% 0.06 145)' : 'oklch(30% 0.06 30)', marginBottom: 12 }}>Resumen del cierre</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: 14, color: pal.ink }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <span style={{ color: 'oklch(40% 0.04 30)' }}>Pagados</span>
                    <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {pagados} de {emps.length} ({pctPagados}%)
                    </strong>
                  </div>
                  {/* Mini barra de progreso de pagos pagados */}
                  <div style={{ height: 5, width: '100%', background: 'oklch(90% 0.02 60)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pctPagados}%`,
                        background: `linear-gradient(90deg, ${pal.sage}, oklch(60% 0.12 145), ${pal.sage})`,
                        backgroundSize: '200% 100%',
                        borderRadius: 999,
                        transformOrigin: 'left',
                        transformBox: 'fill-box',
                        animation: 'ed-bar-grow-x 1s cubic-bezier(.16,1,.3,1) both, ed-gradient-shift 4s linear infinite',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingTop: 4 }}>
                  <span style={{ color: 'oklch(40% 0.04 30)' }}>Neto a pagar</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{totales.sumNetoFmt}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ color: 'oklch(40% 0.04 30)' }}>Costo total</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'oklch(35% 0.08 30)' }}>{totales.totCostoFmt}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Composición
   --------------------------------------------------------- */

const PLANILLA_SECTIONS = [
  { key: 'periodo', label: 'Período' },
  { key: 'resumen', label: 'Resumen' },
  { key: 'taller', label: 'Planilla' },
  { key: 'deducciones', label: 'Deducciones' },
  { key: 'pulso', label: 'Pulso' },
  { key: 'cierre', label: 'Cierre' },
];

export default function Planilla({
  vista,
  periodoTipo,
  periodos,
  periodoActivoId,
  atender,
  barras,
  metodosPago,
  notificaciones,
  onNotifClick,
  onSeleccionarPeriodo,
  onAjustar,
  onMarcarPagado,
  onAlternarConciliacion,
  onCerrarPeriodo,
  onVolverActivo,
  onNavigate,
}) {
  const [confirmCerrar, setConfirmCerrar] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const { emps, totales, periodo, readOnly } = vista;

  const sectionRefs = useRef({});
  const setSectionRef = (key) => (el) => {
    sectionRefs.current[key] = el;
  };

  const inicioDia = periodoTipo === 'mensual' ? 1 : periodo.mitad === 'b' ? 16 : 1;
  const finDia =
    periodoTipo === 'mensual' ? diasEnMes(periodo.anio, periodo.mesIndice) : periodo.mitad === 'b' ? diasEnMes(periodo.anio, periodo.mesIndice) : 15;
  const periodoDias = finDia - inicioDia + 1;

  function irAlTaller() {
    const el = document.getElementById('planilla-taller');
    const scrollEl = document.getElementById('app-content');
    if (!el || !scrollEl) return;
    scrollEl.scrollTo({ top: Math.max(0, el.offsetTop - 24), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  return (
    <div className="screen ed-home" style={{ fontFamily: "'Albert Sans', system-ui, sans-serif", color: pal.ink, background: pal.cream, minHeight: '100%' }}>
      <ScrollRail sectionRefs={sectionRefs} sections={PLANILLA_SECTIONS} />

      <div style={{ maxWidth: 1440, margin: '0 auto', position: 'relative' }}>
        <Masthead
          periodos={periodos}
          periodoMostrado={periodo}
          periodoActivoId={periodoActivoId}
          onSeleccionarPeriodo={onSeleccionarPeriodo}
          onNavigate={onNavigate}
          atender={atender}
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          notificaciones={notificaciones}
          onNotifClick={onNotifClick}
        />

        <StatusBar emps={emps} readOnly={readOnly} />

        <div id="pl-sec-periodo" ref={setSectionRef('periodo')}>
          <Seccion01Hero
            periodo={periodo}
            periodoTipo={periodoTipo}
            readOnly={readOnly}
            emps={emps}
            atender={atender}
            onExportar={() => exportarPlanillaCsv(vista)}
            onAbrirCerrar={() => setConfirmCerrar(true)}
            onVolverActivo={onVolverActivo}
            onIrAlEquipo={irAlTaller}
          />
        </div>

        <div id="pl-sec-resumen" ref={setSectionRef('resumen')}>
          <EstadoBand totales={totales} emps={emps} periodo={periodo} periodoTipo={periodoTipo} barras={barras} />
        </div>

        <div id="pl-sec-taller" ref={setSectionRef('taller')}>
          <TallerSection
            emps={emps}
            totales={totales}
            readOnly={readOnly}
            periodoDias={periodoDias}
            metodosPago={metodosPago}
            busqueda={busqueda}
            onAjustar={onAjustar}
            onMarcarPagado={onMarcarPagado}
            onAlternarConciliacion={onAlternarConciliacion}
            onNavigate={onNavigate}
          />
        </div>

        <div id="pl-sec-deducciones" ref={setSectionRef('deducciones')}>
          <RailAjustes emps={emps} readOnly={readOnly} onIrAlTaller={irAlTaller} />
        </div>

        <div id="pl-sec-pulso" ref={setSectionRef('pulso')}>
          <PulsoAno periodos={periodos} totales={totales} emps={emps} />
        </div>

        <div id="pl-sec-cierre" ref={setSectionRef('cierre')}>
          <CierrePeriodo
            periodo={periodo}
            periodoTipo={periodoTipo}
            readOnly={readOnly}
            totales={totales}
            emps={emps}
            onAbrirCerrar={() => setConfirmCerrar(true)}
            onVolverActivo={onVolverActivo}
          />
        </div>

        <footer
          style={{
            padding: '0 56px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: pal.muted,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <span>Gestión Laboral · Planilla</span>
          <span>© {HOY.anio} · Prototipo</span>
        </footer>
      </div>

      {!readOnly &&
        (() => {
          // Cerrar es irreversible y resetea el estado de pago de todos al
          // abrir el siguiente período — advertir explícitamente si queda
          // gente sin pagar, en vez de dejar cerrar en silencio (auditoría F18).
          const sinPagar = emps.filter((e) => e.pago !== 'pagado').length;
          const advertencia =
            sinPagar > 0
              ? `Todavía quedan ${sinPagar} de ${emps.length} personas sin pagar en esta quincena — al cerrar, esos pagos pendientes ya no se van a poder registrar acá. `
              : '';
          return (
            <ConfirmDialog
              open={confirmCerrar}
              onClose={() => setConfirmCerrar(false)}
              onConfirm={() => {
                onCerrarPeriodo();
                setConfirmCerrar(false);
              }}
              title={sinPagar > 0 ? `Cerrar con ${sinPagar} sin pagar` : 'Cerrar este período'}
              description={`${advertencia}Se cerrará "${periodo.titulo}" y pasará al historial como solo lectura. Se abrirá automáticamente el siguiente período ${periodoTipo === 'mensual' ? 'mensual' : 'quincenal'}. Esta acción no se puede deshacer.`}
              confirmLabel="Cerrar período"
              danger
            />
          );
        })()}
    </div>
  );
}
