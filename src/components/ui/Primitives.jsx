/**
 * Primitivas visuales compartidas por todas las pantallas.
 * Los valores provienen de `theme/tokens.js`; ninguna inventa color propio.
 */

import { color, font, elevation, radius } from '../../theme/tokens.js';

/* ---------------------------------------------------------
   Botón
   --------------------------------------------------------- */

/**
 * `variant`: accent | ghost | soft | danger | icon
 * `size`: sm | md | lg | icon — sustituye los paddings/fontSize que antes
 * cada pantalla pisaba con `style` inline (Fase 1 · E).
 * `pending`: botón sin lógica todavía conectada — se ve deshabilitado de
 * forma honesta (Fase 1 · B.1). Combínese con `Tooltip` para explicarlo.
 * Los estados (hover, active, focus) viven en `global.css`.
 */
export function Button({ variant = 'ghost', size = 'md', pending = false, style, className = '', children, ...rest }) {
  const sizeClass = size === 'icon' ? 'btn--icon-size' : `btn--${size}`;
  return (
    <button
      type="button"
      className={`btn btn--${variant} ${sizeClass} ${className}`.trim()}
      style={style}
      aria-disabled={pending ? 'true' : undefined}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------
   Contenedores
   --------------------------------------------------------- */

/**
 * Tarjeta clara estándar. `pad={false}` para tablas a sangre.
 * `elevate={2}` sube la sombra un nivel (hover/estado destacado); por
 * defecto vive en el nivel 1 del sistema de elevación (Fase 1 · I.1).
 */
export function Card({ pad = 20, elevate = 1, style, children, ...rest }) {
  return (
    <div
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        boxShadow: elevation[elevate],
        ...(pad === false ? { overflow: 'hidden' } : { padding: pad }),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Cabecera de tarjeta con título y acción opcional a la derecha. */
export function CardHeader({ title, subtitle, right, style }) {
  return (
    <div
      style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${color.borderSoft}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        ...style,
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 600, color: color.text2, fontFamily: 'inherit' }}>
          {title}
        </h2>
        {subtitle && <div style={{ fontSize: '0.8rem', color: color.muted, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

/** Etiqueta monoespaciada de sección (INFORMACIÓN PERSONAL, etc.). */
export function MonoLabel({ children, style }) {
  return (
    <div
      style={{
        fontFamily: font.mono,
        fontSize: '0.62rem',
        letterSpacing: '0.18em',
        color: color.labelFaint,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------
   Datos
   --------------------------------------------------------- */

/** Punto de color de 5–9 px usado en insignias y leyendas. */
export function Dot({ c, size = 6, radius = '50%' }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: c,
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  );
}

/** Insignia de estado: punto + etiqueta sobre fondo tintado. */
export function Badge({ bg, c, dot, children, size = 'md' }) {
  const sizes = {
    xs: { padding: '3px 9px', fontSize: '0.66rem', dot: 5, gap: 6 },
    sm: { padding: '4px 10px', fontSize: '0.7rem', dot: 5, gap: 6 },
    md: { padding: '4px 11px', fontSize: '0.72rem', dot: 5, gap: 6 },
    lg: { padding: '5px 11px', fontSize: '0.72rem', dot: 6, gap: 7 },
    xl: { padding: '6px 13px', fontSize: '0.78rem', dot: 6, gap: 7 },
  };
  const s = sizes[size];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        padding: s.padding,
        borderRadius: 999,
        fontSize: s.fontSize,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        background: bg,
        color: c,
      }}
    >
      {dot && <Dot c={dot} size={s.dot} />}
      {children}
    </span>
  );
}

/** Insignia construida desde un objeto de estado (`stBg`, `stC`, `stD`, `stL`). */
export function StatusBadge({ item, size = 'md' }) {
  return (
    <Badge bg={item.stBg} c={item.stC} dot={item.stD} size={size}>
      {item.stL}
    </Badge>
  );
}

/** Avatar circular con iniciales. */
export function Avatar({ ini, bg, c, size = 34, fontSize }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: fontSize || `${Math.max(0.68, size * 0.022)}rem`,
        flexShrink: 0,
        background: bg,
        color: c,
      }}
    >
      {ini}
    </div>
  );
}

/** Fila etiqueta / valor de los paneles de resumen. */
export function KeyValue({ label, value, valueColor = color.text5, bold = 600, mono = true, labelColor = color.muted2 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ color: labelColor }}>{label}</span>
      <span
        style={{
          fontWeight: bold,
          color: valueColor,
          ...(mono ? { fontVariantNumeric: 'tabular-nums' } : null),
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** Tarjeta de métrica del panel. */
export function StatCard({ label, value, children }) {
  return (
    <Card pad="18px 20px">
      <div
        style={{
          fontSize: '0.72rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: color.label,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 300,
          fontSize: '2.6rem',
          color: color.text,
          lineHeight: 1,
          marginTop: 8,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {children}
    </Card>
  );
}

/** Cifra secundaria en tarjeta (usada en Planilla). */
export function MiniStat({ label, value, dark = false }) {
  return (
    <div
      style={{
        background: dark ? color.ink : color.surface,
        border: dark ? 'none' : `1px solid ${color.border}`,
        borderRadius: radius.md,
        boxShadow: dark ? elevation[2] : elevation[1],
        padding: '16px 20px',
      }}
    >
      <div
        style={{
          fontSize: '0.74rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: dark ? color.onInkMuted : color.label,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 300,
          fontSize: '1.9rem',
          color: dark ? color.accent : color.text2,
          marginTop: 6,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** Fila de historial de comprobantes (CCSS / INS). */
export function ComprobanteRow({ periodo, detalle, monto, estado }) {
  return (
    <div
      className="list-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '12px 14px',
        borderRadius: 7,
      }}
    >
      <div>
        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: color.text4 }}>{periodo}</div>
        <div style={{ fontSize: '0.74rem', color: color.muted4 }}>{detalle}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div
          style={{
            fontSize: '0.86rem',
            fontWeight: 700,
            color: color.text4,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {monto}
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: '0.68rem',
            fontWeight: 700,
            color: estado.c,
            marginTop: 2,
          }}
        >
          <Dot c={estado.d} size={5} />
          {estado.l}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Tablas
   --------------------------------------------------------- */

/**
 * Cabecera de tabla en retícula.
 * `cols` es el `grid-template-columns`; `items` es [{ label, align, pl }].
 */
export function TableHead({ cols, items, padding = '12px 22px', gap = 8, fontSize = '0.68rem', letterSpacing = '0.08em' }) {
  return (
    <div
      role="row"
      style={{
        display: 'grid',
        gridTemplateColumns: cols,
        gap,
        padding,
        background: color.tableHead,
        borderBottom: `1px solid ${color.borderStrong}`,
        fontSize,
        letterSpacing,
        textTransform: 'uppercase',
        color: color.labelAlt,
        fontWeight: 700,
      }}
    >
      {items.map((it) => (
        <span
          key={it.label}
          role="columnheader"
          style={{ textAlign: it.align || 'left', ...(it.pl ? { paddingLeft: it.pl } : null) }}
        >
          {it.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Contenedor de tabla: rol `table` semántico + scroll horizontal propio,
 * para que el body de la página nunca se desplace en horizontal
 * (Fase 1 · F.2). Envuelve `TableHead` + `TableRow`.
 */
export function Table({ style, children, ...rest }) {
  return (
    <div className="table-scroll" role="table" style={style} {...rest}>
      {children}
    </div>
  );
}

/**
 * Fila de datos en retícula, hermana de `TableHead`. `role="row"` completa
 * la semántica ARIA que antes solo cubría la cabecera (Fase 1 · G.1).
 * `foot` la usa como fila de totales; `hoverable`/`selected` activan las
 * clases de estado ya definidas en global.css.
 */
export function TableRow({
  cols,
  gap = 12,
  padding = '14px 22px',
  fontSize = '0.85rem',
  foot = false,
  hoverable = false,
  selected,
  className = '',
  style,
  children,
  ...rest
}) {
  return (
    <div
      role="row"
      data-selected={selected}
      className={`row ${hoverable ? 'row--hoverable' : ''} ${className}`.trim()}
      style={{
        display: 'grid',
        gridTemplateColumns: cols,
        gap,
        alignItems: 'center',
        padding,
        position: 'relative',
        fontSize,
        fontVariantNumeric: 'tabular-nums',
        borderBottom: foot ? 'none' : `1px solid ${color.borderFaint}`,
        background: foot ? color.tableFoot : undefined,
        fontWeight: foot ? 700 : undefined,
        color: foot ? color.text2 : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Celda de una `TableRow`. `align` acepta los valores de `text-align`. */
export function TableCell({ align, style, children, ...rest }) {
  return (
    <span role="cell" style={{ textAlign: align, ...style }} {...rest}>
      {children}
    </span>
  );
}

/** Identidad de empleado (avatar + nombre + puesto) usada en varias tablas. */
export function EmpleadoCell({ emp, avatarSize = 32, nameSize = '0.85rem', roleSize = '0.72rem', gap = 11 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap, minWidth: 0 }}>
      <Avatar ini={emp.ini} bg={emp.avBg} c={emp.avC} size={avatarSize} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: nameSize,
            fontWeight: 600,
            color: color.text4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {emp.nombre}
        </div>
        <div style={{ fontSize: roleSize, color: color.muted4 }}>{emp.puesto}</div>
      </div>
    </div>
  );
}
