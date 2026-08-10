import { useState } from 'react';

import { color } from '../theme/tokens.js';
import { Card, CardHeader, Button } from '../components/ui/Primitives.jsx';
import { Field, Input, Select } from '../components/ui/Form.jsx';

function aPorcentaje(decimal) {
  return (decimal * 100).toFixed(2).replace(/\.00$/, '');
}

function validar(f) {
  const err = {};
  if (!f.nombre.trim()) err.nombre = 'Ingresa el nombre de la empresa.';
  if (!f.actividad.trim()) err.actividad = 'Ingresa la actividad económica.';
  const ded = Number(f.deduccionEmpleado);
  if (Number.isNaN(ded) || ded < 0 || ded > 100) err.deduccionEmpleado = 'Debe ser un porcentaje entre 0 y 100.';
  const car = Number(f.cargasPatronales);
  if (Number.isNaN(car) || car < 0 || car > 100) err.cargasPatronales = 'Debe ser un porcentaje entre 0 y 100.';
  const corte = Number(f.fechaCorte);
  if (!Number.isInteger(corte) || corte < 1 || corte > 28) err.fechaCorte = 'Debe ser un día entre 1 y 28.';
  if (!f.polizaNumero.trim()) err.polizaNumero = 'Ingresa el número de póliza.';
  if (!f.polizaVigencia.trim()) err.polizaVigencia = 'Ingresa la vigencia de la póliza.';
  if (!f.polizaTasa.trim()) err.polizaTasa = 'Ingresa la tasa de la póliza.';
  return err;
}

export default function Configuracion({ config, onGuardar }) {
  const [f, setF] = useState(() => ({
    nombre: config.empresa.nombre,
    actividad: config.empresa.actividad,
    deduccionEmpleado: aPorcentaje(config.tasas.deduccionEmpleado),
    cargasPatronales: aPorcentaje(config.tasas.cargasPatronales),
    periodoTipo: config.periodoTipo,
    fechaCorte: String(config.fechaCorte),
    polizaNumero: config.poliza.numero,
    polizaVigencia: config.poliza.vigencia,
    polizaTasa: config.poliza.tasa,
  }));
  const [errores, setErrores] = useState({});
  const [guardado, setGuardado] = useState(false);

  function set(campo, valor) {
    setF((d) => ({ ...d, [campo]: valor }));
    setGuardado(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const err = validar(f);
    setErrores(err);
    if (Object.keys(err).length > 0) return;

    onGuardar({
      empresa: { nombre: f.nombre.trim(), actividad: f.actividad.trim() },
      tasas: { deduccionEmpleado: Number(f.deduccionEmpleado) / 100, cargasPatronales: Number(f.cargasPatronales) / 100 },
      periodoTipo: f.periodoTipo,
      fechaCorte: Number(f.fechaCorte),
      poliza: { numero: f.polizaNumero.trim(), vigencia: f.polizaVigencia.trim(), tasa: f.polizaTasa.trim() },
    });
    setGuardado(true);
  }

  return (
    <form className="screen" onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
      <Card pad={false}>
        <CardHeader title="Empresa" subtitle="Aparece en el menú lateral y en los documentos del sistema" />
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Nombre de la empresa" required error={errores.nombre} htmlFor="cfg-nombre">
            <Input id="cfg-nombre" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />
          </Field>
          <Field label="Actividad económica" required error={errores.actividad} htmlFor="cfg-actividad">
            <Input id="cfg-actividad" value={f.actividad} onChange={(e) => set('actividad', e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card pad={false}>
        <CardHeader title="Tasas CCSS / INS" subtitle="Se aplican de inmediato a la planilla, pagos y reportes" />
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Deducción del empleado (%)" required error={errores.deduccionEmpleado} htmlFor="cfg-ded">
            <Input id="cfg-ded" type="number" min="0" max="100" step="0.01" value={f.deduccionEmpleado} onChange={(e) => set('deduccionEmpleado', e.target.value)} />
          </Field>
          <Field label="Cargas patronales + INS (%)" required error={errores.cargasPatronales} htmlFor="cfg-car">
            <Input id="cfg-car" type="number" min="0" max="100" step="0.01" value={f.cargasPatronales} onChange={(e) => set('cargasPatronales', e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card pad={false}>
        <CardHeader title="Período de planilla" />
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Tipo de período" htmlFor="cfg-tipo">
            <Select id="cfg-tipo" value={f.periodoTipo} onChange={(e) => set('periodoTipo', e.target.value)}>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </Select>
          </Field>
          <Field label="Día de corte" help="Día del mes en que inicia el período (1–28)." required error={errores.fechaCorte} htmlFor="cfg-corte">
            <Input id="cfg-corte" type="number" min="1" max="28" value={f.fechaCorte} onChange={(e) => set('fechaCorte', e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card pad={false}>
        <CardHeader title="Póliza INS Riesgos del Trabajo" />
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Número de póliza" required error={errores.polizaNumero} htmlFor="cfg-poliza">
            <Input id="cfg-poliza" value={f.polizaNumero} onChange={(e) => set('polizaNumero', e.target.value)} />
          </Field>
          <Field label="Tasa aplicada" required error={errores.polizaTasa} htmlFor="cfg-polizaTasa">
            <Input id="cfg-polizaTasa" value={f.polizaTasa} onChange={(e) => set('polizaTasa', e.target.value)} />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Vigencia" required error={errores.polizaVigencia} htmlFor="cfg-vigencia">
              <Input id="cfg-vigencia" value={f.polizaVigencia} onChange={(e) => set('polizaVigencia', e.target.value)} placeholder="01 dic 2025 — 30 nov 2026" />
            </Field>
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="accent" type="submit">
          Guardar cambios
        </Button>
        {guardado && <span style={{ fontSize: '0.82rem', color: color.tealText, fontWeight: 600 }}>Guardado</span>}
      </div>
    </form>
  );
}
