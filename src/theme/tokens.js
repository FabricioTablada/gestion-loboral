/**
 * Tokens de diseño extraídos 1:1 del prototipo de Claude Design.
 * Toda la identidad visual vive aquí: ningún componente debe inventar un color.
 */

export const color = {
  // Superficies
  ink: 'oklch(7% 0.006 95)', // sidebar / bloques oscuros
  inkSoft: 'oklch(13% 0.008 95)', // hover sobre ink
  inkActive: 'oklch(19% 0.008 95)', // item de nav activo
  canvas: 'oklch(95% 0.012 95)', // fondo de la app — un punto por debajo de `surface`
  surface: 'oklch(99% 0.006 95)', // tarjetas
  surfaceAlt: 'oklch(98% 0.008 95)', // header
  surfaceRaise: 'oklch(99.5% 0.006 95)', // celdas de calendario
  tableHead: 'oklch(97% 0.008 95)',
  tableFoot: 'oklch(97.5% 0.008 95)',
  track: 'oklch(95% 0.008 95)', // fondo de barras
  trackSoft: 'oklch(92% 0.012 95)',

  // Bordes
  border: 'oklch(90% 0.012 95)',
  borderSoft: 'oklch(92% 0.012 95)',
  borderFaint: 'oklch(94% 0.008 95)',
  borderStrong: 'oklch(91% 0.012 95)',
  borderInput: 'oklch(89% 0.012 95)',
  borderDashed: 'oklch(85% 0.02 95)',
  onInk: 'oklch(78% 0 0 / 0.1)',
  onInkFaint: 'oklch(78% 0 0 / 0.08)',

  // Texto
  text: 'oklch(18% 0.02 95)',
  text2: 'oklch(20% 0.02 95)',
  text3: 'oklch(22% 0.02 95)',
  text4: 'oklch(24% 0.02 95)',
  text5: 'oklch(25% 0.02 95)',
  muted: 'oklch(52% 0.015 95)',
  muted2: 'oklch(50% 0.015 95)',
  muted3: 'oklch(45% 0.015 95)',
  muted4: 'oklch(54% 0.015 95)',
  label: 'oklch(52% 0.012 95)',
  labelAlt: 'oklch(50% 0.012 95)',
  labelFaint: 'oklch(55% 0.012 95)',

  // Texto sobre ink
  onInkText: 'oklch(91% 0 0)',
  onInkText2: 'oklch(93% 0 0)',
  onInkText3: 'oklch(90% 0 0)',
  onInkMuted: 'oklch(72% 0 0)',
  onInkMuted2: 'oklch(70% 0 0)',
  onInkMuted3: 'oklch(80% 0 0)',
  onInkFaded: 'oklch(66% 0 0)',
  onInkDim: 'oklch(55% 0 0)',

  // Marca
  accent: 'oklch(84% 0.19 80.46)', // ámbar principal
  accentHover: 'oklch(86% 0.09 84)',
  accentSoft: 'oklch(84% 0.14 82)',
  accentOn: 'oklch(16% 0.02 95)', // texto sobre ámbar
  accentNav: 'oklch(86% 0.16 82)', // label de nav activo

  // Semánticos
  teal: 'oklch(70% 0.12 188)',
  tealText: 'oklch(41% 0.08 190)',
  tealDot: 'oklch(66% 0.11 190)',
  amberDot: 'oklch(80% 0.16 82)',
  amberText: 'oklch(47% 0.11 66)',
  costo: 'oklch(40% 0.09 68)',
  danger: 'oklch(58% 0.16 35)',
  dangerBtn: 'oklch(58% 0.15 35)',
  dangerBtnHover: 'oklch(52% 0.16 35)',
  dangerOn: 'oklch(98% 0.01 35)',
};

export const font = {
  sans: "'Albert Sans', system-ui, -apple-system, Segoe UI, sans-serif",
  display: "'Alumni Sans', 'Albert Sans', sans-serif",
  mono: "'SFMono-Regular', ui-monospace, SFMono-Regular, Menlo, monospace",
};

/** Paleta de estados. Cada estado trae etiqueta, fondo, color de texto y punto. */
export const status = {
  vencido: { l: 'Vencido', bg: 'oklch(94% 0.045 35)', c: 'oklch(47% 0.16 35)', d: 'oklch(57% 0.18 35)' },
  proximo: { l: 'Próximo', bg: 'oklch(95% 0.065 88)', c: 'oklch(47% 0.11 66)', d: 'oklch(80% 0.16 82)' },
  pendiente: { l: 'Pendiente', bg: 'oklch(94% 0.004 95)', c: 'oklch(43% 0.008 95)', d: 'oklch(63% 0.008 95)' },
  aldia: { l: 'Al día', bg: 'oklch(93% 0.05 188)', c: 'oklch(41% 0.08 190)', d: 'oklch(66% 0.11 190)' },
  pagado: { l: 'Pagado', bg: 'oklch(94% 0.06 145)', c: 'oklch(39% 0.10 145)', d: 'oklch(56% 0.14 145)' },
};

/** Colores de avatar, asignados por índice de empleado. */
export const avatarPalette = [
  { bg: 'oklch(91% 0.09 85)', c: 'oklch(38% 0.10 68)' },
  { bg: 'oklch(90% 0.06 188)', c: 'oklch(38% 0.08 190)' },
  { bg: 'oklch(91% 0.028 95)', c: 'oklch(35% 0.02 95)' },
  { bg: 'oklch(89% 0.07 85)', c: 'oklch(40% 0.10 68)' },
];

/**
 * Sistema de elevación (Fase 1 · I.1). Sombras tintadas al tono `ink`,
 * nunca negro puro — cada nivel corresponde a una distancia real respecto
 * al canvas. Los mismos valores están duplicados como custom properties
 * en `global.css` (--shadow-1/2/3) para superficies construidas en CSS puro.
 */
export const elevation = {
  0: 'none',
  1: '0 1px 2px oklch(7% 0.006 95 / 0.05), 0 1px 1px oklch(7% 0.006 95 / 0.04)',
  2: '0 8px 22px -8px oklch(7% 0.006 95 / 0.16), 0 2px 6px -2px oklch(7% 0.006 95 / 0.08)',
  3: '0 24px 56px -14px oklch(7% 0.006 95 / 0.26), 0 8px 16px -6px oklch(7% 0.006 95 / 0.12)',
};

/** Escala de radios ("shape lock", Fase 1 · A). Un valor por rol de superficie. */
export const radius = {
  sm: 8, // botones, inputs, nav-item, celdas de calendario
  md: 12, // cards, contenedores de tabla, bloques ink
  lg: 16, // drawers, superficies flotantes grandes
  pill: 999, // badges, pills, selector de período
};

/** Escala tipográfica (Fase 1 · A). Sustituye los tamaños rem sueltos. */
export const type = {
  micro: '0.68rem', // etiquetas mono diminutas
  xs: '0.74rem', // metadatos secundarios
  sm: '0.8rem', // subtítulos, texto de apoyo
  base: '0.86rem', // cuerpo estándar de tabla/lista
  md: '0.92rem', // énfasis dentro de filas
  lg: '1.02rem', // títulos de card
  xl: '1.2rem', // subtítulos de sección
  display: '1.7rem', // títulos de pantalla (TopBar)
  displayLg: '2.6rem', // métricas hero (StatCard)
};

/**
 * Lenguaje de motion global (Fase 1 · I.2). Duraciones en ms; las curvas
 * espejan `--ease-out`/`--ease-in-out`/`--ease-emphasized`/`--ease-drawer`
 * de global.css — cambiar un valor implica cambiar ambos lugares.
 */
export const motion = {
  duration: {
    fast: 140, // press feedback, hover de botón
    base: 160, // hover de card, tooltip
    moderate: 220, // entrada de pantalla, modal
    slow: 300, // toast, drawer
  },
  ease: {
    out: 'cubic-bezier(0.23, 1, 0.32, 1)',
    inOut: 'cubic-bezier(0.77, 0, 0.175, 1)',
    emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)', // superficies flotantes (modal)
    drawer: 'cubic-bezier(0.32, 0.72, 0, 1)', // paneles laterales
  },
};
