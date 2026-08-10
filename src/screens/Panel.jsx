import { useEffect, useRef, useState } from 'react';

import { HOY, ccss as ccssMock } from '../data/mock.js';
import { money } from '../lib/format.js';
import { IconSearch, IconCampana, IconCheck, IconChevronRight } from '../components/ui/Icons.jsx';

/**
 * Home — "Editorial Command Center". Composición propia, exclusiva de esta
 * pantalla (paleta cálida cream/coral/lilac, tipografía Instrument Serif +
 * JetBrains Mono, motion ambiental `ed-*` de global.css). No toca theme/tokens
 * ni ninguna otra pantalla — todo lo visual vive local a este archivo.
 *
 * Los datos y la lógica de negocio son los mismos que ya existían (totales,
 * obligaciones, empleados, distribución, serie mensual): esto es solo una
 * nueva presentación sobre las mismas props.
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

/**
 * Dispara `true` una sola vez cuando el elemento entra al viewport (vía
 * IntersectionObserver, sin librerías). Sirve tanto para los reveals de
 * sección como para no adelantar el count-in de una métrica que está
 * debajo del pliegue — el número no debe terminar de contar antes de que
 * el usuario llegue a verlo.
 */
function useRevealed(threshold = 0.2) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(() => reducedMotion());

  useEffect(() => {
    if (revealed) return undefined;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          obs.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -10% 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, revealed];
}

/**
 * Envoltura de reveal suave: fade + leve subida + desenfoque, una sola vez,
 * la primera vez que la sección entra al viewport. No mueve ni desmonta el
 * contenido (el wrapper de medición del scroll rail no se entera) — solo
 * anima opacidad/transform de un div interno.
 */
function Reveal({ children, delay = 0, y = 26 }) {
  const [ref, revealed] = useRevealed();
  return (
    <div
      ref={ref}
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : `translateY(${y}px)`,
        filter: revealed ? 'blur(0px)' : 'blur(6px)',
        transition: `opacity 760ms cubic-bezier(.16,1,.3,1) ${delay}ms, transform 760ms cubic-bezier(.16,1,.3,1) ${delay}ms, filter 760ms cubic-bezier(.16,1,.3,1) ${delay}ms`,
      }}
    >
      {children}
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

/** Extrae el día numérico de cadenas tipo "Vence 20 ago 2026" / "Venció 05 ago 2026". */
function diaDe(fecha) {
  const m = /(\d{1,2})/.exec(fecha || '');
  return m ? parseInt(m[1], 10) : null;
}

/* ---------------------------------------------------------
   Piezas decorativas
   --------------------------------------------------------- */

/** Paisaje al amanecer: montañas, sol respirando, olas en movimiento y pájaros volando en loop continuo. */
function Landscape() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: 40,
          right: -40,
          width: 820,
          height: 520,
          background:
            'radial-gradient(ellipse at 30% 40%, oklch(90% 0.10 55 / 0.55), transparent 55%), radial-gradient(ellipse at 70% 60%, oklch(85% 0.09 320 / 0.4), transparent 60%)',
          animation: 'ed-aurora 9s ease-in-out infinite',
          filter: 'blur(2px)',
        }}
      />
      <div style={{ position: 'absolute', top: 60, right: 0, width: 820, height: 500 }}>
        <svg viewBox="0 0 820 500" width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="ed-m1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="oklch(72% 0.09 320)" stopOpacity="0.4" />
              <stop offset="1" stopColor="oklch(72% 0.09 320)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="ed-m2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="oklch(60% 0.07 315)" stopOpacity="0.55" />
              <stop offset="1" stopColor="oklch(60% 0.07 315)" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="ed-m3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="oklch(45% 0.06 320)" stopOpacity="0.65" />
              <stop offset="1" stopColor="oklch(45% 0.06 320)" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <g style={{ animation: 'ed-sun-breathe 6s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
            <circle cx={620} cy={260} r={120} fill="oklch(88% 0.13 65 / 0.22)" style={{ animation: 'ed-sun-halo 6s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />
            <circle cx={620} cy={260} r={78} fill="oklch(88% 0.13 65 / 0.42)" style={{ animation: 'ed-sun-halo 5s ease-in-out infinite reverse', transformBox: 'fill-box', transformOrigin: 'center' }} />
            <circle cx={620} cy={260} r={52} fill="oklch(90% 0.14 68)" />
          </g>
          <path d="M0,330 L100,260 L200,305 L300,240 L400,285 L500,225 L620,275 L720,240 L820,285 L820,500 L0,500 Z" fill="url(#ed-m1)" />
          <path d="M0,370 L120,305 L220,345 L340,285 L440,325 L560,290 L700,335 L820,320 L820,500 L0,500 Z" fill="url(#ed-m2)" />
          <path d="M0,410 L100,365 L200,385 L320,345 L440,375 L560,355 L700,385 L820,365 L820,500 L0,500 Z" fill="url(#ed-m3)" />
          <g style={{ animation: 'ed-wave-drift 7s ease-in-out infinite' }}>
            <path d="M-20,440 Q100,432 220,442 T460,438 T860,444" stroke="oklch(80% 0.08 30)" strokeWidth="1.2" fill="none" opacity="0.6" />
            <path d="M-20,455 Q100,448 220,457 T460,452 T860,458" stroke="oklch(80% 0.08 30)" strokeWidth="1" fill="none" opacity="0.45" />
            <path d="M-20,468 Q100,463 220,470 T460,467 T860,472" stroke="oklch(80% 0.08 30)" strokeWidth="1" fill="none" opacity="0.3" />
          </g>
          {/* Línea de luz sobre el agua, desplazándose lento en loop continuo */}
          <path
            d="M-10,395 Q200,355 400,375 T860,355"
            stroke={pal.gold}
            strokeWidth="1.5"
            fill="none"
            opacity="0.75"
            style={{ animation: 'ed-wave-drift-2 9s ease-in-out infinite' }}
          />
          {/* Pájaros perfectamente visibles en el cielo libre, planeando y aleteando suavemente en loop */}
          <g style={{ animation: 'ed-bird-glide 7s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
            <path
              d="M200,120 Q210,105 220,120 Q230,105 240,120"
              stroke="oklch(20% 0.02 30)"
              strokeWidth="2.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: 'ed-bird-flap 1.2s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }}
            />
          </g>
          <g style={{ animation: 'ed-bird-glide 8.5s ease-in-out infinite reverse 1.2s', transformBox: 'fill-box', transformOrigin: 'center' }}>
            <path
              d="M260,150 Q268,137 276,150 Q284,137 292,150"
              stroke="oklch(20% 0.02 30)"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: 'ed-bird-flap 1.1s ease-in-out infinite 0.2s', transformBox: 'fill-box', transformOrigin: 'center' }}
            />
          </g>
        </svg>
      </div>
    </div>
  );
}

/** Glows tipo aurora reutilizados en los bloques oscuros. */
function AuroraGlow({ variant = 1 }) {
  const sets = {
    1: [
      { top: '-20%', left: '-10%', w: '60%', h: '120%', c: 'oklch(75% 0.16 30 / 0.35)', a: 'ed-aurora 10s ease-in-out infinite' },
      { top: '-10%', right: '-15%', w: '55%', h: '110%', c: 'oklch(70% 0.15 320 / 0.32)', a: 'ed-aurora-2 12s ease-in-out infinite' },
      { bottom: '-30%', left: '40%', w: '45%', h: '80%', c: 'oklch(80% 0.14 65 / 0.28)', a: 'ed-aurora 14s ease-in-out infinite reverse' },
    ],
    2: [{ top: '-30%', right: '-20%', w: '70%', h: '120%', c: 'oklch(70% 0.16 30 / 0.4)', a: 'ed-aurora 9s ease-in-out infinite' }],
  };
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {sets[variant].map((g, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: g.top,
            left: g.left,
            right: g.right,
            bottom: g.bottom,
            width: g.w,
            height: g.h,
            background: `radial-gradient(circle, ${g.c}, transparent 65%)`,
            filter: 'blur(30px)',
            animation: g.a,
          }}
        />
      ))}
    </div>
  );
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

/* ---------------------------------------------------------
   Masthead + barra de estado
   --------------------------------------------------------- */

const NAV_ITEMS = [
  { key: 'panel', label: 'Hoy' },
  { key: 'planilla', label: 'Planilla' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'empleados', label: 'Equipo' },
  { key: 'calendario', label: 'Obligaciones' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'historial', label: 'Historial' },
];

function Masthead({ usuario, periodoActivo, atender, onNavigate }) {
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Logo />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, minWidth: 0 }}>
            <span style={{ fontSize: 22, fontStyle: 'italic', letterSpacing: '-0.01em', ...serif }}>Gestión Laboral</span>
            <span style={{ ...mono, fontSize: 9 }}>Espacio de {usuario.nombre.split(' ')[0]}</span>
          </div>
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
            const active = item.key === 'panel';
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
                {active && (
                  <span style={{ position: 'absolute', bottom: -22, left: 0, right: 0, height: 2, background: pal.coral }} />
                )}
              </a>
            );
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
          <div
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
              minWidth: 200,
            }}
          >
            <IconSearch size={13} stroke="currentColor" />
            <span style={{ flex: 1 }}>
              Buscar o preguntar
              <span
                style={{
                  display: 'inline-block',
                  width: 1.5,
                  height: 11,
                  background: pal.coral,
                  marginLeft: 2,
                  verticalAlign: 'middle',
                  animation: 'ed-cursor-blink 1.1s step-end infinite',
                }}
              />
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", padding: '1px 6px', borderRadius: 5, background: 'oklch(94% 0.01 70)', fontSize: 10 }}>
              ⌘K
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('calendario')}
            aria-label="Ver obligaciones pendientes"
            style={{
              width: 36,
              height: 36,
              border: `1px solid ${pal.line}`,
              background: pal.cream2,
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <IconCampana size={14} stroke="oklch(30% 0.02 40)" />
            {atender.length > 0 && <Dot c={pal.coral} glow size={7} />}
            {atender.length > 0 && (
              <span style={{ position: 'absolute', top: 7, right: 7 }}>
                <Dot c={pal.coral} glow size={7} />
              </span>
            )}
          </button>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: `linear-gradient(135deg, ${pal.peach}, ${pal.coral})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: pal.ink,
              fontWeight: 600,
              fontSize: 12,
            }}
          >
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
      </div>
    </>
  );
}

/* ---------------------------------------------------------
   Hero editorial
   --------------------------------------------------------- */

function PeriodCard({ periodoActivo, totales, atender }) {
  const inicioDia = periodoActivo?.mitad === 'b' ? 16 : 1;
  const diasEnMes = periodoActivo ? new Date(periodoActivo.anio, periodoActivo.mesIndice + 1, 0).getDate() : 30;
  const finDia = periodoActivo?.mitad === 'b' ? diasEnMes : 15;
  const totalDias = Math.max(1, finDia - inicioDia + 1);

  const vencidoDia = diaDe(atender.find((o) => o.k === 'vencido')?.fecha);
  const pagoDia = diaDe(atender.find((o) => o.k === 'pendiente')?.fecha);

  const dias = [];
  for (let d = inicioDia; d <= finDia; d++) dias.push(d);

  return (
    <div
      style={{
        position: 'relative',
        padding: '24px 26px 22px',
        background: 'oklch(99% 0.006 70 / 0.72)',
        backdropFilter: 'blur(24px)',
        border: '1px solid oklch(88% 0.02 55 / 0.7)',
        borderRadius: 24,
        boxShadow: '0 30px 60px -30px oklch(20% 0.02 30 / 0.2)',
        animation: 'ed-float-slow 6s ease-in-out infinite',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={mono}>Período abierto</span>
        <span
          style={{
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'oklch(94% 0.05 145)',
            color: 'oklch(38% 0.11 145)',
            fontWeight: 600,
          }}
        >
          {totales.pagoPct} pagado
        </span>
      </div>
      <div style={{ fontSize: 32, lineHeight: 1.05, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
        {periodoActivo?.etiqueta.replace('Quincena · ', 'Quincena ') || 'Quincena'}
      </div>
      <div style={{ fontSize: 22, fontStyle: 'italic', color: 'oklch(45% 0.09 30)', marginBottom: 16, ...serif }}>
        {periodoActivo?.mes || ''}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${totalDias}, 1fr)`, gap: 3, padding: '0 1px' }}>
        {dias.map((d) => {
          const esHoy = d === HOY.dia;
          const esVencido = d === vencidoDia;
          const cumplido = d < HOY.dia && !esVencido;
          const esPago = d === pagoDia;
          let bg = `${pal.cream}`;
          let border = `1px solid ${pal.line}`;
          if (cumplido) {
            bg = 'oklch(70% 0.13 145)';
            border = 'none';
          }
          if (esPago && !esHoy) {
            bg = pal.gold;
            border = 'none';
          }
          if (esVencido) {
            bg = pal.coral;
            border = 'none';
          }
          if (esHoy) {
            bg = pal.ink;
            border = 'none';
          }
          return (
            <div key={d} style={{ height: 26, borderRadius: 4, background: bg, border, position: 'relative' }}>
              {esVencido && (
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: pal.coral,
                    borderRadius: 4,
                    animation: 'ed-pulse-ring 2s ease-out infinite',
                    transformOrigin: 'center',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: pal.muted,
        }}
      >
        <span>{String(inicioDia).padStart(2, '0')}</span>
        {vencidoDia && <span style={{ color: pal.coral, fontWeight: 600 }}>{vencidoDia}·PEND.</span>}
        <span style={{ color: pal.ink, fontWeight: 600 }}>{HOY.dia}·HOY</span>
        {pagoDia && pagoDia !== HOY.dia && <span style={{ color: 'oklch(50% 0.13 55)' }}>{pagoDia}·PAGO</span>}
      </div>
    </div>
  );
}

function Hero({ usuario, totales, atender, periodoActivo, onNavigate }) {
  const primerNombre = usuario.nombre.split(' ')[0];
  const pagoPctNum = parseInt(totales.pagoPct, 10) || 0;
  return (
    <section style={{ position: 'relative', padding: '68px 56px 44px', overflow: 'hidden' }}>
      <Landscape />
      <div className="ed-grid-hero" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '8fr 4fr', gap: 48, alignItems: 'end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <span style={{ width: 32, height: 1, background: pal.ink }} />
            <span style={{ ...mono, color: pal.ink }}>Editorial · {periodoActivo?.etiqueta.replace('Quincena · ', '') || 'quincena'}</span>
            <Dot c={pal.coral} glow />
            <span style={{ ...mono, color: pal.coral }}>Abierta</span>
          </div>

          <h1
            className="ed-hero-title"
            style={{ fontSize: 88, lineHeight: 0.95, margin: '0 0 20px', letterSpacing: '-0.02em', color: pal.ink, animation: 'ed-fade-up 900ms ease-out both', ...serif }}
          >
            Buenos días,
            <br />
            <em
              style={{
                fontStyle: 'italic',
                background: 'linear-gradient(135deg, oklch(45% 0.08 30) 0%, oklch(55% 0.15 25) 50%, oklch(50% 0.13 55) 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
              }}
            >
              {primerNombre}.
            </em>
          </h1>

          <p
            style={{ fontSize: 22, fontStyle: 'italic', lineHeight: 1.35, margin: '0 0 32px', maxWidth: 620, color: 'oklch(35% 0.03 30)', animation: 'ed-fade-up 900ms ease-out 200ms both', ...serif }}
          >
            La quincena avanza tranquila. Ya cubriste el{' '}
            <span style={{ color: pal.ink, fontStyle: 'normal', fontWeight: 500 }}>{totales.pagoPct}</span> de los pagos
            {atender.length > 0
              ? ` y hay ${atender.length === 1 ? 'una cosa que merece' : `${atender.length} cosas que merecen`} resolverse pronto.`
              : ' y no hay nada pendiente por resolver.'}
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onNavigate('planilla')}
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
              Continuar la quincena
              <IconChevronRight size={14} stroke="currentColor" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('pagos')}
              style={{ padding: '14px 22px', background: pal.cream2, color: pal.ink, border: `1px solid ${pal.line}`, borderRadius: 14, fontSize: 14, cursor: 'pointer' }}
            >
              Registrar un pago
            </button>
            <button
              type="button"
              onClick={() => onNavigate('calendario')}
              style={{ padding: '14px 22px', background: 'transparent', color: pal.muted, border: 'none', borderRadius: 14, fontSize: 14, cursor: 'pointer' }}
            >
              Ver todo el flujo →
            </button>
          </div>
        </div>

        <PeriodCard periodoActivo={periodoActivo} totales={totales} atender={atender} />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Timeline horizontal
   --------------------------------------------------------- */

function Timeline({ periodoActivo, atender }) {
  const inicioDia = periodoActivo?.mitad === 'b' ? 16 : 1;
  const diasEnMes = periodoActivo ? new Date(periodoActivo.anio, periodoActivo.mesIndice + 1, 0).getDate() : 30;
  const finDiaDef = periodoActivo?.mitad === 'b' ? diasEnMes : 15;
  const maxMarkerDia = Math.max(0, ...atender.map((o) => diaDe(o.fecha)).filter((d) => d !== null));
  const maxDia = Math.max(finDiaDef, maxMarkerDia);
  const totalDias = Math.max(1, maxDia - inicioDia);

  const pct = (dia) => Math.min(100, Math.max(0, ((dia - inicioDia) / totalDias) * 100));
  const hoyPct = pct(HOY.dia);

  const marcadores = atender
    .map((o) => ({ o, dia: diaDe(o.fecha) }))
    .filter((x) => x.dia !== null)
    .map((x) => ({ ...x, pct: pct(x.dia) }))
    .sort((a, b) => a.pct - b.pct);

  const toneFor = (k) => (k === 'vencido' ? pal.coral : k === 'proximo' ? 'oklch(80% 0.13 65)' : pal.gold);

  return (
    <section style={{ padding: '24px 56px 48px', position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'center', marginBottom: 20 }}>
        <div style={mono}>Timeline vivo · {periodoActivo?.mes || ''}</div>
        <div style={{ height: 1, background: pal.line }} />
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: pal.muted }}>
          Del {String(inicioDia).padStart(2, '0')} al {maxDia}
        </div>
      </div>

      <div style={{ position: 'relative', height: 124 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 56, height: 2, background: pal.line }} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 56,
            height: 2,
            width: `${hoyPct}%`,
            background: `linear-gradient(90deg, ${pal.sage}, oklch(60% 0.12 145))`,
            boxShadow: '0 0 12px oklch(60% 0.12 145 / 0.4)',
          }}
        />

        <div style={{ position: 'absolute', left: '0%', top: 0, textAlign: 'center', transform: 'translateX(-50%)' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: pal.muted, marginBottom: 38 }}>
            {String(inicioDia).padStart(2, '0')}·AGO
          </div>
          <div style={{ width: 10, height: 10, borderRadius: 999, background: pal.sage, margin: '0 auto' }} />
          <div style={{ fontSize: 14, fontStyle: 'italic', color: pal.muted, marginTop: 12, ...serif }}>Apertura</div>
        </div>

        {marcadores.map(({ o, dia, pct: p }) => {
          const esPulso = o.k === 'vencido';
          const esCCSS = o.target === 'ccss';
          return (
            <div key={o.t} style={{ position: 'absolute', left: `${p}%`, top: 0, textAlign: 'center', transform: 'translateX(-50%)', minWidth: 130 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: toneFor(o.k), fontWeight: 600, marginBottom: 32 }}>
                {String(dia).padStart(2, '0')}·AGO
              </div>
              <div style={{ position: 'relative', width: esPulso ? 18 : 14, height: esPulso ? 18 : 14, margin: '0 auto' }}>
                {esPulso && (
                  <span
                    style={{ position: 'absolute', inset: 0, borderRadius: 999, background: toneFor(o.k), animation: 'ed-pulse-ring 2s ease-out infinite' }}
                  />
                )}
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 999,
                    background: toneFor(o.k),
                    boxShadow: `0 0 0 4px ${toneFor(o.k)} / 0.25`,
                  }}
                />
              </div>
              <div style={{ marginTop: 12 }}>
                {esCCSS ? (
                  <>
                    <div style={{ fontSize: 13, color: pal.ink, ...serif }}>CCSS ·</div>
                    <div style={{ fontSize: 14, fontStyle: 'italic', color: pal.ink, ...serif }}>Julio</div>
                    <div style={{ fontSize: 11, color: toneFor(o.k), fontWeight: 600, marginTop: 2 }}>{o.dias.toLowerCase()}</div>
                    <div style={{ fontSize: 10, color: toneFor(o.k) }}>-</div>
                    <div style={{ fontSize: 11, color: toneFor(o.k), fontWeight: 600 }}>{o.montoFmt}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, color: pal.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...serif }}>
                      {o.t.split('·')[0].trim()}
                    </div>
                    <div style={{ fontSize: 11, color: toneFor(o.k), fontWeight: 600 }}>{o.dias.toLowerCase()} · {o.montoFmt}</div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        <div style={{ position: 'absolute', left: `${hoyPct}%`, top: 0, textAlign: 'center', transform: 'translateX(-50%)', zIndex: 2 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: pal.ink, fontWeight: 700, marginBottom: 28 }}>
            HOY · {String(HOY.dia).padStart(2, '0')}
          </div>
          <div
            style={{
              width: 28,
              height: 28,
              margin: '0 auto',
              borderRadius: 999,
              background: pal.ink,
              color: pal.cream,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 6px oklch(20% 0.02 30 / 0.1), 0 12px 24px -8px oklch(20% 0.02 30 / 0.4)',
              fontSize: 14,
              ...serif,
            }}
          >
            ◈
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 14, color: pal.ink, fontWeight: 600, ...serif }}>{HOY.nombreDia}</div>
            <div style={{ fontSize: 10.5, color: pal.muted }}>Escribiendo esta quincena</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Big number strip — costo total + gauge de pago
   --------------------------------------------------------- */

function Gauge({ pct, revealed = true }) {
  const r = 82;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  return (
    <svg viewBox="0 0 200 200" width={280} height={280} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="ed-gauge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(85% 0.13 55)" />
          <stop offset=".5" stopColor="oklch(78% 0.16 25)" />
          <stop offset="1" stopColor="oklch(70% 0.15 320)" />
        </linearGradient>
      </defs>
      <g stroke="oklch(45% 0.02 30 / 0.6)" strokeWidth="1">
        <line x1="100" y1="14" x2="100" y2="22" />
        <line x1="186" y1="100" x2="178" y2="100" />
        <line x1="100" y1="186" x2="100" y2="178" />
        <line x1="14" y1="100" x2="22" y2="100" />
      </g>
      <circle cx="100" cy="100" r={r} stroke="oklch(30% 0.02 30 / 0.6)" strokeWidth="12" fill="none" />
      {/* El arco no dibuja nada hasta que la sección entra al viewport — así el
          stroke-draw se ve "dibujarse", en vez de haber terminado antes de scrollear. */}
      <circle
        cx="100"
        cy="100"
        r={r}
        stroke="url(#ed-gauge)"
        strokeWidth="12"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={revealed ? `${dash} ${circ}` : `0 ${circ}`}
        strokeDashoffset={revealed ? dash : 0}
        transform="rotate(-90 100 100)"
        style={
          revealed
            ? { animation: 'ed-stroke-draw 2s cubic-bezier(0.16, 1, 0.3, 1) forwards, ed-gauge-breathe 5s ease-in-out infinite' }
            : undefined
        }
      />
    </svg>
  );
}

function BigNumberStrip({ totales, emps, barras }) {
  const [ref, revealed] = useRevealed(0.3);
  const costoDisplay = useCountUp(revealed ? totales.totCosto : 0, { format: money });
  const pagoPctNum = parseInt(totales.pagoPct, 10) || 0;
  const pagoDisplay = useCountUp(revealed ? pagoPctNum : 0, { duration: 1100 });

  const trendPoints = (barras || []).map((b) => parseFloat(b.hStr));
  const trendDeltaPct =
    trendPoints.length >= 2 && trendPoints[trendPoints.length - 2] !== 0
      ? ((trendPoints[trendPoints.length - 1] - trendPoints[trendPoints.length - 2]) / trendPoints[trendPoints.length - 2]) * 100
      : null;

  return (
    <section
      ref={ref}
      style={{
        margin: '0 56px 56px',
        position: 'relative',
        borderRadius: 32,
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${pal.ink} 0%, ${pal.ink2} 100%)`,
        color: pal.cream,
        padding: '48px 56px 44px',
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(26px)',
        filter: revealed ? 'blur(0px)' : 'blur(6px)',
        transition: 'opacity 760ms cubic-bezier(.16,1,.3,1), transform 760ms cubic-bezier(.16,1,.3,1), filter 760ms cubic-bezier(.16,1,.3,1)',
      }}
    >
      <AuroraGlow variant={1} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(115deg, transparent 40%, oklch(100% 0 0 / 0.05) 48%, oklch(100% 0 0 / 0.08) 50%, oklch(100% 0 0 / 0.05) 52%, transparent 60%)',
          backgroundSize: '200% 100%',
          animation: 'ed-shimmer 8s ease-in-out infinite',
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />

      <div className="ed-grid-2" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 56, alignItems: 'center' }}>
        <div>
          <div style={{ ...mono, color: 'oklch(78% 0.03 60)', marginBottom: 14 }}>Costo total del período</div>
          <div style={{ fontSize: 88, lineHeight: 0.95, letterSpacing: '-0.03em', color: pal.cream, ...serif }}>{costoDisplay}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 22, fontSize: 14, flexWrap: 'wrap' }}>
            {trendDeltaPct !== null && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: trendDeltaPct >= 0 ? 'oklch(70% 0.13 145 / 0.2)' : 'oklch(60% 0.15 25 / 0.2)',
                  color: trendDeltaPct >= 0 ? 'oklch(80% 0.14 145)' : 'oklch(80% 0.14 55)',
                  fontWeight: 500,
                }}
              >
                {trendDeltaPct >= 0 ? '↑' : '↓'} {Math.abs(trendDeltaPct).toFixed(1)}% vs mes anterior
              </span>
            )}
            <span style={{ color: 'oklch(78% 0.03 60)' }}>{emps.length} empleados activos</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginTop: 36, paddingTop: 28, borderTop: '1px solid oklch(50% 0.02 30 / 0.4)' }}>
            <div>
              <div style={{ ...mono, color: 'oklch(72% 0.02 60)', fontSize: 10 }}>Salarios brutos</div>
              <div style={{ fontSize: 26, marginTop: 4, ...serif }}>{totales.sumBrutoFmt}</div>
            </div>
            <div>
              <div style={{ ...mono, color: 'oklch(72% 0.02 60)', fontSize: 10 }}>Cargas sociales</div>
              <div style={{ fontSize: 26, marginTop: 4, ...serif }}>{totales.totCarFmt}</div>
            </div>
            <div>
              <div style={{ ...mono, color: 'oklch(72% 0.02 60)', fontSize: 10 }}>Deducciones</div>
              <div style={{ fontSize: 26, marginTop: 4, ...serif }}>{totales.totDedFmt}</div>
            </div>
            <div>
              <div style={{ ...mono, color: 'oklch(72% 0.02 60)', fontSize: 10 }}>Neto a pagar</div>
              <div style={{ fontSize: 26, marginTop: 4, ...serif }}>{totales.sumNetoFmt}</div>
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Gauge pct={pagoPctNum} revealed={revealed} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ ...mono, color: 'oklch(78% 0.03 60)' }}>Pagado</div>
            <div style={{ fontSize: 70, lineHeight: 1, marginTop: 4, color: pal.cream, ...serif }}>
              {pagoDisplay}
              <span style={{ fontSize: 30, color: 'oklch(78% 0.03 60)' }}>%</span>
            </div>
            <div style={{ fontSize: 13, color: 'oklch(80% 0.03 60)', marginTop: 6 }}>{totales.pendFmt} pendiente</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Lo que atender
   --------------------------------------------------------- */

function AtenderUrgente({ o, emps, poliza, onNavigate }) {
  return (
    <div
      style={{
        position: 'relative',
        padding: '32px 34px',
        borderRadius: 24,
        background: 'linear-gradient(135deg, oklch(28% 0.05 25) 0%, oklch(22% 0.03 340) 100%)',
        color: pal.cream,
        overflow: 'hidden',
        minHeight: 280,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <AuroraGlow variant={2} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <Dot c={pal.coral} glow />
          <span style={{ ...mono, color: 'oklch(80% 0.14 30)' }}>Urgente · empezá aquí</span>
          <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: '3px 10px', borderRadius: 999, background: 'oklch(45% 0.14 30)', color: pal.cream }}>
            {o.dias}
          </span>
        </div>
        <div style={{ fontSize: 42, lineHeight: 1.05, marginBottom: 12, letterSpacing: '-0.01em', ...serif }}>{o.t}</div>
        <p style={{ margin: '0 0 24px', fontSize: 15, lineHeight: 1.5, color: 'oklch(80% 0.03 60)', maxWidth: 480 }}>{o.d}.</p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onNavigate(o.target)}
            style={{ padding: '12px 22px', background: pal.cream, color: pal.ink, border: 'none', borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            Resolver ahora
          </button>
        </div>
        <div style={{ display: 'flex', gap: 40, paddingTop: 22, borderTop: '1px solid oklch(50% 0.02 30 / 0.4)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...mono, fontSize: 9, color: 'oklch(72% 0.02 60)' }}>Monto</div>
            <div style={{ fontSize: 22, marginTop: 2, ...serif }}>{o.montoFmt}</div>
          </div>
          <div>
            <div style={{ ...mono, fontSize: 9, color: 'oklch(72% 0.02 60)' }}>Cubiertos</div>
            <div style={{ fontSize: 22, marginTop: 2, ...serif }}>{emps.length} empleados</div>
          </div>
          {o.target === 'ins' && poliza && (
            <div>
              <div style={{ ...mono, fontSize: 9, color: 'oklch(72% 0.02 60)' }}>Póliza</div>
              <div style={{ fontSize: 22, marginTop: 2, ...serif }}>{poliza.numero.replace('N° ', '')}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AtenderPago({ o, emps, onNavigate }) {
  const dia = diaDe(o.fecha);
  const pendientes = emps.filter((e) => e.pago !== 'pagado').slice(0, 4);
  return (
    <div
      style={{
        padding: '26px 24px',
        borderRadius: 24,
        background: 'linear-gradient(160deg, oklch(92% 0.06 55) 0%, oklch(90% 0.10 30) 100%)',
        color: pal.ink,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <span style={{ fontSize: 48, lineHeight: 1, color: 'oklch(35% 0.10 30)', fontStyle: 'italic', ...serif }}>{dia}</span>
          <div>
            <div style={{ ...mono, fontSize: 10, color: 'oklch(35% 0.06 30)' }}>Agosto</div>
            <div style={{ fontSize: 11, color: 'oklch(38% 0.11 30)', fontWeight: 500 }}>{o.dias}</div>
          </div>
        </div>
        <div style={{ ...mono, fontSize: 10, color: 'oklch(35% 0.06 30)', marginBottom: 6 }}>Próximo</div>
        <div style={{ fontSize: 24, lineHeight: 1.15, color: pal.ink, marginBottom: 6, ...serif }}>{o.t}</div>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'oklch(38% 0.05 30)' }}>
          {o.d}. Neto pendiente <strong style={{ color: pal.ink }}>{o.montoFmt}</strong>.
        </p>

        {pendientes.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {pendientes.map((e) => (
              <div
                key={e.id}
                title={e.nombre}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: e.avBg,
                  color: e.avC,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  border: `2px solid ${pal.surface}`,
                  ...serif,
                }}
              >
                {e.ini}
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onNavigate('pagos')}
        style={{ padding: '11px 20px', background: pal.ink, color: pal.cream, border: 'none', borderRadius: 12, fontWeight: 600, fontSize: 12, cursor: 'pointer', width: '100%' }}
      >
        Registrar pagos
      </button>
    </div>
  );
}

function AtenderProximo({ o, onNavigate }) {
  const esCcss = o.target === 'ccss';
  return (
    <div
      style={{
        padding: '26px 26px',
        borderRadius: 24,
        background: pal.cream2,
        border: `1px solid ${pal.line}`,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 6 }}>
        <span style={mono}>Próximo · {o.dias}</span>
        <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 999, background: 'oklch(94% 0.06 65)', color: 'oklch(48% 0.11 55)', fontWeight: 600 }}>
          {o.stL}
        </span>
      </div>
      <div style={{ fontSize: 28, lineHeight: 1.05, color: pal.ink, letterSpacing: '-0.005em', ...serif }}>{o.t}</div>
      <p style={{ margin: '14px 0 0', fontSize: 13, color: pal.muted }}>{o.d}.</p>

      {esCcss && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 24 }}>
          <div>
            <div style={{ ...mono, fontSize: 9 }}>Obrera</div>
            <div style={{ fontSize: 19, color: pal.ink, marginTop: 2, ...serif }}>{money(ccssMock.cuotaObrera)}</div>
          </div>
          <div>
            <div style={{ ...mono, fontSize: 9 }}>Patronal</div>
            <div style={{ fontSize: 19, color: pal.ink, marginTop: 2, ...serif }}>{money(ccssMock.cuotaPatronal)}</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 22, borderTop: `1px solid ${pal.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ ...mono, fontSize: 9 }}>Total</div>
          <div style={{ fontSize: 32, color: pal.ink, ...serif }}>{o.montoFmt}</div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate(o.target)}
          style={{ padding: '9px 16px', background: pal.cream, color: pal.ink, border: `1px solid ${pal.line}`, borderRadius: 10, fontSize: 12, cursor: 'pointer' }}
        >
          Ver detalle →
        </button>
      </div>
    </div>
  );
}

function AtenderSection({ atender, emps, poliza, onNavigate }) {
  const vencido = atender.find((o) => o.k === 'vencido');
  const pendiente = atender.find((o) => o.k === 'pendiente');
  const proximo = atender.find((o) => o.k === 'proximo');
  const cards = [vencido, pendiente, proximo].filter(Boolean);

  return (
    <section style={{ padding: '0 56px 56px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 28 }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 02 · lo que atender</div>
          <div style={{ fontSize: 44, lineHeight: 1, color: pal.ink, letterSpacing: '-0.01em', ...serif }}>
            {cards.length === 0 ? (
              'Todo en orden'
            ) : (
              <>
                {cards.length === 1 ? 'Una cosa' : `${cards.length} cosas`} <em style={{ fontStyle: 'italic', color: 'oklch(45% 0.09 30)' }}>merecen</em>
              </>
            )}
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <a
          href="#calendario"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('calendario');
          }}
          style={{ fontSize: 13, color: pal.muted }}
        >
          Ver todas →
        </a>
      </div>

      {cards.length === 0 ? (
        <div
          style={{
            padding: '40px 34px',
            borderRadius: 24,
            background: pal.cream2,
            border: `1px solid ${pal.line}`,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            color: pal.muted,
          }}
        >
          <IconCheck size={22} stroke={pal.sage} />
          <span>No hay obligaciones ni pagos pendientes en este momento.</span>
        </div>
      ) : (
        <div
          className="ed-grid-atender"
          style={{
            display: 'grid',
            gridTemplateColumns:
              cards.length === 3 ? '5fr 3fr 4fr' : cards.length === 2 ? '1fr 1fr' : '1fr',
            gap: 20,
            alignItems: 'stretch',
          }}
        >
          {vencido && <AtenderUrgente o={vencido} emps={emps} poliza={poliza} onNavigate={onNavigate} />}
          {pendiente && <AtenderPago o={pendiente} emps={emps} onNavigate={onNavigate} />}
          {proximo && <AtenderProximo o={proximo} onNavigate={onNavigate} />}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------
   El equipo
   --------------------------------------------------------- */

function EquipoSection({ emps, onNavigate }) {
  if (!emps || emps.length === 0) return null;
  const featured = emps.find((e) => /encargad/i.test(e.puesto)) || emps[0];
  const resto = emps.filter((e) => e.id !== featured.id);
  const maxNeto = Math.max(...emps.map((e) => e.neto), 1);
  const primerNombreFeatured = featured.nombre.split(' ')[0];

  // Helper para asignar gradientes metálicos horizontales a cada barra según puesto o rol
  const getBarGradient = (e) => {
    if (e.pago === 'pagado') {
      return 'linear-gradient(90deg, oklch(72% 0.14 145) 0%, oklch(62% 0.16 150) 100%)';
    }
    if (/cajer/i.test(e.puesto)) {
      return 'linear-gradient(90deg, oklch(75% 0.12 185) 0%, oklch(62% 0.15 195) 100%)';
    }
    if (/ayudante/i.test(e.puesto) || /bodega/i.test(e.puesto)) {
      return 'linear-gradient(90deg, oklch(82% 0.14 75) 0%, oklch(68% 0.16 50) 100%)';
    }
    return 'linear-gradient(90deg, oklch(65% 0.05 40) 0%, oklch(45% 0.06 30) 100%)';
  };

  return (
    <section style={{ padding: '0 56px 56px', position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 28 }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 03 · el equipo</div>
          <div style={{ fontSize: 44, lineHeight: 1, color: pal.ink, letterSpacing: '-0.01em', ...serif }}>
            {emps.length === 1 ? 'Quien' : <>Los <em style={{ fontStyle: 'italic' }}>{emps.length}</em></>} de esta quincena
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <a
          href="#empleados"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('empleados');
          }}
          style={{ fontSize: 13, color: pal.muted }}
        >
          Empleados completos →
        </a>
      </div>

      {/* Featured Encargado Card con flotación sutil */}
      <div
        className="ed-grid-equipo-featured"
        style={{
          display: 'grid',
          gridTemplateColumns: '5fr 7fr',
          gap: 32,
          alignItems: 'center',
          marginBottom: 36,
          padding: '28px 32px',
          background: pal.cream2,
          borderRadius: 24,
          border: `1px solid ${pal.line}`,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 16px 40px -20px oklch(20% 0.02 30 / 0.12)',
          animation: 'ed-float-slow 7s ease-in-out infinite',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 999,
              background: featured.avBg,
              color: featured.avC,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 38,
              fontStyle: 'italic',
              flexShrink: 0,
              boxShadow: '0 4px 14px oklch(0% 0 0 / 0.1)',
              ...serif,
            }}
          >
            {featured.ini}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...mono, marginBottom: 4 }}>
              {/encargad/i.test(featured.puesto) ? 'Encargado' : featured.puesto} · desde {featured.ingreso}
            </div>
            <div style={{ fontSize: 26, lineHeight: 1.1, ...serif }}>{featured.nombre}</div>
            <div style={{ fontSize: 12, color: pal.muted, marginTop: 2 }}>
              {featured.puesto} · {featured.tipo}
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 8,
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 999,
                background: featured.pgBg,
                color: featured.pgC,
                fontWeight: 600,
              }}
            >
              <Dot c={featured.pgD} size={5} glow />
              {featured.pgL}
              {featured.fechaPago !== '—' ? ` · ${featured.fechaPago}` : ''}
            </span>
          </div>
        </div>
        <div style={{ borderLeft: `1px solid ${pal.line}`, paddingLeft: 32 }}>
          <div style={{ fontSize: 22, fontStyle: 'italic', lineHeight: 1.35, color: 'oklch(30% 0.03 30)', ...serif }}>
            {primerNombreFeatured} lleva {featured.puesto.toLowerCase()} desde {featured.ingreso} —{' '}
            {featured.pago === 'pagado' ? 'ya cobró esta quincena' : 'todavía no cobra esta quincena'}.
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...mono, fontSize: 9 }}>Salario neto</div>
              <div style={{ fontSize: 22, ...serif }}>{featured.netoFmt}</div>
            </div>
            <div>
              <div style={{ ...mono, fontSize: 9 }}>CCSS</div>
              <div style={{ fontSize: 22, ...serif }}>{featured.dedFmt}</div>
            </div>
            <div>
              <div style={{ ...mono, fontSize: 9 }}>Método</div>
              <div style={{ fontSize: 22, ...serif }}>{featured.metodo !== '—' ? featured.metodo : 'Sin definir'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Ribbon de los miembros del equipo con barras horizontales metálicas y animaciones */}
      {resto.length > 0 && (
        <div className="ed-grid-equipo-ribbon" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
          {resto.map((e, i) => {
            const barPct = Math.max(20, Math.min(100, (e.neto / maxNeto) * 100));
            const grad = getBarGradient(e);
            return (
              <div
                key={e.id}
                onClick={() => onNavigate('empleados')}
                style={{
                  padding: '20px 22px',
                  background: pal.cream2,
                  border: `1px solid ${pal.line}`,
                  borderRadius: 22,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 10px 24px -14px oklch(20% 0.02 30 / 0.1)',
                  transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1), boxShadow 220ms ease, borderColor 220ms ease',
                }}
                onMouseEnter={(el) => {
                  el.currentTarget.style.transform = 'translateY(-6px)';
                  el.currentTarget.style.boxShadow = '0 20px 40px -12px oklch(20% 0.02 30 / 0.18)';
                  el.currentTarget.style.borderColor = 'oklch(75% 0.12 30 / 0.5)';
                }}
                onMouseLeave={(el) => {
                  el.currentTarget.style.transform = 'translateY(0)';
                  el.currentTarget.style.boxShadow = '0 10px 24px -14px oklch(20% 0.02 30 / 0.1)';
                  el.currentTarget.style.borderColor = pal.line;
                }}
              >
                {/* Fila 1: Avatar con halo + Info del empleado */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 999,
                      background: e.avBg,
                      color: e.avC,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      flexShrink: 0,
                      boxShadow: '0 2px 6px oklch(0% 0 0 / 0.08)',
                      ...serif,
                    }}
                  >
                    {e.ini}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: pal.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.nombre}
                    </div>
                    <div style={{ fontSize: 11, color: pal.muted }}>{e.puesto}</div>
                  </div>
                </div>

                {/* Fila 2: Etiqueta y Salario Neto */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{ ...mono, fontSize: 9 }}>{e.tipo === 'Medio tiempo' ? 'Medio tiempo' : 'Salario neto'}</span>
                    <span style={{ fontSize: 19, color: pal.ink, fontWeight: 500, ...serif }}>{e.netoFmt}</span>
                  </div>

                  {/* Barra de progreso Horizontal estilizada metálica con brillo dinámico */}
                  <div
                    style={{
                      height: 12,
                      width: '100%',
                      background: 'oklch(93% 0.01 65)',
                      borderRadius: 999,
                      overflow: 'hidden',
                      position: 'relative',
                      boxShadow: 'inset 0 1px 3px oklch(0% 0 0 / 0.08)',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${barPct}%`,
                        background: grad,
                        borderRadius: 999,
                        position: 'relative',
                        transformOrigin: 'left',
                        transformBox: 'fill-box',
                        animation: `ed-bar-grow-x ${0.8 + i * 0.1}s cubic-bezier(.16,1,.3,1) both`,
                      }}
                    >
                      {/* Brillo continuo deslumbrante que recorre la barra */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background:
                            'linear-gradient(90deg, transparent 0%, oklch(100% 0 0 / 0.45) 50%, transparent 100%)',
                          backgroundSize: '200% 100%',
                          animation: 'ed-shimmer 5s linear infinite',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Fila 3: Badge de estado quincenal */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: e.pgBg,
                      color: e.pgC,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Dot c={e.pgD} size={5} glow={e.pago === 'pendiente'} />
                    {e.pgL}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------
   El pulso — 12 meses + composición
   --------------------------------------------------------- */

function buildTrendPath(barras, w, h) {
  if (!barras || barras.length < 2) return '';
  const step = w / (barras.length - 1);
  const pts = barras.map((b, i) => [i * step, h - (parseFloat(b.hStr) / 100) * h]);
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

function PulsoSection({ barras, distribucion, onNavigate }) {
  const [rango, setRango] = useState('12M');
  const [activeSeg, setActiveSeg] = useState(0);

  const numBarras = rango === '3M' ? 3 : rango === '6M' ? 6 : (barras || []).length;
  const barrasVisibles = (barras || []).slice(-numBarras);

  const w = 1000;
  const h = 200;
  const trendPath = buildTrendPath(barrasVisibles, w, h);
  const lastPoint = barrasVisibles.length
    ? [w, h - (parseFloat(barrasVisibles[barrasVisibles.length - 1].hStr) / 100) * h]
    : [w, h];

  const r = 42;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  const donutSegs = (distribucion || []).map((d, i) => {
    const pct = parseFloat(d.w);
    const dash = circ * (pct / 100);
    const seg = { ...d, idx: i, dash, offset: -acc, pctNum: parseInt(d.w, 10) || 0 };
    acc += dash;
    return seg;
  });

  const segSeleccionado = donutSegs[activeSeg] || donutSegs[0] || { c: pal.coral, l: 'Salarios', w: '72%', pctNum: 72 };
  const pctDisplay = useCountUp(segSeleccionado.pctNum, { duration: 500 });

  return (
    <section style={{ padding: '0 56px 56px' }}>
      {/* Header de Sección con Selector de Rango 3M / 6M / 12M */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'center', marginBottom: 28 }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 04 · el pulso</div>
          <div style={{ fontSize: 44, lineHeight: 1, color: pal.ink, letterSpacing: '-0.01em', ...serif }}>
            Un <em style={{ fontStyle: 'italic' }}>año</em> en un vistazo
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        {/* Selector de Rango estilo Pill */}
        <div style={{ display: 'flex', gap: 4, background: pal.cream2, padding: 4, borderRadius: 999, border: `1px solid ${pal.line}` }}>
          {['3M', '6M', '12M'].map((btn) => {
            const active = rango === btn;
            return (
              <button
                key={btn}
                type="button"
                onClick={() => setRango(btn)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 999,
                  border: 'none',
                  background: active ? pal.ink : 'transparent',
                  color: active ? pal.cream : pal.muted,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                }}
              >
                {btn}
              </button>
            );
          })}
        </div>
      </div>

      <div className="ed-grid-pulso" style={{ display: 'grid', gridTemplateColumns: '8fr 4fr', gap: 20, alignItems: 'stretch' }}>
        {/* Card Izquierda: Costo Laboral Mensual */}
        <div style={{ padding: '28px 30px 24px', background: pal.cream2, border: `1px solid ${pal.line}`, borderRadius: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 22, color: pal.ink, ...serif }}>Costo laboral mensual</div>
              <div style={{ fontSize: 12, color: pal.muted, marginTop: 2 }}>
                {barrasVisibles[0]?.m || 'Sep'} 2025 → {barrasVisibles[barrasVisibles.length - 1]?.m || 'Ago'} 2026 · miles de colones
              </div>
            </div>
            {/* Leyenda de la gráfica */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: pal.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'oklch(84% 0.10 50)' }} />
                Mensual
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: pal.coral, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                <span style={{ width: 14, height: 2.5, background: pal.coral, borderRadius: 2 }} />
                Tendencia
              </span>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            {/* Barras verticales animadas con hover interactivo */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'end', height: 200, paddingBottom: 2 }}>
              {barrasVisibles.map((b, i) => {
                const isCurrent = b.actual;
                return (
                  <div
                    key={b.m + i}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 6,
                      height: '100%',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: b.hStr,
                        background: isCurrent
                          ? `linear-gradient(180deg, ${pal.coral} 0%, oklch(62% 0.16 30) 100%)`
                          : 'linear-gradient(180deg, oklch(84% 0.10 50) 0%, oklch(88% 0.06 60) 100%)',
                        borderRadius: '6px 6px 2px 2px',
                        transformOrigin: 'bottom',
                        transformBox: 'fill-box',
                        animation: `ed-bar-grow ${0.7 + i * 0.06}s cubic-bezier(.16,1,.3,1) both, ed-bar-wave 5s ease-in-out infinite alternate ${i * 0.25}s`,
                        boxShadow: isCurrent ? '0 8px 20px -6px oklch(70% 0.16 30 / 0.45)' : 'none',
                        transition: 'transform 180ms ease, filter 180ms ease',
                      }}
                    />
                    <div style={{ ...mono, fontSize: 10, color: isCurrent ? pal.ink : pal.muted, fontWeight: isCurrent ? 700 : 500 }}>
                      {b.m}
                    </div>

                    {isCurrent && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: `calc(${b.hStr} + 10px)`,
                          padding: '5px 11px',
                          background: pal.ink,
                          color: pal.cream,
                          borderRadius: 8,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          boxShadow: '0 8px 20px -4px oklch(20% 0.02 30 / 0.45)',
                          animation: 'ed-float-slow 5s ease-in-out infinite',
                        }}
                      >
                        {b.vFmt}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Trazo de Tendencia SVG con gradiente y pulso continuo */}
            <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: 200, pointerEvents: 'none' }}>
              <defs>
                <linearGradient id="ed-trend-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="oklch(82% 0.12 60)" />
                  <stop offset="60%" stopColor="oklch(76% 0.15 40)" />
                  <stop offset="100%" stopColor={pal.coral} />
                </linearGradient>
              </defs>
              <path
                d={trendPath}
                stroke="url(#ed-trend-grad)"
                strokeWidth="2.5"
                fill="none"
                strokeDasharray="1400"
                strokeDashoffset="0"
                style={{ animation: 'ed-stroke-draw 2.4s ease-out 200ms both, ed-line-pulse 6s ease-in-out infinite' }}
              />
              <circle cx={lastPoint[0] - 6} cy={lastPoint[1]} r={5.5} fill={pal.coral} style={{ animation: 'ed-dot-glow 2.5s ease-in-out infinite' }} />
            </svg>
          </div>
        </div>

        {/* Card Derecha: Composición Donut Chart Interactiva */}
        <div style={{ padding: '28px 26px 24px', background: pal.cream2, border: `1px solid ${pal.line}`, borderRadius: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 22, ...serif }}>Composición</div>
                <div style={{ fontSize: 12, color: pal.muted, marginTop: 2 }}>Este período</div>
              </div>
              <a
                href="#reportes"
                onClick={(e) => {
                  e.preventDefault();
                  if (onNavigate) onNavigate('reportes');
                }}
                style={{ fontSize: 12, color: pal.muted, fontWeight: 500 }}
              >
                Detalle →
              </a>
            </div>

            {/* Gráfico Donut SVG interactivo con halo respirante */}
            <div style={{ position: 'relative', width: '100%', maxWidth: 210, aspectRatio: '1', margin: '0 auto 20px' }}>
              {/* Halo sutil de fondo */}
              <div
                style={{
                  position: 'absolute',
                  inset: 12,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${segSeleccionado.c}33, transparent 70%)`,
                  animation: 'ed-sun-halo 6s ease-in-out infinite',
                  pointerEvents: 'none',
                  transition: 'background 300ms ease',
                }}
              />

              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', overflow: 'visible' }}>
                <circle cx="50" cy="50" r={r} stroke="oklch(93% 0.01 70)" strokeWidth="12" fill="none" />
                {donutSegs.map((s) => {
                  const isActive = s.idx === activeSeg;
                  return (
                    <circle
                      key={s.l}
                      cx="50"
                      cy="50"
                      r={r}
                      stroke={s.c}
                      strokeWidth={isActive ? '15' : '12'}
                      fill="none"
                      strokeDasharray={`${s.dash} ${circ}`}
                      strokeDashoffset={s.offset}
                      style={{
                        animation: 'ed-stroke-draw-sm 1.4s ease-out both',
                        cursor: 'pointer',
                        transition: 'stroke-width 200ms ease, filter 200ms ease',
                        filter: isActive ? 'drop-shadow(0 0 6px rgba(0,0,0,0.15))' : 'none',
                      }}
                      onMouseEnter={() => setActiveSeg(s.idx)}
                    />
                  );
                })}
              </svg>

              {/* Centro dinámico del Donut */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: 36, color: pal.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums', ...serif }}>
                  {pctDisplay}%
                </div>
                <div style={{ fontSize: 10, color: pal.muted, marginTop: 4, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
                  {segSeleccionado.l.split(' ')[0]}
                </div>
              </div>
            </div>
          </div>

          {/* Leyenda interactiva inferior */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
            {donutSegs.map((d) => {
              const isActive = d.idx === activeSeg;
              return (
                <div
                  key={d.l}
                  onMouseEnter={() => setActiveSeg(d.idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: isActive ? 'oklch(94% 0.015 65)' : 'transparent',
                    transition: 'background 160ms ease',
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: d.c, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontWeight: isActive ? 600 : 400, color: isActive ? pal.ink : 'inherit' }}>{d.l}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: pal.muted }}>{d.vFmt}</span>
                  <span style={{ fontWeight: 600, minWidth: 36, textAlign: 'right', color: isActive ? pal.ink : 'inherit' }}>{d.w}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Cierre editorial + footer + dock
   --------------------------------------------------------- */

function Closing({ atender, totales, emps, onNavigate }) {
  const prioridad = atender.find((o) => o.k === 'vencido') || atender.find((o) => o.k === 'proximo') || atender[0] || null;

  return (
    <section style={{ padding: '0 56px 88px', position: 'relative' }}>
      <div
        style={{
          position: 'relative',
          background: 'linear-gradient(160deg, oklch(90% 0.07 30) 0%, oklch(85% 0.09 55) 45%, oklch(80% 0.12 25) 100%)',
          borderRadius: 32,
          padding: '56px 64px',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              top: '-30%',
              right: '-15%',
              width: '60%',
              height: '120%',
              background: 'radial-gradient(circle, oklch(95% 0.13 65 / 0.45), transparent 65%)',
              filter: 'blur(30px)',
              animation: 'ed-aurora 11s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-40%',
              left: '-10%',
              width: '50%',
              height: '100%',
              background: 'radial-gradient(circle, oklch(75% 0.15 320 / 0.3), transparent 65%)',
              filter: 'blur(30px)',
              animation: 'ed-aurora-2 13s ease-in-out infinite',
            }}
          />
        </div>

        <div className="ed-grid-2" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '8fr 4fr', gap: 56, alignItems: 'end' }}>
          <div>
            <div style={{ ...mono, color: 'oklch(28% 0.06 30)', marginBottom: 18 }}>Prioridad de hoy · {fechaLarga(HOY).split(' · ')[0]}</div>
            {prioridad ? (
              <>
                <div style={{ fontSize: 48, lineHeight: 1.05, letterSpacing: '-0.02em', color: pal.ink, marginBottom: 20, ...serif }}>
                  Empezá por <em style={{ fontStyle: 'italic', color: 'oklch(35% 0.10 30)' }}>{prioridad.t}</em>.
                </div>
                <p style={{ ...serif, fontSize: 19, fontStyle: 'italic', lineHeight: 1.5, color: 'oklch(30% 0.04 30)', maxWidth: 640, margin: '0 0 24px' }}>
                  {prioridad.d} — {prioridad.dias.toLowerCase()}, {prioridad.montoFmt}. Resolverlo primero deja el resto de la quincena más liviano.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => onNavigate(prioridad.target)}
                    style={{ padding: '14px 24px', background: pal.ink, color: pal.cream, border: 'none', borderRadius: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                  >
                    Ir a resolverlo
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('calendario')}
                    style={{ padding: '14px 22px', background: 'oklch(99% 0.006 70 / 0.5)', color: pal.ink, border: `1px solid oklch(99% 0.006 70)`, borderRadius: 14, fontSize: 14, cursor: 'pointer', backdropFilter: 'blur(10px)' }}
                  >
                    Ver todo el calendario
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, lineHeight: 1.05, letterSpacing: '-0.02em', color: pal.ink, marginBottom: 20, ...serif }}>
                  Vas al <em style={{ fontStyle: 'italic', color: 'oklch(35% 0.10 30)' }}>día</em>.
                </div>
                <p style={{ ...serif, fontSize: 19, fontStyle: 'italic', lineHeight: 1.5, color: 'oklch(30% 0.04 30)', maxWidth: 640, margin: '0 0 24px' }}>
                  No hay nada urgente que atender hoy — buen momento para revisar los reportes o planear la próxima quincena.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('reportes')}
                  style={{ padding: '14px 24px', background: pal.ink, color: pal.cream, border: 'none', borderRadius: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                >
                  Ver reportes
                </button>
              </>
            )}
          </div>

          <div>
            <div style={{ background: 'oklch(99% 0.006 70 / 0.55)', backdropFilter: 'blur(20px)', border: '1px solid oklch(99% 0.006 70 / 0.6)', borderRadius: 20, padding: '22px 24px' }}>
              <div style={{ ...mono, color: 'oklch(30% 0.06 30)', marginBottom: 10 }}>Resumen de hoy</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, color: pal.ink }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ color: 'oklch(40% 0.04 30)' }}>Empleados por pagar</span>
                  <strong>{totales.pendCount} de {emps.length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ color: 'oklch(40% 0.04 30)' }}>Obligaciones por resolver</span>
                  <strong>{atender.length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ color: 'oklch(40% 0.04 30)' }}>Quincena cubierta</span>
                  <strong>{totales.pagoPct}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EditorialFooter({ empresaNombre }) {
  return (
    <footer
      style={{
        padding: '20px 56px 32px',
        borderTop: `1px solid ${pal.line}`,
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
      <span>{empresaNombre} · Gestión Laboral</span>
      <span style={{ fontStyle: 'italic', fontSize: 14, textTransform: 'none', letterSpacing: 0, color: 'oklch(35% 0.03 30)', ...serif }}>
        Cuidar la nómina también es cuidar a las personas.
      </span>
      <span>© {HOY.anio} · Prototipo</span>
    </footer>
  );
}

function Dock({ onNavigate }) {
  return (
    <div style={{ position: 'sticky', bottom: 20, margin: '-36px auto 0', width: 'fit-content', display: 'flex', justifyContent: 'center', zIndex: 20 }}>
      <div
        className="ed-dock"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: pal.ink,
          color: pal.cream,
          padding: '8px 8px 8px 20px',
          borderRadius: 999,
          boxShadow: '0 24px 60px -20px oklch(20% 0.02 30 / 0.5)',
        }}
      >
        <span style={{ ...mono, color: 'oklch(70% 0.02 60)', fontSize: 10 }}>Acciones rápidas</span>
        <span style={{ width: 1, height: 16, background: 'oklch(40% 0.02 30)', margin: '0 6px' }} />
        <button type="button" onClick={() => onNavigate('ccss')} style={{ padding: '9px 16px', background: 'transparent', color: 'oklch(88% 0.03 60)', border: 'none', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
          CCSS
        </button>
        <button type="button" onClick={() => onNavigate('pagos')} style={{ padding: '9px 16px', background: 'transparent', color: 'oklch(88% 0.03 60)', border: 'none', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
          Registrar pago
        </button>
        <button type="button" onClick={() => onNavigate('empleados')} style={{ padding: '9px 16px', background: 'transparent', color: 'oklch(88% 0.03 60)', border: 'none', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
          Agregar empleado
        </button>
        <button type="button" onClick={() => onNavigate('planilla')} style={{ padding: '9px 16px', background: 'transparent', color: 'oklch(88% 0.03 60)', border: 'none', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
          Cerrar quincena
        </button>
        <button
          type="button"
          onClick={() => onNavigate('planilla')}
          style={{ padding: '9px 18px', background: pal.gold, color: pal.ink, border: 'none', borderRadius: 999, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
        >
          Ver planilla →
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Scroll rail — hilo editorial vertical con marcadores de sección
   --------------------------------------------------------- */

const RAIL_SECTIONS = [
  { key: 'hero', label: 'Hoy' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'numeros', label: 'Números' },
  { key: 'atender', label: 'Atender' },
  { key: 'equipo', label: 'Equipo' },
  { key: 'pulso', label: 'Pulso' },
  { key: 'cierre', label: 'Cierre' },
];

/** Sección activa + posición real de cada marcador, medidos sobre `#app-content` (el contenedor que realmente scrollea). */
function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 100 100" fill="none" style={{ display: 'block' }}>
      {/* Crescent moon shape */}
      <path
        d="M50,15 A35,35 0 1,0 85,50 A26,26 0 1,1 50,15 Z"
        fill="#1a1a24"
      />
      {/* Brown/gold leaf */}
      <path
        d="M48,40 C60,30 75,32 75,32 C75,32 72,48 60,55 C52,60 48,58 48,58 Z"
        fill="#c49b76"
      />
      {/* Stem */}
      <path
        d="M48,58 Q44,64 42,70"
        stroke="#1a1a24"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function LotusFlower({ progress }) {
  const petals = [
    { aStart: 0, aEnd: 0, sStart: 0.9, sEnd: 1.15, opStart: 1.0, opEnd: 1.0 },        // Central
    { aStart: -8, aEnd: -35, sStart: 0.85, sEnd: 1.05, opStart: 0.9, opEnd: 1.0 },     // Interno Izq
    { aStart: 8, aEnd: 35, sStart: 0.85, sEnd: 1.05, opStart: 0.9, opEnd: 1.0 },       // Interno Der
    { aStart: -16, aEnd: -65, sStart: 0.75, sEnd: 1.0, opStart: 0.8, opEnd: 1.0 },     // Medio Izq
    { aStart: 16, aEnd: 65, sStart: 0.75, sEnd: 1.0, opStart: 0.8, opEnd: 1.0 },       // Medio Der
    { aStart: -24, aEnd: -95, sStart: 0.65, sEnd: 0.95, opStart: 0.7, opEnd: 1.0 },     // Externo Izq
    { aStart: 24, aEnd: 95, sStart: 0.65, sEnd: 0.95, opStart: 0.7, opEnd: 1.0 },       // Externo Der
  ];

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 40 28"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Degradado suave durazno/coral para los pétalos del loto */}
        <linearGradient id="ed-lotus-petal-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd8b3" />
          <stop offset="100%" stopColor="#ff9a75" />
        </linearGradient>
      </defs>

      {/* Pétalos del loto rotados alrededor de su punto base (20, 24) */}
      {petals.map((p, idx) => {
        const angle = p.aStart + progress * (p.aEnd - p.aStart);
        const scale = p.sStart + progress * (p.sEnd - p.sStart);
        const opacity = p.opStart + progress * (p.opEnd - p.opStart);
        
        return (
          <path
            key={idx}
            d="M20,24 C15.5,17 15.5,9 20,4 C24.5,9 24.5,17 20,24 Z"
            fill="url(#ed-lotus-petal-grad)"
            stroke="#ffffff"
            strokeWidth="0.5"
            transform={`translate(20, 24) rotate(${angle}) scale(${scale}) translate(-20, -24)`}
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
}
/** Sección activa + posición real de cada marcador, medidos sobre `#app-content` (el contenedor que realmente scrollea). */
function useScrollRail(sectionRefs) {
  const [activeKey, setActiveKey] = useState(RAIL_SECTIONS[0].key);
  const [dotProgress, setDotProgress] = useState({});
  const [scrollProgress, setScrollProgress] = useState(0);
  const dotPositionsRef = useRef({});

  useEffect(() => {
    const scrollEl = document.getElementById('app-content');
    if (!scrollEl) return undefined;

    function scrollable() {
      return Math.max(1, scrollEl.scrollHeight - scrollEl.clientHeight);
    }

    function measure() {
      const total = scrollable();
      const next = {};
      RAIL_SECTIONS.forEach(({ key }) => {
        const el = sectionRefs.current[key];
        if (el) next[key] = Math.min(1, Math.max(0, el.offsetTop / total));
      });
      dotPositionsRef.current = next;
      setDotProgress(next);
    }

    function update() {
      const currentScroll = scrollEl.scrollTop;
      const totalScroll = scrollable();
      const pct = totalScroll > 0 ? Math.min(1, Math.max(0, currentScroll / totalScroll)) : 0;
      setScrollProgress(pct);

      // Usar las posiciones de marcadores cacheadas sin forzar reflows de offsetTop
      const dotPositions = dotPositionsRef.current;
      let closestKey = RAIL_SECTIONS[0].key;
      let minDiff = Infinity;
      RAIL_SECTIONS.forEach(({ key }) => {
        const pos = dotPositions[key];
        if (pos !== undefined) {
          const diff = Math.abs(pos - pct);
          if (diff < minDiff) {
            minDiff = diff;
            closestKey = key;
          }
        }
      });
      setActiveKey(closestKey);
    }

    measure();
    update();

    let raf = null;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        update();
        raf = null;
      });
    }

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { activeKey, dotProgress, scrollProgress };
}

/**
 * Hilo editorial vertical fijo a la izquierda — un filamento tenue con
 * "cuentas" (una por sección) y pequeñas puntadas decorativas entre ellas,
 * como un hilo cosido a mano. Solo la cuenta de la sección activa toma
 * color; el resto queda en gris casi invisible. No es navegación (no
 * reemplaza al masthead) ni un indicador de progreso aparte: es puramente
 * de orientación. Se oculta bajo 1180px junto con la nav del masthead.
 */
function ScrollRail({ sectionRefs }) {
  const { activeKey, dotProgress, scrollProgress } = useScrollRail(sectionRefs);
  const [hoverKey, setHoverKey] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [isHandleHovered, setIsHandleHovered] = useState(false);

  function goTo(key) {
    const el = sectionRefs.current[key];
    const scrollEl = document.getElementById('app-content');
    if (!el || !scrollEl) return;
    scrollEl.scrollTo({ top: Math.max(0, el.offsetTop - 24), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  function handleMouseDown(e) {
    setIsDragging(true);
    e.preventDefault();
  }

  function handleRailClick(e) {
    if (e.target.closest('button') || e.target.closest('svg') || e.target.tagName === 'BUTTON') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const pct = Math.min(1, Math.max(0, clickY / rect.height));
    const scrollEl = document.getElementById('app-content');
    if (scrollEl) {
      scrollEl.scrollTo({
        top: pct * (scrollEl.scrollHeight - scrollEl.clientHeight),
        behavior: 'smooth',
      });
    }
  }

  useEffect(() => {
    if (!isDragging) return;

    let dragRaf = null;
    function handleMouseMove(e) {
      if (dragRaf) return;
      dragRaf = requestAnimationFrame(() => {
        dragRaf = null;
        const railEl = document.querySelector('.ed-rail');
        if (!railEl) return;
        const rect = railEl.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const pct = Math.min(1, Math.max(0, y / rect.height));
        const scrollEl = document.getElementById('app-content');
        if (scrollEl) {
          scrollEl.scrollTop = pct * (scrollEl.scrollHeight - scrollEl.clientHeight);
        }
      });
    }

    function handleMouseUp() {
      setIsDragging(false);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (dragRaf) cancelAnimationFrame(dragRaf);
    };
  }, [isDragging]);

  const ordered = RAIL_SECTIONS.filter(({ key }) => dotProgress[key] !== undefined);
  const lineCenter = 11.5;

  // GPU Hardware-accelerated scale factor (0.85 -> 1.10 = 34px -> 44px)
  const baseScale = 0.85 + scrollProgress * 0.25;
  const currentScale = baseScale * (isHandleHovered ? 1.08 : 1);

  return (
    <div
      className="ed-rail"
      onClick={handleRailClick}
      style={{
        position: 'fixed',
        left: 26,
        top: 132,
        bottom: 108,
        width: 24,
        zIndex: 15,
        pointerEvents: 'auto',
        cursor: 'pointer',
      }}
      aria-hidden="true"
    >
      {/* Logo al tope del rail */}
      <div style={{ position: 'absolute', top: -56, left: lineCenter - 17, width: 34, height: 34, pointerEvents: 'auto' }}>
        <Logo />
      </div>

      {/* SVG Container para la pista de enredadera de hojas verticales */}
      <svg
        style={{
          position: 'absolute',
          left: lineCenter - 6,
          top: 0,
          bottom: 0,
          width: 12,
          height: '100%',
          overflow: 'visible',
          zIndex: 0,
        }}
      >
        <defs>
          {/* Patrón de hojas en blanco puro para la máscara */}
          <pattern id="ed-leaf-mask-pattern" width="12" height="24" patternUnits="userSpaceOnUse">
            <path
              d="M6,0 Q10,6 6,12 T6,24"
              stroke="#ffffff"
              strokeWidth="2.2"
              fill="none"
            />
            <path
              d="M6,0 Q2,6 6,12 T6,24"
              stroke="#ffffff"
              strokeWidth="2.2"
              fill="none"
            />
          </pattern>

          {/* Máscara basada en el patrón de hojas */}
          <mask id="ed-leaf-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="12" height="100%">
            <rect width="12" height="100%" fill="url(#ed-leaf-mask-pattern)" />
          </mask>

          {/* Patrón de fondo inactivo: cadena de hojas orgánicas tenues */}
          <pattern id="ed-leaf-chain-bg" width="12" height="24" patternUnits="userSpaceOnUse">
            <path
              d="M6,0 Q10,6 6,12 T6,24"
              stroke={pal.line}
              strokeWidth="1.2"
              fill="none"
              opacity="0.8"
            />
            <path
              d="M6,0 Q2,6 6,12 T6,24"
              stroke={pal.line}
              strokeWidth="1.2"
              fill="none"
              opacity="0.8"
            />
          </pattern>

          {/* Degradado activo: transita de amarillo-oro arriba a un naranja vibrante e intenso abajo */}
          <linearGradient id="ed-active-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffd885" stopOpacity="0.4" />
            <stop offset="35%" stopColor="#ffb050" stopOpacity="0.75" />
            <stop offset="70%" stopColor="#ff7038" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ff451a" stopOpacity="1.0" />
          </linearGradient>

          {/* Recorte de progreso exacto alineado con el scroll */}
          <clipPath id="ed-rail-clip">
            <rect x="-10" y="0" width="32" height={`${scrollProgress * 100}%`} />
          </clipPath>
        </defs>

        {/* 1. Cadena de hojas de fondo inactiva */}
        <rect width="12" height="100%" fill="url(#ed-leaf-chain-bg)" />

        {/* 2. Cadena de hojas activas: llena con el degradado continuo, enmascarada y recortada por el scrollProgress */}
        <rect
          width="12"
          height="100%"
          fill="url(#ed-active-grad)"
          mask="url(#ed-leaf-mask)"
          clipPath="url(#ed-rail-clip)"
          style={{ filter: 'drop-shadow(0 0 4px #ff703860)' }}
        />
      </svg>

      {/* Resplandor bioluminiscente dinámico centrado */}
      <div
        style={{
          position: 'absolute',
          left: lineCenter,
          top: `${scrollProgress * 100}%`,
          transform: `translate(-50%, -50%) scale(${currentScale})`,
          width: 48,
          height: 48,
          borderRadius: 999,
          background: `radial-gradient(circle, ${pal.gold} / 0.22, transparent 70%)`,
          animation: 'ed-pulse-glow 2.5s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 11,
          willChange: 'transform',
        }}
      />

      {/* Dije de Loto de Flor Damaris interactivo (Escalado 100% por GPU sin layout reflows) */}
      <div
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHandleHovered(true)}
        onMouseLeave={() => setIsHandleHovered(false)}
        style={{
          position: 'absolute',
          left: lineCenter,
          top: `${scrollProgress * 100}%`,
          transform: `translate(-50%, -50%) scale(${currentScale})`,
          width: 40,
          height: 40,
          borderRadius: 999,
          background: 'rgba(255, 249, 242, 0.75)',
          border: `1.2px solid ${isHandleHovered ? pal.coral : pal.gold}`,
          boxShadow: isHandleHovered
            ? '0 6px 20px -4px oklch(70% 0.16 30 / 0.35)'
            : '0 4px 16px -4px oklch(75% 0.13 60 / 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'ns-resize',
          pointerEvents: 'auto',
          zIndex: 12,
          willChange: 'transform, top',
        }}
      >
        {/* Punto dorado flotante superior */}
        <div
          style={{
            position: 'absolute',
            top: '19%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 4.2,
            height: 4.2,
            borderRadius: 999,
            background: pal.gold,
          }}
        />

        {/* Flor de Loto colocada y centrada verticalmente */}
        <div
          style={{
            position: 'absolute',
            top: '55%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 35,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible',
          }}
        >
          <LotusFlower progress={scrollProgress} />
        </div>

        {/* Aro decorativo colgante en la base inferior externa del dije */}
        <div
          style={{
            position: 'absolute',
            bottom: -8.5,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 8,
            height: 8,
            borderRadius: 999,
            border: `1.2px solid ${pal.gold}`,
            background: pal.cream,
            boxShadow: '0 2px 4px oklch(0% 0 0 / 0.05)',
          }}
        />
      </div>

      {ordered.map(({ key, label }, i) => {
        const top = dotProgress[key];
        const active = key === activeKey;
        const passed = scrollProgress >= top;
        const hovered = key === hoverKey;
        const prev = ordered[i - 1];
        const stitchTop = prev ? (dotProgress[prev.key] + top) / 2 : null;
        const diamond = i % 2 === 1;

        return (
          <div key={key}>
            {stitchTop !== null && (
              <span
                style={{
                  position: 'absolute',
                  left: lineCenter,
                  top: `${stitchTop * 100}%`,
                  transform: diamond ? 'translate(-50%, -50%) rotate(45deg)' : 'translate(-50%, -50%)',
                  width: 5,
                  height: 5,
                  borderRadius: diamond ? 1 : 999,
                  border: `1px solid ${pal.line2}`,
                  opacity: 0.8,
                  zIndex: 2,
                }}
              />
            )}
            <button
              type="button"
              onClick={() => goTo(key)}
              onMouseEnter={() => setHoverKey(key)}
              onMouseLeave={() => setHoverKey((k) => (k === key ? null : k))}
              aria-label={`Ir a la sección ${label}`}
              style={{
                position: 'absolute',
                left: lineCenter - 10,
                top: `${top * 100}%`,
                transform: 'translateY(-50%)',
                width: 20,
                height: 20,
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 3,
              }}
            >
              <span
                style={{
                  width: active ? 8 : passed ? 7 : hovered ? 7 : 5,
                  height: active ? 8 : passed ? 7 : hovered ? 7 : 5,
                  borderRadius: 999,
                  background: active ? pal.coral : passed ? pal.gold : hovered ? pal.muted2 : pal.line2,
                  boxShadow: active
                    ? `0 0 0 4px oklch(96% 0.015 60), 0 0 8px ${pal.coral}`
                    : passed
                      ? `0 0 0 2px oklch(96% 0.015 60)`
                      : 'none',
                  transition: 'all 200ms ease',
                  animation: active ? 'ed-dot-glow 2.5s ease-in-out infinite' : undefined,
                  flexShrink: 0,
                }}
              />
            </button>
            {/* Tooltip flotante al lado de las cuentas al hacer hover */}
            {hovered && (
              <span
                style={{
                  position: 'absolute',
                  left: 28,
                  top: `${top * 100}%`,
                  transform: 'translateY(-50%)',
                  background: pal.ink,
                  color: pal.cream,
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px oklch(0% 0 0 / 0.15)',
                  zIndex: 20,
                }}
              >
                {label}
              </span>
            )}
          </div>
        );
      })}

      {/* Terminal final del riel: un punto dorado elegante y minimalista */}
      <div
        style={{
          position: 'absolute',
          bottom: -56,
          left: lineCenter,
          transform: 'translateX(-50%)',
          width: 8,
          height: 8,
          borderRadius: 999,
          background: pal.gold,
          border: `1.5px solid ${pal.cream}`,
          boxShadow: `0 0 6px ${pal.gold}80`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

/* ---------------------------------------------------------
   Composición
   --------------------------------------------------------- */

export default function Panel({ emps, totales, atender, distribucion, barras, periodoActivo, usuario, empresaNombre, poliza, onNavigate }) {
  const sectionRefs = useRef({});
  const setSectionRef = (key) => (el) => {
    sectionRefs.current[key] = el;
  };

  return (
    <div
      className="screen ed-home"
      style={{
        fontFamily: "'Albert Sans', system-ui, sans-serif",
        color: pal.ink,
        background: pal.cream,
        minHeight: '100%',
      }}
    >
      <ScrollRail sectionRefs={sectionRefs} />

      <div style={{ maxWidth: 1440, margin: '0 auto', position: 'relative' }}>
        <Masthead usuario={usuario} periodoActivo={periodoActivo} atender={atender} onNavigate={onNavigate} />
        <div id="ed-sec-hero" ref={setSectionRef('hero')}>
          <Hero usuario={usuario} totales={totales} atender={atender} periodoActivo={periodoActivo} onNavigate={onNavigate} />
        </div>
        <div id="ed-sec-timeline" ref={setSectionRef('timeline')}>
          <Reveal>
            <Timeline periodoActivo={periodoActivo} atender={atender} />
          </Reveal>
        </div>
        <div id="ed-sec-numeros" ref={setSectionRef('numeros')}>
          {/* BigNumberStrip gestiona su propio reveal (gatea el count-in y el
              stroke-draw del gauge, no solo el fade del contenedor). */}
          <BigNumberStrip totales={totales} emps={emps} barras={barras} />
        </div>
        <div id="ed-sec-atender" ref={setSectionRef('atender')}>
          <Reveal>
            <AtenderSection atender={atender} emps={emps} poliza={poliza} onNavigate={onNavigate} />
          </Reveal>
        </div>
        <div id="ed-sec-equipo" ref={setSectionRef('equipo')}>
          <Reveal>
            <EquipoSection emps={emps} onNavigate={onNavigate} />
          </Reveal>
        </div>
        <div id="ed-sec-pulso" ref={setSectionRef('pulso')}>
          <Reveal>
            <PulsoSection barras={barras} distribucion={distribucion} />
          </Reveal>
        </div>
        <div id="ed-sec-cierre" ref={setSectionRef('cierre')}>
          <Reveal>
            <Closing atender={atender} totales={totales} emps={emps} onNavigate={onNavigate} />
          </Reveal>
          <EditorialFooter empresaNombre={empresaNombre} />
        </div>
      </div>
      <Dock onNavigate={onNavigate} />
    </div>
  );
}
