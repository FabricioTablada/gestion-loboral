import { useMemo, useState } from 'react';

import { color, font } from '../theme/tokens.js';
import { Card, Table, TableHead, TableRow, TableCell, Badge, Button, EmpleadoCell } from '../components/ui/Primitives.jsx';
import { Checkbox, Field, Input, Select } from '../components/ui/Form.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { IconPagos } from '../components/ui/Icons.jsx';

const COLS = 'auto 2fr 1fr 1fr 1fr auto';
const METODOS = ['Transferencia', 'Efectivo', 'Cheque', 'SINPE Móvil'];

/** Modal de confirmación de pago (individual o en lote): método + fecha. */
function PagoModal({ cantidad, onClose, onConfirmar }) {
  const [metodo, setMetodo] = useState(METODOS[0]);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <Modal open={!!cantidad} onClose={onClose} title={cantidad === 1 ? 'Marcar como pagado' : `Marcar ${cantidad || 0} pagos`} width={380}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Método de pago" htmlFor="pg-metodo">
          <Select id="pg-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {METODOS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha de pago" htmlFor="pg-fecha">
          <Input id="pg-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              const fechaFmt = new Date(fecha + 'T00:00:00').toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
              onConfirmar({ metodo, fecha: fechaFmt });
            }}
          >
            Confirmar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function Pagos({ emps, totales, onMarcarPagado, onMarcarPagadoLote }) {
  const [filtro, setFiltro] = useState('todos'); // todos | pagados | pendientes
  const [seleccionados, setSeleccionados] = useState([]);
  const [pagando, setPagando] = useState(null); // { ids: [...] } | null

  const filtrados = useMemo(() => {
    if (filtro === 'pagados') return emps.filter((e) => e.pago === 'pagado');
    if (filtro === 'pendientes') return emps.filter((e) => e.pago !== 'pagado');
    return emps;
  }, [emps, filtro]);

  const pendientesSeleccionables = filtrados.filter((e) => e.pago !== 'pagado');
  const todosSeleccionados = pendientesSeleccionables.length > 0 && pendientesSeleccionables.every((e) => seleccionados.includes(e.id));

  function alternarSeleccion(id) {
    setSeleccionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function alternarTodos() {
    setSeleccionados(todosSeleccionados ? [] : pendientesSeleccionables.map((e) => e.id));
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1240 }}>
      {/* Progreso */}
      <Card>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.74rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: color.label,
                fontWeight: 600,
              }}
            >
              Progreso de pagos · quincena
            </div>
            <div
              style={{
                fontFamily: font.display,
                fontWeight: 300,
                fontSize: '1.7rem',
                color: color.text2,
                marginTop: 4,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {totales.pagadoFmt}{' '}
              <span style={{ fontSize: '1rem', color: 'oklch(55% 0.015 95)' }}>de {totales.sumNetoFmt}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.82rem', color: 'oklch(48% 0.015 95)' }}>
            Pendiente <span style={{ fontWeight: 700, color: color.text4 }}>{totales.pendFmt}</span> ·{' '}
            {totales.pendCount} empleados
          </div>
        </div>

        <div
          role="progressbar"
          aria-valuenow={parseInt(totales.pagoPct, 10)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso de pagos de la quincena"
          style={{ height: 10, borderRadius: 999, background: color.trackSoft, overflow: 'hidden' }}
        >
          <div
            className="bar-grow"
            style={{ height: '100%', width: totales.pagoPct, background: color.teal, borderRadius: 999 }}
          />
        </div>
      </Card>

      {/* Detalle por empleado */}
      <Card pad={false}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 20px',
            borderBottom: `1px solid ${color.borderSoft}`,
            flexWrap: 'wrap',
          }}
        >
          <Select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por estado" style={{ width: 160 }}>
            <option value="todos">Todos</option>
            <option value="pendientes">Pendientes</option>
            <option value="pagados">Pagados</option>
          </Select>
          {seleccionados.length > 0 && (
            <Button variant="accent" size="sm" onClick={() => setPagando({ ids: seleccionados })}>
              Marcar {seleccionados.length} como pagados
            </Button>
          )}
        </div>

        {filtrados.length === 0 ? (
          <EmptyState icon={<IconPagos size={20} />} title="Sin resultados" description="Ningún empleado coincide con este filtro." />
        ) : (
          <Table>
            <TableHead
              cols={COLS}
              gap={12}
              items={[
                { label: '' },
                { label: 'Empleado' },
                { label: 'Neto', align: 'right' },
                { label: 'Método', align: 'center' },
                { label: 'Fecha pago', align: 'center' },
                { label: 'Estado', align: 'right' },
              ]}
            />

            {filtrados.map((e) => (
              <TableRow key={e.id} cols={COLS} hoverable>
                <TableCell>
                  {e.pago !== 'pagado' && (
                    <Checkbox
                      aria-label={`Seleccionar ${e.nombre}`}
                      checked={seleccionados.includes(e.id)}
                      onChange={() => alternarSeleccion(e.id)}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <EmpleadoCell emp={e} avatarSize={34} nameSize="0.85rem" />
                </TableCell>
                <TableCell align="right" style={{ fontWeight: 700, color: color.text3 }}>
                  {e.netoFmt}
                </TableCell>
                <TableCell align="center" style={{ color: color.muted3 }}>
                  {e.metodo}
                </TableCell>
                <TableCell align="center" style={{ color: color.muted3 }}>
                  {e.fechaPago}
                </TableCell>
                <TableCell align="right">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                    <Badge bg={e.pgBg} c={e.pgC} dot={e.pgD} size="md">
                      {e.pgL}
                    </Badge>
                    {e.pago !== 'pagado' && (
                      <Button variant="ghost" size="sm" onClick={() => setPagando({ ids: [e.id] })}>
                        Marcar pagado
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </Card>

      <PagoModal
        cantidad={pagando?.ids.length}
        onClose={() => setPagando(null)}
        onConfirmar={(datos) => {
          if (pagando.ids.length === 1) onMarcarPagado(pagando.ids[0], datos);
          else onMarcarPagadoLote(pagando.ids, datos);
          setSeleccionados((s) => s.filter((id) => !pagando.ids.includes(id)));
          setPagando(null);
        }}
      />
    </div>
  );
}
