import { useMemo, useState } from 'react';

import { Card, Table, TableHead, TableRow, TableCell, StatusBadge } from '../components/ui/Primitives.jsx';
import { Field, Input } from '../components/ui/Form.jsx';
import { color } from '../theme/tokens.js';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { IconCalendario, IconHistorial } from '../components/ui/Icons.jsx';

const COLS = '2fr 1fr 1fr 1fr auto';

function fechaDePeriodo(p) {
  return new Date(p.anio, p.mesIndice, p.mitad === 'b' ? 16 : 1);
}

export default function Historial({ historial, onVerDetalle }) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const filtrado = useMemo(() => {
    if (!desde && !hasta) return historial;
    const dDesde = desde ? new Date(desde + 'T00:00:00') : null;
    const dHasta = hasta ? new Date(hasta + 'T23:59:59') : null;
    return historial.filter((h) => {
      const f = fechaDePeriodo(h.periodo);
      if (dDesde && f < dDesde) return false;
      if (dHasta && f > dHasta) return false;
      return true;
    });
  }, [historial, desde, hasta]);

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1240 }}>
      <Card>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px', maxWidth: 220 }}>
            <Field label="Desde" htmlFor="hist-desde">
              <Input id="hist-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </Field>
          </div>
          <div style={{ flex: '1 1 180px', maxWidth: 220 }}>
            <Field label="Hasta" htmlFor="hist-hasta">
              <Input id="hist-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </Field>
          </div>
          {(desde || hasta) && (
            <button
              type="button"
              onClick={() => {
                setDesde('');
                setHasta('');
              }}
              style={{ background: 'none', border: 'none', color: color.accent, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', paddingBottom: 10 }}
            >
              Limpiar filtro
            </button>
          )}
        </div>
      </Card>

      <Card pad={false}>
        {filtrado.length === 0 ? (
          <EmptyState icon={<IconCalendario size={20} />} title="Sin períodos en este rango" description="Ajusta el rango de fechas para ver otros períodos cerrados." />
        ) : (
          <Table>
            <TableHead
              cols={COLS}
              gap={12}
              items={[
                { label: 'Período' },
                { label: 'Salario bruto', align: 'right' },
                { label: 'Neto pagado', align: 'right' },
                { label: 'Costo total', align: 'right' },
                { label: 'Estado', align: 'right', pl: 16 },
              ]}
            />

            {filtrado.map((h) => (
              <TableRow
                key={h.id}
                cols={COLS}
                padding="15px 22px"
                hoverable
                onClick={() => onVerDetalle(h.id)}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onVerDetalle(h.id);
                  }
                }}
              >
                <TableCell>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <IconHistorial size={18} stroke="oklch(60% 0.015 95)" />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: color.text4 }}>{h.p}</div>
                      <div style={{ fontSize: '0.72rem', color: color.muted4 }}>{h.empN} empleados · cerrado</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell align="right" style={{ color: 'oklch(30% 0.02 95)', fontWeight: 600 }}>
                  {h.brutoFmt}
                </TableCell>
                <TableCell align="right" style={{ color: 'oklch(30% 0.02 95)', fontWeight: 600 }}>
                  {h.netoFmt}
                </TableCell>
                <TableCell align="right" style={{ color: color.costo, fontWeight: 700 }}>
                  {h.costoFmt}
                </TableCell>
                <TableCell align="right" style={{ paddingLeft: 16 }}>
                  <StatusBadge item={h} />
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
