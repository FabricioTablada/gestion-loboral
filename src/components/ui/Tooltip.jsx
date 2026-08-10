import { useId, useState } from 'react';

/**
 * Tooltip mínimo por hover/foco. Sin librería de posicionamiento: el
 * trigger es `position: relative` y el tooltip se ancla con CSS
 * (`.tooltip[data-side]` en global.css). Pensado sobre todo para explicar
 * botones con `pending` (Fase 1 · B.1) y para iconos sin texto visible.
 */
export function Tooltip({ label, side = 'top', style, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', ...style }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <span id={id} role="tooltip" data-side={side} className={`tooltip${open ? ' tooltip--visible' : ''}`}>
        {label}
      </span>
    </span>
  );
}
