import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { color as pal } from '../theme/tokens.js';

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Logo({ size = 36 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 11,
        background: 'linear-gradient(135deg, oklch(22% 0.02 30), oklch(14% 0.02 30))',
        border: '1px solid oklch(36% 0.04 55)',
        boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.22)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Brillo Satinado de fondo */}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 30% 30%, oklch(85% 0.14 75 / 0.25), transparent 70%)',
          animation: 'ed-aurora 8s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <svg width="22" height="22" viewBox="0 0 100 100" fill="none" style={{ display: 'block', position: 'relative', zIndex: 2 }}>
        <defs>
          <linearGradient id="brand-gold-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(88% 0.15 75)" />
            <stop offset="100%" stopColor="oklch(70% 0.16 30)" />
          </linearGradient>
          <linearGradient id="brand-coral-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(85% 0.10 55)" />
            <stop offset="100%" stopColor="oklch(72% 0.16 30)" />
          </linearGradient>
        </defs>

        {/* Outer Orbital Crescent Ring */}
        <path
          d="M50 10 A40 40 0 1 0 90 50 A30 30 0 1 1 50 10 Z"
          fill="url(#brand-gold-g)"
        />

        {/* Inner Lotus Petal */}
        <path
          d="M48 35 C62 24 78 28 78 28 C78 28 74 46 60 54 C50 60 48 56 48 56 Z"
          fill="url(#brand-coral-g)"
        />

        {/* Stem curve */}
        <path
          d="M48 56 Q42 64 38 72"
          stroke="oklch(88% 0.15 75)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Bioluminescent dot at top */}
        <circle cx="50" cy="18" r="4.5" fill="oklch(96% 0.05 65)" />
      </svg>
    </div>
  );
}

export function LotusFlower({ progress }) {
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

export function useScrollRail(sectionRefs, sections) {
  const [activeKey, setActiveKey] = useState(sections[0]?.key || '');
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
      sections.forEach(({ key }) => {
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
      let closestKey = sections[0]?.key || '';
      let minDiff = Infinity;
      sections.forEach(({ key }) => {
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
  }, [sections]);

  return { activeKey, dotProgress, scrollProgress };
}

export default function ScrollRail({ sectionRefs, sections }) {
  const { activeKey, dotProgress, scrollProgress } = useScrollRail(sectionRefs, sections);
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

  const ordered = sections.filter(({ key }) => dotProgress[key] !== undefined);
  const lineCenter = 11.5;

  // GPU Hardware-accelerated scale factor (0.85 -> 1.10 = 34px -> 44px)
  const baseScale = 0.85 + scrollProgress * 0.25;
  const currentScale = baseScale * (isHandleHovered ? 1.08 : 1);

  if (typeof document === 'undefined') return null;

  // Montado en <body>: el rail es `position: fixed`, y dentro de la pantalla
  // su bloque contenedor pasaba a ser el contenedor `.screen` (transformado
  // por su animación de entrada), así que `top`/`bottom` se medían contra
  // toda la altura del documento en vez de contra la ventana y el rail se
  // iba con el scroll. Ver la nota en components/ui/Modal.jsx.
  return createPortal(
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
    </div>,
    document.body,
  );
}
