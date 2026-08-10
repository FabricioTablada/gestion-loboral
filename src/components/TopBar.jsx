import { useEffect, useRef, useState } from 'react';

import { color, font, radius, elevation } from '../theme/tokens.js';
import { Button, Dot, Badge } from './ui/Primitives.jsx';
import { IconChevronDown, IconCampana, IconMenu, IconCheck } from './ui/Icons.jsx';

/** Cierra el desplegable al hacer click fuera o al presionar Escape. */
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

const dropdownStyle = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  background: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: elevation[3],
  overflow: 'hidden',
  zIndex: 50,
};

/** Selector de período — única fuente para cambiar de período en toda la app. */
function PeriodSwitcher({ periodos, periodoMostrado, periodoActivoId, onSeleccionar }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));

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
          gap: 9,
          padding: '8px 14px',
          background: color.surface,
          border: `1px solid ${color.borderInput}`,
          borderRadius: radius.pill,
          fontSize: '0.8rem',
          fontWeight: 500,
          fontFamily: 'inherit',
          color: 'oklch(30% 0.015 95)',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
      >
        <Dot c={periodoMostrado?.id === periodoActivoId ? color.teal : color.amberDot} />
        <span className="period-selector__label">{periodoMostrado?.etiqueta}</span>
        <IconChevronDown size={14} stroke="oklch(55% 0.015 95)" />
      </button>

      {open && (
        <div role="listbox" style={{ ...dropdownStyle, width: 280, maxHeight: 340, overflowY: 'auto' }}>
          {periodos.map((p) => {
            const selected = p.id === periodoMostrado?.id;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={selected}
                className="list-row"
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
                  background: 'transparent',
                  font: 'inherit',
                  cursor: 'pointer',
                  color: color.text3,
                  fontSize: '0.82rem',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Dot c={p.estado === 'abierto' ? color.teal : 'oklch(70% 0.01 95)'} />
                  {p.etiqueta}
                </span>
                {selected && <IconCheck size={14} stroke={color.accent} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const TONE_DOT = { danger: color.danger, warn: color.amberDot, default: color.teal };

/** Panel desplegable de la campana — notificaciones mock, navegables. */
function NotificationsPanel({ notificaciones, onNotifClick }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Button
        variant="icon"
        size="icon"
        aria-label={`Notificaciones${noLeidas ? ` (${noLeidas} sin leer)` : ''}`}
        onClick={() => setOpen((o) => !o)}
        style={{ position: 'relative' }}
      >
        <IconCampana size={18} stroke="oklch(40% 0.015 95)" />
        {noLeidas > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 6,
              right: 7,
              minWidth: 15,
              height: 15,
              padding: '0 3px',
              borderRadius: 999,
              background: color.danger,
              border: `1.5px solid ${color.surface}`,
              color: color.dangerOn,
              fontSize: '0.6rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {noLeidas}
          </span>
        )}
      </Button>

      {open && (
        <div style={{ ...dropdownStyle, width: 320, maxHeight: 380, overflowY: 'auto' }}>
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${color.borderSoft}`,
              fontSize: '0.82rem',
              fontWeight: 600,
              color: color.text2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            Notificaciones
            {noLeidas > 0 && (
              <Badge bg={color.accentSoft} c={color.accentOn} size="xs">
                {noLeidas} sin leer
              </Badge>
            )}
          </div>
          {notificaciones.length === 0 && (
            <div style={{ padding: '20px 16px', fontSize: '0.82rem', color: color.muted3, textAlign: 'center' }}>
              Sin notificaciones
            </div>
          )}
          {notificaciones.map((n) => (
            <button
              key={n.id}
              type="button"
              className="list-row"
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
                borderBottom: `1px solid ${color.borderFaint}`,
                background: 'transparent',
                font: 'inherit',
                cursor: 'pointer',
              }}
            >
              <span style={{ marginTop: 5, flexShrink: 0 }}>
                <Dot c={TONE_DOT[n.tono] || TONE_DOT.default} size={n.leida ? 5 : 7} />
              </span>
              <span style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: n.leida ? 500 : 700, color: color.text3 }}>{n.titulo}</div>
                <div style={{ fontSize: '0.74rem', color: color.muted, marginTop: 2 }}>{n.detalle}</div>
                <div style={{ fontSize: '0.68rem', color: color.muted4, marginTop: 3 }}>{n.fecha}</div>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopBar({
  title,
  subtitle,
  onMenuClick,
  periodos,
  periodoMostrado,
  periodoActivoId,
  onSeleccionarPeriodo,
  notificaciones,
  onNotifClick,
}) {
  return (
    <header
      className="app-header"
      style={{
        height: 74,
        flexShrink: 0,
        background: color.surfaceAlt,
        borderBottom: `1px solid ${color.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        padding: '0 32px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        {/* Solo visible bajo 900px (.menu-toggle en global.css) — abre el
            Drawer de navegación que sustituye al sidebar fijo. */}
        <button
          type="button"
          className="menu-toggle btn btn--icon btn--icon-size"
          aria-label="Abrir menú de navegación"
          onClick={onMenuClick}
        >
          <IconMenu size={18} stroke="oklch(40% 0.015 95)" />
        </button>

        <div style={{ minWidth: 0 }}>
          <h1
            className="topbar-title"
            style={{
              margin: 0,
              fontFamily: font.display,
              fontWeight: 300,
              fontSize: '1.7rem',
              letterSpacing: '-0.01em',
              color: color.text,
              lineHeight: 1.05,
            }}
          >
            {title}
          </h1>
          <div style={{ fontSize: '0.8rem', color: color.muted2, marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <PeriodSwitcher
          periodos={periodos}
          periodoMostrado={periodoMostrado}
          periodoActivoId={periodoActivoId}
          onSeleccionar={onSeleccionarPeriodo}
        />

        <NotificationsPanel notificaciones={notificaciones} onNotifClick={onNotifClick} />
      </div>
    </header>
  );
}
