import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { curveMonotoneX, line } from "d3-shape";
import { motion, useReducedMotion } from "motion/react";
import "./enquiry-activity-chart.css";

export interface ActivityPoint {
  date: string;
  label: string;
  detailLabel?: string;
  received: number;
  unlocked: number;
}

const WIDTH = 800;
const HEIGHT = 310;
const LEFT = 48;
const RIGHT = 776;
const TOP = 94;
const BOTTOM = 270;
const series = [{ key: "received", label: "Enquiries" }, { key: "unlocked", label: "Unlocked" }] as const;

export function EnquiryActivityChart({ points, description }: {
  points: ActivityPoint[];
  description: string;
}) {
  const id = useId().replaceAll(":", "");
  const reduceMotion = useReducedMotion();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visible, setVisible] = useState({ received: true, unlocked: true });
  const plot = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (entered || !plot.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setEntered(true); observer.disconnect(); }
    }, { threshold: .25 });
    observer.observe(plot.current);
    return () => observer.disconnect();
  }, [entered]);
  const selectedIndex = points.findIndex(point => point.date === selectedDate);
  const activeIndex = selectedIndex < 0 ? Math.max(0, points.length - 1) : selectedIndex;
  const active = points[activeIndex];
  const hasSeries = visible.received || visible.unlocked;
  const peak = Math.max(4, ...points.flatMap(point => [point.received, point.unlocked]));
  const magnitude = 10 ** Math.floor(Math.log10(peak / 4));
  const step = ([1, 2, 5, 10].find(value => value * magnitude >= peak / 4) ?? 10) * magnitude;
  const maximum = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: Math.round(maximum / step) + 1 }, (_, index) => index * step);
  const x = (index: number) => points.length === 1 ? (LEFT + RIGHT) / 2 : LEFT + index / Math.max(1, points.length - 1) * (RIGHT - LEFT);
  const y = (value: number) => BOTTOM - value / maximum * (BOTTOM - TOP);
  const curves = series.map(item => ({ ...item, path: line<ActivityPoint>().x((_, index) => x(index)).y(point => y(point[item.key])).curve(curveMonotoneX)(points) ?? "" }));
  const totals = { received: points.reduce((sum, point) => sum + point.received, 0), unlocked: points.reduce((sum, point) => sum + point.unlocked, 0) };
  const axisIndices = [...new Set([0, .25, .5, .75, 1].map(fraction => Math.round((points.length - 1) * fraction)))];
  const summary = active ? `${active.detailLabel ?? active.label}: ${active.received} enquiries, ${active.unlocked} unlocked.` : "No activity data available.";
  const transition = reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 350, damping: 34, mass: .65 };
  const focusY = active ? Math.min(...series.filter(item => visible[item.key]).map(item => y(active[item.key]))) : TOP;
  const selectedX = x(activeIndex);
  const tooltipLeft = Math.min(87, Math.max(13, selectedX / WIDTH * 100));
  const tooltipTop = Math.max(4, focusY / HEIGHT * 100 - 29);

  function pointAt(event: PointerEvent<HTMLDivElement>) {
    if (!points.length || !hasSeries) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = ((event.clientX - bounds.left) / bounds.width * WIDTH - LEFT) / (RIGHT - LEFT);
    const index = Math.max(0, Math.min(points.length - 1, Math.round(position * (points.length - 1))));
    setSelectedDate(points[index].date);
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = event.key === "Home" ? 0 : event.key === "End" ? points.length - 1
      : ["ArrowRight", "ArrowUp"].includes(event.key) ? activeIndex + 1
      : ["ArrowLeft", "ArrowDown"].includes(event.key) ? activeIndex - 1 : null;
    if (next === null || !points.length) return;
    event.preventDefault();
    setSelectedDate(points[Math.max(0, Math.min(points.length - 1, next))].date);
  }

  return <div className="activity-chart" role="group" aria-label="Enquiry activity">
    <div className="activity-chart__legend" aria-label="Visible chart series">
      {series.map(item => <button key={item.key} type="button" aria-pressed={visible[item.key]} aria-label={`${item.label} series`} className={`activity-chart__series activity-chart__series--${item.key}`} onClick={() => setVisible(current => ({ ...current, [item.key]: !current[item.key] }))}>
        <i aria-hidden="true" /><span>{item.label}<strong>{totals[item.key]}</strong></span>
      </button>)}
    </div>
    <div ref={plot} className="activity-chart__plot" role={active && hasSeries ? "slider" : "img"} tabIndex={active && hasSeries ? 0 : undefined}
      aria-label={active && hasSeries ? "Explore enquiry activity" : "Enquiry activity chart"} aria-orientation={active && hasSeries ? "horizontal" : undefined}
      aria-valuemin={active && hasSeries ? 1 : undefined} aria-valuemax={active && hasSeries ? points.length : undefined} aria-valuenow={active && hasSeries ? activeIndex + 1 : undefined}
      aria-valuetext={active && hasSeries ? summary : undefined} aria-describedby={`${id}-help`}
      onPointerMove={pointAt} onPointerDown={event => { pointAt(event); event.currentTarget.focus({ preventScroll: true }); }} onKeyDown={onKeyDown}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>{series.map(item => <linearGradient key={item.key} id={`${id}-${item.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={`var(--chart-${item.key}-fill)`} stopOpacity=".2" /><stop offset="100%" stopColor={`var(--chart-${item.key}-fill)`} stopOpacity="0" /></linearGradient>)}
          <pattern id={`${id}-dots`} width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="var(--chart-grid)" /></pattern>
          <clipPath id={`${id}-reveal`}><motion.rect key={points.map(point => point.date).join()} x="0" y="0" height={HEIGHT} initial={{ width: reduceMotion ? WIDTH : 0 }} animate={{ width: entered || reduceMotion ? WIDTH : 0 }} transition={{ duration: reduceMotion ? 0 : 1, ease: [.22, 1, .36, 1] }} /></clipPath>
        </defs>
        <rect x={LEFT} y={TOP} width={RIGHT - LEFT} height={BOTTOM - TOP} fill={`url(#${id}-dots)`} opacity=".6" />
        {ticks.map(value => <line key={value} x1={LEFT} x2={RIGHT} y1={y(value)} y2={y(value)} className="activity-chart__grid" />)}
        {curves.map(item => <motion.g key={`${item.key}-${points.map(point => point.date).join()}`} clipPath={`url(#${id}-reveal)`} animate={{ opacity: visible[item.key] ? 1 : 0 }} transition={{ duration: reduceMotion ? 0 : .2 }}>
          {points.length > 1 && <motion.path d={`${item.path} L ${x(points.length - 1)},${BOTTOM} L ${x(0)},${BOTTOM} Z`} fill={`url(#${id}-${item.key})`} initial={{ opacity: reduceMotion ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion ? 0 : .8 }} />}
          <path className={`activity-chart__line activity-chart__line--${item.key}`} d={item.path} />
        </motion.g>)}
        {active && hasSeries && <motion.line x1={selectedX} x2={selectedX} y1={TOP - 8} y2={BOTTOM} className="activity-chart__crosshair" initial={false} animate={{ x1: selectedX, x2: selectedX }} transition={transition} />}
      </svg>
      <div className="activity-chart__axis" aria-hidden="true">{ticks.map(value => <span key={value} style={{ top: `${y(value) / HEIGHT * 100}%` }}>{value}</span>)}</div>
      <div className="activity-chart__dates" aria-hidden="true">{points.length > 0 && axisIndices.map(index => <span key={index} className={index === 0 || index === Math.round((points.length - 1) / 2) || index === points.length - 1 ? "" : "is-secondary"} style={{ left: `${x(index) / WIDTH * 100}%` }}>{points[index].label}</span>)}</div>
      {active && hasSeries && <>
        <motion.div className="activity-chart__readout" aria-hidden="true" initial={false} animate={{ left: `clamp(90px, ${tooltipLeft}%, calc(100% - 90px))`, top: `${tooltipTop}%` }} transition={transition}>
          <span>{active.detailLabel ?? active.label}</span><div>{series.filter(item => visible[item.key]).map(item => <span key={item.key}><i className={`activity-chart__dot--${item.key}`} /><strong>{active[item.key]}</strong><small>{item.label}</small></span>)}</div>
        </motion.div>
        {series.filter(item => visible[item.key]).map(item => <motion.span key={item.key} aria-hidden="true" className={`activity-chart__marker activity-chart__marker--${item.key}`} initial={false} animate={{ left: `${selectedX / WIDTH * 100}%`, top: `${y(active[item.key]) / HEIGHT * 100}%` }} transition={transition} />)}
      </>}
      {(!points.length || !hasSeries) && <p className="activity-chart__empty">{points.length ? "Choose a series above to explore activity." : "Your activity will appear here with your first enquiry."}</p>}
    </div>
    <p className="activity-chart__help" id={`${id}-help`}>Hover or tap to explore<span> · Use ← → when focused</span></p>
    <p className="activity-chart__caption">{description}</p>
  </div>;
}
