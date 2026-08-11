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
  // Dos campos que la ficha del empleado ya mostraba en pantalla ("Nacimiento",
  // "Contacto de emergencia") como "No registrado en el sistema", sin ningún
  // formulario donde llenarlos. Son opcionales: vacíos siguen mostrando ese
  // mismo texto honesto.
  nacimiento: '',
  emergencia: '',
};

// Mismo formato que ya parsean el resto de las pantallas ("12 mar 2021") —
// nunca texto libre. Antes solo se exigía que no estuviera vacío, así que
// un valor como "no-es-una-fecha" se guardaba tal cual y desaparecía en
// silencio de cualquier cálculo que sí supiera leer una fecha real
// (antigüedad, aniversarios…) sin que la persona siguiera existiendo en el
// resto de la app (auditoría F7).
const INGRESO_RE = /^\d{1,2}\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s+\d{4}$/i;

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
  else if (!INGRESO_RE.test(datos.ingreso.trim())) errores.ingreso = 'Formato de fecha inválido — usa día, mes abreviado y año (ej. 12 mar 2021).';
  // Opcional, pero si se llena tiene que ser una fecha que el resto de la app
  // sepa leer — el mismo formato que `ingreso`.
  if (datos.nacimiento.trim() && !INGRESO_RE.test(datos.nacimiento.trim())) {
    errores.nacimiento = 'Formato de fecha inválido — usa día, mes abreviado y año (ej. 04 jul 1992).';
  }
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
    onSubmit({
      ...datos,
      salario: Number(datos.salario),
      nacimiento: datos.nacimiento.trim(),
      emergencia: datos.emergencia.trim(),
    });
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

        <Field label="Fecha de nacimiento" help="Opcional." error={errores.nacimiento} htmlFor="ef-nacimiento">
          <Input id="ef-nacimiento" value={datos.nacimiento} onChange={(e) => set('nacimiento', e.target.value)} placeholder="04 jul 1992" />
        </Field>

        <Field label="Contacto de emergencia" help="Opcional." htmlFor="ef-emergencia">
          <Input id="ef-emergencia" value={datos.emergencia} onChange={(e) => set('emergencia', e.target.value)} placeholder="María Soto · 8712-4590" />
        </Field>
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
