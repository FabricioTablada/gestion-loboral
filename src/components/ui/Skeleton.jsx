import { radius } from '../../theme/tokens.js';

/**
 * Placeholder de carga con la forma del contenido final (Fase 1 · B.2 / D).
 * `variant="circle"` para avatares, `variant="text"` para líneas de texto,
 * por defecto un bloque rectangular. El shimmer respeta
 * `prefers-reduced-motion` vía la regla global en global.css.
 */
export function Skeleton({ variant = 'block', width, height, style }) {
  const shape =
    variant === 'circle'
      ? { width: width ?? 34, height: height ?? 34, borderRadius: '50%' }
      : variant === 'text'
        ? { width: width ?? '100%', height: height ?? 12, borderRadius: radius.sm }
        : { width: width ?? '100%', height: height ?? 20, borderRadius: radius.sm };

  return <span aria-hidden="true" className="skeleton" style={{ display: 'block', ...shape, ...style }} />;
}

/** Fila de skeleton para una tabla — misma retícula que `TableRow`. */
export function SkeletonRow({ cols, gap = 12, padding = '14px 22px' }) {
  const count = cols.split(' ').length;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap, padding, alignItems: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="text" />
      ))}
    </div>
  );
}

/** Skeleton de una StatCard — mismo alto/orden que el componente real. */
export function SkeletonStatCard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Skeleton variant="text" width="60%" height={10} />
      <Skeleton variant="text" width="45%" height={34} />
    </div>
  );
}
