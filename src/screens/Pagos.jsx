import { useEffect, useRef, useState } from 'react';

import { HOY } from '../data/mock.js';
import { money } from '../lib/format.js';
import { IconSearch, IconCampana, IconChevronRight } from '../components/ui/Icons.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Field, Input, Select } from '../components/ui/Form.jsx';
import { Button } from '../components/ui/Primitives.jsx';

/**
 * Pagos — "la caja abierta". Mismo lenguaje editorial que Home y Planilla
 * (paleta cream/coral/gold, Instrument Serif + JetBrains Mono, motion
 * `ed-*`), composición propia en 6 secciones tomada 1:1 de `Pagos.dc.html`.
 *
 * Los datos y la lógica son los que ya existían (`emps`, `totales`,
 * `onMarcarPagado`, `onMarcarPagadoLote`): esto es solo una nueva
 * presentación sobre las mismas props. No hay estados nuevos de negocio —
 * "listo para pagar" es simplemente `pendiente + tieneAjuste`, y "canal"
 * es el campo real `banco` de cada empleado.
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

const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function fechaLarga(hoy) {
  const weekday = new Date(hoy.anio, hoy.mesIndice, hoy.dia).toLocaleDateString('es-CR', { weekday: 'long' });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap} · ${String(hoy.dia).padStart(2, '0')} ${MESES_LARGO[hoy.mesIndice]} ${hoy.anio}`;
}

function formatK(n) {
  const miles = Math.round(n / 1000);
  return '₡' + miles.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'k';
}

/** El "canal" de pago de un empleado es su cuenta real (`banco`): primera palabra antes del " · ". */
function canalDe(banco) {
  return (banco || '').split('·')[0].trim() || 'Sin canal';
}

function canalIniciales(nombre) {
  return nombre.slice(0, 1).toUpperCase();
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

const METODOS = ['Transferencia', 'Efectivo', 'Cheque', 'SINPE Móvil'];

/* ---------------------------------------------------------
   Modal de confirmación de pago — misma lógica que ya existía
   --------------------------------------------------------- */

function PagoModal({ cantidad, onClose, onConfirmar }) {
  const [metodo, setMetodo] = useState(METODOS[0]);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <Modal open={!!cantidad} onClose={onClose} title={cantidad === 1 ? 'Marcar como pagado' : `Marcar ${cantidad || 0} pagos`} width={380}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Método de pago" htmlFor="pg-metodo">
          <Select id="pg-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {METODOS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha de pago" htmlFor="pg-fecha">
          <Input id="pg-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              const fechaFmt = new Date(fecha + 'T00:00:00').toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
              onConfirmar({ metodo, fecha: fechaFmt });
            }}
          >
            Confirmar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Masthead + barra de estado
   --------------------------------------------------------- */

function Masthead({ periodoActivo, atender, onNavigate }) {
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
        <div style={{ width: 36, height: 36, borderRadius: 12, background: pal.ink, color: pal.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, ...serif }}>
          ◐
        </div>
        <span style={{ fontSize: 22, fontStyle: 'italic', letterSpacing: '-0.01em', ...serif }}>Gestión Laboral</span>
        {periodoActivo && (
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
            {periodoActivo.etiqueta.replace('Quincena · ', '')}
          </span>
        )}
      </div>

      <nav className="ed-masthead-nav" style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 13 }}>
        {NAV_ITEMS.map((item) => {
          const active = item.key === 'pagos';
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
            Buscar pago o referencia
            <span style={{ display: 'inline-block', width: 1.5, height: 11, background: pal.coral, marginLeft: 2, verticalAlign: 'middle', animation: 'ed-cursor-blink 1.1s step-end infinite' }} />
          </span>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('calendario')}
          aria-label="Ver obligaciones pendientes"
          style={{ width: 36, height: 36, border: `1px solid ${pal.line}`, background: pal.cream2, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
        >
          <IconCampana size={14} stroke="oklch(30% 0.02 40)" />
          {atender && atender.length > 0 && (
            <span style={{ position: 'absolute', top: 7, right: 7 }}>
              <Dot c={pal.coral} glow size={7} />
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

function StatusBar({ pagadosN, listosN, esperandoN }) {
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
        <span style={{ color: pal.deepGreen }}>
          ● {pagadosN} {pagadosN === 1 ? 'pagado' : 'pagados'}
        </span>
        <span style={{ color: 'oklch(50% 0.13 65)' }}>
          ● {listosN} {listosN === 1 ? 'listo' : 'listos'}
        </span>
        <span style={{ color: pal.muted }}>
          ● {esperandoN} en planilla
        </span>
      </span>
      <span>Caja abierta</span>
    </div>
  );
}

/* ---------------------------------------------------------
   Sección 01 — Hero: la caja abierta
   --------------------------------------------------------- */

function RioDinero() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: 60,
          right: -60,
          width: 780,
          height: 480,
          background: 'radial-gradient(ellipse at 30% 30%, oklch(88% 0.10 55 / 0.4), transparent 55%), radial-gradient(ellipse at 75% 70%, oklch(85% 0.11 145 / 0.26), transparent 60%)',
          animation: 'ed-aurora 12s ease-in-out infinite',
          filter: 'blur(2px)',
        }}
      />
      <svg style={{ position: 'absolute', top: 80, right: 0, width: 780, height: 460 }} viewBox="0 0 780 460" fill="none">
        <defs>
          <linearGradient id="pg-riv-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="oklch(85% 0.14 65)" stopOpacity="0.35" />
            <stop offset="1" stopColor="oklch(85% 0.14 65)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pg-riv-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="oklch(72% 0.12 145)" />
            <stop offset=".5" stopColor="oklch(85% 0.14 65)" />
            <stop offset="1" stopColor="oklch(70% 0.16 30)" />
          </linearGradient>
        </defs>
        <path d="M-20,300 Q140,270 260,290 T500,280 T760,300 T800,310 L800,460 L-20,460 Z" fill="url(#pg-riv-fill)" />
        <path d="M-20,300 Q140,270 260,290 T500,280 T760,300" stroke="url(#pg-riv-line)" strokeWidth="2" fill="none" strokeDasharray="1600" style={{ animation: 'ed-stroke-draw 2.4s ease-out both' }} />
        <path d="M-20,340 Q140,320 260,330 T500,320 T760,340" stroke="oklch(70% 0.13 30)" strokeWidth="1" fill="none" opacity="0.5" style={{ animation: 'ed-wave-drift 8s ease-in-out infinite alternate' }} />
        <path d="M-20,375 Q140,355 260,365 T500,355 T760,375" stroke="oklch(70% 0.13 30)" strokeWidth="1" fill="none" opacity="0.3" style={{ animation: 'ed-wave-drift-2 9s ease-in-out infinite' }} />
        <g style={{ animation: 'ed-float-slow 6s ease-in-out infinite' }}>
          <circle cx={180} cy={290} r={6} fill="oklch(85% 0.14 65)" opacity="0.7" />
          <circle cx={180} cy={290} r={6} fill="none" stroke="oklch(60% 0.14 65)" strokeWidth="0.8" opacity="0.8" />
        </g>
        <g style={{ animation: 'ed-float-slow 7s ease-in-out infinite 1s' }}>
          <circle cx={420} cy={278} r={5} fill="oklch(72% 0.12 145)" opacity="0.7" />
        </g>
        <g style={{ animation: 'ed-float-slow 8s ease-in-out infinite 2s' }}>
          <circle cx={620} cy={288} r={5} fill="oklch(85% 0.14 65)" opacity="0.7" />
        </g>
      </svg>
    </div>
  );
}

function GaugeSplit({ pagadoPct, listoPct, pagadoFmt, sumNetoFmt }) {
  const r = 90;
  const circ = 2 * Math.PI * r;
  const dashPagado = circ * (pagadoPct / 100);
  const dashListo = circ * (listoPct / 100);
  return (
    <svg viewBox="0 0 240 240" width="100%" height={200} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="pg-gauge-paid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(80% 0.12 145)" />
          <stop offset="1" stopColor="oklch(55% 0.14 145)" />
        </linearGradient>
      </defs>
      <circle cx="120" cy="120" r={r} stroke="oklch(92% 0.015 55)" strokeWidth="18" fill="none" />
      <circle
        cx="120"
        cy="120"
        r={r}
        stroke="url(#pg-gauge-paid)"
        strokeWidth="18"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${dashPagado} ${circ}`}
        transform="rotate(-90 120 120)"
        style={{ animation: 'ed-stroke-draw 1.8s ease-out both' }}
      />
      {dashListo > 0 && (
        <circle
          cx="120"
          cy="120"
          r={r}
          stroke={pal.gold}
          strokeWidth="18"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dashListo} ${circ}`}
          strokeDashoffset={-dashPagado}
          transform="rotate(-90 120 120)"
          style={{ animation: 'ed-stroke-draw-sm 1.5s ease-out 800ms both' }}
        />
      )}
      <circle cx="120" cy="120" r={r} stroke="oklch(75% 0.02 55)" strokeWidth="2" fill="none" strokeDasharray="4 12" opacity="0.5" transform="rotate(-90 120 120)" />
      <text x="120" y="112" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="10" fill="oklch(48% 0.02 40)" letterSpacing="1.5">
        EJECUTADO
      </text>
      <text x="120" y="150" textAnchor="middle" fontFamily="Instrument Serif, serif" fontSize="42" fill="oklch(20% 0.02 30)" letterSpacing="-1">
        {pagadoFmt}
      </text>
      <text x="120" y="172" textAnchor="middle" fontFamily="Instrument Serif, serif" fontStyle="italic" fontSize="14" fill="oklch(45% 0.02 40)">
        de {sumNetoFmt} neto
      </text>
    </svg>
  );
}

function Seccion01Hero({ pagados, listos, esperando, totales, onPagar, onIrAlMostrador, onVerLibro }) {
  const primerListo = listos[0];
  const pagadoPctNum = totales.sumNeto > 0 ? Math.round((pagados.reduce((a, e) => a + e.neto, 0) / totales.sumNeto) * 100) : 0;
  const listoPctNum = totales.sumNeto > 0 ? Math.round((listos.reduce((a, e) => a + e.neto, 0) / totales.sumNeto) * 100) : 0;
  const sumPagados = pagados.reduce((a, e) => a + e.neto, 0);
  const sumListos = listos.reduce((a, e) => a + e.neto, 0);
  const sumEsperando = esperando.reduce((a, e) => a + e.neto, 0);

  return (
    <section style={{ position: 'relative', padding: '68px 56px 40px', overflow: 'hidden' }}>
      <RioDinero />
      <div className="ed-grid-hero" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '8fr 4fr', gap: 48, alignItems: 'end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
            <span style={{ width: 32, height: 1, background: pal.ink }} />
            <span style={{ ...mono, color: pal.ink }}>Pagos · sección 01</span>
            <Dot c={pal.sage} glow />
            <span style={{ ...mono, color: pal.deepGreen }}>Caja abierta</span>
          </div>

          <h1 className="ed-hero-title" style={{ fontSize: 104, lineHeight: 0.92, margin: '0 0 18px', letterSpacing: '-0.03em', color: pal.ink, animation: 'ed-fade-up 900ms ease-out both', ...serif }}>
            <em
              style={{
                fontStyle: 'italic',
                background: 'linear-gradient(135deg, oklch(45% 0.11 145), oklch(60% 0.16 30))',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
              }}
            >
              {listos.length + esperando.length === 0 ? 'Todo pagado' : `${listos.length + esperando.length} ${listos.length + esperando.length === 1 ? 'pago espera' : 'pagos esperan'}`}
            </em>
            <br />
            {listos.length + esperando.length === 0 ? 'esta quincena.' : 'tu firma.'}
          </h1>

          <p style={{ fontSize: 24, fontStyle: 'italic', lineHeight: 1.35, margin: '0 0 32px', maxWidth: 660, color: 'oklch(35% 0.03 30)', animation: 'ed-fade-up 900ms ease-out 200ms both', ...serif }}>
            {pagados.length > 0 ? `${pagados.length} ${pagados.length === 1 ? 'ya salió' : 'ya salieron'} esta quincena. ` : ''}
            {primerListo
              ? `${primerListo.nombre.split(' ')[0]} quedó lista — arrancá con ${primerListo.nombre.split(' ')[0].endsWith('a') ? 'ella' : 'él'}.`
              : esperando.length > 0
                ? 'Nadie está listo todavía —'
                : ''}
            {esperando.length > 0 ? ` Los otros ${esperando.length} siguen componiéndose en planilla.` : ''}
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {primerListo ? (
              <button
                type="button"
                onClick={() => onPagar([primerListo.id])}
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
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 40%, oklch(100% 0 0 / 0.15) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'ed-shine-sweep 4s ease-in-out infinite' }} />
                <span style={{ position: 'relative' }}>
                  Pagar a {primerListo.nombre.split(' ')[0]} · {primerListo.netoFmt}
                </span>
                <IconChevronRight size={14} stroke="currentColor" style={{ position: 'relative' }} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateFallback()}
                style={{ padding: '14px 26px', background: pal.ink, color: pal.cream, border: 'none', borderRadius: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                Ir a planilla a firmar ajustes
              </button>
            )}
            <button
              type="button"
              onClick={onVerLibro}
              style={{ padding: '14px 22px', background: pal.cream2, color: pal.ink, border: `1px solid ${pal.line}`, borderRadius: 14, fontSize: 14, cursor: 'pointer' }}
            >
              Ver historial de pagos ↓
            </button>
          </div>
        </div>

        <div style={{ position: 'relative', padding: '22px 24px 20px', background: 'oklch(99% 0.006 70 / 0.7)', border: '1px solid oklch(88% 0.02 55 / 0.6)', borderRadius: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={mono}>El movimiento del período</span>
            <span style={{ ...mono, color: pal.sage }}>{totales.pagoPct} ejecutado</span>
          </div>
          <GaugeSplit pagadoPct={pagadoPctNum} listoPct={listoPctNum} pagadoFmt={totales.pagadoFmt} sumNetoFmt={totales.sumNetoFmt} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10, paddingTop: 14, borderTop: `1px solid ${pal.line2}` }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'linear-gradient(135deg, oklch(80% 0.12 145), oklch(55% 0.14 145))' }} />
                <span style={{ ...mono, fontSize: 8 }}>Pagado</span>
              </div>
              <div style={{ fontSize: 15, marginTop: 2, ...num, ...serif }}>
                {formatK(sumPagados)} · {pagados.length}
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: pal.gold }} />
                <span style={{ ...mono, fontSize: 8 }}>Listo</span>
              </div>
              <div style={{ fontSize: 15, marginTop: 2, ...num, ...serif }}>
                {formatK(sumListos)} · {listos.length}
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'oklch(75% 0.02 55)' }} />
                <span style={{ ...mono, fontSize: 8 }}>Planilla</span>
              </div>
              <div style={{ fontSize: 15, marginTop: 2, ...num, ...serif }}>
                {formatK(sumEsperando)} · {esperando.length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  function onNavigateFallback() {
    onIrAlMostrador();
  }
}

/* ---------------------------------------------------------
   Sección 02 — El pulso de la caja (cinta oscura)
   --------------------------------------------------------- */

function PulsoCaja({ emps, pagados, listos, esperando, totales, canales }) {
  const primerListo = listos[0];
  const base = totales.sumNeto || 1;

  return (
    <section
      style={{
        margin: '0 56px 56px',
        position: 'relative',
        borderRadius: 32,
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${pal.ink} 0%, ${pal.ink2} 100%)`,
        color: pal.cream,
        padding: '42px 48px 40px',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '120%', background: 'radial-gradient(circle, oklch(70% 0.13 145 / 0.28), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora 10s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '-10%', right: '-15%', width: '55%', height: '110%', background: 'radial-gradient(circle, oklch(85% 0.14 65 / 0.28), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora-2 12s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-30%', left: '40%', width: '45%', height: '80%', background: 'radial-gradient(circle, oklch(75% 0.15 30 / 0.22), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora 14s ease-in-out infinite reverse' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 40%, oklch(100% 0 0 / 0.05) 48%, oklch(100% 0 0 / 0.08) 50%, oklch(100% 0 0 / 0.05) 52%, transparent 60%)', backgroundSize: '200% 100%', animation: 'ed-shimmer 8s ease-in-out infinite', mixBlendMode: 'overlay' }} />
      </div>

      <div className="ed-grid-pulso-caja" style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 56, alignItems: 'center' }}>
        <div>
          <div style={{ ...mono, color: 'oklch(75% 0.03 60)', marginBottom: 12 }}>A pagar hoy · si querés</div>
          <div style={{ fontSize: 78, lineHeight: 0.95, letterSpacing: '-0.02em', ...num, animation: 'ed-count-in 1s cubic-bezier(.16,1,.3,1) both', ...serif }}>
            {primerListo ? primerListo.netoFmt : money(0)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, fontSize: 13, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: 'oklch(70% 0.13 145 / 0.22)', color: 'oklch(82% 0.14 145)' }}>
              <Dot c={pal.sage} glow size={6} />
              {listos.length} {listos.length === 1 ? 'pago listo' : 'pagos listos'}
              {primerListo ? ` · ${primerListo.nombre.split(' ')[0]} ${primerListo.nombre.split(' ')[1] || ''}`.trimEnd() + '.' : ''}
            </span>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 6 }}>
            <span style={{ ...mono, color: 'oklch(75% 0.03 60)' }}>La quincena, en dinero</span>
            <span style={{ ...mono, color: 'oklch(75% 0.03 60)' }}>
              {emps.length} personas · {totales.sumNetoFmt} neto
            </span>
          </div>

          <div style={{ position: 'relative', height: 44, borderRadius: 12, overflow: 'hidden', background: 'oklch(35% 0.02 30)', display: 'flex' }}>
            {emps.map((e, i) => {
              const w = Math.max(2, (e.neto / base) * 100);
              const esListo = e.pago !== 'pagado' && e.tieneAjuste;
              const esPagado = e.pago === 'pagado';
              return (
                <div
                  key={e.id}
                  style={{
                    width: `${w}%`,
                    background: esPagado
                      ? 'linear-gradient(180deg, oklch(70% 0.13 145), oklch(55% 0.14 145))'
                      : esListo
                        ? `linear-gradient(180deg, ${pal.gold}, oklch(75% 0.16 55))`
                        : `oklch(${42 - i}% 0.02 30)`,
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRight: i < emps.length - 1 ? '1px solid oklch(30% 0.05 30)' : 'none',
                    overflow: 'hidden',
                    transformOrigin: 'left',
                    animation: `ed-bar-grow-x 900ms cubic-bezier(.16,1,.3,1) ${i * 60}ms both`,
                  }}
                  title={`${e.nombre} · ${e.netoFmt}`}
                >
                  {esListo && (
                    <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 40%, oklch(100% 0 0 / 0.4) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'ed-shimmer 5s ease-in-out infinite' }} />
                  )}
                  {w > 8 && (
                    <span style={{ position: 'relative', fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: esPagado || esListo ? 'oklch(15% 0.05 145)' : 'oklch(80% 0.03 60)', letterSpacing: '0.1em', fontWeight: esListo ? 700 : 400, whiteSpace: 'nowrap' }}>
                      {e.ini} {formatK(e.neto)}
                      {esListo ? ' · LISTO' : ''}
                    </span>
                  )}
                  {esPagado && w > 8 && (
                    <span style={{ position: 'absolute', top: 5, right: 6 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="oklch(15% 0.05 145)" strokeWidth="3">
                        <path d="M5 12l5 5 9-11" />
                      </svg>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 22, marginTop: 14, fontSize: 12, color: 'oklch(80% 0.03 60)', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: 'linear-gradient(135deg, oklch(80% 0.12 145), oklch(55% 0.14 145))' }} />
              {pagados.length} pagados · {money(pagados.reduce((a, e) => a + e.neto, 0))} · {base ? ((pagados.reduce((a, e) => a + e.neto, 0) / base) * 100).toFixed(1) : 0}%
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: `linear-gradient(135deg, ${pal.gold}, oklch(75% 0.16 55))` }} />
              {listos.length} listos · {money(listos.reduce((a, e) => a + e.neto, 0))} · {base ? ((listos.reduce((a, e) => a + e.neto, 0) / base) * 100).toFixed(1) : 0}%
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: 'oklch(45% 0.02 30)' }} />
              {esperando.length} en planilla · {money(esperando.reduce((a, e) => a + e.neto, 0))} · {base ? ((esperando.reduce((a, e) => a + e.neto, 0) / base) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>

        <div>
          <div style={{ ...mono, color: 'oklch(75% 0.03 60)', marginBottom: 14 }}>Canales</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {canales.slice(0, 3).map((c) => (
              <div key={c.canal} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', background: 'oklch(30% 0.03 30 / 0.5)', border: '1px solid oklch(45% 0.02 30 / 0.4)', borderRadius: 12, minWidth: 200 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'oklch(40% 0.05 30 / 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: 'oklch(90% 0.06 60)', ...serif }}>
                  {canalIniciales(c.canal)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'oklch(85% 0.03 60)', fontWeight: 600 }}>{c.canal}</div>
                  <div style={{ ...mono, fontSize: 9, color: 'oklch(70% 0.03 60)' }}>
                    {c.emps.length} {c.emps.length === 1 ? 'persona' : 'personas'}
                  </div>
                </div>
                <div style={{ fontSize: 14, color: 'oklch(88% 0.03 60)', ...num, ...serif }}>{formatK(c.total)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 03 — El mostrador: la cola de pagos
   --------------------------------------------------------- */

function ComprobanteGrande({ e, index, total, onPagar, onNavigate }) {
  const canal = canalDe(e.banco);
  const valorHora = e.salario / 240;
  const montoHorasExtra = valorHora * 1.5 * (e.horasExtra || 0);
  const movimientos = [];
  if (e.horasExtra > 0) movimientos.push({ label: '+ Horas extras', value: montoHorasExtra, positivo: true });
  if (e.bono > 0) movimientos.push({ label: '+ Bono', value: e.bono, positivo: true });
  if (e.deduccionPuntual > 0) movimientos.push({ label: '− Deducción', value: e.deduccionPuntual, positivo: false });
  const ajustesCount = movimientos.length;

  return (
    <article style={{ position: 'relative', background: pal.paper, borderRadius: 22, overflow: 'hidden', boxShadow: '0 30px 60px -30px oklch(20% 0.02 30 / 0.35), 0 4px 12px -6px oklch(20% 0.02 30 / 0.1)', border: `1px solid ${pal.line}` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: `repeating-linear-gradient(180deg, ${pal.cream}, ${pal.cream} 6px, transparent 6px, transparent 12px)` }} />
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 32,
          padding: '8px 16px',
          background: `linear-gradient(180deg, ${pal.gold}, oklch(75% 0.16 55))`,
          color: pal.ink,
          borderRadius: 999,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: '0.18em',
          fontWeight: 700,
          boxShadow: '0 8px 20px -8px oklch(60% 0.15 55 / 0.5)',
          zIndex: 2,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 999, background: pal.ink, animation: 'ed-dot-glow 2.4s ease-in-out infinite' }} />
        LISTO PARA PAGAR
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 90% 0%, oklch(90% 0.13 55 / 0.28), transparent 55%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', padding: '68px 40px 32px 44px' }}>
        <div className="ed-grid-comprobante-head" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 28, alignItems: 'start', paddingBottom: 24, borderBottom: `1px dashed ${pal.line}` }}>
          <div>
            <div style={{ ...mono, marginBottom: 4 }}>
              Comprobante · {String(index + 1).padStart(2, '0')} de {total}
            </div>
            <div style={{ fontSize: 14, fontStyle: 'italic', color: pal.muted, ...serif }}>
              Nº PAG–{HOY.anio}·{String(HOY.mesIndice + 1).padStart(2, '0')}{String(HOY.dia).padStart(2, '0')}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 78, height: 78, flexShrink: 0 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: 999, background: e.avBg, color: e.avC, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontStyle: 'italic', ...serif }}>{e.ini}</div>
              <span style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 999, background: pal.gold, border: `3px solid ${pal.paper}`, animation: 'ed-dot-glow 2.4s ease-in-out infinite' }} />
            </div>
            <div>
              <div style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.01em', ...serif }}>
                {e.nombre.split(' ')[0]} <em style={{ fontStyle: 'italic' }}>{e.nombre.split(' ').slice(1).join(' ')}</em>
              </div>
              <div style={{ fontSize: 15, fontStyle: 'italic', color: 'oklch(35% 0.03 30)', marginTop: 6, ...serif }}>
                {e.puesto} · quincena en curso
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ ...mono, marginBottom: 4, color: pal.muted }}>Monto a transferir</div>
            <div style={{ fontSize: 52, lineHeight: 1, letterSpacing: '-0.02em', ...num, animation: 'ed-count-in 1s cubic-bezier(.16,1,.3,1) both', ...serif }}>{e.netoFmt}</div>
          </div>
        </div>

        <div className="ed-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 36, padding: '24px 0' }}>
          <div>
            <div style={{ ...mono, marginBottom: 10 }}>Canal</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'linear-gradient(135deg, oklch(94% 0.05 145), oklch(90% 0.10 145 / 0.5))', border: '1px solid oklch(75% 0.08 145 / 0.4)', borderRadius: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: pal.sage, color: pal.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, ...serif }}>{canalIniciales(canal)}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: pal.ink }}>{e.banco}</div>
                <div style={{ fontSize: 12, color: 'oklch(30% 0.10 145)', letterSpacing: '0.06em' }}>{canal}</div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ ...mono, marginBottom: 10 }}>Composición</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px dotted ${pal.line2}` }}>
                <span style={{ color: pal.muted }}>Bruto (quincena)</span>
                <span style={{ color: pal.ink, ...num }}>{e.brutoFmt}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px dotted ${pal.line2}` }}>
                <span style={{ color: 'oklch(45% 0.12 25)' }}>− CCSS 10.67%</span>
                <span style={{ color: 'oklch(45% 0.12 25)', ...num }}>− {e.dedFmt}</span>
              </div>
              {movimientos.map((m) => (
                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px dotted ${pal.line2}` }}>
                  <span style={{ color: m.positivo ? pal.deepGreen : 'oklch(45% 0.12 25)' }}>{m.label}</span>
                  <span style={{ color: m.positivo ? pal.deepGreen : 'oklch(45% 0.12 25)', ...num }}>
                    {m.positivo ? '+' : '−'} {money(m.value)}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', marginTop: 2, borderTop: `1px solid ${pal.ink}` }}>
                <span style={{ ...mono, color: pal.ink, fontSize: 10 }}>Neto a pagar</span>
                <span style={{ color: pal.ink, fontSize: 16, ...num, ...serif }}>{e.netoFmt}</span>
              </div>
            </div>
          </div>

          <div>
            <div style={{ ...mono, marginBottom: 10 }}>Aprobaciones</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: 999, background: pal.sage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={pal.cream} strokeWidth="3">
                    <path d="M5 12l5 5 9-11" />
                  </svg>
                </div>
                <div style={{ fontSize: 12, color: pal.ink, fontWeight: 600 }}>Planilla revisada</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: 999, background: pal.sage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={pal.cream} strokeWidth="3">
                    <path d="M5 12l5 5 9-11" />
                  </svg>
                </div>
                <div style={{ fontSize: 12, color: pal.ink, fontWeight: 600 }}>Ajustes firmados · {ajustesCount}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: 999, background: 'oklch(94% 0.01 70)', border: `1.5px dashed ${pal.muted2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <span style={{ position: 'absolute', inset: 3, borderRadius: 999, background: 'oklch(70% 0.16 30 / 0.3)', animation: 'ed-dot-glow 2.4s ease-in-out infinite' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: pal.ink, fontWeight: 600 }}>Ejecución de pago</div>
                  <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.coral, ...serif }}>falta tu firma</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="ed-grid-2" style={{ paddingTop: 22, borderTop: `1px dashed ${pal.line}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontStyle: 'italic', color: 'oklch(35% 0.03 30)', ...serif }}>
            Al firmar, se marca {e.netoFmt} como pagado a {e.nombre.split(' ')[0]} por {canal}.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onNavigate('planilla')}
              style={{ padding: '11px 16px', background: 'transparent', color: pal.muted, border: `1px solid ${pal.line}`, borderRadius: 11, fontSize: 12, cursor: 'pointer' }}
            >
              Ver planilla ↗
            </button>
            <button
              type="button"
              onClick={() => onPagar([e.id])}
              style={{ padding: '12px 22px', background: pal.ink, color: pal.cream, border: 'none', borderRadius: 11, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10, position: 'relative', overflow: 'hidden' }}
            >
              <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 40%, oklch(100% 0 0 / 0.15) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'ed-shine-sweep 4s ease-in-out infinite' }} />
              <span style={{ position: 'relative' }}>Firmar y pagar</span>
              <IconChevronRight size={13} stroke="currentColor" style={{ position: 'relative' }} />
            </button>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, background: `repeating-linear-gradient(180deg, ${pal.cream}, ${pal.cream} 6px, transparent 6px, transparent 12px)` }} />
    </article>
  );
}

function FilaEsperando({ e, onNavigate }) {
  return (
    <article style={{ position: 'relative', background: pal.paper, borderRadius: 18, padding: '20px 28px', border: `1px solid ${pal.line2}`, display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 24, alignItems: 'center' }} className="ed-grid-fila-esperando">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 999, background: e.avBg, color: e.avC, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontStyle: 'italic', ...serif }}>{e.ini}</div>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.15, ...serif }}>{e.nombre}</div>
          <div style={{ fontSize: 11, color: pal.muted, marginTop: 2 }}>
            {e.puesto} · {e.tipo === 'Medio tiempo' ? 'MT' : 'TC'} · {canalDe(e.banco)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, background: 'oklch(94% 0.008 60)', color: pal.muted, fontSize: 11, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'oklch(75% 0.02 55)', border: `1.5px solid ${pal.muted2}` }} />
          Esperando revisión
        </span>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ ...mono, fontSize: 8, marginBottom: 2 }}>Estimado</div>
        <div style={{ fontSize: 22, color: pal.muted2, letterSpacing: '-0.01em', ...num, ...serif }}>≈ {e.netoFmt}</div>
      </div>

      <button type="button" onClick={() => onNavigate('planilla')} style={{ padding: '9px 16px', background: 'transparent', color: pal.muted, border: `1px solid ${pal.line}`, borderRadius: 10, fontSize: 12, cursor: 'pointer' }}>
        Ir a planilla ↗
      </button>
    </article>
  );
}

function AsideMostrador({ listos, canales, onPagarLote, onNavigate }) {
  const primerListo = listos[0];
  return (
    <aside className="ed-aside-mostrador" style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ position: 'relative', padding: '22px 24px', background: 'linear-gradient(160deg, oklch(93% 0.05 55), oklch(88% 0.10 30) 100%)', borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 20%, oklch(90% 0.14 55 / 0.4), transparent 60%)', animation: 'ed-aurora 10s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ ...mono, color: 'oklch(35% 0.08 30)', marginBottom: 10 }}>Sugerencia del día</div>
          {primerListo ? (
            <>
              <div style={{ fontSize: 22, lineHeight: 1.25, color: pal.ink, fontStyle: 'italic', ...serif }}>
                Pagá a {primerListo.nombre.split(' ')[0]} primero.
                <br />
                Su comprobante está limpio.
              </div>
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid oklch(30% 0.06 30 / 0.15)' }}>
                <div style={{ fontSize: 14, fontStyle: 'italic', color: 'oklch(30% 0.06 30)', lineHeight: 1.4, ...serif }}>
                  Los demás siguen en composición — no podés pagarlos hasta que Planilla los apruebe.
                </div>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 22, lineHeight: 1.25, color: pal.ink, fontStyle: 'italic', ...serif }}>
              Nadie está listo todavía. Andá a Planilla y firmá un ajuste para abrir el primer comprobante.
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '20px 22px', background: pal.paper, border: `1px solid ${pal.line}`, borderRadius: 20 }}>
        <div style={{ ...mono, marginBottom: 14 }}>Por canal, cuando estén listos</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {canales.map((c) => {
            const listosDelCanal = c.emps.filter((e) => e.pago !== 'pagado' && e.tieneAjuste);
            const disabled = listosDelCanal.length === 0;
            return (
              <button
                key={c.canal}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onPagarLote(listosDelCanal.map((e) => e.id))}
                style={{
                  padding: '11px 14px',
                  background: pal.cream2,
                  color: disabled ? pal.muted2 : pal.ink,
                  border: `1px solid ${pal.line}`,
                  borderRadius: 11,
                  fontSize: 12,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.55 : 1,
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  Pagar listos por {c.canal} {disabled ? '' : `· ${listosDelCanal.length}`}
                </span>
                <span style={{ ...mono, color: pal.muted2 }}>{formatK(listosDelCanal.reduce((a, e) => a + e.neto, 0))}</span>
              </button>
            );
          })}
          <button
            type="button"
            aria-disabled="true"
            title="Todavía no está conectado"
            style={{ padding: '11px 14px', background: pal.cream2, color: pal.muted, border: `1px solid ${pal.line}`, borderRadius: 11, fontSize: 12, cursor: 'not-allowed', opacity: 0.55, textAlign: 'left' }}
          >
            Descargar todos los recibos
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 18px', background: pal.paper, border: `1px solid ${pal.line2}`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Dot c={pal.sage} glow size={8} />
        <div style={{ flex: 1, fontSize: 11, color: pal.muted, lineHeight: 1.4 }}>
          <div style={{ fontWeight: 600, color: pal.ink }}>Actualizado en vivo</div>
          <div style={{ fontStyle: 'italic', fontSize: 12, ...serif }}>cada firma se refleja al instante</div>
        </div>
      </div>
    </aside>
  );
}

function MostradorSection({ listos, esperando, canales, onPagar, onPagarLote, onNavigate }) {
  const [filtro, setFiltro] = useState('todos');
  const visiblesListos = filtro === 'esperando' ? [] : listos;
  const visiblesEsperando = filtro === 'listos' ? [] : esperando;

  return (
    <section id="pagos-mostrador" style={{ padding: '0 56px 56px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 03 · el mostrador</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            La cola de <em style={{ fontStyle: 'italic' }}>pagos</em>
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <div style={{ display: 'inline-flex', padding: 3, background: pal.cream2, border: `1px solid ${pal.line}`, borderRadius: 10, fontSize: 12 }}>
          {[
            { k: 'todos', l: `Todos · ${listos.length + esperando.length}` },
            { k: 'listos', l: `Listos · ${listos.length}` },
            { k: 'esperando', l: `Esperando · ${esperando.length}` },
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

      <div className="ed-grid-mostrador" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 36, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {listos.length + esperando.length === 0 && (
            <div style={{ padding: '32px 28px', borderRadius: 18, background: pal.cream2, border: `1px solid ${pal.line}`, color: pal.muted, fontSize: 14 }}>
              No hay pagos pendientes esta quincena.
            </div>
          )}
          {visiblesListos.map((e, i) => (
            <ComprobanteGrande key={e.id} e={e} index={i} total={listos.length} onPagar={onPagar} onNavigate={onNavigate} />
          ))}
          {visiblesEsperando.map((e) => (
            <FilaEsperando key={e.id} e={e} onNavigate={onNavigate} />
          ))}
        </div>

        <AsideMostrador listos={listos} canales={canales} onPagarLote={onPagarLote} onNavigate={onNavigate} />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 04 — El libro mayor: pagos ejecutados
   --------------------------------------------------------- */

function LibroMayor({ pagados, periodos }) {
  const sumPagados = pagados.reduce((a, e) => a + e.neto, 0);
  const anteriores = (periodos || []).filter((p) => p.estado === 'cerrado').slice(0, 4);

  return (
    <section style={{ padding: '0 56px 56px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 04 · el libro mayor</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            {pagados.length === 0 ? 'Nada' : `${pagados.length === 1 ? 'Uno' : pagados.length}`} que <em style={{ fontStyle: 'italic' }}>ya salió</em>
            {pagados.length === 1 ? '' : pagados.length === 0 ? '' : 'eron'}
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
      </div>

      {pagados.length === 0 ? (
        <div style={{ padding: '32px 28px', borderRadius: 18, background: pal.cream2, border: `1px solid ${pal.line}`, color: pal.muted, fontSize: 14 }}>
          Todavía no marcaste ningún pago esta quincena.
        </div>
      ) : (
        <div className="ed-grid-libro" style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 36, alignItems: 'stretch' }}>
          <div style={{ padding: '32px 36px', background: 'linear-gradient(160deg, oklch(94% 0.05 145), oklch(92% 0.08 145 / 0.4))', borderRadius: 24, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 100%, oklch(80% 0.13 145 / 0.35), transparent 60%)', animation: 'ed-aurora 12s ease-in-out infinite', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ ...mono, color: 'oklch(30% 0.10 145)', marginBottom: 12 }}>Salió de tu caja · esta quincena</div>
              <div style={{ fontSize: 22, ...num, color: 'oklch(25% 0.10 145)', marginBottom: 20, ...serif }}>{money(sumPagados)}</div>
              <div style={{ paddingTop: 20, borderTop: '1px solid oklch(30% 0.10 145 / 0.15)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12 }}>
                  <span style={{ color: 'oklch(30% 0.08 145)' }}>Personas pagadas</span>
                  <span style={{ color: pal.ink, fontWeight: 600, ...num }}>{pagados.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12 }}>
                  <span style={{ color: 'oklch(30% 0.08 145)' }}>Promedio por persona</span>
                  <span style={{ color: pal.ink, fontWeight: 600, ...num }}>{money(sumPagados / pagados.length)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12 }}>
                  <span style={{ color: 'oklch(30% 0.08 145)' }}>Comisiones</span>
                  <span style={{ color: pal.ink, fontWeight: 600, ...num }}>₡0</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pagados.map((e) => (
              <article key={e.id} className="ed-grid-recibo" style={{ position: 'relative', padding: '20px 24px', background: pal.paper, border: `1px solid ${pal.line2}`, borderRadius: 16, display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 22, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 999, background: e.avBg, color: e.avC, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontStyle: 'italic', ...serif }}>{e.ini}</div>
                  <div>
                    <div style={{ fontSize: 19, lineHeight: 1, ...serif }}>{e.nombre}</div>
                    <div style={{ fontSize: 11, color: pal.muted, marginTop: 3 }}>{e.puesto} · quincena en curso</div>
                  </div>
                </div>
                <div />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: 'oklch(94% 0.06 145)', color: pal.deepGreen, fontSize: 10, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                      <path d="M5 12l5 5 9-11" />
                    </svg>
                    PAGADO
                  </span>
                  <span style={{ fontSize: 10, color: pal.muted, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em' }}>
                    {e.metodo} {e.fechaPago !== '—' ? `· ${e.fechaPago}` : ''}
                  </span>
                </div>
                <div style={{ textAlign: 'right', fontSize: 26, color: pal.ink, ...num, ...serif }}>{e.netoFmt}</div>
              </article>
            ))}

            {anteriores.length > 0 && (
              <div style={{ marginTop: 6, padding: '14px 20px', background: pal.cream2, border: `1px dashed ${pal.line}`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: pal.muted, overflow: 'hidden', flexWrap: 'wrap' }}>
                <span style={{ ...mono, color: pal.ink, flexShrink: 0 }}>Q. anteriores</span>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  {anteriores.map((p) => (
                    <span key={p.id} style={{ fontStyle: 'italic', fontSize: 13, ...serif }}>
                      {p.etiqueta.replace('Quincena · ', 'Q ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 05 — Los canales
   --------------------------------------------------------- */

const CANAL_TONOS = [
  { bg: 'linear-gradient(160deg, oklch(96% 0.03 145), oklch(93% 0.07 145 / 0.5))', border: 'oklch(80% 0.06 145 / 0.4)', accent: 'oklch(45% 0.11 145)', chip: pal.sage, chipC: pal.ink, flow: 'oklch(45% 0.11 145)', anim: 'ed-flow-dash 3s linear infinite' },
  { bg: 'linear-gradient(160deg, oklch(95% 0.03 250), oklch(92% 0.06 250 / 0.5))', border: 'oklch(78% 0.06 250 / 0.4)', accent: 'oklch(35% 0.13 250)', chip: 'oklch(65% 0.15 250)', chipC: pal.cream, flow: 'oklch(45% 0.13 250)', anim: 'ed-flow-dash-slow 5s linear infinite' },
  { bg: 'linear-gradient(160deg, oklch(96% 0.04 65), oklch(92% 0.09 55 / 0.5))', border: 'oklch(80% 0.08 55 / 0.4)', accent: 'oklch(35% 0.13 55)', chip: pal.gold, chipC: pal.ink, flow: 'oklch(45% 0.13 55)', anim: 'ed-flow-dash 4s linear infinite' },
];

function CanalCard({ c, tono, index }) {
  return (
    <div style={{ position: 'relative', padding: '26px 26px 28px', background: tono.bg, border: `1px solid ${tono.border}`, borderRadius: 24, overflow: 'hidden' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%', width: '100%', pointerEvents: 'none', opacity: 0.35 }} viewBox="0 0 320 400" preserveAspectRatio="none">
        <path d={`M20,${60 + index * 20} Q160,${40 + index * 20} 300,${80 + index * 20} T20,${140 + index * 20} T300,${180 + index * 20} T20,${240 + index * 20} T300,${280 + index * 20} T20,${340}`} stroke={tono.flow} strokeWidth="1" fill="none" strokeDasharray="4 6" style={{ animation: tono.anim }} />
      </svg>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ ...mono, marginBottom: 8, color: tono.accent }}>Canal · {String(index + 1).padStart(2, '0')}</div>
            <div style={{ fontSize: 36, lineHeight: 1, letterSpacing: '-0.01em', ...serif }}>{c.canal}</div>
            <div style={{ fontSize: 13, fontStyle: 'italic', color: tono.accent, marginTop: 6, ...serif }}>
              {/efectivo/i.test(c.canal) ? 'entrega en persona' : /sinpe/i.test(c.canal) ? 'instantáneo · sin comisiones' : 'transferencia bancaria'}
            </div>
          </div>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: tono.chip, color: tono.chipC, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 600, ...serif }}>{canalIniciales(c.canal)}</div>
        </div>

        <div style={{ padding: '16px 0', borderTop: `1px solid ${tono.accent}26`, borderBottom: `1px solid ${tono.accent}26`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ ...mono, fontSize: 8, color: tono.accent, marginBottom: 2 }}>Personas</div>
            <div style={{ fontSize: 32, lineHeight: 1, ...num, ...serif }}>{c.emps.length}</div>
          </div>
          <div>
            <div style={{ ...mono, fontSize: 8, color: tono.accent, marginBottom: 2 }}>Volumen quincena</div>
            <div style={{ fontSize: 32, lineHeight: 1, ...num, ...serif }}>{formatK(c.total)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {c.emps.map((e) => {
            const estado = e.pago === 'pagado' ? pal.sage : e.tieneAjuste ? pal.gold : 'oklch(75% 0.02 55)';
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: 999, background: e.avBg, color: e.avC, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontStyle: 'italic', ...serif }}>{e.ini}</div>
                <div style={{ flex: 1, fontSize: 12 }}>
                  {e.nombre.split(' ')[0]} {(e.nombre.split(' ')[1] || '').charAt(0)}.
                </div>
                <div style={{ width: 7, height: 7, borderRadius: 999, background: estado, animation: e.pago !== 'pagado' && e.tieneAjuste ? 'ed-dot-glow 2.4s ease-in-out infinite' : undefined }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CanalesSection({ canales, totales, onNavigate }) {
  return (
    <section style={{ padding: '0 56px 56px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 05 · los canales</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            {canales.length === 1 ? 'Un río' : `${canales.length === 3 ? 'Tres' : canales.length} ríos`} <em style={{ fontStyle: 'italic' }}>{canales.length === 1 ? '' : 'distintos'}</em>
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <span style={mono}>Cómo se paga cada persona</span>
      </div>

      <div className="ed-grid-canales" style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${Math.min(canales.length, 3)}, 1fr)`, gap: 20 }}>
        {canales.map((c, i) => (
          <CanalCard key={c.canal} c={c} tono={CANAL_TONOS[i % CANAL_TONOS.length]} index={i} />
        ))}
      </div>

      <div className="ed-grid-2" style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', gap: 24, alignItems: 'center', padding: '22px 28px', borderRadius: 22, background: pal.cream2, border: `1px solid ${pal.line}` }}>
        <div>
          <div style={{ ...mono, marginBottom: 4 }}>Total quincena · todos los canales</div>
          <div style={{ fontSize: 32, color: pal.ink, ...num, ...serif }}>{totales.sumNetoFmt}</div>
        </div>
        <div style={{ width: 1, height: 44, background: pal.line }} />
        <div>
          <div style={{ ...mono, marginBottom: 4 }}>Comisiones bancarias</div>
          <div style={{ fontSize: 32, color: pal.deepGreen, ...num, ...serif }}>₡0</div>
        </div>
        <div style={{ width: 1, height: 44, background: pal.line }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => onNavigate('configuracion')} style={{ padding: '13px 22px', background: pal.ink, color: pal.cream, border: 'none', borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Configurar métodos ↗
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 06 — El cierre
   --------------------------------------------------------- */

function CierreSection({ pagados, listos, esperando, totales, periodoActivo, onPagar, onNavigate }) {
  const primerListo = listos[0];
  const sumListos = listos.reduce((a, e) => a + e.neto, 0);
  const sumEsperando = esperando.reduce((a, e) => a + e.neto, 0);
  const pctSiPagaListos = totales.sumNeto > 0 ? Math.round(((totales.pagado + sumListos) / totales.sumNeto) * 100) : 0;

  const fechasPago = [...new Set(pagados.map((e) => e.fechaPago).filter((f) => f && f !== '—'))];

  return (
    <section style={{ padding: '0 56px 88px' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(160deg, oklch(90% 0.08 145) 0%, oklch(85% 0.10 55) 50%, oklch(82% 0.11 30) 100%)', borderRadius: 32, padding: '56px 64px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-30%', right: '-15%', width: '60%', height: '120%', background: 'radial-gradient(circle, oklch(95% 0.13 65 / 0.45), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora 11s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '-40%', left: '-10%', width: '50%', height: '100%', background: 'radial-gradient(circle, oklch(80% 0.14 145 / 0.32), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora-2 13s ease-in-out infinite' }} />
        </div>

        <div className="ed-grid-2" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '8fr 4fr', gap: 56, alignItems: 'start' }}>
          <div>
            <div style={{ ...mono, color: 'oklch(28% 0.08 30)', marginBottom: 18 }}>Cierre de pagos · {periodoActivo?.etiqueta.replace('Quincena · ', '') || 'quincena'}</div>
            <div style={{ fontSize: 66, lineHeight: 1.02, letterSpacing: '-0.02em', color: pal.ink, marginBottom: 20, ...serif }}>
              {pagados.length + listos.length} <em style={{ fontStyle: 'italic' }}>a la mano</em>,
              <br />
              {esperando.length} <em style={{ fontStyle: 'italic', textDecoration: 'underline', textDecorationColor: pal.coral, textDecorationThickness: 2, textUnderlineOffset: 6 }}>por componerse</em>.
            </div>
            <p style={{ fontSize: 19, fontStyle: 'italic', lineHeight: 1.5, color: 'oklch(30% 0.06 30)', maxWidth: 640, margin: '0 0 26px', ...serif }}>
              {primerListo ? `${primerListo.nombre.split(' ')[0]} puede salir hoy. ` : ''}
              {esperando.length > 0 ? `Los otros ${esperando.length} bajan del taller cuando termines de revisar sus quincenas.` : 'Todos los demás ya están pagados.'}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {primerListo && (
                <button type="button" onClick={() => onPagar([primerListo.id])} style={{ padding: '14px 24px', background: pal.ink, color: pal.cream, border: 'none', borderRadius: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  Pagar a {primerListo.nombre.split(' ')[0]} · {primerListo.netoFmt}
                </button>
              )}
              <button type="button" onClick={() => onNavigate('planilla')} style={{ padding: '14px 22px', background: 'oklch(99% 0.006 70 / 0.5)', color: pal.ink, border: '1px solid oklch(99% 0.006 70)', borderRadius: 14, fontSize: 14, cursor: 'pointer' }}>
                Ir a revisar planilla
              </button>
            </div>

            <div style={{ marginTop: 36, paddingTop: 26, borderTop: '1px solid oklch(30% 0.06 30 / 0.2)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }} className="ed-grid-2">
              <div>
                <div style={{ ...mono, color: 'oklch(28% 0.08 30)', marginBottom: 8 }}>Si pagás los listos hoy</div>
                <div style={{ fontSize: 22, fontStyle: 'italic', lineHeight: 1.35, color: pal.ink, ...serif }}>
                  {listos.length > 0 ? `La caja queda al ${pctSiPagaListos}%.` : 'No hay nadie listo para pagar todavía.'}
                </div>
                <div style={{ fontSize: 16, color: 'oklch(30% 0.06 30)', marginTop: 8, ...num, ...serif }}>
                  −{money(sumListos)} de caja
                </div>
              </div>
              <div>
                <div style={{ ...mono, color: 'oklch(28% 0.08 30)', marginBottom: 8 }}>Lo que falta en planilla</div>
                <div style={{ fontSize: 22, fontStyle: 'italic', lineHeight: 1.35, color: pal.ink, ...serif }}>
                  {esperando.length > 0 ? `${esperando.length} personas siguen en composición.` : 'Nada queda pendiente de revisar.'}
                </div>
                <div style={{ fontSize: 16, color: 'oklch(30% 0.06 30)', marginTop: 8, ...num, ...serif }}>
                  −{money(sumEsperando)} pendiente
                </div>
              </div>
            </div>
          </div>

          <div style={{ position: 'relative', padding: '26px 28px', background: 'oklch(99% 0.006 70 / 0.55)', border: '1px solid oklch(99% 0.006 70 / 0.6)', borderRadius: 20 }}>
            <div style={{ ...mono, color: 'oklch(28% 0.06 30)', marginBottom: 16 }}>Fechas de pago · esta quincena</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {fechasPago.length === 0 && <div style={{ fontSize: 12, color: pal.muted, fontStyle: 'italic', ...serif }}>Todavía ningún pago registrado.</div>}
              {fechasPago.map((f) => (
                <div key={f} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 10px', background: 'oklch(94% 0.06 145)', borderRadius: 8 }}>
                  <span style={{ color: pal.deepGreen, fontWeight: 600 }}>{f}</span>
                  <span style={{ color: pal.deepGreen }}>{pagados.filter((e) => e.fechaPago === f).length} pago(s)</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 10px', background: pal.ink, color: pal.cream, borderRadius: 8 }}>
                <span style={{ fontWeight: 600 }}>Hoy · {String(HOY.dia).padStart(2, '0')}</span>
                <span>{listos.length} listo(s)</span>
              </div>
            </div>

            <div style={{ padding: '14px 0 6px', borderTop: '1px solid oklch(30% 0.06 30 / 0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'oklch(30% 0.04 30)' }}>Progreso quincena</span>
                <span style={{ fontSize: 12, color: pal.ink, fontWeight: 600, ...num }}>{totales.pagoPct}</span>
              </div>
              <div style={{ height: 6, background: 'oklch(30% 0.04 30 / 0.15)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: totales.pagoPct, height: '100%', background: `linear-gradient(90deg, ${pal.sage}, ${pal.gold})`, borderRadius: 999, transformOrigin: 'left', animation: 'ed-bar-grow-x 1.4s cubic-bezier(.16,1,.3,1) both' }} />
              </div>
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

function Footer({ pagados, periodoActivo }) {
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
        Pagos · {periodoActivo?.etiqueta.replace('Quincena · ', '') || 'quincena'} · {pagados.length} ejecutados
      </span>
      <span style={{ fontStyle: 'italic', fontSize: 14, textTransform: 'none', letterSpacing: 0, color: 'oklch(35% 0.03 30)', ...serif }}>
        Pagar puntual es un cuidado.
      </span>
      <span>© {HOY.anio} · Gestión Laboral</span>
    </footer>
  );
}

function Dock({ primerListo, onPagar, onVerLibro }) {
  return (
    <div style={{ position: 'sticky', bottom: 20, margin: '-36px auto 0', width: 'fit-content', display: 'flex', justifyContent: 'center', zIndex: 20 }}>
      <div className="ed-dock" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: pal.ink, color: pal.cream, padding: '8px 8px 8px 20px', borderRadius: 999, boxShadow: '0 24px 60px -20px oklch(20% 0.02 30 / 0.5)' }}>
        <span style={{ ...mono, color: 'oklch(70% 0.02 60)', fontSize: 10 }}>Pagos</span>
        <span style={{ width: 1, height: 16, background: 'oklch(40% 0.02 30)', margin: '0 6px' }} />
        <button type="button" onClick={onVerLibro} style={{ padding: '9px 16px', background: 'transparent', color: 'oklch(88% 0.03 60)', border: 'none', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
          Ver libro mayor
        </button>
        <button type="button" aria-disabled="true" title="Todavía no está conectado" style={{ padding: '9px 16px', background: 'transparent', color: 'oklch(60% 0.02 60)', border: 'none', borderRadius: 999, fontSize: 12, cursor: 'not-allowed' }}>
          Enviar comprobantes
        </button>
        {primerListo && (
          <button
            type="button"
            onClick={() => onPagar([primerListo.id])}
            style={{ padding: '9px 18px', background: pal.gold, color: pal.ink, border: 'none', borderRadius: 999, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
          >
            Firmar pago de {primerListo.nombre.split(' ')[0]}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Composición
   --------------------------------------------------------- */

export default function Pagos({ emps, totales, atender, periodoActivo, periodos, onMarcarPagado, onMarcarPagadoLote, onNavigate }) {
  const [pagando, setPagando] = useState(null); // { ids: [...] } | null

  const pagados = emps.filter((e) => e.pago === 'pagado');
  const listos = emps.filter((e) => e.pago !== 'pagado' && e.tieneAjuste);
  const esperando = emps.filter((e) => e.pago !== 'pagado' && !e.tieneAjuste);

  const canalesMap = new Map();
  emps.forEach((e) => {
    const key = canalDe(e.banco);
    if (!canalesMap.has(key)) canalesMap.set(key, { canal: key, emps: [], total: 0 });
    const c = canalesMap.get(key);
    c.emps.push(e);
    c.total += e.neto;
  });
  const canales = [...canalesMap.values()].sort((a, b) => b.total - a.total);

  function irAlMostrador() {
    const el = document.getElementById('pagos-mostrador');
    const scrollEl = document.getElementById('app-content');
    if (!el || !scrollEl) return;
    scrollEl.scrollTo({ top: Math.max(0, el.offsetTop - 24), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  return (
    <div className="screen ed-home" style={{ fontFamily: "'Albert Sans', system-ui, sans-serif", color: pal.ink, background: pal.cream, minHeight: '100%' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', position: 'relative' }}>
        <Masthead periodoActivo={periodoActivo} atender={atender} onNavigate={onNavigate} />
        <StatusBar pagadosN={pagados.length} listosN={listos.length} esperandoN={esperando.length} />

        <Seccion01Hero
          pagados={pagados}
          listos={listos}
          esperando={esperando}
          totales={totales}
          onPagar={(ids) => setPagando({ ids })}
          onIrAlMostrador={irAlMostrador}
          onVerLibro={irAlMostrador}
        />

        <PulsoCaja emps={emps} pagados={pagados} listos={listos} esperando={esperando} totales={totales} canales={canales} />

        <MostradorSection
          listos={listos}
          esperando={esperando}
          canales={canales}
          onPagar={(ids) => setPagando({ ids })}
          onPagarLote={(ids) => setPagando({ ids })}
          onNavigate={onNavigate}
        />

        <LibroMayor pagados={pagados} periodos={periodos} />

        <CanalesSection canales={canales} totales={totales} onNavigate={onNavigate} />

        <CierreSection
          pagados={pagados}
          listos={listos}
          esperando={esperando}
          totales={totales}
          periodoActivo={periodoActivo}
          onPagar={(ids) => setPagando({ ids })}
          onNavigate={onNavigate}
        />

        <Footer pagados={pagados} periodoActivo={periodoActivo} />
      </div>

      <Dock primerListo={listos[0]} onPagar={(ids) => setPagando({ ids })} onVerLibro={irAlMostrador} />

      <PagoModal
        cantidad={pagando?.ids.length}
        onClose={() => setPagando(null)}
        onConfirmar={(datos) => {
          if (pagando.ids.length === 1) onMarcarPagado(pagando.ids[0], datos);
          else onMarcarPagadoLote(pagando.ids, datos);
          setPagando(null);
        }}
      />
    </div>
  );
}
