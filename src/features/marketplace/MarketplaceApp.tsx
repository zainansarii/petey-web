import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Check, LayoutDashboard, MapPin, MessageCircle, Pencil, UserRound, Wallet } from "lucide-react";
import { BrandMark } from "../../shared/ui/BrandMark";
import { EnquiryActivityChart } from "../../shared/ui/EnquiryActivityChart";
import { getFirebaseAuth } from "../auth/api/magicLink";
import { AccessGate } from "./AccessGate";
import { Conversation } from "./Conversation";
import { ProfileEditor } from "./ProfileEditor";
import { TraineeInbox } from "./TraineeInbox";
import { errorMessage, marketplace, watchInbox } from "./api";
import { outcomeLabels } from "./model";
import type { Access, Dashboard, InboxItem, InboxPage, ProfileWorkspace } from "./model";

const nav = [{ id: "overview", label: "Overview", icon: LayoutDashboard }, { id: "enquiries", label: "Enquiries", icon: MessageCircle }, { id: "profile", label: "My profile", icon: UserRound }, { id: "spending", label: "Spending", icon: Wallet }];
const route = () => location.hash.slice(1).split("/");
const go = (hash: string) => { location.hash = hash; };
export function MarketplaceApp({ trainer = true }: { trainer?: boolean }) { return <div className={`td-app mp-app${trainer ? "" : " mp-app--trainee"}`}><AccessGate trainer={trainer}>{access => <Workspace access={access} trainer={trainer} />}</AccessGate></div>; }
function Workspace({ access, trainer }: { access: Access; trainer: boolean }) {
  const [path, setPath] = useState(route); const [days, setDays] = useState<7 | 28>(28); const [data, setData] = useState<Dashboard | null>(null);
  const [profile, setProfile] = useState<ProfileWorkspace | null>(null); const [items, setItems] = useState<InboxItem[]>([]);
  const [error, setError] = useState(""); const [loaded, setLoaded] = useState(false); const [tick, setTick] = useState(0); const [preferences, setPreferences] = useState(access.preferences);
  const [search, setSearch] = useState(""); const [visible, setVisible] = useState(20);
  const changed = useCallback(() => setTick(value => value + 1), []);
  const page = trainer ? nav.some(item => item.id === path[0]) ? path[0] : "overview" : "enquiries";
  const selected = trainer ? path[1] : path[0]; const conversation = /^[a-f0-9]{64}$/.test(selected ?? "") ? selected : null;
  const filter = !trainer || conversation ? "all" : selected || "all";
  useEffect(() => { const update = () => { setPath(route()); setVisible(20); setSearch(""); document.getElementById("workspace-content")?.scrollTo(0, 0); window.scrollTo(0, 0); }; window.addEventListener("hashchange", update); return () => window.removeEventListener("hashchange", update); }, []);
  useEffect(() => {
    let alive = true; let stop = () => {};
    void watchInbox(access.uid, () => { if (alive) changed(); }, e => { if (alive) { setError(errorMessage(e)); setItems([]); } }).then(unsubscribe => { stop = unsubscribe; if (!alive) stop(); });
    return () => { alive = false; stop(); };
  }, [access.uid, changed]);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const all: InboxItem[] = []; let cursor: string | null = null;
        do { const result: InboxPage = await marketplace({ action: "inbox", ...(cursor ? { cursor } : {}) }); all.push(...result.items); cursor = result.nextCursor; } while (cursor && alive);
        const [dashboard, workspace] = trainer ? await Promise.all([marketplace<Dashboard>({ action: "dashboard", days }), marketplace<ProfileWorkspace>({ action: "profile" })]) : [null, null];
        if (alive) { setItems(all); setData(dashboard); setProfile(workspace); setError(""); setLoaded(true); }
      } catch (e) { if (alive) { setError(errorMessage(e)); setLoaded(true); } }
    }
    void load(); return () => { alive = false; };
  }, [access.uid, trainer, days, tick]);
  const openEnquiry = (id: string) => go(trainer ? `enquiries/${id}` : id);
  const actionable = (item: InboxItem) => !item.withdrawnAt && !item.blocked && !["closed", "started"].includes(item.outcome ?? "open");
  const filtered = items.filter(item => {
    const status = filter === "all" || (filter === "new" ? !item.unlockedAt && actionable(item) : filter === "reply" ? item.unlockedAt && !item.firstReplyAt && actionable(item) : filter === "followup" ? data?.reminders.some(reminder => reminder.id === item.id) : item.outcome === filter);
    return status && `${item.traineeLabel} ${item.trainerName} ${item.summary.goals}`.toLowerCase().includes(search.trim().toLowerCase());
  });
  const currentItem = items.find(item => item.id === conversation);
  const heading = page === "overview" ? `Welcome back${profile ? `, ${profile.published.name.split(" ")[0]}` : ""}` : page === "profile" ? "Your trainer profile" : page === "spending" ? "Your unlock spending" : trainer ? "Your enquiries" : "Your inbox";
  const unread = items.reduce((sum, item) => sum + item.unreadCount, 0);
  return <><a className="td-skip" href="#workspace-content" onClick={event => { event.preventDefault(); document.getElementById("workspace-content")?.focus(); }}>{trainer ? "Skip to workspace" : "Skip to inbox"}</a>{trainer && <div className="td-preview-bar"><span><span className="td-preview-dot" /> Free trainer pilot · £0 per unlock</span>{!access.pilotEnabled && <span>New enquiries are paused</span>}</div>}<header className={`td-topbar${trainer ? "" : " mp-trainee-header"}`}><a className="td-brand" href={import.meta.env.BASE_URL} aria-label="Petey home"><BrandMark />{trainer && <span>for trainers</span>}</a><nav aria-label={trainer ? "Trainer navigation" : "Trainee navigation"}>{trainer ? nav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? "is-active" : ""} aria-current={page === id ? "page" : undefined} onClick={() => go(id)}><Icon size={17} /><span>{label}</span>{id === "enquiries" && unread > 0 && <span className="td-nav-count" aria-label={`${unread} unread messages`}>{unread}</span>}</button>) : <><a href={import.meta.env.BASE_URL}>Your trainer matches</a><button className="is-active" aria-current="page" onClick={() => go("")}><MessageCircle aria-hidden="true" size={17} /><span>Inbox</span>{unread > 0 && <span className="td-nav-count" aria-label={`${unread} unread messages`}>{unread}</span>}</button></>}</nav><button className="td-text-button" onClick={async () => { const { signOut } = await import("firebase/auth"); await signOut(await getFirebaseAuth()); }}>Sign out</button></header>
    <main className="td-scroll" id="workspace-content" tabIndex={-1}><div className="td-page"><div className="td-page-heading"><div><h1>{heading}{trainer && <span className="td-heading-dot">.</span>}</h1>{page !== "overview" && <p>{page === "profile" ? "Help the right people find you." : page === "spending" ? "Every pilot unlock is free. No payment details needed." : trainer ? "Keep your training conversations together in Petey." : "Messages with the trainers you’ve contacted."}</p>}</div>{trainer && ["overview", "spending"].includes(page) && <label className="td-period"><CalendarDays size={16} /><select aria-label="Reporting period" value={days} onChange={event => setDays(Number(event.target.value) as 7 | 28)}><option value={28}>Last 28 days</option><option value={7}>Last 7 days</option></select></label>}</div>
      {error && <div className="mp-error" role="alert">{error} <button onClick={changed}>Retry</button></div>}
      {!loaded ? <div className="mp-panel" role="status">{trainer ? "Loading your workspace…" : "Loading your conversations…"}</div> : error && !items.length ? null : <>
        {page === "overview" && data && profile && <div className="td-overview"><div className="td-primary"><div className="td-summary-grid"><section className="td-profile-card"><div className="td-panel-top"><span>Your profile</span><button className="td-icon-button" aria-label="Edit your profile" onClick={() => go("profile")}><Pencil size={15} /></button></div><div className="td-portrait"><img src={profile.photoUrl} alt="" /></div><h2>{profile.published.name}</h2><p>{profile.published.specialties[0]}</p><div className="td-location"><MapPin size={12} />{profile.published.area}</div><button className={`td-availability ${profile.published.acceptingNewClients ? "" : "is-paused"}`} onClick={async () => { try { setProfile(await marketplace({ action: "capacity", accepting: !profile.published.acceptingNewClients, expectedVersion: profile.version })); changed(); } catch (e) { setError(errorMessage(e)); } }}><span />{profile.published.acceptingNewClients ? "Accepting new clients" : "New enquiries paused"}</button><button className="td-text-button" onClick={() => go("profile")}>View and edit profile <ArrowRight size={12} /></button></section>
          <Metric title="New enquiries" number={data.queues.new} dark={false} onClick={() => go("enquiries/new")} /><Metric title="Needs a reply" number={data.queues.reply} dark onClick={() => go("enquiries/reply")} /><div className="td-funnel"><span><strong>{data.cohort.received}</strong>received</span><ArrowRight size={14} /><span><strong>{data.cohort.unlocked}</strong>unlocked</span><ArrowRight size={14} /><span><strong>{data.cohort.started}</strong>started training*</span></div></div>
          <section className="td-section"><div className="td-section-heading"><div><h2>Enquiry activity</h2></div><strong className="mp-conversion">{data.cohort.conversion === null ? "—" : `${Math.round(data.cohort.conversion * 100)}%`}<small>cohort conversion*</small></strong></div><Trend data={data} /><p className="mp-muted">*Started training is trainer-reported. Conversion uses unlocked enquiries received in the same {days}-day period.</p></section>
          <section className="td-section"><div className="td-section-heading"><h2>Latest enquiries</h2><button className="td-text-button" onClick={() => go("enquiries")}>View all <ArrowRight size={14} /></button></div><EnquiryList items={items.slice(0, 4)} trainer onSelect={openEnquiry} /></section>
        </div><aside className="td-rail"><section><h2>What people want to work on</h2>{data.goals.length ? data.goals.map(goal => <div className="mp-goal" key={goal.category}><div><span>{goal.category}</span><strong>{goal.count}</strong></div><progress value={goal.count} max={Math.max(1, data.cohort.received)} aria-label={goal.category} /></div>) : <p className="mp-empty-copy">Goals will appear with your first enquiries.</p>}</section></aside></div>}
        {page === "enquiries" && (conversation ? <Conversation key={conversation} uid={access.uid} id={conversation} updated={JSON.stringify(currentItem)} onBack={() => go(trainer ? "enquiries" : "")} onChange={changed} /> : <>{trainer && <div className="mp-inbox-controls"><label>Status<select aria-label="Enquiry status" value={filter} onChange={event => go(`enquiries/${event.target.value}`)}><option value="all">All enquiries</option><option value="new">New enquiries</option><option value="reply">Needs a reply</option><option value="followup">Follow-ups</option>{Object.entries(outcomeLabels).filter(([key]) => key !== "open").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Search enquiries<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or training goal" /></label><p className="mp-muted">All dates · {filtered.length} {filtered.length === 1 ? "enquiry" : "enquiries"}</p></div>}<EnquiryList items={filtered.slice(0, visible)} trainer={trainer} onSelect={openEnquiry} searching={Boolean(search.trim())} onClearSearch={() => setSearch("")} />{filtered.length > visible && <button className="td-button td-button--white" onClick={() => setVisible(value => value + 20)}>{trainer ? "Load more enquiries" : "Load more conversations"}</button>}</>)}
        {page === "profile" && profile && access.membership && <ProfileEditor uid={access.uid} trainerId={access.membership.trainerId} workspace={profile} onChange={setProfile} />}
        {page === "spending" && data && <Spending data={data} days={days} />}
      </>}
      {trainer ? <footer className="mp-inbox-preferences"><details><summary>Email preferences</summary><div>{(["enquiries", "messages"] as const).map(key => <label className="mp-checkbox" key={key}><input type="checkbox" checked={preferences[key]} onChange={async event => { const next = { ...preferences, [key]: event.target.checked }; try { await marketplace({ action: "preferences", preferences: next }); setPreferences(next); } catch (e) { setError(errorMessage(e)); } }} />{key === "enquiries" ? "New enquiry emails" : "Unread message emails"}</label>)}</div></details></footer> : !conversation && <footer className="mp-inbox-preferences"><details><summary>Email preferences</summary><label className="mp-checkbox"><input type="checkbox" checked={preferences.messages} onChange={async event => { const next = { ...preferences, messages: event.target.checked }; try { await marketplace({ action: "preferences", preferences: next }); setPreferences(next); } catch (e) { setError(errorMessage(e)); } }} />Unread message emails</label></details></footer>}

    </div></main></>;
}
function Metric({ title, number, dark, onClick }: { title: string; number: number; dark: boolean; onClick: () => void }) { return <button className={`td-metric td-metric--${dark ? "dark" : "lime"}`} onClick={onClick}><span className="td-metric-top">{title}<span className="td-metric-icon"><MessageCircle size={18} /></span></span><strong className="td-metric-number">{number}</strong><span className="td-metric-footer">View all dates <ArrowRight size={15} /></span></button>; }
function EnquiryList({ items, trainer, onSelect, searching = false, onClearSearch }: { items: InboxItem[]; trainer: boolean; onSelect: (id: string) => void; searching?: boolean; onClearSearch?: () => void }) {
  if (!trainer) return <TraineeInbox items={items} onSelect={onSelect} />;
  return <div className="mp-enquiry-list">{items.length ? items.map(item => {
    const name = item.traineeLabel;
    const status = item.withdrawnAt ? "Withdrawn" : item.blocked ? "Blocked"
      : item.outcome && item.outcome !== "open" ? outcomeLabels[item.outcome]
      : item.unlockedAt ? !item.firstReplyAt ? "Needs a reply" : "Unlocked" : "New enquiry";
    return <button key={item.id} className="mp-enquiry-row" onClick={() => onSelect(item.id)}>
      <span className="mp-initials" aria-hidden="true">{name.split(" ").map(part => part[0]).slice(0, 2).join("")}</span>
      <span className="mp-enquiry-person"><strong>{name}</strong><span>{item.summary.goals}</span><small>{item.summary.area || "Area not specified"} · {new Date(item.createdAt).toLocaleDateString("en-GB")}</small></span>
      <span className="mp-enquiry-status">{status}{item.unreadCount > 0 && <strong className="td-nav-count">{item.unreadCount} unread</strong>}</span><ArrowRight aria-hidden="true" size={17} />
    </button>;
  }) : <div className="mp-empty"><MessageCircle aria-hidden="true" size={28} />
    <h3>{searching ? "No enquiries found" : "No enquiries here yet"}</h3>
    <p>{searching ? "Try another name or training goal." : "Your next connection will appear here when a trainee gets in touch."}</p>
    {searching && <button className="td-text-button" onClick={onClearSearch}>Clear search</button>}
  </div>}</div>;
}

function Trend({ data }: { data: Dashboard }) {
  return <EnquiryActivityChart points={data.trend.map(day => ({ ...day, label: new Date(`${day.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) }))} description="Daily totals in UTC. Enquiries use the date received; unlocks use the date unlocked." />;
}
function Spending({ data, days }: { data: Dashboard; days: number }) {
  const start = new Date(); start.setUTCHours(0,0,0,0); start.setUTCDate(start.getUTCDate() - days + 1);
  const unlocks = data.unlocks.filter(item => Date.parse(item.unlockedAt) >= start.getTime());
  function csv() {
    const cell = (value: string) => `"${value.replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
    const content = [["Date", "Enquiry", "Description", "Amount GBP"], ...unlocks.map(item => [item.unlockedAt, item.traineeLabel, "Free pilot unlock", "0.00"])].map(row => row.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "petey-free-pilot-unlocks.csv"; link.click(); URL.revokeObjectURL(url);
  }
  return <section className="mp-panel"><div className="mp-spend-heading"><div><p>Actual spend · all time</p><strong>{new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(data.actualSpendPence / 100)}</strong><p>{unlocks.length} free unlocks in the last {days} days</p></div><button className="td-button td-button--white" onClick={csv}>Download CSV</button></div><div className="mp-table-scroll"><table><thead><tr><th>Date</th><th>Enquiry</th><th>Description</th><th>Amount</th></tr></thead><tbody>{unlocks.map(item => <tr key={item.id}><td>{new Date(item.unlockedAt).toLocaleDateString("en-GB")}</td><td>{item.traineeLabel}</td><td><Check size={14} /> Free pilot unlock</td><td>£0.00</td></tr>)}</tbody></table></div>{!unlocks.length && <p className="mp-empty-copy">Your free unlock history will appear here.</p>}</section>;
}
