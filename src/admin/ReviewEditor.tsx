import { cloneElement, useEffect, useId, useRef, useState, type ReactElement } from "react";
import { reviewDraftSchema, verificationSchema, type ApplicationDetail, type ReviewDecision, type ReviewDraft, type Verification } from "../features/trainerApplications/model";
import type { ReviewApi } from "./api";
import { reviewErrorMessage } from "./auth";

const displayDate = (date: string) => new Date(date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const words = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
const currency = (value: number | null) => value === null ? "Not supplied" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value / 100);
function Field({ label, children, hint }: { label: string; children: ReactElement<{ id?: string; "aria-describedby"?: string }>; hint?: string }) {
  const id = useId();
  return <div className="review-field"><label htmlFor={id}>{label}</label>{cloneElement(children, { id, "aria-describedby": hint ? `${id}-hint` : undefined })}{hint && <small id={`${id}-hint`}>{hint}</small>}</div>;
}

export function ReviewEditor({ initial, api, onDirtyChange }: { initial: ApplicationDetail; api: ReviewApi; onDirtyChange: (dirty: boolean) => void }) {
  const [detail, setDetail] = useState(initial);
  const [draft, setDraft] = useState(initial.draft);
  const [verification, setVerification] = useState(initial.verification);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [formReset, setFormReset] = useState(0);
  const decisionRequest = useRef<{ fingerprint: string; id: string } | null>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(detail.draft) || JSON.stringify(verification) !== JSON.stringify(detail.verification);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => { if (error) feedback.current?.focus(); }, [error]);
  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [dirty]);

  const update = <K extends keyof ReviewDraft,>(field: K, value: ReviewDraft[K]) => setDraft((previous) => ({ ...previous, [field]: value }));
  const check = <K extends "qualification" | "insurance",>(field: K, value: Partial<Verification[K]>) => setVerification((previous) => ({ ...previous, [field]: { ...previous[field], ...value } }));
  const accept = (result: ApplicationDetail) => { setDetail(result); setDraft(result.draft); setVerification(result.verification); setFormReset((value) => value + 1); };
  const save = async () => {
    setError(""); setNotice("");
    const parsedDraft = reviewDraftSchema.safeParse({ ...draft, ...Object.fromEntries((["specialties", "coachingStyles", "venues", "availability", "qualifications"] as const).map((field) => [field, draft[field].filter((value) => value.trim())])) });
    const parsedVerification = verificationSchema.safeParse(verification);
    if (!parsedDraft.success || !parsedVerification.success) {
      const issues = [!parsedDraft.success ? parsedDraft.error.issues : [], !parsedVerification.success ? parsedVerification.error.issues : []].flat();
      setError(issues.map((issue) => `${words(issue.path.join(" "))}: ${issue.message}`).join(" "));
      return;
    }
    setBusy(true);
    try {
      accept(await api.save({ applicationId: detail.application.id, expectedVersion: detail.application.version, draft: parsedDraft.data, verification: parsedVerification.data }));
      setNotice("Changes saved. The original answers are unchanged.");
    } catch (failure) { setError(reviewErrorMessage(failure)); } finally { setBusy(false); }
  };
  const decide = async (decision: ReviewDecision) => {
    setError(""); setNotice("");
    if (dirty) { setError("Save your changes before making a decision."); return; }
    if (decision !== "approve" && !reason.trim()) { setError("Add a reason before making this decision."); return; }
    setBusy(true);
    try {
      const fingerprint = JSON.stringify([detail.application.id, detail.application.version, decision, reason.trim()]);
      if (decisionRequest.current?.fingerprint !== fingerprint) decisionRequest.current = { fingerprint, id: crypto.randomUUID() };
      accept(await api.decide({ applicationId: detail.application.id, expectedVersion: detail.application.version, decision, ...(reason.trim() ? { reason: reason.trim() } : {}), requestId: decisionRequest.current.id }));
      decisionRequest.current = null;
      setReason("");
      setNotice(decision === "approve" ? "Profile approved. Matching availability follows the saved client availability and verification dates." : "Decision saved. Contact the applicant separately if needed.");
    } catch (failure) { setError(reviewErrorMessage(failure)); } finally { setBusy(false); }
  };
  const reload = async () => {
    if (dirty && !window.confirm("Discard your unsaved changes and load the latest application?")) return;
    setBusy(true); setError(""); setNotice("");
    try { accept(await api.detail(detail.application.id)); } catch (failure) { setError(reviewErrorMessage(failure)); } finally { setBusy(false); }
  };

  const textInput = (field: keyof ReviewDraft, label: string, multiline = false, hint?: string) => <Field label={label} hint={hint}>
    {multiline ? <textarea rows={3} value={String(draft[field] ?? "")} maxLength={4000} onChange={(event) => update(field, event.target.value)} /> : <input value={String(draft[field] ?? "")} maxLength={field === "professionalUrl" ? 2000 : 160} onChange={(event) => update(field, (field === "gender" || field === "professionalUrl") && !event.target.value ? null : event.target.value)} />}
  </Field>;
  const listInput = (field: "specialties" | "coachingStyles" | "venues" | "availability" | "qualifications", label: string) => <Field label={label} hint="One item per line."><textarea rows={3} value={draft[field].join("\n")} onChange={(event) => update(field, event.target.value.split("\n"))} /></Field>;
  const priceInput = (field: "singleSessionPence" | "tenPackPence" | "monthlyCoachingPence", label: string) => <Field label={label}><input key={`${field}-${formReset}`} type="number" min="0" max="1000000" step="0.01" inputMode="decimal" defaultValue={draft[field] === null ? "" : draft[field] / 100} onChange={(event) => update(field, event.target.value === "" ? null : Math.round(Number(event.target.value) * 100))} /></Field>;
  const today = new Date().toISOString().slice(0, 10);
  const approvalBlockers = [
    ...(detail.photo.state !== "ready" ? ["A valid profile photo is required."] : []),
    ...(!draft.name.trim() || !draft.bio.trim() || !draft.specialties.some(Boolean) || !draft.venues.some(Boolean) || !draft.area.trim() || !draft.availability.some(Boolean) || draft.singleSessionPence === null || draft.sessionDurationMinutes === null ? ["Complete the profile, area, availability and standard session price and duration."] : []),
    ...(!verification.qualification.checked || !verification.qualification.title.trim() || !verification.qualification.provider.trim() || !verification.qualification.reference.trim() ? ["Complete the qualification check and its reference."] : []),
    ...(!verification.insurance.checked || !verification.insurance.provider.trim() || !verification.insurance.reference.trim() || !verification.insurance.expiresOn || verification.insurance.expiresOn < today ? ["Complete the current insurance check, expiry date and reference."] : []),
  ];

  return <article className="review-detail">
    <div className="review-detail-heading"><div><a href="#/">← Applications</a><h1>{detail.application.name || "Unnamed applicant"}</h1><p>{detail.application.email}</p></div><div className="review-meta"><span className="review-status">{words(detail.application.status)}</span><span>Submitted {displayDate(detail.source.submittedAt)}</span><button type="button" onClick={reload} disabled={busy}>Reload latest</button></div></div>
    {detail.application.publishedVersion !== null && <p className="review-banner">Last approved profile: version {detail.application.publishedVersion}. {detail.application.status === "suspended" ? "This trainer is excluded from matching." : "These edits replace the approved profile only after approval. Matching also depends on availability and current verification."}</p>}
    {detail.issues.length > 0 && <div className="review-banner"><strong>Needs attention</strong><ul>{detail.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
    {detail.duplicateApplications.length > 0 && <div className="review-banner"><strong>Another application uses this email</strong><p>Check these applications before approving. They have not been merged.</p><ul>{detail.duplicateApplications.map((item) => <li key={item.id}><a href={`#/applications/${encodeURIComponent(item.id)}`}>{item.name || item.id}</a> — {words(item.status)}</li>)}</ul></div>}
    <div className="review-columns">
      <div className="review-workspace">
        <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <fieldset disabled={busy} className="review-section"><legend>Profile information</legend>
            <div className="review-fields">{textInput("name", "Public name")}{textInput("gender", "Gender (optional)")}{textInput("experience", "Experience")}{textInput("professionalUrl", "Professional link (optional)")}</div>
            {textInput("bio", "Profile bio", true)}
            <div className="review-fields">{listInput("specialties", "Specialisms")}{listInput("coachingStyles", "Coaching style")}{listInput("venues", "Training formats")}{listInput("qualifications", "Public qualifications")}</div>
          </fieldset>
          <fieldset disabled={busy} className="review-section"><legend>Where and when</legend>
            {textInput("area", "Main area", false, "Use a confirmed service area. For online-only trainers, enter Online.")}
            {textInput("serviceAreaNotes", "Areas, venues and travel details", true)}
            {listInput("availability", "Usual availability")}
            <label className="review-check"><input type="checkbox" checked={draft.acceptingNewClients} onChange={(event) => update("acceptingNewClients", event.target.checked)} />Accepting new clients</label>
            <Field label="Confirmed start date (optional)" hint="Confirm a future start date with the applicant. Leave empty when they can start now."><input type="date" value={draft.availableFrom ?? ""} onChange={(event) => update("availableFrom", event.target.value || null)} /></Field>
          </fieldset>
          <fieldset disabled={busy} className="review-section"><legend>Prices</legend>
            <div className="review-fields">{priceInput("singleSessionPence", "Standard session price (£)")}<Field label="Session duration (minutes)"><input type="number" min="1" max="1440" step="1" value={draft.sessionDurationMinutes ?? ""} onChange={(event) => update("sessionDurationMinutes", event.target.value === "" ? null : Number(event.target.value))} /></Field></div>
            {textInput("pricingNotes", "Packages and pricing details", true)}
            <p className="review-hint">Only enter the prices below when the applicant explicitly offers that package.</p>
            <div className="review-fields">{priceInput("tenPackPence", "Ten-session package (£, optional)")}{priceInput("monthlyCoachingPence", "Monthly coaching (£, optional)")}</div>
          </fieldset>
          <fieldset disabled={busy} className="review-section"><legend>Private verification</legend><p>Record the checks you completed separately. These records stay private.</p>
            <h3>Personal training qualification</h3>
            <div className="review-fields"><Field label="Qualification title"><input value={verification.qualification.title} maxLength={160} onChange={(event) => check("qualification", { title: event.target.value })} /></Field><Field label="Awarding body"><input value={verification.qualification.provider} maxLength={160} onChange={(event) => check("qualification", { provider: event.target.value })} /></Field></div>
            <Field label="Qualification check reference or note"><textarea rows={2} maxLength={4000} value={verification.qualification.reference} onChange={(event) => check("qualification", { reference: event.target.value })} /></Field>
            <Field label="Qualification expiry (if applicable)"><input type="date" value={verification.qualification.expiresOn ?? ""} onChange={(event) => check("qualification", { expiresOn: event.target.value || null })} /></Field>
            <label className="review-check"><input type="checkbox" checked={verification.qualification.checked} onChange={(event) => check("qualification", { checked: event.target.checked })} />Qualification checked and accepted</label>
            <h3>Professional insurance</h3>
            <div className="review-fields"><Field label="Insurance provider"><input value={verification.insurance.provider} maxLength={160} onChange={(event) => check("insurance", { provider: event.target.value })} /></Field><Field label="Insurance expiry"><input type="date" value={verification.insurance.expiresOn ?? ""} onChange={(event) => check("insurance", { expiresOn: event.target.value || null })} /></Field></div>
            <Field label="Insurance check reference or note"><textarea rows={2} maxLength={4000} value={verification.insurance.reference} onChange={(event) => check("insurance", { reference: event.target.value })} /></Field>
            <label className="review-check"><input type="checkbox" checked={verification.insurance.checked} onChange={(event) => check("insurance", { checked: event.target.checked })} />Insurance checked and current</label>
            <h3>Additional checks</h3>
            {verification.additionalChecks.map((item, index) => <div className="review-additional" key={index}>
              <Field label={`Additional check ${index + 1}`}><input value={item.title} maxLength={160} onChange={(event) => setVerification((previous) => ({ ...previous, additionalChecks: previous.additionalChecks.map((entry, i) => i === index ? { ...entry, title: event.target.value } : entry) }))} /></Field>
              <div className="review-fields"><Field label={`Provider for check ${index + 1}`}><input value={item.provider} maxLength={160} onChange={(event) => setVerification((previous) => ({ ...previous, additionalChecks: previous.additionalChecks.map((entry, i) => i === index ? { ...entry, provider: event.target.value } : entry) }))} /></Field><Field label={`Expiry for check ${index + 1}`}><input type="date" value={item.expiresOn ?? ""} onChange={(event) => setVerification((previous) => ({ ...previous, additionalChecks: previous.additionalChecks.map((entry, i) => i === index ? { ...entry, expiresOn: event.target.value || null } : entry) }))} /></Field></div>
              <Field label={`Reference for check ${index + 1}`}><textarea rows={2} maxLength={4000} value={item.reference} onChange={(event) => setVerification((previous) => ({ ...previous, additionalChecks: previous.additionalChecks.map((entry, i) => i === index ? { ...entry, reference: event.target.value } : entry) }))} /></Field>
              <label className="review-check"><input type="checkbox" checked={item.checked} onChange={(event) => setVerification((previous) => ({ ...previous, additionalChecks: previous.additionalChecks.map((entry, i) => i === index ? { ...entry, checked: event.target.checked } : entry) }))} />Check {index + 1} completed</label>
              <button type="button" onClick={() => setVerification((previous) => ({ ...previous, additionalChecks: previous.additionalChecks.filter((_, i) => i !== index) }))}>Remove check {index + 1}</button>
            </div>)}
            <button type="button" disabled={verification.additionalChecks.length >= 20} onClick={() => setVerification((previous) => ({ ...previous, additionalChecks: [...previous.additionalChecks, { title: "", provider: "", expiresOn: null, checked: false, reference: "" }] }))}>Add a check</button>
            <Field label="Private review notes"><textarea rows={3} maxLength={4000} value={verification.notes} onChange={(event) => setVerification((previous) => ({ ...previous, notes: event.target.value }))} /></Field>
            <p className="review-hint">Your reviewer identity and the time of each saved change are recorded automatically.</p>
          </fieldset>
          <div className="review-save"><button className="review-primary" type="submit" disabled={!dirty || busy}>{busy ? "Saving…" : "Save changes"}</button><span>{dirty ? "Unsaved changes" : `Version ${detail.application.version} saved`}</span></div>
        </form>
        <section className="review-section" aria-labelledby="decision-heading"><h2 id="decision-heading">Review decision</h2>
          {approvalBlockers.length > 0 && <div className="review-checklist"><p>Before approval:</p><ul>{approvalBlockers.map((item) => <li key={item}>{item}</li>)}</ul></div>}
          {dirty && <p>Save your changes before making a decision.</p>}
          <Field label="Decision reason" hint="Required for needs changes, rejection or suspension. Kept in the private review history."><textarea rows={3} maxLength={4000} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} /></Field>
          <div className="review-actions"><button className="review-primary" type="button" disabled={busy || dirty || approvalBlockers.length > 0} onClick={() => void decide("approve")}>Approve &amp; publish</button><button type="button" disabled={busy || dirty || !reason.trim()} onClick={() => void decide("needs_changes")}>Needs changes</button><button type="button" disabled={busy || dirty || !reason.trim()} onClick={() => void decide("reject")}>Reject</button><button type="button" disabled={busy || dirty || !reason.trim() || detail.application.publishedVersion === null} onClick={() => void decide("suspend")}>Suspend</button></div>
          <p className="review-hint">Decisions do not send messages. Contact the applicant separately.</p>
        </section>
        <div className="review-feedback" ref={feedback} tabIndex={-1} aria-live="polite">{error && <p role="alert" className="review-error">{error}</p>}{notice && <p role="status">{notice}</p>}</div>
      </div>
      <aside className="review-inspector">
        <section className="review-preview" aria-labelledby="preview-heading"><h2 id="preview-heading">Profile preview</h2>{detail.photo.url ? <img src={detail.photo.url} alt={`${draft.name || "Applicant"}'s profile`} referrerPolicy="no-referrer" /> : <div className="review-photo-placeholder">{detail.photo.state === "ready" ? "Profile photo ready" : "Profile photo unavailable"}</div>}{detail.photo.error && <p className="review-error">{detail.photo.error}</p>}
          <h3>{draft.name || "Public name"}</h3><p className="review-hint">{draft.area}</p><p>{draft.bio || "Add a profile bio."}</p>
          <dl><dt>Session</dt><dd>{currency(draft.singleSessionPence)}{draft.sessionDurationMinutes ? ` · ${draft.sessionDurationMinutes} minutes` : ""}</dd><dt>Specialisms</dt><dd>{draft.specialties.filter(Boolean).join(", ") || "—"}</dd><dt>Coaching style</dt><dd>{draft.coachingStyles.filter(Boolean).join(" · ") || "—"}</dd><dt>Training formats</dt><dd>{draft.venues.filter(Boolean).join(", ") || "—"}</dd><dt>Service areas</dt><dd>{draft.serviceAreaNotes || draft.area || "—"}</dd><dt>Availability</dt><dd>{draft.availability.filter(Boolean).join(" · ") || "—"}</dd><dt>Packages</dt><dd>{draft.pricingNotes || "—"}</dd><dt>Qualifications</dt><dd>{draft.qualifications.filter(Boolean).join(", ") || "—"}</dd></dl>
          <dl>{draft.tenPackPence !== null && <><dt>Ten-session package</dt><dd>{currency(draft.tenPackPence)}</dd></>}{draft.monthlyCoachingPence !== null && <><dt>Monthly coaching</dt><dd>{currency(draft.monthlyCoachingPence)}</dd></>}{draft.experience && <><dt>Experience</dt><dd>{draft.experience}</dd></>}{draft.gender && <><dt>Gender</dt><dd>{draft.gender}</dd></>}{draft.professionalUrl && reviewDraftSchema.shape.professionalUrl.safeParse(draft.professionalUrl).success && <><dt>Professional profile</dt><dd><a href={draft.professionalUrl} target="_blank" rel="noreferrer">{draft.professionalUrl}</a></dd></>}</dl>
          <p className="review-hint">{draft.acceptingNewClients ? draft.availableFrom ? `Accepting clients from ${draft.availableFrom}.` : "Accepting new clients." : "Not accepting new clients; excluded from matching."}</p>
        </section>
        <details className="review-section"><summary>Original form answers</summary><p>As submitted. Corrections are saved only in the review draft.</p><dl>{Object.entries(detail.originalAnswers).map(([key, value]) => <div key={key}><dt>{words(key)}</dt><dd>{Array.isArray(value) ? value.join(" · ") || "Not supplied" : value || "Not supplied"}</dd></div>)}</dl>
          {detail.source.editUrl && <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(detail.source.editUrl); setNotice("Response-edit link copied. Send it to the applicant privately."); } catch { setError("Could not copy the link. Open the edit link and copy its address."); } }}>Copy response-edit link</button>}
          {detail.source.editUrl && <a href={detail.source.editUrl} target="_blank" rel="noreferrer" className="review-edit-link">Open response-edit link ↗</a>}
        </details>
        <details className="review-section"><summary>Review history ({detail.history.length})</summary>{detail.history.length === 0 ? <p>No review decisions yet.</p> : <ol className="review-history">{detail.history.map((event) => <li key={event.id}><strong>{words(event.action)}</strong><span>{displayDate(event.at)} · version {event.version}</span><span>Reviewer: {event.reviewerUid}</span>{event.reason && <p>{event.reason}</p>}</li>)}</ol>}</details>
      </aside>
    </div>
  </article>;
}
