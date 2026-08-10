import { useEffect, useRef, useState } from 'react';

import { color, font, elevation, status } from '../theme/tokens.js';
import { money } from '../lib/format.js';
import { Card, CardHeader, Button, Badge, Avatar, Dot } from '../components/ui/Primitives.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { IconCheck } from '../components/ui/Icons.jsx';

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Cuenta hacia el valor real al montar/cambiar (Fase 1 · I.2 / I.4.03).
 */
function useCountUp(target, { duration = 650, format = (n) => String(Math.round(n)) } = {}) {
  const [display, setDisplay] = useState(() => (reducedMotion() ? target : 0));
  const prevRef = useRef(reducedMotion() ? target : 0);

  useEffect(() => {
    if (reducedMotion()) {
      setDisplay(target);
      prevRef.current = target;
      return undefined;
    }
    const from = prevRef.current;
    const to = target;
    if (from === to) return undefined;
    const start = performance.now();
    let raf;
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return format(display);
}

/** Sparkline con degradado + línea + punto final */
function Sparkline({ points, tone, width = 85, height = 26 }) {
  if (!points || points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const coords = points.map((v, i) => [i * stepX, height - ((v - min) / range) * height]);
  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const [firstX, firstY] = coords[0];
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ overflow: 'visible', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="panel-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.35" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1={0}
        y1={firstY}
        x2={width}
        y2={firstY}
        stroke={tone}
        strokeOpacity={0.25}
        strokeDasharray="2 3"
        strokeWidth={1}
      />
      <path d={areaPath} fill="url(#panel-spark-fill)" stroke="none" />
      <path d={linePath} fill="none" stroke={tone} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={firstX} cy={firstY} r={2} fill={tone} opacity={0.45} />
      <circle cx={lastX} cy={lastY} r={2.8} fill={tone} />
    </svg>
  );
}

/** Flecha + variación porcentual real */
function TrendDelta({ deltaPct }) {
  if (deltaPct === null || !Number.isFinite(deltaPct)) return null;
  const up = deltaPct >= 0;
  const tone = up ? color.amberText : color.tealText;
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: tone, whiteSpace: 'nowrap' }}>
      {up ? '↑' : '↓'} {Math.abs(deltaPct).toFixed(1)}%{' '}
      <span style={{ fontWeight: 500, color: color.muted3 }}>vs. mes ant.</span>
    </span>
  );
}

/** Componente de Tarjeta de Métrica uniforme */
function StatCardUnified({ label, value, sub, subColor, dotColor, tone, badge, sparkline, delta, progress }) {
  return (
    <Card
      elevate={1}
      className="elevate-hover"
      pad="20px 22px"
      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 148 }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div
            style={{
              fontSize: '0.72rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: color.label,
              fontWeight: 600,
            }}
          >
            {label}
          </div>
          {badge && badge}
          {sparkline && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {delta}
              {sparkline}
            </div>
          )}
        </div>

        <div
          style={{
            fontFamily: font.display,
            fontWeight: 300,
            fontSize: '2.5rem',
            color: tone || color.text,
            lineHeight: 1,
            marginTop: 10,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </div>
      </div>

      <div>
        {sub && (
          <div
            style={{
              fontSize: '0.78rem',
              color: subColor || color.muted2,
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {dotColor && <Dot c={dotColor} />}
            {sub}
          </div>
        )}
        {progress}
      </div>
    </Card>
  );
}

export default function Panel({ emps, totales, atender, barras, onNavigate }) {
  const costoDisplay = useCountUp(totales.totCosto, { format: money });
  const netoDisplay = useCountUp(totales.pendiente, { format: money });
  const empDisplay = useCountUp(emps.length, { duration: 500 });
  const obligDisplay = useCountUp(atender.length, { duration: 500 });

  const trendPoints = (barras || []).map((b) => parseFloat(b.hStr));
  const trendDeltaPct =
    trendPoints.length >= 2 && trendPoints[trendPoints.length - 2] !== 0
      ? ((trendPoints[trendPoints.length - 1] - trendPoints[trendPoints.length - 2]) / trendPoints[trendPoints.length - 2]) * 100
      : null;

  const pagoPctNum = parseInt(totales.pagoPct, 10);

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1520, margin: '0 auto' }}>
      {/* Nivel 1: Retícula de 4 métricas clave bien proporcionadas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 16,
        }}
      >
        <StatCardUnified
          label="Costo total de planilla"
          value={costoDisplay}
          sub="Bruto + cargas patronales · quincena"
          delta={<TrendDelta deltaPct={trendDeltaPct} />}
          sparkline={<Sparkline points={trendPoints} tone={color.accent} />}
        />

        <StatCardUnified
          label="Neto por pagar"
          value={netoDisplay}
          tone={totales.pendCount > 0 ? color.text : color.tealText}
          sub={`${totales.pendCount} de ${emps.length} empleados pendientes`}
          dotColor={totales.pendCount > 0 ? color.amberDot : color.tealDot}
          progress={
            <div style={{ marginTop: 8 }}>
              <div
                role="progressbar"
                aria-valuenow={pagoPctNum}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Porcentaje pagado de la quincena"
                style={{ height: 5, borderRadius: 999, background: color.trackSoft, overflow: 'hidden' }}
              >
                <div
                  className="bar-grow"
                  style={{
                    height: '100%',
                    width: totales.pagoPct,
                    background: totales.pendCount > 0 ? color.amberDot : color.teal,
                    borderRadius: 999,
                  }}
                />
              </div>
              <div style={{ fontSize: '0.68rem', color: color.muted3, marginTop: 4 }}>
                {totales.pagoPct} pagado de la quincena
              </div>
            </div>
          }
        />

        <StatCardUnified
          label="Empleados activos"
          value={empDisplay}
          sub="Todos al día en el sistema"
          dotColor={color.tealDot}
          subColor={color.tealText}
          badge={
            <Badge bg={status.aldia.bg} c={color.tealText} dot={color.tealDot} size="xs">
              Al día
            </Badge>
          }
          progress={
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 5, borderRadius: 999, background: color.trackSoft, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '100%', background: color.teal, borderRadius: 999 }} />
              </div>
              <div style={{ fontSize: '0.68rem', color: color.tealText, marginTop: 4 }}>
                100% activos en plantilla
              </div>
            </div>
          }
        />

        <StatCardUnified
          label="Obligaciones por vencer"
          value={obligDisplay}
          sub="1 vencida · próx. 20 ago"
          dotColor={color.amberDot}
          subColor={color.amberText}
          badge={
            <Badge bg={status.proximo.bg} c={color.amberText} dot={color.amberDot} size="xs">
              Atención
            </Badge>
          }
          progress={
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 5, borderRadius: 999, background: color.trackSoft, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '66%', background: color.amberDot, borderRadius: 999 }} />
              </div>
              <div style={{ fontSize: '0.68rem', color: color.amberText, marginTop: 4 }}>
                66% al día · 1 pendiente
              </div>
            </div>
          }
        />
      </div>

      {/* Nivel 2: Qué necesitas atender vs. Resumen de la planilla */}
      <div
        className="grid-2-wide"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.75fr) minmax(0, 1fr)',
          gap: 20,
          alignItems: 'stretch',
        }}
      >
        {/* Izquierda: Qué necesitas atender */}
        <Card pad={false} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
          <div>
            <CardHeader
              title="Qué necesitas atender"
              subtitle="Tareas y pagos pendientes de formalización"
              right={
                <a
                  href="#calendario"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('calendario');
                  }}
                  style={{ fontSize: '0.8rem', fontWeight: 600 }}
                >
                  Ver calendario
                </a>
              }
            />
            {atender.length === 0 ? (
              <EmptyState
                icon={<IconCheck size={20} />}
                title="Sin pendientes"
                description="No hay obligaciones ni pagos por atender en este momento."
              />
            ) : (
              atender.map((o, i) => (
                <div
                  key={o.t}
                  className="list-row stagger-in"
                  style={{
                    '--i': i,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '16px 22px',
                    borderBottom: `1px solid ${color.borderFaint}`,
                    borderLeft: `3px solid ${o.stD}`,
                  }}
                >
                  <Badge bg={o.stBg} c={o.stC} dot={o.stD} size="lg">
                    {o.stL}
                  </Badge>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: color.text3 }}>{o.t}</div>
                    <div style={{ fontSize: '0.78rem', color: color.muted, marginTop: 2 }}>{o.d}</div>
                  </div>
                  <div style={{ textAlign: 'right', paddingRight: 8 }}>
                    <div
                      style={{
                        fontSize: '0.94rem',
                        fontWeight: 700,
                        color: color.text3,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {o.montoFmt}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: color.muted, marginTop: 2 }}>{o.fecha}</div>
                  </div>
                  <Button variant="soft" size="sm" style={{ minWidth: 78 }} onClick={() => onNavigate(o.target)}>
                    Atender
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Derecha: Resumen de la planilla */}
        <Card style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
          <div>
            <h2 style={{ margin: '0 0 16px', fontSize: '1.02rem', fontWeight: 600, color: color.text2, fontFamily: 'inherit' }}>
              Resumen de la planilla
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: '0.86rem' }}>
              <Row label="Salario bruto" value={totales.sumBrutoFmt} />
              <Row label="Deducciones CCSS (10,67%)" value={`− ${totales.totDedFmt}`} valueColor={color.tealText} />
              <Row
                label="Salario neto"
                value={totales.sumNetoFmt}
                style={{ paddingBottom: 11, borderBottom: `1px solid ${color.borderSoft}` }}
              />
              <Row label="Cargas patronales + INS (28,67%)" value={`+ ${totales.totCarFmt}`} />
            </div>
          </div>

          <div>
            {/* Bloque destacado costo total */}
            <div
              className="ink-sheen"
              style={{
                marginTop: 18,
                padding: '16px 18px',
                background: color.ink,
                borderRadius: 10,
                boxShadow: elevation[2],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span style={{ fontSize: '0.84rem', color: color.onInkMuted3, fontWeight: 500, position: 'relative' }}>
                Costo total
              </span>
              <span
                style={{
                  fontFamily: font.display,
                  fontWeight: 300,
                  fontSize: '1.75rem',
                  color: color.accent,
                  fontVariantNumeric: 'tabular-nums',
                  position: 'relative',
                }}
              >
                {costoDisplay}
              </span>
            </div>

            <Button
              variant="ghost"
              onClick={() => onNavigate('planilla')}
              style={{ marginTop: 14, width: '100%', padding: 11, fontSize: '0.84rem' }}
            >
              Ver planilla completa
            </Button>
          </div>
        </Card>
      </div>

      {/* Nivel 3: Estado de pagos vs. Acceso rápido a gestiones */}
      <div
        className="grid-2-wide"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.75fr) minmax(0, 1fr)',
          gap: 20,
          alignItems: 'stretch',
        }}
      >
        {/* Izquierda: Estado de pagos */}
        <Card style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
          <div>
            <CardHeader
              title="Estado de pagos · esta quincena"
              subtitle="Desglose individual por colaborador"
              style={{ padding: 0, border: 'none', marginBottom: 16 }}
              right={
                <a
                  href="#pagos"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('pagos');
                  }}
                  style={{ fontSize: '0.8rem', fontWeight: 600 }}
                >
                  Gestionar pagos
                </a>
              }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {emps.map((e, i) => (
                <div
                  key={e.id}
                  className="elevate-hover stagger-in"
                  style={{
                    '--i': i,
                    border: `1px solid ${color.borderSoft}`,
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10,
                    background: color.surface,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar ini={e.ini} bg={e.avBg} c={e.avC} size={32} fontSize="0.74rem" />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: color.text4,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {e.nombre}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: color.muted4 }}>{e.puesto}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: color.text3,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {e.netoFmt}
                    </span>
                    <Badge bg={e.pgBg} c={e.pgC} dot={e.pgD} size="xs">
                      {e.pgL}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Derecha: Acceso rápido a gestiones */}
        <Card style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.02rem', fontWeight: 600, color: color.text2, fontFamily: 'inherit' }}>
              Acceso rápido a gestiones
            </h2>
            <div style={{ fontSize: '0.78rem', color: color.muted, marginBottom: 16 }}>
              Módulos y documentos del sistema
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: `1px solid ${color.borderSoft}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: color.text3 }}>Reportes y Métricas</div>
                  <div style={{ fontSize: '0.74rem', color: color.muted }}>Tendencias y distribución de costos</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onNavigate('reportes')}>
                  Ver reportes
                </Button>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: `1px solid ${color.borderSoft}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: color.text3 }}>Comprobantes CCSS</div>
                  <div style={{ fontSize: '0.74rem', color: color.muted }}>Planilla mensual y recibos</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onNavigate('ccss')}>
                  Ver CCSS
                </Button>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: `1px solid ${color.borderSoft}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: color.text3 }}>Póliza INS</div>
                  <div style={{ fontSize: '0.74rem', color: color.muted }}>Riesgos del trabajo</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onNavigate('ins')}>
                  Ver INS
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, valueColor = color.text3, style }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, ...style }}>
      <span style={{ color: color.muted3 }}>{label}</span>
      <span style={{ fontWeight: 600, color: valueColor, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

