import { useCallback, useEffect, useRef, useState } from "react";
import { applicationStatuses, type ApplicationDetail, type ApplicationPage, type ApplicationStatus, type ReviewAccess } from "../features/trainerApplications/model";
import { isReviewFixture, reviewApi, type ReviewApi } from "./api";
import { observeReviewSession, reviewErrorMessage, signInReviewer, signOutReviewer, type ReviewSession } from "./auth";
import { ReviewEditor } from "./ReviewEditor";

const labels: Record<ApplicationStatus, string> = { pending_review: "Pending review", needs_changes: "Needs changes", approved: "Approved", rejected: "Rejected", suspended: "Suspended" };
const routeId = () => {
  const match = /^#\/applications\/([^/]+)$/.exec(window.location.hash);
  try { return match ? decodeURIComponent(match[1]) : null; } catch { return null; }
};
const dateLabel = (date: string | null) => date ? new Date(date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "No successful sync yet";

export function AdminApp({ api = reviewApi }: { api?: ReviewApi }) {
  const fixtureMode = isReviewFixture();
  const [session, setSession] = useState<ReviewSession | null>(() => fixtureMode ? { uid: "preview-reviewer", email: "reviewer@example.com", authTime: Date.now() } : null);
  const [authReady, setAuthReady] = useState(fixtureMode);
  const [access, setAccess] = useState<ReviewAccess | null>(null);
  const [accessSessionTime, setAccessSessionTime] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [clock, setClock] = useState(Date.now);
  const [retry, setRetry] = useState(0);
  const [sessionObserverRetry, setSessionObserverRetry] = useState(0);
  const [applicationId, setApplicationId] = useState(routeId);
  const dirty = useRef(false);
  const currentRoute = useRef(window.location.hash);
  const setDirty = useCallback((value: boolean) => { dirty.current = value; }, []);
  const expired = !!session && !fixtureMode && clock - session.authTime >= 60 * 60 * 1000;

  useEffect(() => {
    if (fixtureMode) return;
    let stopped = false;
    let unsubscribe: (() => void) | undefined;
    void observeReviewSession((next) => { if (!stopped) { setSession(next); setAuthReady(true); setError(""); setClock(Date.now()); } }, (failure) => { if (!stopped) { setError(reviewErrorMessage(failure)); setAuthReady(true); } }).then((stop) => { if (stopped) stop(); else unsubscribe = stop; }).catch((failure) => { if (!stopped) { setError(reviewErrorMessage(failure)); setAuthReady(true); } });
    return () => { stopped = true; unsubscribe?.(); };
  }, [fixtureMode, sessionObserverRetry]);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const changed = () => {
      if (window.location.hash === currentRoute.current) return;
      if (dirty.current && !window.confirm("Leave this application and discard unsaved changes?")) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${currentRoute.current}`);
        return;
      }
      dirty.current = false;
      currentRoute.current = window.location.hash;
      setApplicationId(routeId());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    if (!session || expired) return;
    let cancelled = false;
    void api.access().then((result) => { if (!cancelled) { setAccess(result); setAccessSessionTime(session.authTime); setError(""); } }).catch((failure) => {
      if (cancelled) return;
      const code = failure && typeof failure === "object" && "code" in failure ? String(failure.code) : "";
      if (code.endsWith("permission-denied") || code.endsWith("unauthenticated")) { setAccess(null); setAccessSessionTime(null); }
      setError(reviewErrorMessage(failure));
    });
    return () => { cancelled = true; };
  }, [api, session, expired, retry]);

  const login = async () => { setLoading(true); setError(""); try { await signInReviewer(!!session); setSessionObserverRetry((value) => value + 1); setRetry((value) => value + 1); } catch (failure) { setError(reviewErrorMessage(failure)); } finally { setLoading(false); } };
  const logout = async () => {
    if (dirty.current && !window.confirm("Sign out and discard your unsaved changes?")) return;
    setLoading(true);
    try { await signOutReviewer(); setAccess(null); } catch (failure) { setError(reviewErrorMessage(failure)); } finally { setLoading(false); }
  };

  return <div className="review-app">
    <a className="review-skip" href="#review-main" onClick={(event) => { event.preventDefault(); document.getElementById("review-main")?.focus(); }}>Skip to content</a>
    <header className="review-header"><a className="review-brand" href="#/" aria-label="Petey trainer applications">petey<span>Trainer review</span></a>{session && <div className="review-account"><span>{session.email}</span>{!fixtureMode && <><button type="button" disabled={loading} onClick={login}>Renew session</button><button type="button" disabled={loading} onClick={logout}>Sign out</button></>}</div>}</header>
    {fixtureMode && <div className="review-fixture">Development preview — changes stay in this browser session.</div>}
    <main id="review-main" tabIndex={-1}>
      {!authReady && <p role="status">Checking your session…</p>}
      {authReady && (!session || expired) && <section className="review-login"><h1>{expired ? "Renew your review session" : "Trainer applications"}</h1><p>{expired ? "Sign in again to continue reviewing. Your open draft is kept while you renew." : "Sign in with your authorised reviewer account."}</p><button type="button" className="review-primary" onClick={login} disabled={loading}>{loading ? "Opening Google…" : "Sign in with Google"}</button>{error && <p className="review-error" role="alert">{error}</p>}</section>}
      {authReady && session && !expired && (access?.reviewer.uid !== session.uid || accessSessionTime !== session.authTime) && <section className="review-login"><h1>Reviewer access</h1>{error ? <><p role="alert" className="review-error">{error}</p><button onClick={() => setRetry((value) => value + 1)}>Try again</button><button onClick={login}>Sign in again</button></> : <p role="status">Checking reviewer access…</p>}</section>}
      {authReady && session && access?.reviewer.uid === session.uid && <div hidden={expired || accessSessionTime !== session.authTime} inert={expired || accessSessionTime !== session.authTime}>
        {error && <p className="review-error" role="alert">{error}</p>}
        {applicationId ? <Application key={applicationId} id={applicationId} api={api} onDirtyChange={setDirty} /> : <Inbox api={api} access={access} refreshAccess={() => setRetry((value) => value + 1)} />}
      </div>}
    </main>
  </div>;
}

function Inbox({ api, access, refreshAccess }: { api: ReviewApi; access: ReviewAccess; refreshAccess: () => void }) {
  const [status, setStatus] = useState<ApplicationStatus | "all">("pending_review");
  const [page, setPage] = useState<ApplicationPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void api.list(status === "all" ? {} : { status }).then((result) => { if (!cancelled) { setPage(result); setError(""); setLoading(false); } }).catch((failure) => { if (!cancelled) { setPage(null); setError(reviewErrorMessage(failure)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [api, status, refresh]);
  const next = async () => {
    if (!page?.nextCursor) return;
    setLoading(true); setError("");
    try {
      const more = await api.list({ ...(status === "all" ? {} : { status }), cursor: page.nextCursor });
      setPage((previous) => ({ applications: [...(previous?.applications ?? []), ...more.applications], nextCursor: more.nextCursor }));
    } catch (failure) { setError(reviewErrorMessage(failure)); } finally { setLoading(false); }
  };
  return <section className="review-inbox"><div className="review-title-row"><div><h1>Trainer applications</h1><p>Review profiles and record your checks before publishing.</p></div><button type="button" disabled={loading} onClick={() => { setLoading(true); setRefresh((value) => value + 1); refreshAccess(); }}>Refresh</button></div>
    <div className="review-sync"><span>Last successful sync: {dateLabel(access.health.lastSuccessfulSyncAt)}</span>{access.health.errorCount > 0 && <strong>{access.health.errorCount} sync {access.health.errorCount === 1 ? "issue" : "issues"}</strong>}{access.health.message && <span>{access.health.message}</span>}</div>
    <label className="review-filter">Status<select value={status} disabled={loading} onChange={(event) => { setStatus(event.target.value as ApplicationStatus | "all"); setLoading(true); setPage(null); }}><option value="all">All applications</option>{applicationStatuses.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
    {error && <p className="review-error" role="alert">{error}</p>}
    {page?.applications.length ? <ul className="review-application-list">{page.applications.map((item) => <li key={item.id}><a href={`#/applications/${encodeURIComponent(item.id)}`}><div><h2>{item.name || "Unnamed applicant"}</h2><p>{item.email}</p></div><div className="review-list-meta"><span className="review-status">{labels[item.status]}</span><span>{dateLabel(item.createdAt)}</span>{(item.issues.length > 0 || item.photoState === "error" || item.photoState === "missing") && <strong>Needs attention</strong>}</div><span aria-hidden="true" className="review-row-arrow">↗</span></a></li>)}</ul> : !loading && !error ? <div className="review-empty"><h2>No {status === "all" ? "applications" : labels[status].toLowerCase() + " applications"}</h2><p>New form submissions will appear here after syncing.</p></div> : null}
    {loading && <p role="status">Loading applications…</p>}{page?.nextCursor && <button type="button" disabled={loading} onClick={next}>Load more</button>}
  </section>;
}

function Application({ id, api, onDirtyChange }: { id: string; api: ReviewApi; onDirtyChange: (dirty: boolean) => void }) {
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void api.detail(id).then((result) => { if (!cancelled) { setDetail(result); setError(""); } }).catch((failure) => { if (!cancelled) setError(reviewErrorMessage(failure)); });
    return () => { cancelled = true; };
  }, [api, id, retry]);
  return detail ? <ReviewEditor initial={detail} api={api} onDirtyChange={onDirtyChange} /> : error ? <section><a href="#/">← Applications</a><p role="alert" className="review-error">{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></section> : <p role="status">Loading application…</p>;
}
