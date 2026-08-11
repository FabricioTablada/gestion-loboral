import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { HOY } from '../data/mock.js';
import { money, leerArchivoAdjunto, fechaISO } from '../lib/format.js';
import { buildInsMonto, buildPolizaVigencia } from '../lib/payroll.js';
import { descargarAdjunto } from '../lib/export.js';
import { IconSearch, IconChevronLeft, IconChevronRight } from '../components/ui/Icons.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { NotificacionesPanel } from '../components/ui/NotificacionesPanel.jsx';
import { Field, Input, Select } from '../components/ui/Form.jsx';
import { Button } from '../components/ui/Primitives.jsx';
import ScrollRail, { Logo, LotusFlower } from '../components/ScrollRail.jsx';

/**
 * Obligaciones (Calendario) — "diez días y la CCSS". Mismo lenguaje editorial
 * que Home/Planilla/Pagos/Equipo (paleta cream/coral/gold, Instrument Serif +
 * JetBrains Mono, motion `ed-*`), composición propia en 6 secciones tomada de
 * `Obligaciones.dc.html`.
 *
 * Los datos y acciones son los que ya existían (`obligaciones`, `atender`,
 * `semanas`/`eventos` del calendario, `ccssEstado`/`insEstado` y sus acciones
 * de adjuntar/marcar/regularizar): esto es solo una nueva presentación. La
 * referencia incluye tipos de obligación que no existen en el modelo real
 * (Renta/D-103, Ministerio de Trabajo) y un "muro" con los 12 meses
 * completos — donde no hay dato real (meses sin historial, aguinaldo,
 * recargos, puntualidad, sincronización) se usa el equivalente real más
 * cercano o un estado vacío honesto, nunca un valor inventado.
 */
const pal = {
  ink: 'oklch(20% 0.02 30)',
  ink2: 'oklch(26% 0.03 25)',
  cream: 'oklch(96% 0.015 60)',
  cream2: 'oklch(98% 0.008 65)',
  paper: 'oklch(99% 0.006 70)',
  line: 'oklch(85% 0.015 55)',
  line2: 'oklch(90% 0.012 55)',
  muted: 'oklch(48% 0.02 40)',
  muted2: 'oklch(62% 0.02 40)',
  coral: 'oklch(70% 0.16 30)',
  peach: 'oklch(85% 0.10 55)',
  lilac: 'oklch(82% 0.06 320)',
  sage: 'oklch(72% 0.12 145)',
  gold: 'oklch(85% 0.14 75)',
  sky: 'oklch(80% 0.09 220)',
  deepGreen: 'oklch(38% 0.11 145)',
  red: 'oklch(58% 0.18 25)',
};

const serif = { fontFamily: "'Instrument Serif', serif", fontWeight: 400 };
const mono = {
  fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  fontSize: 11,
  color: pal.muted,
};
const num = { fontVariantNumeric: 'tabular-nums' };

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Guarda para los `onMouseEnter`/`onMouseLeave` que mutan `style` directo:
// en touch, un tap dispara `mouseenter` sin el `mouseleave` correspondiente
// y el elemento queda con el efecto "pegado" hasta el próximo tap en otro
// lado (revisión de motion).
const hoverFino = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

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

const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MESES_ABR_UP = MESES_ABR.map((m) => m.toUpperCase());
const DIAS_SEM = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

function fechaLarga(hoy) {
  const weekday = new Date(hoy.anio, hoy.mesIndice, hoy.dia).toLocaleDateString('es-CR', { weekday: 'long' });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap} · ${String(hoy.dia).padStart(2, '0')} ${MESES_LARGO[hoy.mesIndice]} ${hoy.anio}`;
}

/** Extrae el número entero de textos tipo "En 11 días" / "Hace 4 días". */
function numDe(txt) {
  const m = /(\d+)/.exec(txt || '');
  return m ? parseInt(m[1], 10) : null;
}

/** "Vence 20 ago 2026" / "Venció 05 ago 2026" / "Pagada 17 jul 2026" → {dia, mesIndice, anio}. */
function parseFechaObligacion(txt) {
  const m = /(\d{1,2})\s+([a-záéíóú]{3})\s+(\d{4})/i.exec(txt || '');
  if (!m) return null;
  const mesIndice = MESES_ABR.indexOf(m[2].toLowerCase());
  if (mesIndice < 0) return null;
  return { dia: parseInt(m[1], 10), mesIndice, anio: parseInt(m[3], 10) };
}

const ICONO_TARGET = { ccss: 'C', ins: 'I', pagos: '₡' };
const NOMBRE_TARGET = { ccss: 'CCSS', ins: 'INS', pagos: 'Pagos' };
const COLOR_TARGET = { ccss: pal.gold, ins: 'oklch(65% 0.14 320)', pagos: pal.sky };

const NAV_ITEMS = [
  { key: 'panel', label: 'Hoy' },
  { key: 'planilla', label: 'Planilla' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'empleados', label: 'Equipo' },
  { key: 'calendario', label: 'Obligaciones' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'historial', label: 'Historial' },
];

function tamañoLegible(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ---------------------------------------------------------
   Masthead + barra de estado
   --------------------------------------------------------- */

function Masthead({ atender, onNavigate, usuario, notificaciones, onNotifClick }) {
  return (
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
        <Logo />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, minWidth: 0 }}>
          <span style={{ fontSize: 22, fontStyle: 'italic', letterSpacing: '-0.01em', ...serif }}>Gestión Laboral</span>
          <span style={{ ...mono, fontSize: 9 }}>Espacio de {usuario.nombre.split(' ')[0]}</span>
        </div>
        <span style={{ marginLeft: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.16em', color: pal.muted, padding: '4px 9px', border: `1px solid ${pal.line}`, borderRadius: 999, whiteSpace: 'nowrap' }}>
          {atender.length === 0 ? 'TODO AL DÍA' : `${atender.length} POR ATENDER`}
        </span>
      </div>

      <nav className="ed-masthead-nav" style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 13 }}>
        {NAV_ITEMS.map((item) => {
          const active = item.key === 'calendario';
          return (
            <a
              key={item.key}
              href={`#${item.key}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(item.key);
              }}
              className={active ? undefined : 'ed-nav-link'}
              style={{ color: active ? pal.ink : pal.muted, fontWeight: active ? 600 : 400, position: 'relative' }}
            >
              {item.label}
              {active && <span style={{ position: 'absolute', bottom: -22, left: 0, right: 0, height: 2, background: pal.coral }} />}
            </a>
          );
        })}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: pal.cream2, border: `1px solid ${pal.line}`, borderRadius: 999, fontSize: 12, color: pal.muted, minWidth: 220 }}>
          <IconSearch size={13} stroke="currentColor" />
          <span style={{ flex: 1 }}>
            Buscar obligación o mes
            <span style={{ display: 'inline-block', width: 1.5, height: 11, background: pal.coral, marginLeft: 2, verticalAlign: 'middle', animation: 'ed-cursor-blink 1.1s step-end infinite' }} />
          </span>
        </div>
        <NotificacionesPanel notificaciones={notificaciones} onNotifClick={onNotifClick} />
        <div style={{ width: 36, height: 36, borderRadius: 999, background: `linear-gradient(135deg, ${pal.peach}, ${pal.coral})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pal.ink, fontWeight: 600, fontSize: 12 }}>
          {usuario.iniciales}
        </div>
      </div>
    </header>
  );
}

function StatusBar({ obligaciones, usuario }) {
  const alDia = obligaciones.filter((o) => o.k === 'aldia' || o.k === 'pagado').length;
  const proximas = obligaciones.filter((o) => o.k === 'proximo' || o.k === 'pendiente').length;
  const vencidas = obligaciones.filter((o) => o.k === 'vencido').length;

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
        <span style={{ color: pal.deepGreen }}>● {alDia} al día</span>
        <span style={{ color: 'oklch(50% 0.13 65)' }}>● {proximas} por venir</span>
        <span style={{ color: pal.red }}>● {vencidas} vencidas</span>
      </span>
      <span>{usuario.rol}</span>
    </div>
  );
}

/* ---------------------------------------------------------
   Sección 01 — Hero: cuenta regresiva + calendario real del mes
   --------------------------------------------------------- */

function ConstelacionObligaciones({ obligaciones, eventos, semanas, mesLabel, onPrevMes, onNextMes, onEventoClick, onAtender }) {
  const [hoveredId, setHoveredId] = useState(null);

  const alDia = obligaciones.filter((o) => o.k === 'aldia' || o.k === 'pagado').length;
  const proximas = obligaciones.filter((o) => o.k === 'proximo' || o.k === 'pendiente').length;
  const vencidas = obligaciones.filter((o) => o.k === 'vencido').length;

  // Nodos orbitales — posiciones/tamaños fijos del diseño (5 lugares), pero el
  // contenido de cada uno sale de una obligación real (`obligaciones` ya trae
  // las 5 del sistema: vencido/próximo/pendiente/pagado/al día). Nada de fechas
  // o etiquetas inventadas: si hay menos de 5 obligaciones reales, se dibujan
  // menos nodos en vez de rellenar con datos ficticios.
  const POSICIONES_NODO = [
    { cx: 310, cy: 35, dur: 6.2 },
    { cx: 325, cy: 110, dur: 7.0 },
    { cx: 197, cy: 145, dur: 7.8 },
    { cx: 70, cy: 110, dur: 6.6 },
    { cx: 85, cy: 35, dur: 8.0 },
  ];
  const COLOR_POR_ESTADO = {
    vencido: { dot: pal.red, bg: 'rgba(255, 245, 245, 0.95)', border: pal.red, txtColor: pal.red },
    proximo: { dot: pal.gold, bg: 'rgba(255, 252, 245, 0.95)', border: pal.gold, txtColor: 'oklch(50% 0.13 65)' },
    pendiente: { dot: pal.sky, bg: 'rgba(240, 248, 255, 0.95)', border: pal.sky, txtColor: 'oklch(40% 0.12 220)' },
    pagado: { dot: pal.sage, bg: 'rgba(242, 250, 245, 0.95)', border: 'oklch(80% 0.12 145)', txtColor: pal.deepGreen },
    aldia: { dot: pal.lilac, bg: 'rgba(252, 245, 255, 0.95)', border: pal.lilac, txtColor: 'oklch(45% 0.12 320)' },
  };
  const nodeConfig = obligaciones.slice(0, POSICIONES_NODO.length).map((o, i) => {
    // `o.fecha` normal trae "Vence 15 ago" (día+mes en las posiciones 1-2);
    // pero cuando no hay fecha real configurada, payroll.js pone el texto
    // honesto "Sin fecha configurada" — cortarlo igual con slice(1,3) se
    // comía el "Sin" y el nodo terminaba mostrando "FECHA CONFIGURADA",
    // como si sí hubiera una fecha real (lo contrario de lo que dice).
    const sinFecha = !o.fecha || /^sin /i.test(o.fecha);
    const fechaCorta = sinFecha ? 'SIN FECHA' : o.fecha.split(' ').slice(1, 3).join(' ').toUpperCase();
    return {
      id: `${o.target}-${o.k}`,
      label: NOMBRE_TARGET[o.target] || o.t,
      date: fechaCorta || o.dias,
      target: o.target,
      ...POSICIONES_NODO[i],
      ...(COLOR_POR_ESTADO[o.k] || COLOR_POR_ESTADO.pendiente),
    };
  });

  const centerPoint = { x: 197, y: 85 };

  return (
    <div
      style={{
        position: 'relative',
        width: 395,
        background: 'rgba(255, 253, 249, 0.98)',
        border: `1px solid ${pal.line2}`,
        borderRadius: 24,
        boxShadow: '0 20px 50px -16px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.02)',
        overflow: 'hidden',
        zIndex: 2,
      }}
    >
      <style>{`
        @keyframes ed-orbit-spin-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ed-orbit-spin-ccw {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes ed-node-pulse {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px) scale(1); }
          50% { transform: translate(-50%, -50%) translateY(-4px) scale(1.025); }
        }
        @keyframes ed-core-breathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); filter: drop-shadow(0 0 10px oklch(85% 0.14 75 / 0.4)); }
          50% { transform: translate(-50%, -50%) scale(1.06); filter: drop-shadow(0 0 20px oklch(70% 0.16 30 / 0.6)); }
        }
      `}</style>

      {/* STAGE SUPERIOR: ESCENARIO ÓRBITAL DE FLOR DAMARIS */}
      <div style={{ position: 'relative', height: 170, width: '100%', overflow: 'hidden' }}>
        {/* Fondo Resplandor Aurora */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 50% 50%, oklch(92% 0.08 60 / 0.45), transparent 70%), radial-gradient(circle at 80% 20%, oklch(88% 0.09 320 / 0.25), transparent 50%), radial-gradient(circle at 20% 80%, oklch(90% 0.09 145 / 0.25), transparent 50%)',
            filter: 'blur(10px)',
            animation: 'ed-aurora 14s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />

        {/* SVG de Órbitas y Conectores */}
        <svg
          width="395"
          height="170"
          viewBox="0 0 395 170"
          style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
        >
          <defs>
            <linearGradient id="obl-constellation-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="oklch(85% 0.14 75)" stopOpacity="0.55" />
              <stop offset="50%" stopColor="oklch(70% 0.16 30)" stopOpacity="0.7" />
              <stop offset="100%" stopColor="oklch(82% 0.06 320)" stopOpacity="0.55" />
            </linearGradient>

            <radialGradient id="obl-core-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="oklch(85% 0.14 75)" stopOpacity="0.45" />
              <stop offset="60%" stopColor="oklch(70% 0.16 30)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="oklch(96% 0.015 60)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Halo central */}
          <circle cx={centerPoint.x} cy={centerPoint.y} r="80" fill="url(#obl-core-halo)" />

          {/* Órbita Exterior Giratoria Horaria */}
          <g style={{ transformOrigin: `${centerPoint.x}px ${centerPoint.y}px`, animation: 'ed-orbit-spin-cw 60s linear infinite' }}>
            <ellipse
              cx={centerPoint.x}
              cy={centerPoint.y}
              rx="125"
              ry="60"
              fill="none"
              stroke="oklch(85% 0.02 55)"
              strokeWidth="1.2"
              strokeDasharray="4 8"
              opacity="0.6"
            />
            <circle cx={centerPoint.x + 125} cy={centerPoint.y} r="3" fill={pal.gold} />
            <circle cx={centerPoint.x - 125} cy={centerPoint.y} r="3" fill={pal.coral} />
            <circle cx={centerPoint.x} cy={centerPoint.y - 60} r="2.5" fill={pal.sage} />
          </g>

          {/* Órbita Interior Giratoria Anti-Horaria */}
          <g style={{ transformOrigin: `${centerPoint.x}px ${centerPoint.y}px`, animation: 'ed-orbit-spin-ccw 44s linear infinite' }}>
            <ellipse
              cx={centerPoint.x}
              cy={centerPoint.y}
              rx="80"
              ry="40"
              fill="none"
              stroke="oklch(70% 0.16 30)"
              strokeWidth="1"
              strokeDasharray="2 6"
              opacity="0.4"
            />
          </g>

          {/* Filamentos conectores SVG */}
          {nodeConfig.map((node) => {
            const isHovered = hoveredId === node.id;
            return (
              <line
                key={`line-${node.id}`}
                x1={centerPoint.x}
                y1={centerPoint.y}
                x2={node.cx}
                y2={node.cy}
                stroke="url(#obl-constellation-grad)"
                strokeWidth={isHovered ? 2.2 : 1.2}
                strokeDasharray={isHovered ? 'none' : '3 5'}
                opacity={isHovered ? 0.95 : 0.45}
                style={{ transition: 'all 300ms ease' }}
              />
            );
          })}
        </svg>

        {/* Núcleo Central: Flor de Loto */}
        <div
          style={{
            position: 'absolute',
            left: centerPoint.x,
            top: centerPoint.y,
            width: 44,
            height: 44,
            borderRadius: 999,
            background: 'rgba(255, 249, 242, 0.96)',
            border: `1.5px solid ${pal.gold}`,
            boxShadow: '0 6px 20px -4px oklch(75% 0.13 60 / 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'ed-core-breathe 4s ease-in-out infinite',
            zIndex: 5,
            cursor: 'pointer',
          }}
          title="Flor Damaris · Núcleo de Obligaciones"
        >
          <div style={{ width: 30, height: 20, transform: 'translateY(1px)' }}>
            <LotusFlower progress={0.7} />
          </div>
        </div>

        {/* Nodos Flotantes de Obligación */}
        {nodeConfig.map((node) => {
          const isHovered = hoveredId === node.id;
          return (
            <div
              key={node.id}
              onMouseEnter={() => { if (hoverFino()) setHoveredId(node.id); }}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onAtender(node.target)}
              style={{
                position: 'absolute',
                left: node.cx,
                top: node.cy,
                transform: 'translate(-50%, -50%)',
                animation: `ed-node-pulse ${node.dur}s ease-in-out infinite`,
                zIndex: isHovered ? 12 : 6,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  padding: '5px 9px',
                  borderRadius: 999,
                  background: isHovered ? 'rgba(255, 255, 255, 0.98)' : node.bg,
                  backdropFilter: 'blur(10px)',
                  border: `1.2px solid ${isHovered ? pal.coral : node.border}`,
                  boxShadow: isHovered
                    ? '0 10px 24px -4px rgba(0,0,0,0.12), 0 0 12px oklch(70% 0.16 30 / 0.3)'
                    : '0 4px 12px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: isHovered ? 'scale(1.10)' : 'scale(1)',
                }}
              >
                <Dot c={node.dot} glow size={5} />
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: pal.ink, ...serif }}>{node.label}</span>
                  <span style={{ ...mono, fontSize: 7.5, color: node.txtColor, marginTop: 1, fontWeight: 700 }}>{node.date}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DIVISOR EDITORIAL */}
      <div style={{ padding: '0 18px' }}>
        <div style={{ borderTop: `1px dashed ${pal.line}`, padding: '8px 0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...mono, fontSize: 8, color: pal.muted, letterSpacing: '0.12em' }}>AGENDA & VENCIMIENTOS</span>
          <span style={{ ...mono, fontSize: 8, color: 'oklch(45% 0.13 55)', fontWeight: 600 }}>{mesLabel}</span>
        </div>
      </div>

      {/* ETAPA INFERIOR: SECCIÓN CALENDARIO GRID */}
      <div style={{ padding: '4px 18px 16px' }}>
        {/* Header del Calendario */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: pal.ink, letterSpacing: '0.1em' }}>{mesLabel}</span>
            <span style={{ padding: '2px 6px', borderRadius: 999, background: 'linear-gradient(135deg, oklch(96% 0.05 65), oklch(92% 0.09 55 / 0.5))', border: `1px solid ${pal.gold}`, fontSize: 7.5, ...mono, color: 'oklch(45% 0.13 55)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 3.5, height: 3.5, borderRadius: 999, background: pal.gold, animation: 'ed-dot-glow 2s ease-in-out infinite' }} />
              HOY
            </span>
          </div>

          <div style={{ display: 'flex', gap: 3 }}>
            <button
              type="button"
              onClick={onPrevMes}
              aria-label="Mes anterior"
              style={{
                width: 22,
                height: 22,
                border: `1px solid ${pal.line}`,
                background: pal.cream2,
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => { if (hoverFino()) e.currentTarget.style.borderColor = pal.coral; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = pal.line; }}
            >
              <IconChevronLeft size={11} stroke="oklch(30% 0.02 30)" />
            </button>
            <button
              type="button"
              onClick={onNextMes}
              aria-label="Mes siguiente"
              style={{
                width: 22,
                height: 22,
                border: `1px solid ${pal.line}`,
                background: pal.cream2,
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => { if (hoverFino()) e.currentTarget.style.borderColor = pal.coral; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = pal.line; }}
            >
              <IconChevronRight size={11} stroke="oklch(30% 0.02 30)" />
            </button>
          </div>
        </div>

        {/* Encabezados D L M M J V S */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
          {DIAS_SEM.map((d) => (
            <div key={d} style={{ textAlign: 'center', fontSize: 7.5, fontWeight: 700, letterSpacing: '0.04em', color: pal.muted }}>
              {d}
            </div>
          ))}
        </div>

        {/* Días del Mes */}
        {semanas.map((w) => (
          <div key={w.key} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
            {w.days.map((c) => {
              const hasEvent = c.mk;
              const isHoy = c.hoy;
              // Solo los días con un evento real (`eventosBase`) llevan a su obligación —
              // el resto de la cuadrícula es puramente informativa, sin fingir ser clicable.
              const evento = hasEvent ? eventos.find((ev) => Number(ev.d) === Number(c.d)) : null;

              return (
                <div
                  key={c.key}
                  onClick={evento ? () => onAtender(evento.target) : undefined}
                  title={evento ? `${evento.t} ↗` : undefined}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 6,
                    border: c.empty
                      ? 'none'
                      : isHoy
                      ? `1.5px solid ${pal.coral}`
                      : hasEvent
                      ? `1px solid ${pal.line}`
                      : `1px solid ${pal.line2}`,
                    background: c.empty
                      ? 'transparent'
                      : isHoy
                      ? 'linear-gradient(135deg, oklch(95% 0.04 55), oklch(90% 0.08 30))'
                      : hasEvent
                      ? 'rgba(255, 252, 245, 0.85)'
                      : pal.cream2,
                    boxShadow: isHoy ? '0 3px 8px oklch(70% 0.16 30 / 0.25)' : 'none',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: evento ? 'pointer' : 'default',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={(e) => { if (evento && hoverFino()) e.currentTarget.style.transform = 'scale(1.10)'; }}
                  onMouseLeave={(e) => { if (evento) e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <span style={{ fontSize: 9.5, fontWeight: isHoy || hasEvent ? 700 : 500, color: c.empty ? 'transparent' : isHoy ? pal.ink : hasEvent ? pal.ink : pal.ink2, ...num, ...serif }}>
                    {c.d}
                  </span>
                  {hasEvent && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        width: 3.5,
                        height: 3.5,
                        borderRadius: 999,
                        background: c.dot || pal.coral,
                        boxShadow: `0 0 4px ${c.dot || pal.coral}`,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Medallones KPI Integrados en la Base */}
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${pal.line2}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
          <div style={{ padding: '5px 3px', background: 'rgba(242, 250, 245, 0.9)', border: '1px solid oklch(85% 0.05 145)', borderRadius: 9, textAlign: 'center' }}>
            <div style={{ ...mono, fontSize: 7.5, color: pal.deepGreen }}>AL DÍA</div>
            <div style={{ fontSize: 16, color: pal.deepGreen, fontWeight: 600, marginTop: 1, ...num, ...serif }}>{alDia}</div>
          </div>
          <div style={{ padding: '5px 3px', background: 'rgba(255, 252, 245, 0.9)', border: `1px solid ${pal.gold}`, borderRadius: 9, textAlign: 'center' }}>
            <div style={{ ...mono, fontSize: 7.5, color: 'oklch(50% 0.13 65)' }}>POR VENIR</div>
            <div style={{ fontSize: 16, color: 'oklch(50% 0.13 65)', fontWeight: 600, marginTop: 1, ...num, ...serif }}>{proximas}</div>
          </div>
          <div style={{ padding: '5px 3px', background: 'rgba(255, 245, 245, 0.9)', border: `1px solid ${pal.red}`, borderRadius: 9, textAlign: 'center' }}>
            <div style={{ ...mono, fontSize: 7.5, color: pal.red }}>VENCIDAS</div>
            <div style={{ fontSize: 16, color: pal.red, fontWeight: 600, marginTop: 1, ...num, ...serif }}>{vencidas}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Seccion01Hero({ atender, obligaciones, semanas, eventos, mesLabel, onPrevMes, onNextMes, onEventoClick, onNavigate, onAtender, onIrAlMuro }) {
  const principal = atender[0];
  const siguiente = atender[1];
  const esVencida = principal?.k === 'vencido';
  const dias = principal ? numDe(principal.dias) : null;
  const vencidas = obligaciones.filter((o) => o.k === 'vencido').length;

  return (
    <section id="obligaciones-resumen" style={{ position: 'relative', padding: '44px 56px 44px', overflow: 'hidden' }}>
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 395px', gap: 44, alignItems: 'end' }} className="ed-grid-hero">
        {/* Contenido principal izquierdo de max 720px idéntico al de Equipo */}
        <div style={{ position: 'relative', maxWidth: 720 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
            <span style={{ width: 32, height: 1, background: pal.ink }} />
            <span style={{ ...mono, color: pal.ink }}>Obligaciones · sección 01</span>
            <Dot c={esVencida ? pal.red : principal ? pal.gold : pal.sage} glow />
            <span style={{ ...mono, color: esVencida ? pal.red : principal ? 'oklch(50% 0.13 65)' : pal.deepGreen }}>
              {esVencida ? 'Vencida' : principal ? 'En cuenta regresiva' : 'Todo al día'}
            </span>
          </div>

          <h1 className="ed-hero-title" style={{ fontSize: 104, lineHeight: 0.92, margin: '0 0 18px', letterSpacing: '-0.03em', color: pal.ink, animation: 'ed-fade-up 900ms ease-out both', ...serif }}>
            {principal ? (
              esVencida ? (
                <>
                  <em style={{ fontStyle: 'italic', background: `linear-gradient(135deg, ${pal.red}, oklch(60% 0.16 30))`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>
                    Venció hace {dias !== null ? `${dias} ${dias === 1 ? 'día' : 'días'}` : ''}
                  </em>
                  <br />
                  la {NOMBRE_TARGET[principal.target] || principal.t}.
                </>
              ) : (
                <>
                  <em style={{ fontStyle: 'italic', background: 'linear-gradient(135deg, oklch(45% 0.11 145), oklch(60% 0.16 30))', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>
                    {dias !== null ? `${dias} ${dias === 1 ? 'día' : 'días'}` : 'Pronto'}
                  </em>
                  <br />
                  la {NOMBRE_TARGET[principal.target] || principal.t}.
                </>
              )
            ) : (
              'Nada pendiente,'
            )}
            {!principal && (
              <>
                <br />todo al día.
              </>
            )}
          </h1>

          <p style={{ fontSize: 24, fontStyle: 'italic', lineHeight: 1.35, margin: '0 0 32px', maxWidth: 640, color: 'oklch(35% 0.03 30)', animation: 'ed-fade-up 900ms ease-out 200ms both', ...serif }}>
            {principal ? (
              esVencida ? (
                <>
                  Tu obligación más urgente es {principal.t.toLowerCase()} — {principal.fecha.toLowerCase()}. {principal.d}.
                </>
              ) : (
                <>
                  Tu próxima obligación es {principal.t.toLowerCase()} — {principal.fecha.toLowerCase()}. {principal.d}.
                </>
              )
            ) : (
              'No tenés obligaciones vencidas ni próximas por ahora. Volvé a revisar cuando se acerque el 15 o el 20 del mes.'
            )}
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {principal && (
              <button
                type="button"
                onClick={() => onAtender(principal.target)}
                style={{ padding: '14px 26px', background: pal.ink, color: pal.cream, border: 'none', borderRadius: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10, boxShadow: '0 12px 30px -14px oklch(20% 0.02 30 / 0.4)', position: 'relative', overflow: 'hidden' }}
              >
                <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 40%, oklch(100% 0 0 / 0.15) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'ed-shine-sweep 4s ease-in-out infinite' }} />
                <span style={{ position: 'relative' }}>
                  Atender {NOMBRE_TARGET[principal.target] || principal.t} · {principal.montoFmt}
                </span>
                <svg style={{ position: 'relative' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            )}
            <button type="button" onClick={onIrAlMuro} style={{ padding: '14px 22px', background: pal.cream2, color: pal.ink, border: `1px solid ${pal.line}`, borderRadius: 14, fontSize: 14, cursor: 'pointer' }}>
              Ver el año completo ↓
            </button>
          </div>

          {/* Riel de Métricas KPI Inferior — 100% Idéntico a Equipo */}
          <div style={{ marginTop: 44, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '22px 0', borderTop: `1px solid ${pal.line}`, borderBottom: `1px solid ${pal.line}` }} className="ed-grid-4">
            <div style={{ paddingRight: 18, borderRight: `1px solid ${pal.line2}` }}>
              <div style={mono}>Vencimiento urgente</div>
              <div style={{ fontSize: 32, lineHeight: 1, marginTop: 6, color: esVencida ? pal.red : pal.ink, ...num, ...serif }}>
                {principal ? principal.fecha.split(' ')[0] + ' ' + principal.fecha.split(' ')[1] : 'Al día'}
              </div>
              <div style={{ fontSize: 11, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>
                {principal ? (esVencida ? `Venció hace ${dias} ${dias === 1 ? 'día' : 'días'}` : 'Próximo vencimiento') : 'Sin atrasos'}
              </div>
            </div>

            <div style={{ paddingLeft: 18, paddingRight: 18, borderRight: `1px solid ${pal.line2}` }}>
              <div style={mono}>Monto pendiente</div>
              <div style={{ fontSize: 32, lineHeight: 1, marginTop: 6, ...num, ...serif }}>
                {principal ? principal.montoFmt : '₡0'}
              </div>
              <div style={{ fontSize: 11, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>
                {principal ? NOMBRE_TARGET[principal.target] || principal.t : 'Sin pagos pendientes'}
              </div>
            </div>

            <div style={{ paddingLeft: 18, paddingRight: 18, borderRight: `1px solid ${pal.line2}` }}>
              <div style={mono}>Obligaciones</div>
              <div style={{ fontSize: 32, lineHeight: 1, marginTop: 6, ...num, ...serif }}>
                {obligaciones.length} en total
              </div>
              <div style={{ fontSize: 11, fontStyle: 'italic', color: vencidas > 0 ? pal.red : pal.deepGreen, marginTop: 4, ...serif }}>
                {obligaciones.filter(o => o.k === 'aldia' || o.k === 'pagado').length} al día · {vencidas} {vencidas === 1 ? 'vencida' : 'vencidas'}
              </div>
            </div>

            <div style={{ paddingLeft: 18 }}>
              <div style={mono}>Próximo hito</div>
              <div style={{ fontSize: 32, lineHeight: 1, marginTop: 6, color: 'oklch(50% 0.13 65)', ...num, ...serif }}>
                {siguiente ? siguiente.fecha.split(' ')[0] + ' ' + siguiente.fecha.split(' ')[1] : '—'}
              </div>
              <div style={{ fontSize: 11, fontStyle: 'italic', color: pal.coral, marginTop: 4, ...serif }}>
                {siguiente ? (NOMBRE_TARGET[siguiente.target] || siguiente.t) : 'Sin más pendientes'}
              </div>
            </div>
          </div>
        </div>

        {/* Módulo orbital de la derecha alineado a la línea base inferior del KPI (alignItems: 'end') */}
        <div style={{ width: 395 }}>
          <ConstelacionObligaciones obligaciones={obligaciones} eventos={eventos} semanas={semanas} mesLabel={mesLabel} onPrevMes={onPrevMes} onNextMes={onNextMes} onEventoClick={onEventoClick} onAtender={onAtender} />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 02 — La pista de aterrizaje: lo que viene
   --------------------------------------------------------- */

function TarjetaPista({ o, destacada, onAtender }) {
  const color = COLOR_TARGET[o.target] || pal.sage;
  if (destacada) {
    const esVencida = o.k === 'vencido';
    const acento = esVencida ? pal.red : pal.gold;
    return (
      <div style={{ position: 'relative', padding: '22px 24px', background: 'linear-gradient(160deg, oklch(30% 0.06 65 / 0.7), oklch(28% 0.04 30 / 0.7))', border: `1.5px solid ${acento}`, borderRadius: 20, overflow: 'hidden' }}>
        <span style={{ position: 'absolute', top: 0, right: 14, padding: '5px 12px', background: acento, color: esVencida ? pal.cream : pal.ink, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.16em', borderRadius: '0 0 8px 8px', fontWeight: 700 }}>
            {esVencida ? '⚠ VENCIDA' : '◆ SIGUIENTE'}
          </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, marginTop: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: acento, color: esVencida ? pal.cream : pal.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, ...serif }}>{ICONO_TARGET[o.target] || '·'}</div>
          <div>
            <div style={{ fontSize: 22, lineHeight: 1, color: pal.cream, ...serif }}>{NOMBRE_TARGET[o.target] || o.t}</div>
            {/* `fecha` y `dias` comparten el mismo texto honesto "Sin fecha
                configurada" cuando no hay ninguna de las dos configurada —
                mostrar ambas seguidas repetía la frase dos veces. */}
            <div style={{ ...mono, fontSize: 9, color: 'oklch(80% 0.10 65)', marginTop: 3 }}>{o.fecha === o.dias ? o.fecha : `${o.fecha} · ${o.dias}`}</div>
          </div>
        </div>
        <div style={{ fontSize: 36, color: acento, lineHeight: 1, ...num, ...serif }}>{o.montoFmt}</div>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid oklch(60% 0.02 30 / 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontStyle: 'italic', color: 'oklch(80% 0.03 60)', ...serif }}>{o.t}</span>
          <button type="button" onClick={() => onAtender(o.target)} style={{ padding: '6px 12px', background: acento, color: esVencida ? pal.cream : pal.ink, border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            Atender ↗
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: 20, background: 'oklch(30% 0.03 30 / 0.5)', border: '1px solid oklch(45% 0.02 30 / 0.4)', borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: color, color: pal.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, ...serif }}>{ICONO_TARGET[o.target] || '·'}</div>
        <div>
          <div style={{ fontSize: 17, lineHeight: 1, color: pal.cream, ...serif }}>{NOMBRE_TARGET[o.target] || o.t}</div>
          <div style={{ ...mono, fontSize: 8, color: 'oklch(75% 0.03 60)', marginTop: 3 }}>{o.fecha === o.dias ? o.fecha : `${o.fecha} · ${o.dias}`}</div>
        </div>
      </div>
      <div style={{ fontSize: 24, color: pal.cream, ...num, ...serif }}>{o.montoFmt}</div>
      <div style={{ fontSize: 11, fontStyle: 'italic', color: 'oklch(75% 0.03 60)', marginTop: 8, ...serif }}>{o.d}</div>
    </div>
  );
}

function PistaSection({ atender, onAtender }) {
  const [primera, ...resto] = atender;

  return (
    <section style={{ margin: '0 56px 56px', position: 'relative', borderRadius: 32, overflow: 'hidden', background: `linear-gradient(135deg, ${pal.ink} 0%, ${pal.ink2} 100%)`, color: pal.cream, padding: '42px 48px 40px' }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '120%', background: 'radial-gradient(circle, oklch(85% 0.14 65 / 0.22), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora 10s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '-10%', right: '-15%', width: '55%', height: '110%', background: 'radial-gradient(circle, oklch(70% 0.13 145 / 0.22), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora-2 12s ease-in-out infinite' }} />
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ ...mono, color: 'oklch(75% 0.03 60)', marginBottom: 8 }}>Sección 02 · la pista de aterrizaje</div>
            <div style={{ fontSize: 36, lineHeight: 1, ...serif }}>
              Lo que <em style={{ fontStyle: 'italic' }}>viene</em>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'oklch(75% 0.03 60)', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Dot c={pal.gold} size={8} /> Próxima
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Dot c={pal.sage} size={8} /> Programada
            </span>
          </div>
        </div>

        {atender.length === 0 ? (
          <div style={{ padding: '28px 24px', borderRadius: 18, background: 'oklch(30% 0.03 30 / 0.5)', border: '1px solid oklch(45% 0.02 30 / 0.4)', fontSize: 14, color: 'oklch(80% 0.03 60)' }}>
            No hay obligaciones vencidas ni próximas en este momento.
          </div>
        ) : (
          <div className="ed-grid-pista" style={{ display: 'grid', gridTemplateColumns: `340px repeat(${resto.length || 1}, 1fr)`, gap: 14, alignItems: 'stretch' }}>
            <TarjetaPista o={primera} destacada onAtender={onAtender} />
            {resto.map((o) => (
              <TarjetaPista key={o.t} o={o} onAtender={onAtender} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 03 — El dossier: CCSS / INS / Pagos (Luxury & Interactive)
   --------------------------------------------------------- */

function PasoCheck({ ok, destacar, titulo, detalle, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        padding: '12px 14px',
        borderRadius: 14,
        background: ok ? 'rgba(242, 250, 245, 0.85)' : destacar ? 'rgba(255, 252, 246, 0.95)' : pal.paper,
        border: ok
          ? '1px solid oklch(82% 0.08 145 / 0.5)'
          : destacar
          ? `1.5px solid ${pal.gold}`
          : `1px dashed ${pal.line}`,
        boxShadow: destacar ? '0 6px 16px -6px oklch(75% 0.10 60 / 0.25)' : 'none',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={(e) => { if (onClick && hoverFino()) e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { if (onClick) e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          background: ok ? pal.sage : destacar ? pal.gold : 'oklch(94% 0.01 70)',
          border: ok ? 'none' : destacar ? `2px solid ${pal.paper}` : `1.5px dashed ${pal.muted2}`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: destacar ? 'ed-gold-glow 2.4s ease-in-out infinite' : undefined,
          boxShadow: ok ? '0 0 8px oklch(80% 0.10 145 / 0.4)' : 'none',
        }}
      >
        {ok && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={pal.cream} strokeWidth="3">
            <path d="M5 12l5 5 9-11" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: ok ? pal.ink : destacar ? 'oklch(35% 0.10 55)' : pal.muted }}>{titulo}</div>
        <div style={{ fontSize: 11.5, fontStyle: 'italic', color: ok ? pal.deepGreen : destacar ? 'oklch(45% 0.10 55)' : pal.muted, marginTop: 2, ...serif }}>{detalle}</div>
      </div>
    </div>
  );
}

const HOY_ISO = fechaISO(HOY);

/** Métodos reales de Configuración — mismo criterio que Pagos.jsx/Planilla.jsx. */
function listaMetodosDossier(metodos) {
  return Array.isArray(metodos) && metodos.length > 0 ? metodos : ['Transferencia'];
}

/**
 * Registro real de un pago CCSS / reporte INS: fecha, monto, método y
 * referencia (opcional). Antes "Marcar como pagada"/"Regularizar reporte"
 * congelaban en silencio la fecha de hoy y el monto calculado, sin dejar
 * elegir con qué método se pagó ni constancia de ninguna referencia —
 * exactamente el hueco que pide Fase 9.
 */
function RegistroComprobanteModal({ open, titulo, montoSugerido, metodos, onClose, onConfirmar }) {
  const METODOS = listaMetodosDossier(metodos);
  const [fecha, setFecha] = useState(HOY_ISO);
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState(METODOS[0]);
  const [referencia, setReferencia] = useState('');

  useEffect(() => {
    if (open) {
      setFecha(HOY_ISO);
      setMonto(montoSugerido ? String(Math.round(montoSugerido)) : '');
      setMetodo(METODOS[0]);
      setReferencia('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, montoSugerido]);

  // Nunca una fecha futura ni vacía — un pago no puede haber ocurrido "mañana".
  const fechaInvalida = !fecha || fecha > HOY_ISO;
  const montoNum = Number(monto);
  const montoInvalido = !monto || Number.isNaN(montoNum) || montoNum <= 0;

  return (
    <Modal open={open} onClose={onClose} title={titulo} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Fecha de pago" htmlFor="reg-fecha" error={fechaInvalida ? 'La fecha no puede ser futura ni estar vacía.' : undefined}>
          <Input id="reg-fecha" type="date" value={fecha} max={HOY_ISO} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <Field label="Monto pagado (₡)" htmlFor="reg-monto" error={montoInvalido ? 'Ingresá el monto real pagado.' : undefined}>
          <Input id="reg-monto" type="number" min="0" step="1" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </Field>
        <Field label="Método de pago" htmlFor="reg-metodo">
          <Select id="reg-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {METODOS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label="Referencia / N.º de comprobante" htmlFor="reg-ref" help="Opcional — solo si el banco o SICERE te dio uno.">
          <Input id="reg-ref" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ej. 000123456" />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="accent"
            size="sm"
            disabled={fechaInvalida || montoInvalido}
            onClick={() => {
              if (fechaInvalida || montoInvalido) return;
              const fechaFmt = new Date(fecha + 'T00:00:00').toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
              onConfirmar({ fecha: fechaFmt, monto: montoNum, metodo, referencia: referencia.trim() });
            }}
          >
            Registrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DossierCcss({ ccssEstado, k, onAdjuntar, onMarcarPagada, empsActivos, tasas, periodoActivo, pagoDelMes, metodos, onNavigate }) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const fileRef = useRef(null);
  const [selectedEmpId, setSelectedEmpId] = useState(empsActivos[0]?.id || null);
  const RATE_OBRERA = tasas.deduccionEmpleado;
  const RATE_PATRONAL = tasas.cargasPatronales; // patronal + INS, misma tasa real que usa el resto de la app

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    onAdjuntar(await leerArchivoAdjunto(file));
  }

  const filas = empsActivos.map((e) => ({
    e,
    obrera: e.salario * RATE_OBRERA,
    patronal: e.salario * RATE_PATRONAL,
  }));
  const totObrera = filas.reduce((a, f) => a + f.obrera, 0);
  const totPatronal = filas.reduce((a, f) => a + f.patronal, 0);

  // El texto/color refleja el estado real (vencido según el día configurado
  // en Configuración) — sin fecha configurada, se mantiene "próximo" honesto.
  const vencida = !ccssEstado.pagada && k === 'vencido';
  const estadoTexto = ccssEstado.pagada ? 'Pagada' : vencida ? 'Vencido' : 'Próximo · pendiente de marcar';
  const estadoColor = ccssEstado.pagada ? pal.sage : vencida ? pal.red : pal.gold;
  const empSeleccionado = empsActivos.find((e) => e.id === selectedEmpId) || empsActivos[0];

  // Si el mes ya está pagado se muestra el hecho real congelado al marcarlo
  // (`pagoDelMes`), nunca la cuota recalculada con las tasas de hoy — que
  // pueden haber cambiado en Configuración desde entonces y reescribirían en
  // pantalla un pago ya ocurrido (auditoría C1). Esta lógica vivía solo en la
  // pantalla standalone de CCSS, que se eliminó por duplicada: se trae acá,
  // que ahora es la única fuente.
  const congelado = ccssEstado.pagada && !!pagoDelMes;
  const totalMostrado = congelado ? pagoDelMes.monto : totObrera + totPatronal;

  return (
    <>
      {/* Header del Dossier CCSS — Tono suave editorial, medallón con órbita continua */}
      <div style={{ padding: '28px 40px', background: 'linear-gradient(135deg, oklch(97% 0.02 65), oklch(94% 0.04 55 / 0.5))', borderBottom: `1px dashed ${pal.line}`, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center' }} className="ed-grid-dossier-head">
        <div
          style={{
            position: 'relative',
            width: 64,
            height: 64,
            borderRadius: 20,
            background: pal.gold,
            color: pal.ink,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 24px -10px oklch(50% 0.12 55 / 0.4)',
            animation: 'ed-core-breathe 4s ease-in-out infinite',
          }}
        >
          <svg style={{ position: 'absolute', inset: -5, width: 74, height: 74, pointerEvents: 'none', animation: 'ed-orbit-spin-cw 45s linear infinite' }} viewBox="0 0 74 74">
            <circle cx="37" cy="37" r="35" fill="none" stroke={pal.gold} strokeWidth="1" strokeDasharray="3 6" opacity="0.6" />
          </svg>
          <span style={{ fontSize: 32, fontWeight: 700, ...serif }}>C</span>
        </div>

        <div>
          <div style={{ ...mono, marginBottom: 4, color: 'oklch(45% 0.10 55)', fontSize: 10 }}>Caja Costarricense de Seguro Social · CCSS</div>
          <div style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.01em', ...serif }}>{periodoActivo ? `Cuota CCSS · ${periodoActivo.mes}` : 'Cuota CCSS'}</div>
          <div style={{ fontSize: 13.5, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>Planilla mensual reportada al seguro social · {empsActivos.length} personas cotizantes</div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ ...mono, fontSize: 9 }}>
            {congelado ? `Total pagado (${(pagoDelMes.tasaObrera * 100).toFixed(2)}% + ${(pagoDelMes.tasaPatronal * 100).toFixed(2)}%)` : 'Total a cancelar'}
          </div>
          <div style={{ fontSize: 40, lineHeight: 1, marginTop: 4, ...num, ...serif }}>{money(totalMostrado)}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '4px 12px', borderRadius: 999, background: ccssEstado.pagada ? 'rgba(242, 250, 245, 0.9)' : vencida ? 'rgba(255, 245, 245, 0.9)' : 'rgba(255, 252, 245, 0.9)', border: `1px solid ${estadoColor}`, color: ccssEstado.pagada ? pal.deepGreen : vencida ? pal.red : 'oklch(45% 0.12 55)', fontSize: 10.5, fontWeight: 600 }}>
            <Dot c={estadoColor} glow size={5} />
            {estadoTexto}
          </div>
          {/* Registro real del pago — fecha, método y referencia quedan
              vinculados al mes en que se pagó (ver `marcarCcssPagada` en
              App.jsx), no solo el monto. */}
          {congelado && (
            <div style={{ marginTop: 6, fontSize: 10.5, color: pal.muted, lineHeight: 1.5 }}>
              {pagoDelMes.fechaPago && <div>Pagada el {pagoDelMes.fechaPago}{pagoDelMes.metodo ? ` · ${pagoDelMes.metodo}` : ''}</div>}
              <div>Ref. {pagoDelMes.referencia || 'no registrada'}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr' }} className="ed-grid-dossier-body">
        {/* Columna Izquierda: Tabla Interactiva de Aportes con selección de colaborador */}
        <div style={{ padding: '30px 38px', borderRight: `1px solid ${pal.line2}` }}>
          <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: 21, ...serif }}>
                Cuánto <em style={{ fontStyle: 'italic' }}>aporta cada quien</em>
              </div>
              <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted, marginTop: 2, ...serif }}>
                obrera {(RATE_OBRERA * 100).toFixed(2)}% · patronal {(RATE_PATRONAL * 100).toFixed(2)}% · hacé clic en un colaborador para enfocar
              </div>
            </div>
            {empSeleccionado && (
              <span style={{ padding: '3px 9px', borderRadius: 999, background: pal.cream2, border: `1px solid ${pal.line}`, fontSize: 9, ...mono, color: pal.ink }}>
                {empSeleccionado.nombre.split(' ')[0]} enfocado
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 14, padding: '8px 6px', borderBottom: `1px solid ${pal.line}` }}>
              <div style={{ ...mono, fontSize: 8.5 }}>Persona · salario</div>
              <div style={{ ...mono, fontSize: 8.5, textAlign: 'right' }}>Obrera</div>
              <div style={{ ...mono, fontSize: 8.5, textAlign: 'right' }}>Patronal</div>
              <div style={{ ...mono, fontSize: 8.5, textAlign: 'right' }}>Total</div>
            </div>

            {filas.map(({ e, obrera, patronal }) => {
              const isSelected = selectedEmpId === e.id;
              return (
                <div
                  key={e.id}
                  onClick={() => setSelectedEmpId(e.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
                    gap: 14,
                    padding: '10px 8px',
                    borderRadius: 10,
                    background: isSelected ? 'rgba(255, 252, 245, 0.95)' : 'transparent',
                    // `border` (shorthand) + `borderBottom` (longhand) en el
                    // mismo objeto hacía que React se quejara en cada
                    // re-render ("mixing shorthand and non-shorthand
                    // properties"); se listan los 4 lados por separado.
                    borderTop: isSelected ? `1px solid ${pal.gold}` : '1px solid transparent',
                    borderRight: isSelected ? `1px solid ${pal.gold}` : '1px solid transparent',
                    borderLeft: isSelected ? `1px solid ${pal.gold}` : '1px solid transparent',
                    borderBottom: isSelected ? `1px solid ${pal.gold}` : `1px dotted ${pal.line2}`,
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    boxShadow: isSelected ? '0 4px 12px -4px oklch(75% 0.10 60 / 0.2)' : 'none',
                  }}
                  onMouseEnter={(el) => { if (!isSelected && hoverFino()) el.currentTarget.style.background = 'rgba(255, 252, 245, 0.5)'; }}
                  onMouseLeave={(el) => { if (!isSelected) el.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 999, background: e.avBg, color: e.avC, display: 'flex', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', fontSize: 10.5, fontWeight: 600, ...serif }}>
                      {e.ini}
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: isSelected ? 700 : 500, color: pal.ink }}>{e.nombre.split(' ')[0]} {e.nombre.split(' ')[1]}</div>
                      <div style={{ fontSize: 9.5, color: pal.muted, ...num }}>{money(e.salario)}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11.5, color: 'oklch(45% 0.10 25)', ...num }}>{money(obrera)}</div>
                  <div style={{ textAlign: 'right', fontSize: 11.5, color: 'oklch(35% 0.03 30)', ...num }}>{money(patronal)}</div>
                  <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 600, ...num, ...serif }}>{money(obrera + patronal)}</div>
                </div>
              );
            })}

            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 14, padding: '14px 8px 4px', borderTop: `2px solid ${pal.ink}`, marginTop: 4, alignItems: 'center' }}>
              <div style={{ ...mono, color: pal.ink, fontSize: 9.5, fontWeight: 700 }}>Total planilla · {filas.length} personas</div>
              <div style={{ textAlign: 'right', fontSize: 13, color: 'oklch(45% 0.10 25)', fontWeight: 700, ...num }}>{money(totObrera)}</div>
              <div style={{ textAlign: 'right', fontSize: 13, color: 'oklch(35% 0.03 30)', fontWeight: 700, ...num }}>{money(totPatronal)}</div>
              <div style={{ textAlign: 'right', fontSize: 22, color: pal.ink, fontWeight: 700, ...num, ...serif }}>{money(totObrera + totPatronal)}</div>
            </div>

            <div style={{ marginTop: 10, fontSize: 10.5, fontStyle: 'italic', color: pal.muted, ...serif }}>
              Este total sale de la planilla mensual reportada al seguro social con el equipo activo de hoy.
            </div>
          </div>
        </div>

        {/* Columna Derecha: Panel de Acción, comprobante y conciliación */}
        <div style={{ padding: '30px 34px', background: pal.cream2 }}>
          <div style={{ ...mono, marginBottom: 12, fontSize: 9.5, letterSpacing: '0.08em', color: pal.ink }}>PASOS DE CONCILIACIÓN</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <PasoCheck ok titulo="Planilla calculada" detalle="con los datos activos del sistema" />
            <PasoCheck
              ok={!!ccssEstado.archivo}
              destacar={!ccssEstado.archivo}
              titulo={ccssEstado.archivo ? 'Comprobante adjuntado' : 'Falta adjuntar comprobante'}
              detalle={ccssEstado.archivo ? `${ccssEstado.archivo.name} · ${tamañoLegible(ccssEstado.archivo.size)}` : 'hacé clic abajo para subir el PDF o PNG'}
              onClick={() => fileRef.current?.click()}
            />
            <PasoCheck
              ok={ccssEstado.pagada}
              destacar={!!ccssEstado.archivo && !ccssEstado.pagada}
              titulo={ccssEstado.pagada ? 'Marcada como pagada' : 'Falta marcar como pagada'}
              detalle={ccssEstado.pagada ? 'cuota conciliada' : 'registrá fecha, monto y método una vez cancelado'}
              onClick={!ccssEstado.pagada ? () => setModalAbierto(true) : undefined}
            />
          </div>

          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFile} style={{ display: 'none' }} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%',
              padding: '18px 16px',
              background: pal.paper,
              border: `1.5px dashed ${ccssEstado.archivo ? pal.sage : pal.line}`,
              borderRadius: 14,
              textAlign: 'center',
              marginBottom: 18,
              cursor: 'pointer',
              transition: 'all 200ms ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            }}
            onMouseEnter={(el) => { if (!hoverFino()) return; el.currentTarget.style.borderColor = pal.coral; el.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(el) => { el.currentTarget.style.borderColor = ccssEstado.archivo ? pal.sage : pal.line; el.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{ fontSize: 24, color: ccssEstado.archivo ? pal.deepGreen : pal.coral, lineHeight: 1, animation: 'ed-float-up 3s ease-in-out infinite', ...serif }}>↑</div>
            <div style={{ fontSize: 13.5, fontStyle: 'italic', color: pal.ink, marginTop: 4, fontWeight: 500, ...serif }}>
              {ccssEstado.archivo ? ccssEstado.archivo.name : 'Subí o arrastrá el comprobante'}
            </div>
            <div style={{ ...mono, fontSize: 8, marginTop: 3, color: pal.muted }}>PDF · PNG · JPG · máx 5 MB</div>
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              disabled={ccssEstado.pagada}
              onClick={() => setModalAbierto(true)}
              style={{
                padding: '13px 16px',
                background: ccssEstado.pagada ? pal.sage : pal.ink,
                color: pal.cream,
                border: 'none',
                borderRadius: 12,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: ccssEstado.pagada ? 'default' : 'pointer',
                opacity: ccssEstado.pagada ? 0.85 : 1,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: ccssEstado.pagada ? 'none' : '0 10px 22px -6px oklch(20% 0.02 30 / 0.35)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {!ccssEstado.pagada && <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 40%, oklch(100% 0 0 / 0.15) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'ed-shine-sweep 4s ease-in-out infinite' }} />}
              <span style={{ position: 'relative' }}>{ccssEstado.pagada ? 'Cuota pagada ✓' : 'Marcar como pagada'}</span>
              <span style={{ position: 'relative' }}>{ccssEstado.pagada ? '✓' : '↗'}</span>
            </button>
            <button type="button" onClick={() => onNavigate('planilla')} style={{ padding: '11px 15px', background: pal.paper, color: pal.ink, border: `1px solid ${pal.line}`, borderRadius: 11, fontSize: 11.5, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Ver detalle de planilla</span>
              <span style={{ color: pal.muted }}>↗</span>
            </button>
          </div>
        </div>
      </div>

      <RegistroComprobanteModal
        open={modalAbierto}
        titulo="Registrar pago CCSS"
        montoSugerido={totObrera + totPatronal}
        metodos={metodos}
        onClose={() => setModalAbierto(false)}
        onConfirmar={(datos) => {
          onMarcarPagada(datos);
          setModalAbierto(false);
        }}
      />
    </>
  );
}

function DossierIns({ insEstado, k, onAdjuntar, onRegularizar, poliza, actividad, cubiertos, empsActivos, periodoActivo, pagoDelMes, metodos, onNavigate }) {
  const fileRef = useRef(null);
  const [selectedEmpId, setSelectedEmpId] = useState(empsActivos?.[0]?.id || null);
  const [modalAbierto, setModalAbierto] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    onAdjuntar(await leerArchivoAdjunto(file));
  }

  // Monto estimado real: tasa de riesgo de la póliza (Configuración) sobre
  // la planilla mensual activa — misma fuente que App.jsx e Ins.jsx.
  const { monto: montoEstimado, tasa: tasaRiesgo } = buildInsMonto(empsActivos, poliza);

  // El texto/color refleja el estado real (vencido según el día configurado
  // en Configuración) — sin fecha configurada, se mantiene "pendiente" honesto.
  const vencido = !insEstado.alDia && k === 'vencido';
  const estadoTexto = insEstado.alDia ? 'Al día' : vencido ? 'Vencido' : 'Pendiente';
  const estadoColor = insEstado.alDia ? pal.sage : vencido ? pal.red : pal.gold;

  // Mismo criterio que CCSS: un reporte ya regularizado muestra el monto y la
  // tasa congelados en ese momento, no lo recalculado con la tasa de hoy.
  const congelado = insEstado.alDia && !!pagoDelMes;
  const montoMostrado = congelado ? pagoDelMes.monto : montoEstimado;

  // Vigencia REAL de la póliza — un hecho distinto de "el reporte del mes ya
  // se regularizó": la póliza puede seguir vigente sin haberlo presentado, y
  // al revés. Sin una fecha de fin parseable no se inventa vigencia. Venía de
  // la pantalla standalone de INS, eliminada por duplicada.
  const vigenciaPoliza = buildPolizaVigencia(poliza);

  return (
    <>
      {/* Header del Dossier INS — Tono suave editorial carmesí, medallón con órbita */}
      <div style={{ padding: '28px 40px', background: 'linear-gradient(135deg, oklch(97% 0.02 320), oklch(94% 0.04 300 / 0.5))', borderBottom: `1px dashed ${pal.line}`, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center' }} className="ed-grid-dossier-head">
        <div
          style={{
            position: 'relative',
            width: 64,
            height: 64,
            borderRadius: 20,
            background: 'oklch(70% 0.12 320)',
            color: pal.cream,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 24px -10px oklch(65% 0.12 320 / 0.4)',
            animation: 'ed-core-breathe 4s ease-in-out infinite',
          }}
        >
          <svg style={{ position: 'absolute', inset: -5, width: 74, height: 74, pointerEvents: 'none', animation: 'ed-orbit-spin-ccw 45s linear infinite' }} viewBox="0 0 74 74">
            <circle cx="37" cy="37" r="35" fill="none" stroke="oklch(75% 0.10 320)" strokeWidth="1" strokeDasharray="3 6" opacity="0.6" />
          </svg>
          <span style={{ fontSize: 32, fontWeight: 700, ...serif }}>I</span>
        </div>

        <div>
          <div style={{ ...mono, marginBottom: 4, color: 'oklch(45% 0.10 320)', fontSize: 10 }}>Instituto Nacional de Seguros · Riesgos del Trabajo</div>
          <div style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.01em', ...serif }}>{periodoActivo ? `Reporte de planilla · ${periodoActivo.mes}` : 'Reporte de planilla'}</div>
          <div style={{ fontSize: 13.5, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>Póliza {poliza.numero} · {actividad} · {cubiertos} personas protegidas</div>
          {/* Vigencia real de la póliza, con su propio estado — separado del
              estado del reporte mensual (ver `vigenciaPoliza`). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ ...mono, fontSize: 9 }}>Vigencia</span>
            <span style={{ fontSize: 12, color: pal.ink }}>{poliza.vigencia || 'Sin registrar'}</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 10px',
                borderRadius: 999,
                background: vigenciaPoliza.vigente === false ? 'rgba(255, 245, 245, 0.9)' : 'rgba(242, 250, 245, 0.9)',
                border: `1px solid ${vigenciaPoliza.vigente === false ? pal.red : pal.sage}`,
                color: vigenciaPoliza.vigente === false ? pal.red : pal.deepGreen,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              <Dot c={vigenciaPoliza.vigente === false ? pal.red : pal.sage} size={5} />
              {vigenciaPoliza.vigente === null ? 'Vigencia sin verificar' : vigenciaPoliza.vigente ? 'Vigente' : 'Vencida'}
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ ...mono, fontSize: 9 }}>
            {congelado ? `Monto regularizado (${(pagoDelMes.tasa * 100).toFixed(2)}%)` : `Monto estimado (${poliza.tasa})`}
          </div>
          <div style={{ fontSize: 40, lineHeight: 1, marginTop: 4, ...num, ...serif }}>{montoMostrado ? money(montoMostrado) : '—'}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '4px 12px', borderRadius: 999, background: insEstado.alDia ? 'rgba(242, 250, 245, 0.9)' : vencido ? 'rgba(255, 245, 245, 0.9)' : 'rgba(255, 252, 245, 0.9)', border: `1px solid ${estadoColor}`, color: insEstado.alDia ? pal.deepGreen : vencido ? pal.red : 'oklch(45% 0.12 55)', fontSize: 10.5, fontWeight: 600 }}>
            <Dot c={estadoColor} glow size={5} />
            {estadoTexto}
          </div>
          {congelado && (
            <div style={{ marginTop: 6, fontSize: 10.5, color: pal.muted, lineHeight: 1.5 }}>
              {pagoDelMes.fechaPago && <div>Regularizado el {pagoDelMes.fechaPago}{pagoDelMes.metodo ? ` · ${pagoDelMes.metodo}` : ''}</div>}
              <div>Ref. {pagoDelMes.referencia || 'no registrada'}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr' }} className="ed-grid-dossier-body">
        {/* Columna Izquierda: Cobertura de Póliza y Lista Interactiva de Empleados */}
        <div style={{ padding: '30px 38px', borderRight: `1px solid ${pal.line2}` }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 21, ...serif }}>
              Cobertura de póliza <em style={{ fontStyle: 'italic' }}>y personal protegido</em>
            </div>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted, marginTop: 2, ...serif }}>
              tasa de riesgo {(tasaRiesgo * 100).toFixed(2)}% sobre planilla activa · haz clic para consultar
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {empsActivos.map((e) => {
              const isSelected = selectedEmpId === e.id;
              return (
                <div
                  key={e.id}
                  onClick={() => setSelectedEmpId(e.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '11px 14px',
                    borderRadius: 12,
                    background: isSelected ? 'rgba(255, 252, 245, 0.95)' : pal.cream2,
                    border: isSelected ? `1px solid ${pal.gold}` : `1px solid ${pal.line2}`,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={(el) => { if (!isSelected && hoverFino()) el.currentTarget.style.borderColor = pal.line; }}
                  onMouseLeave={(el) => { if (!isSelected) el.currentTarget.style.borderColor = pal.line2; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 999, background: e.avBg, color: e.avC, display: 'flex', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', fontSize: 10.5, fontWeight: 600, ...serif }}>{e.ini}</div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: isSelected ? 700 : 600, color: pal.ink }}>{e.nombre}</div>
                      <div style={{ fontSize: 9.5, color: pal.muted, ...mono }}>{e.puesto}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: pal.deepGreen }}>Protegido RT</div>
                    <div style={{ fontSize: 9.5, color: pal.muted, ...num }}>{money(e.salario)} / mes</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna Derecha: Panel de Regularización */}
        <div style={{ padding: '30px 34px', background: pal.cream2 }}>
          <div style={{ ...mono, marginBottom: 12, fontSize: 9.5, letterSpacing: '0.08em', color: pal.ink }}>PASOS DE REGULARIZACIÓN INS</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <PasoCheck ok titulo="Planilla calculada" detalle="datos de salarios validados" />
            <PasoCheck
              ok={!!insEstado.archivo}
              destacar={!insEstado.archivo}
              titulo={insEstado.archivo ? 'Comprobante adjuntado' : 'Falta constancia de salarios'}
              detalle={insEstado.archivo ? `${insEstado.archivo.name} · ${tamañoLegible(insEstado.archivo.size)}` : 'subí el reporte firmado'}
              onClick={() => fileRef.current?.click()}
            />
            <PasoCheck
              ok={insEstado.alDia}
              destacar={!!insEstado.archivo && !insEstado.alDia}
              titulo={insEstado.alDia ? 'Reporte regularizado' : 'Falta regularizar'}
              detalle={insEstado.alDia ? 'póliza al día' : 'registrá fecha, monto y método antes del cierre de mes'}
              onClick={!insEstado.alDia ? () => setModalAbierto(true) : undefined}
            />
          </div>

          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFile} style={{ display: 'none' }} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%',
              padding: '18px 16px',
              background: pal.paper,
              border: `1.5px dashed ${insEstado.archivo ? pal.sage : pal.line}`,
              borderRadius: 14,
              textAlign: 'center',
              marginBottom: 18,
              cursor: 'pointer',
              transition: 'all 200ms ease',
            }}
            onMouseEnter={(el) => { if (!hoverFino()) return; el.currentTarget.style.borderColor = pal.coral; el.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(el) => { el.currentTarget.style.borderColor = insEstado.archivo ? pal.sage : pal.line; el.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{ fontSize: 24, color: insEstado.archivo ? pal.deepGreen : pal.coral, lineHeight: 1, animation: 'ed-float-up 3s ease-in-out infinite', ...serif }}>↑</div>
            <div style={{ fontSize: 13.5, fontStyle: 'italic', color: pal.ink, marginTop: 4, fontWeight: 500, ...serif }}>
              {insEstado.archivo ? insEstado.archivo.name : 'Adjuntar reporte de salarios INS'}
            </div>
            <div style={{ ...mono, fontSize: 8, marginTop: 3, color: pal.muted }}>PDF · PNG · JPG · máx 5 MB</div>
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              disabled={insEstado.alDia}
              onClick={() => setModalAbierto(true)}
              style={{
                padding: '13px 16px',
                background: insEstado.alDia ? pal.sage : pal.red,
                color: pal.cream,
                border: 'none',
                borderRadius: 12,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: insEstado.alDia ? 'default' : 'pointer',
                opacity: insEstado.alDia ? 0.85 : 1,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: insEstado.alDia ? 'none' : '0 10px 22px -6px oklch(60% 0.14 30 / 0.35)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {!insEstado.alDia && <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 40%, oklch(100% 0 0 / 0.15) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'ed-shine-sweep 4s ease-in-out infinite' }} />}
              <span style={{ position: 'relative' }}>{insEstado.alDia ? 'Póliza al día ✓' : 'Regularizar reporte'}</span>
              <span style={{ position: 'relative' }}>{insEstado.alDia ? '✓' : '↗'}</span>
            </button>
            <button type="button" onClick={() => onNavigate('planilla')} style={{ padding: '11px 15px', background: pal.paper, color: pal.ink, border: `1px solid ${pal.line}`, borderRadius: 11, fontSize: 11.5, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Ver detalle de planilla</span>
              <span style={{ color: pal.muted }}>↗</span>
            </button>
          </div>
        </div>
      </div>

      <RegistroComprobanteModal
        open={modalAbierto}
        titulo="Registrar reporte INS"
        montoSugerido={montoEstimado}
        metodos={metodos}
        onClose={() => setModalAbierto(false)}
        onConfirmar={(datos) => {
          onRegularizar(datos);
          setModalAbierto(false);
        }}
      />
    </>
  );
}

function DossierPagos({ totales, atender, onNavigate, empsActivos }) {
  const o = atender.find((a) => a.target === 'pagos');
  const [selectedEmpId, setSelectedEmpId] = useState(empsActivos?.[0]?.id || null);

  return (
    <>
      {/* Header del Dossier Pagos — Tono suave editorial celeste, medallón con órbita */}
      <div style={{ padding: '28px 40px', background: 'linear-gradient(135deg, oklch(97% 0.02 220), oklch(94% 0.04 200 / 0.5))', borderBottom: `1px dashed ${pal.line}`, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center' }} className="ed-grid-dossier-head">
        <div
          style={{
            position: 'relative',
            width: 64,
            height: 64,
            borderRadius: 20,
            background: pal.sky,
            color: pal.ink,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 24px -10px oklch(75% 0.12 220 / 0.4)',
            animation: 'ed-core-breathe 4s ease-in-out infinite',
          }}
        >
          <svg style={{ position: 'absolute', inset: -5, width: 74, height: 74, pointerEvents: 'none', animation: 'ed-orbit-spin-cw 45s linear infinite' }} viewBox="0 0 74 74">
            <circle cx="37" cy="37" r="35" fill="none" stroke="oklch(60% 0.10 220)" strokeWidth="1" strokeDasharray="3 6" opacity="0.6" />
          </svg>
          <span style={{ fontSize: 32, fontWeight: 700, ...serif }}>P</span>
        </div>

        <div>
          <div style={{ ...mono, marginBottom: 4, color: 'oklch(40% 0.10 220)', fontSize: 10 }}>Planilla Quincenal · Depósitos Bancarios</div>
          <div style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.01em', ...serif }}>Pagos de la quincena</div>
          <div style={{ fontSize: 13.5, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>{totales.pendCount} personas con transferencia pendiente{o ? ` · ${o.fecha.toLowerCase()}` : ''}</div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ ...mono, fontSize: 9 }}>Monto pendiente por transferir</div>
          <div style={{ fontSize: 40, lineHeight: 1, marginTop: 4, ...num, ...serif }}>{money(totales.pendiente)}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '4px 12px', borderRadius: 999, background: 'rgba(255, 252, 245, 0.9)', border: `1px solid ${pal.gold}`, color: 'oklch(50% 0.12 65)', fontSize: 10.5, fontWeight: 600 }}>
            <Dot c={pal.gold} glow size={5} />
            {totales.pendCount > 0 ? `${totales.pendCount} pendientes` : 'Al día'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr' }} className="ed-grid-dossier-body">
        {/* Columna Izquierda: Detalle de Depósitos por Colaborador */}
        <div style={{ padding: '30px 38px', borderRight: `1px solid ${pal.line2}` }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 21, ...serif }}>
              Detalle de transferencias <em style={{ fontStyle: 'italic' }}>esta quincena</em>
            </div>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted, marginTop: 2, ...serif }}>
              según el canal de pago registrado de cada colaborador
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {empsActivos.slice(0, 4).map((e) => {
              const isSelected = selectedEmpId === e.id;
              return (
                <div
                  key={e.id}
                  onClick={() => setSelectedEmpId(e.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '11px 14px',
                    borderRadius: 12,
                    background: isSelected ? 'rgba(255, 252, 245, 0.95)' : pal.cream2,
                    border: isSelected ? `1px solid ${pal.gold}` : `1px solid ${pal.line2}`,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={(el) => { if (!isSelected && hoverFino()) el.currentTarget.style.borderColor = pal.line; }}
                  onMouseLeave={(el) => { if (!isSelected) el.currentTarget.style.borderColor = pal.line2; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 999, background: e.avBg, color: e.avC, display: 'flex', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', fontSize: 10.5, fontWeight: 600, ...serif }}>{e.ini}</div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: isSelected ? 700 : 600, color: pal.ink }}>{e.nombre}</div>
                      <div style={{ fontSize: 9.5, color: pal.muted, ...mono }}>{e.banco}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: pal.ink, ...num }}>{money(Math.round(e.salario / 2))}</div>
                    <div style={{ fontSize: 9.5, color: pal.gold, fontWeight: 600, ...mono }}>Pendiente</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna Derecha: Panel de Acción y Navegación a Pagos */}
        <div style={{ padding: '30px 34px', background: pal.cream2 }}>
          <div style={{ ...mono, marginBottom: 12, fontSize: 9.5, letterSpacing: '0.08em', color: pal.ink }}>GESTIÓN Y DEPOSITOS DE PLANILLA</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <PasoCheck ok titulo="Planilla quincenal calculada" detalle="monto neto configurado" />
            <PasoCheck ok={false} destacar titulo="Transferencias bancarias" detalle="pendientes de ejecución en el banco" />
            <PasoCheck ok={false} titulo="Conciliación de comprobantes" detalle="marcar cada colaborador como pagado" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={() => onNavigate('pagos')}
              style={{
                width: '100%',
                padding: '14px 18px',
                background: pal.ink,
                color: pal.cream,
                border: 'none',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 10px 22px -6px oklch(20% 0.02 30 / 0.35)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 40%, oklch(100% 0 0 / 0.15) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'ed-shine-sweep 4s ease-in-out infinite' }} />
              <span style={{ position: 'relative' }}>Ir a la pantalla de Pagos</span>
              <span style={{ position: 'relative', fontSize: 14 }}>↗</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function DossierSection({ tab, onTabChange, ccssEstado, insEstado, ccssPagoDelMes, insPagoDelMes, kCcss, kIns, onAdjuntarCcss, onMarcarCcssPagada, onAdjuntarIns, onRegularizarIns, empsActivos, tasas, poliza, actividad, ccssCuota, periodoActivo, totales, atender, metodos, onNavigate }) {
  const insVencido = !insEstado.alDia && kIns === 'vencido';
  const TABS = [
    { k: 'ccss', l: 'CCSS', tag: money(ccssCuota?.total || 0), dotColor: pal.gold },
    { k: 'ins', l: 'INS', tag: insEstado.alDia ? 'Al día' : insVencido ? 'Vencido' : 'Pendiente', dotColor: insEstado.alDia ? pal.sage : insVencido ? pal.red : pal.gold },
    { k: 'pagos', l: 'Pagos', tag: `${totales.pendCount} pend.`, dotColor: pal.sky },
  ];
  const mesActivo = periodoActivo?.mes || '';
  const titulo = tab === 'ccss' ? `CCSS · ${mesActivo}` : tab === 'ins' ? `Reporte de planilla · ${mesActivo}` : 'Pagos de la quincena';

  return (
    <section style={{ position: 'relative', padding: '0 56px 56px' }}>
      {/* Resplandor ambiental de fondo muy suave */}
      <div
        style={{
          position: 'absolute',
          top: -20,
          left: '25%',
          width: '50%',
          height: '100%',
          background: 'radial-gradient(ellipse at 50% 30%, oklch(93% 0.04 60 / 0.3), transparent 70%)',
          filter: 'blur(28px)',
          animation: 'ed-aurora 14s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 28, alignItems: 'baseline', marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 6, fontSize: 10 }}>Sección 03 · el dossier</div>
          <div style={{ fontSize: 42, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            {titulo}, <em style={{ fontStyle: 'italic' }}>abierta</em>
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: pal.muted }}>
          <span style={{ ...mono, fontSize: 9.5 }}>Ver otra obligación</span>
          <span style={{ width: 1, height: 14, background: pal.line, margin: '0 4px' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {TABS.map((t) => {
              const isActive = tab === t.k;
              return (
                <button
                  key={t.k}
                  type="button"
                  onClick={() => onTabChange(t.k)}
                  style={{
                    padding: '6px 14px',
                    background: isActive ? pal.ink : 'rgba(255, 253, 249, 0.9)',
                    color: isActive ? pal.cream : pal.ink,
                    border: isActive ? 'none' : `1px solid ${pal.line}`,
                    borderRadius: 999,
                    fontSize: 11.5,
                    cursor: 'pointer',
                    fontWeight: isActive ? 600 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 200ms ease',
                    boxShadow: isActive ? '0 6px 16px -4px oklch(20% 0.02 30 / 0.25)' : 'none',
                  }}
                  onMouseEnter={(el) => { if (!isActive && hoverFino()) el.currentTarget.style.borderColor = pal.coral; }}
                  onMouseLeave={(el) => { if (!isActive) el.currentTarget.style.borderColor = pal.line; }}
                >
                  <Dot c={t.dotColor} glow={isActive} size={4.5} />
                  <span>{t.l}</span>
                  <span style={{ fontSize: 9.5, opacity: isActive ? 0.85 : 0.6, ...mono }}>({t.tag})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <article style={{ position: 'relative', background: pal.paper, borderRadius: 24, overflow: 'hidden', boxShadow: '0 24px 50px -24px oklch(20% 0.02 30 / 0.25)', border: `1px solid ${pal.line}` }}>
        {tab === 'ccss' && <DossierCcss ccssEstado={ccssEstado} k={kCcss} onAdjuntar={onAdjuntarCcss} onMarcarPagada={onMarcarCcssPagada} empsActivos={empsActivos} tasas={tasas} periodoActivo={periodoActivo} pagoDelMes={ccssPagoDelMes} metodos={metodos} onNavigate={onNavigate} />}
        {tab === 'ins' && <DossierIns insEstado={insEstado} k={kIns} onAdjuntar={onAdjuntarIns} onRegularizar={onRegularizarIns} poliza={poliza} actividad={actividad} cubiertos={empsActivos.length} empsActivos={empsActivos} periodoActivo={periodoActivo} pagoDelMes={insPagoDelMes} metodos={metodos} onNavigate={onNavigate} />}
        {tab === 'pagos' && <DossierPagos totales={totales} atender={atender} onNavigate={onNavigate} empsActivos={empsActivos} />}
      </article>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 04 — El muro del año (Interactive Matrix Command Deck)
   --------------------------------------------------------- */

function celdaMesStyle({ tieneHistorial, montoFmt, esHoy, estadoHoy, isHovered, isSelected }) {
  if (esHoy) {
    const bg = estadoHoy === 'vencido' ? pal.red : estadoHoy === 'pagado' || estadoHoy === 'aldia' ? 'rgba(242, 250, 245, 0.95)' : 'rgba(255, 252, 245, 0.95)';
    const fg = estadoHoy === 'vencido' ? pal.cream : estadoHoy === 'pagado' || estadoHoy === 'aldia' ? pal.deepGreen : 'oklch(35% 0.12 55)';
    const border = estadoHoy === 'vencido' ? `1.5px solid ${pal.red}` : `1.5px solid ${pal.gold}`;
    return {
      background: bg,
      border,
      color: fg,
      glow: estadoHoy !== 'pagado' && estadoHoy !== 'aldia',
      scale: isHovered || isSelected ? 1.14 : 1.0,
      shadow: isHovered || isSelected ? '0 8px 18px -4px oklch(75% 0.10 60 / 0.3)' : 'none',
    };
  }
  if (tieneHistorial) {
    return {
      background: isHovered || isSelected ? 'rgba(235, 248, 240, 0.98)' : 'rgba(242, 250, 245, 0.9)',
      border: isHovered || isSelected ? `1.2px solid ${pal.sage}` : '1px solid transparent',
      color: pal.deepGreen,
      glow: false,
      monto: montoFmt,
      scale: isHovered || isSelected ? 1.12 : 1.0,
      shadow: isHovered || isSelected ? '0 6px 14px -4px oklch(75% 0.10 145 / 0.25)' : 'none',
    };
  }
  return {
    background: isHovered || isSelected ? 'rgba(255, 252, 245, 0.7)' : 'rgba(250, 248, 242, 0.6)',
    border: isHovered || isSelected ? `1.2px stroke ${pal.gold}` : `1px dashed ${pal.line}`,
    color: pal.muted,
    glow: false,
    scale: isHovered || isSelected ? 1.08 : 1.0,
    shadow: 'none',
  };
}

function FilaMuro({ icono, iconoBg, nombre, sub, celdas, hoveredMesIdx, selectedMesIdx, onSelectCell }) {
  const [isRowHovered, setIsRowHovered] = useState(false);

  return (
    <>
      <div
        onMouseEnter={() => { if (hoverFino()) setIsRowHovered(true); }}
        onMouseLeave={() => setIsRowHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 4px',
          borderRadius: 10,
          background: isRowHovered ? 'rgba(255, 252, 245, 0.8)' : 'transparent',
          transition: 'all 150ms ease',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 26,
            height: 26,
            borderRadius: 8,
            background: iconoBg,
            color: pal.ink,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            boxShadow: isRowHovered ? '0 4px 10px -2px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 200ms ease',
            ...serif,
          }}
        >
          {isRowHovered && (
            <svg style={{ position: 'absolute', inset: -3, width: 32, height: 32, pointerEvents: 'none', animation: 'ed-orbit-spin-cw 20s linear infinite' }} viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="14.5" fill="none" stroke={pal.gold} strokeWidth="1" strokeDasharray="2 4" opacity="0.75" />
            </svg>
          )}
          {icono}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: pal.ink }}>{nombre}</div>
          <div style={{ fontSize: 9, color: pal.muted, ...mono }}>{sub}</div>
        </div>
      </div>

      {celdas.map((c, i) => {
        const isHovered = hoveredMesIdx === i;
        const isSelected = selectedMesIdx === i;
        const estilo = celdaMesStyle({ tieneHistorial: c.tieneHistorial, montoFmt: c.montoFmtCorto, esHoy: c.esHoy, estadoHoy: c.estadoHoy, isHovered, isSelected });

        return (
          <div
            key={i}
            onClick={() => onSelectCell(i, nombre, c)}
            style={{
              aspectRatio: '1',
              background: estilo.background,
              borderRadius: 9,
              border: estilo.border,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              cursor: 'pointer',
              animation: estilo.glow ? 'ed-gold-glow 2.4s ease-in-out infinite' : undefined,
              transform: `scale(${estilo.scale})`,
              boxShadow: estilo.shadow,
              transition: 'all 180ms cubic-bezier(0.16, 1, 0.3, 1)',
              position: 'relative',
              zIndex: isHovered || isSelected ? 8 : 1,
            }}
          >
            {c.esHoy && (
              <div style={{ ...mono, fontSize: 8, color: estilo.color, fontWeight: 700 }}>
                {c.estadoHoy === 'vencido' ? '!' : c.estadoHoy === 'pagado' || c.estadoHoy === 'aldia' ? '✓' : '◆'}
              </div>
            )}
            {!c.esHoy && c.tieneHistorial && (
              <div style={{ ...mono, fontSize: 8, color: estilo.color, fontWeight: 700 }}>✓</div>
            )}
            {(c.montoFmtCorto || estilo.monto) && (
              <div style={{ ...mono, fontSize: 8, color: estilo.color, fontWeight: 600 }}>
                {c.montoFmtCorto || estilo.monto}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function formatKcorto(n) {
  return Math.round(n / 1000) + 'k';
}

function MuroSection({ obligaciones, atender, ccssHistorial, insHistorial, ccssCuota }) {
  const [hoveredMesIdx, setHoveredMesIdx] = useState(null);
  const [selectedMesIdx, setSelectedMesIdx] = useState(HOY.mesIndice);
  const [filtroMuro, setFiltroMuro] = useState('todos');

  // CCSS: historial real (arranca vacío) + estado del mes actual
  const ccssPorMes = new Map();
  ccssHistorial.forEach((h) => {
    const m = /([a-záéíóú]+)\s+(\d{4})/i.exec(h.periodo);
    if (m) {
      const idx = MESES_LARGO.findIndex((mm) => mm.startsWith(m[1].toLowerCase().slice(0, 3)));
      if (idx >= 0) ccssPorMes.set(idx, h.monto);
    }
  });
  const ccssObligacion = obligaciones.find((o) => o.target === 'ccss' && (o.k === 'proximo' || o.k === 'vencido'));
  const ccssPagadaObligacion = obligaciones.find((o) => o.target === 'ccss' && o.k === 'pagado');
  // Día real de vencimiento configurado en Configuración (nunca "d.20" fijo
  // — auditoría F13). Se lee de la fecha ya resuelta de la obligación
  // (`ccssObligacion`/`ccssPagadaObligacion`.fecha, que ya viene honesta
  // desde `buildObligaciones`); sin día configurado, se dice así.
  const ccssDiaReal = parseFechaObligacion((ccssObligacion || ccssPagadaObligacion)?.fecha)?.dia;
  const ccssSub = ccssDiaReal ? `mensual · d.${String(ccssDiaReal).padStart(2, '0')}` : 'mensual · sin día configurado';

  const insPorMes = new Map();
  insHistorial.forEach((h) => {
    const m = /([a-záéíóú]+)\s+(\d{4})/i.exec(h.periodo);
    if (m) {
      const idx = MESES_LARGO.findIndex((mm) => mm.startsWith(m[1].toLowerCase().slice(0, 3)));
      if (idx >= 0) insPorMes.set(idx, h.monto);
    }
  });
  const insObligacion = obligaciones.find((o) => o.target === 'ins');

  const ccssCeldas = MESES_ABR_UP.map((_, mesIdx) => {
    const esHoy = mesIdx === HOY.mesIndice;
    if (esHoy) {
      const estadoHoy = ccssObligacion ? ccssObligacion.k : ccssPagadaObligacion ? 'pagado' : null;
      return { esHoy: true, estadoHoy, montoFmtCorto: ccssObligacion ? formatKcorto(ccssObligacion.monto) : ccssPagadaObligacion ? formatKcorto(ccssPagadaObligacion.monto) : null, montoFull: ccssObligacion?.monto || ccssPagadaObligacion?.monto || ccssCuota?.total || 0 };
    }
    const monto = ccssPorMes.get(mesIdx);
    return { esHoy: false, tieneHistorial: monto != null, montoFmtCorto: monto != null ? formatKcorto(monto) : null, montoFull: monto };
  });

  const insCeldas = MESES_ABR_UP.map((_, mesIdx) => {
    const esHoy = mesIdx === HOY.mesIndice;
    if (esHoy) {
      return { esHoy: true, estadoHoy: insObligacion ? insObligacion.k : 'aldia', montoFmtCorto: insObligacion ? formatKcorto(insObligacion.monto) : null, montoFull: insObligacion?.monto ?? 0 };
    }
    const monto = insPorMes.get(mesIdx);
    return { esHoy: false, tieneHistorial: monto != null, montoFmtCorto: monto != null ? formatKcorto(monto) : null, montoFull: monto };
  });

  const pagadasRegistradas = ccssHistorial.length + insHistorial.length + (ccssPagadaObligacion ? 1 : 0);
  const vencidasHoy = obligaciones.filter((o) => o.k === 'vencido').length;
  const totalObl = obligaciones.length || 1;
  const pctAlDia = Math.round((obligaciones.filter((o) => o.k === 'aldia' || o.k === 'pagado').length / totalObl) * 100);
  // Real: suma de todo lo que el sistema tiene efectivamente registrado como pagado
  // (historial de CCSS/INS + la cuota CCSS del período activo si ya se marcó pagada).
  const volumenPagadoReal =
    ccssHistorial.reduce((a, h) => a + h.monto, 0) + insHistorial.reduce((a, h) => a + h.monto, 0) + (ccssPagadaObligacion ? ccssPagadaObligacion.monto : 0);

  const mesEnfocadoLabel = MESES_LARGO[selectedMesIdx || HOY.mesIndice].toUpperCase();
  const ccssEnfocado = ccssCeldas[selectedMesIdx || HOY.mesIndice];
  const insEnfocado = insCeldas[selectedMesIdx || HOY.mesIndice];

  return (
    <section style={{ position: 'relative', padding: '0 56px 56px' }}>
      {/* Resplandor ambiental de fondo */}
      <div
        style={{
          position: 'absolute',
          top: -20,
          right: '15%',
          width: '55%',
          height: '100%',
          background: 'radial-gradient(circle at 60% 40%, oklch(92% 0.05 60 / 0.25), transparent 65%)',
          filter: 'blur(28px)',
          animation: 'ed-aurora 14s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 28, alignItems: 'baseline', marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 6, fontSize: 10 }}>Sección 04 · el muro del año</div>
          <div style={{ fontSize: 42, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            {HOY.anio}, <em style={{ fontStyle: 'italic' }}>de un vistazo</em>
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {['todos', 'ccss', 'ins'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltroMuro(f)}
              style={{
                padding: '5px 12px',
                background: filtroMuro === f ? pal.ink : 'rgba(255, 253, 249, 0.9)',
                color: filtroMuro === f ? pal.cream : pal.ink,
                border: filtroMuro === f ? 'none' : `1px solid ${pal.line}`,
                borderRadius: 999,
                fontSize: 10.5,
                ...mono,
                cursor: 'pointer',
                fontWeight: filtroMuro === f ? 600 : 400,
                transition: 'all 150ms ease',
              }}
            >
              {f === 'todos' ? 'TODOS' : f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', padding: '26px 28px', background: pal.paper, border: `1px solid ${pal.line}`, borderRadius: 24, boxShadow: '0 20px 48px -20px oklch(20% 0.02 30 / 0.2)', overflowX: 'auto' }}>
        {/* Matriz interactiva de 12 meses */}
        <div style={{ display: 'grid', gridTemplateColumns: '135px repeat(12, 1fr)', gap: 6, minWidth: '100%', alignItems: 'center' }} className="ed-grid-muro">
          <div style={{ ...mono, fontSize: 8.5, color: pal.muted }}>Matriz anual</div>

          {MESES_ABR_UP.map((m, i) => {
            const isHoy = i === HOY.mesIndice;
            const isHovered = hoveredMesIdx === i;
            const isSelected = selectedMesIdx === i;

            return (
              <div
                key={m}
                onMouseEnter={() => { if (hoverFino()) setHoveredMesIdx(i); }}
                onMouseLeave={() => setHoveredMesIdx(null)}
                onClick={() => setSelectedMesIdx(i)}
                style={{
                  fontSize: 9.5,
                  fontWeight: isHoy || isSelected ? 700 : 500,
                  textAlign: 'center',
                  padding: '5px 0',
                  color: isHoy ? pal.coral : isSelected ? pal.ink : isHovered ? pal.ink : pal.muted,
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                  borderRadius: 6,
                  background: isSelected ? 'rgba(255, 252, 245, 0.9)' : isHovered ? 'rgba(255, 252, 245, 0.5)' : 'transparent',
                  border: isSelected ? `1px solid ${pal.gold}` : '1px solid transparent',
                  transition: 'all 150ms ease',
                }}
              >
                {m}
              </div>
            );
          })}

          {(filtroMuro === 'todos' || filtroMuro === 'ccss') && (
            <FilaMuro
              icono="C"
              iconoBg={pal.gold}
              nombre="CCSS"
              sub={ccssSub}
              celdas={ccssCeldas}
              hoveredMesIdx={hoveredMesIdx}
              selectedMesIdx={selectedMesIdx}
              onSelectCell={(idx) => setSelectedMesIdx(idx)}
            />
          )}

          {(filtroMuro === 'todos' || filtroMuro === 'ins') && (
            <FilaMuro
              icono="I"
              iconoBg="oklch(70% 0.12 320)"
              nombre="INS RT"
              sub="mensual · reporte"
              celdas={insCeldas}
              hoveredMesIdx={hoveredMesIdx}
              selectedMesIdx={selectedMesIdx}
              onSelectCell={(idx) => setSelectedMesIdx(idx)}
            />
          )}
        </div>

        {/* Inspector Interactivo del Mes Seleccionado */}
        <div style={{ marginTop: 20, padding: '16px 20px', background: 'rgba(255, 252, 245, 0.9)', border: `1px solid ${pal.line2}`, borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ padding: '4px 10px', borderRadius: 999, background: pal.ink, color: pal.cream, fontSize: 10, ...mono, fontWeight: 700 }}>
              INSPECTOR · {mesEnfocadoLabel} {HOY.anio}
            </span>
            <div style={{ fontSize: 13, fontStyle: 'italic', color: pal.ink, ...serif }}>
              {selectedMesIdx === HOY.mesIndice ? 'Mes actual en curso' : selectedMesIdx < HOY.mesIndice ? 'Periodo histórico auditado' : 'Periodo futuro programado'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ fontSize: 12, display: 'flex', gap: 8 }}>
              <span style={{ color: pal.muted, ...mono }}>CCSS:</span>
              <span style={{ fontWeight: 600, color: pal.ink, ...num }}>{ccssEnfocado?.montoFull ? money(ccssEnfocado.montoFull) : 'Sin registro'}</span>
            </div>
            <div style={{ fontSize: 12, display: 'flex', gap: 8 }}>
              <span style={{ color: pal.muted, ...mono }}>INS RT:</span>
              <span style={{ fontWeight: 600, color: pal.ink, ...num }}>{insEnfocado?.montoFull ? money(insEnfocado.montoFull) : 'Al día'}</span>
            </div>
          </div>
        </div>

        {/* Riel de Métricas KPI del Año */}
        <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${pal.line2}`, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }} className="ed-grid-4">
          <div style={{ paddingRight: 16, borderRight: `1px solid ${pal.line2}` }}>
            <div style={{ ...mono, fontSize: 9 }}>Cuotas registradas</div>
            <div style={{ fontSize: 28, lineHeight: 1, marginTop: 4, ...num, ...serif }}>{pagadasRegistradas} pagadas</div>
            <div style={{ fontSize: 10.5, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>{pctAlDia}% de obligaciones al día</div>
          </div>

          <div style={{ paddingLeft: 14, paddingRight: 16, borderRight: `1px solid ${pal.line2}` }}>
            <div style={{ ...mono, fontSize: 9 }}>Vencidas hoy</div>
            <div style={{ fontSize: 28, lineHeight: 1, marginTop: 4, color: vencidasHoy > 0 ? pal.red : pal.deepGreen, ...num, ...serif }}>
              {vencidasHoy} {vencidasHoy === 1 ? 'vencida' : 'vencidas'}
            </div>
            <div style={{ fontSize: 10.5, fontStyle: 'italic', color: vencidasHoy > 0 ? pal.red : pal.deepGreen, marginTop: 4, ...serif }}>
              {vencidasHoy > 0 ? 'Atención inmediata requerida' : 'Sin recargos pendientes'}
            </div>
          </div>

          <div style={{ paddingLeft: 14, paddingRight: 16, borderRight: `1px solid ${pal.line2}` }}>
            <div style={{ ...mono, fontSize: 9 }}>Salud laboral 2026</div>
            <div style={{ fontSize: 28, lineHeight: 1, marginTop: 4, color: pal.deepGreen, ...num, ...serif }}>{pctAlDia}% al día</div>
            {/* Antes decía "Personal 100% asegurado" fijo, sin importar el
                `pctAlDia` real mostrado arriba — ahora usa el mismo número. */}
            <div style={{ fontSize: 10.5, fontStyle: 'italic', color: pal.deepGreen, marginTop: 4, ...serif }}>
              {pctAlDia >= 100 ? 'Obligaciones 100% al día' : `${pctAlDia}% de obligaciones al día`}
            </div>
          </div>

          <div style={{ paddingLeft: 14 }}>
            <div style={{ ...mono, fontSize: 9 }}>Volumen pagado registrado</div>
            <div style={{ fontSize: 28, lineHeight: 1, marginTop: 4, ...num, ...serif }}>{money(volumenPagadoReal)}</div>
            <div style={{ fontSize: 10.5, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>suma de cuotas marcadas como pagadas</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 05 — El archivo
   --------------------------------------------------------- */

function TarjetaComprobante({ icono, iconoBg, titulo, sub, montoFmt, fecha, conComprobante, onSelect }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <article
      onClick={onSelect}
      onMouseEnter={() => { if (hoverFino()) setIsHovered(true); }}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        padding: '22px 24px',
        background: isHovered ? 'rgba(255, 252, 245, 0.98)' : pal.paper,
        border: isHovered ? `1px solid ${pal.gold}` : `1px solid ${pal.line2}`,
        borderRadius: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        cursor: 'pointer',
        transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: isHovered ? '0 16px 36px -12px oklch(20% 0.02 30 / 0.18)' : '0 4px 12px -4px rgba(0,0,0,0.02)',
        transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div
          style={{
            position: 'relative',
            width: 38,
            height: 38,
            borderRadius: 12,
            background: iconoBg,
            color: pal.ink,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 700,
            boxShadow: '0 4px 12px -4px rgba(0,0,0,0.1)',
            ...serif,
          }}
        >
          {isHovered && (
            <svg style={{ position: 'absolute', inset: -3, width: 44, height: 44, pointerEvents: 'none', animation: 'ed-orbit-spin-cw 20s linear infinite' }} viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="20" fill="none" stroke={pal.gold} strokeWidth="1" strokeDasharray="2 4" opacity="0.75" />
            </svg>
          )}
          {icono}
        </div>
        {/* "Conciliado" afirmaba una conciliación bancaria que el sistema
            nunca hace. Lo que sí sabe es si el registro tiene un comprobante
            adjunto guardado — eso es lo que se muestra. */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 999,
            background: conComprobante ? 'rgba(242, 250, 245, 0.95)' : pal.cream2,
            border: `1px solid ${conComprobante ? pal.sage : pal.line}`,
            color: conComprobante ? pal.deepGreen : pal.muted,
            fontSize: 9.5,
            fontWeight: 700,
            ...mono,
          }}
        >
          {conComprobante && (
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
              <path d="M5 12l5 5 9-11" />
            </svg>
          )}
          {conComprobante ? 'CON COMPROBANTE' : 'SIN COMPROBANTE'}
        </span>
      </div>

      <div>
        <div style={{ fontSize: 19, lineHeight: 1.1, color: pal.ink, ...serif }}>{titulo}</div>
        <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted, marginTop: 3, ...serif }}>{sub}</div>
      </div>

      <div style={{ fontSize: 26, color: pal.ink, ...num, ...serif }}>{montoFmt}</div>

      <div style={{ paddingTop: 12, borderTop: `1px dashed ${pal.line2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10.5, color: pal.muted, ...mono }}>
        <span>{fecha}</span>
        <span style={{ color: isHovered ? pal.coral : pal.muted, textDecoration: isHovered ? 'underline' : 'none', fontWeight: isHovered ? 600 : 400, transition: 'all 150ms ease' }}>
          Ver recibo ↗
        </span>
      </div>
    </article>
  );
}

function ArchivoSection({ ccssHistorial, insHistorial, ccssArchivosPorMes, insArchivosPorMes, mesActualKey, onAdjuntarCcss, onAdjuntarIns }) {
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [voucheSeleccionado, setVoucherSeleccionado] = useState(null);
  const [avisoDescarga, setAvisoDescarga] = useState('');
  const adjuntarRef = useRef(null);
  // A qué obligación del mes actual se adjunta desde esta sección. La otra
  // vía de adjuntar (el dossier de CCSS/INS) sigue existiendo igual.
  const [adjuntarA, setAdjuntarA] = useState('ccss');

  // Comprobante real guardado para cada registro, buscado por su mes (la
  // misma clave que usa App.jsx). Antes esta sección no recibía los archivos,
  // así que decía "CONCILIADO" y ofrecía un "Descargar PDF" deshabilitado
  // aunque hubiera un adjunto real guardado.
  const archivoDe = (tipo, mesKey) =>
    (tipo === 'ccss' ? ccssArchivosPorMes : insArchivosPorMes)?.[mesKey]?.archivo || null;

  const items = [
    ...ccssHistorial.map((h) => ({ tipo: 'ccss', archivo: archivoDe('ccss', h.mesKey), ...h })),
    ...insHistorial.map((h) => ({ tipo: 'ins', archivo: archivoDe('ins', h.mesKey), ...h })),
  ];

  async function handleAdjuntar(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    const leido = await leerArchivoAdjunto(file);
    if (adjuntarA === 'ccss') onAdjuntarCcss(leido);
    else onAdjuntarIns(leido);
  }

  function descargarComprobante(item) {
    if (descargarAdjunto(item.archivo)) {
      setAvisoDescarga('');
      return;
    }
    setAvisoDescarga(
      item.archivo
        ? 'Ese comprobante se guardó solo con su nombre (el archivo era muy pesado para el almacenamiento del navegador).'
        : 'Este registro no tiene ningún comprobante adjunto todavía.',
    );
  }

  const itemsFiltrados = items.filter((item) => {
    if (filtroTipo === 'todos') return true;
    return item.tipo === filtroTipo;
  });

  return (
    <section style={{ position: 'relative', padding: '0 56px 56px' }}>
      {/* Resplandor de fondo */}
      <div
        style={{
          position: 'absolute',
          top: -20,
          left: '10%',
          width: '45%',
          height: '100%',
          background: 'radial-gradient(ellipse at 40% 40%, oklch(94% 0.03 65 / 0.3), transparent 70%)',
          filter: 'blur(28px)',
          animation: 'ed-aurora-2 13s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 28, alignItems: 'baseline', marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 6, fontSize: 10 }}>Sección 05 · el archivo</div>
          <div style={{ fontSize: 42, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            Los <em style={{ fontStyle: 'italic' }}>comprobantes</em> guardados
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {['todos', 'ccss', 'ins'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltroTipo(f)}
              style={{
                padding: '5px 12px',
                background: filtroTipo === f ? pal.ink : 'rgba(255, 253, 249, 0.9)',
                color: filtroTipo === f ? pal.cream : pal.ink,
                border: filtroTipo === f ? 'none' : `1px solid ${pal.line}`,
                borderRadius: 999,
                fontSize: 10.5,
                ...mono,
                cursor: 'pointer',
                fontWeight: filtroTipo === f ? 600 : 400,
                transition: 'all 150ms ease',
              }}
            >
              {f === 'todos' ? 'TODOS' : f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {itemsFiltrados.length === 0 && (
        <div style={{ marginBottom: 16, padding: '16px 20px', borderRadius: 14, background: pal.cream2, border: `1px solid ${pal.line}`, color: pal.muted, fontSize: 13 }}>
          Todavía no hay comprobantes de CCSS/INS registrados esta quincena.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }} className="ed-grid-archivo">
        {itemsFiltrados.map((h, i) => (
          <TarjetaComprobante
            key={`${h.tipo}-${h.periodo}-${i}`}
            icono={h.tipo === 'ccss' ? 'C' : 'I'}
            iconoBg={h.tipo === 'ccss' ? pal.gold : 'oklch(70% 0.12 320)'}
            titulo={h.tipo === 'ccss' ? `CCSS · ${h.periodo}` : `INS · ${h.periodo}`}
            sub={h.detalle}
            montoFmt={money(h.monto)}
            fecha={h.detalle}
            conComprobante={!!h.archivo}
            onSelect={() => setVoucherSeleccionado(h)}
          />
        ))}

        {/* Adjunta de verdad al mes activo, por la misma vía que el dossier
            de CCSS/INS (el archivo se guarda con su contenido real). Antes
            era una tarjeta deshabilitada aunque el flujo ya existiera. */}
        <article
          style={{
            position: 'relative',
            padding: '22px 24px',
            background: pal.cream2,
            border: `1.5px dashed ${pal.line}`,
            borderRadius: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <input ref={adjuntarRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleAdjuntar} style={{ display: 'none' }} />
          <div style={{ fontSize: 28, color: pal.muted2, lineHeight: 1, ...serif }}>↑</div>
          <div style={{ fontSize: 15, fontStyle: 'italic', color: pal.ink, fontWeight: 500, ...serif }}>
            Adjuntar nuevo comprobante
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['ccss', 'ins'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAdjuntarA(t)}
                style={{
                  padding: '4px 11px',
                  background: adjuntarA === t ? pal.ink : 'transparent',
                  color: adjuntarA === t ? pal.cream : pal.muted,
                  border: adjuntarA === t ? 'none' : `1px solid ${pal.line}`,
                  borderRadius: 999,
                  fontSize: 9.5,
                  ...mono,
                  cursor: 'pointer',
                }}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!mesActualKey}
            onClick={() => adjuntarRef.current?.click()}
            title={mesActualKey ? 'PDF o imagen' : 'No hay un período activo al que adjuntar'}
            style={{
              padding: '8px 16px',
              background: pal.paper,
              color: pal.ink,
              border: `1px solid ${pal.line}`,
              borderRadius: 10,
              fontSize: 11.5,
              cursor: mesActualKey ? 'pointer' : 'not-allowed',
              opacity: mesActualKey ? 1 : 0.5,
            }}
          >
            Elegir archivo…
          </button>
        </article>
      </div>

      {avisoDescarga && (
        <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 12, background: pal.cream2, border: `1px solid ${pal.line}`, color: pal.muted, fontSize: 12.5 }}>
          {avisoDescarga}
        </div>
      )}

      {/* Modal de Vista Previa de Recibo si se selecciona una tarjeta.
          Va montado en <body> con `createPortal`: dentro de la pantalla, su
          `position: fixed` medía contra el contenedor `.screen` (que queda
          transformado por su animación de entrada) en vez de contra la
          ventana, así que el modal aparecía fuera de la vista — ver la nota
          en components/ui/Modal.jsx. */}
      {voucheSeleccionado &&
        createPortal(
        <div
          onClick={() => setVoucherSeleccionado(null)}
          style={{
            position: 'fixed',
            inset: 0,
            // Antes decía `rgba(25% 0.02 30 / 0.5)`: mezcla la sintaxis de
            // rgba() con valores de oklch, así que el navegador descartaba la
            // declaración entera y el fondo quedaba transparente.
            background: 'oklch(25% 0.02 30 / 0.5)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 480,
              background: pal.paper,
              borderRadius: 24,
              padding: '32px 36px',
              boxShadow: '0 30px 60px -20px rgba(0,0,0,0.3)',
              border: `1px solid ${pal.gold}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <span style={{ ...mono, fontSize: 9, color: pal.muted }}>COMPROBANTE REGISTRADO</span>
                <div style={{ fontSize: 26, ...serif, color: pal.ink, marginTop: 2 }}>
                  {voucheSeleccionado.tipo === 'ccss' ? 'CCSS Seguro Social' : 'INS Riesgos del Trabajo'}
                </div>
                <div style={{ fontSize: 13, fontStyle: 'italic', color: pal.muted, ...serif }}>{voucheSeleccionado.periodo}</div>
              </div>
              <button
                type="button"
                onClick={() => setVoucherSeleccionado(null)}
                style={{ background: pal.cream2, border: `1px solid ${pal.line}`, borderRadius: 999, width: 32, height: 32, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px', background: pal.cream2, borderRadius: 16, border: `1px solid ${pal.line2}`, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ ...mono, fontSize: 9.5 }}>Monto registrado:</span>
                <span style={{ fontSize: 18, fontWeight: 700, ...num, ...serif }}>{money(voucheSeleccionado.monto)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ ...mono, fontSize: 9.5 }}>Estado:</span>
                <span style={{ color: pal.deepGreen, fontWeight: 600, fontSize: 11, ...mono }}>
                  ✓ {voucheSeleccionado.tipo === 'ccss' ? 'PAGADO' : 'REGULARIZADO'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ ...mono, fontSize: 9.5 }}>Comprobante:</span>
                <span style={{ fontSize: 10, ...mono, color: pal.muted, fontStyle: voucheSeleccionado.archivo ? 'normal' : 'italic' }}>
                  {voucheSeleccionado.archivo ? voucheSeleccionado.archivo.name : 'Sin adjuntar'}
                </span>
              </div>
              {/* Fecha y método reales del registro (ver `marcarCcssPagada`/
                  `regularizarIns` en App.jsx) — registros hechos antes de que
                  existieran estos campos no los tienen, y lo dicen así en vez
                  de inventarlos. */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ ...mono, fontSize: 9.5 }}>Fecha de pago:</span>
                <span style={{ fontSize: 10, ...mono, color: pal.muted, fontStyle: voucheSeleccionado.fechaPago ? 'normal' : 'italic' }}>
                  {voucheSeleccionado.fechaPago || 'No registrada'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ ...mono, fontSize: 9.5 }}>Método:</span>
                <span style={{ fontSize: 10, ...mono, color: pal.muted, fontStyle: voucheSeleccionado.metodo ? 'normal' : 'italic' }}>
                  {voucheSeleccionado.metodo || 'No registrado'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ ...mono, fontSize: 9.5 }}>Referencia:</span>
                <span style={{ fontSize: 10, ...mono, color: pal.muted, fontStyle: voucheSeleccionado.referencia ? 'normal' : 'italic' }}>
                  {voucheSeleccionado.referencia || 'No registrada'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              {/* Descarga el comprobante real adjunto tal cual se guardó
                  (PDF o imagen). Sin adjunto, lo dice en vez de fingir. */}
              <button
                type="button"
                onClick={() => descargarComprobante(voucheSeleccionado)}
                disabled={!voucheSeleccionado.archivo?.dataUrl}
                title={voucheSeleccionado.archivo?.dataUrl ? voucheSeleccionado.archivo.name : 'Sin comprobante adjunto'}
                style={{ flex: 1, padding: '12px 16px', background: pal.cream2, color: voucheSeleccionado.archivo?.dataUrl ? pal.ink : pal.muted, border: `1px solid ${pal.line}`, borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: voucheSeleccionado.archivo?.dataUrl ? 'pointer' : 'not-allowed', opacity: voucheSeleccionado.archivo?.dataUrl ? 1 : 0.65, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
              >
                <span>{voucheSeleccionado.archivo?.dataUrl ? 'Descargar comprobante' : 'Sin comprobante adjunto'}</span>
                <span>↗</span>
              </button>
              <button
                type="button"
                onClick={() => setVoucherSeleccionado(null)}
                style={{ padding: '12px 16px', background: pal.paper, color: pal.ink, border: `1px solid ${pal.line}`, borderRadius: 12, fontSize: 12, cursor: 'pointer' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 06 — El cierre (Aurora Command Closure)
   --------------------------------------------------------- */

function CierreSection({ obligaciones, atender, onAtender, onNavigate }) {
  const alDia = obligaciones.filter((o) => o.k === 'aldia' || o.k === 'pagado').length;
  const vencidas = obligaciones.filter((o) => o.k === 'vencido').length;
  const principal = atender[0];
  const total = obligaciones.length || 1;
  const pct = Math.round((alDia / total) * 100);

  return (
    <section style={{ position: 'relative', padding: '0 56px 88px' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(160deg, oklch(92% 0.06 145) 0%, oklch(90% 0.07 200) 50%, oklch(88% 0.08 260) 100%)', borderRadius: 32, padding: '52px 60px', overflow: 'hidden', boxShadow: '0 30px 60px -25px oklch(30% 0.06 200 / 0.25)' }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-30%', right: '-15%', width: '60%', height: '120%', background: 'radial-gradient(circle, oklch(88% 0.10 200 / 0.45), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora 11s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '-40%', left: '-10%', width: '50%', height: '100%', background: 'radial-gradient(circle, oklch(85% 0.12 145 / 0.32), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora-2 13s ease-in-out infinite' }} />
        </div>

        <div className="ed-grid-2" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '8fr 4fr', gap: 52, alignItems: 'start' }}>
          <div>
            <div style={{ ...mono, color: 'oklch(28% 0.08 200)', marginBottom: 16, fontSize: 10 }}>Cierre · el estado hoy</div>
            <div style={{ fontSize: 62, lineHeight: 1.02, letterSpacing: '-0.02em', color: pal.ink, marginBottom: 18, ...serif }}>
              {alDia} {alDia === 1 ? 'obligación' : 'obligaciones'} <em style={{ fontStyle: 'italic' }}>al día</em>,<br />
              {vencidas} <em style={{ fontStyle: 'italic', textDecoration: 'underline', textDecorationColor: pal.coral, textDecorationThickness: 2, textUnderlineOffset: 6 }}>{vencidas === 1 ? 'vencida' : 'vencidas'}</em>.
            </div>
            <p style={{ fontSize: 18, fontStyle: 'italic', lineHeight: 1.5, color: 'oklch(30% 0.06 200)', maxWidth: 620, margin: '0 0 26px', ...serif }}>
              {vencidas > 0
                ? `Tenés ${vencidas} obligación${vencidas === 1 ? '' : 'es'} vencida${vencidas === 1 ? '' : 's'} — resolverla${vencidas === 1 ? '' : 's'} evita recargos.`
                : principal
                  ? /^sin /i.test(principal.fecha)
                    ? `Llevás el ${HOY.anio} sin obligaciones vencidas. ${principal.t} es lo próximo — todavía sin fecha configurada.`
                    : `Llevás el ${HOY.anio} sin obligaciones vencidas. ${principal.t} es lo próximo — atendela antes de ${principal.fecha.toLowerCase()}.`
                  : `Llevás el ${HOY.anio} sin obligaciones vencidas ni próximas por ahora.`}
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {principal && (
                <button
                  type="button"
                  onClick={() => onAtender(principal.target)}
                  style={{
                    padding: '14px 24px',
                    background: pal.ink,
                    color: pal.cream,
                    border: 'none',
                    borderRadius: 14,
                    fontWeight: 600,
                    fontSize: 13.5,
                    cursor: 'pointer',
                    boxShadow: '0 10px 22px -6px oklch(20% 0.02 30 / 0.35)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 40%, oklch(100% 0 0 / 0.15) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'ed-shine-sweep 4s ease-in-out infinite' }} />
                  <span style={{ position: 'relative' }}>Atender {NOMBRE_TARGET[principal.target] || principal.t} · {principal.montoFmt}</span>
                </button>
              )}
              {/* Los recordatorios de esta pantalla son los días de
                  vencimiento de CCSS e INS, que sí se configuran de verdad
                  en Configuración y de ahí salen los estados y las marcas
                  del calendario. */}
              <button
                type="button"
                onClick={() => onNavigate('configuracion')}
                style={{ padding: '14px 22px', background: 'rgba(255, 253, 249, 0.7)', color: pal.ink, border: `1px solid ${pal.line}`, borderRadius: 14, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}
              >
                Configurar recordatorios
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', padding: '26px 28px', background: 'rgba(255, 253, 249, 0.75)', border: `1px solid ${pal.line}`, borderRadius: 22, boxShadow: '0 12px 28px -10px rgba(0,0,0,0.05)' }}>
            <div style={{ ...mono, color: 'oklch(28% 0.08 200)', marginBottom: 12, fontSize: 9.5 }}>LO QUE SIGUE EN COLA</div>
            {atender.length === 0 ? (
              <div style={{ fontSize: 14, fontStyle: 'italic', color: pal.muted, ...serif }}>Nada en cola por ahora.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {atender.slice(0, 3).map((o) => (
                  <div key={o.t} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '7px 0', borderBottom: `1px dotted ${pal.line2}` }}>
                    <span style={{ color: pal.ink, fontWeight: 500 }}>{o.t}</span>
                    <span style={{ ...num, fontWeight: 600, color: pal.ink }}>{o.montoFmt}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${pal.line2}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: pal.muted }}>Obligaciones al día</span>
                <span style={{ fontSize: 12, color: pal.ink, fontWeight: 700, ...num }}>{pct}%</span>
              </div>
              <div style={{ height: 7, background: 'rgba(0,0,0,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${pal.sage}, ${pal.gold})`, borderRadius: 999, transformOrigin: 'left', animation: 'ed-bar-grow-x 1.4s cubic-bezier(.16,1,.3,1) both' }} />
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${pal.line2}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: pal.ink, color: pal.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, ...serif }}>◐</div>
              <div style={{ fontSize: 13.5, fontStyle: 'italic', color: pal.ink, lineHeight: 1.35, ...serif }}>"Al día se cumple mejor."</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Footer + Dock
   --------------------------------------------------------- */

function Footer({ obligaciones }) {
  const alDia = obligaciones.filter((o) => o.k === 'aldia' || o.k === 'pagado').length;
  return (
    <footer style={{ padding: '20px 56px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: pal.muted, borderTop: `1px solid ${pal.line}`, flexWrap: 'wrap', gap: 10 }}>
      <span>
        Obligaciones · {MESES_LARGO[HOY.mesIndice]} {HOY.anio} · {alDia} al día
      </span>
      <span style={{ fontStyle: 'italic', fontSize: 14, textTransform: 'none', letterSpacing: 0, color: 'oklch(35% 0.03 30)', ...serif }}>
        Cumplir a tiempo es libertad.
      </span>
      <span>© {HOY.anio} · Gestión Laboral</span>
    </footer>
  );
}

function Dock({ onIrAlMuro, principal, onAtender, onNavigate }) {
  return (
    <div style={{ position: 'sticky', bottom: 20, margin: '-36px auto 0', width: 'fit-content', display: 'flex', justifyContent: 'center', zIndex: 20 }}>
      <div className="ed-dock" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: pal.ink, color: pal.cream, padding: '8px 8px 8px 20px', borderRadius: 999, boxShadow: '0 24px 60px -20px oklch(20% 0.02 30 / 0.5)' }}>
        <span style={{ ...mono, color: 'oklch(70% 0.02 60)', fontSize: 10 }}>Obligaciones</span>
        <span style={{ width: 1, height: 16, background: 'oklch(40% 0.02 30)', margin: '0 6px' }} />
        <button type="button" onClick={onIrAlMuro} style={{ padding: '9px 16px', background: 'transparent', color: 'oklch(88% 0.03 60)', border: 'none', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
          Ver año
        </button>
        <button
          type="button"
          onClick={() => onNavigate('configuracion')}
          style={{ padding: '9px 16px', background: 'transparent', color: 'oklch(88% 0.03 60)', border: 'none', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}
        >
          Recordatorios
        </button>
        {principal && (
          <button type="button" onClick={() => onAtender(principal.target)} style={{ padding: '9px 18px', background: pal.gold, color: pal.ink, border: 'none', borderRadius: 999, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            Atender {NOMBRE_TARGET[principal.target] || principal.t}
          </button>
        )}
      </div>
    </div>
  );
}

const OBLIGACIONES_SECTIONS = [
  { key: 'hero', label: 'Resumen' },
  { key: 'pista', label: 'Pista' },
  { key: 'dossier', label: 'Dossier' },
  { key: 'muro', label: 'Muro' },
  { key: 'archivo', label: 'Archivo' },
  { key: 'cierre', label: 'Cierre' },
];

export default function Calendario({
  semanas,
  eventos,
  mesLabel,
  obligaciones,
  atender,
  empsActivos,
  totales,
  tasas,
  poliza,
  actividad,
  ccssEstado,
  insEstado,
  ccssCuota,
  ccssHistorial,
  insHistorial,
  periodoActivo,
  notificaciones,
  onNotifClick,
  onAdjuntarCcss,
  onMarcarCcssPagada,
  onAdjuntarIns,
  onRegularizarIns,
  onPrevMes,
  onNextMes,
  onEventoClick,
  onNavigate,
  dossierInicial,
  onDossierAbierto,
  usuario,
  ccssPagoDelMes,
  insPagoDelMes,
  ccssArchivosPorMes,
  insArchivosPorMes,
  mesActualKey,
  metodosPago,
}) {
  const sectionRefs = useRef({});
  const setSectionRef = (key) => (el) => {
    sectionRefs.current[key] = el;
  };

  // Estado real (pendiente/próximo/vencido) de cada obligación mensual, para
  // que el dossier muestre exactamente lo mismo que el resto de la pantalla.
  const kCcss = obligaciones.find((o) => o.target === 'ccss')?.k;
  const kIns = obligaciones.find((o) => o.target === 'ins')?.k;

  // Qué obligación está abierta en el dossier real (§03) — CCSS o INS se resuelven
  // acá mismo, sin salir de Obligaciones (antes "Atender" usaba el target de la
  // obligación como pantalla, y 'ccss'/'ins' son también claves de rutas viejas).
  const [dossierTab, setDossierTab] = useState('ccss');

  function irAlMuro() {
    const el = document.getElementById('obligaciones-muro');
    const scrollEl = document.getElementById('app-content');
    if (!el || !scrollEl) return;
    scrollEl.scrollTo({ top: Math.max(0, el.offsetTop - 24), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  function irAlDossier(tab) {
    setDossierTab(tab);
    const el = document.getElementById('ob-sec-dossier');
    const scrollEl = document.getElementById('app-content');
    if (!el || !scrollEl) return;
    scrollEl.scrollTo({ top: Math.max(0, el.offsetTop - 24), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  /** "Atender X": si es CCSS o INS, se resuelve en el dossier de esta misma pantalla;
   *  cualquier otro destino (p. ej. pagos) sigue siendo una navegación real. */
  function handleAtender(target) {
    if (target === 'ccss' || target === 'ins') irAlDossier(target);
    else onNavigate(target);
  }

  // Si se entró desde fuera (p. ej. el Home) pidiendo abrir un dossier
  // concreto, se abre igual que "Atender X" — mismo mecanismo, sin duplicar
  // lógica — y se avisa al padre para no reabrirlo en visitas normales.
  useEffect(() => {
    if (dossierInicial === 'ccss' || dossierInicial === 'ins') {
      irAlDossier(dossierInicial);
      onDossierAbierto?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossierInicial]);

  return (
    <div className="screen ed-home" style={{ fontFamily: "'Albert Sans', system-ui, sans-serif", color: pal.ink, background: pal.cream, minHeight: '100%' }}>
      <ScrollRail sectionRefs={sectionRefs} sections={OBLIGACIONES_SECTIONS} />

      <div style={{ maxWidth: 1440, margin: '0 auto', position: 'relative' }}>
        <Masthead atender={atender} onNavigate={onNavigate} usuario={usuario} notificaciones={notificaciones} onNotifClick={onNotifClick} />
        <StatusBar obligaciones={obligaciones} usuario={usuario} />

        <div id="ob-sec-hero" ref={setSectionRef('hero')}>
          <Seccion01Hero
            atender={atender}
            obligaciones={obligaciones}
            semanas={semanas}
            eventos={eventos}
            mesLabel={mesLabel}
            onPrevMes={onPrevMes}
            onNextMes={onNextMes}
            onEventoClick={onEventoClick}
            onNavigate={onNavigate}
            onAtender={handleAtender}
            onIrAlMuro={irAlMuro}
          />
        </div>

        <div id="ob-sec-pista" ref={setSectionRef('pista')}>
          <PistaSection atender={atender} onAtender={handleAtender} />
        </div>

        <div id="ob-sec-dossier" ref={setSectionRef('dossier')}>
          <DossierSection
            tab={dossierTab}
            onTabChange={setDossierTab}
            ccssEstado={ccssEstado}
            insEstado={insEstado}
            ccssPagoDelMes={ccssPagoDelMes}
            insPagoDelMes={insPagoDelMes}
            kCcss={kCcss}
            kIns={kIns}
            onAdjuntarCcss={onAdjuntarCcss}
            onMarcarCcssPagada={onMarcarCcssPagada}
            onAdjuntarIns={onAdjuntarIns}
            onRegularizarIns={onRegularizarIns}
            empsActivos={empsActivos}
            tasas={tasas}
            poliza={poliza}
            actividad={actividad}
            ccssCuota={ccssCuota}
            periodoActivo={periodoActivo}
            totales={totales}
            atender={atender}
            metodos={metodosPago}
            onNavigate={onNavigate}
          />
        </div>

        <div id="obligaciones-muro" ref={setSectionRef('muro')}>
          <MuroSection obligaciones={obligaciones} atender={atender} ccssHistorial={ccssHistorial} insHistorial={insHistorial} ccssCuota={ccssCuota} />
        </div>

        <div id="ob-sec-archivo" ref={setSectionRef('archivo')}>
          <ArchivoSection
            ccssHistorial={ccssHistorial}
            insHistorial={insHistorial}
            ccssArchivosPorMes={ccssArchivosPorMes}
            insArchivosPorMes={insArchivosPorMes}
            mesActualKey={mesActualKey}
            onAdjuntarCcss={onAdjuntarCcss}
            onAdjuntarIns={onAdjuntarIns}
          />
        </div>

        <div id="ob-sec-cierre" ref={setSectionRef('cierre')}>
          <CierreSection obligaciones={obligaciones} atender={atender} onAtender={handleAtender} onNavigate={onNavigate} />
        </div>

        <Footer obligaciones={obligaciones} />
      </div>

      <Dock onIrAlMuro={irAlMuro} principal={atender[0]} onAtender={handleAtender} onNavigate={onNavigate} />
    </div>
  );
}
