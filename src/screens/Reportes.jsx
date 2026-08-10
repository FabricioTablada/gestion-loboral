import { color } from '../theme/tokens.js';
import { Card, Avatar, Button } from '../components/ui/Primitives.jsx';

const RANGOS = [3, 6, 12];

export default function Reportes({ barras, distribucion, distTotalFmt, costoPorEmpleado, rango, onRangoChange, onEmpleadoClick }) {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1240 }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
        {/* Costo laboral por mes */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: color.text2 }}>Costo laboral · últimos {rango} meses</div>
              <div style={{ fontSize: '0.78rem', color: color.muted, marginTop: 2 }}>
                Costo total mensual (bruto + cargas)
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {RANGOS.map((r) => (
                <Button key={r} variant={rango === r ? 'accent' : 'ghost'} size="sm" onClick={() => onRangoChange(r)}>
                  {r}m
                </Button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: rango > 6 ? 6 : 14,
              height: 180,
              marginTop: 22,
              overflowX: rango > 6 ? 'auto' : 'visible',
            }}
          >
            {barras.map((b) => (
              <div
                key={b.m}
                style={{
                  flex: 1,
                  minWidth: rango > 6 ? 28 : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  height: '100%',
                  justifyContent: 'flex-end',
                }}
              >
                <div
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 600,
                    color: 'oklch(48% 0.015 95)',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {b.vFmt}
                </div>
                <div
                  className="bar-grow"
                  style={{ width: '100%', borderRadius: '6px 6px 0 0', background: b.barBg, height: b.hStr }}
                />
                <div style={{ fontSize: '0.74rem', fontWeight: 600, color: color.muted3 }}>{b.m}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Distribución */}
        <Card>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: color.text2 }}>Distribución del costo</div>
          <div style={{ fontSize: '0.78rem', color: color.muted, marginTop: 2 }}>
            Quincena actual · total {distTotalFmt}
          </div>

          <div style={{ display: 'flex', height: 16, borderRadius: 6, overflow: 'hidden', marginTop: 20 }}>
            {distribucion.map((d) => (
              <div key={d.l} className="bar-grow" style={{ height: '100%', background: d.c, width: d.w }} />
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
            {distribucion.map((d) => (
              <div key={d.l} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.84rem' }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: d.c, flexShrink: 0 }} />
                <span style={{ flex: 1, color: color.muted3 }}>{d.l}</span>
                <span style={{ fontWeight: 700, color: color.text4, fontVariantNumeric: 'tabular-nums' }}>
                  {d.vFmt}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Costo por empleado */}
      <Card>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: color.text2, marginBottom: 18 }}>
          Costo por empleado · quincena
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {costoPorEmpleado.map((r) => (
            <button
              key={r.id}
              type="button"
              className="list-row"
              onClick={() => onEmpleadoClick(r.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                width: '100%',
                border: 'none',
                background: 'transparent',
                font: 'inherit',
                cursor: 'pointer',
                padding: '6px 8px',
                borderRadius: 7,
                textAlign: 'left',
              }}
            >
              <div style={{ width: 190, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <Avatar ini={r.ini} bg={r.avBg} c={r.avC} size={30} fontSize="0.7rem" />
                <span
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'oklch(26% 0.02 95)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {r.nombre}
                </span>
              </div>

              <div style={{ flex: 1, height: 22, background: color.track, borderRadius: 5, overflow: 'hidden' }}>
                <div
                  className="bar-grow"
                  style={{ height: '100%', background: color.accentSoft, borderRadius: 5, width: r.w }}
                />
              </div>

              <span
                style={{
                  width: 110,
                  textAlign: 'right',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: color.text4,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {r.costoFmt}
              </span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
