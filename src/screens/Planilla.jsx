import { useState } from 'react';

import { color } from '../theme/tokens.js';
import { Card, Table, TableHead, TableRow, TableCell, Button, Badge, MiniStat, EmpleadoCell } from '../components/ui/Primitives.jsx';
import { Modal, ConfirmDialog } from '../components/ui/Modal.jsx';
import { Field, Input } from '../components/ui/Form.jsx';
import { Tooltip } from '../components/ui/Tooltip.jsx';

const COLS = '1.4fr 1fr 1fr 1fr 1fr 1fr auto';

function descargarCsv(vista) {
  const filas = [
    ['Empleado', 'Puesto', 'Salario bruto', 'Deducción CCSS', 'Salario neto', 'Cargas patronales', 'Costo total'],
    ...vista.emps.map((e) => [e.nombre, e.puesto, e.brutoQ.toFixed(0), (e.brutoQ - e.neto).toFixed(0), e.neto.toFixed(0), (e.costoQ - e.brutoQ).toFixed(0), e.costoQ.toFixed(0)]),
    ['Totales', '', vista.totales.sumBruto.toFixed(0), vista.totales.totDed.toFixed(0), vista.totales.sumNeto.toFixed(0), vista.totales.totCar.toFixed(0), vista.totales.totCosto.toFixed(0)],
  ];
  const csv = filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planilla-${vista.periodo.id}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Modal de ajuste puntual (horas extra, bono, deducción) sobre una línea de planilla. */
function AjusteModal({ emp, onClose, onGuardar }) {
  const [horasExtra, setHorasExtra] = useState(String(emp?.horasExtra || ''));
  const [bono, setBono] = useState(String(emp?.bono || ''));
  const [deduccion, setDeduccion] = useState(String(emp?.deduccionPuntual || ''));

  return (
    <Modal open={!!emp} onClose={onClose} title={emp ? `Ajustar · ${emp.nombre}` : ''} width={420}>
      {emp && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Horas extra" help="Se pagan a 1.5× el valor de la hora ordinaria." htmlFor="aj-horas">
            <Input id="aj-horas" type="number" min="0" step="0.5" value={horasExtra} onChange={(e) => setHorasExtra(e.target.value)} />
          </Field>
          <Field label="Bono puntual (₡)" htmlFor="aj-bono">
            <Input id="aj-bono" type="number" min="0" step="1000" value={bono} onChange={(e) => setBono(e.target.value)} />
          </Field>
          <Field label="Deducción puntual (₡)" help="Adelantos, préstamos u otro descuento de esta quincena." htmlFor="aj-deduccion">
            <Input id="aj-deduccion" type="number" min="0" step="1000" value={deduccion} onChange={(e) => setDeduccion(e.target.value)} />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => {
                onGuardar(emp.id, {
                  horasExtra: Number(horasExtra) || 0,
                  bono: Number(bono) || 0,
                  deduccion: Number(deduccion) || 0,
                });
                onClose();
              }}
            >
              Aplicar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Planilla({ vista, periodoTipo, onAjustar, onCerrarPeriodo, onVolverActivo }) {
  const [ajustando, setAjustando] = useState(null); // empleado siendo ajustado
  const [confirmCerrar, setConfirmCerrar] = useState(false);
  const { emps, totales, periodo, readOnly } = vista;

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1240 }}>
      {/* Barra de período */}
      <Card
        pad="16px 20px"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {readOnly ? (
            <Badge bg={color.tableFoot} c="oklch(40% 0.015 95)" size="xl">
              Período cerrado · solo lectura
            </Badge>
          ) : (
            <Badge bg="oklch(95% 0.065 88)" c={color.amberText} dot={color.amberDot} size="xl">
              Período abierto
            </Badge>
          )}
          <span style={{ fontSize: '0.86rem', color: 'oklch(40% 0.015 95)' }}>
            {periodo.titulo} · {emps.length} empleados
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {readOnly ? (
            <Button variant="ghost" size="sm" onClick={onVolverActivo}>
              Volver al período activo
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => descargarCsv(vista)}>
                Exportar CSV
              </Button>
              <Button variant="accent" size="sm" onClick={() => setConfirmCerrar(true)}>
                Cerrar período
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Tabla de planilla */}
      <Card pad={false}>
        <Table>
          <TableHead
            cols={COLS}
            items={[
              { label: 'Empleado' },
              { label: 'Salario bruto', align: 'right' },
              { label: 'Ded. CCSS', align: 'right' },
              { label: 'Salario neto', align: 'right' },
              { label: 'Cargas patr.', align: 'right' },
              { label: 'Costo total', align: 'right' },
              { label: '', align: 'right' },
            ]}
          />

          {emps.map((e) => (
            <TableRow key={e.id} cols={COLS} gap={8}>
              <TableCell>
                <EmpleadoCell emp={e} />
              </TableCell>
              <TableCell align="right" style={{ color: 'oklch(28% 0.02 95)', fontWeight: 600 }}>
                {e.brutoFmt}
                {e.tieneAjuste && (
                  <span style={{ marginLeft: 5, fontSize: '0.66rem', color: color.amberText, fontWeight: 700 }} title="Incluye ajuste puntual">
                    •
                  </span>
                )}
              </TableCell>
              <TableCell align="right" style={{ color: color.tealText }}>
                − {e.dedFmt}
              </TableCell>
              <TableCell align="right" style={{ color: color.text4, fontWeight: 700 }}>
                {e.netoFmt}
              </TableCell>
              <TableCell align="right" style={{ color: color.muted3 }}>
                + {e.carFmt}
              </TableCell>
              <TableCell align="right" style={{ color: color.costo, fontWeight: 700 }}>
                {e.costoFmt}
              </TableCell>
              <TableCell align="right">
                {!readOnly && (
                  <Tooltip label="Horas extra, bono o deducción" side="bottom">
                    <Button variant="ghost" size="sm" onClick={() => setAjustando(e)}>
                      Ajustar
                    </Button>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          ))}

          {/* Totales */}
          <TableRow cols={COLS} gap={8} foot fontSize="0.88rem" padding="16px 22px">
            <TableCell>Totales · {emps.length} empleados</TableCell>
            <TableCell align="right">{totales.sumBrutoFmt}</TableCell>
            <TableCell align="right" style={{ color: color.tealText }}>
              − {totales.totDedFmt}
            </TableCell>
            <TableCell align="right">{totales.sumNetoFmt}</TableCell>
            <TableCell align="right" style={{ color: color.muted3 }}>
              + {totales.totCarFmt}
            </TableCell>
            <TableCell align="right" style={{ color: color.costo }}>
              {totales.totCostoFmt}
            </TableCell>
            <TableCell align="right" />
          </TableRow>
        </Table>
      </Card>

      {/* Resumen */}
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <MiniStat label="Salario bruto total" value={totales.sumBrutoFmt} />
        <MiniStat label="Neto a pagar" value={totales.sumNetoFmt} />
        <MiniStat label="Costo total planilla" value={totales.totCostoFmt} dark />
      </div>

      {!readOnly && <AjusteModal emp={ajustando} onClose={() => setAjustando(null)} onGuardar={onAjustar} />}

      {!readOnly && (
        <ConfirmDialog
          open={confirmCerrar}
          onClose={() => setConfirmCerrar(false)}
          onConfirm={() => {
            onCerrarPeriodo();
            setConfirmCerrar(false);
          }}
          title="Cerrar este período"
          description={`Se cerrará "${periodo.titulo}" y pasará al historial como solo lectura. Se abrirá automáticamente el siguiente período ${periodoTipo === 'mensual' ? 'mensual' : 'quincenal'}. Esta acción no se puede deshacer.`}
          confirmLabel="Cerrar período"
          danger
        />
      )}
    </div>
  );
}
