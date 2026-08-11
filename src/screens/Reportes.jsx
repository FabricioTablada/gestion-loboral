import { useEffect, useRef, useState } from 'react';

import { HOY } from '../data/mock.js';
import { descargarCsv, sufijoFecha } from '../lib/export.js';
import { money } from '../lib/format.js';
import { IconSearch } from '../components/ui/Icons.jsx';
import { NotificacionesPanel } from '../components/ui/NotificacionesPanel.jsx';
import ScrollRail, { Logo } from '../components/ScrollRail.jsx';

/**
 * Reportes — "el observatorio del negocio". Mismo lenguaje editorial que el
 * resto (paleta cream/coral/gold, Instrument Serif + JetBrains Mono, motion
 * `ed-*`), composición propia en 5 secciones tomada de `Reportes.dc.html`.
 *
 * Los datos y acciones son los que ya existían (`barras`, `distribucion`,
 * `costoPorEmpleado`, `rango`/`onRangoChange`, `onEmpleadoClick`): esto es
 * solo una nueva presentación. La referencia compara contra 2025 y proyecta
 * aguinaldo/provisiones/recargos que no existen en el modelo real — esas
 * cifras se sustituyeron por el equivalente real más cercano (comparación
 * dentro del rango real disponible, tasas reales de `tasas`, historial real
 * de `ccss`/`ins`) o se eliminaron cuando no había ningún dato real detrás.
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
  plum: 'oklch(45% 0.13 320)',
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
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: c,
        display: 'inline-block',
        flexShrink: 0,
        animation: glow ? 'ed-dot-glow 2.5s ease-in-out infinite' : undefined,
      }}
    />
  );
}

const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function fechaLarga(hoy) {
  const weekday = new Date(hoy.anio, hoy.mesIndice, hoy.dia).toLocaleDateString('es-CR', { weekday: 'long' });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap} · ${String(hoy.dia).padStart(2, '0')} ${MESES_LARGO[hoy.mesIndice]} ${hoy.anio}`;
}

function parseFecha(str) {
  const m = /(\d{1,2})\s+([a-záéíóú]{3})\s+(\d{4})/i.exec(str || '');
  if (!m) return null;
  const mesIndice = MESES_ABR.indexOf(m[2].toLowerCase());
  if (mesIndice < 0) return null;
  return { dia: parseInt(m[1], 10), mesIndice, anio: parseInt(m[3], 10) };
}

function antiguedad(ingresoObj, hoy) {
  let anios = hoy.anio - ingresoObj.anio;
  let meses = hoy.mesIndice - ingresoObj.mesIndice;
  if (hoy.dia < ingresoObj.dia) meses -= 1;
  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }
  return { anios, meses: Math.max(0, meses), totalMeses: anios * 12 + Math.max(0, meses) };
}

function antiguedadFmt({ anios, meses }) {
  if (anios <= 0) return meses <= 1 ? `${meses} mes` : `${meses} meses`;
  const partA = anios === 1 ? '1 año' : `${anios} años`;
  if (meses === 0) return partA;
  return `${partA} ${meses === 1 ? '1 mes' : `${meses} meses`}`;
}

/** El "canal" real de un empleado es su cuenta (`banco`) — mismo criterio que Pagos/Equipo. */
function canalDe(banco) {
  return (banco || '').split('·')[0].trim() || 'Sin canal';
}

function sparklinePath(values, w = 200, h = 40, pad = 4) {
  if (!values || values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function formatMillon(n) {
  return '₡' + (n / 1_000_000).toFixed(2) + 'M';
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

const RANGOS = [
  { v: 3, l: '3 meses' },
  { v: 6, l: '6 meses' },
  { v: 12, l: '12 meses' },
];

/* ---------------------------------------------------------
   Masthead + barra de estado
   --------------------------------------------------------- */

function Masthead({ rango, onNavigate, usuario, notificaciones, onNotifClick }) {
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
          ÚLTIMOS {rango} MESES
        </span>
      </div>

      <nav className="ed-masthead-nav" style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 13 }}>
        {NAV_ITEMS.map((item) => {
          const active = item.key === 'reportes';
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
            Buscar reporte o período
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

function StatusBar({ empsActivos, capitulos, usuario }) {
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
        <span style={{ color: pal.deepGreen }}>● {capitulos} capítulos</span>
        <span style={{ color: 'oklch(50% 0.13 65)' }}>● {empsActivos.length} personas activas</span>
      </span>
      <span>{usuario.rol}</span>
    </div>
  );
}

/* ---------------------------------------------------------
   Sección 01 — Hero: el observatorio
   --------------------------------------------------------- */

function Seccion01Hero({ barras, rango, onRangoChange, totales, onIrAlAtlas, onDescargarInforme }) {
  const valores = barras.map((b) => b.v);
  const suma = valores.reduce((a, v) => a + v, 0);
  const promedio = valores.length ? suma / valores.length : 0;
  const actualBarra = barras.find((b) => b.actual) || barras[barras.length - 1];
  const primero = valores[0] || 0;
  const ultimo = valores[valores.length - 1] || 0;
  const pctCambio = primero > 0 ? ((ultimo - primero) / primero) * 100 : 0;

  const max = Math.max(...valores, 1);
  const min = Math.min(...valores, 0);
  const range = max - min || 1;
  const chartW = 600;
  const chartH = 260;
  const padL = 40;
  const padR = 20;
  const top = 40;
  const bottom = 220;
  const stepX = valores.length > 1 ? (chartW - padL - padR) / (valores.length - 1) : 0;
  // Con un solo mes de datos (sistema recién empezado) no hay `stepX` real:
  // clavar el punto en `padL` lo dejaba pegado al borde izquierdo, con todo
  // el resto del gráfico vacío. Se centra en vez de anclarlo a la izquierda.
  const puntos = valores.map((v, i) => ({
    x: valores.length > 1 ? padL + i * stepX : (padL + (chartW - padR)) / 2,
    y: bottom - ((v - min) / range) * (bottom - top),
  }));
  const linePath = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${puntos[puntos.length - 1]?.x.toFixed(1)},${bottom} L${puntos[0]?.x.toFixed(1)},${bottom} Z`;

  return (
    <section style={{ position: 'relative', padding: '44px 56px 44px', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 60, right: -40, width: 820, height: 520, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 40% 40%, oklch(88% 0.10 320 / 0.32), transparent 55%), radial-gradient(ellipse at 70% 70%, oklch(85% 0.11 145 / 0.25), transparent 60%)', animation: 'ed-aurora 12s ease-in-out infinite', filter: 'blur(2px)' }} />
      </div>

      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 56, alignItems: 'start' }} className="ed-grid-observatorio">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
            <span style={{ width: 32, height: 1, background: pal.ink }} />
            <span style={{ ...mono, color: pal.ink }}>Reportes · sección 01</span>
            <Dot c={pal.sage} glow />
            <span style={{ ...mono, color: pal.deepGreen }}>
              {barras[0]?.m.toUpperCase()} → {actualBarra?.m.toUpperCase()} {HOY.anio}
            </span>
          </div>

          <h1 className="ed-hero-title" style={{ fontSize: 96, lineHeight: 0.92, margin: '0 0 18px', letterSpacing: '-0.03em', color: pal.ink, animation: 'ed-fade-up 900ms ease-out both', ...serif }}>
            El{' '}
            <em style={{ fontStyle: 'italic', background: 'linear-gradient(135deg, oklch(45% 0.11 320), oklch(60% 0.16 30))', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>
              observatorio
            </em>
            <br />
            del negocio.
          </h1>

          <p style={{ fontSize: 22, fontStyle: 'italic', lineHeight: 1.35, margin: '0 0 28px', color: 'oklch(35% 0.03 30)', animation: 'ed-fade-up 900ms ease-out 200ms both', ...serif }}>
            En los últimos {rango} meses gastaste <span style={{ color: pal.ink }}>{formatMillon(suma)}</span> en planilla y cargas.{' '}
            {pctCambio !== 0 && (
              <>
                {pctCambio > 0 ? 'Subió' : 'Bajó'} <span style={{ color: pctCambio > 0 ? pal.deepGreen : 'oklch(50% 0.13 25)' }}>{Math.abs(pctCambio).toFixed(1)}%</span> desde {barras[0]?.m}.
              </>
            )}
          </p>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onDescargarInforme}
              title="Descarga el resumen ejecutivo del rango en CSV"
              style={{ padding: '14px 24px', background: pal.ink, color: pal.cream, border: 'none', borderRadius: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10, position: 'relative', overflow: 'hidden' }}
            >
              <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 40%, oklch(100% 0 0 / 0.15) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'ed-shine-sweep 4s ease-in-out infinite' }} />
              <span style={{ position: 'relative' }}>Descargar informe ejecutivo</span>
              <svg style={{ position: 'relative' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v14M6 13l6 6 6-6M5 21h14" />
              </svg>
            </button>
            <button type="button" onClick={onIrAlAtlas} style={{ padding: '14px 20px', background: pal.cream2, color: pal.ink, border: `1px solid ${pal.line}`, borderRadius: 14, fontSize: 14, cursor: 'pointer' }}>
              Ver los capítulos ↓
            </button>
          </div>
        </div>

        <div style={{ position: 'relative', padding: '26px 30px 22px', background: 'oklch(99% 0.006 70 / 0.75)', border: '1px solid oklch(88% 0.02 55 / 0.6)', borderRadius: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={mono}>Costo real mensual</div>
              <div style={{ fontSize: 22, lineHeight: 1, marginTop: 4, ...serif }}>
                Bruto + cargas · <em style={{ fontStyle: 'italic' }}>mes a mes</em>
              </div>
            </div>
            <div style={{ display: 'inline-flex', padding: 3, background: pal.cream2, border: `1px solid ${pal.line}`, borderRadius: 10, fontSize: 11 }}>
              {RANGOS.map((r) => (
                <button
                  key={r.v}
                  type="button"
                  onClick={() => onRangoChange(r.v)}
                  style={{ padding: '5px 10px', border: 'none', background: rango === r.v ? pal.ink : 'transparent', color: rango === r.v ? pal.cream : pal.muted, borderRadius: 7, cursor: 'pointer', fontWeight: rango === r.v ? 600 : 400 }}
                >
                  {r.v}m
                </button>
              ))}
            </div>
          </div>

          <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 260, display: 'block' }}>
            <defs>
              <linearGradient id="rep-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="oklch(70% 0.16 30)" stopOpacity="0.35" />
                <stop offset="1" stopColor="oklch(70% 0.16 30)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="rep-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="oklch(70% 0.16 30)" />
                <stop offset="1" stopColor="oklch(85% 0.14 65)" />
              </linearGradient>
            </defs>
            <g stroke="oklch(88% 0.02 55)" strokeWidth="0.5">
              <line x1={padL} y1={top} x2={chartW - padR} y2={top} />
              <line x1={padL} y1={(top + bottom) / 2} x2={chartW - padR} y2={(top + bottom) / 2} />
              <line x1={padL} y1={bottom} x2={chartW - padR} y2={bottom} />
            </g>
            <g fontFamily="JetBrains Mono, monospace" fontSize="9" fill="oklch(48% 0.02 40)" textAnchor="end">
              <text x={padL - 6} y={top + 4}>{formatMillon(max)}</text>
              <text x={padL - 6} y={bottom + 4}>{formatMillon(min)}</text>
            </g>
            <g fontFamily="JetBrains Mono, monospace" fontSize="9" fill="oklch(48% 0.02 40)" textAnchor="middle" letterSpacing="1">
              {barras.map((b, i) => (
                <text key={b.m} x={puntos[i]?.x} y={bottom + 22} fill={b.actual ? pal.coral : 'oklch(62% 0.02 40)'} fontWeight={b.actual ? 700 : 400}>
                  {b.m.toUpperCase()}
                </text>
              ))}
            </g>
            <path d={areaPath} fill="url(#rep-area)" />
            <path d={linePath} stroke="url(#rep-line)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="1400" style={{ animation: 'ed-stroke-draw 2s ease-out both' }} />
            {puntos.map((p, i) =>
              barras[i]?.actual ? (
                <circle key={i} cx={p.x} cy={p.y} r="6" fill={pal.gold} stroke={pal.ink} strokeWidth="2" />
              ) : (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill="oklch(70% 0.16 30)" />
              )
            )}
            {actualBarra && (
              <>
                <rect x={(puntos[puntos.length - 1]?.x || 0) - 50} y="10" width="100" height="24" rx="6" fill={pal.ink} />
                <text x={puntos[puntos.length - 1]?.x} y="26" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="10" fill={pal.gold} fontWeight="700">
                  {actualBarra.vFmt} · HOY
                </text>
              </>
            )}
          </svg>

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${pal.line2}`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }} className="ed-grid-3">
            <div>
              <div style={{ ...mono, fontSize: 8 }}>Acumulado del rango</div>
              <div style={{ fontSize: 20, marginTop: 2, ...num, ...serif }}>{formatMillon(suma)}</div>
            </div>
            <div>
              <div style={{ ...mono, fontSize: 8 }}>Promedio mensual</div>
              <div style={{ fontSize: 20, marginTop: 2, ...num, ...serif }}>{formatMillon(promedio)}</div>
            </div>
            <div>
              <div style={{ ...mono, fontSize: 8 }}>Δ vs {barras[0]?.m}</div>
              <div style={{ fontSize: 20, marginTop: 2, color: pctCambio >= 0 ? pal.deepGreen : 'oklch(50% 0.13 25)', ...num, ...serif }}>
                {pctCambio >= 0 ? '+' : ''}
                {pctCambio.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 02 — El atlas: los capítulos
   --------------------------------------------------------- */

const ACENTOS = [
  { g1: pal.peach, g2: pal.coral, ink: 'oklch(25% 0.08 30)' },
  { g1: pal.sky, g2: 'oklch(60% 0.14 220)', ink: 'oklch(25% 0.05 220)' },
  { g1: pal.lilac, g2: 'oklch(65% 0.14 300)', ink: 'oklch(25% 0.08 310)' },
  { g1: 'oklch(85% 0.11 100)', g2: 'oklch(75% 0.13 90)', ink: 'oklch(25% 0.10 95)' },
  { g1: 'oklch(80% 0.10 20)', g2: 'oklch(72% 0.13 10)', ink: 'oklch(25% 0.08 20)' },
  { g1: 'oklch(78% 0.10 240)', g2: 'oklch(70% 0.13 260)', ink: 'oklch(25% 0.09 250)' },
];

function CapCosto({ barras, empleadoTop, onIr }) {
  const valores = barras.map((b) => b.v);
  const actualIdx = barras.findIndex((b) => b.actual);
  const actual = barras[actualIdx];
  const anterior = barras[actualIdx - 1];
  const deltaMes = actual && anterior ? actual.v - anterior.v : null;
  const primero = valores[0];
  const ultimo = valores[valores.length - 1];
  const deltaPct = primero > 0 ? ((ultimo - primero) / primero) * 100 : 0;
  const max = Math.max(...valores, 1);

  return (
    <article
      onClick={onIr}
      style={{ gridColumn: 'span 3', position: 'relative', padding: '26px 28px', background: pal.paper, border: `2px solid ${pal.ink}`, borderRadius: 22, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 30px 60px -30px oklch(20% 0.02 30 / 0.35)' }}
    >
      <span style={{ position: 'absolute', top: 0, left: 20, padding: '5px 12px', background: pal.ink, color: pal.gold, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.16em', borderRadius: '0 0 10px 10px', fontWeight: 700 }}>◆ ABIERTO ABAJO</span>
      <div style={{ marginTop: 12, marginBottom: 16 }}>
        <div style={mono}>Capítulo · 01</div>
        <div style={{ fontSize: 32, lineHeight: 1, marginTop: 6, ...serif }}>
          Costo real <em style={{ fontStyle: 'italic' }}>del equipo</em>
        </div>
        <div style={{ fontSize: 14, fontStyle: 'italic', color: pal.muted, marginTop: 4, ...serif }}>bruto + cargas patronales</div>
      </div>
      <svg viewBox="0 0 320 90" style={{ width: '100%', height: 90, display: 'block' }}>
        {(() => {
          // Con pocos meses (sistema recién empezado) repartir el ancho
          // completo entre 1-2 barras las dejaba como un bloque sólido
          // gigante en vez de un mini gráfico de barras — se limita el
          // ancho de cada barra y se centra el grupo, igual que con más
          // meses de historial.
          const barW = Math.min(320 / barras.length - 6, 64);
          const totalW = barras.length * (barW + 6) - 6;
          const offsetX = (320 - totalW) / 2;
          return barras.map((b, i) => {
            const x = offsetX + i * (barW + 6);
            const h = Math.max(4, (b.v / max) * 84);
            return <rect key={b.m} x={x} y={90 - h} width={barW} height={h} rx="4" fill={b.actual ? pal.gold : 'oklch(78% 0.11 30)'} style={{ transformOrigin: 'bottom', animation: `ed-bar-grow 700ms cubic-bezier(.16,1,.3,1) ${i * 60}ms both` }} />;
          });
        })()}
      </svg>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${pal.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ ...mono, fontSize: 8 }}>{actual?.m}</div>
          <div style={{ fontSize: 26, ...num, ...serif }}>{actual?.vFmt}</div>
        </div>
        {deltaMes !== null && (
          <div>
            <div style={{ ...mono, fontSize: 8 }}>Δ vs mes anterior</div>
            <div style={{ fontSize: 20, color: deltaMes >= 0 ? pal.deepGreen : 'oklch(50% 0.13 25)', ...num, ...serif }}>
              {deltaMes >= 0 ? '+' : ''}
              {money(deltaMes)}
            </div>
          </div>
        )}
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...mono, fontSize: 8 }}>Δ del rango</div>
          <div style={{ fontSize: 20, color: deltaPct >= 0 ? pal.deepGreen : 'oklch(50% 0.13 25)', ...num, ...serif }}>
            {deltaPct >= 0 ? '+' : ''}
            {deltaPct.toFixed(1)}%
          </div>
        </div>
      </div>
    </article>
  );
}

function CapRoles({ empsActivos, onNavigate }) {
  const porPuesto = new Map();
  empsActivos.forEach((e) => {
    if (!porPuesto.has(e.puesto)) porPuesto.set(e.puesto, { puesto: e.puesto, salario: 0, personas: 0 });
    const g = porPuesto.get(e.puesto);
    g.salario += e.salario;
    g.personas += 1;
  });
  const total = empsActivos.reduce((a, e) => a + e.salario, 0) || 1;
  const grupos = [...porPuesto.values()].sort((a, b) => b.salario - a.salario);
  const lider = grupos[0];

  return (
    <article
      onClick={() => onNavigate('empleados')}
      style={{ gridColumn: 'span 3', position: 'relative', padding: '26px 28px', background: 'linear-gradient(160deg, oklch(96% 0.03 145), oklch(93% 0.07 145 / 0.4))', border: '1px solid oklch(80% 0.06 145 / 0.4)', borderRadius: 22, cursor: 'pointer', overflow: 'hidden' }}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...mono, color: pal.deepGreen }}>Capítulo · 02</div>
        <div style={{ fontSize: 32, lineHeight: 1, marginTop: 6, ...serif }}>
          Salarios <em style={{ fontStyle: 'italic' }}>por rol</em>
        </div>
        <div style={{ fontSize: 14, fontStyle: 'italic', color: 'oklch(35% 0.10 145)', marginTop: 4, ...serif }}>quién pesa más en la nómina</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {grupos.map((g, i) => {
          const ac = ACENTOS[i % ACENTOS.length];
          const pct = (g.salario / total) * 100;
          return (
            <div key={g.puesto}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span>{g.puesto}</span>
                <span style={{ color: pal.ink, ...num }}>
                  {money(g.salario)} · {pct.toFixed(0)}%
                </span>
              </div>
              <div style={{ height: 8, background: 'oklch(88% 0.02 55)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${ac.g1}, ${ac.g2})`, transformOrigin: 'left', animation: `ed-bar-grow-x 1.2s cubic-bezier(.16,1,.3,1) ${i * 100}ms both` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed oklch(30% 0.10 145 / 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontStyle: 'italic', color: 'oklch(30% 0.10 145)', ...serif }}>
          {lider ? `${lider.puesto} lidera · ${lider.personas} ${lider.personas === 1 ? 'persona' : 'personas'} de ${empsActivos.length}.` : 'Sin datos.'}
        </div>
        <span style={{ fontSize: 11, color: pal.deepGreen }}>Abrir capítulo ↗</span>
      </div>
    </article>
  );
}

function CapCanales({ empsActivos, onNavigate }) {
  const porCanal = new Map();
  empsActivos.forEach((e) => {
    const k = canalDe(e.banco);
    if (!porCanal.has(k)) porCanal.set(k, { canal: k, salario: 0, personas: 0 });
    const g = porCanal.get(k);
    g.salario += e.salario;
    g.personas += 1;
  });
  const total = empsActivos.reduce((a, e) => a + e.salario, 0) || 1;
  const canales = [...porCanal.values()].sort((a, b) => b.salario - a.salario);
  const circ = 2 * Math.PI * 30;
  let acumulado = 0;
  const colores = [pal.sage, 'oklch(60% 0.14 250)', pal.gold, pal.lilac, pal.sky];

  return (
    <article onClick={() => onNavigate('pagos')} style={{ gridColumn: 'span 2', position: 'relative', padding: '22px 22px', background: pal.paper, border: `1px solid ${pal.line2}`, borderRadius: 20, cursor: 'pointer' }}>
      <div style={mono}>Capítulo · 03</div>
      <div style={{ fontSize: 24, lineHeight: 1, marginTop: 6, ...serif }}>
        Canales <em style={{ fontStyle: 'italic' }}>de pago</em>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
        <svg viewBox="0 0 80 80" width="80" height="80">
          <circle cx="40" cy="40" r="30" stroke="oklch(88% 0.02 55)" strokeWidth="14" fill="none" />
          {canales.map((c, i) => {
            const pct = c.salario / total;
            const dash = pct * circ;
            const offset = -acumulado;
            acumulado += dash;
            return <circle key={c.canal} cx="40" cy="40" r="30" stroke={colores[i % colores.length]} strokeWidth="14" fill="none" strokeDasharray={`${dash} ${circ}`} strokeDashoffset={offset} transform="rotate(-90 40 40)" />;
          })}
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11 }}>
          {canales.map((c, i) => (
            <div key={c.canal} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: colores[i % colores.length] }} />
                {c.canal}
              </span>
              <span style={num}>{((c.salario / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${pal.line2}`, fontSize: 11, color: pal.muted, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontStyle: 'italic', ...serif }}>{canales[0] ? `${canales[0].canal} concentra el ${((canales[0].salario / total) * 100).toFixed(0)}%` : 'Sin datos'}</span>
        <span style={{ color: pal.ink }}>↗</span>
      </div>
    </article>
  );
}

function CapCargas({ tasas, barras, onNavigate }) {
  const totalCosto = barras.reduce((a, b) => a + b.v, 0);
  // Bruto y cargas reales de cada mes del rango (snapshot congelado si el
  // mes ya cerró) — nunca derivados de la tasa de HOY, que puede haber
  // cambiado desde entonces (auditoría C3).
  const totalBruto = barras.reduce((a, b) => a + b.b, 0);
  const totalCargas = totalCosto - totalBruto;
  const wObrera = tasas.deduccionEmpleado * 100;
  const wPatronal = tasas.cargasPatronales * 100;

  return (
    <article onClick={() => onNavigate('calendario')} style={{ gridColumn: 'span 2', position: 'relative', padding: '22px 22px', background: pal.paper, border: `1px solid ${pal.line2}`, borderRadius: 20, cursor: 'pointer' }}>
      <div style={mono}>Capítulo · 04</div>
      <div style={{ fontSize: 24, lineHeight: 1, marginTop: 6, ...serif }}>
        Cargas <em style={{ fontStyle: 'italic' }}>vs bruto</em>
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: pal.muted, marginBottom: 3 }}>
            <span>CCSS OBRERA</span>
            <span>{wObrera.toFixed(2)}% del bruto</span>
          </div>
          <div style={{ height: 18, background: 'oklch(88% 0.02 55)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${wObrera}%`, height: '100%', background: pal.sky, transformOrigin: 'left', animation: 'ed-bar-grow-x 1s cubic-bezier(.16,1,.3,1) both' }} />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: pal.muted, marginBottom: 3 }}>
            <span>PATRONAL + INS</span>
            <span>{wPatronal.toFixed(2)}% del bruto</span>
          </div>
          <div style={{ height: 18, background: 'oklch(88% 0.02 55)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${wPatronal}%`, height: '100%', background: pal.sage, transformOrigin: 'left', animation: 'ed-bar-grow-x 1s cubic-bezier(.16,1,.3,1) 100ms both' }} />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 8, paddingTop: 10, borderTop: `1px dashed ${pal.line2}`, fontSize: 11, color: pal.muted, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontStyle: 'italic', ...serif }}>{formatMillon(totalCargas)} en cargas del rango</span>
        <span style={{ color: pal.ink }}>↗</span>
      </div>
    </article>
  );
}

function CapAjustes({ empsActivos, onNavigate }) {
  let extra = 0;
  let bono = 0;
  let deduccion = 0;
  empsActivos.forEach((e) => {
    extra += e.montoHorasExtra || 0;
    bono += e.bono || 0;
    deduccion += e.deduccionPuntual || 0;
  });
  const neto = extra + bono - deduccion;
  const max = Math.max(extra, bono, deduccion, 1);

  return (
    <article onClick={() => onNavigate('planilla')} style={{ gridColumn: 'span 2', position: 'relative', padding: '22px 22px', background: 'linear-gradient(160deg, oklch(96% 0.03 65), oklch(93% 0.08 55 / 0.4))', border: '1px solid oklch(80% 0.06 55 / 0.4)', borderRadius: 20, cursor: 'pointer' }}>
      <div style={{ ...mono, color: 'oklch(45% 0.13 55)' }}>Capítulo · 05</div>
      <div style={{ fontSize: 24, lineHeight: 1, marginTop: 6, ...serif }}>
        Ajustes <em style={{ fontStyle: 'italic' }}>de esta quincena</em>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {[
          { l: 'Extras', v: extra, c: pal.deepGreen },
          { l: 'Deducciones', v: -deduccion, c: 'oklch(45% 0.12 25)' },
          { l: 'Bonos', v: bono, c: pal.coral },
        ].map((r) => (
          <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: pal.muted, minWidth: 68 }}>{r.l}</span>
            <div style={{ flex: 1, height: 6, background: 'oklch(88% 0.02 55)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${(Math.abs(r.v) / max) * 100}%`, height: '100%', background: r.c, transformOrigin: 'left', animation: 'ed-bar-grow-x 1s cubic-bezier(.16,1,.3,1) both' }} />
            </div>
            <span style={{ fontSize: 11, color: r.c, ...num, minWidth: 66, textAlign: 'right' }}>
              {r.v >= 0 ? '+' : '−'}
              {money(Math.abs(r.v))}
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed oklch(45% 0.10 55 / 0.3)', fontSize: 11, color: 'oklch(45% 0.13 55)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontStyle: 'italic', ...serif }}>
          Neto · {neto >= 0 ? '+' : '−'}
          {money(Math.abs(neto))}
        </span>
        <span style={{ color: 'oklch(35% 0.13 55)' }}>↗</span>
      </div>
    </article>
  );
}

function CapRotacion({ emps, empsActivos, onNavigate }) {
  const bajas = emps.filter((e) => !e.activo).length;
  const conFecha = empsActivos.map((e) => ({ e, f: parseFecha(e.ingreso) })).filter((x) => x.f);
  const antiguedades = conFecha.map((x) => antiguedad(x.f, HOY));
  const promMeses = antiguedades.length ? antiguedades.reduce((a, x) => a + x.totalMeses, 0) / antiguedades.length : 0;
  const promFmt = antiguedadFmt({ anios: Math.floor(promMeses / 12), meses: Math.round(promMeses % 12) });
  const masReciente = conFecha.reduce((best, x) => (!best || x.f.anio > best.f.anio || (x.f.anio === best.f.anio && x.f.mesIndice > best.f.mesIndice) ? x : best), null);
  const pctRotacion = emps.length ? Math.round((bajas / emps.length) * 100) : 0;

  return (
    <article
      onClick={() => onNavigate('empleados')}
      style={{ gridColumn: 'span 3', position: 'relative', padding: '22px 22px', background: pal.paper, border: `1px solid ${pal.line2}`, borderRadius: 20, cursor: 'pointer', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 20, alignItems: 'center' }}
      className="ed-grid-capitulo-metrica"
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 52, lineHeight: 1, color: pctRotacion === 0 ? pal.deepGreen : 'oklch(50% 0.13 25)', ...num, ...serif }}>{pctRotacion}%</div>
        <div style={{ ...mono, fontSize: 8, marginTop: 4 }}>Bajas / equipo</div>
      </div>
      <div>
        <div style={mono}>Capítulo · 06</div>
        <div style={{ fontSize: 22, lineHeight: 1.1, marginTop: 6, ...serif }}>
          Rotación y <em style={{ fontStyle: 'italic' }}>retención</em>
        </div>
        <div style={{ fontSize: 13, fontStyle: 'italic', color: pal.muted, marginTop: 6, ...serif }}>
          {bajas === 0 ? 'Nadie se fue este año' : `${bajas} ${bajas === 1 ? 'baja registrada' : 'bajas registradas'}`} · antigüedad promedio {promFmt}
          {masReciente ? ` · última incorporación ${masReciente.e.ingreso}` : ''}.
        </div>
      </div>
      <span style={{ alignSelf: 'flex-start', fontSize: 11, color: pal.muted }}>↗</span>
    </article>
  );
}

function CapPuntualidad({ obligaciones, ccssHistorial, insHistorial, onNavigate }) {
  const total = obligaciones.length || 1;
  const alDia = obligaciones.filter((o) => o.k === 'aldia' || o.k === 'pagado').length;
  const pct = Math.round((alDia / total) * 100);
  const comprobantes = (ccssHistorial || []).length + (insHistorial || []).length;

  return (
    <article
      onClick={() => onNavigate('calendario')}
      style={{ gridColumn: 'span 3', position: 'relative', padding: '22px 22px', background: pal.paper, border: `1px solid ${pal.line2}`, borderRadius: 20, cursor: 'pointer', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 20, alignItems: 'center' }}
      className="ed-grid-capitulo-metrica"
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 52, lineHeight: 1, color: pal.ink, ...num, ...serif }}>{pct}%</div>
        <div style={{ ...mono, fontSize: 8, marginTop: 4 }}>Obligaciones al día</div>
      </div>
      <div>
        <div style={mono}>Capítulo · 07</div>
        <div style={{ fontSize: 22, lineHeight: 1.1, marginTop: 6, ...serif }}>
          Puntualidad <em style={{ fontStyle: 'italic' }}>de pagos y obligaciones</em>
        </div>
        {/* Cuenta pagos/regularizaciones REGISTRADOS en el historial, no
            comprobantes adjuntos — un pago se puede marcar sin haber subido
            ningún archivo, así que "comprobantes archivados" prometía algo
            que no siempre es cierto. */}
        <div style={{ fontSize: 13, fontStyle: 'italic', color: pal.muted, marginTop: 6, ...serif }}>
          {comprobantes} {comprobantes === 1 ? 'pago registrado' : 'pagos registrados'} en CCSS e INS · sin recargos registrados en el sistema.
        </div>
      </div>
      <span style={{ alignSelf: 'flex-start', fontSize: 11, color: pal.muted }}>↗</span>
    </article>
  );
}

function AtlasSection({ barras, empsActivos, emps, obligaciones, tasas, ccssHistorial, insHistorial, onNavigate, onIrACapitulo }) {
  const empleadoTop = empsActivos.reduce((best, e) => (!best || e.costoQ > best.costoQ ? e : best), null);

  return (
    <section style={{ padding: '24px 56px 56px' }} id="reportes-atlas">
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 02 · el atlas</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            Los <em style={{ fontStyle: 'italic' }}>siete capítulos</em>
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <span style={mono}>{empsActivos.length} personas · rango real seleccionado</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }} className="ed-grid-atlas">
        <CapCosto barras={barras} empleadoTop={empleadoTop} onIr={onIrACapitulo} />
        <CapRoles empsActivos={empsActivos} onNavigate={onNavigate} />
        <CapCanales empsActivos={empsActivos} onNavigate={onNavigate} />
        <CapCargas tasas={tasas} barras={barras} onNavigate={onNavigate} />
        <CapAjustes empsActivos={empsActivos} onNavigate={onNavigate} />
        <CapRotacion emps={emps} empsActivos={empsActivos} onNavigate={onNavigate} />
        <CapPuntualidad obligaciones={obligaciones} ccssHistorial={ccssHistorial} insHistorial={insHistorial} onNavigate={onNavigate} />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 03 — Capítulo abierto: costo real desarmado
   --------------------------------------------------------- */

function CapituloAbiertoSection({ barras, rango, tasas, costoPorEmpleado, empsActivos, distribucion, distTotalFmt, onEmpleadoClick }) {
  const valores = barras.map((b) => b.v);
  const totalCosto = valores.reduce((a, v) => a + v, 0);
  // Bruto real del rango (snapshots congelados) — nunca derivado de la tasa
  // actual (auditoría C3).
  const totalBruto = barras.reduce((a, b) => a + b.b, 0);
  const totalCargas = totalCosto - totalBruto;
  const promCosto = totalCosto / (valores.length || 1);
  const promBruto = totalBruto / (valores.length || 1);
  const promCargas = totalCargas / (valores.length || 1);
  const pctBruto = totalCosto > 0 ? (totalBruto / totalCosto) * 100 : 0;
  const pctCargas = totalCosto > 0 ? (totalCargas / totalCosto) * 100 : 0;

  const empleadoTop = empsActivos.reduce((best, e) => (!best || e.costoQ > best.costoQ ? e : best), null);
  const costoPorCienBruto = Math.round(100 * (1 + tasas.cargasPatronales));

  const max = Math.max(...valores, 1);
  const wfBrutoH = 150;
  const wfCargasH = (promCargas / promCosto) * wfBrutoH || 20;
  const wfTotalH = wfBrutoH + wfCargasH;

  return (
    <section style={{ padding: '0 56px 56px' }} id="reportes-capitulo-01">
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 03 · capítulo abierto</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            Costo real, <em style={{ fontStyle: 'italic' }}>desarmado</em>
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: pal.muted }}>
          <span>Período</span>
          <span style={{ padding: '6px 12px', background: pal.ink, color: pal.cream, borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
            {barras[0]?.m} → {barras[barras.length - 1]?.m} {HOY.anio} · {rango}m
          </span>
        </div>
      </div>

      <article style={{ position: 'relative', background: pal.paper, borderRadius: 26, overflow: 'hidden', boxShadow: '0 30px 60px -30px oklch(20% 0.02 30 / 0.35)', border: `1px solid ${pal.line}` }}>
        <div style={{ padding: '26px 40px', background: 'linear-gradient(135deg, oklch(96% 0.03 30 / 0.5), oklch(94% 0.05 320 / 0.4))', borderBottom: `1px dashed ${pal.line}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32, alignItems: 'center' }} className="ed-grid-3">
          <div>
            <div style={mono}>Total invertido en el rango</div>
            <div style={{ fontSize: 38, lineHeight: 1, marginTop: 4, ...num, ...serif }}>{formatMillon(totalCosto)}</div>
          </div>
          <div>
            <div style={mono}>En salarios brutos</div>
            <div style={{ fontSize: 26, lineHeight: 1, marginTop: 4, color: 'oklch(35% 0.03 30)', ...num, ...serif }}>{formatMillon(totalBruto)}</div>
            <div style={{ fontSize: 11, fontStyle: 'italic', color: pal.muted, ...serif }}>{pctBruto.toFixed(1)}%</div>
          </div>
          <div>
            <div style={mono}>En cargas patronales + INS</div>
            <div style={{ fontSize: 26, lineHeight: 1, marginTop: 4, color: pal.plum, ...num, ...serif }}>{formatMillon(totalCargas)}</div>
            <div style={{ fontSize: 11, fontStyle: 'italic', color: pal.muted, ...serif }}>{pctCargas.toFixed(1)}% · tasa real {(tasas.cargasPatronales * 100).toFixed(2)}%</div>
          </div>
        </div>

        {/* Distribución exacta de la quincena activa — mismo dato real que ya existía en Reportes */}
        <div style={{ padding: '22px 40px', borderBottom: `1px solid ${pal.line2}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 16, ...serif }}>
              Distribución exacta de <em style={{ fontStyle: 'italic' }}>la quincena activa</em>
            </div>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: pal.muted, ...serif }}>total {distTotalFmt}</div>
          </div>
          <div style={{ display: 'flex', height: 14, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
            {distribucion.map((d) => (
              <div key={d.l} style={{ height: '100%', background: d.c, width: d.w, transformOrigin: 'left', animation: 'ed-bar-grow-x 1s cubic-bezier(.16,1,.3,1) both' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {distribucion.map((d) => (
              <div key={d.l} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: d.c, flexShrink: 0 }} />
                <span style={{ color: pal.muted }}>{d.l}</span>
                <span style={{ fontWeight: 600, color: pal.ink, ...num }}>{d.vFmt}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr' }} className="ed-grid-capitulo-body">
          <div style={{ padding: '34px 40px', borderRight: `1px solid ${pal.line2}` }}>
            <div style={{ fontSize: 22, marginBottom: 6, ...serif }}>
              De <em style={{ fontStyle: 'italic' }}>bruto</em> a costo real
            </div>
            <div style={{ fontSize: 13, fontStyle: 'italic', color: pal.muted, marginBottom: 22, ...serif }}>promedio mensual del rango</div>

            <svg viewBox="0 0 260 260" style={{ width: '100%', height: 260 }}>
              <line x1="0" y1="230" x2="260" y2="230" stroke="oklch(88% 0.02 55)" strokeWidth="1" />
              <rect x="20" y={230 - wfBrutoH} width="70" height={wfBrutoH} rx="6" fill={pal.sky} style={{ transformOrigin: 'bottom', animation: 'ed-bar-grow 800ms cubic-bezier(.16,1,.3,1) both' }} />
              <text x="55" y="248" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="oklch(48% 0.02 40)" textAnchor="middle">BRUTO</text>
              <text x="55" y={230 - wfBrutoH - 8} fontFamily="Instrument Serif, serif" fontSize="14" fill={pal.ink} textAnchor="middle">{money(promBruto)}</text>

              <line x1="90" y1={230 - wfBrutoH} x2="110" y2={230 - wfBrutoH} stroke="oklch(70% 0.03 55)" strokeWidth="0.5" strokeDasharray="3 3" />

              <rect x="110" y={230 - wfTotalH} width="70" height={wfCargasH} rx="6" fill={pal.plum} style={{ transformOrigin: 'bottom', animation: 'ed-bar-grow 800ms cubic-bezier(.16,1,.3,1) 200ms both' }} />
              <text x="145" y="248" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="oklch(48% 0.02 40)" textAnchor="middle">+CARGAS</text>
              <text x="145" y={230 - wfTotalH - 8} fontFamily="Instrument Serif, serif" fontSize="12" fill={pal.plum} textAnchor="middle">+{money(promCargas)}</text>

              <line x1="180" y1={230 - wfTotalH} x2="200" y2={230 - wfTotalH} stroke="oklch(70% 0.03 55)" strokeWidth="0.5" strokeDasharray="3 3" />

              <rect x="200" y={230 - wfTotalH} width="60" height={wfTotalH} rx="6" fill={pal.ink} style={{ transformOrigin: 'bottom', animation: 'ed-bar-grow 800ms cubic-bezier(.16,1,.3,1) 400ms both' }} />
              <text x="230" y="248" fontFamily="JetBrains Mono, monospace" fontSize="9" fill={pal.ink} textAnchor="middle" fontWeight="700">COSTO</text>
              <text x="230" y={230 - wfTotalH - 8} fontFamily="Instrument Serif, serif" fontSize="16" fill={pal.ink} textAnchor="middle">{money(promCosto)}</text>
            </svg>

            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${pal.line2}` }}>
              <div style={{ fontSize: 15, fontStyle: 'italic', color: 'oklch(35% 0.03 30)', lineHeight: 1.4, ...serif }}>
                Cada ₡100 que paga {empleadoTop ? empleadoTop.nombre.split(' ')[0] : 'el equipo'} en bruto, te cuesta{' '}
                <span style={{ color: pal.ink, fontWeight: 500 }}>₡{costoPorCienBruto}</span> en realidad.
              </div>
            </div>
          </div>

          <div style={{ padding: '34px 40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 22, ...serif }}>
                  Mes a mes · <em style={{ fontStyle: 'italic' }}>apilado</em>
                </div>
                <div style={{ fontSize: 13, fontStyle: 'italic', color: pal.muted, marginTop: 2, ...serif }}>bruto + cargas patronales</div>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: pal.muted }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: `linear-gradient(180deg, ${pal.sky}, oklch(60% 0.14 220))` }} />
                  Bruto
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: pal.muted }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: `linear-gradient(180deg, oklch(70% 0.10 320), ${pal.plum})` }} />
                  Cargas
                </span>
              </div>
            </div>

            <svg viewBox={`0 0 ${Math.max(barras.length * 78, 300)} 260`} style={{ width: '100%', height: 260 }}>
              <g stroke="oklch(88% 0.02 55)" strokeWidth="0.5">
                <line x1="0" y1="220" x2={barras.length * 78} y2="220" />
                <line x1="0" y1="140" x2={barras.length * 78} y2="140" strokeDasharray="2 4" />
                <line x1="0" y1="60" x2={barras.length * 78} y2="60" strokeDasharray="2 4" />
              </g>
              {barras.map((b, i) => {
                // Bruto/cargas reales de ESE mes (snapshot congelado), no
                // recalculados con la tasa de hoy (auditoría C3).
                const brutoB = b.b;
                const cargasB = b.cargas;
                const hBruto = (brutoB / max) * 160;
                const hCargas = (cargasB / max) * 160;
                const x = i * 78 + 10;
                return (
                  <g key={b.m}>
                    <rect x={x} y={220 - hBruto} width="58" height={hBruto} rx="3" fill={pal.sky} opacity={b.actual ? 1 : 0.85} />
                    <rect x={x} y={220 - hBruto - hCargas} width="58" height={hCargas} rx="3" fill={pal.plum} opacity={b.actual ? 1 : 0.85} />
                    {b.actual && <rect x={x - 2} y={220 - hBruto - hCargas - 2} width="62" height={hBruto + hCargas + 4} rx="4" fill="none" stroke={pal.gold} strokeWidth="1.5" />}
                    <text x={x + 29} y="238" fontFamily="JetBrains Mono, monospace" fontSize="9" fill={b.actual ? pal.coral : 'oklch(48% 0.02 40)'} textAnchor="middle" fontWeight={b.actual ? 700 : 400}>
                      {b.m.toUpperCase()}
                    </text>
                    {b.actual && (
                      <text x={x + 29} y={220 - hBruto - hCargas - 10} fontFamily="Instrument Serif, serif" fontSize="14" fill={pal.ink} textAnchor="middle">
                        {b.vFmt}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            <div style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${pal.line2}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <div style={mono}>{barras[barras.length - 1]?.m} · quién pesa cuánto</div>
                <div style={{ fontSize: 13, fontStyle: 'italic', color: pal.muted, ...serif }}>costo real por persona</div>
              </div>
              <div style={{ height: 22, borderRadius: 8, overflow: 'hidden', display: 'flex' }}>
                {costoPorEmpleado.map((r, i) => {
                  const ac = ACENTOS[i % ACENTOS.length];
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onEmpleadoClick(r.id)}
                      title={`Ver a ${r.nombre}`}
                      style={{ width: r.w, background: `linear-gradient(180deg, ${ac.g1}, ${ac.g2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {parseFloat(r.w) > 6 && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: ac.ink, fontWeight: 600 }}>{r.ini} {r.costoFmt}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 04 — Las comparativas: small multiples
   --------------------------------------------------------- */

function TarjetaComparativa({ titulo, valor, delta, deltaColor, spark, sparkColor, nota }) {
  return (
    <article style={{ padding: '22px 24px', background: pal.paper, border: `1px solid ${pal.line2}`, borderRadius: 18 }}>
      <div style={mono}>{titulo}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ fontSize: 26, marginTop: 4, ...num, ...serif }}>{valor}</div>
        {delta && (
          <div style={{ fontSize: 12, fontStyle: 'italic', color: deltaColor || pal.muted, ...serif }}>{delta}</div>
        )}
      </div>
      {spark && (
        <svg viewBox="0 0 200 40" style={{ width: '100%', height: 40, marginTop: 12 }}>
          <path d={spark} stroke={sparkColor || pal.ink} strokeWidth="1.5" fill="none" />
        </svg>
      )}
      <div style={{ fontSize: 11, fontStyle: 'italic', color: pal.muted, marginTop: 6, ...serif }}>{nota}</div>
    </article>
  );
}

function ComparativasSection({ barras, tasas, empsActivos, totales }) {
  const valores = barras.map((b) => b.v);
  // Bruto real mes a mes (snapshots congelados), no derivado de la tasa
  // actual (auditoría C3).
  const brutoValores = barras.map((b) => b.b);
  const primeroB = brutoValores[0] || 0;
  const ultimoB = brutoValores[brutoValores.length - 1] || 0;
  const deltaBrutoPct = primeroB > 0 ? ((ultimoB - primeroB) / primeroB) * 100 : 0;

  let extra = 0;
  let bono = 0;
  let deduccion = 0;
  let conAjuste = 0;
  empsActivos.forEach((e) => {
    extra += e.montoHorasExtra || 0;
    bono += e.bono || 0;
    deduccion += e.deduccionPuntual || 0;
    if (e.tieneAjuste) conAjuste += 1;
  });
  const netoAjustes = extra + bono - deduccion;

  const costoHoraProm = empsActivos.length ? empsActivos.reduce((a, e) => a + (e.valorHora || 0), 0) / empsActivos.length : 0;
  const salarioProm = empsActivos.length ? empsActivos.reduce((a, e) => a + e.salario, 0) / empsActivos.length : 0;

  return (
    <section style={{ padding: '0 56px 56px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, marginBottom: 8 }}>Sección 04 · las comparativas</div>
          <div style={{ fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: pal.ink, ...serif }}>
            El rango, <em style={{ fontStyle: 'italic' }}>al hilo</em>
          </div>
        </div>
        <div style={{ height: 1, background: pal.line }} />
        <span style={mono}>
          {barras[0]?.m} → {barras[barras.length - 1]?.m} {HOY.anio}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }} className="ed-grid-comparativas">
        <TarjetaComparativa
          titulo="Planilla bruta"
          valor={money(ultimoB)}
          delta={`${deltaBrutoPct >= 0 ? '+' : ''}${deltaBrutoPct.toFixed(1)}%`}
          deltaColor={deltaBrutoPct >= 0 ? pal.deepGreen : 'oklch(50% 0.13 25)'}
          spark={sparklinePath(brutoValores)}
          sparkColor={pal.ink}
          nota={`del ${barras[0]?.m} al ${barras[barras.length - 1]?.m}`}
        />
        {/* Antes decía "porcentaje regulado, no cambia mes a mes" — pero la
            tasa SÍ se puede cambiar en Configuración en cualquier momento;
            lo que no cambia es que es la misma tasa vigente para todos los
            meses mostrados, no una tasa fija de por vida. */}
        <TarjetaComparativa titulo="Cargas / bruto" valor={`${(tasas.cargasPatronales * 100).toFixed(1)}%`} delta="tasa vigente" deltaColor={pal.muted} spark={sparklinePath(new Array(barras.length).fill(1))} sparkColor={pal.plum} nota="según la configuración actual — cambia si se edita en Configuración" />
        <TarjetaComparativa titulo="Horas extra" valor={`${money(extra)}`} nota="esta quincena · todo el equipo" />
        <TarjetaComparativa
          titulo="Ajustes netos"
          valor={money(Math.abs(netoAjustes))}
          delta={netoAjustes >= 0 ? '+' : '−'}
          deltaColor={netoAjustes >= 0 ? pal.deepGreen : 'oklch(50% 0.13 25)'}
          nota="esta quincena · bonos menos deducciones"
        />
        <TarjetaComparativa titulo="Personas con ajuste" valor={String(conAjuste)} nota={`de ${empsActivos.length} activas esta quincena`} />
        <TarjetaComparativa titulo="Pendientes de pago" valor={String(totales.pendCount)} deltaColor={totales.pendCount === 0 ? pal.deepGreen : undefined} nota="hoy, en la quincena activa" />
        <TarjetaComparativa
          titulo="Costo por hora prom."
          valor={money(costoHoraProm)}
          nota={`salario base ÷ ${empsActivos[0]?.jornadaHorasMes ?? 240}h · sin cargas`}
        />
        <TarjetaComparativa titulo="Salario promedio" valor={money(salarioProm)} nota={`entre ${empsActivos.length} personas activas`} />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Sección 05 — Cierre
   --------------------------------------------------------- */

/* ---------------------------------------------------------
   Exportaciones reales del observatorio (CSV) — antes los tres
   botones de esta pantalla estaban deshabilitados aunque todos
   los números ya estuvieran calculados en pantalla.
   --------------------------------------------------------- */

/** Resumen ejecutivo del rango: una fila por mes + los totales del período activo. */
function exportarInformeCsv({ barras, totales, tasas, empsActivos, rango, empresaNombre }) {
  const suma = barras.reduce((a, b) => a + b.v, 0);
  const filas = [
    ['Informe ejecutivo de costo laboral'],
    ['Empresa', empresaNombre || ''],
    ['Rango', `${rango} meses`],
    ['Generado', fechaLarga(HOY)],
    [],
    ['Mes', 'Salarios brutos', 'Cargas (patronales + INS)', 'Costo total'],
    ...barras.map((b) => [b.m, b.b.toFixed(0), b.cargas.toFixed(0), b.v.toFixed(0)]),
    [],
    ['Acumulado del rango', '', '', suma.toFixed(0)],
    ['Promedio mensual', '', '', barras.length ? (suma / barras.length).toFixed(0) : '0'],
    [],
    ['Período activo'],
    ['Empleados activos', String(empsActivos.length)],
    ['Salarios brutos', totales.sumBruto.toFixed(0)],
    ['Deducciones CCSS (empleado)', totales.totDed.toFixed(0)],
    ['Cargas patronales + INS', totales.totCar.toFixed(0)],
    ['Neto a pagar', totales.sumNeto.toFixed(0)],
    ['Costo total', totales.totCosto.toFixed(0)],
    [],
    ['Tasa deducción empleado', `${(tasas.deduccionEmpleado * 100).toFixed(2)}%`],
    ['Tasa cargas patronales + INS', `${(tasas.cargasPatronales * 100).toFixed(2)}%`],
  ];
  descargarCsv(`informe-ejecutivo-${sufijoFecha(HOY)}`, filas);
}

/** Detalle completo: meses, personas, obligaciones y comprobantes registrados. */
function exportarDatosCsv({ barras, emps, obligaciones, ccssHistorial, insHistorial, empresaNombre }) {
  const filas = [
    ['Detalle completo'],
    ['Empresa', empresaNombre || ''],
    ['Generado', fechaLarga(HOY)],
    [],
    ['— Costo laboral por mes —'],
    ['Mes', 'Salarios brutos', 'Cargas', 'Costo total'],
    ...barras.map((b) => [b.m, b.b.toFixed(0), b.cargas.toFixed(0), b.v.toFixed(0)]),
    [],
    ['— Personas —'],
    [
      'Nombre', 'Puesto', 'Estado', 'Salario mensual', 'Bruto período', 'Deducción CCSS', 'Neto', 'Costo período',
      'Estado de pago', 'Referencia bancaria', 'Comisión bancaria', 'Conciliado',
    ],
    ...emps.map((e) => [
      e.nombre,
      e.puesto,
      e.activo ? 'Activo' : 'De baja',
      e.salario.toFixed(0),
      e.brutoQ.toFixed(0),
      e.ded.toFixed(0),
      e.neto.toFixed(0),
      e.costoQ.toFixed(0),
      e.pago === 'pagado' ? 'Pagado' : 'Pendiente',
      e.referenciaPago && e.referenciaPago !== '—' ? e.referenciaPago : '',
      e.comisionPago ? e.comisionPago.toFixed(0) : '',
      e.conciliado ? 'Sí' : 'No',
    ]),
    [],
    ['— Obligaciones —'],
    ['Obligación', 'Estado', 'Vencimiento', 'Monto'],
    ...obligaciones.map((o) => [o.t, o.stL, o.fecha, o.monto ? o.monto.toFixed(0) : '']),
    [],
    ['— Cuotas CCSS registradas —'],
    ['Período', 'Fecha de pago', 'Método', 'Referencia', 'Obrera', 'Patronal', 'Total'],
    ...(ccssHistorial || []).map((h) => [
      h.periodo,
      h.fechaPago || '',
      h.metodo || '',
      h.referencia || '',
      (h.obrera ?? 0).toFixed(0),
      (h.patronal ?? 0).toFixed(0),
      h.monto.toFixed(0),
    ]),
    [],
    ['— Reportes INS registrados —'],
    ['Período', 'Fecha de regularización', 'Método', 'Referencia', 'Tasa aplicada', 'Monto'],
    ...(insHistorial || []).map((h) => [
      h.periodo,
      h.fechaPago || '',
      h.metodo || '',
      h.referencia || '',
      `${((h.tasa ?? 0) * 100).toFixed(2)}%`,
      h.monto.toFixed(0),
    ]),
  ];
  descargarCsv(`datos-completos-${sufijoFecha(HOY)}`, filas);
}

function CierreSection({ barras, capitulos, totales, onDescargarInforme, onDescargarDatos }) {
  const suma = barras.reduce((a, b) => a + b.v, 0);
  const promedio = suma / (barras.length || 1);

  return (
    <section style={{ padding: '0 56px 88px' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(160deg, oklch(88% 0.08 320) 0%, oklch(85% 0.10 260) 50%, oklch(88% 0.10 200) 100%)', borderRadius: 32, padding: '56px 64px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-30%', right: '-15%', width: '60%', height: '120%', background: 'radial-gradient(circle, oklch(90% 0.13 260 / 0.4), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora 11s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '-40%', left: '-10%', width: '50%', height: '100%', background: 'radial-gradient(circle, oklch(85% 0.12 320 / 0.32), transparent 65%)', filter: 'blur(30px)', animation: 'ed-aurora-2 13s ease-in-out infinite' }} />
        </div>

        <div className="ed-grid-2" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '8fr 4fr', gap: 56, alignItems: 'start' }}>
          <div>
            <div style={{ ...mono, color: 'oklch(28% 0.08 260)', marginBottom: 18 }}>Cierre · llevate los reportes</div>
            <div style={{ fontSize: 60, lineHeight: 1.02, letterSpacing: '-0.02em', color: pal.ink, marginBottom: 20, ...serif }}>
              Descargá, <em style={{ fontStyle: 'italic' }}>programá</em>,
              <br />o compartí <em style={{ fontStyle: 'italic', textDecoration: 'underline', textDecorationColor: pal.coral, textDecorationThickness: 2, textUnderlineOffset: 6 }}>con el conta</em>.
            </div>
            <p style={{ fontSize: 19, fontStyle: 'italic', lineHeight: 1.5, color: 'oklch(30% 0.06 260)', maxWidth: 640, margin: '0 0 26px', ...serif }}>
              Los {capitulos} capítulos se descargan en CSV con los datos reales del rango. El envío programado todavía necesita un servidor de correo, así que sigue sin conectar.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 640 }} className="ed-grid-3">
              <button
                type="button"
                onClick={onDescargarInforme}
                title="Descarga el resumen ejecutivo del rango en CSV"
                style={{ padding: '16px 18px', background: pal.ink, color: pal.cream, border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ fontSize: 20, marginBottom: 6, fontFamily: "'Instrument Serif', serif" }}>↓</div>
                Informe ejecutivo
                <br />
                <span style={{ color: 'oklch(75% 0.03 60)', fontSize: 11, fontWeight: 400 }}>CSV · resumen del rango</span>
              </button>
              <button
                type="button"
                onClick={onDescargarDatos}
                title="Descarga el detalle completo (meses, empleados y obligaciones) en CSV"
                style={{ padding: '16px 18px', background: 'oklch(99% 0.006 70 / 0.6)', color: pal.ink, border: '1px solid oklch(99% 0.006 70)', borderRadius: 14, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ fontSize: 20, marginBottom: 6, fontFamily: "'Instrument Serif', serif" }}>⤓</div>
                Todos los datos
                <br />
                <span style={{ color: 'oklch(40% 0.06 260)', fontSize: 11 }}>CSV · detalle completo</span>
              </button>
              <button type="button" aria-disabled="true" title="Todavía no está conectado" style={{ padding: '16px 18px', background: 'oklch(99% 0.006 70 / 0.6)', color: pal.muted, border: '1px solid oklch(99% 0.006 70)', borderRadius: 14, fontSize: 13, cursor: 'not-allowed', opacity: 0.75, textAlign: 'left' }}>
                <div style={{ fontSize: 20, marginBottom: 6, fontFamily: "'Instrument Serif', serif" }}>✉</div>
                Programar envío
                <br />
                <span style={{ color: 'oklch(40% 0.06 260)', fontSize: 11 }}>no conectado</span>
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', padding: '26px 28px', background: 'oklch(99% 0.006 70 / 0.55)', border: '1px solid oklch(99% 0.006 70 / 0.6)', borderRadius: 20 }}>
            <div style={{ ...mono, color: 'oklch(28% 0.08 260)', marginBottom: 14 }}>En números · el rango de hoy</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ padding: 14, background: pal.paper, border: `1px solid ${pal.line2}`, borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: 15, ...serif }}>Acumulado del rango</div>
                </div>
                <div style={{ fontSize: 20, marginTop: 4, ...num, ...serif }}>{formatMillon(suma)}</div>
              </div>
              <div style={{ padding: 14, background: pal.paper, border: `1px solid ${pal.line2}`, borderRadius: 12 }}>
                <div style={{ fontSize: 15, ...serif }}>Promedio mensual</div>
                <div style={{ fontSize: 20, marginTop: 4, ...num, ...serif }}>{formatMillon(promedio)}</div>
              </div>
              <div style={{ padding: 14, background: pal.paper, border: `1px solid ${pal.line2}`, borderRadius: 12 }}>
                <div style={{ fontSize: 15, ...serif }}>Pendiente de pago hoy</div>
                <div style={{ fontSize: 20, marginTop: 4, ...num, ...serif }}>{money(totales.pendiente)}</div>
              </div>
            </div>

            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid oklch(30% 0.06 260 / 0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: pal.ink, color: pal.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, ...serif }}>◐</div>
              <div style={{ fontSize: 14, fontStyle: 'italic', color: 'oklch(30% 0.04 260)', lineHeight: 1.35, ...serif }}>"Los números buenos no se guardan solos."</div>
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

function Footer({ rango, capitulos }) {
  return (
    <footer style={{ padding: '20px 56px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: pal.muted, borderTop: `1px solid ${pal.line}`, flexWrap: 'wrap', gap: 10 }}>
      <span>
        Reportes · últimos {rango} meses · {capitulos} capítulos
      </span>
      <span style={{ fontStyle: 'italic', fontSize: 14, textTransform: 'none', letterSpacing: 0, color: 'oklch(35% 0.03 30)', ...serif }}>
        Medir bien es cuidar bien.
      </span>
      <span>© {HOY.anio} · Gestión Laboral</span>
    </footer>
  );
}

function Dock({ onIrAlAtlas, onCambiarRango, onDescargarInforme }) {
  return (
    <div style={{ position: 'sticky', bottom: 20, margin: '-36px auto 0', width: 'fit-content', display: 'flex', justifyContent: 'center', zIndex: 20 }}>
      <div className="ed-dock" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: pal.ink, color: pal.cream, padding: '8px 8px 8px 20px', borderRadius: 999, boxShadow: '0 24px 60px -20px oklch(20% 0.02 30 / 0.5)' }}>
        <span style={{ ...mono, color: 'oklch(70% 0.02 60)', fontSize: 10 }}>Reportes</span>
        <span style={{ width: 1, height: 16, background: 'oklch(40% 0.02 30)', margin: '0 6px' }} />
        <button type="button" onClick={onCambiarRango} style={{ padding: '9px 16px', background: 'transparent', color: 'oklch(88% 0.03 60)', border: 'none', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
          Cambiar rango
        </button>
        <button type="button" onClick={onIrAlAtlas} style={{ padding: '9px 16px', background: 'transparent', color: 'oklch(88% 0.03 60)', border: 'none', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
          Ver capítulos
        </button>
        <button
          type="button"
          onClick={onDescargarInforme}
          style={{ padding: '9px 18px', background: pal.gold, color: pal.ink, border: 'none', borderRadius: 999, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
        >
          Descargar informe
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Composición
   --------------------------------------------------------- */

const REPORTES_SECTIONS = [
  { key: 'hero', label: 'Resumen' },
  { key: 'atlas', label: 'Atlas' },
  { key: 'capitulo', label: 'Matriz' },
  { key: 'comparativas', label: 'Tendencia' },
  { key: 'cierre', label: 'Cierre' },
];

export default function Reportes({
  barras,
  distribucion,
  distTotalFmt,
  costoPorEmpleado,
  emps,
  empsActivos,
  obligaciones,
  totales,
  tasas,
  rango,
  ccssHistorial,
  insHistorial,
  usuario,
  empresaNombre,
  notificaciones,
  onNotifClick,
  onRangoChange,
  onEmpleadoClick,
  onNavigate,
}) {
  const CAPITULOS = 7;
  const sectionRefs = useRef({});
  const setSectionRef = (key) => (el) => {
    sectionRefs.current[key] = el;
  };

  function descargarInforme() {
    exportarInformeCsv({ barras, totales, tasas, empsActivos, rango, empresaNombre });
  }

  function descargarDatos() {
    exportarDatosCsv({ barras, emps, obligaciones, ccssHistorial, insHistorial, empresaNombre });
  }

  function irAlAtlas() {
    const el = document.getElementById('reportes-atlas');
    const scrollEl = document.getElementById('app-content');
    if (!el || !scrollEl) return;
    scrollEl.scrollTo({ top: Math.max(0, el.offsetTop - 24), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  function irACapituloAbierto() {
    const el = document.getElementById('reportes-capitulo-01');
    const scrollEl = document.getElementById('app-content');
    if (!el || !scrollEl) return;
    scrollEl.scrollTo({ top: Math.max(0, el.offsetTop - 24), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  return (
    <div className="screen ed-home" style={{ fontFamily: "'Albert Sans', system-ui, sans-serif", color: pal.ink, background: pal.cream, minHeight: '100%' }}>
      <ScrollRail sectionRefs={sectionRefs} sections={REPORTES_SECTIONS} />

      <div style={{ maxWidth: 1440, margin: '0 auto', position: 'relative' }}>
        <Masthead rango={rango} onNavigate={onNavigate} usuario={usuario} notificaciones={notificaciones} onNotifClick={onNotifClick} />
        <StatusBar empsActivos={empsActivos} capitulos={CAPITULOS} usuario={usuario} />

        <div id="rp-sec-hero" ref={setSectionRef('hero')}>
          <Seccion01Hero barras={barras} rango={rango} onRangoChange={onRangoChange} totales={totales} onIrAlAtlas={irAlAtlas} onDescargarInforme={descargarInforme} />
        </div>

        <div id="reportes-atlas" ref={setSectionRef('atlas')}>
          <AtlasSection barras={barras} empsActivos={empsActivos} emps={emps} obligaciones={obligaciones} tasas={tasas} ccssHistorial={ccssHistorial} insHistorial={insHistorial} onNavigate={onNavigate} onIrACapitulo={irACapituloAbierto} />
        </div>

        <div id="reportes-capitulo-01" ref={setSectionRef('capitulo')}>
          <CapituloAbiertoSection
            barras={barras}
            rango={rango}
            tasas={tasas}
            costoPorEmpleado={costoPorEmpleado}
            empsActivos={empsActivos}
            distribucion={distribucion}
            distTotalFmt={distTotalFmt}
            onEmpleadoClick={onEmpleadoClick}
          />
        </div>

        <div id="rp-sec-comparativas" ref={setSectionRef('comparativas')}>
          <ComparativasSection barras={barras} tasas={tasas} empsActivos={empsActivos} totales={totales} />
        </div>

        <div id="rp-sec-cierre" ref={setSectionRef('cierre')}>
          <CierreSection barras={barras} capitulos={CAPITULOS} totales={totales} onDescargarInforme={descargarInforme} onDescargarDatos={descargarDatos} />
        </div>

        <Footer rango={rango} capitulos={CAPITULOS} />
      </div>

      <Dock onIrAlAtlas={irAlAtlas} onCambiarRango={() => onRangoChange(rango === 12 ? 3 : rango === 6 ? 12 : 6)} onDescargarInforme={descargarInforme} />
    </div>
  );
}
