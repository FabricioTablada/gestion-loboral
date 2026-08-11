import { useEffect, useRef, useState } from 'react';

import { IconCampana } from './Icons.jsx';

/**
 * Panel de notificaciones (Fase 11). Reemplaza la campana estática que cada
 * masthead editorial ya traía (solo navegaba a Obligaciones, sin lista ni
 * badge real). Compartido por las 8 pantallas para no repetir la misma
 * lógica de apertura/cierre/lectura ocho veces — cada una la monta junto a
 * su propia campana, con los mismos colores oklch que ya usa el resto de la
 * interfaz editorial (no es una paleta nueva).
 *
 * Las notificaciones vienen ya armadas desde App.jsx a partir de las
 * obligaciones reales (`soloAtender`, la misma fuente que alimenta "Atender"
 * en el Home y en Obligaciones) — este componente no inventa nada, solo las
 * lista y gestiona su lectura.
 */
const pal = {
  ink: 'oklch(20% 0.02 30)',
  cream: 'oklch(96% 0.015 60)',
  cream2: 'oklch(98% 0.008 65)',
  paper: 'oklch(99% 0.006 70)',
  line: 'oklch(85% 0.015 55)',
  line2: 'oklch(90% 0.012 55)',
  muted: 'oklch(48% 0.02 40)',
  coral: 'oklch(70% 0.16 30)',
  gold: 'oklch(85% 0.14 75)',
  sky: 'oklch(80% 0.09 220)',
  red: 'oklch(58% 0.18 25)',
};

/** Mismo vocabulario de estado (`k`) que ya usan las obligaciones en toda la app. */
const TONO = { vencido: pal.red, proximo: pal.gold, pendiente: pal.sky };
const ORIGEN = { ccss: 'CCSS', ins: 'INS', pagos: 'Planilla' };

function useOutsideClose(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}

export function NotificacionesPanel({ notificaciones, onNotifClick }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const lista = notificaciones || [];
  const noLeidas = lista.filter((n) => !n.leida).length;

  // Mismo patrón que `Modal.jsx`: entra animado (`@starting-style`) pero
  // antes desaparecía de golpe al cerrar — se mantiene montado un instante
  // más para que la salida también anime (revisión de motion).
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
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notificaciones${noLeidas ? ` (${noLeidas} sin leer)` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
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
        {noLeidas > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 5,
              right: 5,
              minWidth: 15,
              height: 15,
              padding: '0 3px',
              borderRadius: 999,
              background: pal.coral,
              color: pal.cream,
              fontSize: 9,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1.5px solid ${pal.cream2}`,
            }}
          >
            {noLeidas}
          </span>
        )}
      </button>

      {rendered && (
        <div
          role="menu"
          className={`ed-pop-in${visible ? ' ed-pop-in--visible' : ''}`}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 320,
            maxHeight: 400,
            overflowY: 'auto',
            background: pal.paper,
            border: `1px solid ${pal.line}`,
            borderRadius: 16,
            boxShadow: '0 24px 48px -20px oklch(20% 0.02 30 / 0.35)',
            zIndex: 40,
            transformOrigin: 'top right',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${pal.line2}`,
              fontSize: 12.5,
              fontWeight: 600,
              color: pal.ink,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              background: pal.paper,
            }}
          >
            <span>Notificaciones</span>
            {noLeidas > 0 && <span style={{ fontSize: 10.5, color: pal.muted }}>{noLeidas} sin leer</span>}
          </div>

          {lista.length === 0 && (
            <div style={{ padding: '24px 16px', fontSize: 12.5, color: pal.muted, textAlign: 'center', fontStyle: 'italic' }}>
              Sin notificaciones — todo al día.
            </div>
          )}

          {lista.map((n, i) => (
            <button
              key={n.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onNotifClick(n);
                setOpen(false);
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                display: 'flex',
                gap: 10,
                padding: '12px 16px',
                border: 'none',
                borderBottom: `1px solid ${pal.line2}`,
                background: n.leida ? 'transparent' : 'oklch(98% 0.02 60 / 0.7)',
                font: 'inherit',
                cursor: 'pointer',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(4px)',
                transition: `opacity 180ms var(--ease-out) ${Math.min(i, 6) * 30}ms, transform 180ms var(--ease-out) ${Math.min(i, 6) * 30}ms`,
              }}
            >
              <span style={{ marginTop: 5, flexShrink: 0, width: 7, height: 7, borderRadius: 999, background: TONO[n.tono] || pal.muted }} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: TONO[n.tono] || pal.muted, marginBottom: 2 }}>
                  {ORIGEN[n.target] || n.target}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: n.leida ? 500 : 700, color: pal.ink }}>{n.titulo}</div>
                {n.detalle && <div style={{ fontSize: 11, color: pal.muted, marginTop: 2 }}>{n.detalle}</div>}
                <div style={{ fontSize: 10, color: pal.muted, marginTop: 3, display: 'flex', gap: 8 }}>
                  {n.montoFmt && n.montoFmt !== '—' && <span>{n.montoFmt}</span>}
                  <span>{n.fecha}</span>
                </div>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
