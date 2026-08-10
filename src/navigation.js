/**
 * Mapa de pantallas: agrupación del menú, títulos de cabecera e íconos.
 * Añadir una pantalla es añadir una entrada aquí y su componente en `screens/`.
 */

import {
  IconPanel,
  IconEmpleados,
  IconPlanilla,
  IconPagos,
  IconCcss,
  IconIns,
  IconCalendario,
  IconReportes,
  IconHistorial,
  IconConfig,
} from './components/ui/Icons.jsx';

export const screens = {
  panel: { label: 'Panel', title: 'Panel', sub: 'Resumen laboral de la carnicería', icon: IconPanel },
  empleados: {
    label: 'Empleados',
    title: 'Empleados',
    sub: 'Información personal y laboral del equipo',
    icon: IconEmpleados,
  },
  planilla: { label: 'Planilla', title: 'Planilla', sub: 'Quincena 01–15 de agosto 2026', icon: IconPlanilla },
  pagos: { label: 'Pagos', title: 'Pagos', sub: 'Control de salarios pendientes y realizados', icon: IconPagos },
  ccss: { label: 'CCSS', title: 'CCSS', sub: 'Seguro social — cuotas y comprobantes', icon: IconCcss },
  ins: {
    label: 'INS / Riesgos',
    title: 'INS / Riesgos del Trabajo',
    sub: 'Póliza, reportes y vencimientos',
    icon: IconIns,
  },
  calendario: {
    label: 'Calendario',
    title: 'Calendario de obligaciones',
    sub: 'Fechas importantes del mes',
    icon: IconCalendario,
  },
  reportes: {
    label: 'Reportes',
    title: 'Reportes',
    sub: 'Costos laborales, planillas y obligaciones',
    icon: IconReportes,
  },
  historial: {
    label: 'Historial',
    title: 'Historial de períodos',
    sub: 'Planillas cerradas anteriores',
    icon: IconHistorial,
  },
  configuracion: {
    label: 'Configuración',
    title: 'Configuración',
    sub: 'Empresa, tasas, período y póliza INS',
    icon: IconConfig,
  },
};

/** Secciones del menú lateral, en orden. */
export const navGroups = [
  { label: 'PRINCIPAL', items: ['panel', 'empleados', 'planilla', 'pagos'] },
  { label: 'OBLIGACIONES', items: ['ccss', 'ins', 'calendario'] },
  { label: 'ANÁLISIS', items: ['reportes', 'historial'] },
  { label: 'SISTEMA', items: ['configuracion'] },
];

export const defaultScreen = 'panel';
