import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import { HOY } from '../data/mock.js';
import { descargarCsv, descargarBlob, sufijoFecha } from '../lib/export.js';
import { money } from '../lib/format.js';
import { IconSearch, IconChevronRight } from '../components/ui/Icons.jsx';
import { Modal, ConfirmDialog } from '../components/ui/Modal.jsx';
import { NotificacionesPanel } from '../components/ui/NotificacionesPanel.jsx';
import EmpleadoForm from '../components/EmpleadoForm.jsx';
import ScrollRail, { LotusFlower } from '../components/ScrollRail.jsx';

/**
 * Equipo (Empleados) — "seis nombres, seis historias". Mismo lenguaje
 * editorial que Home/Planilla/Pagos (paleta cream/coral/gold, Instrument
 * Serif + JetBrains Mono, motion `ed-*`), composición propia en 6 secciones
 * tomada de `Equipo.dc.html`.
 *
 * Los datos y acciones son los que ya existían (`emps`, `selEmp`, `onSelect`,
 * `onCrear`, `onEditar`, `onAlternarActivo`, `getHistorial`): esto es solo
 * una nueva presentación. Donde la referencia mostraba un dato que no existe
 * en el modelo real (cumpleaños, dirección, contacto de emergencia, historial
 * de ajustes multi-mes, rotación a 12 meses, vacaciones…) se sustituyó por el
 * equivalente real más cercano o por un estado vacío honesto — nunca por un
 * valor inventado.
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
  blush: 'oklch(88% 0.06 20)',
  lilac: 'oklch(82% 0.06 320)',
  sage: 'oklch(72% 0.12 145)',
  gold: 'oklch(85% 0.14 75)',
  sky: 'oklch(80% 0.09 220)',
  deepGreen: 'oklch(38% 0.11 145)',
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

const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const NUM_PALABRA = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];

/** "Doce" o, sin palabra para ese número (>10), el numeral tal cual — nunca "undefinedundefined". */
function numeroCapitalizado(n) {
  const palabra = NUM_PALABRA[n];
  return palabra ? palabra.charAt(0).toUpperCase() + palabra.slice(1) : String(n);
}

function fechaLarga(hoy) {
  const weekday = new Date(hoy.anio, hoy.mesIndice, hoy.dia).toLocaleDateString('es-CR', { weekday: 'long' });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap} · ${String(hoy.dia).padStart(2, '0')} ${MESES_LARGO[hoy.mesIndice]} ${hoy.anio}`;
}

/** "12 mar 2021" → {dia, mesIndice, anio}. Único formato que usa `ingreso` en mock.js. */
function parseFecha(str) {
  const m = /(\d{1,2})\s+([a-záéíóú]{3})\s+(\d{4})/i.exec(str || '');
  if (!m) return null;
  const mesIndice = MESES_ABR.indexOf(m[2].toLowerCase());
  if (mesIndice < 0) return null;
  return { dia: parseInt(m[1], 10), mesIndice, anio: parseInt(m[3], 10) };
}

/** Antigüedad exacta en años y meses a partir de la fecha de ingreso real. */
function antiguedad(ingresoObj, hoy) {
  let anios = hoy.anio - ingresoObj.anio;
  let meses = hoy.mesIndice - ingresoObj.mesIndice;
  if (hoy.dia < ingresoObj.dia) meses -= 1;
  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }
  return { anios, meses: Math.max(0, meses), totalMeses: anios * 12 + Math.max(0, meses) };
}

function antiguedadFmt({ anios, meses }) {
  if (anios <= 0) return meses <= 1 ? `${meses} mes` : `${meses} meses`;
  const partA = anios === 1 ? '1 año' : `${anios} años`;
  if (meses === 0) return partA;
  return `${partA} ${meses === 1 ? '1 mes' : `${meses} meses`}`;
}

/** Días hasta el próximo aniversario laboral (mismo día/mes de `ingreso`, real). */
function proximoAniversario(ingresoObj, hoy) {
  const hoyDate = new Date(hoy.anio, hoy.mesIndice, hoy.dia);
  let aniv = new Date(hoy.anio, ingresoObj.mesIndice, ingresoObj.dia);
  let aniosCumplidos = hoy.anio - ingresoObj.anio;
  if (aniv < hoyDate) {
    aniv = new Date(hoy.anio + 1, ingresoObj.mesIndice, ingresoObj.dia);
    aniosCumplidos += 1;
  }
  const dias = Math.round((aniv - hoyDate) / 86400000);
  const weekday = aniv.toLocaleDateString('es-CR', { weekday: 'long' });
  return { dias, anios: aniosCumplidos, fecha: aniv, weekday };
}

/** Mismo criterio que Pagos: el "canal" real de un empleado es su cuenta (`banco`). */
function canalDe(banco) {
  return (banco || '').split('·')[0].trim() || 'Sin canal';
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

/** Paleta de acento por posición (cosmética, no vinculada a ningún dato personal). */
const ACENTOS = [
  { g1: pal.peach, g2: pal.coral, ink: 'oklch(25% 0.08 30)' },
  { g1: pal.sky, g2: 'oklch(60% 0.14 220)', ink: 'oklch(25% 0.05 220)' },
  { g1: pal.lilac, g2: 'oklch(65% 0.14 300)', ink: 'oklch(25% 0.08 310)' },
  { g1: 'oklch(85% 0.11 100)', g2: 'oklch(75% 0.13 90)', ink: 'oklch(25% 0.10 95)' },
  { g1: 'oklch(80% 0.10 20)', g2: 'oklch(72% 0.13 10)', ink: 'oklch(25% 0.08 20)' },
  { g1: 'oklch(78% 0.10 240)', g2: 'oklch(70% 0.13 260)', ink: 'oklch(25% 0.09 250)' },
];

function acentoDe(i) {
  return ACENTOS[i % ACENTOS.length];
}

/* ---------------------------------------------------------
   Masthead + barra de estado
   --------------------------------------------------------- */

function Masthead({ empsActivos, onNavigate, busqueda, onBusquedaChange, filtroEstado, onFiltroEstadoChange, usuario, notificaciones, onNotifClick }) {
  const completo = empsActivos.filter((e) => e.tipo === 'Tiempo completo').length;
  const medio = empsActivos.length - completo;

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
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, minWidth: 0, flexShrink: 0 }}>
            <span style={{ fontSize: 22, fontStyle: 'italic', letterSpacing: '-0.01em', whiteSpace: 'nowrap', ...serif }}>Gestión Laboral</span>
            <span style={{ ...mono, fontSize: 9, whiteSpace: 'nowrap' }}>Espacio de {usuario.nombre.split(' ')[0]}</span>
          </div>
          <span
            style={{
              marginLeft: 8,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: '0.16em',
              color: pal.muted,
              padding: '4px 9px',
              border: `1px solid ${pal.line}`,
              borderRadius: 999,
              whiteSpace: 'nowrap',
            }}
          >
            {empsActivos.length} ACTIVOS
          </span>
        </div>

        <nav className="ed-masthead-nav" style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 13 }}>
          {NAV_ITEMS.map((item) => {
            const active = item.key === 'empleados';
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
            <input
              value={busqueda}
              onChange={(e) => onBusquedaChange(e.target.value)}
              placeholder="Buscar persona o cédula"
              aria-label="Buscar por nombre o cédula"
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: pal.ink, fontFamily: 'inherit', minWidth: 0 }}
            />
          </div>
          <div style={{ display: 'inline-flex', padding: 3, background: pal.cream2, border: `1px solid ${pal.line}`, borderRadius: 10, fontSize: 12, flexShrink: 0 }}>
            {[
              { k: 'activos', l: 'Activos' },
              { k: 'inactivos', l: 'Inactivos' },
              { k: 'todos', l: 'Todos' },
            ].map((f) => (
              <button
                key={f.k}
                type="button"
                onClick={() => onFiltroEstadoChange(f.k)}
                style={{ padding: '5px 10px', border: 'none', background: filtroEstado === f.k ? pal.ink : 'transparent', color: filtroEstado === f.k ? pal.cream : pal.muted, borderRadius: 7, cursor: 'pointer', fontWeight: filtroEstado === f.k ? 600 : 400, whiteSpace: 'nowrap' }}
              >
                {f.l}
              </button>
            ))}
          </div>
          <NotificacionesPanel notificaciones={notificaciones} onNotifClick={onNotifClick} />
          <div style={{ width: 36, height: 36, borderRadius: 999, background: `linear-gradient(135deg, ${pal.peach}, ${pal.coral})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pal.ink, fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
            {usuario.iniciales}
          </div>
        </div>
      </header>

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
          <span style={{ color: pal.deepGreen }}>● {empsActivos.length} activos</span>
          <span style={{ color: 'oklch(50% 0.13 65)' }}>● {completo} tiempo completo</span>
          <span style={{ color: pal.muted }}>● {medio} medio tiempo</span>
        </span>
        <span>{usuario.rol}</span>
      </div>
    </>
  );
}

/* ---------------------------------------------------------
   Sección 01 — Hero: seis nombres, seis historias
   --------------------------------------------------------- */

function Constelacion({ empsActivos }) {
  const [hoveredId, setHoveredId] = useState(null);
  const team = empsActivos.slice(0, 6);

  // Posiciones elípticas fijas (x, y) relativas al contenedor 560x440
  // Duraciones asíncronas sin delay para una flotación líquida y 100% continua sin saltos robóticos.
  const nodeConfig = [
    { cx: 370, cy: 110, tagPos: 'top', dur: 6.0 },
    { cx: 380, cy: 280, tagPos: 'bottom', dur: 6.8 },
    { cx: 250, cy: 370, tagPos: 'bottom', dur: 7.4 },
    { cx: 130, cy: 280, tagPos: 'bottom', dur: 8.2 },
    { cx: 140, cy: 110, tagPos: 'top', dur: 6.5 },
    { cx: 250, cy: 55,  tagPos: 'top', dur: 7.6 },
  ];

  const centerPoint = { x: 250, y: 215 };

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        right: 16,
        width: 560,
        height: 440,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {/* Estilos CSS locales para las órbitas y la flotación fluida sin saltos */}
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
          50% { transform: translate(-50%, -50%) translateY(-7px) scale(1.025); }
        }
        @keyframes ed-core-breathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); filter: drop-shadow(0 0 10px oklch(85% 0.14 75 / 0.4)); }
          50% { transform: translate(-50%, -50%) scale(1.08); filter: drop-shadow(0 0 22px oklch(70% 0.16 30 / 0.65)); }
        }
      `}</style>

      {/* 1. Fondo Aurora Ambiental Bioluminiscente */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 45%, oklch(90% 0.08 60 / 0.35), transparent 60%), radial-gradient(circle at 75% 30%, oklch(85% 0.10 320 / 0.22), transparent 50%), radial-gradient(circle at 25% 70%, oklch(88% 0.10 145 / 0.20), transparent 50%)',
          filter: 'blur(10px)',
          animation: 'ed-aurora 14s ease-in-out infinite',
        }}
      />

      {/* 2. Capa SVG de filamentos, órbitas rotativas y constelaciones */}
      <svg
        width="560"
        height="440"
        viewBox="0 0 560 440"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="ed-constellation-line-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(85% 0.14 75)" stopOpacity="0.45" />
            <stop offset="50%" stopColor="oklch(70% 0.16 30)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="oklch(82% 0.06 320)" stopOpacity="0.45" />
          </linearGradient>

          <radialGradient id="ed-core-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(85% 0.14 75)" stopOpacity="0.35" />
            <stop offset="60%" stopColor="oklch(70% 0.16 30)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="oklch(96% 0.015 60)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Resplandor central del núcleo */}
        <circle cx={centerPoint.x} cy={centerPoint.y} r="140" fill="url(#ed-core-halo)" />

        {/* Anillo de órbita exterior rotativo */}
        <g style={{ transformOrigin: `${centerPoint.x}px ${centerPoint.y}px`, animation: 'ed-orbit-spin-cw 80s linear infinite' }}>
          <ellipse
            cx={centerPoint.x}
            cy={centerPoint.y}
            rx="160"
            ry="135"
            fill="none"
            stroke="oklch(85% 0.015 55)"
            strokeWidth="1.2"
            strokeDasharray="4 8"
            opacity="0.55"
          />
          {/* Pequeños asteriscos decorativos en la órbita */}
          <circle cx={centerPoint.x + 160} cy={centerPoint.y} r="2.5" fill={pal.gold} />
          <circle cx={centerPoint.x - 160} cy={centerPoint.y} r="2.5" fill={pal.coral} />
          <circle cx={centerPoint.x} cy={centerPoint.y - 135} r="2" fill={pal.lilac} />
        </g>

        {/* Anillo de órbita interior rotativo en sentido contrario */}
        <g style={{ transformOrigin: `${centerPoint.x}px ${centerPoint.y}px`, animation: 'ed-orbit-spin-ccw 60s linear infinite' }}>
          <ellipse
            cx={centerPoint.x}
            cy={centerPoint.y}
            rx="110"
            ry="85"
            fill="none"
            stroke="oklch(70% 0.16 30)"
            strokeWidth="0.8"
            strokeDasharray="2 6"
            opacity="0.35"
          />
        </g>

        {/* Filamentos conectores de la constelación entre el núcleo y los nodos */}
        {team.map((e, idx) => {
          const cfg = nodeConfig[idx] || nodeConfig[0];
          const isHovered = hoveredId === e.id;
          return (
            <g key={`line-${e.id}`}>
              <line
                x1={centerPoint.x}
                y1={centerPoint.y}
                x2={cfg.cx}
                y2={cfg.cy}
                stroke="url(#ed-constellation-line-grad)"
                strokeWidth={isHovered ? 2 : 1}
                strokeDasharray={isHovered ? 'none' : '3 5'}
                opacity={isHovered ? 0.9 : 0.4}
                style={{ transition: 'all 300ms ease' }}
              />
            </g>
          );
        })}
      </svg>

      {/* 3. Núcleo Central: Dije de Loto Flor Damaris */}
      <div
        style={{
          position: 'absolute',
          left: centerPoint.x,
          top: centerPoint.y,
          width: 52,
          height: 52,
          borderRadius: 999,
          background: 'rgba(255, 249, 242, 0.92)',
          border: `1.5px solid ${pal.gold}`,
          boxShadow: '0 6px 20px -4px oklch(75% 0.13 60 / 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'ed-core-breathe 4s ease-in-out infinite',
          zIndex: 4,
          pointerEvents: 'auto',
          cursor: 'pointer',
          willChange: 'transform',
        }}
        title="Flor Damaris · Núcleo del Equipo"
      >
        <div style={{ width: 34, height: 25, transform: 'translateY(1px)' }}>
          <LotusFlower progress={0.65} />
        </div>
      </div>

      {/* 4. Nodos de Empleados (Medallones flotantes con etiquetas de texto legibles centradas) */}
      {team.map((e, idx) => {
        const cfg = nodeConfig[idx] || nodeConfig[0];
        const ac = acentoDe(idx);
        const primerNombre = e.nombre.split(' ')[0];
        const fechaIngreso = (e.ingreso || '').split(' ').slice(1).join(' ');
        const isHovered = hoveredId === e.id;
        const isTop = cfg.tagPos === 'top';

        return (
          <div
            key={e.id}
            onMouseEnter={() => { if (hoverFino()) setHoveredId(e.id); }}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              position: 'absolute',
              left: cfg.cx,
              top: cfg.cy,
              animation: `ed-node-pulse ${cfg.dur}s ease-in-out infinite`,
              willChange: 'transform',
              pointerEvents: 'auto',
              cursor: 'pointer',
              zIndex: isHovered ? 10 : 5,
            }}
          >
            {/* Medallón de Iniciales */}
            <div
              style={{
                width: isHovered ? 54 : 48,
                height: isHovered ? 54 : 48,
                borderRadius: 999,
                background: `linear-gradient(135deg, ${ac.g1}, ${ac.g2})`,
                border: `1.5px solid ${isHovered ? pal.coral : pal.gold}`,
                boxShadow: isHovered
                  ? '0 10px 28px -4px oklch(70% 0.16 30 / 0.45)'
                  : '0 6px 18px -4px rgba(0,0,0,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontStyle: 'italic',
                fontSize: 21,
                color: ac.ink,
                transition: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)',
                userSelect: 'none',
                ...serif,
              }}
            >
              {e.ini}
            </div>

            {/* Etiqueta Editorial Flotante Elegante Centrada (Sin Solapamiento ni recortes) */}
            <div
              style={{
                position: 'absolute',
                top: isTop ? -34 : 34,
                left: '50%',
                transform: 'translateX(-50%)',
                background: isHovered
                  ? pal.ink
                  : 'rgba(255, 252, 248, 0.96)',
                color: isHovered ? pal.cream : pal.ink,
                padding: '4px 12px',
                borderRadius: 999,
                border: `1px solid ${isHovered ? pal.coral : pal.line}`,
                boxShadow: isHovered
                  ? '0 8px 20px oklch(0% 0 0 / 0.25)'
                  : '0 4px 14px rgba(0, 0, 0, 0.08)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                transition: 'all 250ms ease',
                pointerEvents: 'none',
              }}
            >
              {/* Punto de acento de color */}
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: isHovered ? pal.gold : ac.g2,
                }}
              />
              <span style={{ fontSize: 13, fontStyle: 'italic', fontWeight: 500, ...serif }}>
                {primerNombre}
              </span>
              <span style={{ fontSize: 9.5, opacity: 0.7, ...mono }}>
                · {fechaIngreso}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Seccion01Hero({ empsActivos, emps, onCrear, onIrAlElenco }) {
  const [modalNuevo, setModalNuevo] = useState(false);

  const salarioTotal = empsActivos.reduce((a, e) => a + e.salario, 0);
  const completo = empsActivos.filter((e) => e.tipo === 'Tiempo completo').length;
  const medio = empsActivos.length - completo;

  const conFecha = empsActivos.map((e) => ({ e, f: parseFecha(e.ingreso) })).filter((x) => x.f);
  const antiguedades = conFecha.map((x) => antiguedad(x.f, HOY));
  const promMeses = antiguedades.length ? antiguedades.reduce((a, x) => a + x.totalMeses, 0) / antiguedades.length : 0;
  const promFmt = antiguedadFmt({ anios: Math.floor(promMeses / 12), meses: Math.round(promMeses % 12) });

  const lider = conFecha.reduce((best, x) => (!best || x.f.anio < best.f.anio || (x.f.anio === best.f.anio && x.f.mesIndice < best.f.mesIndice) ? x : best), null);
  const liderAnt = lider ? antiguedad(lider.f, HOY) : null;

  const proximos = conFecha.map((x) => ({ e: x.e, ...proximoAniversario(x.f, HOY) })).sort((a, b) => a.dias - b.dias);
  const proximoHito = proximos[0];

  const aniversarioEsteMes = conFecha.find((x) => x.f.mesIndice === HOY.mesIndice && x.f.anio !== HOY.anio);
  const aniversarioAnios = aniversarioEsteMes ? HOY.anio - aniversarioEsteMes.f.anio : 0;

  return (
    <section style={{ position: 'relative', padding: '44px 56px 44px', overflow: 'hidden' }}>
      <Constelacion empsActivos={empsActivos} />

      <div style={{ position: 'relative', maxWidth: 720 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
          <span style={{ width: 32, height: 1, background: pal.ink }} />
          <span style={{ ...mono, color: pal.ink }}>Equipo · sección 01</span>
          <Dot c={pal.sage} glow />
          <span style={{ ...mono, color: pal.deepGreen }}>{empsActivos.length === emps.length ? 'Todos activos' : `${empsActivos.length} de ${emps.length} activos`}</span>
        </div>

        <h1 className="ed-hero-title" style={{ fontSize: 104, lineHeight: 0.92, margin: '0 0 18px', letterSpacing: '-0.03em', color: pal.ink, animation: 'ed-fade-up 900ms ease-out both', ...serif }}>
          {numeroCapitalizado(empsActivos.length)}{' '}
          <em
            style={{
              fontStyle: 'italic',
              background: 'linear-gradient(135deg, oklch(45% 0.11 30), oklch(60% 0.16 320))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            nombres
          </em>
          ,
          <br />
          {/* Antes decía "seis historias" fijo sin importar cuántas personas
              hubiera realmente (auditoría: "seis historias" hardcodeado). */}
          {NUM_PALABRA[empsActivos.length] || empsActivos.length} historias.
        </h1>

        <p style={{ fontSize: 24, fontStyle: 'italic', lineHeight: 1.35, margin: '0 0 32px', maxWidth: 560, color: 'oklch(35% 0.03 30)', animation: 'ed-fade-up 900ms ease-out 200ms both', ...serif }}>
          Tu equipo lleva en promedio <span style={{ color: pal.ink }}>{promFmt}</span> con vos.{' '}
          {aniversarioEsteMes
            ? `Este mes, ${aniversarioEsteMes.e.nombre.split(' ')[0]} llega a su ${aniversarioAnios === 1 ? 'primer' : `${aniversarioAnios}.º`} aniversario.`
            : proximoHito
              ? `El próximo hito es el aniversario de ${proximoHito.e.nombre.split(' ')[0]}, en ${proximoHito.dias} días.`
              : ''}
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setModalNuevo(true)}
            style={{
              padding: '14px 24px',
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
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 40%, oklch(100% 0 0 / 0.15) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'ed-shine-sweep 4s ease-in-out infinite' }} />
            <span style={{ position: 'relative' }}>Agregar a alguien nuevo</span>
            <svg style={{ position: 'relative' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          {/* Lleva al expediente, donde "Emitir constancia laboral" genera el
              documento real de la persona seleccionada — antes era un botón
              deshabilitado que no llevaba a ningún lado. */}
          <button
            type="button"
            onClick={onIrAlElenco}
            style={{ padding: '14px 22px', background: pal.cream2, color: pal.ink, border: `1px solid ${pal.line}`, borderRadius: 14, fontSize: 14, cursor: 'pointer' }}
          >
            Constancias laborales ↗
          </button>
        </div>

        <div style={{ marginTop: 44, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '22px 0', borderTop: `1px solid ${pal.line}`, borderBottom: `1px solid ${pal.line}` }} className="ed-grid-4">
          <div style={{ paddingRight: 18, borderRight: `1px solid ${pal.line2}` }}>
            <div style={mono}>Activos</div>
            <div style={{ fontSize: 32, lineHeight: 1, marginTop: 6, ...num, ...serif }}>{empsActivos.length}</div>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>
              {completo} completo · {medio} medio
            </div>
          </div>
          <div style={{ padding: '0 18px', borderRight: `1px solid ${pal.line2}` }}>
            <div style={mono}>Planilla mensual</div>
            <div style={{ fontSize: 32, lineHeight: 1, marginTop: 6, ...num, ...serif }}>{money(salarioTotal)}</div>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>bruto sin cargas</div>
          </div>
          <div style={{ padding: '0 18px', borderRight: `1px solid ${pal.line2}` }}>
            <div style={mono}>Antigüedad prom.</div>
            <div style={{ fontSize: 32, lineHeight: 1, marginTop: 6, ...num, ...serif }}>{promFmt}</div>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>
              {lider ? `${lider.e.nombre.split(' ')[0]} lidera con ${liderAnt.anios}` : '—'}
            </div>
          </div>
          <div style={{ paddingLeft: 18 }}>
            <div style={mono}>Próximo aniversario</div>
            <div style={{ fontSize: 32, lineHeight: 1, marginTop: 6, ...num, ...serif }}>{proximoHito ? `${proximoHito.dias} días` : '—'}</div>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.coral, marginTop: 4, ...serif }}>
              {proximoHito ? `${proximoHito.e.nombre.split(' ')[0]} · ${String(proximoHito.fecha.getDate()).padStart(2, '0')} ${MESES_ABR[proximoHito.fecha.getMonth()]}` : 'sin datos de ingreso'}
            </div>
          </div>
        </div>
      </div>

      <Modal open={modalNuevo} onClose={() => setModalNuevo(false)} title="Nuevo empleado" width={560}>
        <EmpleadoForm
          onCancel={() => setModalNuevo(false)}
          onSubmit={(datos) => {
            onCrear(datos);
            setModalNuevo(false);
          }}
        />
      </Modal>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 02 — El elenco: seis tarjetas retrato
   --------------------------------------------------------- */

function TarjetaPersona({ e, i, destacado, onAbrir }) {
  const ac = acentoDe(i);
  return (
    <article
      onClick={() => onAbrir(e.id)}
      style={{
        position: 'relative',
        background: pal.paper,
        border: destacado ? `2px solid ${pal.ink}` : `1px solid ${pal.line2}`,
        borderRadius: 22,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: destacado ? 470 : 440,
        marginTop: destacado ? -16 : 0,
        boxShadow: destacado
          ? '0 30px 60px -30px oklch(20% 0.02 30 / 0.45), 0 0 24px -6px oklch(85% 0.14 75 / 0.3)'
          : '0 4px 16px -4px rgba(0, 0, 0, 0.04)',
        cursor: 'pointer',
        transition: 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 250ms ease, border-color 250ms ease',
      }}
      onMouseEnter={(ev) => {
        if (!hoverFino()) return;
        ev.currentTarget.style.transform = 'translateY(-6px)';
        ev.currentTarget.style.boxShadow = destacado
          ? '0 36px 70px -30px oklch(20% 0.02 30 / 0.5), 0 0 32px -4px oklch(85% 0.14 75 / 0.45)'
          : '0 16px 36px -12px oklch(20% 0.02 30 / 0.15)';
      }}
      onMouseLeave={(ev) => {
        ev.currentTarget.style.transform = 'translateY(0)';
        ev.currentTarget.style.boxShadow = destacado
          ? '0 30px 60px -30px oklch(20% 0.02 30 / 0.45), 0 0 24px -6px oklch(85% 0.14 75 / 0.3)'
          : '0 4px 16px -4px rgba(0, 0, 0, 0.04)';
      }}
    >
      {/* 1. Insignia de Expediente Abierto con animación de pulso de brillo */}
      {destacado && (
        <span
          style={{
            position: 'absolute',
            top: -1,
            left: -1,
            padding: '5px 14px 5px 12px',
            background: pal.ink,
            color: pal.gold,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: '0.18em',
            borderRadius: '20px 0 14px 0',
            zIndex: 3,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 999, background: pal.gold, animation: 'ed-gold-glow 2s ease-in-out infinite' }} />
          EXPEDIENTE ABIERTO
        </span>
      )}

      {/* 2. Cabecera Retrato con Degradado en Loop Ambiental Continuo */}
      <div
        style={{
          position: 'relative',
          height: destacado ? 200 : 170,
          background: `linear-gradient(135deg, ${ac.g1}, ${ac.g2}, ${ac.g1})`,
          backgroundSize: '200% 200%',
          animation: `ed-gradient-shift ${10 + i * 2}s ease-in-out infinite`,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
          padding: 16,
          overflow: 'hidden',
        }}
      >
        {/* Sombra interna atmosférica */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.35), transparent 60%)',
            pointerEvents: 'none',
          }}
        />

        {/* Indicador numérico flotante en cristal */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'rgba(20, 20, 30, 0.45)',
            backdropFilter: 'blur(8px)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: '0.14em',
            color: pal.cream,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            zIndex: 2,
          }}
        >
          {String(i + 1).padStart(2, '0')}
        </div>

        {/* Monograma de Iniciales Flotante en Loop */}
        <div
          style={{
            fontSize: destacado ? 84 : 72,
            fontStyle: 'italic',
            lineHeight: 0.9,
            color: ac.ink,
            animation: `ed-float-slow ${6 + i}s ease-in-out infinite ${i * 0.4}s`,
            textShadow: '0 4px 16px rgba(0,0,0,0.06)',
            position: 'relative',
            zIndex: 2,
            ...serif,
          }}
        >
          {e.ini}
        </div>

        {/* Aura bioluminiscente para la tarjeta activa */}
        {destacado && (
          <span
            style={{
              position: 'absolute',
              bottom: 14,
              right: 14,
              width: 14,
              height: 14,
              borderRadius: 999,
              background: pal.gold,
              border: `3px solid ${pal.paper}`,
              animation: 'ed-gold-glow 2.4s ease-in-out infinite',
              zIndex: 3,
            }}
          />
        )}
      </div>

      {/* 3. Cuerpo de la Tarjeta con Tipografía Editorial y Metadatos */}
      <div style={{ padding: destacado ? '20px 18px 22px' : '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <div>
          <div style={{ fontSize: destacado ? 24 : 22, lineHeight: 1.1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            {e.nombre.split(' ')[0]} <em style={{ fontStyle: 'italic', color: 'oklch(35% 0.03 30)' }}>{e.nombre.split(' ')[1]}</em>
          </div>
          <div style={{ fontSize: 11, color: pal.muted, marginTop: 2 }}>{e.nombre.split(' ').slice(2).join(' ')}</div>
        </div>

        <div style={{ fontSize: 14, fontStyle: 'italic', color: 'oklch(35% 0.03 30)', ...serif }}>{e.puesto}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 9px',
              borderRadius: 999,
              background: e.tipo === 'Tiempo completo' ? 'oklch(94% 0.06 145)' : 'oklch(94% 0.05 55)',
              color: e.tipo === 'Tiempo completo' ? pal.deepGreen : 'oklch(48% 0.11 55)',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: e.tipo === 'Tiempo completo' ? pal.sage : pal.gold,
                animation: 'ed-dot-glow 2.5s ease-in-out infinite',
              }}
            />
            {e.tipo}
          </span>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: `1px dashed ${pal.line2}`, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: pal.muted }}>Con vos desde</span>
            <span style={{ fontStyle: 'italic', color: pal.ink, ...serif }}>{e.ingreso}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: pal.muted }}>Salario bruto</span>
            <span style={{ color: pal.ink, fontWeight: 600, ...num }}>{money(e.salario)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: pal.muted }}>Canal</span>
            <span style={{ color: pal.ink, fontWeight: 500 }}>{e.banco}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function ElencoSection({ personas, empsActivos, selEmp, onAbrir }) {
  const [filtro, setFiltro] = useState('todos');
  const completo = personas.filter((e) => e.tipo === 'Tiempo completo');
  const medio = personas.filter((e) => e.tipo === 'Medio tiempo');
  const visibles = filtro === 'completo' ? completo : filtro === 'medio' ? medio : personas;

  return (
    <section style={{ padding: '24px 56px 56px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 36, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 02 · el elenco</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            {personas.length === empsActivos.length ? (
              <>
                Los <em style={{ fontStyle: 'italic' }}>{NUM_PALABRA[personas.length] || personas.length}</em>, uno por uno
              </>
            ) : (
              <>
                {personas.length} <em style={{ fontStyle: 'italic' }}>coinciden</em>
              </>
            )}
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <div style={{ display: 'inline-flex', padding: 3, background: pal.cream2, border: `1px solid ${pal.line}`, borderRadius: 10, fontSize: 12 }}>
          {[
            { k: 'todos', l: `Todos · ${personas.length}` },
            { k: 'completo', l: `Tiempo completo · ${completo.length}` },
            { k: 'medio', l: `Medio tiempo · ${medio.length}` },
          ].map((f) => (
            <button
              key={f.k}
              type="button"
              onClick={() => setFiltro(f.k)}
              style={{ padding: '5px 12px', border: 'none', background: filtro === f.k ? pal.ink : 'transparent', color: filtro === f.k ? pal.cream : pal.muted, borderRadius: 7, cursor: 'pointer', fontWeight: filtro === f.k ? 600 : 400 }}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      <div className="ed-grid-elenco" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(visibles.length, 6) || 1}, 1fr)`, gap: 14, alignItems: 'stretch' }}>
        {visibles.length === 0 && (
          <div style={{ padding: '32px 28px', borderRadius: 18, background: pal.cream2, border: `1px solid ${pal.line}`, color: pal.muted, fontSize: 14 }}>Nadie coincide con la búsqueda o el filtro.</div>
        )}
        {visibles.map((e) => {
          const i = personas.indexOf(e);
          return <TarjetaPersona key={e.id} e={e} i={i >= 0 ? i : 0} destacado={e.id === selEmp?.id} onAbrir={onAbrir} />;
        })}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 03 — El expediente
   --------------------------------------------------------- */

function CampoVacio({ children }) {
  return (
    <div style={{ fontSize: 15, fontStyle: 'italic', color: pal.muted2, ...serif }}>{children}</div>
  );
}

function ExpedienteSection({ personas, selEmp, onSelect, getHistorial, onEditar, onAlternarActivo, onEliminar, empresaNombre, actividad, usuario, onNavigate }) {
  const [confirmBaja, setConfirmBaja] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  if (!selEmp) return null;

  const i = personas.findIndex((e) => e.id === selEmp.id);
  const ac = acentoDe(Math.max(0, i));

  const fechaIngresoObj = parseFecha(selEmp.ingreso);
  const ant = fechaIngresoObj ? antiguedad(fechaIngresoObj, HOY) : null;

  const historial = getHistorial(selEmp.id).slice(0, 3);
  const canal = canalDe(selEmp.banco);

  const valorHora = selEmp.valorHora || 0;
  const montoHorasExtra = selEmp.montoHorasExtra || 0;
  const movimientos = [];
  if (selEmp.horasExtra > 0) movimientos.push({ label: 'Horas extras', signo: 1, monto: montoHorasExtra, desc: `${selEmp.horasExtra}h extra a ${selEmp.factorHoraExtra}× esta quincena.` });
  if (selEmp.bono > 0) movimientos.push({ label: 'Bono', signo: 1, monto: selEmp.bono, desc: 'Bono puntual de la quincena.' });
  if (selEmp.deduccionPuntual > 0) movimientos.push({ label: 'Deducción', signo: -1, monto: selEmp.deduccionPuntual, desc: 'Deducción puntual de la quincena.' });

  return (
    <section id="equipo-expediente" style={{ padding: '0 56px 56px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 03 · el expediente</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            {selEmp.nombre.split(' ')[0]}, <em style={{ fontStyle: 'italic' }}>abierto</em>
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: pal.muted, flexWrap: 'wrap' }}>
          <span>Cambiar de expediente</span>
          <span style={{ width: 1, height: 14, background: pal.line, margin: '0 4px' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {personas.map((e, idx) => {
              const a = acentoDe(idx);
              const activo = e.id === selEmp.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onSelect(e.id)}
                  title={`${e.nombre}${e.activo ? '' : ' · inactivo'}`}
                  style={{
                    position: 'relative',
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: `linear-gradient(135deg, ${a.g1}, ${a.g2})`,
                    border: activo ? `2px solid ${pal.ink}` : `1px solid ${pal.line2}`,
                    boxShadow: activo ? '0 4px 12px oklch(20% 0.02 30 / 0.25)' : 'none',
                    transform: activo ? 'scale(1.12)' : 'scale(1)',
                    fontStyle: 'italic',
                    fontSize: 12,
                    fontWeight: 600,
                    color: pal.ink,
                    cursor: 'pointer',
                    opacity: e.activo ? 1 : 0.55,
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                    ...serif,
                  }}
                >
                  {e.ini}
                  {!e.activo && (
                    <span style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: 999, background: 'oklch(70% 0.02 55)', border: `1.5px solid ${pal.paper}` }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <article
        key={selEmp.id}
        style={{
          position: 'relative',
          background: pal.paper,
          borderRadius: 26,
          overflow: 'hidden',
          boxShadow: '0 30px 60px -30px oklch(20% 0.02 30 / 0.35), 0 4px 16px -4px oklch(20% 0.02 30 / 0.08)',
          border: `1px solid ${pal.line}`,
          animation: 'ed-fade-up 350ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        <div className="ed-grid-expediente" style={{ display: 'grid', gridTemplateColumns: '36% 64%', alignItems: 'stretch' }}>
          {/* IZQUIERDA: Identidad Editorial Satinada */}
          <div style={{ position: 'relative', padding: '36px 36px 32px', background: `linear-gradient(180deg, ${ac.g1}30, transparent 65%)` }}>
            {/* Banner de Cabecera Satinado con loop continuo */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 160,
                background: `linear-gradient(135deg, ${ac.g1}, ${ac.g2}, ${ac.g1})`,
                backgroundSize: '200% 200%',
                animation: 'ed-gradient-shift 12s ease-in-out infinite',
                opacity: 0.65,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(circle at 20% 10%, ${ac.g1}40, transparent 50%)`,
                animation: 'ed-aurora 12s ease-in-out infinite',
                pointerEvents: 'none',
              }}
            />

            <div style={{ position: 'relative', zIndex: 2 }}>
              {/* Medallón de Retrato con Anillo Satinado */}
              <div style={{ position: 'relative', width: 130, height: 130, marginBottom: 20 }}>
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 999,
                    background: `linear-gradient(135deg, ${ac.g1}, ${ac.g2})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 58,
                    fontStyle: 'italic',
                    color: ac.ink,
                    boxShadow: '0 16px 36px -12px oklch(30% 0.10 220 / 0.4)',
                    border: `3.5px solid ${pal.gold}`,
                    ...serif,
                  }}
                >
                  {selEmp.ini}
                </div>
                <span
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: selEmp.activo ? pal.sage : 'oklch(70% 0.02 55)',
                    border: `3px solid ${pal.paper}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                  title={selEmp.activo ? 'Empleado activo' : 'Inactivo'}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={pal.cream} strokeWidth="3">
                    <path d="M5 12l5 5 9-11" />
                  </svg>
                </span>
              </div>

              <div style={{ ...mono, fontSize: 10, marginBottom: 6, color: ac.ink }}>Expediente · persona N.º {String(i + 1).padStart(3, '0')}</div>
              <h2 style={{ fontSize: 48, lineHeight: 0.95, letterSpacing: '-0.02em', margin: '0 0 10px', color: pal.ink, ...serif }}>
                {selEmp.nombre.split(' ')[0]} <em style={{ fontStyle: 'italic', color: 'oklch(35% 0.03 30)' }}>{selEmp.nombre.split(' ')[1]}</em>
                <br />
                {selEmp.nombre.split(' ').slice(2).join(' ')}
              </h2>
              <div style={{ fontSize: 16, fontStyle: 'italic', color: ac.ink, marginBottom: 22, ...serif }}>
                {selEmp.puesto} · con vos desde {selEmp.ingreso}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 13, paddingTop: 20, borderTop: `1px dashed ${pal.line2}` }}>
                <div>
                  <div style={{ ...mono, fontSize: 9, marginBottom: 3 }}>Cédula</div>
                  <div style={{ fontSize: 14, color: pal.ink, ...num }}>{selEmp.cedula}</div>
                </div>
                <div>
                  <div style={{ ...mono, fontSize: 9, marginBottom: 3 }}>Teléfono</div>
                  <div style={{ fontSize: 14, color: pal.ink, ...num }}>{selEmp.tel}</div>
                </div>
                <div>
                  <div style={{ ...mono, fontSize: 9, marginBottom: 3 }}>Antigüedad</div>
                  <div style={{ fontSize: 15, fontStyle: 'italic', color: pal.ink, ...serif }}>{ant ? antiguedadFmt(ant) : <CampoVacio>Fecha de ingreso sin formato reconocido.</CampoVacio>}</div>
                </div>
                {/* Ya no son dos textos fijos de "no registrado": son campos
                    reales de la ficha, que se llenan desde "Editar datos". */}
                <div>
                  <div style={{ ...mono, fontSize: 9, marginBottom: 3 }}>Nacimiento</div>
                  {selEmp.nacimiento ? (
                    <div style={{ fontSize: 14, color: pal.ink, ...num }}>{selEmp.nacimiento}</div>
                  ) : (
                    <CampoVacio>No registrado en el sistema.</CampoVacio>
                  )}
                </div>
                <div>
                  <div style={{ ...mono, fontSize: 9, marginBottom: 3 }}>Contacto de emergencia</div>
                  {selEmp.emergencia ? (
                    <div style={{ fontSize: 14, color: pal.ink }}>{selEmp.emergencia}</div>
                  ) : (
                    <CampoVacio>No registrado en el sistema.</CampoVacio>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => onNavigate('planilla')}
                  style={{
                    padding: '11px 16px',
                    background: pal.ink,
                    color: pal.cream,
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 8px 20px -6px oklch(20% 0.02 30 / 0.3)',
                    transition: 'all 200ms ease',
                  }}
                >
                  <span>Ir a su planilla actual</span>
                  <span>↗</span>
                </button>
                {/* Documento real con los datos de la ficha (identidad,
                    puesto, salario, antigüedad) — en texto plano porque no
                    hay librería de PDF en el proyecto (ver
                    `generarConstanciaLaboral`). Antes estaba deshabilitado
                    con un "Todavía no está conectado" pese a que la ficha ya
                    tenía todo lo necesario para emitirla. */}
                <button
                  type="button"
                  onClick={() => generarConstanciaLaboral(selEmp, empresaNombre, actividad, usuario)}
                  title="Descarga una constancia laboral en texto, lista para imprimir"
                  style={{
                    padding: '11px 16px',
                    background: 'rgba(255, 252, 248, 0.95)',
                    color: pal.ink,
                    border: `1px solid ${pal.line}`,
                    borderRadius: 12,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>Emitir constancia laboral</span>
                  <span>TXT</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalEditar(true)}
                  style={{
                    padding: '11px 16px',
                    background: 'rgba(255, 252, 248, 0.95)',
                    color: pal.ink,
                    border: `1px solid ${pal.line}`,
                    borderRadius: 12,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    transition: 'all 200ms ease',
                  }}
                >
                  <span>Editar datos personales</span>
                  <span style={{ color: pal.muted }}>✎</span>
                </button>
              </div>
            </div>
          </div>

          {/* DERECHA: Información Laboral Desaturada & Elegante */}
          <div style={{ padding: '36px 40px 32px' }}>
            <div style={{ marginBottom: 26 }}>
              <div style={{ ...mono, marginBottom: 14 }}>Datos laborales</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '22px 28px' }} className="ed-grid-3">
                <div>
                  <div style={{ ...mono, fontSize: 9, marginBottom: 4 }}>Puesto</div>
                  <div style={{ fontSize: 20, lineHeight: 1.1, color: pal.ink, ...serif }}>{selEmp.puesto}</div>
                </div>
                <div>
                  <div style={{ ...mono, fontSize: 9, marginBottom: 4 }}>Jornada</div>
                  <div style={{ fontSize: 20, lineHeight: 1.1, color: pal.ink, ...serif }}>{selEmp.tipo}</div>
                </div>
                <div>
                  <div style={{ ...mono, fontSize: 9, marginBottom: 4 }}>Estado</div>
                  <div style={{ fontSize: 20, lineHeight: 1.1, color: selEmp.activo ? pal.deepGreen : pal.muted, ...serif }}>{selEmp.activo ? 'Activo' : 'Inactivo'}</div>
                </div>
                <div>
                  <div style={{ ...mono, fontSize: 9, marginBottom: 4 }}>Con vos desde</div>
                  <div style={{ fontSize: 20, lineHeight: 1.1, color: pal.ink, ...serif }}>{selEmp.ingreso}</div>
                  <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted, marginTop: 3, ...serif }}>{ant ? antiguedadFmt(ant) : '—'}</div>
                </div>
                <div>
                  <div style={{ ...mono, fontSize: 9, marginBottom: 4 }}>Salario bruto</div>
                  <div style={{ fontSize: 20, lineHeight: 1.1, color: pal.ink, ...num, ...serif }}>{money(selEmp.salario)}</div>
                  <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted, marginTop: 3, ...serif }}>mensual · {selEmp.brutoFmt} por quincena</div>
                </div>
                <div>
                  <div style={{ ...mono, fontSize: 9, marginBottom: 4 }}>Esta quincena</div>
                  <div style={{ fontSize: 20, lineHeight: 1.1, color: pal.ink, ...num, ...serif }}>{selEmp.netoFmt}</div>
                  <div style={{ fontSize: 12, fontStyle: 'italic', color: selEmp.pago === 'pagado' ? pal.deepGreen : pal.muted, marginTop: 3, ...serif }}>{selEmp.pgL.toLowerCase()}</div>
                </div>
              </div>
            </div>

            {/* Tarjeta Métodos de Pago (Elegante & Desaturada) */}
            <div
              style={{
                marginBottom: 26,
                padding: '18px 22px',
                background: 'rgba(255, 253, 249, 0.95)',
                border: `1px solid ${pal.line}`,
                borderRadius: 18,
                boxShadow: '0 4px 16px -4px rgba(0,0,0,0.04)',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: 20,
                alignItems: 'center',
              }}
              className="ed-grid-cuenta"
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, oklch(95% 0.04 145), oklch(90% 0.08 145))',
                  border: `1px solid oklch(80% 0.06 145)`,
                  color: pal.deepGreen,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 600,
                  ...serif,
                }}
              >
                {canal.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 12, color: pal.ink, fontWeight: 600 }}>Cobra por {canal}</div>
                <div style={{ fontSize: 15, color: pal.ink, letterSpacing: '0.04em', marginTop: 2, ...num }}>{selEmp.banco}</div>
                <div style={{ fontSize: 11, fontStyle: 'italic', color: pal.deepGreen, marginTop: 3, ...serif }}>método de pago verificado</div>
              </div>
              <button
                type="button"
                onClick={() => setModalEditar(true)}
                style={{
                  padding: '8px 14px',
                  background: pal.cream2,
                  color: pal.ink,
                  border: `1px solid ${pal.line}`,
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                }}
              >
                Cambiar método
              </button>
            </div>

            {/* Historial de Quincenas (Desaturado & Editorial) */}
            <div style={{ marginBottom: 26 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <div style={mono}>Últimas quincenas cerradas</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${historial.length + 1}, 1fr)`, gap: 10 }} className="ed-grid-quincenas">
                {historial.length === 0 && (
                  <div style={{ padding: '14px', background: pal.cream2, border: `1px solid ${pal.line2}`, borderRadius: 14, gridColumn: 'span 3' }}>
                    <CampoVacio>Todavía no hay quincenas cerradas para esta persona.</CampoVacio>
                  </div>
                )}
                {historial.map((h) => (
                  <div
                    key={h.periodo.id}
                    style={{
                      padding: '12px 14px 12px',
                      background: 'rgba(255, 253, 249, 0.95)',
                      border: `1px solid ${pal.line2}`,
                      borderRadius: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      transition: 'transform 200ms ease, border-color 200ms ease',
                    }}
                  >
                    <div style={{ ...mono, fontSize: 9, color: pal.muted }}>{h.periodo.etiqueta.replace('Quincena · ', '')}</div>
                    <div style={{ width: '100%', height: 3, borderRadius: 999, background: `linear-gradient(90deg, ${ac.g1}, ${ac.g2})`, margin: '2px 0' }} />
                    <div style={{ fontSize: 16, color: pal.ink, fontWeight: 500, ...num, ...serif }}>{h.netoFmt}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontStyle: 'italic', color: pal.deepGreen, ...serif }}>
                      <span style={{ width: 4, height: 4, borderRadius: 999, background: pal.sage }} />
                      pagada
                    </div>
                  </div>
                ))}
                <div
                  style={{
                    padding: '12px 14px 12px',
                    background: 'linear-gradient(135deg, rgba(255, 252, 245, 0.98), oklch(96% 0.05 65 / 0.5))',
                    border: `1.5px solid ${pal.gold}`,
                    borderRadius: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    boxShadow: '0 4px 12px -4px oklch(85% 0.14 75 / 0.25)',
                  }}
                >
                  <div style={{ ...mono, fontSize: 9, color: 'oklch(45% 0.13 55)' }}>hoy · en curso</div>
                  <div style={{ width: '100%', height: 3, borderRadius: 999, background: `linear-gradient(90deg, ${pal.gold}, ${pal.coral})`, margin: '2px 0' }} />
                  <div style={{ fontSize: 16, color: pal.ink, fontWeight: 500, ...num, ...serif }}>{selEmp.netoFmt}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontStyle: 'italic', color: 'oklch(45% 0.13 55)', ...serif }}>
                    <span style={{ width: 4, height: 4, borderRadius: 999, background: pal.gold, animation: 'ed-dot-glow 2s ease-in-out infinite' }} />
                    {selEmp.pago === 'pagado' ? 'pagada' : selEmp.tieneAjuste ? 'esperando firma' : 'en revisión'}
                  </div>
                </div>
              </div>
            </div>

            {/* Ajustes Puntuales */}
            <div style={{ marginBottom: 26 }}>
              <div style={{ ...mono, marginBottom: 12 }}>Ajustes de esta quincena</div>
              {movimientos.length === 0 ? (
                <CampoVacio>Sin ajustes puntuales este período.</CampoVacio>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {movimientos.map((m) => (
                    <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center', padding: '10px 0', borderBottom: `1px dotted ${pal.line2}` }}>
                      <div style={{ fontSize: 13, color: pal.ink }}>
                        <span style={{ color: m.signo > 0 ? pal.deepGreen : 'oklch(45% 0.12 25)', fontWeight: 600 }}>{m.signo > 0 ? '+' : '−'}</span> {m.desc}
                      </div>
                      <div style={{ fontSize: 13, color: m.signo > 0 ? pal.deepGreen : 'oklch(45% 0.12 25)', fontWeight: 600, ...num }}>
                        {m.signo > 0 ? '+' : '−'} {money(m.monto)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Acciones Rápidas (Elegantes Micro-tarjetas) */}
            <div style={{ paddingTop: 20, borderTop: `1px solid ${pal.line2}`, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }} className="ed-grid-acciones">
              <button
                type="button"
                onClick={() => onNavigate('planilla')}
                style={{
                  padding: '12px 14px',
                  background: 'rgba(255, 253, 249, 0.95)',
                  color: pal.ink,
                  border: `1px solid ${pal.line}`,
                  borderRadius: 14,
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: 500,
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={(ev) => {
                  if (!hoverFino()) return;
                  ev.currentTarget.style.transform = 'translateY(-2px)';
                  ev.currentTarget.style.borderColor = pal.coral;
                }}
                onMouseLeave={(ev) => {
                  ev.currentTarget.style.transform = 'translateY(0)';
                  ev.currentTarget.style.borderColor = pal.line;
                }}
              >
                <div style={{ fontSize: 15, marginBottom: 4, color: pal.coral }}>↗</div>
                Ajuste puntual
                <br />
                <span style={{ color: pal.muted, fontSize: 10, fontWeight: 400 }}>bono o deducción</span>
              </button>

              <button
                type="button"
                onClick={() => setModalEditar(true)}
                style={{
                  padding: '12px 14px',
                  background: 'rgba(255, 253, 249, 0.95)',
                  color: pal.ink,
                  border: `1px solid ${pal.line}`,
                  borderRadius: 14,
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: 500,
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={(ev) => {
                  if (!hoverFino()) return;
                  ev.currentTarget.style.transform = 'translateY(-2px)';
                  ev.currentTarget.style.borderColor = pal.gold;
                }}
                onMouseLeave={(ev) => {
                  ev.currentTarget.style.transform = 'translateY(0)';
                  ev.currentTarget.style.borderColor = pal.line;
                }}
              >
                <div style={{ fontSize: 15, marginBottom: 4, color: 'oklch(55% 0.12 75)' }}>₡</div>
                Subir salario
                <br />
                <span style={{ color: pal.muted, fontSize: 10, fontWeight: 400 }}>nueva base mensual</span>
              </button>

              <button
                type="button"
                onClick={() => setModalEditar(true)}
                style={{
                  padding: '12px 14px',
                  background: 'rgba(255, 253, 249, 0.95)',
                  color: pal.ink,
                  border: `1px solid ${pal.line}`,
                  borderRadius: 14,
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: 500,
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={(ev) => {
                  if (!hoverFino()) return;
                  ev.currentTarget.style.transform = 'translateY(-2px)';
                  ev.currentTarget.style.borderColor = pal.lilac;
                }}
                onMouseLeave={(ev) => {
                  ev.currentTarget.style.transform = 'translateY(0)';
                  ev.currentTarget.style.borderColor = pal.line;
                }}
              >
                <div style={{ fontSize: 15, marginBottom: 4, color: pal.plum }}>✎</div>
                Editar contrato
                <br />
                <span style={{ color: pal.muted, fontSize: 10, fontWeight: 400 }}>jornada, puesto, cuenta</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmBaja(true)}
                style={{
                  padding: '12px 14px',
                  background: selEmp.activo ? 'rgba(255, 245, 245, 0.95)' : 'rgba(242, 250, 245, 0.95)',
                  color: selEmp.activo ? 'oklch(45% 0.14 25)' : pal.deepGreen,
                  border: `1px solid ${selEmp.activo ? 'oklch(88% 0.05 25)' : 'oklch(85% 0.05 145)'}`,
                  borderRadius: 14,
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: 500,
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={(ev) => {
                  if (!hoverFino()) return;
                  ev.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(ev) => {
                  ev.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontSize: 15, marginBottom: 4 }}>{selEmp.activo ? '✕' : '↺'}</div>
                {selEmp.activo ? 'Dar de baja' : 'Reactivar'}
                <br />
                <span style={{ color: selEmp.activo ? 'oklch(55% 0.10 25)' : 'oklch(45% 0.11 145)', fontSize: 10, fontWeight: 400 }}>
                  {selEmp.activo ? 'sale de planilla' : 'vuelve a planilla'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmEliminar(true)}
                style={{
                  padding: '12px 14px',
                  background: 'rgba(255, 245, 245, 0.95)',
                  color: 'oklch(45% 0.14 25)',
                  border: '1px solid oklch(88% 0.05 25)',
                  borderRadius: 14,
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: 500,
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={(ev) => {
                  if (!hoverFino()) return;
                  ev.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(ev) => {
                  ev.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontSize: 15, marginBottom: 4 }}>🗑</div>
                Eliminar
                <br />
                <span style={{ color: 'oklch(55% 0.10 25)', fontSize: 10, fontWeight: 400 }}>borra a la persona</span>
              </button>
            </div>
          </div>
        </div>
      </article>

      <Modal open={modalEditar} onClose={() => setModalEditar(false)} title={`Editar · ${selEmp.nombre}`} width={560}>
        <EmpleadoForm
          inicial={selEmp}
          onCancel={() => setModalEditar(false)}
          onSubmit={(datos) => {
            onEditar(selEmp.id, datos);
            setModalEditar(false);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={confirmBaja}
        onClose={() => setConfirmBaja(false)}
        onConfirm={() => {
          onAlternarActivo(selEmp.id);
          setConfirmBaja(false);
        }}
        title={selEmp.activo ? 'Dar de baja a esta persona' : 'Reactivar empleado'}
        description={
          selEmp.activo
            ? `${selEmp.nombre} dejará de aparecer en la planilla y en pagos activos. Su historial se conserva y puede reactivarlo cuando quiera.`
            : `${selEmp.nombre} volverá a aparecer en la planilla y en pagos a partir del próximo período.`
        }
        confirmLabel={selEmp.activo ? 'Dar de baja' : 'Reactivar'}
        danger={selEmp.activo}
      />

      <ConfirmDialog
        open={confirmEliminar}
        onClose={() => setConfirmEliminar(false)}
        onConfirm={() => {
          onEliminar(selEmp.id);
          setConfirmEliminar(false);
        }}
        title="Eliminar a esta persona"
        description={`Se borra a ${selEmp.nombre} del sistema — esta acción no se puede deshacer. Si tiene historial en algún período ya cerrado, no se podrá eliminar; en ese caso, dala de baja en su lugar.`}
        confirmLabel="Eliminar"
        danger
      />
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 04 — Cartografía del equipo
   --------------------------------------------------------- */

function CartografiaSection({ empsActivos, emps }) {
  const [hoveredEmpId, setHoveredEmpId] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null);

  const conFecha = empsActivos.map((e, idx) => ({ e, i: empsActivos.indexOf(e), f: parseFecha(e.ingreso) })).filter((x) => x.f);
  const ordenados = [...conFecha].sort((a, b) => (a.f.anio - b.f.anio) || (a.f.mesIndice - b.f.mesIndice));

  const minAnio = ordenados.length ? ordenados[0].f.anio : HOY.anio;
  const spanAnios = Math.max(1, HOY.anio - minAnio + 1);
  const inicioMs = new Date(minAnio, 0, 1).getTime();
  const finMs = new Date(HOY.anio, HOY.mesIndice, HOY.dia).getTime();
  const totalMs = Math.max(1, finMs - inicioMs);

  const anios = Array.from({ length: spanAnios }, (_, i) => minAnio + i);

  function pctDesde(f) {
    const ms = new Date(f.anio, f.mesIndice, f.dia).getTime();
    return Math.min(100, Math.max(0, ((ms - inicioMs) / totalMs) * 100));
  }

  const masAntiguo = ordenados[0];
  const masNuevo = ordenados[ordenados.length - 1];
  const bajas = emps.filter((e) => !e.activo).length;

  // Matriz rol × jornada, agrupada por puesto real.
  const puestos = [...new Set(empsActivos.map((e) => e.puesto))];
  const jornadas = ['Tiempo completo', 'Medio tiempo'];

  return (
    <section id="equipo-cartografia" style={{ padding: '0 56px 56px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 04 · cartografía</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            La <em style={{ fontStyle: 'italic' }}>forma</em> del equipo
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <span style={mono}>Antigüedad · rol · jornada</span>
      </div>

      <div className="ed-grid-cartografia" style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 28, alignItems: 'stretch' }}>
        {/* TARJETA 1: Línea de Tiempo de Antigüedad Interactivas */}
        <div
          style={{
            position: 'relative',
            padding: '30px 34px 26px',
            background: 'rgba(255, 253, 249, 0.95)',
            border: `1px solid ${pal.line}`,
            borderRadius: 24,
            boxShadow: '0 20px 40px -20px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
        >
          {/* Fondo suave ambiental */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 0% 0%, oklch(92% 0.06 60 / 0.3), transparent 60%)',
              animation: 'ed-aurora 14s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 22, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 24, lineHeight: 1, color: pal.ink, ...serif }}>
                  Cuánto llevan <em style={{ fontStyle: 'italic' }}>con vos</em>
                </div>
                <div style={{ fontSize: 13, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>línea de tiempo · barras proporcionales a años</div>
              </div>
              <div style={{ ...mono, padding: '4px 10px', borderRadius: 999, background: pal.cream2, border: `1px solid ${pal.line2}` }}>
                {minAnio} → HOY
              </div>
            </div>

            {ordenados.length === 0 ? (
              <CampoVacio>Ningún empleado activo tiene una fecha de ingreso reconocible.</CampoVacio>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 88, paddingBottom: 24 }}>
                {/* Cuadrícula de años en el fondo */}
                <div style={{ position: 'absolute', left: 88, right: 0, top: 0, bottom: 24, display: 'grid', gridTemplateColumns: `repeat(${anios.length}, 1fr)`, pointerEvents: 'none' }}>
                  {anios.map((a, idx) => (
                    <div key={a} style={{ borderLeft: `1px dashed ${pal.line2}`, borderRight: idx === anios.length - 1 ? `1.5px solid ${pal.coral}` : 'none' }} />
                  ))}
                </div>

                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {ordenados.map((x, idx) => {
                    const a = antiguedad(x.f, HOY);
                    const pct = pctDesde(x.f);
                    const ac = acentoDe(x.i);
                    const isHovered = hoveredEmpId === x.e.id;

                    return (
                      <div
                        key={x.e.id}
                        onMouseEnter={() => { if (hoverFino()) setHoveredEmpId(x.e.id); }}
                        onMouseLeave={() => setHoveredEmpId(null)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          height: 36,
                          cursor: 'pointer',
                          opacity: hoveredEmpId && !isHovered ? 0.45 : 1,
                          transition: 'opacity 250ms ease, transform 250ms ease',
                          transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
                        }}
                      >
                        {/* Avatar Iniciales */}
                        <div style={{ width: 76, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 999,
                              background: `linear-gradient(135deg, ${ac.g1}, ${ac.g2})`,
                              border: `1.5px solid ${isHovered ? pal.coral : pal.gold}`,
                              boxShadow: isHovered ? '0 4px 12px oklch(70% 0.16 30 / 0.4)' : '0 2px 6px rgba(0,0,0,0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontStyle: 'italic',
                              fontSize: 11,
                              color: ac.ink,
                              transform: isHovered ? 'scale(1.18)' : 'scale(1)',
                              transition: 'all 200ms ease',
                              ...serif,
                            }}
                          >
                            {x.e.ini}
                          </div>
                          <span style={{ fontSize: 12, color: isHovered ? pal.ink : 'oklch(35% 0.03 30)', fontWeight: isHovered ? 600 : 500, transition: 'color 200ms ease' }}>
                            {x.e.nombre.split(' ')[0]} {x.e.nombre.split(' ')[1]?.charAt(0)}.
                          </span>
                        </div>

                        {/* Barra de Progreso de Antigüedad en Loop */}
                        <div style={{ flex: 1, position: 'relative', height: 24 }}>
                          <div
                            style={{
                              position: 'absolute',
                              left: `${pct}%`,
                              width: `${100 - pct}%`,
                              height: '100%',
                              background: isHovered
                                ? `linear-gradient(90deg, ${ac.g1}, ${pal.coral})`
                                : `linear-gradient(90deg, ${ac.g1}, ${ac.g2})`,
                              borderRadius: 8,
                              display: 'flex',
                              alignItems: 'center',
                              padding: '0 12px',
                              transformOrigin: 'left',
                              animation: `ed-bar-grow-x 1.2s cubic-bezier(.16,1,.3,1) ${idx * 100}ms both`,
                              boxShadow: isHovered ? '0 4px 16px oklch(70% 0.16 30 / 0.35)' : 'none',
                              transition: 'all 250ms ease',
                              overflow: 'hidden',
                            }}
                          >
                            {/* Brillo Satinado Flotante en Loop */}
                            <span
                              style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                                animation: 'ed-shine-sweep 4s ease-in-out infinite',
                                pointerEvents: 'none',
                              }}
                            />
                            <span style={{ fontSize: 11, color: ac.ink, fontWeight: 600, whiteSpace: 'nowrap', zIndex: 2, ...num, ...serif }}>
                              {antiguedadFmt(a)}
                            </span>

                            {/* Punto Bioluminiscente al final de la barra */}
                            <span
                              style={{
                                position: 'absolute',
                                right: 6,
                                width: 5,
                                height: 5,
                                borderRadius: 999,
                                background: pal.paper,
                                animation: 'ed-dot-glow 2s ease-in-out infinite',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Marcadores de Años */}
                <div style={{ position: 'absolute', left: 88, right: 0, bottom: 0, display: 'grid', gridTemplateColumns: `repeat(${anios.length}, 1fr)`, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: pal.muted, letterSpacing: '0.1em' }}>
                  {anios.map((a, idx) => (
                    <span key={a} style={idx === anios.length - 1 ? { color: pal.coral, fontWeight: 600 } : undefined}>
                      {idx === anios.length - 1 ? 'HOY' : `'${String(a).slice(2)}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px dashed ${pal.line2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 14, fontStyle: 'italic', color: 'oklch(35% 0.03 30)', ...serif }}>
                {masAntiguo && masNuevo && masAntiguo.e.id !== masNuevo.e.id
                  ? `${masAntiguo.e.nombre.split(' ')[0]} lleva más tiempo con vos. ${masNuevo.e.nombre.split(' ')[0]} es quien se unió más recientemente.`
                  : masAntiguo
                    ? `${masAntiguo.e.nombre.split(' ')[0]} es la única persona con fecha de ingreso registrada.`
                    : ''}
              </div>
              <div style={{ ...mono, fontSize: 10, padding: '3px 8px', borderRadius: 999, background: pal.cream2 }}>
                {bajas === 0 ? 'Sin bajas registradas' : `${bajas} ${bajas === 1 ? 'baja registrada' : 'bajas registradas'}`}
              </div>
            </div>
          </div>
        </div>

        {/* TARJETA 2: Matriz Dinámica Roles × Jornadas */}
        <div
          style={{
            position: 'relative',
            padding: '30px 32px 26px',
            background: 'linear-gradient(160deg, rgba(255, 252, 248, 0.98), oklch(96% 0.03 55 / 0.4))',
            border: `1px solid ${pal.line}`,
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: '0 20px 40px -20px rgba(0,0,0,0.05)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 100% 0%, oklch(88% 0.10 30 / 0.25), transparent 55%)',
              animation: 'ed-aurora 14s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 24, lineHeight: 1, color: pal.ink, ...serif }}>
                Roles × <em style={{ fontStyle: 'italic' }}>jornadas</em>
              </div>
              <div style={{ fontSize: 13, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>quién hace qué, y cuánto</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: `100px repeat(${jornadas.length}, 1fr)`, gap: '10px 12px' }}>
              <div />
              {jornadas.map((j) => (
                <div key={j} style={{ ...mono, fontSize: 10, textAlign: 'center', paddingBottom: 8, borderBottom: `1px solid ${pal.line2}`, color: pal.ink }}>
                  {j}
                </div>
              ))}

              {puestos.map((puesto) => (
                <Fragment key={puesto}>
                  <div style={{ fontSize: 15, fontStyle: 'italic', alignSelf: 'center', color: pal.ink, ...serif }}>
                    {puesto}
                  </div>
                  {jornadas.map((j) => {
                    const cellKey = `${puesto}-${j}`;
                    const gente = empsActivos.filter((e) => e.puesto === puesto && e.tipo === j);
                    const isCellHovered = hoveredCell === cellKey;

                    return (
                      <div
                        key={cellKey}
                        onMouseEnter={() => { if (hoverFino()) setHoveredCell(cellKey); }}
                        onMouseLeave={() => setHoveredCell(null)}
                        style={{
                          padding: '12px 14px',
                          background: isCellHovered
                            ? 'rgba(255, 255, 255, 0.95)'
                            : gente.length
                            ? 'rgba(255, 253, 248, 0.85)'
                            : 'rgba(248, 246, 240, 0.4)',
                          border: isCellHovered
                            ? `1px solid ${pal.coral}`
                            : gente.length
                            ? `1px solid ${pal.line2}`
                            : `1px dashed ${pal.line2}`,
                          borderRadius: 14,
                          minHeight: 78,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: gente.length ? 'flex-start' : 'center',
                          gap: 8,
                          transition: 'all 200ms ease',
                          transform: isCellHovered ? 'translateY(-2px)' : 'translateY(0)',
                          boxShadow: isCellHovered ? '0 6px 16px -4px rgba(0,0,0,0.08)' : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {gente.length === 0 ? (
                          <span style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted2, ...serif }}>—</span>
                        ) : (
                          <>
                            {gente.map((e) => {
                              const ac = acentoDe(empsActivos.indexOf(e));
                              const isEmpHovered = hoveredEmpId === e.id;
                              return (
                                <div
                                  key={e.id}
                                  onMouseEnter={(ev) => {
                                    ev.stopPropagation();
                                    if (hoverFino()) setHoveredEmpId(e.id);
                                  }}
                                  onMouseLeave={(ev) => {
                                    ev.stopPropagation();
                                    setHoveredEmpId(null);
                                  }}
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 999,
                                    background: `linear-gradient(135deg, ${ac.g1}, ${ac.g2})`,
                                    border: `1.5px solid ${isEmpHovered ? pal.coral : pal.gold}`,
                                    boxShadow: isEmpHovered ? '0 4px 14px oklch(70% 0.16 30 / 0.4)' : '0 2px 6px rgba(0,0,0,0.08)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 14,
                                    fontStyle: 'italic',
                                    color: ac.ink,
                                    transform: isEmpHovered ? 'scale(1.15)' : 'scale(1)',
                                    transition: 'all 200ms ease',
                                    ...serif,
                                  }}
                                  title={`${e.nombre} · ${e.puesto}`}
                                >
                                  {e.ini}
                                </div>
                              );
                            })}
                            <div style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: pal.muted, fontWeight: 600 }}>
                              {gente.length}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 05 — Lo humano
   --------------------------------------------------------- */

function TarjetaHito({ mono: monoColor, titulo, icono, gradiente, borde, animName, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => { if (hoverFino()) setHovered(true); }}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        padding: '28px 28px 30px',
        background: 'rgba(255, 253, 249, 0.95)',
        border: `1px solid ${hovered ? pal.coral : borde}`,
        borderRadius: 24,
        overflow: 'hidden',
        boxShadow: hovered
          ? '0 20px 40px -15px oklch(20% 0.02 30 / 0.18), 0 4px 14px rgba(0,0,0,0.04)'
          : '0 8px 24px -10px rgba(0,0,0,0.05)',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 100% 0%, oklch(90% 0.13 55 / 0.25), transparent 55%)',
          animation: `${animName} 12s ease-in-out infinite`,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ ...mono, marginBottom: 6, color: monoColor }}>{titulo}</div>
          </div>
          <div style={{ fontSize: 36, lineHeight: 1, color: monoColor, ...serif }}>{icono}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

function HitosSection({ empsActivos }) {
  const [hoveredRowId, setHoveredRowId] = useState(null);

  const conFecha = empsActivos.map((e, idx) => ({ e, i: idx, f: parseFecha(e.ingreso) })).filter((x) => x.f);
  // Total real de aniversarios próximos — el conteo del titular usa este
  // total, no la lista ya recortada a 3 filas visibles (antes contaba
  // después del `.slice(0,3)`, así que con 4+ aniversarios siempre decía
  // "3" aunque hubiera más — auditoría "Aniversarios ✦ N próximos").
  const proximosTodos = conFecha
    .map((x) => ({ ...x, ...proximoAniversario(x.f, HOY) }))
    .filter((x) => x.dias <= 60)
    .sort((a, b) => a.dias - b.dias);
  const proximos = proximosTodos.slice(0, 3);

  const salarios = empsActivos.map((e) => e.salario);
  const min = salarios.length ? Math.min(...salarios) : 0;
  const max = salarios.length ? Math.max(...salarios) : 0;
  const prom = salarios.length ? salarios.reduce((a, b) => a + b, 0) / salarios.length : 0;
  const empMin = empsActivos.find((e) => e.salario === min);
  const empMax = empsActivos.find((e) => e.salario === max);

  // Ratio para el indicador de espectro salarial (entre min y max)
  const rangeSpan = max - min || 1;
  const promPct = Math.min(100, Math.max(0, ((prom - min) / rangeSpan) * 100));

  const canalesMap = new Map();
  empsActivos.forEach((e) => {
    const key = canalDe(e.banco);
    if (!canalesMap.has(key)) canalesMap.set(key, []);
    canalesMap.get(key).push(e);
  });
  const canales = [...canalesMap.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <section id="equipo-humano" style={{ padding: '0 56px 56px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 05 · lo humano</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            Lo que <em style={{ fontStyle: 'italic' }}>cuenta</em> del equipo
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <span style={mono}>Datos reales del equipo</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }} className="ed-grid-3">
        {/* HITO 1: Aniversarios Próximos */}
        <TarjetaHito
          mono="oklch(45% 0.13 55)"
          titulo="Aniversarios"
          icono="✦"
          gradiente="linear-gradient(160deg, rgba(255, 252, 248, 0.98), oklch(96% 0.04 65 / 0.4))"
          borde="oklch(88% 0.015 55)"
          animName="ed-aurora"
        >
          <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 4, color: pal.ink, ...serif }}>
            {proximosTodos.length === 0 ? 'Ninguno' : proximosTodos.length === 1 ? 'Uno' : proximosTodos.length} <em style={{ fontStyle: 'italic' }}>próximos</em>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16, marginTop: 14, borderTop: `1px dashed ${pal.line2}` }}>
            {proximosTodos.length === 0 && <CampoVacio>Nadie cumple aniversario laboral en los próximos 60 días.</CampoVacio>}
            {proximos.map((x) => {
              const ac = acentoDe(x.i);
              const isRowHovered = hoveredRowId === x.e.id;

              return (
                <div
                  key={x.e.id}
                  onMouseEnter={() => { if (hoverFino()) setHoveredRowId(x.e.id); }}
                  onMouseLeave={() => setHoveredRowId(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '6px 8px',
                    borderRadius: 12,
                    background: isRowHovered ? pal.cream2 : 'transparent',
                    transition: 'all 200ms ease',
                    transform: isRowHovered ? 'translateX(3px)' : 'translateX(0)',
                  }}
                >
                  <div style={{ textAlign: 'center', minWidth: 40 }}>
                    <div style={{ fontSize: 24, lineHeight: 1, color: 'oklch(35% 0.13 55)', fontStyle: 'italic', ...serif }}>{String(x.fecha.getDate()).padStart(2, '0')}</div>
                    <div style={{ ...mono, fontSize: 8, color: 'oklch(45% 0.13 55)' }}>{MESES_ABR[x.fecha.getMonth()]}</div>
                  </div>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      background: `linear-gradient(135deg, ${ac.g1}, ${ac.g2})`,
                      border: `1.5px solid ${isRowHovered ? pal.coral : pal.gold}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontStyle: 'italic',
                      fontSize: 13,
                      color: ac.ink,
                      boxShadow: isRowHovered ? '0 4px 12px oklch(70% 0.16 30 / 0.35)' : 'none',
                      transform: isRowHovered ? 'scale(1.12)' : 'scale(1)',
                      transition: 'all 200ms ease',
                      ...serif,
                    }}
                  >
                    {x.e.ini}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, lineHeight: 1.1, color: pal.ink, ...serif }}>
                      {x.e.nombre.split(' ')[0]} llega a <span style={{ fontStyle: 'italic' }}>{x.anios} {x.anios === 1 ? 'año' : 'años'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'oklch(45% 0.10 55)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 4, height: 4, borderRadius: 999, background: pal.gold, animation: 'ed-dot-glow 2s ease-in-out infinite' }} />
                      en {x.dias} {x.dias === 1 ? 'día' : 'días'} · {x.weekday}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TarjetaHito>

        {/* HITO 2: Espectro Salarial Interactivo */}
        <TarjetaHito
          mono="oklch(35% 0.13 250)"
          titulo="Salarios"
          icono="₡"
          gradiente="linear-gradient(160deg, rgba(255, 252, 248, 0.98), oklch(95% 0.03 250 / 0.4))"
          borde="oklch(88% 0.015 55)"
          animName="ed-aurora"
        >
          <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 4, color: pal.ink, ...serif }}>
            El <em style={{ fontStyle: 'italic' }}>rango</em> del equipo
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 16, marginTop: 14, borderTop: `1px dashed ${pal.line2}` }}>
            {/* Medidor visual de espectro salarial */}
            <div style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, ...mono, marginBottom: 6 }}>
                <span>Mínimo</span>
                <span>Promedio</span>
                <span>Máximo</span>
              </div>
              <div style={{ position: 'relative', height: 8, borderRadius: 999, background: pal.line2, overflow: 'hidden' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(90deg, oklch(80% 0.08 220), oklch(85% 0.14 75), oklch(70% 0.16 30))',
                    borderRadius: 999,
                  }}
                />
                {/* Indicador de Promedio */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${promPct}%`,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    background: pal.paper,
                    boxShadow: '0 0 8px oklch(0% 0 0 / 0.6)',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: pal.muted }}>Más alto{empMax ? ` · ${empMax.nombre.split(' ')[0]}` : ''}</span>
              <span style={{ color: pal.ink, fontWeight: 600, ...num, ...serif, fontSize: 16 }}>{money(max)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: pal.muted }}>Promedio equipo</span>
              <span style={{ color: pal.ink, fontWeight: 600, ...num, ...serif, fontSize: 16 }}>{money(prom)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: pal.muted }}>Más bajo{empMin ? ` · ${empMin.nombre.split(' ')[0]}` : ''}</span>
              <span style={{ color: pal.ink, fontWeight: 600, ...num, ...serif, fontSize: 16 }}>{money(min)}</span>
            </div>
          </div>
        </TarjetaHito>

        {/* HITO 3: Canales de Pago */}
        <TarjetaHito
          mono={pal.deepGreen}
          titulo="Canales de pago"
          icono="◐"
          gradiente="linear-gradient(160deg, rgba(255, 252, 248, 0.98), oklch(95% 0.04 145 / 0.4))"
          borde="oklch(88% 0.015 55)"
          animName="ed-aurora-2"
        >
          <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 4, color: pal.ink, ...serif }}>
            Cómo <em style={{ fontStyle: 'italic' }}>cobra</em> cada quien
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16, marginTop: 14, borderTop: `1px dashed ${pal.line2}` }}>
            {canales.map(([canalName, gente]) => {
              const pct = Math.round((gente.length / empsActivos.length) * 100);
              return (
                <div key={canalName} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <span style={{ color: pal.ink, fontWeight: 600 }}>{canalName}</span>
                    <span style={{ color: pal.deepGreen, fontWeight: 600, ...num }}>
                      {gente.length} {gente.length === 1 ? 'persona' : 'personas'} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: pal.line2, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, oklch(75% 0.12 145), oklch(85% 0.14 75))',
                        borderRadius: 999,
                        transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </TarjetaHito>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 06 — El cierre (Atmósfera Satinada & Acción)
   --------------------------------------------------------- */

/**
 * Constancia laboral real de una persona, en texto plano — no hay librería
 * de PDF en el proyecto, así que se entrega como documento de texto
 * descargable e imprimible en vez de simular un botón que no genera nada.
 * Usa únicamente datos reales ya presentes en la ficha del empleado y en
 * Configuración (empresa, actividad, usuario que la emite); no inventa
 * ningún dato ni fórmula legal.
 */
function generarConstanciaLaboral(emp, empresaNombre, actividad, usuario) {
  const ingresoObj = parseFecha(emp.ingreso);
  const ant = ingresoObj ? antiguedad(ingresoObj, HOY) : null;
  const lineas = [
    'CONSTANCIA LABORAL',
    '',
    empresaNombre || '(empresa sin nombre configurado)',
    actividad ? `Actividad económica: ${actividad}` : '',
    '',
    'A quien interese:',
    '',
    `${empresaNombre || 'Esta empresa'} hace constar que ${emp.nombre}, portador(a) de la cédula ${emp.cedula || 'sin registrar'}, labora para esta empresa desde el ${emp.ingreso || 'sin registrar'}${ant ? ` (${antiguedadFmt(ant)} de antigüedad)` : ''}, desempeñando el puesto de ${emp.puesto || 'sin registrar'} en modalidad de ${emp.tipo || 'sin registrar'}, con un salario mensual de ${money(emp.salario || 0)}.`,
    '',
    emp.activo
      ? 'A la fecha de esta constancia, la persona se encuentra activa en la empresa.'
      : 'Esta persona ya no forma parte activa del equipo a la fecha de esta constancia.',
    '',
    `Se extiende la presente constancia a solicitud de la parte interesada, el ${fechaLarga(HOY)}.`,
    '',
    '',
    '_________________________',
    usuario?.nombre || '',
    usuario?.rol || '',
    empresaNombre || '',
  ].filter((l) => l !== null && l !== undefined);

  const blob = new Blob([`﻿${lineas.join('\r\n')}`], { type: 'text/plain;charset=utf-8;' });
  const nombreArchivo = `constancia-laboral-${emp.nombre.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${sufijoFecha(HOY)}.txt`;
  descargarBlob(blob, nombreArchivo);
}

/**
 * Descarga real del equipo en CSV, con los datos que ya viven en la ficha de
 * cada persona (identidad, contrato y los montos derivados de la planilla
 * activa). Antes este botón estaba deshabilitado con un "Todavía no está
 * conectado" aunque toda la información ya existiera en pantalla.
 */
function exportarEquipoCsv(emps) {
  const filas = [
    [
      'Nombre', 'Puesto', 'Jornada', 'Estado', 'Cédula', 'Teléfono', 'Fecha de ingreso',
      'Nacimiento', 'Contacto de emergencia', 'Cuenta / método', 'Salario mensual',
      'Bruto del período', 'Deducción CCSS', 'Neto del período', 'Cargas patronales + INS', 'Costo del período',
      'Estado de pago', 'Método usado', 'Fecha de pago',
    ],
    ...emps.map((e) => [
      e.nombre,
      e.puesto,
      e.tipo,
      e.activo ? 'Activo' : 'De baja',
      e.cedula,
      e.tel,
      e.ingreso,
      e.nacimiento || '',
      e.emergencia || '',
      e.banco,
      e.salario.toFixed(0),
      e.brutoQ.toFixed(0),
      e.ded.toFixed(0),
      e.neto.toFixed(0),
      e.car.toFixed(0),
      e.costoQ.toFixed(0),
      e.pago === 'pagado' ? 'Pagado' : 'Pendiente',
      e.metodo,
      e.fechaPago,
    ]),
  ];
  descargarCsv(`equipo-${sufijoFecha(HOY)}`, filas);
}

function CierreSection({ emps, empsActivos, tasas, onCrear }) {
  const [modalNuevo, setModalNuevo] = useState(false);
  const bajas = emps.filter((e) => !e.activo).length;
  const canales = new Set(empsActivos.map((e) => canalDe(e.banco))).size;

  const conFecha = empsActivos.map((e, idx) => ({ e, i: idx, f: parseFecha(e.ingreso) })).filter((x) => x.f);
  const proximo = conFecha
    .map((x) => ({ ...x, ...proximoAniversario(x.f, HOY) }))
    .sort((a, b) => a.dias - b.dias)[0];

  const total = empsActivos.reduce((a, e) => a + e.salario, 0) || 1;
  const carRate = (() => {
    const ref = empsActivos.find((e) => e.brutoQ > 0);
    return ref ? ref.costoQ / ref.brutoQ - 1 : tasas?.cargasPatronales || 0;
  })();
  const cargas = total * carRate;

  return (
    <section id="equipo-cierre" style={{ padding: '0 56px 88px' }}>
      <div
        style={{
          position: 'relative',
          background: 'linear-gradient(160deg, oklch(90% 0.06 320) 0%, oklch(88% 0.08 30) 50%, oklch(90% 0.08 60) 100%)',
          backgroundSize: '200% 200%',
          animation: 'ed-gradient-shift 14s ease-in-out infinite',
          borderRadius: 32,
          padding: '56px 64px',
          overflow: 'hidden',
          boxShadow: '0 30px 60px -30px oklch(20% 0.02 30 / 0.3)',
          border: `1px solid ${pal.line}`,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-30%', right: '-15%', width: '60%', height: '120%', background: 'radial-gradient(circle, oklch(92% 0.10 30 / 0.45), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora 11s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '-40%', left: '-10%', width: '50%', height: '100%', background: 'radial-gradient(circle, oklch(88% 0.10 320 / 0.32), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora-2 13s ease-in-out infinite' }} />
        </div>

        <div className="ed-grid-2" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '8fr 4fr', gap: 56, alignItems: 'start', zIndex: 2 }}>
          <div>
            <div style={{ ...mono, color: 'oklch(28% 0.08 30)', marginBottom: 18 }}>Cierre · el equipo hoy</div>
            <div style={{ fontSize: 62, lineHeight: 1.02, letterSpacing: '-0.02em', color: pal.ink, marginBottom: 20, ...serif }}>
              {numeroCapitalizado(empsActivos.length)} personas,{' '}
              <em style={{ fontStyle: 'italic', textDecoration: 'underline', textDecorationColor: pal.coral, textDecorationThickness: 2, textUnderlineOffset: 6 }}>un solo turno</em>
              <br />
              al frente del negocio.
            </div>
            <p style={{ fontSize: 19, fontStyle: 'italic', lineHeight: 1.5, color: 'oklch(30% 0.06 30)', maxWidth: 640, margin: '0 0 28px', ...serif }}>
              El equipo está {bajas === 0 ? 'estable, sin bajas registradas' : `compuesto por ${empsActivos.length} personas activas y ${bajas} ${bajas === 1 ? 'baja' : 'bajas'} registrada${bajas === 1 ? '' : 's'}`}.{' '}
              {proximo ? `El próximo hito es el aniversario de ${proximo.e.nombre.split(' ')[0]}, en ${proximo.dias} días.` : ''}
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setModalNuevo(true)}
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
                  boxShadow: '0 12px 30px -10px oklch(20% 0.02 30 / 0.4)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform 200ms ease',
                }}
                onMouseEnter={(ev) => { if (hoverFino()) ev.currentTarget.style.transform = 'scale(1.03)'; }}
                onMouseLeave={(ev) => { ev.currentTarget.style.transform = 'scale(1)'; }}
              >
                <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 40%, oklch(100% 0 0 / 0.15) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'ed-shine-sweep 4s ease-in-out infinite' }} />
                <span style={{ position: 'relative' }}>Agregar a alguien nuevo</span>
                <span style={{ position: 'relative', fontSize: 16 }}>+</span>
              </button>

              <button
                type="button"
                onClick={() => exportarEquipoCsv(emps)}
                title="Descarga la ficha completa del equipo en CSV"
                style={{ padding: '14px 22px', background: 'rgba(255, 252, 248, 0.65)', color: pal.ink, border: `1px solid ${pal.line}`, borderRadius: 14, fontSize: 14, cursor: 'pointer' }}
              >
                Descargar planilla del equipo
              </button>
            </div>

            <div style={{ marginTop: 36, paddingTop: 26, borderTop: '1px solid oklch(30% 0.06 30 / 0.18)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32 }} className="ed-grid-3">
              <div>
                <div style={{ ...mono, color: 'oklch(28% 0.08 30)', marginBottom: 6 }}>Bajas registradas</div>
                <div style={{ fontSize: 28, color: pal.ink, ...num, ...serif }}>{bajas}</div>
                <div style={{ fontSize: 12, fontStyle: 'italic', color: 'oklch(30% 0.06 30)', marginTop: 2, ...serif }}>{bajas === 0 ? 'nadie se ha dado de baja' : `de ${emps.length} personas en el sistema`}</div>
              </div>
              <div>
                <div style={{ ...mono, color: 'oklch(28% 0.08 30)', marginBottom: 6 }}>Contratos vigentes</div>
                <div style={{ fontSize: 28, color: pal.ink, ...num, ...serif }}>
                  {empsActivos.length} / {emps.length}
                </div>
                <div style={{ fontSize: 12, fontStyle: 'italic', color: 'oklch(30% 0.06 30)', marginTop: 2, ...serif }}>activos sobre el total</div>
              </div>
              <div>
                <div style={{ ...mono, color: 'oklch(28% 0.08 30)', marginBottom: 6 }}>Canales de pago</div>
                <div style={{ fontSize: 28, color: pal.ink, ...num, ...serif }}>{canales}</div>
                <div style={{ fontSize: 12, fontStyle: 'italic', color: 'oklch(30% 0.06 30)', marginTop: 2, ...serif }}>formas distintas de cobrar</div>
              </div>
            </div>
          </div>

          <div style={{ position: 'relative', padding: '28px 30px', background: 'rgba(255, 252, 248, 0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.6)', borderRadius: 24, boxShadow: '0 8px 24px -6px rgba(0,0,0,0.06)' }}>
            <div style={{ ...mono, color: 'oklch(28% 0.06 30)', marginBottom: 16 }}>Reparto de la nómina · mensual</div>

            <div style={{ height: 22, borderRadius: 8, overflow: 'hidden', display: 'flex', marginBottom: 18 }}>
              {empsActivos.map((e, idx) => {
                const ac = acentoDe(idx);
                const w = (e.salario / total) * 100;
                return (
                  <div key={e.id} style={{ width: `${w}%`, background: `linear-gradient(180deg, ${ac.g1}, ${ac.g2})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={`${e.nombre} ${money(e.salario)}`}>
                    {w > 6 && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: ac.ink }}>{e.ini}</span>}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'oklch(30% 0.06 30)' }}>Total planilla bruta</span>
                <span style={{ color: pal.ink, fontWeight: 600, ...num, ...serif }}>{money(total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'oklch(30% 0.06 30)' }}>Cargas patronales</span>
                <span style={{ color: pal.coral, fontWeight: 600, ...num, ...serif }}>+{money(cargas)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid oklch(30% 0.06 30 / 0.15)' }}>
                <span style={{ color: 'oklch(30% 0.06 30)', fontWeight: 600 }}>Costo real del equipo</span>
                <span style={{ color: pal.ink, fontSize: 20, fontWeight: 600, ...num, ...serif }}>{money(total + cargas)}</span>
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid oklch(30% 0.06 30 / 0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: pal.ink, color: pal.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, ...serif }}>◐</div>
              <div style={{ fontSize: 14, fontStyle: 'italic', color: 'oklch(30% 0.04 30)', lineHeight: 1.35, ...serif }}>"Un equipo estable vale más que uno grande."</div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={modalNuevo} onClose={() => setModalNuevo(false)} title="Nuevo empleado" width={560}>
        <EmpleadoForm
          onCancel={() => setModalNuevo(false)}
          onSubmit={(datos) => {
            onCrear(datos);
            setModalNuevo(false);
          }}
        />
      </Modal>
    </section>
  );
}

/* ---------------------------------------------------------
   Footer + Dock
   --------------------------------------------------------- */

function Footer({ empsActivos }) {
  return (
    <footer
      style={{
        padding: '20px 56px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: pal.muted,
        borderTop: `1px solid ${pal.line}`,
        flexWrap: 'wrap',
        gap: 10,
      }}
    >
      <span>
        Equipo · {empsActivos.length} activos · {MESES_LARGO[HOY.mesIndice]} {HOY.anio}
      </span>
      <span style={{ fontStyle: 'italic', fontSize: 14, textTransform: 'none', letterSpacing: 0, color: 'oklch(35% 0.03 30)', ...serif }}>
        Detrás de cada quincena hay una persona.
      </span>
      <span>© {HOY.anio} · Gestión Laboral</span>
    </footer>
  );
}

function Dock({ onIrAlElenco, onAgregar }) {
  return (
    <div style={{ position: 'sticky', bottom: 20, margin: '-36px auto 0', width: 'fit-content', display: 'flex', justifyContent: 'center', zIndex: 20 }}>
      <div className="ed-dock" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: pal.ink, color: pal.cream, padding: '8px 8px 8px 20px', borderRadius: 999, boxShadow: '0 24px 60px -20px oklch(20% 0.02 30 / 0.5)' }}>
        <span style={{ ...mono, color: 'oklch(70% 0.02 60)', fontSize: 10 }}>Equipo</span>
        <span style={{ width: 1, height: 16, background: 'oklch(40% 0.02 30)', margin: '0 6px' }} />
        <button type="button" onClick={onIrAlElenco} style={{ padding: '9px 16px', background: 'transparent', color: 'oklch(88% 0.03 60)', border: 'none', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
          Ver todos
        </button>
        <button type="button" onClick={onIrAlElenco} style={{ padding: '9px 16px', background: 'transparent', color: 'oklch(88% 0.03 60)', border: 'none', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
          Constancias
        </button>
        <button
          type="button"
          onClick={onAgregar}
          style={{ padding: '9px 18px', background: pal.gold, color: pal.ink, border: 'none', borderRadius: 999, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
        >
          + Agregar persona
        </button>
      </div>
    </div>
  );
}

const EQUIPO_SECTIONS = [
  { key: 'hero', label: 'Resumen' },
  { key: 'elenco', label: 'Elenco' },
  { key: 'expediente', label: 'Expediente' },
  { key: 'cartografia', label: 'Cartografía' },
  { key: 'hitos', label: 'Hitos' },
  { key: 'cierre', label: 'Cierre' },
];

export default function Empleados({ emps, selEmp, onSelect, onCrear, onEditar, onAlternarActivo, onEliminar, getHistorial, tasas, usuario, empresaNombre, actividad, notificaciones, onNotifClick, onNavigate, abrirNuevo, onNuevoAbierto }) {
  const [modalNuevoDock, setModalNuevoDock] = useState(false);

  // "Agregar empleado" desde las acciones rápidas del Home antes solo
  // navegaba hasta acá sin abrir el formulario — ahora sí lo abre de verdad.
  useEffect(() => {
    if (abrirNuevo) {
      setModalNuevoDock(true);
      onNuevoAbierto?.();
    }
  }, [abrirNuevo, onNuevoAbierto]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('activos'); // 'activos' | 'inactivos' | 'todos'
  const empsActivos = useMemo(() => emps.filter((e) => e.activo), [emps]);

  // Búsqueda por nombre/cédula + filtro de estado, sobre la lista completa real (`emps`).
  // El elenco y el selector de expediente reflejan este resultado; el resto de las
  // secciones (resumen, cartografía, hitos, cierre) sigue mostrando al equipo activo real.
  const personas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return emps.filter((e) => {
      if (filtroEstado === 'activos' && !e.activo) return false;
      if (filtroEstado === 'inactivos' && e.activo) return false;
      if (!q) return true;
      return e.nombre.toLowerCase().includes(q) || (e.cedula || '').toLowerCase().includes(q);
    });
  }, [emps, busqueda, filtroEstado]);

  // El expediente abierto nunca cambia de persona por sí solo cuando el
  // filtro/búsqueda local deja afuera a quien se estaba viendo (p. ej. dar
  // de baja a alguien mientras el filtro está en "Activos") — antes
  // saltaba en silencio a `personas[0]`, y los botones "Eliminar"/"Dar de
  // baja" que seguían en pantalla terminaban apuntando a otra persona sin
  // ningún aviso (auditoría F8). Solo se usa `personas[0]` cuando de
  // verdad no hay nadie seleccionado todavía.
  const selEmpVisible = selEmp || personas[0] || null;

  const sectionRefs = useRef({});
  const setSectionRef = (key) => (el) => {
    sectionRefs.current[key] = el;
  };

  function irAlElenco() {
    const el = document.getElementById('equipo-expediente');
    const scrollEl = document.getElementById('app-content');
    if (!el || !scrollEl) return;
    scrollEl.scrollTo({ top: Math.max(0, el.offsetTop - 24), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  return (
    <div className="screen ed-home" style={{ fontFamily: "'Albert Sans', system-ui, sans-serif", color: pal.ink, background: pal.cream, minHeight: '100%' }}>
      <ScrollRail sectionRefs={sectionRefs} sections={EQUIPO_SECTIONS} />

      <div style={{ maxWidth: 1440, margin: '0 auto', position: 'relative' }}>
        <Masthead
          empsActivos={empsActivos}
          onNavigate={onNavigate}
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          filtroEstado={filtroEstado}
          onFiltroEstadoChange={setFiltroEstado}
          usuario={usuario}
          notificaciones={notificaciones}
          onNotifClick={onNotifClick}
        />

        <div id="eq-sec-hero" ref={setSectionRef('hero')}>
          <Seccion01Hero empsActivos={empsActivos} emps={emps} onCrear={onCrear} onIrAlElenco={irAlElenco} />
        </div>

        <div id="eq-sec-elenco" ref={setSectionRef('elenco')}>
          <ElencoSection personas={personas} empsActivos={empsActivos} selEmp={selEmpVisible} onAbrir={onSelect} />
        </div>

        <div id="equipo-expediente" ref={setSectionRef('expediente')}>
          <ExpedienteSection
            personas={personas}
            selEmp={selEmpVisible}
            onSelect={onSelect}
            getHistorial={getHistorial}
            onEditar={onEditar}
            onAlternarActivo={onAlternarActivo}
            onEliminar={onEliminar}
            empresaNombre={empresaNombre}
            actividad={actividad}
            usuario={usuario}
            onNavigate={onNavigate}
          />
        </div>

        <div id="eq-sec-cartografia" ref={setSectionRef('cartografia')}>
          <CartografiaSection empsActivos={empsActivos} emps={emps} />
        </div>

        <div id="eq-sec-hitos" ref={setSectionRef('hitos')}>
          <HitosSection empsActivos={empsActivos} />
        </div>

        <div id="eq-sec-cierre" ref={setSectionRef('cierre')}>
          <CierreSection emps={emps} empsActivos={empsActivos} tasas={tasas} onCrear={onCrear} />
        </div>

        <Footer empsActivos={empsActivos} />
      </div>

      <Dock onIrAlElenco={irAlElenco} onAgregar={() => setModalNuevoDock(true)} />

      <Modal open={modalNuevoDock} onClose={() => setModalNuevoDock(false)} title="Nuevo empleado" width={560}>
        <EmpleadoForm
          onCancel={() => setModalNuevoDock(false)}
          onSubmit={(datos) => {
            onCrear(datos);
            setModalNuevoDock(false);
          }}
        />
      </Modal>
    </div>
  );
}
