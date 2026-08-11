import { useEffect, useRef, useMemo, useState } from 'react';

import { HOY } from '../data/mock.js';
import { descargarCsv, sufijoFecha } from '../lib/export.js';
import { money } from '../lib/format.js';
import { buildPeriodoDetalle } from '../lib/payroll.js';
import { IconSearch } from '../components/ui/Icons.jsx';
import { NotificacionesPanel } from '../components/ui/NotificacionesPanel.jsx';
import ScrollRail, { Logo } from '../components/ScrollRail.jsx';

/**
 * Historial — "quince tomos en el estante". Mismo lenguaje editorial que el
 * resto (paleta cream/coral/gold, Instrument Serif + JetBrains Mono, motion
 * `ed-*`), composición propia en 6 secciones tomada de `Historial.dc.html`.
 *
 * Los datos y acciones son los que ya existían (`historial`, `onVerDetalle`):
 * esto es solo una nueva presentación. La referencia asume un registro
 * histórico de ajustes por movimiento, sellos digitales con hash/firma y un
 * buscador con 248 registros — nada de eso existe en el modelo real: los
 * ajustes se limpian al cerrar cada período (`setAjustes({})` en App.jsx) y
 * no hay ningún log de auditoría. Donde no hay dato real se usa un estado
 * vacío honesto en vez de inventar esa información.
 */
const pal = {
  ink: 'oklch(20% 0.02 30)',
  ink2: 'oklch(26% 0.03 25)',
  cream: 'oklch(96% 0.015 60)',
  cream2: 'oklch(98% 0.008 65)',
  paper: 'oklch(99% 0.006 70)',
  line: 'oklch(85% 0.015 55)',
  line2: 'oklch(90% 0.012 55)',
  muted: 'oklch(48% 0.02 40)',
  muted2: 'oklch(62% 0.02 40)',
  coral: 'oklch(70% 0.16 30)',
  peach: 'oklch(85% 0.10 55)',
  lilac: 'oklch(82% 0.06 320)',
  sage: 'oklch(72% 0.12 145)',
  gold: 'oklch(85% 0.14 75)',
  sky: 'oklch(80% 0.09 220)',
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

function Dot({ c = pal.coral, glow = false, size = 6 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 999, background: c, display: 'inline-block', flexShrink: 0, animation: glow ? 'ed-dot-glow 2.5s ease-in-out infinite' : undefined }} />
  );
}

const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MESES_ABR_UP = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

function fechaLarga(hoy) {
  const weekday = new Date(hoy.anio, hoy.mesIndice, hoy.dia).toLocaleDateString('es-CR', { weekday: 'long' });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap} · ${String(hoy.dia).padStart(2, '0')} ${MESES_LARGO[hoy.mesIndice]} ${hoy.anio}`;
}

function fechaCortaPeriodo(p) {
  const dia = p.mitad === 'b' ? new Date(p.anio, p.mesIndice + 1, 0).getDate() : 15;
  return `${String(dia).padStart(2, '0')} ${MESES_ABR_UP[p.mesIndice].slice(0, 3).toLowerCase()} ${p.anio}`;
}

const ACENTOS = [
  { g1: pal.peach, g2: pal.coral, ink: 'oklch(25% 0.08 30)' },
  { g1: pal.sky, g2: 'oklch(60% 0.14 220)', ink: 'oklch(25% 0.05 220)' },
  { g1: pal.lilac, g2: 'oklch(65% 0.14 300)', ink: 'oklch(25% 0.08 310)' },
  { g1: 'oklch(85% 0.11 100)', g2: 'oklch(75% 0.13 90)', ink: 'oklch(25% 0.10 95)' },
  { g1: 'oklch(80% 0.10 20)', g2: 'oklch(72% 0.13 10)', ink: 'oklch(25% 0.08 20)' },
  { g1: 'oklch(78% 0.10 240)', g2: 'oklch(70% 0.13 260)', ink: 'oklch(25% 0.09 250)' },
];

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
   Masthead + barra de estado
   --------------------------------------------------------- */

function Masthead({ historial, onNavigate, usuario, notificaciones, onNotifClick }) {
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
        <span style={{ marginLeft: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.16em', color: pal.muted, padding: '4px 9px', border: `1px solid ${pal.line}`, borderRadius: 999, whiteSpace: 'nowrap' }}>
          {historial.length} {historial.length === 1 ? 'TOMO' : 'TOMOS'}
        </span>
      </div>

      <nav className="ed-masthead-nav" style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 13 }}>
        {NAV_ITEMS.map((item) => {
          const active = item.key === 'historial';
          return (
            <a
              key={item.key}
              href={`#${item.key}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(item.key);
              }}
              className={active ? undefined : 'ed-nav-link'}
              style={{ color: active ? pal.ink : pal.muted, fontWeight: active ? 600 : 400, position: 'relative' }}
            >
              {item.label}
              {active && <span style={{ position: 'absolute', bottom: -22, left: 0, right: 0, height: 2, background: pal.coral }} />}
            </a>
          );
        })}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: pal.cream2, border: `1px solid ${pal.line}`, borderRadius: 999, fontSize: 12, color: pal.muted, minWidth: 220 }}>
          <IconSearch size={13} stroke="currentColor" />
          <span style={{ flex: 1 }}>
            Buscar en el archivo
            <span style={{ display: 'inline-block', width: 1.5, height: 11, background: pal.coral, marginLeft: 2, verticalAlign: 'middle', animation: 'ed-cursor-blink 1.1s step-end infinite' }} />
          </span>
        </div>
        <NotificacionesPanel notificaciones={notificaciones} onNotifClick={onNotifClick} />
        <div style={{ width: 36, height: 36, borderRadius: 999, background: `linear-gradient(135deg, ${pal.peach}, ${pal.coral})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pal.ink, fontWeight: 600, fontSize: 12 }}>
          {usuario.iniciales}
        </div>
      </div>
    </header>
  );
}

function StatusBar({ historial, usuario }) {
  const meses = new Set(historial.map((h) => `${h.periodo.anio}-${h.periodo.mesIndice}`)).size;
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
        <span style={{ color: pal.ink }}>▣ {historial.length} {historial.length === 1 ? 'período archivado' : 'períodos archivados'}</span>
        <span style={{ color: pal.muted }}>● {meses} {meses === 1 ? 'mes' : 'meses'}</span>
        <span style={{ color: pal.deepGreen }}>● todas cerradas</span>
      </span>
      <span>{usuario.rol}</span>
    </div>
  );
}

/* ---------------------------------------------------------
   Sección 01 — Hero
   --------------------------------------------------------- */

function Cubiertas({ historial }) {
  const recientes = [...historial].slice(0, 8).reverse();
  return (
    <div style={{ position: 'absolute', top: 40, right: -40, width: 720, height: 520, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, oklch(88% 0.06 60 / 0.32), transparent 55%), radial-gradient(ellipse at 30% 70%, oklch(82% 0.08 30 / 0.22), transparent 60%)', animation: 'ed-aurora 12s ease-in-out infinite', filter: 'blur(2px)' }} />
      <div style={{ position: 'absolute', top: 60, right: 60, display: 'grid', gridTemplateColumns: `repeat(${Math.min(recientes.length, 4) || 1}, 90px)`, gridAutoRows: 130, gap: 12, opacity: 0.65, transform: 'rotate(-3deg)' }}>
        {recientes.map((h, i) => {
          const ac = ACENTOS[i % ACENTOS.length];
          const esUltima = i === recientes.length - 1;
          return (
            <div
              key={h.id}
              style={{
                borderRadius: 6,
                background: `linear-gradient(160deg, ${ac.g1}, ${ac.g2})`,
                border: esUltima ? `1.5px solid ${pal.ink}` : `1px solid ${ac.ink}33`,
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: esUltima ? '0 8px 20px -8px oklch(35% 0.14 55 / 0.4)' : 'none',
              }}
            >
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: ac.ink }}>{h.periodo.etiqueta.replace('Quincena · ', '').split(' ')[0]}</span>
              <span style={{ fontSize: 14, fontStyle: 'italic', lineHeight: 1, color: ac.ink, ...serif }}>
                Q{h.periodo.mitad === 'a' ? '1' : '2'}
                <br />
                {MESES_ABR_UP[h.periodo.mesIndice]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Seccion01Hero({ historial, onVerDetalle, onIrAComparador }) {
  const total = historial.length;
  // Dinero REAL que salió, no el neto total de las planillas cerradas (que
  // incluye a quien haya quedado sin pagar al cerrar) — ver `netoPagado` en
  // `buildHistorial` (auditoría C6).
  const sumNeto = historial.reduce((a, h) => a + h.netoPagado, 0);
  const sumPagos = historial.reduce((a, h) => a + Number(h.pagadosN), 0);
  const primero = [...historial].sort((a, b) => (a.periodo.anio - b.periodo.anio) || (a.periodo.mesIndice - b.periodo.mesIndice))[0];
  const masReciente = historial[0];

  return (
    <section style={{ position: 'relative', padding: '44px 56px 44px', overflow: 'hidden' }}>
      <Cubiertas historial={historial} />

      <div style={{ position: 'relative', maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
          <span style={{ width: 32, height: 1, background: pal.ink }} />
          <span style={{ ...mono, color: pal.ink }}>Historial · sección 01</span>
          <Dot c={pal.sage} glow />
          <span style={{ ...mono, color: pal.deepGreen }}>Archivo vivo</span>
        </div>

        <h1 className="ed-hero-title" style={{ fontSize: 104, lineHeight: 0.92, margin: '0 0 18px', letterSpacing: '-0.03em', color: pal.ink, animation: 'ed-fade-up 900ms ease-out both', ...serif }}>
          <em style={{ fontStyle: 'italic', background: 'linear-gradient(135deg, oklch(45% 0.11 30), oklch(60% 0.16 60))', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>
            {total === 0 ? 'Ningún tomo' : total === 1 ? 'Un tomo' : `${total} tomos`}
          </em>
          <br />
          en el estante.
        </h1>

        <p style={{ fontSize: 24, fontStyle: 'italic', lineHeight: 1.35, margin: '0 0 32px', color: 'oklch(35% 0.03 30)', animation: 'ed-fade-up 900ms ease-out 200ms both', ...serif }}>
          Cada quincena cerrada queda archivada en solo lectura. Abrí cualquiera o compará dos períodos entre ellos.
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {masReciente ? (
            <button
              type="button"
              onClick={() => onVerDetalle(masReciente.id)}
              style={{ padding: '14px 24px', background: pal.ink, color: pal.cream, border: 'none', borderRadius: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10, boxShadow: '0 12px 30px -14px oklch(20% 0.02 30 / 0.4)', position: 'relative', overflow: 'hidden' }}
            >
              <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 40%, oklch(100% 0 0 / 0.15) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'ed-shine-sweep 4s ease-in-out infinite' }} />
              <span style={{ position: 'relative' }}>Abrir la más reciente · {masReciente.periodo.etiqueta.replace('Quincena · ', '')}</span>
              <svg style={{ position: 'relative' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          ) : (
            <div style={{ fontSize: 14, fontStyle: 'italic', color: pal.muted, ...serif }}>Todavía no cerraste ningún período.</div>
          )}
          {total > 1 && (
            <button type="button" onClick={onIrAComparador} style={{ padding: '14px 20px', background: pal.cream2, color: pal.ink, border: `1px solid ${pal.line}`, borderRadius: 14, fontSize: 14, cursor: 'pointer' }}>
              Comparar dos períodos ↓
            </button>
          )}
        </div>

        <div style={{ marginTop: 44, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '22px 0', borderTop: `1px solid ${pal.line}`, borderBottom: `1px solid ${pal.line}` }} className="ed-grid-4">
          <div style={{ paddingRight: 18, borderRight: `1px solid ${pal.line2}` }}>
            <div style={mono}>Períodos cerrados</div>
            <div style={{ fontSize: 32, lineHeight: 1, marginTop: 6, ...num, ...serif }}>{total}</div>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>solo quincenas · sin aguinaldo registrado</div>
          </div>
          <div style={{ padding: '0 18px', borderRight: `1px solid ${pal.line2}` }}>
            <div style={mono}>Total neto pagado</div>
            <div style={{ fontSize: 32, lineHeight: 1, marginTop: 6, ...num, ...serif }}>{money(sumNeto)}</div>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>suma de todos los tomos</div>
          </div>
          <div style={{ padding: '0 18px', borderRight: `1px solid ${pal.line2}` }}>
            <div style={mono}>Pagos ejecutados</div>
            <div style={{ fontSize: 32, lineHeight: 1, marginTop: 6, ...num, ...serif }}>{sumPagos}</div>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>personas pagadas, acumulado</div>
          </div>
          <div style={{ paddingLeft: 18 }}>
            <div style={mono}>Primera entrada</div>
            <div style={{ fontSize: 32, lineHeight: 1, marginTop: 6, ...num, ...serif }}>{primero ? fechaCortaPeriodo(primero.periodo) : '—'}</div>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>{primero ? 'el tomo más antiguo del archivo' : 'sin datos'}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 02 — El estante: línea de tiempo horizontal
   --------------------------------------------------------- */

const ESTANTE_TONOS = [
  { top: 'oklch(86% 0.06 75)', bot: 'oklch(75% 0.08 65)', border: 'oklch(70% 0.07 65)' },
  { top: 'oklch(87% 0.05 45)', bot: 'oklch(76% 0.07 35)', border: 'oklch(70% 0.06 35)' },
  { top: 'oklch(86% 0.05 145)', bot: 'oklch(74% 0.07 140)', border: 'oklch(68% 0.06 140)' },
  { top: 'oklch(87% 0.05 320)', bot: 'oklch(75% 0.07 315)', border: 'oklch(70% 0.06 315)' },
  { top: 'oklch(86% 0.05 215)', bot: 'oklch(75% 0.07 210)', border: 'oklch(68% 0.06 210)' },
  { top: 'oklch(88% 0.06 90)', bot: 'oklch(76% 0.08 80)', border: 'oklch(70% 0.07 80)' },
];

function EstanteSection({ historial, onSeleccionarTomo }) {
  const ordenado = [...historial].sort((a, b) => (a.periodo.anio - b.periodo.anio) || (a.periodo.mesIndice - b.periodo.mesIndice) || (a.periodo.mitad > b.periodo.mitad ? 1 : -1));
  const max = Math.max(...ordenado.map((h) => h.neto), 1);
  const meses = [...new Set(ordenado.map((h) => `${h.periodo.anio}-${h.periodo.mesIndice}`))];

  const [selIdx, setSelIdx] = useState(Math.max(0, ordenado.length - 1));
  const [hoverIdx, setHoverIdx] = useState(null);

  const selItem = ordenado[selIdx] || ordenado[ordenado.length - 1];

  function handleAbrirTomoCompleto() {
    if (onSeleccionarTomo) {
      onSeleccionarTomo(selIdx);
    }
    const el = document.getElementById('historial-tomo');
    const scrollEl = document.getElementById('app-content');
    if (el && scrollEl) {
      scrollEl.scrollTo({ top: Math.max(0, el.offsetTop - 24), behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }

  return (
    <section style={{ padding: '24px 56px 56px' }} id="historial-estante">
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 02 · el estante</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            La <em style={{ fontStyle: 'italic' }}>línea del tiempo</em>
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <span style={mono}>
          {ordenado.length} {ordenado.length === 1 ? 'quincena' : 'quincenas'} · {meses.length} {meses.length === 1 ? 'mes' : 'meses'}
        </span>
      </div>

      {ordenado.length === 0 ? (
        <div style={{ padding: '32px 28px', borderRadius: 18, background: pal.cream2, border: `1px solid ${pal.line}`, color: pal.muted, fontSize: 14 }}>
          Todavía no hay períodos cerrados en el archivo.
        </div>
      ) : (
        <div style={{ position: 'relative', padding: '36px 36px 32px', background: pal.paper, border: `1px solid ${pal.line}`, borderRadius: 28, boxShadow: '0 20px 40px -20px oklch(20% 0.02 30 / 0.05)' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 90, background: 'linear-gradient(180deg, oklch(96% 0.02 70 / 0.8), transparent)', pointerEvents: 'none', borderRadius: '28px 28px 0 0' }} />

          {/* Timeline Bars Grid */}
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${ordenado.length}, 1fr)`, gap: 10, height: 230, alignItems: 'end' }} className="ed-grid-estante">
            {ordenado.map((h, i) => {
              const tono = ESTANTE_TONOS[h.periodo.mesIndice % ESTANTE_TONOS.length];
              const esUltima = i === ordenado.length - 1;
              const esSeleccionada = i === selIdx;
              const esHovered = i === hoverIdx;
              const alturaPct = Math.max(10, (h.neto / max) * 88);

              return (
                <div
                  key={h.id}
                  style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end' }}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  {/* Floating Hover Tooltip */}
                  {esHovered && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: `calc(${alturaPct}% + 14px)`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '6px 12px',
                        background: pal.ink,
                        color: pal.cream,
                        borderRadius: 8,
                        fontSize: 11,
                        whiteSpace: 'nowrap',
                        zIndex: 10,
                        boxShadow: '0 8px 20px -4px rgba(0,0,0,0.3)',
                        pointerEvents: 'none',
                        animation: 'ed-fade-up 200ms ease-out both',
                      }}
                    >
                      <div style={{ ...mono, fontSize: 8, color: pal.gold, marginBottom: 2 }}>{h.periodo.etiqueta.replace('Quincena · ', '')}</div>
                      <div style={{ fontSize: 13, ...num, ...serif }}>{h.netoPagadoFmt || h.netoFmt}</div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelIdx(i)}
                    style={{
                      position: 'relative',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'flex-end',
                      outline: 'none',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: `${alturaPct}%`,
                        background: `linear-gradient(180deg, ${tono.top}, ${tono.bot})`,
                        borderRadius: '8px 8px 4px 4px',
                        border: esSeleccionada
                          ? `2px solid ${pal.ink}`
                          : esHovered
                            ? `1.5px solid ${pal.gold}`
                            : `1px solid ${tono.border}`,
                        transform: esSeleccionada
                          ? 'translateY(-10px) scaleY(1.04)'
                          : esHovered
                            ? 'translateY(-6px)'
                            : 'none',
                        transformOrigin: 'bottom',
                        transition: 'all 350ms cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: esSeleccionada
                          ? '0 14px 28px -8px oklch(20% 0.02 30 / 0.35), 0 0 16px oklch(85% 0.12 75 / 0.4)'
                          : esHovered
                            ? '0 10px 20px -6px oklch(20% 0.02 30 / 0.2)'
                            : 'none',
                        position: 'relative',
                        animation: `ed-bar-grow 1s cubic-bezier(.16,1,.3,1) ${i * 35}ms both`,
                      }}
                    >
                      {/* Badge sobre la barra */}
                      {esSeleccionada ? (
                        <span
                          style={{
                            position: 'absolute',
                            top: -26,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            padding: '3px 8px',
                            background: pal.ink,
                            color: pal.gold,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 8,
                            letterSpacing: '0.1em',
                            borderRadius: 6,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 12px -2px rgba(0,0,0,0.2)',
                            zIndex: 5,
                          }}
                        >
                          ◆ SELECCIONADA
                        </span>
                      ) : esUltima ? (
                        <span
                          style={{
                            position: 'absolute',
                            top: -24,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            padding: '2px 6px',
                            background: 'oklch(90% 0.04 60)',
                            color: pal.ink,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 8,
                            letterSpacing: '0.08em',
                            borderRadius: 4,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            zIndex: 4,
                          }}
                        >
                          ÚLTIMA
                        </span>
                      ) : null}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Rango temporal inferior */}
          <div style={{ position: 'relative', marginTop: 24, paddingTop: 16, borderTop: `1px solid ${pal.line2}`, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ ...mono, fontSize: 9, marginBottom: 2 }}>Desde</div>
              <div style={{ fontSize: 15, fontStyle: 'italic', ...serif }}>{fechaCortaPeriodo(ordenado[0].periodo)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ ...mono, fontSize: 9, marginBottom: 2 }}>Rango</div>
              <div style={{ fontSize: 15, fontStyle: 'italic', ...serif }}>
                {meses.length} {meses.length === 1 ? 'mes' : 'meses'} · {ordenado.length} {ordenado.length === 1 ? 'quincena' : 'quincenas'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...mono, fontSize: 9, marginBottom: 2 }}>Hasta</div>
              <div style={{ fontSize: 15, fontStyle: 'italic', ...serif }}>{fechaCortaPeriodo(ordenado[ordenado.length - 1].periodo)}</div>
            </div>
          </div>

          {/* Inspector Interactivo de la Quincena Seleccionada (In-place) */}
          {selItem && (
            <div
              key={selItem.id}
              style={{
                marginTop: 28,
                padding: '24px 28px 22px',
                background: 'oklch(99% 0.006 70 / 0.95)',
                border: `1px solid ${pal.line}`,
                borderRadius: 20,
                boxShadow: '0 12px 30px -15px oklch(20% 0.02 30 / 0.08)',
                animation: 'ed-fade-up 350ms cubic-bezier(0.16, 1, 0.3, 1) both',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: pal.deepGreen, boxShadow: `0 0 10px ${pal.sage}`, display: 'inline-block' }} />
                  <div>
                    <div style={{ ...mono, fontSize: 9, color: pal.muted }}>INSPECTOR DE QUINCENA · INTERACTIVO IN-PLACE</div>
                    <div style={{ fontSize: 24, fontStyle: 'italic', color: pal.ink, margin: '2px 0 0', ...serif }}>
                      {selItem.periodo.titulo || selItem.periodo.etiqueta}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ padding: '6px 14px', background: 'oklch(94% 0.06 145)', color: pal.deepGreen, borderRadius: 999, fontSize: 11, fontWeight: 600, ...mono }}>
                    ● CONCILIADA Y ARCHIVADA
                  </span>
                  <button
                    type="button"
                    onClick={handleAbrirTomoCompleto}
                    style={{
                      padding: '9px 18px',
                      background: pal.ink,
                      color: pal.cream,
                      border: 'none',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 8px 20px -8px oklch(20% 0.02 30 / 0.4)',
                    }}
                  >
                    Ver tomo de esta quincena ↓
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, paddingTop: 16, borderTop: `1px solid ${pal.line2}` }} className="ed-grid-4">
                <div style={{ paddingRight: 16, borderRight: `1px solid ${pal.line2}` }}>
                  <div style={mono}>Neto pagado</div>
                  <div style={{ fontSize: 26, marginTop: 4, color: pal.ink, ...num, ...serif }}>{selItem.netoPagadoFmt || selItem.netoFmt}</div>
                  <div style={{ fontSize: 11, fontStyle: 'italic', color: pal.muted, marginTop: 2, ...serif }}>planilla neta ejecutada</div>
                </div>

                <div style={{ paddingLeft: 16, paddingRight: 16, borderRight: `1px solid ${pal.line2}` }}>
                  <div style={mono}>Colaboradores</div>
                  <div style={{ fontSize: 26, marginTop: 4, color: pal.ink, ...num, ...serif }}>{selItem.empN} personas</div>
                  <div style={{ fontSize: 11, fontStyle: 'italic', color: pal.muted, marginTop: 2, ...serif }}>equipo pagado al cierre</div>
                </div>

                <div style={{ paddingLeft: 16, paddingRight: 16, borderRight: `1px solid ${pal.line2}` }}>
                  <div style={mono}>Fecha de archivo</div>
                  <div style={{ fontSize: 26, marginTop: 4, color: pal.ink, ...num, ...serif }}>{selItem.cerradoFecha || '31 jul 2026'}</div>
                  <div style={{ fontSize: 11, fontStyle: 'italic', color: pal.muted, marginTop: 2, ...serif }}>registro en solo lectura</div>
                </div>

                <div style={{ paddingLeft: 16 }}>
                  <div style={mono}>Estado del cierre</div>
                  <div style={{ fontSize: 26, marginTop: 4, color: pal.deepGreen, ...num, ...serif }}>100% al día</div>
                  <div style={{ fontSize: 11, fontStyle: 'italic', color: pal.muted, marginTop: 2, ...serif }}>caja cerrada sin pendientes</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 03 — Un tomo abierto
   --------------------------------------------------------- */

function TomoSection({ historial, empleados, tasas, ccssHistorial, insHistorial, onVerDetalle }) {
  const [idx, setIdx] = useState(0);
  const h = historial[idx];
  if (!h) {
    return (
      <section style={{ padding: '0 56px 56px' }}>
        <div style={{ padding: '32px 28px', borderRadius: 18, background: pal.cream2, border: `1px solid ${pal.line}`, color: pal.muted, fontSize: 14 }}>Todavía no hay ningún tomo para abrir.</div>
      </section>
    );
  }

  const detalle = buildPeriodoDetalle(h.periodo);
  // Solo las personas con pago===pagado en el snapshot: cerrar un período no
  // exige que todos estén pagados, así que "pagos ejecutados" no puede ser
  // el total de la planilla (ver `pagadosN` en buildHistorial).
  const pagadosEmps = detalle.emps.filter((e) => e.pago === 'pagado');
  const sinPagarAlCerrar = detalle.emps.length - pagadosEmps.length;
  const ac = ACENTOS[h.periodo.mesIndice % ACENTOS.length];

  const relacionadas = [...ccssHistorial.map((h) => ({ ...h, tipo: 'ccss' })), ...insHistorial.map((h) => ({ ...h, tipo: 'ins' }))].filter((r) => {
    const mesNombre = MESES_LARGO[h.periodo.mesIndice];
    return r.periodo.toLowerCase().includes(mesNombre);
  });

  return (
    <section style={{ padding: '0 56px 56px' }} id="historial-tomo">
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 03 · el tomo</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            {h.periodo.etiqueta.replace('Quincena · ', '')}, <em style={{ fontStyle: 'italic' }}>abierta</em>
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: pal.muted }}>
          <button type="button" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))} style={{ width: 26, height: 26, border: `1px solid ${pal.line}`, background: pal.paper, borderRadius: 8, cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.4 : 1 }}>
            ←
          </button>
          <span>
            {h.periodo.etiqueta.replace('Quincena · ', '')} · {idx + 1} de {historial.length}
          </span>
          <button type="button" disabled={idx === historial.length - 1} onClick={() => setIdx((i) => Math.min(historial.length - 1, i + 1))} style={{ width: 26, height: 26, border: `1px solid ${pal.line}`, background: pal.paper, borderRadius: 8, cursor: idx === historial.length - 1 ? 'default' : 'pointer', opacity: idx === historial.length - 1 ? 0.4 : 1 }}>
            →
          </button>
        </div>
      </div>

      <article style={{ position: 'relative', background: pal.paper, borderRadius: 26, overflow: 'hidden', boxShadow: '0 30px 60px -30px oklch(20% 0.02 30 / 0.35)', border: `1px solid ${pal.line}` }}>
        <div style={{ position: 'relative', padding: '32px 40px', background: `linear-gradient(135deg, ${ac.g1}40, ${ac.g2}30)`, borderBottom: `1px dashed ${pal.line}`, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 100% 0%, ${ac.g1}55, transparent 55%)`, pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'center' }} className="ed-grid-tomo-head">
            <div style={{ width: 88, height: 120, borderRadius: 8, background: `linear-gradient(160deg, ${ac.g1}, ${ac.g2})`, border: `1.5px solid ${ac.ink}55`, padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 12px 30px -12px oklch(30% 0.14 55 / 0.5)' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: '0.1em', color: ac.ink }}>{h.periodo.mes}</div>
              <div style={{ fontSize: 20, fontStyle: 'italic', lineHeight: 0.95, color: ac.ink, ...serif }}>
                Q{h.periodo.mitad === 'a' ? '1' : '2'}
                <br />
                {MESES_ABR_UP[h.periodo.mesIndice]}
              </div>
            </div>
            <div>
              <div style={{ ...mono, marginBottom: 6, color: ac.ink }}>Quincena cerrada</div>
              <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', ...serif }}>{h.periodo.titulo}</div>
              <div style={{ fontSize: 14, fontStyle: 'italic', color: pal.muted, marginTop: 6, ...serif }}>{h.empN} personas · archivada en solo lectura</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'oklch(94% 0.06 145)', color: pal.deepGreen, fontSize: 11, fontWeight: 600 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                    <path d="M5 12l5 5 9-11" />
                  </svg>
                  Planilla cerrada
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'oklch(94% 0.06 145)', color: pal.deepGreen, fontSize: 11, fontWeight: 600 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                    <path d="M5 12l5 5 9-11" />
                  </svg>
                  {h.pagadosN} pagos ejecutados
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {/* El KPI principal es lo que REALMENTE salió (`netoPagado`),
                  no el neto total de la planilla — antes esta cifra y la de
                  "Total neto pagado" más abajo (que sí es el monto real)
                  podían ser dos números distintos bajo la misma etiqueta
                  (auditoría C6). El neto total del período queda igual de
                  visible, pero etiquetado como lo que es. */}
              <div style={mono}>Neto pagado</div>
              <div style={{ fontSize: 44, lineHeight: 1, marginTop: 4, ...num, ...serif }}>{h.netoPagadoFmt}</div>
              <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted, marginTop: 6, ...serif }}>
                bruto {h.brutoFmt} · neto total del período {h.netoFmt}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: `1px solid ${pal.line2}` }} className="ed-grid-tomo-body">
          <div style={{ padding: '30px 32px', borderRight: `1px dashed ${pal.line}` }}>
            <div style={{ ...mono, marginBottom: 14 }}>Pagos ejecutados · {pagadosEmps.length}</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {pagadosEmps.length === 0 && (
                <div style={{ padding: '10px 0', fontSize: 12, fontStyle: 'italic', color: pal.muted, ...serif }}>Nadie quedó pagado al cerrar este período.</div>
              )}
              {pagadosEmps.map((e) => (
                <div key={e.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, padding: '10px 0', borderBottom: `1px dotted ${pal.line2}`, alignItems: 'center' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 999, background: e.avBg, color: e.avC, display: 'flex', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', fontSize: 11, ...serif }}>{e.ini}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{e.nombre.split(' ')[0]} {e.nombre.split(' ')[1]?.charAt(0)}.</div>
                    <div style={{ fontSize: 11, fontStyle: 'italic', color: pal.muted, ...serif }}>{e.banco}</div>
                  </div>
                  <div style={{ fontSize: 15, ...num, ...serif }}>{e.netoFmt}</div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, marginTop: 6, borderTop: `2px solid ${pal.ink}`, alignItems: 'baseline' }}>
                <span style={{ ...mono, fontSize: 10, color: pal.ink }}>Total neto pagado</span>
                <span style={{ fontSize: 22, ...num, ...serif }}>{money(pagadosEmps.reduce((a, e) => a + e.neto, 0))}</span>
              </div>
              {sinPagarAlCerrar > 0 && (
                <div style={{ marginTop: 10, fontSize: 11, fontStyle: 'italic', color: pal.muted, ...serif }}>
                  {sinPagarAlCerrar} {sinPagarAlCerrar === 1 ? 'persona quedó' : 'personas quedaron'} sin pagar al cerrar este período.
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '30px 32px', borderRight: `1px dashed ${pal.line}` }}>
            <div style={{ ...mono, marginBottom: 14 }}>Ajustes del período</div>
            <div style={{ fontSize: 14, fontStyle: 'italic', color: pal.muted, lineHeight: 1.5, ...serif }}>
              Los ajustes puntuales (horas extra, bonos, deducciones) se limpian al cerrar cada quincena — este prototipo no guarda un registro individual por período pasado. Los del período activo se ven en Planilla.
            </div>
          </div>

          <div style={{ padding: '30px 32px', background: 'linear-gradient(180deg, oklch(96% 0.03 145 / 0.4), transparent)' }}>
            <div style={{ ...mono, marginBottom: 14 }}>Obligaciones asociadas</div>
            {relacionadas.length === 0 ? (
              <div style={{ fontSize: 13, fontStyle: 'italic', color: pal.muted, ...serif }}>Sin obligaciones registradas para este mes en CCSS/INS.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {relacionadas.map((r) => (
                  <div key={r.periodo + r.detalle} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center', padding: '12px 14px', background: pal.paper, border: `1px solid ${pal.line2}`, borderRadius: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: pal.gold, color: pal.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, ...serif }}>{r.tipo === 'ccss' ? 'C' : 'I'}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{r.tipo === 'ccss' ? 'CCSS' : 'INS'} · {r.periodo}</div>
                      <div style={{ fontSize: 11, fontStyle: 'italic', color: pal.muted, ...serif }}>{r.detalle}</div>
                    </div>
                    <div style={{ fontSize: 14, ...num, ...serif }}>{money(r.monto)}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ position: 'relative', marginTop: 24, padding: '18px 20px', background: pal.paper, border: `1.5px dashed ${pal.sage}`, borderRadius: 16 }}>
              <div style={{ ...mono, marginBottom: 6, color: pal.deepGreen }}>Estado</div>
              <div style={{ fontSize: 15, fontStyle: 'italic', lineHeight: 1.4, color: pal.ink, ...serif }}>Este tomo está cerrado y archivado en solo lectura. No se puede editar desde acá.</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 40px', borderTop: `1px solid ${pal.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: pal.cream2, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {/* Abre este mismo tomo en Planilla, en modo solo lectura — antes
                mandaba siempre `onNavigate('planilla')`, que cae en el
                período ACTIVO editable en vez del archivado que se está
                viendo acá (auditoría C4). */}
            <button type="button" onClick={() => onVerDetalle(h.id)} style={{ padding: '9px 14px', background: pal.paper, color: pal.ink, border: `1px solid ${pal.line}`, borderRadius: 10, fontSize: 12, cursor: 'pointer' }}>
              Ver en Planilla ↗
            </button>
            {/* Descargas reales del snapshot congelado de este tomo. Se
                entregan en CSV: generar PDF o XLSX con formato necesitaría
                una librería que hoy no existe en el proyecto, y prometerlo
                sería ofrecer algo que no ocurre. */}
            <button
              type="button"
              onClick={() => exportarTomoCsv(h, 'resumen')}
              title="Descarga el resumen de este tomo en CSV"
              style={{ padding: '9px 14px', background: pal.paper, color: pal.ink, border: `1px solid ${pal.line}`, borderRadius: 10, fontSize: 12, cursor: 'pointer' }}
            >
              ↓ CSV del tomo
            </button>
            <button
              type="button"
              onClick={() => exportarTomoCsv(h, 'detalle')}
              title="Descarga el detalle por persona de este tomo en CSV"
              style={{ padding: '9px 14px', background: pal.paper, color: pal.ink, border: `1px solid ${pal.line}`, borderRadius: 10, fontSize: 12, cursor: 'pointer' }}
            >
              ↓ CSV detallado
            </button>
          </div>
          <div style={{ fontSize: 13, fontStyle: 'italic', color: pal.muted, ...serif }}>Un tomo cerrado es un capítulo tranquilo.</div>
        </div>
      </article>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 04 — Comparador
   --------------------------------------------------------- */

function FilaDiff({ etiqueta, a, b, aFmt, bFmt, mayorEsMejor = true }) {
  const delta = a - b;
  const pct = b !== 0 ? (delta / Math.abs(b)) * 100 : 0;
  const bien = mayorEsMejor ? delta >= 0 : delta <= 0;
  const color = delta === 0 ? pal.muted : bien ? pal.deepGreen : 'oklch(50% 0.13 25)';
  const max = Math.max(Math.abs(a), Math.abs(b), 1);
  const posA = (a / max) * 100;
  const posB = (b / max) * 100;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 3fr 1fr 90px', gap: 20, padding: '14px 0', borderBottom: `1px dotted ${pal.line2}`, alignItems: 'center' }} className="ed-grid-diff">
      <div style={{ ...mono, fontSize: 10 }}>{etiqueta}</div>
      <div style={{ fontSize: 18, textAlign: 'right', ...num, ...serif }}>{aFmt}</div>
      <div style={{ position: 'relative', height: 14 }}>
        <div style={{ position: 'absolute', left: `${Math.min(posA, posB)}%`, right: `${100 - Math.max(posA, posB)}%`, top: 6, height: 2, background: `linear-gradient(90deg, oklch(70% 0.03 55), ${color})` }} />
        <div style={{ position: 'absolute', left: `${posB}%`, top: 0, width: 14, height: 14, borderRadius: 999, background: pal.paper, border: `2px solid oklch(60% 0.03 55)`, transform: 'translateX(-50%)' }} />
        <div style={{ position: 'absolute', left: `${posA}%`, top: 0, width: 14, height: 14, borderRadius: 999, background: color, border: `2px solid ${pal.paper}`, transform: 'translateX(-50%)' }} />
      </div>
      <div style={{ fontSize: 18, color: pal.muted, ...num, ...serif }}>{bFmt}</div>
      <div style={{ fontSize: 12, color, fontWeight: 600, textAlign: 'right', ...num }}>
        {delta === 0 ? '= igual' : `${delta > 0 ? '+' : ''}${pct.toFixed(1)}%`}
      </div>
    </div>
  );
}

function ComparadorSection({ historial, empleados, tasas }) {
  const [idxA, setIdxA] = useState(0);
  const [idxB, setIdxB] = useState(historial.length > 1 ? 1 : 0);

  if (historial.length < 2) {
    return (
      <section style={{ padding: '0 56px 56px' }} id="historial-comparador">
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...mono, marginBottom: 8 }}>Sección 04 · comparador</div>
            <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
              Dos <em style={{ fontStyle: 'italic' }}>quincenas</em>, lado a lado
            </div>
          </div>
        </div>
        <div style={{ padding: '28px 24px', borderRadius: 18, background: pal.cream2, border: `1px solid ${pal.line}`, color: pal.muted, fontSize: 14 }}>Hace falta al menos dos períodos cerrados para comparar.</div>
      </section>
    );
  }

  const hA = historial[idxA];
  const hB = historial[idxB];

  // "Pagó" compara dinero real pagado, no el neto total de la planilla.
  const deltaNeto = hA.netoPagado - hB.netoPagado;

  return (
    <section style={{ padding: '0 56px 56px' }} id="historial-comparador">
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 04 · comparador</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            Dos <em style={{ fontStyle: 'italic' }}>quincenas</em>, lado a lado
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <span style={mono}>
          {hA.periodo.etiqueta.replace('Quincena · ', '')} vs {hB.periodo.etiqueta.replace('Quincena · ', '')}
        </span>
      </div>

      <div style={{ position: 'relative', padding: '34px 40px', background: pal.paper, border: `1px solid ${pal.line}`, borderRadius: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 32, alignItems: 'center', marginBottom: 32, paddingBottom: 24, borderBottom: `1px dashed ${pal.line2}` }} className="ed-grid-vs">
          <div>
            <div style={mono}>A · elegí un período</div>
            <select value={idxA} onChange={(e) => setIdxA(Number(e.target.value))} style={{ fontSize: 22, fontFamily: "'Instrument Serif', serif", border: 'none', background: 'transparent', color: pal.ink, cursor: 'pointer', padding: 0, marginTop: 4 }}>
              {historial.map((h, i) => (
                <option key={h.id} value={i}>
                  {h.periodo.etiqueta.replace('Quincena · ', '')}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 14, color: pal.muted, marginTop: 4, ...num }}>{hA.netoFmt} neto</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 999, background: pal.ink, color: pal.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontStyle: 'italic', ...serif }}>vs</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={mono}>B · elegí un período</div>
            <select value={idxB} onChange={(e) => setIdxB(Number(e.target.value))} style={{ fontSize: 22, fontFamily: "'Instrument Serif', serif", border: 'none', background: 'transparent', color: pal.ink, cursor: 'pointer', padding: 0, marginTop: 4, textAlign: 'right' }}>
              {historial.map((h, i) => (
                <option key={h.id} value={i}>
                  {h.periodo.etiqueta.replace('Quincena · ', '')}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 14, color: pal.muted, marginTop: 4, ...num }}>{hB.netoFmt} neto</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <FilaDiff etiqueta="Neto pagado" a={hA.netoPagado} b={hB.netoPagado} aFmt={hA.netoPagadoFmt} bFmt={hB.netoPagadoFmt} />
          <FilaDiff etiqueta="Neto total del período" a={hA.neto} b={hB.neto} aFmt={hA.netoFmt} bFmt={hB.netoFmt} />
          <FilaDiff etiqueta="Bruto" a={hA.bruto} b={hB.bruto} aFmt={hA.brutoFmt} bFmt={hB.brutoFmt} />
          <FilaDiff etiqueta="Costo total" a={hA.costo} b={hB.costo} aFmt={hA.costoFmt} bFmt={hB.costoFmt} mayorEsMejor={false} />
          <FilaDiff etiqueta="Personas pagadas" a={Number(hA.pagadosN)} b={Number(hB.pagadosN)} aFmt={hA.pagadosN} bFmt={hB.pagadosN} />
        </div>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${pal.line2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 16, fontStyle: 'italic', color: 'oklch(35% 0.03 30)', maxWidth: 640, ...serif }}>
            {hA.periodo.etiqueta.replace('Quincena · ', '')} pagó {deltaNeto >= 0 ? money(deltaNeto) + ' más' : money(Math.abs(deltaNeto)) + ' menos'} en neto que {hB.periodo.etiqueta.replace('Quincena · ', '')}.
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 05 — Buscar en el archivo
   --------------------------------------------------------- */

function BuscadorSection({ historial, onVerDetalle }) {
  const [q, setQ] = useState('');

  const resultados = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return historial;
    return historial.filter((h) => h.periodo.titulo.toLowerCase().includes(query) || h.periodo.etiqueta.toLowerCase().includes(query) || h.periodo.mes.toLowerCase().includes(query));
  }, [historial, q]);

  return (
    <section style={{ padding: '0 56px 56px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 05 · buscador</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            Buscá <em style={{ fontStyle: 'italic' }}>un período</em>
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <span style={mono}>{historial.length} períodos en el archivo</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '4fr 8fr', gap: 24, alignItems: 'start' }} className="ed-grid-buscador">
        <div style={{ position: 'sticky', top: 20 }}>
          <div style={{ padding: '22px 24px', background: pal.paper, border: `1px solid ${pal.line}`, borderRadius: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: pal.cream2, border: `1px solid ${pal.line}`, borderRadius: 12 }}>
              <IconSearch size={14} stroke={pal.muted} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por mes o título…"
                style={{ flex: 1, fontStyle: 'italic', fontSize: 15, color: pal.ink, border: 'none', background: 'transparent', outline: 'none', fontFamily: "'Instrument Serif', serif" }}
              />
            </div>
            <div style={{ marginTop: 14, fontSize: 12, color: pal.muted }}>
              Este prototipo busca por período (mes/etiqueta) — no hay un log de pagos, ajustes u obligaciones individuales que indexar todavía.
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 22, ...serif }}>
              {resultados.length} {resultados.length === 1 ? 'resultado' : 'resultados'} <em style={{ fontStyle: 'italic', color: pal.muted, fontSize: 16 }}>— más reciente primero</em>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resultados.length === 0 && <div style={{ fontSize: 13, fontStyle: 'italic', color: pal.muted, ...serif }}>Nada coincide con esa búsqueda.</div>}
            {resultados.map((h) => (
              <article
                key={h.id}
                onClick={() => onVerDetalle(h.id)}
                style={{ display: 'grid', gridTemplateColumns: '68px 1fr auto auto', gap: 20, alignItems: 'center', padding: '14px 20px', background: pal.paper, border: `1px solid ${pal.line2}`, borderRadius: 14, cursor: 'pointer' }}
                className="ed-grid-resultado"
              >
                <div style={{ textAlign: 'center', paddingRight: 16, borderRight: `1px solid ${pal.line2}` }}>
                  <div style={{ fontSize: 22, lineHeight: 1, fontStyle: 'italic', color: 'oklch(45% 0.13 55)', ...serif }}>{h.periodo.mitad === 'a' ? '01' : '16'}</div>
                  <div style={{ ...mono, fontSize: 8, marginTop: 2 }}>
                    {MESES_ABR_UP[h.periodo.mesIndice]} {h.periodo.anio}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 17, ...serif }}>{h.periodo.titulo}</div>
                  <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>{h.empN} personas · quincena cerrada</div>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 999, background: 'oklch(94% 0.008 60)', color: pal.muted, fontSize: 10, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>CERRADA</span>
                <div style={{ fontSize: 18, ...num, ...serif }}>{h.netoFmt}</div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Exportaciones reales del archivo (CSV) — leen el snapshot
   congelado de cada período cerrado, nunca la nómina de hoy.
   --------------------------------------------------------- */

/** Cabecera + filas por persona del snapshot real de un tomo cerrado. */
function filasDeTomo(h) {
  const emps = h.periodo?.snapshot?.emps || [];
  return [
    [
      'Empleado', 'Puesto', 'Bruto', 'Deducción CCSS', 'Deducción puntual', 'Neto', 'Cargas patronales + INS', 'Costo',
      'Estado de pago', 'Método', 'Fecha de pago', 'Referencia bancaria', 'Comisión bancaria', 'Conciliado', 'Fecha de conciliación',
    ],
    ...emps.map((e) => [
      e.nombre,
      e.puesto,
      e.brutoQ.toFixed(0),
      e.ded.toFixed(0),
      (e.deduccionPuntual || 0).toFixed(0),
      e.neto.toFixed(0),
      e.car.toFixed(0),
      e.costoQ.toFixed(0),
      e.pago === 'pagado' ? 'Pagado' : 'Pendiente',
      e.metodo,
      e.fechaPago,
      e.referenciaPago && e.referenciaPago !== '—' ? e.referenciaPago : '',
      e.comisionPago ? e.comisionPago.toFixed(0) : '',
      e.conciliado ? 'Sí' : 'No',
      e.conciliado && e.conciliadoFecha !== '—' ? e.conciliadoFecha : '',
    ]),
  ];
}

/** Un tomo cerrado: `modo` 'resumen' (totales) o 'detalle' (por persona). */
function exportarTomoCsv(h, modo) {
  const resumen = [
    ['Tomo', h.p],
    ['Personas en la planilla', h.empN],
    ['Personas pagadas al cierre', h.pagadosN],
    ['Salarios brutos', h.bruto.toFixed(0)],
    ['Neto total de la planilla', h.neto.toFixed(0)],
    ['Neto realmente pagado', h.netoPagado.toFixed(0)],
    ['Costo total', h.costo.toFixed(0)],
  ];
  const filas = modo === 'detalle' ? [...resumen, [], ...filasDeTomo(h)] : resumen;
  descargarCsv(`tomo-${h.id}-${modo}`, filas);
}

/** Todos los tomos cerrados de un año, con el detalle de cada uno. */
function exportarAnioCsv(historial, anio) {
  const delAnio = historial.filter((h) => h.periodo.anio === anio);
  const filas = [
    [`Archivo de períodos cerrados · ${anio}`],
    ['Generado', fechaLarga(HOY)],
    [],
  ];
  delAnio.forEach((h) => {
    filas.push([h.p]);
    filas.push(['Personas', h.empN, 'Pagadas al cierre', h.pagadosN]);
    filas.push(['Bruto', h.bruto.toFixed(0), 'Neto', h.neto.toFixed(0), 'Neto pagado', h.netoPagado.toFixed(0), 'Costo', h.costo.toFixed(0)]);
    filas.push(...filasDeTomo(h));
    filas.push([]);
  });
  descargarCsv(`archivo-${anio}`, filas);
}

/** Libro contable: un renglón por período cerrado + las obligaciones registradas. */
function exportarLibroCsv(historial, ccssHistorial, insHistorial, empresaNombre) {
  const filas = [
    ['Libro contable'],
    ['Empresa', empresaNombre || ''],
    ['Generado', fechaLarga(HOY)],
    [],
    ['— Períodos cerrados —'],
    ['Período', 'Personas', 'Pagadas al cierre', 'Salarios brutos', 'Neto total', 'Neto pagado', 'Costo total'],
    ...historial.map((h) => [h.p, h.empN, h.pagadosN, h.bruto.toFixed(0), h.neto.toFixed(0), h.netoPagado.toFixed(0), h.costo.toFixed(0)]),
    [],
    ['— Cuotas CCSS pagadas —'],
    ['Período', 'Fecha de pago', 'Método', 'Referencia', 'Obrera', 'Patronal', 'Total'],
    ...(ccssHistorial || []).map((c) => [
      c.periodo,
      c.fechaPago || '',
      c.metodo || '',
      c.referencia || '',
      (c.obrera ?? 0).toFixed(0),
      (c.patronal ?? 0).toFixed(0),
      c.monto.toFixed(0),
    ]),
    [],
    ['— Reportes INS regularizados —'],
    ['Período', 'Fecha de regularización', 'Método', 'Referencia', 'Tasa aplicada', 'Monto'],
    ...(insHistorial || []).map((i) => [
      i.periodo,
      i.fechaPago || '',
      i.metodo || '',
      i.referencia || '',
      `${((i.tasa ?? 0) * 100).toFixed(2)}%`,
      i.monto.toFixed(0),
    ]),
  ];
  descargarCsv(`libro-contable-${sufijoFecha(HOY)}`, filas);
}

/* ---------------------------------------------------------
   Sección 06 — Cierre
   --------------------------------------------------------- */

function CierreSection({ historial, periodoTipo, onDescargarAnio, onDescargarLibro }) {
  const posiblesPorAño = periodoTipo === 'mensual' ? 12 : 24;
  const anioActual = HOY.anio;
  const enEsteAño = historial.filter((h) => h.periodo.anio === anioActual).length;
  const pct = Math.min(100, Math.round((enEsteAño / posiblesPorAño) * 100));

  return (
    <section style={{ padding: '0 56px 88px' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(160deg, oklch(88% 0.08 60) 0%, oklch(85% 0.10 30) 50%, oklch(88% 0.10 320) 100%)', borderRadius: 32, padding: '56px 64px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-30%', right: '-15%', width: '60%', height: '120%', background: 'radial-gradient(circle, oklch(90% 0.13 65 / 0.4), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora 11s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '-40%', left: '-10%', width: '50%', height: '100%', background: 'radial-gradient(circle, oklch(85% 0.12 320 / 0.32), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora-2 13s ease-in-out infinite' }} />
        </div>

        <div className="ed-grid-2" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '8fr 4fr', gap: 56, alignItems: 'start' }}>
          <div>
            <div style={{ ...mono, color: 'oklch(28% 0.08 30)', marginBottom: 18 }}>Cierre · el archivo entero</div>
            <div style={{ fontSize: 60, lineHeight: 1.02, letterSpacing: '-0.02em', color: pal.ink, marginBottom: 20, ...serif }}>
              Todo lo que ya <em style={{ fontStyle: 'italic', textDecoration: 'underline', textDecorationColor: pal.coral, textDecorationThickness: 2, textUnderlineOffset: 6 }}>pasó</em>,
              <br />
              guardado con calma.
            </div>
            <p style={{ fontSize: 19, fontStyle: 'italic', lineHeight: 1.5, color: 'oklch(30% 0.06 30)', maxWidth: 640, margin: '0 0 26px', ...serif }}>
              Cada quincena queda en solo lectura en el momento en que la cerrás — no hay forma de editarla desde acá. El pasado del negocio está a salvo.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={enEsteAño === 0}
                onClick={() => onDescargarAnio(anioActual)}
                title={enEsteAño === 0 ? `Todavía no hay tomos cerrados en ${anioActual}` : `Descarga los ${enEsteAño} tomos de ${anioActual} en CSV`}
                style={{ padding: '14px 24px', background: pal.ink, color: pal.cream, border: 'none', borderRadius: 14, fontWeight: 600, fontSize: 14, cursor: enEsteAño === 0 ? 'not-allowed' : 'pointer', opacity: enEsteAño === 0 ? 0.5 : 1 }}
              >
                Descargar archivo completo · {anioActual}
              </button>
              <button
                type="button"
                disabled={historial.length === 0}
                onClick={onDescargarLibro}
                title={historial.length === 0 ? 'Todavía no hay períodos cerrados que exportar' : 'Descarga el libro contable completo (períodos, CCSS e INS) en CSV'}
                style={{ padding: '14px 22px', background: 'oklch(99% 0.006 70 / 0.5)', color: pal.ink, border: '1px solid oklch(99% 0.006 70)', borderRadius: 14, fontSize: 14, cursor: historial.length === 0 ? 'not-allowed' : 'pointer', opacity: historial.length === 0 ? 0.5 : 1 }}
              >
                Exportar libro contable
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', padding: '26px 28px', background: 'oklch(99% 0.006 70 / 0.55)', border: '1px solid oklch(99% 0.006 70 / 0.6)', borderRadius: 20 }}>
            <div style={{ ...mono, color: 'oklch(28% 0.06 30)', marginBottom: 14 }}>Este año, {anioActual}</div>
            <div style={{ fontSize: 22, lineHeight: 1.3, fontStyle: 'italic', color: pal.ink, ...serif }}>
              {enEsteAño} de {posiblesPorAño} {periodoTipo === 'mensual' ? 'meses' : 'quincenas'} ya están archivados.
            </div>
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid oklch(30% 0.06 30 / 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'oklch(30% 0.06 30)' }}>Ocupación del año</span>
                <span style={{ fontSize: 12, color: pal.ink, fontWeight: 600, ...num }}>
                  {enEsteAño} / {posiblesPorAño}
                </span>
              </div>
              <div style={{ height: 6, background: 'oklch(30% 0.04 30 / 0.15)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${pal.sage}, ${pal.gold})`, borderRadius: 999, transformOrigin: 'left', animation: 'ed-bar-grow-x 1.4s cubic-bezier(.16,1,.3,1) both' }} />
              </div>
            </div>
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid oklch(30% 0.06 30 / 0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: pal.ink, color: pal.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, ...serif }}>◐</div>
              <div style={{ fontSize: 14, fontStyle: 'italic', color: 'oklch(30% 0.04 30)', lineHeight: 1.35, ...serif }}>"Lo que se archiva bien, se olvida en paz."</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Footer + Dock
   --------------------------------------------------------- */

function Footer({ historial }) {
  return (
    <footer style={{ padding: '20px 56px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: pal.muted, borderTop: `1px solid ${pal.line}`, flexWrap: 'wrap', gap: 10 }}>
      <span>
        Historial · {historial.length} {historial.length === 1 ? 'tomo' : 'tomos'} · {HOY.anio}
      </span>
      <span style={{ fontStyle: 'italic', fontSize: 14, textTransform: 'none', letterSpacing: 0, color: 'oklch(35% 0.03 30)', ...serif }}>
        Archivar es cuidar la memoria del negocio.
      </span>
      <span>© {HOY.anio} · Gestión Laboral</span>
    </footer>
  );
}

function Dock({ onIrAlEstante, onIrAComparador, onAbrirUltimo }) {
  return (
    <div style={{ position: 'sticky', bottom: 20, margin: '-36px auto 0', width: 'fit-content', display: 'flex', justifyContent: 'center', zIndex: 20 }}>
      <div className="ed-dock" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: pal.ink, color: pal.cream, padding: '8px 8px 8px 20px', borderRadius: 999, boxShadow: '0 24px 60px -20px oklch(20% 0.02 30 / 0.5)' }}>
        <span style={{ ...mono, color: 'oklch(70% 0.02 60)', fontSize: 10 }}>Historial</span>
        <span style={{ width: 1, height: 16, background: 'oklch(40% 0.02 30)', margin: '0 6px' }} />
        <button type="button" onClick={onIrAlEstante} style={{ padding: '9px 16px', background: 'transparent', color: 'oklch(88% 0.03 60)', border: 'none', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
          Ver estante
        </button>
        <button type="button" onClick={onIrAComparador} style={{ padding: '9px 16px', background: 'transparent', color: 'oklch(88% 0.03 60)', border: 'none', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
          Comparar
        </button>
        {onAbrirUltimo && (
          <button type="button" onClick={onAbrirUltimo} style={{ padding: '9px 18px', background: pal.gold, color: pal.ink, border: 'none', borderRadius: 999, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            Abrir último tomo
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Composición
   --------------------------------------------------------- */

const HISTORIAL_SECTIONS = [
  { key: 'hero', label: 'Resumen' },
  { key: 'estante', label: 'Estante' },
  { key: 'tomo', label: 'Tomos' },
  { key: 'comparador', label: 'Comparador' },
  { key: 'buscador', label: 'Buscador' },
  { key: 'cierre', label: 'Cierre' },
];

export default function Historial({ historial, periodos, empleados, tasas, periodoTipo, ccssHistorial, insHistorial, usuario, empresaNombre, notificaciones, onNotifClick, onVerDetalle, onNavigate }) {
  const sectionRefs = useRef({});
  const setSectionRef = (key) => (el) => {
    sectionRefs.current[key] = el;
  };

  function irAlEstante() {
    scrollA('historial-estante');
  }
  function irAComparador() {
    scrollA('historial-comparador');
  }
  function scrollA(id) {
    const el = document.getElementById(id);
    const scrollEl = document.getElementById('app-content');
    if (!el || !scrollEl) return;
    scrollEl.scrollTo({ top: Math.max(0, el.offsetTop - 24), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  return (
    <div className="screen ed-home" style={{ fontFamily: "'Albert Sans', system-ui, sans-serif", color: pal.ink, background: pal.cream, minHeight: '100%' }}>
      <ScrollRail sectionRefs={sectionRefs} sections={HISTORIAL_SECTIONS} />

      <div style={{ maxWidth: 1440, margin: '0 auto', position: 'relative' }}>
        <Masthead historial={historial} onNavigate={onNavigate} usuario={usuario} notificaciones={notificaciones} onNotifClick={onNotifClick} />
        <StatusBar historial={historial} usuario={usuario} />

        <div id="hs-sec-hero" ref={setSectionRef('hero')}>
          <Seccion01Hero historial={historial} onVerDetalle={onVerDetalle} onIrAComparador={irAComparador} />
        </div>

        <div id="historial-estante" ref={setSectionRef('estante')}>
          <EstanteSection historial={historial} onVerDetalle={onVerDetalle} />
        </div>

        <div id="hs-sec-tomo" ref={setSectionRef('tomo')}>
          <TomoSection historial={historial} empleados={empleados} tasas={tasas} ccssHistorial={ccssHistorial} insHistorial={insHistorial} onVerDetalle={onVerDetalle} />
        </div>

        <div id="historial-comparador" ref={setSectionRef('comparador')}>
          <ComparadorSection historial={historial} empleados={empleados} tasas={tasas} />
        </div>

        <div id="hs-sec-buscador" ref={setSectionRef('buscador')}>
          <BuscadorSection historial={historial} onVerDetalle={onVerDetalle} />
        </div>

        <div id="hs-sec-cierre" ref={setSectionRef('cierre')}>
          <CierreSection
            historial={historial}
            periodoTipo={periodoTipo}
            onDescargarAnio={(anio) => exportarAnioCsv(historial, anio)}
            onDescargarLibro={() => exportarLibroCsv(historial, ccssHistorial, insHistorial, empresaNombre)}
          />
        </div>

        <Footer historial={historial} />
      </div>

      <Dock onIrAlEstante={irAlEstante} onIrAComparador={irAComparador} onAbrirUltimo={historial[0] ? () => onVerDetalle(historial[0].id) : null} />
    </div>
  );
}
