import { color, font, status } from '../theme/tokens.js';
import { Card, Button, StatusBadge } from '../components/ui/Primitives.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { IconChevronLeft, IconChevronRight, IconCalendario } from '../components/ui/Icons.jsx';

const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

const LEYENDA = [
  ['vencido', 'Vencido'],
  ['proximo', 'Próximo'],
  ['pendiente', 'Pendiente'],
  ['aldia', 'Al día'],
];

export default function Calendario({ semanas, eventos, mesLabel, onPrevMes, onNextMes, onEventoClick }) {
  return (
    <div className="screen grid-2" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 20, maxWidth: 1240 }}>
      {/* Rejilla del mes */}
      <Card pad={false}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${color.borderSoft}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ fontFamily: font.display, fontWeight: 300, fontSize: '1.5rem', color: color.text2 }}>
            {mesLabel}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="icon" size="icon" aria-label="Mes anterior" onClick={onPrevMes} style={{ width: 32, height: 32, padding: 0 }}>
              <IconChevronLeft size={16} stroke="oklch(45% 0.015 95)" />
            </Button>
            <Button variant="icon" size="icon" aria-label="Mes siguiente" onClick={onNextMes} style={{ width: 32, height: 32, padding: 0 }}>
              <IconChevronRight size={16} stroke="oklch(45% 0.015 95)" />
            </Button>
          </div>
        </div>

        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 8 }}>
            {DIAS.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: 'center',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: color.labelFaint,
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {semanas.map((w) => (
            <div
              key={w.key}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 6 }}
            >
              {w.days.map((c) => (
                <div
                  key={c.key}
                  aria-current={c.hoy ? 'date' : undefined}
                  style={{
                    aspectRatio: '1 / 0.86',
                    borderRadius: 7,
                    border: `1px solid ${c.bd}`,
                    background: c.bg,
                    padding: '6px 8px',
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: c.wt,
                      color: c.num,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {c.d}
                  </span>
                  {c.mk && (
                    <span
                      style={{
                        position: 'absolute',
                        left: 8,
                        right: 8,
                        bottom: 7,
                        height: 4,
                        borderRadius: 3,
                        background: c.dot,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            padding: '14px 20px',
            borderTop: `1px solid ${color.borderSoft}`,
          }}
        >
          {LEYENDA.map(([k, label]) => (
            <span
              key={k}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: '0.74rem',
                color: color.muted3,
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 3, background: status[k].d }} />
              {label}
            </span>
          ))}
        </div>
      </Card>

      {/* Eventos */}
      <Card pad={false} style={{ alignSelf: 'start' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${color.borderSoft}`,
            fontSize: '0.98rem',
            fontWeight: 600,
            color: color.text2,
          }}
        >
          Eventos del mes
        </div>

        {eventos.length === 0 ? (
          <EmptyState icon={<IconCalendario size={20} />} title="Sin eventos este mes" description="No hay obligaciones registradas para el mes que estás viendo." />
        ) : (
          eventos.map((ev) => (
            <button
              key={`${ev.d}-${ev.t}`}
              type="button"
              className="list-row"
              onClick={() => onEventoClick(ev.target)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '13px 20px',
                borderBottom: `1px solid ${color.borderFaint}`,
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: 'transparent',
                font: 'inherit',
                cursor: 'pointer',
              }}
            >
              <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
                <div
                  style={{
                    fontFamily: font.display,
                    fontWeight: 300,
                    fontSize: '1.5rem',
                    color: color.text4,
                    lineHeight: 1,
                  }}
                >
                  {ev.d}
                </div>
                <div
                  style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: 'oklch(56% 0.015 95)',
                  }}
                >
                  {ev.mes}
                </div>
              </div>
              <div style={{ width: 1, alignSelf: 'stretch', background: color.borderSoft }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: color.text4 }}>{ev.t}</div>
                <div style={{ marginTop: 5 }}>
                  <StatusBadge item={ev} size="xs" />
                </div>
              </div>
            </button>
          ))
        )}
      </Card>
    </div>
  );
}
