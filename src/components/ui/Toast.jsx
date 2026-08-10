import { createContext, useCallback, useContext, useState } from 'react';

import { color, radius, elevation, status } from '../../theme/tokens.js';
import { Dot } from './Primitives.jsx';

/**
 * Sistema de notificaciones transitorias (Fase 1 · E / I.2). El provider
 * se monta una vez en App.jsx; nadie lo consume todavía — queda listo
 * para cuando una acción real (marcar como pagada, exportar…) necesite
 * confirmar su resultado, sin requerir más plomería en ese momento.
 */
const ToastContext = createContext(null);

let uid = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, { tone = 'default', duration = 4000 } = {}) => {
      const id = ++uid;
      setToasts((list) => [...list, { id, message, tone }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

const TONE_DOT = {
  default: color.teal,
  success: status.pagado.d,
  danger: color.dangerBtn,
};

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 80,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} tone={t.tone} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

/** Toast individual — también exportado para previsualizarlo suelto. */
export function Toast({ message, tone = 'default', onDismiss }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="toast toast--visible"
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 16px',
        background: color.ink,
        color: color.onInkText,
        borderRadius: radius.md,
        boxShadow: elevation[3],
        fontSize: '0.84rem',
        fontWeight: 500,
      }}
    >
      <Dot c={TONE_DOT[tone] || TONE_DOT.default} />
      {message}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar notificación"
          style={{
            background: 'none',
            border: 'none',
            color: color.onInkMuted,
            cursor: 'pointer',
            padding: 2,
            marginLeft: 4,
            fontSize: '0.9rem',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
