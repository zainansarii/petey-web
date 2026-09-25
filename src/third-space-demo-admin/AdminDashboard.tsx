import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowDownRight, ArrowRight, ArrowUp, ArrowUpRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import logo from "./third-space-logo.svg";
import { ADMIN_CLUBS, ADMIN_TRAINERS, change, clubsFor, count, dateLabel, DEMO_END, gapsFor, goalsFor, insightsFor, percent, periodLabel, points, rate, selectJourneys, summarise, trainersFor, trendFor, type Detail, type GoalRow, type Journey, type Period } from "./data";

type View = "clubs" | "trainers";
type Sort = "volume" | "enquiries" | "conversion";
const PAGE_SIZE = 6;

export function AdminDashboard() {
  const [clubId, setClubId] = useState("all");
  const [period, setPeriod] = useState<Period>(28);
  const [view, setView] = useState<View>("clubs");
  const [sort, setSort] = useState<Sort>("volume");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const selectedClub = ADMIN_CLUBS.find((club) => club.id === clubId);
  const data = useMemo(() => {
    const current = selectJourneys(period, clubId);
    const previous = selectJourneys(period, clubId, true);
    return { current, previous, summary: summarise(current), prior: summarise(previous), goals: goalsFor(current, previous), gaps: gapsFor(current), clubs: clubsFor(current, clubId), trainers: trainersFor(current, clubId), insights: insightsFor(current, previous, clubId), trend: trendFor(current, period) };
  }, [period, clubId]);
  const rows = (view === "clubs" ? data.clubs.map((club) => ({ ...club, volume: club.searches })) : data.trainers.map((trainer) => ({ ...trainer, volume: trainer.recommendations }))).sort((a, b) => b[sort] - a[sort] || a.name.localeCompare(b.name));
  const pages = Math.ceil(rows.length / PAGE_SIZE);
  const activePage = Math.min(page, Math.max(0, pages - 1));
  const visibleRows = rows.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE);
  const updateClub = (next: string) => { setClubId(next); setPage(0); };
  const updatePeriod = (next: Period) => { setPeriod(next); setPage(0); };
  const updateView = (next: View) => { setView(next); setSort(next === "clubs" ? "volume" : "enquiries"); setPage(0); };
  const updateSort = (next: Sort) => { setSort(next); setPage(0); };
  const metrics = [
    { label: "Completed searches", value: count(data.summary.searches), delta: change(data.summary.searches, data.prior.searches), up: data.summary.searches >= data.prior.searches, values: data.trend.map((point) => point.searches), description: "One completed matching journey per search." },
    { label: "Enquiries generated", value: count(data.summary.enquiries), delta: change(data.summary.enquiries, data.prior.enquiries), up: data.summary.enquiries >= data.prior.enquiries, values: data.trend.map((point) => point.enquiries), description: "Searches resulting in a submitted trainer enquiry." },
    { label: "Enquiry conversion", value: percent(data.summary.conversion), delta: points(data.summary.conversion - data.prior.conversion), up: data.summary.conversion >= data.prior.conversion, values: data.trend.map((point) => point.conversion), description: "Searches with an enquiry ÷ all completed searches.", dark: true },
    { label: "Unmatched searches", value: count(data.summary.unmatched), delta: change(data.summary.unmatched, data.prior.unmatched), up: data.summary.unmatched >= data.prior.unmatched, values: data.trend.map((point) => point.unmatched), description: "Completed searches that received no suitable trainer." },
  ];

  return <div className="ta-app">
    <a className="ta-skip" href="#dashboard">Skip to dashboard</a>
    <header className="ta-header">
      <a href="#dashboard" className="ta-brand" aria-label="Third Space PT insights"><img src={logo} alt="Third Space" width="175" height="18" /><span>PT insights</span></a>
      <div className="ta-header-actions"><span className="ta-demo-label"><span /> Demo · Sample data</span><a href="https://joinpetey.com/third-space-demo/" target="_blank" rel="noopener noreferrer">View matching experience <ArrowUpRight size={15} /><span className="ta-sr-only"> (opens in a new tab)</span></a></div>
    </header>
    <main id="dashboard" className="ta-main" tabIndex={-1}>
      <div className="ta-page-heading">
        <div><h1>Personal training overview</h1><p>{selectedClub ? selectedClub.name : "Across your clubs"}<span aria-hidden="true"> / </span>{periodLabel(period)}</p></div>
        <div className="ta-filters">
          <label className="ta-select"><MapPin size={15} /><span className="ta-sr-only">Club</span><select aria-label="Club" value={clubId} onChange={(event) => updateClub(event.target.value)}><option value="all">All clubs</option>{ADMIN_CLUBS.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select><ChevronDown size={13} /></label>
          <label className="ta-select"><CalendarDays size={15} /><span className="ta-sr-only">Reporting period</span><select aria-label="Reporting period" value={period} onChange={(event) => updatePeriod(Number(event.target.value) as Period)}><option value={7}>Last 7 days</option><option value={28}>Last 28 days</option><option value={90}>Last 90 days</option></select><ChevronDown size={13} /></label>
        </div>
      </div>
      <p className="ta-sr-only" role="status">{selectedClub?.name ?? "All clubs"}, last {period} days: {data.summary.searches} searches, {data.summary.enquiries} enquiries, {percent(data.summary.conversion)} conversion.</p>
      <div className="ta-metrics" aria-label="Performance summary">
        {metrics.map((metric, index) => <section key={metric.label} className={`ta-metric${metric.dark ? " ta-metric--dark" : ""}`} aria-label={metric.label} style={{ "--stagger": `${index * 45}ms` } as CSSProperties}>
          <h2>{metric.label}</h2><span className="ta-sr-only">{metric.description}</span>
          <div className="ta-metric-value"><strong>{metric.value}</strong><Sparkline values={metric.values} /></div>
          <p><span>{metric.up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{metric.delta}</span> vs previous {period} days</p>
        </section>)}
      </div>
      <div className="ta-workspace">
        <div className="ta-primary">
          <section className="ta-demand" aria-labelledby="demand-title">
            <SectionHeading id="demand-title" title="What members want" detail={`Primary goals from ${count(data.summary.searches)} searches.`} extra={<span className="ta-note">Share change vs previous period</span>} />
            <GoalBars rows={data.goals} onSelect={(goal) => setDetail({ kind: "goal", goal })} />
          </section>
          <section className="ta-performance" aria-labelledby="performance-title">
            <SectionHeading id="performance-title" title="Performance, at a glance" detail={view === "clubs" ? "See where interest turns into a conversation." : "Enquiries in the context of each trainer’s exposure."} extra={<div className="ta-view-toggle" aria-label="Performance view"><button aria-pressed={view === "clubs"} onClick={() => updateView("clubs")}>Clubs</button><button aria-pressed={view === "trainers"} onClick={() => updateView("trainers")}>Trainers</button></div>} />
            <div className="ta-scroll-hint">Scroll for all columns <ArrowRight size={12} /></div>
            <div className="ta-table-scroll" tabIndex={0} role="region" aria-label={`${view === "clubs" ? "Club" : "Trainer"} performance table`}>
              <table className="ta-table">
                <caption className="ta-sr-only">{view === "clubs" ? "Club" : "Trainer"} performance, {selectedClub?.name ?? "all clubs"}, {periodLabel(period)}. Sorted descending by {sort}.</caption>
                <thead><tr><th scope="col">{view === "clubs" ? "Club" : "Trainer"}</th><SortHeading active={sort === "volume"} onClick={() => updateSort("volume")}>{view === "clubs" ? "Searches" : "Recommended"}</SortHeading><SortHeading active={sort === "enquiries"} onClick={() => updateSort("enquiries")}>Enquiries</SortHeading><SortHeading active={sort === "conversion"} onClick={() => updateSort("conversion")}>Conversion</SortHeading><th scope="col">{view === "clubs" ? "Unmatched" : "Top goal"}</th><th scope="col"><span className="ta-sr-only">Explore</span></th></tr></thead>
                <tbody>{visibleRows.map((row) => <tr key={row.id}>
                  <th scope="row"><button className="ta-row-name" onClick={() => setDetail({ kind: view === "clubs" ? "club" : "trainer", id: row.id })}>{view === "trainers" && <span className="ta-avatar" aria-hidden="true">{initials(row.name)}</span>}<span>{row.name}{"clubId" in row && <small>{ADMIN_CLUBS.find((club) => club.id === row.clubId)?.name}</small>}</span></button></th>
                  <td>{count(row.volume)}</td><td>{count(row.enquiries)}</td><td><span className="ta-table-rate"><span className="ta-rate-track" aria-hidden="true"><span style={{ width: `${row.conversion}%` }} /></span>{percent(row.conversion)}</span></td>
                  <td>{"unmatched" in row ? <span className="ta-unmatched-cell">{row.unmatched}<small>{percent(rate(row.unmatched, row.searches))}</small></span> : <span className="ta-table-goal">{row.topGoal}</span>}</td>
                  <td><button className="ta-icon-button" aria-label={`Explore ${row.name}`} onClick={() => setDetail({ kind: view === "clubs" ? "club" : "trainer", id: row.id })}><ArrowUpRight size={16} /></button></td>
                </tr>)}</tbody>
              </table>
            </div>
            <div className="ta-table-footer"><span>{activePage * PAGE_SIZE + 1}–{Math.min((activePage + 1) * PAGE_SIZE, rows.length)} of {rows.length} {view}</span><span className="ta-table-explainer">{view === "clubs" ? "Conversion = enquiries ÷ searches" : "Conversion = enquiries ÷ recommendations"}</span><div><button className="ta-icon-button" disabled={activePage === 0} onClick={() => setPage(activePage - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button><button className="ta-icon-button" disabled={activePage + 1 >= pages} onClick={() => setPage(activePage + 1)} aria-label="Next page"><ChevronRight size={16} /></button></div></div>
          </section>
        </div>
        <aside className="ta-rail">
          <section className="ta-gaps" aria-labelledby="gaps-title">
            <SectionHeading id="gaps-title" title="Room for a better match" detail="Where the highest share of searches go unmatched." />
            {data.gaps.slice(0, 3).map((gap, index) => <button className="ta-gap" key={`${gap.clubId}-${gap.goal}`} onClick={() => setDetail({ kind: "gap", id: gap.clubId, goal: gap.goal })}>
              <span className="ta-gap-top"><span>{gap.clubName}</span><ArrowUpRight size={15} /></span><strong>{gap.goal}</strong><span className="ta-gap-value">{Math.round(gap.rate)}<small>% unmatched</small></span><span className="ta-gap-track" aria-hidden="true"><span style={{ width: `${gap.rate}%`, opacity: 1 - index * .2 }} /></span><span className="ta-gap-base">{gap.unmatched} of {gap.searches} searches</span>
            </button>)}
            {!data.gaps.length && <p className="ta-empty">No unmatched segments with enough searches to compare.</p>}
            <p className="ta-gap-minimum">At least 20 searches per goal and club.</p>
          </section>
          <section className="ta-insights" aria-labelledby="insights-title">
            <SectionHeading id="insights-title" title="Worth your attention" />
            {data.insights.map((insight, index) => <button className="ta-insight" key={insight.title} onClick={() => setDetail(insight.detail)}><span className="ta-insight-number">0{index + 1}</span><span><strong>{insight.title}</strong><span className="ta-insight-evidence">{insight.evidence}</span><span className="ta-insight-action">{insight.action}<ArrowRight size={13} /></span></span></button>)}
          </section>
        </aside>
      </div>
      <footer className="ta-footer"><span>Demonstration only. All figures and trainer identities are fictional.</span><a href="https://joinpetey.com" target="_blank" rel="noopener noreferrer">Powered by <strong>Petey</strong><ArrowUpRight size={12} /><span className="ta-sr-only"> (opens in a new tab)</span></a></footer>
    </main>
    {detail && <DetailPanel key={`${JSON.stringify(detail)}-${period}-${clubId}`} detail={detail} period={period} clubId={clubId} current={data.current} previous={data.previous} onClose={() => setDetail(null)} onFilterClub={(id) => { updateClub(id); setDetail(null); window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }} />}
  </div>;
}

function initials(name: string) { return name.split(" ").map((part) => part[0]).slice(0, 2).join(""); }
function SectionHeading({ id, title, detail, extra }: { id: string; title: string; detail?: string; extra?: ReactNode }) {
  return <div className="ta-section-heading"><div><h2 id={id}>{title}</h2>{detail && <p>{detail}</p>}</div>{extra}</div>;
}
function SortHeading({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <th scope="col" aria-sort={active ? "descending" : "none"}><button onClick={onClick}>{children}{active && <ArrowDown size={12} />}</button></th>;
}
function Sparkline({ values }: { values: number[] }) {
  const maximum = Math.max(...values, 1);
  const minimum = Math.min(...values) * .8;
  const path = values.map((value, index) => `${index ? "L" : "M"}${index / (values.length - 1) * 78 + 1},${32 - (value - minimum) / (maximum - minimum || 1) * 28}`).join(" ");
  return <svg className="ta-sparkline" width="82" height="36" viewBox="0 0 82 36" fill="none" aria-hidden="true"><path d={path} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function GoalBars({ rows, onSelect, compact = false }: { rows: GoalRow[]; onSelect?: (goal: GoalRow["goal"]) => void; compact?: boolean }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return <div className={`ta-goal-bars${compact ? " ta-goal-bars--compact" : ""}`}>{rows.map((row, index) => {
    const content = <><span className="ta-goal-top"><span>{row.goal}</span><span className="ta-goal-stats"><strong>{count(row.count)}</strong><span>{percent(row.share)}</span></span></span><span className="ta-goal-bottom"><span className="ta-goal-track" aria-hidden="true"><span style={{ width: `${row.count / max * 100}%`, opacity: 1 - index * .13 }} /></span>{!compact && <span className="ta-goal-change">{row.change >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}{Math.abs(row.change).toFixed(1)} pp</span>}</span></>;
    return onSelect ? <button key={row.goal} className="ta-goal" onClick={() => onSelect(row.goal)} aria-label={`Explore ${row.goal}: ${row.count} searches, ${percent(row.share)} of searches, ${points(row.change)} share change`}>{content}</button> : <div className="ta-goal" key={row.goal}>{content}</div>;
  })}</div>;
}

function DetailPanel({ detail, period, clubId, current, previous, onClose, onFilterClub }: { detail: Detail; period: Period; clubId: string; current: Journey[]; previous: Journey[]; onClose: () => void; onFilterClub: (id: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const trainer = detail.kind === "trainer" ? ADMIN_TRAINERS.find((item) => item.id === detail.id) : undefined;
  const club = "id" in detail ? ADMIN_CLUBS.find((item) => item.id === (trainer?.clubId ?? detail.id)) : undefined;
  const matches = (journey: Journey) => detail.kind === "trainer" ? journey.trainerIds.includes(detail.id) : detail.kind === "club" ? journey.clubId === detail.id : detail.kind === "gap" ? journey.clubId === detail.id && journey.goal === detail.goal : journey.goal === detail.goal;
  const subset = current.filter(matches);
  const prior = previous.filter(matches);
  const summary = summarise(subset);
  const enquiryCount = trainer ? subset.filter((journey) => journey.enquiryTrainerId === trainer.id).length : summary.enquiries;
  const conversion = rate(enquiryCount, subset.length);
  const title = trainer?.name ?? (detail.kind === "goal" || detail.kind === "gap" ? detail.goal : club?.name ?? "Performance");
  const filteredClub = ADMIN_CLUBS.find((item) => item.id === clubId);
  const context = trainer ? `${club?.name} · Sample trainer` : detail.kind === "gap" ? `${club?.name} · Unmatched demand` : detail.kind === "goal" ? `${filteredClub?.name ?? "All clubs"} · Member demand` : "Club performance";
  const clubBreakdown = clubsFor(subset, detail.kind === "club" || detail.kind === "gap" ? detail.id : clubId).filter((row) => row.searches > 0);
  const trainerBreakdown = !trainer && detail.kind !== "goal" ? trainersFor(subset, club?.id ?? clubId) : [];
  const trend = trendFor(subset, period, trainer?.id);
  useEffect(() => {
    const dialog = ref.current!;
    const focused = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus();
    return () => { dialog.close(); document.body.style.overflow = overflow; if (focused instanceof HTMLElement && focused.isConnected) focused.focus(); };
  }, []);

  return <dialog ref={ref} className="ta-detail" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <article className="ta-detail-content">
      <div className="ta-detail-top"><span>Explore the detail</span><button ref={closeRef} className="ta-icon-button" onClick={onClose} aria-label="Close details"><X size={21} /></button></div>
      <div className="ta-detail-title">{trainer && <span className="ta-avatar ta-avatar--large" aria-hidden="true">{initials(trainer.name)}</span>}<h2 id={titleId}>{title}</h2><p>{context}</p><span>{periodLabel(period)}</span></div>
      <div className="ta-detail-metrics"><div><span>{trainer ? "Recommended" : "Searches"}</span><strong>{count(subset.length)}</strong></div><div><span>Enquiries</span><strong>{count(enquiryCount)}</strong></div><div><span>Conversion</span><strong>{percent(conversion)}</strong></div></div>
      <p className="ta-detail-definition">{trainer ? "Enquiries to this trainer ÷ searches where they were recommended." : "Searches resulting in an enquiry ÷ all searches in this view."}</p>
      {detail.kind === "gap" && <div className="ta-detail-callout"><strong>{summary.unmatched} of {summary.searches} searches received no match.</strong><p>Review the relevant trainers and their profile evidence. A gap in this sample does not establish a staffing shortage.</p></div>}
      <section className="ta-detail-section"><h3>Enquiry conversion over time</h3><ConversionChart points={trend} /><div className="ta-trend-values">{trend.map((point) => <div key={point.label}><span>{point.label}</span><strong>{percent(point.conversion)}</strong><small>{point.enquiries} / {point.searches}</small></div>)}</div></section>
      {detail.kind === "goal" || detail.kind === "gap" ? <section className="ta-detail-section"><h3>{detail.kind === "goal" ? "Demand by club" : "Trainer coverage"}</h3>{detail.kind === "goal" ? clubBreakdown.map((row) => <button className="ta-breakdown" key={row.id} onClick={() => onFilterClub(row.id)}><span>{row.name}<small>{row.unmatched} unmatched</small></span><span>{row.searches} searches<ArrowUpRight size={14} /></span></button>) : trainerBreakdown.map((row) => <div className="ta-breakdown" key={row.id}><span>{row.name}<small>Sample trainer</small></span><span>{row.recommendations} recommendations</span></div>)}</section> : <section className="ta-detail-section"><h3>{trainer ? "Who this trainer is reaching" : "What members want"}</h3><GoalBars rows={goalsFor(subset, prior)} compact /></section>}
      {trainer && <p className="ta-detail-note">Read conversion alongside exposure and client needs. Recommendation position can affect interest; these sample figures are not a measure of coaching quality.</p>}
      {club && clubId !== club.id && <button className="ta-button" onClick={() => onFilterClub(club.id)}>View {club.name} dashboard<ArrowRight size={16} /></button>}
      <div className="ta-detail-footer">Sample data · Period ending {dateLabel(DEMO_END)} 2026</div>
    </article>
  </dialog>;
}

function ConversionChart({ points: values }: { points: { conversion: number; label: string }[] }) {
  const id = useId().replaceAll(":", "");
  const width = 440, height = 126;
  const max = Math.max(50, ...values.map((value) => Math.ceil(value.conversion / 10) * 10));
  const path = values.map((value, index) => `${index ? "L" : "M"}${index / (values.length - 1) * (width - 20) + 10},${height - 10 - value.conversion / max * (height - 20)}`).join(" ");
  return <svg className="ta-conversion-chart" viewBox={`0 0 ${width} ${height}`} aria-hidden="true"><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#171717" stopOpacity=".09" /><stop offset="1" stopColor="#171717" stopOpacity="0" /></linearGradient></defs>{[.25, .5, .75].map((y) => <line key={y} x1="0" x2={width} y1={height * y} y2={height * y} stroke="#e7e7e3" strokeDasharray="3 5" />)}<path d={`${path} L${width - 10},${height} L10,${height} Z`} fill={`url(#${id})`} /><path d={path} fill="none" stroke="#171717" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />{values.map((value, index) => <circle key={value.label} cx={index / (values.length - 1) * (width - 20) + 10} cy={height - 10 - value.conversion / max * (height - 20)} r="3" fill="#171717" />)}</svg>;
}
