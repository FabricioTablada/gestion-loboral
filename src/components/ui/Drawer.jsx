import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { color, radius, elevation } from '../../theme/tokens.js';
import { Button } from './Primitives.jsx';
import { IconClose } from './Icons.jsx';

/**
 * Panel lateral: entra/sale por el borde de `side` (Fase 1 · I.2 / I.5).
 * Nivel 3 de elevación. Se usa tanto para el nav móvil (`side="left"`,
 * ver Sidebar.jsx) como para futuros paneles de detalle (`side="right"`).
 */
export function Drawer({ open, onClose, side = 'right', title, width = 320, background = color.surface, children }) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = setTimeout(() => setRendered(false), 300);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!rendered) return null;
  if (typeof document === 'undefined') return null;

  // Igual que `Modal`: se monta en `<body>` para que su `position: fixed` mida
  // contra la ventana y no contra un ancestro transformado (ver Modal.jsx).
  return createPortal(
    <div
      className={`scrim${visible ? ' scrim--visible' : ''}`}
      onClick={onClose}
      style={{ display: 'flex', justifyContent: side === 'left' ? 'flex-start' : 'flex-end' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-side={side}
        onClick={(e) => e.stopPropagation()}
        className={`drawer-surface${visible ? ' drawer-surface--visible' : ''}`}
        style={{
          width: '100%',
          maxWidth: width,
          height: '100%',
          background,
          boxShadow: elevation[3],
          borderRadius: side === 'left' ? `0 ${radius.lg}px ${radius.lg}px 0` : `${radius.lg}px 0 0 ${radius.lg}px`,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {title && (
          <div
            style={{
              padding: '18px 20px',
              borderBottom: `1px solid ${color.borderSoft}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexShrink: 0,
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 600, color: color.text2 }}>{title}</h2>
            <Button variant="icon" size="icon" aria-label="Cerrar" onClick={onClose}>
              <IconClose size={16} />
            </Button>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
