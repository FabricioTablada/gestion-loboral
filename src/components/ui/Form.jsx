import { useId } from 'react';

import { color, radius } from '../../theme/tokens.js';

/**
 * Campos de formulario base (Fase 1 · E / I.5): nivel 0 de elevación,
 * el borde comunica el estado. Label siempre arriba, texto de ayuda
 * opcional, error debajo — nunca placeholder-como-label. Ningún campo
 * está conectado a un formulario real todavía; son la base que usarán
 * las pantallas de edición en una fase posterior.
 */
export function Field({ label, help, error, required, htmlFor, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label htmlFor={htmlFor} style={{ fontSize: '0.8rem', fontWeight: 600, color: color.text3 }}>
          {label}
          {required && (
            <span aria-hidden="true" style={{ color: color.dangerBtn }}>
              {' '}
              *
            </span>
          )}
        </label>
      )}
      {children}
      {help && !error && <span style={{ fontSize: '0.74rem', color: color.muted3 }}>{help}</span>}
      {error && (
        <span role="alert" style={{ fontSize: '0.74rem', color: color.danger, fontWeight: 500 }}>
          {error}
        </span>
      )}
    </div>
  );
}

const fieldBaseStyle = (error) => ({
  width: '100%',
  padding: '9px 12px',
  fontSize: '0.86rem',
  fontFamily: 'inherit',
  color: color.text3,
  background: color.surface,
  border: `1px solid ${error ? color.danger : color.borderInput}`,
  borderRadius: radius.sm,
  transition: 'border-color 120ms ease, box-shadow 120ms ease',
});

export function Input({ id, error, style, ...rest }) {
  const autoId = useId();
  return <input id={id || autoId} style={{ ...fieldBaseStyle(error), ...style }} {...rest} />;
}

export function Select({ id, error, children, style, ...rest }) {
  const autoId = useId();
  return (
    <select id={id || autoId} style={{ ...fieldBaseStyle(error), ...style }} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({ id, label, style, ...rest }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        id={inputId}
        type="checkbox"
        style={{ width: 16, height: 16, accentColor: color.accent, ...style }}
        {...rest}
      />
      {label && (
        <label htmlFor={inputId} style={{ fontSize: '0.84rem', color: color.text3 }}>
          {label}
        </label>
      )}
    </div>
  );
}
