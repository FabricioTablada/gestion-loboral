import { useMemo, useState } from 'react';

import { color, status } from '../theme/tokens.js';
import { Card, TableHead, Avatar, Badge, Button, MonoLabel, KeyValue } from '../components/ui/Primitives.jsx';
import { Input, Select } from '../components/ui/Form.jsx';
import { Modal, ConfirmDialog } from '../components/ui/Modal.jsx';
import { Drawer } from '../components/ui/Drawer.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { IconSearch, IconEmpleados } from '../components/ui/Icons.jsx';
import EmpleadoForm from '../components/EmpleadoForm.jsx';

const COLS = '2fr 1fr 1fr auto';

export default function Empleados({ emps, selEmp, onSelect, onCrear, onEditar, onAlternarActivo, getHistorial }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos'); // todos | activos | inactivos
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [drawerHistorial, setDrawerHistorial] = useState(false);
  const [confirmBaja, setConfirmBaja] = useState(false);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return emps.filter((e) => {
      if (filtro === 'activos' && !e.activo) return false;
      if (filtro === 'inactivos' && e.activo) return false;
      if (!q) return true;
      return e.nombre.toLowerCase().includes(q) || e.puesto.toLowerCase().includes(q) || e.cedula.includes(q);
    });
  }, [emps, busqueda, filtro]);

  const historial = drawerHistorial ? getHistorial(selEmp.id) : [];

  return (
    <div
      className="screen grid-2"
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(340px,1fr)', gap: 20, maxWidth: 1240 }}
    >
      {/* Listado */}
      <Card pad={false} style={{ alignSelf: 'start' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: `1px solid ${color.borderSoft}`,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
            <IconSearch
              size={15}
              stroke="oklch(55% 0.015 95)"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
            />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, puesto o cédula…"
              aria-label="Buscar empleado"
              style={{ paddingLeft: 32 }}
            />
          </div>
          <Select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            aria-label="Filtrar por estado"
            style={{ width: 140, flexShrink: 0 }}
          >
            <option value="todos">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </Select>
          <Button
            variant="accent"
            size="sm"
            onClick={() => setModalNuevo(true)}
            style={{ flexShrink: 0 }}
          >
            Nuevo
          </Button>
        </div>

        {filtrados.length === 0 ? (
          <EmptyState
            icon={<IconEmpleados size={20} />}
            title="Sin resultados"
            description="Ningún empleado coincide con la búsqueda o el filtro actual."
          />
        ) : (
          <div className="table-scroll">
            <TableHead
              cols={COLS}
              gap={12}
              padding="12px 20px"
              fontSize="0.7rem"
              letterSpacing="0.1em"
              items={[
                { label: 'Empleado' },
                { label: 'Ingreso' },
                { label: 'Salario / mes', align: 'right' },
                { label: 'Estado', align: 'right', pl: 16 },
              ]}
            />

            {filtrados.map((e) => (
              <button
                key={e.id}
                type="button"
                className="row row--clickable"
                data-selected={e.id === selEmp.id}
                aria-pressed={e.id === selEmp.id}
                onClick={() => onSelect(e.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: COLS,
                  gap: 12,
                  alignItems: 'center',
                  padding: '14px 20px',
                  position: 'relative',
                  width: '100%',
                  textAlign: 'left',
                  font: 'inherit',
                  border: 'none',
                  borderBottom: `1px solid ${color.borderFaint}`,
                  opacity: e.activo ? 1 : 0.55,
                }}
              >
                <span className="row__bar" />

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <Avatar ini={e.ini} bg={e.avBg} c={e.avC} size={38} fontSize="0.8rem" />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        color: color.text3,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {e.nombre}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: color.muted }}>{e.puesto}</div>
                  </div>
                </div>

                <span style={{ fontSize: '0.82rem', color: 'oklch(40% 0.015 95)' }}>{e.ingreso}</span>

                <span
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    color: color.text3,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {e.salarioFmt}
                </span>

                <span style={{ textAlign: 'right', paddingLeft: 16 }}>
                  {e.activo ? (
                    <Badge bg={status.aldia.bg} c={status.aldia.c} dot={status.aldia.d} size="sm">
                      Activo
                    </Badge>
                  ) : (
                    <Badge bg={status.pendiente.bg} c={status.pendiente.c} dot={status.pendiente.d} size="sm">
                      Inactivo
                    </Badge>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Ficha del empleado seleccionado */}
      <Card pad={false} style={{ alignSelf: 'start' }}>
        <div style={{ padding: 22, background: color.ink, display: 'flex', alignItems: 'center', gap: 15 }}>
          <Avatar ini={selEmp.ini} bg={selEmp.avBg} c={selEmp.avC} size={56} fontSize="1.2rem" />
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: color.onInkText2 }}>{selEmp.nombre}</div>
            <div style={{ fontSize: '0.82rem', color: color.onInkMuted, marginTop: 2 }}>{selEmp.puesto}</div>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          <MonoLabel style={{ marginBottom: 12 }}>INFORMACIÓN PERSONAL</MonoLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '0.84rem' }}>
            <KeyValue label="Cédula" value={selEmp.cedula} mono={false} />
            <KeyValue label="Teléfono" value={selEmp.tel} mono={false} />
            <KeyValue label="Cuenta / pago" value={selEmp.banco} mono={false} />
          </div>

          <MonoLabel style={{ margin: '20px 0 12px' }}>INFORMACIÓN LABORAL</MonoLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '0.84rem' }}>
            <KeyValue label="Puesto" value={selEmp.puesto} mono={false} />
            <KeyValue label="Fecha de ingreso" value={selEmp.ingreso} mono={false} />
            <KeyValue label="Jornada" value={selEmp.tipo} mono={false} />
            <KeyValue label="Estado" value={selEmp.activo ? 'Activo' : 'Inactivo'} mono={false} />
          </div>

          <MonoLabel style={{ margin: '20px 0 12px' }}>DESGLOSE SALARIAL · MENSUAL</MonoLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '0.84rem' }}>
            <KeyValue label="Salario bruto" value={selEmp.mBruto} />
            <KeyValue label="Deducción CCSS" value={`− ${selEmp.mDed}`} valueColor={color.tealText} />
            <KeyValue label="Salario neto" value={selEmp.mNeto} valueColor={color.text3} bold={700} />
            <KeyValue label="Cargas patronales + INS" value={`+ ${selEmp.mCar}`} />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                marginTop: 6,
                paddingTop: 11,
                borderTop: `1px solid ${color.borderStrong}`,
              }}
            >
              <span style={{ fontWeight: 600, color: 'oklch(30% 0.02 95)' }}>Costo total del trabajador</span>
              <span style={{ fontWeight: 700, color: color.costo, fontVariantNumeric: 'tabular-nums' }}>
                {selEmp.mCosto}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <Button variant="accent" style={{ flex: 1 }} onClick={() => setModalEditar(true)}>
              Editar
            </Button>
            <Button variant="ghost" style={{ flex: 1 }} onClick={() => setDrawerHistorial(true)}>
              Ver historial
            </Button>
          </div>
          <Button
            variant={selEmp.activo ? 'danger' : 'soft'}
            style={{ width: '100%', marginTop: 10 }}
            onClick={() => setConfirmBaja(true)}
          >
            {selEmp.activo ? 'Dar de baja' : 'Reactivar empleado'}
          </Button>
        </div>
      </Card>

      {/* Nuevo empleado */}
      <Modal open={modalNuevo} onClose={() => setModalNuevo(false)} title="Nuevo empleado" width={560}>
        <EmpleadoForm
          onCancel={() => setModalNuevo(false)}
          onSubmit={(datos) => {
            onCrear(datos);
            setModalNuevo(false);
          }}
        />
      </Modal>

      {/* Editar empleado */}
      <Modal open={modalEditar} onClose={() => setModalEditar(false)} title={`Editar · ${selEmp.nombre}`} width={560}>
        <EmpleadoForm
          inicial={selEmp}
          onCancel={() => setModalEditar(false)}
          onSubmit={(datos) => {
            onEditar(selEmp.id, datos);
            setModalEditar(false);
          }}
        />
      </Modal>

      {/* Dar de baja / reactivar */}
      <ConfirmDialog
        open={confirmBaja}
        onClose={() => setConfirmBaja(false)}
        onConfirm={() => {
          onAlternarActivo(selEmp.id);
          setConfirmBaja(false);
        }}
        title={selEmp.activo ? 'Dar de baja a este empleado' : 'Reactivar empleado'}
        description={
          selEmp.activo
            ? `${selEmp.nombre} dejará de aparecer en la planilla y en pagos activos. Su historial se conserva y puede reactivarlo cuando quiera.`
            : `${selEmp.nombre} volverá a aparecer en la planilla y en pagos a partir del próximo período.`
        }
        confirmLabel={selEmp.activo ? 'Dar de baja' : 'Reactivar'}
        danger={selEmp.activo}
      />

      {/* Historial de pagos del empleado */}
      <Drawer open={drawerHistorial} onClose={() => setDrawerHistorial(false)} side="right" width={380} title={`Historial · ${selEmp.nombre}`}>
        <div style={{ padding: '6px 8px' }}>
          {historial.length === 0 ? (
            <EmptyState title="Sin períodos cerrados" description="Este empleado todavía no tiene historial de pagos." />
          ) : (
            historial.map((h) => (
              <div
                key={h.periodo.id}
                className="list-row"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 14px', borderRadius: 7 }}
              >
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: color.text4 }}>{h.periodo.titulo}</div>
                  <div style={{ fontSize: '0.74rem', color: color.muted4 }}>Bruto {h.brutoFmt}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: color.text4, fontVariantNumeric: 'tabular-nums' }}>
                    {h.netoFmt}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: color.muted, marginTop: 2 }}>Neto pagado</div>
                </div>
              </div>
            ))
          )}
        </div>
      </Drawer>
    </div>
  );
}
