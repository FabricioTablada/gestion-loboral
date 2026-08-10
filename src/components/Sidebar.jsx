import { color, font } from '../theme/tokens.js';
import { navGroups, screens } from '../navigation.js';
import { usuario } from '../data/mock.js';

/** Isotipo: cuadrado ámbar cortado en diagonal. */
function Logo() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 36,
        height: 36,
        borderRadius: 6,
        background: color.accent,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg,transparent 44%,${color.ink} 44%,${color.ink} 56%,transparent 56%)`,
        }}
      />
    </div>
  );
}

function GroupLabel({ children, first }) {
  return (
    <div
      style={{
        fontFamily: font.mono,
        fontSize: '0.56rem',
        letterSpacing: '0.2em',
        color: color.onInkDim,
        padding: first ? '8px 10px 6px' : '16px 10px 6px',
      }}
    >
      {children}
    </div>
  );
}

/**
 * Contenido del menú, sin el `<aside>` que lo posiciona — así el mismo
 * markup se reutiliza en el sidebar fijo de escritorio y dentro del
 * Drawer de navegación móvil (Fase 1 · B.4 / F.1), sin duplicar nada.
 */
export function SidebarContent({ current, onNavigate, empresaNombre, modulo }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Marca */}
      <div
        style={{
          padding: '22px 22px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: `1px solid ${color.onInkFaint}`,
        }}
      >
        <Logo />
        <div style={{ lineHeight: 1.1 }}>
          <div
            style={{
              fontFamily: font.display,
              fontWeight: 400,
              fontSize: '1.02rem',
              letterSpacing: '0.12em',
              color: color.onInkText,
            }}
          >
            {empresaNombre}
          </div>
          <div
            style={{
              fontFamily: font.mono,
              fontSize: '0.58rem',
              letterSpacing: '0.22em',
              color: color.onInkMuted,
              marginTop: 3,
            }}
          >
            {modulo}
          </div>
        </div>
      </div>

      {/* Menú */}
      <nav
        aria-label="Navegación principal"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {navGroups.map((group, gi) => (
          <div key={group.label} style={{ display: 'contents' }}>
            <GroupLabel first={gi === 0}>{group.label}</GroupLabel>
            {group.items.map((key) => {
              const item = screens[key];
              const Icon = item.icon;
              const active = current === key;
              return (
                <button
                  key={key}
                  type="button"
                  className="nav-item"
                  data-active={active}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onNavigate(key)}
                >
                  <span className="nav-item__bar" />
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Usuario */}
      <div
        style={{
          padding: 14,
          borderTop: `1px solid ${color.onInkFaint}`,
          display: 'flex',
          alignItems: 'center',
          gap: 11,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: color.accentSoft,
            color: color.accentOn,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.8rem',
            flexShrink: 0,
          }}
        >
          {usuario.iniciales}
        </div>
        <div style={{ lineHeight: 1.25, minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: color.onInkText,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {usuario.nombre}
          </div>
          <div style={{ fontSize: '0.68rem', color: color.onInkFaded }}>{usuario.rol}</div>
        </div>
      </div>
    </div>
  );
}

/** Sidebar fijo de escritorio. Oculto bajo 900px (ver global.css); su
 * contenido reaparece en el Drawer móvil montado desde App.jsx. */
export default function Sidebar({ current, onNavigate, empresaNombre, modulo }) {
  return (
    <aside
      className="app-sidebar"
      style={{
        width: 262,
        flexShrink: 0,
        background: color.ink,
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid ${color.onInk}`,
      }}
    >
      <SidebarContent current={current} onNavigate={onNavigate} empresaNombre={empresaNombre} modulo={modulo} />
    </aside>
  );
}
