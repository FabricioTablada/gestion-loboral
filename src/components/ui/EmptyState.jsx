import { color, font } from '../../theme/tokens.js';

/**
 * Estado vacío (Fase 1 · E). Ninguna pantalla lo usa todavía porque los
 * datos mock siempre están presentes — queda listo para cuando un
 * período/empleado real no tenga datos que mostrar.
 */
export function EmptyState({ icon, title, description, action }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 6,
        padding: '48px 24px',
        color: color.muted3,
      }}
    >
      {icon && (
        <div
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: color.track,
            color: color.muted3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 6,
          }}
        >
          {icon}
        </div>
      )}
      <div style={{ fontFamily: font.display, fontWeight: 400, fontSize: '1.1rem', color: color.text3 }}>
        {title}
      </div>
      {description && <p style={{ margin: 0, fontSize: '0.84rem', maxWidth: 320, lineHeight: 1.5 }}>{description}</p>}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}
