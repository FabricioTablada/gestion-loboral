import { useState } from 'react';

import { color } from '../theme/tokens.js';
import { Field, Input, Select } from './ui/Form.jsx';
import { Button } from './ui/Primitives.jsx';

const VACIO = {
  nombre: '',
  puesto: '',
  cedula: '',
  tel: '',
  banco: '',
  tipo: 'Tiempo completo',
  salario: '',
  ingreso: '',
};

function validar(datos) {
  const errores = {};
  if (!datos.nombre.trim() || datos.nombre.trim().length < 3) errores.nombre = 'Ingresa el nombre completo.';
  if (!datos.puesto.trim()) errores.puesto = 'Ingresa el puesto.';
  if (!/^[\d-]{6,}$/.test(datos.cedula.trim())) errores.cedula = 'Formato de cédula inválido (ej. 1-1234-5678).';
  if (!/^\d{4}-?\d{4}$/.test(datos.tel.trim())) errores.tel = 'Formato de teléfono inválido (ej. 8712-4590).';
  if (!datos.banco.trim()) errores.banco = 'Indica cuenta o método de pago.';
  const salarioNum = Number(datos.salario);
  if (!datos.salario || Number.isNaN(salarioNum) || salarioNum <= 0) errores.salario = 'Ingresa un salario mensual válido.';
  if (!datos.ingreso.trim()) errores.ingreso = 'Ingresa la fecha de ingreso (ej. 12 mar 2021).';
  return errores;
}

/**
 * Formulario de alta/edición de empleado — usado dentro de un `Modal` desde
 * Empleados.jsx. Valida en el frontend; el guardado real (persistencia) es
 * responsabilidad del backend futuro, aquí solo se produce el objeto listo.
 */
export default function EmpleadoForm({ inicial, onSubmit, onCancel }) {
  const [datos, setDatos] = useState(() => ({
    ...VACIO,
    ...inicial,
    salario: inicial?.salario ? String(inicial.salario) : '',
  }));
  const [errores, setErrores] = useState({});

  function set(campo, valor) {
    setDatos((d) => ({ ...d, [campo]: valor }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const err = validar(datos);
    setErrores(err);
    if (Object.keys(err).length > 0) return;
    onSubmit({ ...datos, salario: Number(datos.salario) });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Nombre completo" required error={errores.nombre} htmlFor="ef-nombre">
            <Input id="ef-nombre" value={datos.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="José Ramírez Soto" />
          </Field>
        </div>

        <Field label="Puesto" required error={errores.puesto} htmlFor="ef-puesto">
          <Input id="ef-puesto" value={datos.puesto} onChange={(e) => set('puesto', e.target.value)} placeholder="Cajera" />
        </Field>

        <Field label="Jornada" htmlFor="ef-tipo">
          <Select id="ef-tipo" value={datos.tipo} onChange={(e) => set('tipo', e.target.value)}>
            <option>Tiempo completo</option>
            <option>Medio tiempo</option>
          </Select>
        </Field>

        <Field label="Cédula" required error={errores.cedula} htmlFor="ef-cedula">
          <Input id="ef-cedula" value={datos.cedula} onChange={(e) => set('cedula', e.target.value)} placeholder="1-1420-0356" />
        </Field>

        <Field label="Teléfono" required error={errores.tel} htmlFor="ef-tel">
          <Input id="ef-tel" value={datos.tel} onChange={(e) => set('tel', e.target.value)} placeholder="8712-4590" />
        </Field>

        <Field label="Salario mensual (₡)" required error={errores.salario} htmlFor="ef-salario">
          <Input
            id="ef-salario"
            type="number"
            min="0"
            step="1000"
            value={datos.salario}
            onChange={(e) => set('salario', e.target.value)}
            placeholder="450000"
          />
        </Field>

        <Field label="Fecha de ingreso" required error={errores.ingreso} htmlFor="ef-ingreso">
          <Input id="ef-ingreso" value={datos.ingreso} onChange={(e) => set('ingreso', e.target.value)} placeholder="12 mar 2021" />
        </Field>

        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Cuenta / método de pago" required error={errores.banco} htmlFor="ef-banco">
            <Input id="ef-banco" value={datos.banco} onChange={(e) => set('banco', e.target.value)} placeholder="BAC · Cuenta planilla" />
          </Field>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, paddingTop: 16, borderTop: `1px solid ${color.borderSoft}` }}>
        <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="accent" size="sm" type="submit">
          Guardar
        </Button>
      </div>
    </form>
  );
}
