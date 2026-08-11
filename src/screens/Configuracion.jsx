import { useRef, useState } from 'react';

import { HOY } from '../data/mock.js';
import { NotificacionesPanel } from '../components/ui/NotificacionesPanel.jsx';
import { ConfirmDialog } from '../components/ui/Modal.jsx';
import ScrollRail, { Logo } from '../components/ScrollRail.jsx';

/**
 * Configuración — fuente ÚNICA de todo lo que el sistema deja gestionar.
 * Antes era la última pantalla que quedaba con el shell viejo (sidebar
 * oscuro + barra superior + tarjetas blancas), así que se leía como "la
 * versión antigua" del sistema aunque fuera el mismo y único componente.
 * Acá se pasa al mismo lenguaje editorial que el resto (paleta cream/coral/
 * gold, Instrument Serif + JetBrains Mono, masthead + secciones + dock).
 *
 * IMPORTANTE: sólo cambia la presentación. Los campos, la validación, los
 * `id` de cada control y el objeto que se envía a `onGuardar` son
 * exactamente los mismos de antes — nada de lógica nueva ni datos nuevos.
 */
const pal = {
  ink: 'oklch(20% 0.02 30)',
  cream: 'oklch(96% 0.015 60)',
  cream2: 'oklch(98% 0.008 65)',
  paper: 'oklch(99% 0.006 70)',
  line: 'oklch(85% 0.015 55)',
  line2: 'oklch(90% 0.012 55)',
  muted: 'oklch(48% 0.02 40)',
  muted2: 'oklch(62% 0.02 40)',
  coral: 'oklch(70% 0.16 30)',
  peach: 'oklch(85% 0.10 55)',
  sage: 'oklch(72% 0.12 145)',
  gold: 'oklch(85% 0.14 75)',
  red: 'oklch(55% 0.19 27)',
  deepGreen: 'oklch(38% 0.11 145)',
};

const serif = { fontFamily: "'Instrument Serif', serif", fontWeight: 400 };
const mono = {
  fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  fontSize: 11,
  color: pal.muted,
};
const num = { fontVariantNumeric: 'tabular-nums' };

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function fechaLarga(hoy) {
  const weekday = new Date(hoy.anio, hoy.mesIndice, hoy.dia).toLocaleDateString('es-CR', { weekday: 'long' });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap} · ${String(hoy.dia).padStart(2, '0')} ${MESES_LARGO[hoy.mesIndice]} ${hoy.anio}`;
}

const NAV_ITEMS = [
  { key: 'panel', label: 'Hoy' },
  { key: 'planilla', label: 'Planilla' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'empleados', label: 'Equipo' },
  { key: 'calendario', label: 'Obligaciones' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'historial', label: 'Historial' },
];

/* ---------------------------------------------------------
   Validación — idéntica a la anterior
   --------------------------------------------------------- */

function aPorcentaje(decimal) {
  return (decimal * 100).toFixed(2).replace(/\.00$/, '');
}

/** "Flor Damaris Espinoza" → "FD" — mismo criterio que `initials` en format.js. */
function inicialesDe(nombre) {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0] || '')
    .join('')
    .toUpperCase();
}

function validar(f) {
  const err = {};
  if (!f.nombre.trim()) err.nombre = 'Ingresa el nombre de la empresa.';
  if (!f.actividad.trim()) err.actividad = 'Ingresa la actividad económica.';
  if (!f.modulo.trim()) err.modulo = 'Ingresa el nombre del módulo.';
  if (!f.usuarioNombre.trim()) err.usuarioNombre = 'Ingresa el nombre de quien usa el sistema.';
  if (!f.usuarioRol.trim()) err.usuarioRol = 'Ingresa el rol.';
  const metodos = f.metodosPago
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  if (metodos.length === 0) err.metodosPago = 'Indicá al menos un método de pago.';
  const jornada = Number(f.jornadaHorasMes);
  if (!Number.isFinite(jornada) || jornada <= 0 || jornada > 744) err.jornadaHorasMes = 'Debe ser un número de horas mayor que 0.';
  const factor = Number(f.factorHoraExtra);
  if (!Number.isFinite(factor) || factor < 1 || factor > 5) err.factorHoraExtra = 'Debe ser un multiplicador entre 1 y 5 (ej. 1.5).';
  const ded = Number(f.deduccionEmpleado);
  if (Number.isNaN(ded) || ded < 0 || ded > 100) err.deduccionEmpleado = 'Debe ser un porcentaje entre 0 y 100.';
  const car = Number(f.cargasPatronales);
  if (Number.isNaN(car) || car < 0 || car > 100) err.cargasPatronales = 'Debe ser un porcentaje entre 0 y 100.';
  const corte = Number(f.fechaCorte);
  if (!Number.isInteger(corte) || corte < 1 || corte > 28) err.fechaCorte = 'Debe ser un día entre 1 y 28.';
  // Opcionales: si se dejan vacíos, la obligación queda "Sin fecha configurada" (no es un error).
  if (f.ccssDiaVencimiento.trim() !== '') {
    const d = Number(f.ccssDiaVencimiento);
    if (!Number.isInteger(d) || d < 1 || d > 28) err.ccssDiaVencimiento = 'Debe ser un día entre 1 y 28, o dejarlo vacío.';
  }
  if (f.insDiaVencimiento.trim() !== '') {
    const d = Number(f.insDiaVencimiento);
    if (!Number.isInteger(d) || d < 1 || d > 28) err.insDiaVencimiento = 'Debe ser un día entre 1 y 28, o dejarlo vacío.';
  }
  if (!f.polizaNumero.trim()) err.polizaNumero = 'Ingresa el número de póliza.';
  if (!f.polizaVigencia.trim()) err.polizaVigencia = 'Ingresa la vigencia de la póliza.';
  if (!f.polizaTasa.trim()) err.polizaTasa = 'Ingresa la tasa de la póliza.';
  return err;
}

/* ---------------------------------------------------------
   Piezas editoriales
   --------------------------------------------------------- */

function Masthead({ usuario, empresaNombre, onNavigate, notificaciones, onNotifClick }) {
  return (
    <header
      style={{
        padding: '24px 56px 18px',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        gap: 24,
        alignItems: 'center',
        borderBottom: `1px solid ${pal.line}`,
        position: 'relative',
        zIndex: 5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        <Logo />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, minWidth: 0 }}>
          <span style={{ fontSize: 22, fontStyle: 'italic', letterSpacing: '-0.01em', ...serif }}>Gestión Laboral</span>
          <span style={{ ...mono, fontSize: 9 }}>Espacio de {usuario.nombre.split(' ')[0]}</span>
        </div>
        <span
          style={{
            marginLeft: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: '0.16em',
            color: pal.muted,
            padding: '4px 9px',
            border: `1px solid ${pal.line}`,
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
          {empresaNombre}
        </span>
      </div>

      <nav className="ed-masthead-nav" style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 13 }}>
        {NAV_ITEMS.map((item) => (
          <a
            key={item.key}
            href={`#${item.key}`}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(item.key);
            }}
            className="ed-nav-link"
            style={{ color: pal.muted, fontWeight: 400, position: 'relative' }}
          >
            {item.label}
          </a>
        ))}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
        <NotificacionesPanel notificaciones={notificaciones} onNotifClick={onNotifClick} />
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: `linear-gradient(135deg, ${pal.peach}, ${pal.coral})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: pal.ink,
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          {usuario.iniciales}
        </div>
      </div>
    </header>
  );
}

function StatusBar({ config, usuario }) {
  return (
    <div
      style={{
        padding: '10px 56px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: pal.muted,
        borderBottom: `1px solid ${pal.line2}`,
        position: 'relative',
        zIndex: 5,
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <span>{fechaLarga(HOY)}</span>
      <span style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        <span style={{ color: pal.ink }}>▣ {aPorcentaje(config.tasas.deduccionEmpleado)}% obrera</span>
        <span style={{ color: pal.muted }}>● {aPorcentaje(config.tasas.cargasPatronales)}% patronal</span>
        <span style={{ color: pal.deepGreen }}>● INS {config.poliza.tasa}</span>
      </span>
      <span>{usuario.rol}</span>
    </div>
  );
}

/** Campo editorial: etiqueta mono, control sobre papel, ayuda/error debajo. */
function Campo({ label, help, error, required, htmlFor, span, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...(span ? { gridColumn: '1 / -1' } : null) }}>
      <label htmlFor={htmlFor} style={{ ...mono, fontSize: 9, color: pal.muted }}>
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: pal.coral }}>
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {help && !error && <span style={{ fontSize: 11.5, fontStyle: 'italic', color: pal.muted2, ...serif }}>{help}</span>}
      {error && (
        <span role="alert" style={{ fontSize: 11.5, color: pal.red, fontWeight: 500 }}>
          {error}
        </span>
      )}
    </div>
  );
}

const controlStyle = (error) => ({
  width: '100%',
  padding: '10px 13px',
  fontSize: 14,
  fontFamily: 'inherit',
  color: pal.ink,
  background: pal.paper,
  border: `1px solid ${error ? pal.red : pal.line}`,
  borderRadius: 11,
  outline: 'none',
});

/** Sección editorial: eyebrow numerado + titular serif + retícula de campos. */
function Bloque({ n, eyebrow, titulo, destacado, nota, children }) {
  return (
    <section style={{ padding: '0 56px 44px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 28, alignItems: 'baseline', marginBottom: 22 }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>
            Sección {n} · {eyebrow}
          </div>
          <div style={{ fontSize: 38, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            {titulo} <em style={{ fontStyle: 'italic', color: 'oklch(45% 0.09 30)' }}>{destacado}</em>
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
      </div>

      <div
        style={{
          padding: '26px 30px',
          background: pal.cream2,
          border: `1px solid ${pal.line}`,
          borderRadius: 22,
        }}
      >
        {nota && (
          <p style={{ margin: '0 0 20px', fontSize: 14, fontStyle: 'italic', lineHeight: 1.5, color: pal.muted, maxWidth: 720, ...serif }}>
            {nota}
          </p>
        )}
        <div className="ed-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {children}
        </div>
      </div>
    </section>
  );
}

const CONFIG_SECTIONS = [
  { key: 'empresa', label: 'Empresa' },
  { key: 'usuario', label: 'Usuario' },
  { key: 'tasas', label: 'Tasas' },
  { key: 'periodo', label: 'Período' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'ins', label: 'INS' },
  { key: 'respaldo', label: 'Respaldo' },
];

/* ---------------------------------------------------------
   Composición
   --------------------------------------------------------- */

export default function Configuracion({ config, onGuardar, notificaciones, onNotifClick, onNavigate, onExportarTodo, onImportarTodo }) {
  const [f, setF] = useState(() => ({
    nombre: config.empresa.nombre,
    actividad: config.empresa.actividad,
    modulo: config.modulo,
    usuarioNombre: config.usuario.nombre,
    usuarioRol: config.usuario.rol,
    usuarioIniciales: config.usuario.iniciales,
    metodosPago: config.metodosPago.join(', '),
    jornadaHorasMes: String(config.jornadaHorasMes),
    factorHoraExtra: String(config.factorHoraExtra),
    deduccionEmpleado: aPorcentaje(config.tasas.deduccionEmpleado),
    cargasPatronales: aPorcentaje(config.tasas.cargasPatronales),
    periodoTipo: config.periodoTipo,
    fechaCorte: String(config.fechaCorte),
    ccssDiaVencimiento: config.ccssDiaVencimiento != null ? String(config.ccssDiaVencimiento) : '',
    insDiaVencimiento: config.insDiaVencimiento != null ? String(config.insDiaVencimiento) : '',
    polizaNumero: config.poliza.numero,
    polizaVigencia: config.poliza.vigencia,
    polizaTasa: config.poliza.tasa,
  }));
  const [errores, setErrores] = useState({});
  const [guardado, setGuardado] = useState(false);

  const [exportando, setExportando] = useState(false);
  const [archivoPendiente, setArchivoPendiente] = useState(null);
  const importRef = useRef(null);

  const sectionRefs = useRef({});
  const setSectionRef = (key) => (el) => {
    sectionRefs.current[key] = el;
  };

  async function handleExportarClick() {
    setExportando(true);
    try {
      await onExportarTodo();
    } finally {
      setExportando(false);
    }
  }

  function handleArchivoElegido(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite elegir el mismo archivo dos veces seguidas
    if (file) setArchivoPendiente(file);
  }

  function confirmarImportacion() {
    const file = archivoPendiente;
    setArchivoPendiente(null);
    if (file) onImportarTodo(file);
  }

  function set(campo, valor) {
    setF((d) => ({ ...d, [campo]: valor }));
    setGuardado(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const err = validar(f);
    setErrores(err);
    if (Object.keys(err).length > 0) {
      // Lleva el foco al primer campo con problema en vez de fallar en silencio
      // en una página larga donde el error puede quedar fuera de pantalla.
      document.getElementById(PRIMER_CAMPO[Object.keys(err)[0]])?.focus();
      return;
    }

    const metodosPago = f.metodosPago
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    onGuardar({
      empresa: { nombre: f.nombre.trim(), actividad: f.actividad.trim() },
      modulo: f.modulo.trim(),
      usuario: {
        nombre: f.usuarioNombre.trim(),
        rol: f.usuarioRol.trim(),
        // Si se dejan vacías, se derivan del nombre en vez de guardar un
        // avatar en blanco.
        iniciales: f.usuarioIniciales.trim().toUpperCase() || inicialesDe(f.usuarioNombre),
      },
      metodosPago,
      jornadaHorasMes: Number(f.jornadaHorasMes),
      factorHoraExtra: Number(f.factorHoraExtra),
      tasas: { deduccionEmpleado: Number(f.deduccionEmpleado) / 100, cargasPatronales: Number(f.cargasPatronales) / 100 },
      periodoTipo: f.periodoTipo,
      fechaCorte: Number(f.fechaCorte),
      ccssDiaVencimiento: f.ccssDiaVencimiento.trim() === '' ? null : Number(f.ccssDiaVencimiento),
      insDiaVencimiento: f.insDiaVencimiento.trim() === '' ? null : Number(f.insDiaVencimiento),
      poliza: { numero: f.polizaNumero.trim(), vigencia: f.polizaVigencia.trim(), tasa: f.polizaTasa.trim() },
    });
    setGuardado(true);
  }

  const hayErrores = Object.keys(errores).length > 0;

  return (
    <form
      className="screen ed-home"
      onSubmit={handleSubmit}
      noValidate
      style={{ fontFamily: "'Albert Sans', system-ui, sans-serif", color: pal.ink, background: pal.cream, minHeight: '100%' }}
    >
      <ScrollRail sectionRefs={sectionRefs} sections={CONFIG_SECTIONS} />

      <div style={{ maxWidth: 1440, margin: '0 auto', position: 'relative' }}>
        <Masthead usuario={config.usuario} empresaNombre={config.empresa.nombre} onNavigate={onNavigate} notificaciones={notificaciones} onNotifClick={onNotifClick} />
        <StatusBar config={config} usuario={config.usuario} />

        {/* Hero */}
        <section style={{ padding: '44px 56px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <span style={{ width: 32, height: 1, background: pal.ink }} />
            <span style={{ ...mono, color: pal.ink }}>Configuración</span>
          </div>
          <h1 style={{ fontSize: 68, lineHeight: 0.98, margin: '0 0 18px', letterSpacing: '-0.02em', color: pal.ink, ...serif }}>
            Todo lo que el sistema
            <br />
            <em style={{ fontStyle: 'italic', color: 'oklch(45% 0.09 30)' }}>obedece</em>.
          </h1>
          <p style={{ fontSize: 19, fontStyle: 'italic', lineHeight: 1.45, margin: 0, maxWidth: 660, color: 'oklch(35% 0.03 30)', ...serif }}>
            Esta es la única pantalla de configuración del sistema. Lo que cambies acá se aplica de inmediato a la planilla, los pagos, las obligaciones y los reportes.
          </p>
        </section>

        <div id="cfg-sec-empresa" ref={setSectionRef('empresa')}>
          <Bloque
            n="01"
            eyebrow="la empresa"
            titulo="Quién"
            destacado="factura"
            nota="El nombre y el módulo aparecen en el encabezado de cada pantalla. La actividad económica es la que respalda la tasa de riesgo de la póliza del INS."
          >
            <Campo label="Nombre de la empresa" required error={errores.nombre} htmlFor="cfg-nombre">
              <input id="cfg-nombre" style={controlStyle(errores.nombre)} value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />
            </Campo>
            <Campo label="Actividad económica" required error={errores.actividad} htmlFor="cfg-actividad">
              <input id="cfg-actividad" style={controlStyle(errores.actividad)} value={f.actividad} onChange={(e) => set('actividad', e.target.value)} />
            </Campo>
            <Campo label="Nombre del módulo" help="Rótulo que acompaña al nombre de la empresa." required error={errores.modulo} htmlFor="cfg-modulo" span>
              <input id="cfg-modulo" style={controlStyle(errores.modulo)} value={f.modulo} onChange={(e) => set('modulo', e.target.value)} />
            </Campo>
          </Bloque>
        </div>

        <div id="cfg-sec-usuario" ref={setSectionRef('usuario')}>
          <Bloque
            n="02"
            eyebrow="la sesión"
            titulo="Quién"
            destacado="opera"
            nota="Aparece en el saludo del inicio, en el avatar y en la barra de estado de cada pantalla."
          >
            <Campo label="Nombre" required error={errores.usuarioNombre} htmlFor="cfg-usr-nombre">
              <input id="cfg-usr-nombre" style={controlStyle(errores.usuarioNombre)} value={f.usuarioNombre} onChange={(e) => set('usuarioNombre', e.target.value)} />
            </Campo>
            <Campo label="Rol" required error={errores.usuarioRol} htmlFor="cfg-usr-rol">
              <input id="cfg-usr-rol" style={controlStyle(errores.usuarioRol)} value={f.usuarioRol} onChange={(e) => set('usuarioRol', e.target.value)} />
            </Campo>
            <Campo
              label="Iniciales del avatar"
              help={`Vacío = se derivan del nombre (${inicialesDe(f.usuarioNombre) || '—'}).`}
              htmlFor="cfg-usr-ini"
            >
              <input
                id="cfg-usr-ini"
                maxLength={3}
                placeholder={inicialesDe(f.usuarioNombre)}
                style={controlStyle(false)}
                value={f.usuarioIniciales}
                onChange={(e) => set('usuarioIniciales', e.target.value)}
              />
            </Campo>
          </Bloque>
        </div>

        <div id="cfg-sec-tasas" ref={setSectionRef('tasas')}>
          <Bloque
            n="03"
            eyebrow="seguro social"
            titulo="Cuánto"
            destacado="se retiene"
            nota="Se aplican de inmediato a la planilla, los pagos y los reportes. Las cuotas ya marcadas como pagadas conservan la tasa con la que se pagaron."
          >
            <Campo label="Deducción del empleado (%)" required error={errores.deduccionEmpleado} htmlFor="cfg-ded">
              <input
                id="cfg-ded"
                type="number"
                min="0"
                max="100"
                step="0.01"
                style={{ ...controlStyle(errores.deduccionEmpleado), ...num }}
                value={f.deduccionEmpleado}
                onChange={(e) => set('deduccionEmpleado', e.target.value)}
              />
            </Campo>
            <Campo label="Cargas patronales CCSS (%)" required error={errores.cargasPatronales} htmlFor="cfg-car">
              <input
                id="cfg-car"
                type="number"
                min="0"
                max="100"
                step="0.01"
                style={{ ...controlStyle(errores.cargasPatronales), ...num }}
                value={f.cargasPatronales}
                onChange={(e) => set('cargasPatronales', e.target.value)}
              />
            </Campo>
            <Campo
              label="Día de vencimiento CCSS"
              help="Día del mes (1–28) en que vence el pago. Vacío = sin fecha configurada."
              error={errores.ccssDiaVencimiento}
              htmlFor="cfg-ccss-venc"
            >
              <input
                id="cfg-ccss-venc"
                type="number"
                min="1"
                max="28"
                placeholder="Sin configurar"
                style={{ ...controlStyle(errores.ccssDiaVencimiento), ...num }}
                value={f.ccssDiaVencimiento}
                onChange={(e) => set('ccssDiaVencimiento', e.target.value)}
              />
            </Campo>
          </Bloque>
        </div>

        <div id="cfg-sec-periodo" ref={setSectionRef('periodo')}>
          <Bloque
            n="04"
            eyebrow="el ciclo"
            titulo="Cada cuánto"
            destacado="se cierra"
            nota="Define qué período se abre al cerrar el actual y hasta qué día llega cada planilla."
          >
            <Campo label="Tipo de período" htmlFor="cfg-tipo">
              <select id="cfg-tipo" style={controlStyle(false)} value={f.periodoTipo} onChange={(e) => set('periodoTipo', e.target.value)}>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </Campo>
            <Campo label="Día de corte" help="Día del mes en que inicia el período (1–28)." required error={errores.fechaCorte} htmlFor="cfg-corte">
              <input
                id="cfg-corte"
                type="number"
                min="1"
                max="28"
                style={{ ...controlStyle(errores.fechaCorte), ...num }}
                value={f.fechaCorte}
                onChange={(e) => set('fechaCorte', e.target.value)}
              />
            </Campo>
          </Bloque>
        </div>

        <div id="cfg-sec-pagos" ref={setSectionRef('pagos')}>
          <Bloque
            n="05"
            eyebrow="pagos y horas"
            titulo="Cómo"
            destacado="se paga"
            nota="Los métodos son las opciones del modal “Marcar como pagada” en Planilla y Pagos. La jornada y el factor definen cuánto vale cada hora extra registrada."
          >
            <Campo
              label="Métodos de pago"
              help="Separados por coma."
              required
              error={errores.metodosPago}
              htmlFor="cfg-metodos"
              span
            >
              <input
                id="cfg-metodos"
                style={controlStyle(errores.metodosPago)}
                value={f.metodosPago}
                onChange={(e) => set('metodosPago', e.target.value)}
                placeholder="Transferencia, Efectivo, Cheque, SINPE Móvil"
              />
            </Campo>
            <Campo
              label="Jornada mensual (horas)"
              help="Valor de la hora = salario ÷ horas."
              required
              error={errores.jornadaHorasMes}
              htmlFor="cfg-jornada"
            >
              <input
                id="cfg-jornada"
                type="number"
                min="1"
                max="744"
                step="1"
                style={{ ...controlStyle(errores.jornadaHorasMes), ...num }}
                value={f.jornadaHorasMes}
                onChange={(e) => set('jornadaHorasMes', e.target.value)}
              />
            </Campo>
            <Campo
              label="Factor de hora extra"
              help="Multiplicador sobre la hora ordinaria (ej. 1.5)."
              required
              error={errores.factorHoraExtra}
              htmlFor="cfg-factor"
            >
              <input
                id="cfg-factor"
                type="number"
                min="1"
                max="5"
                step="0.05"
                style={{ ...controlStyle(errores.factorHoraExtra), ...num }}
                value={f.factorHoraExtra}
                onChange={(e) => set('factorHoraExtra', e.target.value)}
              />
            </Campo>
          </Bloque>
        </div>

        <div id="cfg-sec-ins" ref={setSectionRef('ins')}>
          <Bloque
            n="06"
            eyebrow="riesgos del trabajo"
            titulo="La póliza"
            destacado="del INS"
            nota="La tasa se aplica sobre la planilla mensual activa para estimar el reporte. Los reportes ya regularizados conservan la tasa con la que se presentaron."
          >
            <Campo label="Número de póliza" required error={errores.polizaNumero} htmlFor="cfg-poliza">
              <input id="cfg-poliza" style={controlStyle(errores.polizaNumero)} value={f.polizaNumero} onChange={(e) => set('polizaNumero', e.target.value)} />
            </Campo>
            <Campo label="Tasa aplicada" help="Ej. 2,00%" required error={errores.polizaTasa} htmlFor="cfg-polizaTasa">
              <input id="cfg-polizaTasa" style={controlStyle(errores.polizaTasa)} value={f.polizaTasa} onChange={(e) => set('polizaTasa', e.target.value)} />
            </Campo>
            <Campo
              label="Día de vencimiento del reporte INS"
              help="Día del mes (1–28). Vacío = sin fecha configurada."
              error={errores.insDiaVencimiento}
              htmlFor="cfg-ins-venc"
            >
              <input
                id="cfg-ins-venc"
                type="number"
                min="1"
                max="28"
                placeholder="Sin configurar"
                style={{ ...controlStyle(errores.insDiaVencimiento), ...num }}
                value={f.insDiaVencimiento}
                onChange={(e) => set('insDiaVencimiento', e.target.value)}
              />
            </Campo>
            <Campo label="Vigencia" required error={errores.polizaVigencia} htmlFor="cfg-vigencia">
              <input
                id="cfg-vigencia"
                style={controlStyle(errores.polizaVigencia)}
                value={f.polizaVigencia}
                onChange={(e) => set('polizaVigencia', e.target.value)}
                placeholder="01 dic 2025 — 30 nov 2026"
              />
            </Campo>
          </Bloque>
        </div>

        <div id="cfg-sec-respaldo" ref={setSectionRef('respaldo')}>
          <Bloque
            n="07"
            eyebrow="respaldo"
            titulo="Copia de"
            destacado="seguridad"
            nota="Mientras el sistema no tenga una base de datos en la nube, toda la información vive únicamente en este navegador. Exportá un respaldo de vez en cuando (por ejemplo, al cerrar cada quincena) y guardalo fuera de esta computadora — Drive, USB, correo — para poder recuperarlo todo si se borra el caché o se formatea la máquina."
          >
            <div style={{ padding: '22px 24px', background: pal.paper, border: `1px solid ${pal.line}`, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 20, color: pal.ink, ...serif }}>Exportar todo</div>
              <p style={{ margin: 0, fontSize: 13, color: pal.muted, lineHeight: 1.55 }}>
                Descarga un Excel con empleados, historial de pagos, CCSS, INS y configuración — listo para guardar como respaldo.
              </p>
              <button
                type="button"
                onClick={handleExportarClick}
                disabled={exportando}
                style={{
                  padding: '12px 18px',
                  background: pal.ink,
                  color: pal.cream,
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: exportando ? 'default' : 'pointer',
                  opacity: exportando ? 0.7 : 1,
                }}
              >
                {exportando ? 'Generando…' : 'Exportar todo a Excel ↓'}
              </button>
            </div>

            <div style={{ padding: '22px 24px', background: pal.paper, border: `1px solid ${pal.line}`, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 20, color: pal.ink, ...serif }}>Importar / restaurar</div>
              <p style={{ margin: 0, fontSize: 13, color: pal.muted, lineHeight: 1.55 }}>
                Subí un archivo de respaldo generado por esta misma app. <strong style={{ color: pal.red }}>Reemplaza todo</strong> lo que hay guardado ahora en este navegador.
              </p>
              <input ref={importRef} type="file" accept=".xlsx" onChange={handleArchivoElegido} style={{ display: 'none' }} />
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                style={{
                  padding: '12px 18px',
                  background: 'transparent',
                  color: pal.ink,
                  border: `1px solid ${pal.line}`,
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Importar desde Excel ↑
              </button>
            </div>
          </Bloque>
        </div>

        <ConfirmDialog
          open={!!archivoPendiente}
          onClose={() => setArchivoPendiente(null)}
          onConfirm={confirmarImportacion}
          title="Restaurar desde este archivo"
          description={`Se va a reemplazar TODA la información guardada en este navegador (empleados, períodos, historial, configuración) por la del archivo "${archivoPendiente?.name || ''}". Esta acción no se puede deshacer.`}
          confirmLabel="Restaurar y reemplazar"
          danger
        />

        <footer
          style={{
            padding: '0 56px 40px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: pal.muted,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <span>Gestión Laboral · Configuración</span>
          <span>© {HOY.anio} · Prototipo</span>
        </footer>
      </div>

      {/* Dock — guardar siempre a mano, sin tener que volver arriba */}
      <div style={{ position: 'sticky', bottom: 20, margin: '-36px auto 0', width: 'fit-content', display: 'flex', justifyContent: 'center', zIndex: 20 }}>
        <div
          className="ed-dock"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: pal.ink,
            color: pal.cream,
            padding: '8px 8px 8px 20px',
            borderRadius: 999,
            boxShadow: '0 24px 60px -20px oklch(20% 0.02 30 / 0.5)',
          }}
        >
          <span style={{ ...mono, color: 'oklch(70% 0.02 60)', fontSize: 10 }}>Configuración</span>
          <span style={{ width: 1, height: 16, background: 'oklch(40% 0.02 30)', margin: '0 6px' }} />
          {hayErrores && (
            <span style={{ fontSize: 12, color: 'oklch(80% 0.14 30)', paddingRight: 6 }}>Revisá los campos marcados</span>
          )}
          {guardado && !hayErrores && (
            <span style={{ fontSize: 12, color: 'oklch(82% 0.12 145)', paddingRight: 6 }}>Guardado ✓</span>
          )}
          <button
            type="submit"
            style={{
              padding: '9px 18px',
              background: pal.gold,
              color: pal.ink,
              border: 'none',
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </form>
  );
}

/** Campo al que llevar el foco cuando su validación falla. */
const PRIMER_CAMPO = {
  nombre: 'cfg-nombre',
  actividad: 'cfg-actividad',
  modulo: 'cfg-modulo',
  usuarioNombre: 'cfg-usr-nombre',
  usuarioRol: 'cfg-usr-rol',
  metodosPago: 'cfg-metodos',
  jornadaHorasMes: 'cfg-jornada',
  factorHoraExtra: 'cfg-factor',
  deduccionEmpleado: 'cfg-ded',
  cargasPatronales: 'cfg-car',
  fechaCorte: 'cfg-corte',
  ccssDiaVencimiento: 'cfg-ccss-venc',
  insDiaVencimiento: 'cfg-ins-venc',
  polizaNumero: 'cfg-poliza',
  polizaVigencia: 'cfg-vigencia',
  polizaTasa: 'cfg-polizaTasa',
};
