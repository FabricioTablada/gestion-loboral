/**
 * Mapa de pantallas: agrupación del menú, títulos de cabecera e íconos.
 * Añadir una pantalla es añadir una entrada aquí y su componente en `screens/`.
 */

import {
  IconPanel,
  IconEmpleados,
  IconPlanilla,
  IconPagos,
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
  // `sub` es un texto genérico de respaldo (hoy Planilla usa su propio
  // masthead editorial con el período real, así que este no se muestra en
  // pantalla) — antes tenía una fecha fija ("Quincena 01–15 de agosto
  // 2026") que quedaría desactualizada apenas avanzara el período real.
  planilla: { label: 'Planilla', title: 'Planilla', sub: 'Quincena o mes activo de la planilla', icon: IconPlanilla },
  pagos: { label: 'Pagos', title: 'Pagos', sub: 'Control de salarios pendientes y realizados', icon: IconPagos },
  // Las rutas `ccss` e `ins` se eliminaron: eran pantallas standalone que
  // mostraban exactamente los mismos datos que los dossiers de CCSS/INS
  // dentro de Obligaciones (dos paneles para lo mismo). Todo el acceso pasa
  // ahora por Obligaciones, que ya era a donde apuntaban el Home y el propio
  // "Atender X". `App.jsx` traduce cualquier destino `ccss`/`ins` —incluidos
  // los enlaces viejos tipo `#ccss`— al dossier correspondiente.
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
  { label: 'OBLIGACIONES', items: ['calendario'] },
  { label: 'ANÁLISIS', items: ['reportes', 'historial'] },
  { label: 'SISTEMA', items: ['configuracion'] },
];

export const defaultScreen = 'panel';
