import { useRef } from 'react';

import { color, font, status } from '../theme/tokens.js';
import { ins } from '../data/mock.js';
import { money } from '../lib/format.js';
import { Card, Badge, Button, ComprobanteRow, Dot } from '../components/ui/Primitives.jsx';

/** Fila clave/valor sobre el bloque oscuro de la póliza. */
function InkRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ color: color.onInkMuted2 }}>{label}</span>
      <span style={{ fontWeight: 600, color: color.onInkText3 }}>{value}</span>
    </div>
  );
}

function tamañoLegible(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Ins({ estado, poliza, actividad, cubiertos, onAdjuntar, onRegularizar }) {
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    onAdjuntar({ name: file.name, size: file.size });
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1240 }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Póliza */}
        <div style={{ background: color.ink, borderRadius: 8, padding: 22, color: 'oklch(88% 0 0)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontFamily: font.mono,
                fontSize: '0.62rem',
                letterSpacing: '0.18em',
                color: color.onInkMuted,
              }}
            >
              PÓLIZA RIESGOS DEL TRABAJO
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 11px',
                borderRadius: 999,
                fontSize: '0.7rem',
                fontWeight: 700,
                background: 'oklch(30% 0.05 188)',
                color: 'oklch(82% 0.09 188)',
                whiteSpace: 'nowrap',
              }}
            >
              <Dot c={color.teal} size={5} />
              Al día
            </span>
          </div>

          <div
            style={{
              fontFamily: font.display,
              fontWeight: 300,
              fontSize: '2rem',
              color: color.onInkText,
              letterSpacing: '0.02em',
            }}
          >
            {poliza.numero}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18, fontSize: '0.84rem' }}>
            <InkRow label="Actividad" value={actividad} />
            <InkRow label="Tasa aplicada" value={poliza.tasa} />
            <InkRow label="Vigencia" value={poliza.vigencia} />
            <InkRow label="Trabajadores cubiertos" value={String(cubiertos)} />
          </div>
        </div>

        {/* Reporte pendiente */}
        <Card pad={22} style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: '1rem', fontWeight: 600, color: color.text2 }}>{ins.reporte.titulo}</div>
            {estado.alDia ? (
              <Badge bg={status.aldia.bg} c={status.aldia.c} dot={status.aldia.d} size="xl">
                Al día
              </Badge>
            ) : (
              <Badge bg={status.vencido.bg} c={status.vencido.c} dot={status.vencido.d} size="xl">
                Vencido
              </Badge>
            )}
          </div>

          {estado.alDia ? (
            <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6, color: color.muted3 }}>
              El reporte de salarios fue regularizado. La póliza se mantiene vigente sin recargos pendientes.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6, color: color.muted3 }}>
              El reporte mensual de salarios ante el INS venció el{' '}
              <strong style={{ color: 'oklch(30% 0.02 95)' }}>{ins.reporte.venceTexto}</strong>. Regúlalo para mantener
              la póliza vigente y evitar recargos.
            </p>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              marginTop: 16,
              padding: '14px 16px',
              background: color.tableFoot,
              borderRadius: 8,
              fontSize: '0.86rem',
            }}
          >
            <span style={{ color: 'oklch(48% 0.015 95)' }}>Monto estimado ({poliza.tasa})</span>
            <span style={{ fontWeight: 700, color: color.text4, fontVariantNumeric: 'tabular-nums' }}>
              {money(ins.reporte.montoEstimado)}
            </span>
          </div>

          {!estado.alDia && (
            <>
              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFile} style={{ display: 'none' }} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  marginTop: 14,
                  width: '100%',
                  padding: '12px 14px',
                  border: `1px dashed ${color.borderDashed}`,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: color.muted2,
                  fontSize: '0.8rem',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                }}
              >
                {estado.archivo ? (
                  <span>
                    <strong style={{ color: color.text3 }}>{estado.archivo.name}</strong>{' '}
                    <span style={{ color: color.muted4 }}>· {tamañoLegible(estado.archivo.size)}</span>
                  </span>
                ) : (
                  'Adjuntar comprobante del reporte (PDF o imagen)'
                )}
              </button>

              <Button variant="danger" size="lg" style={{ marginTop: 12, width: '100%' }} onClick={onRegularizar}>
                Regularizar reporte
              </Button>
            </>
          )}
        </Card>
      </div>

      {/* Reportes anteriores */}
      <Card pad={false}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${color.borderSoft}`,
            fontSize: '0.98rem',
            fontWeight: 600,
            color: color.text2,
          }}
        >
          Reportes anteriores
        </div>
        <div style={{ padding: '6px 8px' }}>
          {estado.alDia && (
            <ComprobanteRow periodo={ins.reporte.titulo} detalle="Regularizado — comprobante adjunto" monto={money(ins.reporte.montoEstimado)} estado={status.pagado} />
          )}
          {ins.historial.map((h) => (
            <ComprobanteRow
              key={h.periodo}
              periodo={h.periodo}
              detalle={h.detalle}
              monto={money(h.monto)}
              estado={status.pagado}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
