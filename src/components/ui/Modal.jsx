import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { color, font, radius, elevation } from '../../theme/tokens.js';
import { Button } from './Primitives.jsx';
import { IconClose } from './Icons.jsx';

/**
 * Modal centrado: scale(0.97→1) + fade, con scrim (Fase 1 · I.2 / I.5).
 * Nivel 3 de elevación. Cierra con Esc, click en el scrim, o el botón ×.
 *
 * Se monta con `createPortal` directo en `<body>`, NO donde se declara. Sin
 * eso el modal quedaba invisible en la práctica: todas las pantallas cuelgan
 * de un contenedor `.screen`, que en global.css lleva
 * `animation: screen-in ... both` sobre `transform`. Con `fill-mode: both` el
 * elemento conserva un `transform` distinto de `none` al terminar, y un
 * ancestro transformado se convierte en el bloque contenedor de sus
 * descendientes `position: fixed`. Así, el scrim dejaba de medir contra la
 * ventana y pasaba a medir contra toda la altura de la pantalla editorial: se
 * veía el fondo oscuro (enorme) pero la tarjeta del modal, centrada dentro de
 * ese bloque altísimo, caía miles de píxeles fuera de la vista. El modal
 * siempre estuvo montado y funcionando — simplemente no se veía.
 */
export function Modal({ open, onClose, title, subtitle, footer, children, width = 480 }) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = setTimeout(() => setRendered(false), 220);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    dialogRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!rendered) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`scrim${visible ? ' scrim--visible' : ''}`}
      onClick={onClose}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`modal-surface${visible ? ' modal-surface--visible' : ''}`}
        style={{
          width: '100%',
          maxWidth: width,
          maxHeight: '86vh',
          overflowY: 'auto',
          background: color.surface,
          borderRadius: radius.md,
          boxShadow: elevation[3],
        }}
      >
        {title && (
          <div
            style={{
              padding: '18px 22px',
              borderBottom: `1px solid ${color.borderSoft}`,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div>
              <h2 id="modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: color.text2 }}>
                {title}
              </h2>
              {subtitle && <div style={{ fontSize: '0.8rem', color: color.muted, marginTop: 3 }}>{subtitle}</div>}
            </div>
            <Button variant="icon" size="icon" aria-label="Cerrar" onClick={onClose}>
              <IconClose size={16} />
            </Button>
          </div>
        )}

        <div style={{ padding: 22 }}>{children}</div>

        {footer && (
          <div
            style={{
              padding: '16px 22px',
              borderTop: `1px solid ${color.borderSoft}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Confirmación ligera sobre `Modal`, sin campos de formulario — para
 * acciones con consecuencia (cerrar período, marcar como pagada…).
 */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirmar', danger = false }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={400}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={danger ? 'danger' : 'accent'} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: '0.86rem', lineHeight: 1.6, color: color.muted3, fontFamily: font.sans }}>
        {description}
      </p>
    </Modal>
  );
}
