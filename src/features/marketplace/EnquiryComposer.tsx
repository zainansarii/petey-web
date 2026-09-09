import { useEffect, useState } from "react";
import { errorMessage, marketplace, readLocal, saveLocal } from "./api";
import { goalCategories, sharedSummarySchema, type SharedSummary } from "./model";
import { Modal } from "./Modal";
import { getFirebaseAuth } from "../auth/api/magicLink";
import "./marketplace.css";

export function EnquiryComposer({ trainerId, trainerName, onClose }: { trainerId: string; trainerName: string; onClose: () => void }) {
  const [summary, setSummary] = useState<SharedSummary | null>(null); const [intro, setIntro] = useState(""); const [confirmed, setConfirmed] = useState(false);
  const [key, setKey] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [sent, setSent] = useState<string | null>(null); const [attempt, setAttempt] = useState(0);
  const [tradeoffs, setTradeoffs] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    async function prepare() {
      try {
        const uid = (await getFirebaseAuth()).currentUser?.uid; if (!uid) throw new Error("Sign in before sending an enquiry.");
        const storageKey = `petey.enquiry.${uid}.${trainerId}`;
        const result = await marketplace<{ summary?: SharedSummary; tradeoffs?: string[]; existingEnquiryId?: string }>({ action: "prepare", trainerId });
        if (!alive) return;
        if (result.existingEnquiryId) { setSent(result.existingEnquiryId); return; }
        const local = readLocal<{ summary: SharedSummary; intro: string } | null>(storageKey, null);
        setKey(storageKey); setSummary(local?.summary ?? result.summary!); setIntro(local?.intro ?? ""); setTradeoffs(result.tradeoffs ?? []);
      } catch (e) { if (alive) setError(errorMessage(e)); }
    }
    void prepare(); return () => { alive = false; };
  }, [trainerId, attempt]);
  useEffect(() => { if (key && summary) saveLocal(key, { summary, intro }); }, [key, summary, intro]);
  return <Modal title={sent ? "Your enquiry is in Petey" : `Introduce yourself to ${trainerName.split(" ")[0]}`} onClose={onClose}>{sent ? <><p>You can view the enquiry in your inbox. Messaging opens when your trainer unlocks it.</p><a className="td-button" href={`${import.meta.env.BASE_URL}messages/#${sent}`}>Open your inbox</a></> : <form className="mp-enquiry-form" onSubmit={async event => { event.preventDefault(); if (!summary || !confirmed) return; setBusy(true); setError(""); try { const parsed = sharedSummarySchema.parse(summary); const result = await marketplace<{ enquiryId: string }>({ action: "enquire", trainerId, summary: parsed, introduction: intro }); setSent(result.enquiryId); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }}>
    <p>Check exactly what you’ll share. Your trainer can see your first name, surname initial and the practical summary below before unlocking. Your full name and introduction are shared after unlock.</p>
    {!summary ? <p role="status">{error ? "Your summary could not load." : "Preparing your practical training summary…"}</p> : <><div className="mp-fields">{(["goals", "area", "settings", "budget", "availability", "frequency"] as const).map(field => <label key={field}>{field === "area" ? "Rough area — no full address" : field === "frequency" ? "Sessions with a trainer" : field[0].toUpperCase() + field.slice(1)}<textarea rows={field === "goals" ? 3 : 2} maxLength={field === "goals" ? 1000 : 300} required={field === "goals"} value={summary[field]} onChange={event => { setSummary({ ...summary, [field]: event.target.value }); setConfirmed(false); }} /></label>)}</div><label>Main goal category<select value={summary.goalCategory} onChange={event => setSummary({ ...summary, goalCategory: event.target.value as SharedSummary["goalCategory"] })}>{goalCategories.map(category => <option key={category}>{category}</option>)}</select><small>Your own wording above stays intact. This category helps your trainer understand enquiry trends.</small></label>
    {tradeoffs.length > 0 && <div className="mp-fit"><h3>Fit differences also shared</h3><ul>{tradeoffs.map(item => <li key={item}>{item}</li>)}</ul></div>}<label>Your introduction<textarea rows={4} minLength={10} maxLength={4000} required value={intro} onChange={event => { setIntro(event.target.value); setConfirmed(false); }} placeholder="Say hello and tell your trainer what you’re looking for." /></label><p className="mp-notice">Your onboarding conversation, internal matching brief and private health information are not shared. Remove anything from this summary you don’t want this trainer to receive.</p><label className="mp-checkbox"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> I’ve checked this information and agree to share it with {trainerName}.</label><button className="td-button" disabled={busy || !confirmed} type="submit">{busy ? "Sending…" : "Send enquiry"}</button></>}
    {error && <p className="mp-error" role="alert">{error}</p>}{!summary && error && <button className="td-button" type="button" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Try again</button>}
  </form>}</Modal>;
}
