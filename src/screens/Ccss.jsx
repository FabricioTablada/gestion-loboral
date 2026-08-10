import { useRef } from 'react';

import { color, font, status } from '../theme/tokens.js';
import { ccss } from '../data/mock.js';
import { money } from '../lib/format.js';
import { Card, Badge, Button, KeyValue, ComprobanteRow } from '../components/ui/Primitives.jsx';
import { IconAdjuntar } from '../components/ui/Icons.jsx';

function tamañoLegible(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Ccss({ estado, onAdjuntar, onMarcarPagada, onVerDetalle }) {
  const fileRef = useRef(null);
  const est = estado.pagada ? status.pagado : status[ccss.estado];
  const estTexto = estado.pagada ? 'Pagada' : ccss.estadoTexto;

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    onAdjuntar({ name: file.name, size: file.size });
  }

  return (
    <div className="screen grid-2" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, maxWidth: 1240 }}>
      {/* Cuota del período */}
      <Card pad={false} style={{ alignSelf: 'start' }}>
        <div
          style={{
            padding: '20px 22px',
            borderBottom: `1px solid ${color.borderSoft}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: color.text2 }}>{ccss.titulo}</div>
            <div style={{ fontSize: '0.8rem', color: color.muted, marginTop: 2 }}>{ccss.subtitulo}</div>
          </div>
          <Badge bg={est.bg} c={est.c} dot={est.d} size="xl">
            {estTexto}
          </Badge>
        </div>

        <div style={{ padding: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: '0.88rem' }}>
            <KeyValue
              label="Cuota obrera (empleados 10,67%)"
              value={money(ccss.cuotaObrera)}
              valueColor={color.text4}
              labelColor="oklch(48% 0.015 95)"
            />
            <KeyValue
              label="Cuota patronal (26,67%)"
              value={money(ccss.cuotaPatronal)}
              valueColor={color.text4}
              labelColor="oklch(48% 0.015 95)"
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 16,
                marginTop: 6,
                paddingTop: 12,
                borderTop: `1px solid ${color.borderStrong}`,
              }}
            >
              <span style={{ fontWeight: 600, color: 'oklch(28% 0.02 95)' }}>Total a pagar</span>
              <span
                style={{
                  fontFamily: font.display,
                  fontWeight: 300,
                  fontSize: '1.5rem',
                  color: color.text2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {money(ccss.total)}
              </span>
            </div>
          </div>

          {/* Zona de comprobante */}
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFile} style={{ display: 'none' }} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              marginTop: 18,
              width: '100%',
              padding: '14px 16px',
              border: `1px dashed ${color.borderDashed}`,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: color.muted2,
              fontSize: '0.82rem',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              font: 'inherit',
            }}
          >
            <IconAdjuntar size={20} stroke="oklch(60% 0.015 95)" />
            {estado.archivo ? (
              <span>
                <strong style={{ color: color.text3 }}>{estado.archivo.name}</strong>{' '}
                <span style={{ color: color.muted4 }}>· {tamañoLegible(estado.archivo.size)}</span>
              </span>
            ) : (
              'Adjuntar comprobante de pago (PDF o imagen)'
            )}
          </button>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <Button variant="accent" size="lg" style={{ flex: 1 }} disabled={estado.pagada} onClick={onMarcarPagada}>
              {estado.pagada ? 'Cuota pagada' : 'Marcar como pagada'}
            </Button>
            <Button variant="ghost" size="lg" style={{ flex: 1 }} onClick={onVerDetalle}>
              Ver detalle de planilla
            </Button>
          </div>
        </div>
      </Card>

      {/* Historial */}
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
          Historial de cuotas
        </div>
        <div style={{ padding: '6px 8px' }}>
          {estado.pagada && (
            <ComprobanteRow periodo={ccss.titulo} detalle="Pagada — comprobante adjunto" monto={money(ccss.total)} estado={status.pagado} />
          )}
          {ccss.historial.map((h) => (
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
