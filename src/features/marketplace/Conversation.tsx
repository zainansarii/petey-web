import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, LockKeyhole, Send } from "lucide-react";
import { outcomeLabels } from "./model";
import type { EnquiryDetail, LeadTracking, Message, MessagePage, Outcome, SharedSummary } from "./model";
import { errorMessage, marketplace, readLocal, removeLocal, saveLocal, watchMessages } from "./api";
import { Modal } from "./Modal";


export function Summary({ summary }: { summary: SharedSummary }) {
  return <dl className="mp-summary">{(["goals", "area", "settings", "budget", "availability", "frequency"] as const).map(key => <div key={key}><dt>{key === "frequency" ? "Sessions with a trainer" : key}</dt><dd>{summary[key] || "Not specified"}</dd></div>)}</dl>;
}
export function Conversation({ uid, id, onBack, updated, onChange }: { uid: string; id: string; onBack: () => void; updated: string; onChange: () => void }) {
  const [detail, setDetail] = useState<EnquiryDetail | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]); const [hasMore, setHasMore] = useState(false); const [live, setLive] = useState(true);
  const draftKey = `petey.message.${uid}.${id}`;
  const [draft, setDraft] = useState(() => readLocal(draftKey, { text: "", requestId: crypto.randomUUID() }));
  const [confirm, setConfirm] = useState<"block" | "withdraw" | "report" | null>(null); const [reason, setReason] = useState(""); const [reportId] = useState(() => crypto.randomUUID());
  const end = useRef<HTMLDivElement>(null);
  const load = useCallback(() => marketplace<EnquiryDetail>({ action: "detail", enquiryId: id }), [id]);
  useEffect(() => { let alive = true; void load().then(value => { if (alive) setDetail(value); }).catch(e => { if (alive) setError(errorMessage(e)); }); return () => { alive = false; }; }, [load, updated]);
  useEffect(() => { saveLocal(draftKey, draft); }, [draftKey, draft]);
  useEffect(() => {
    if (!detail?.unlockedAt) return;
    let alive = true; let stop = () => {};
    void marketplace<MessagePage>({ action: "messages", enquiryId: id }).then(page => { if (alive) { setMessages(page.messages); setHasMore(page.hasMore); } }).catch(e => { if (alive) setError(errorMessage(e)); });
    void watchMessages(id, latest => { if (alive) { setLive(true); setMessages(old => [...new Map([...old, ...latest].map(message => [message.id, message])).values()].sort((a,b) => a.seq - b.seq)); } }, e => { if (alive) { setLive(false); setError(errorMessage(e)); } }).then(unsubscribe => { stop = unsubscribe; if (!alive) stop(); });
    return () => { alive = false; stop(); };
  }, [id, detail?.unlockedAt]);
  const latestSeq = messages.at(-1)?.seq ?? 0;
  useEffect(() => {
    if (!latestSeq || !detail?.unlockedAt || latestSeq <= detail.readSeq) return;
    const read = () => { if (document.visibilityState !== "visible") return; void marketplace({ action: "read", enquiryId: id, through: latestSeq }).then(() => { setDetail(old => old ? { ...old, readSeq: Math.max(old.readSeq, latestSeq), unreadCount: 0 } : old); onChange(); }).catch(() => { /* Retry when the conversation becomes visible again. */ }); };
    read(); document.addEventListener("visibilitychange", read); window.addEventListener("focus", read);
    return () => { document.removeEventListener("visibilitychange", read); window.removeEventListener("focus", read); };
  }, [id, latestSeq, detail?.unlockedAt, detail?.readSeq, onChange]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [latestSeq]);
  async function act(action: "unlock" | "block" | "withdraw" | "report") {
    setBusy(true); setError("");
    try { if (action === "report") await marketplace({ action, enquiryId: id, reason, requestId: reportId });
      else setDetail(await marketplace<EnquiryDetail>({ action, enquiryId: id }));
      setConfirm(null); onChange(); if (action === "report") setError("Your report has been sent to the Petey team.");
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  if (!detail) return <section className="mp-panel"><button className="td-text-button" onClick={onBack}><ArrowLeft size={16} /> Back to inbox</button><p role="status">{error || "Opening conversation…"}</p>{error && <button className="td-button" onClick={() => void load().then(setDetail).catch(e => setError(errorMessage(e)))}>Retry</button>}</section>;
  const stopped = Boolean(detail.withdrawnAt || detail.blocked);
  const status = detail.role === "trainer" ? detail.unlockedAt ? "Unlocked · Free pilot" : "Enquiry preview"
    : detail.withdrawnAt ? "Enquiry withdrawn" : detail.blocked ? "Contact blocked" : detail.unlockedAt ? "Conversation open" : "Waiting for trainer";
  const sharedDetails = <>
      <Summary summary={detail.summary} />
      {detail.tradeoffs.length > 0 && <div className="mp-fit"><h3>Fit differences to discuss</h3><ul>{detail.tradeoffs.map(item => <li key={item}>{item}</li>)}</ul></div>}
      {detail.content && <div className="mp-introduction"><h3>{detail.role === "trainer" ? "Introduction" : "Your introduction"}</h3><p>{detail.content.introduction}</p></div>}
  </>;
  return <section className="mp-conversation"><div className="mp-conversation-heading"><button className="td-text-button" onClick={onBack}><ArrowLeft size={16} /> Back to inbox</button><p>{status}</p></div>
    <div className="mp-conversation-grid"><div className="mp-panel"><h2>{detail.role === "trainer" ? detail.content?.fullName ?? detail.traineeLabel : detail.trainerName}</h2><p className="mp-muted">{detail.role === "trainer" ? "Received" : "Sent"} {new Date(detail.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
      {detail.role === "trainer" ? sharedDetails : <details className="mp-shared-details" open={!detail.unlockedAt}><summary>Your enquiry details</summary>{sharedDetails}</details>}
      {stopped ? <p className="mp-notice">{detail.withdrawnAt ? "This enquiry was withdrawn." : "Further contact is blocked."}</p> : !detail.unlockedAt ? <div className="mp-unlock"><LockKeyhole size={24} /><h3>{detail.role === "trainer" ? "A new connection starts here" : "Your enquiry has been sent"}</h3><p>{detail.role === "trainer" ? "Unlock to read the introduction and full name, then reply inside Petey. There is no charge during the pilot." : "Your trainer has your enquiry. You can message here once they open it."}</p>{detail.role === "trainer" && <button className="td-button" disabled={busy} onClick={() => void act("unlock")}>Unlock enquiry — free during pilot</button>}</div> : null}
      {detail.unlockedAt && <><div className="mp-messages" role="log" aria-label="Conversation messages" aria-live="polite">{hasMore && <button className="td-text-button" disabled={busy} onClick={async () => { setBusy(true); try { const page = await marketplace<MessagePage>({ action: "messages", enquiryId: id, before: messages[0]?.seq }); setMessages(old => [...new Map([...page.messages, ...old].map(message => [message.id, message])).values()].sort((a,b) => a.seq - b.seq)); setHasMore(page.hasMore); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }}>Load earlier messages</button>}{messages.map(message => <article key={message.id} className={`mp-message ${message.senderId === uid ? "is-own" : ""}`}><p>{message.text}</p><small>{message.senderId === uid ? "You" : detail.role === "trainer" ? detail.traineeLabel : detail.trainerName} · {new Date(message.sentAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</small></article>)}<div ref={end} /></div>
        {!stopped && <form className="mp-composer" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(""); try { await marketplace({ action: "send", enquiryId: id, requestId: draft.requestId, text: draft.text }); const next = { text: "", requestId: crypto.randomUUID() }; saveLocal(draftKey, next); setDraft(next); onChange(); } catch (e) { setError(`${errorMessage(e)} Your message is saved here. Send again to retry.`); } finally { setBusy(false); } }}><label htmlFor="message-text">Your message</label><textarea id="message-text" maxLength={4000} value={draft.text} disabled={busy} rows={3} onChange={event => setDraft({ text: event.target.value, requestId: crypto.randomUUID() })} /><div><small>Draft saved on this device</small><button className="td-button" disabled={busy || !draft.text.trim()} type="submit">{busy ? "Sending…" : "Send message"}<Send size={16} /></button></div></form>}
      </>}
      {!live && <p className="mp-notice">Live updates are disconnected. Refresh to reconnect; your draft is saved.</p>}
      {error && <p className="mp-error" role="alert">{error}</p>}
      <div className="mp-safety">{detail.role === "trainee" && !detail.unlockedAt && !stopped && <button onClick={() => setConfirm("withdraw")}>Withdraw enquiry</button>}{!detail.blocked && <button onClick={() => setConfirm("block")}>Block further contact</button>}<button onClick={() => setConfirm("report")}>Report a concern</button></div>
    </div>{detail.role === "trainer" && detail.tracking && <Tracking key={id} uid={uid} id={id} tracking={detail.tracking} onSaved={next => { setDetail(next); onChange(); }} />}</div>
    {confirm && <Modal title={confirm === "block" ? "Block further contact?" : confirm === "withdraw" ? "Withdraw your enquiry?" : "Report a concern"} onClose={() => setConfirm(null)}><p>{confirm === "block" ? "This stops further messages and prevents any future unlock of this enquiry." : confirm === "withdraw" ? "Your introduction will remain locked and this trainer will no longer be able to unlock it." : "Tell the Petey team what happened. Your report is private."}</p>{confirm === "report" && <label>What happened?<textarea value={reason} minLength={10} maxLength={2000} onChange={event => setReason(event.target.value)} /></label>}<button className="td-button" disabled={busy || (confirm === "report" && reason.trim().length < 10)} onClick={() => void act(confirm)}>{confirm === "report" ? "Send report" : "Confirm"}</button></Modal>}
  </section>;
}
function Tracking({ uid, id, tracking, onSaved }: { uid: string; id: string; tracking: LeadTracking; onSaved: (detail: EnquiryDetail) => void }) {
  const key = `petey.notes.${uid}.${id}`; const [draft, setDraft] = useState(() => readLocal(key, tracking)); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { saveLocal(key, draft); }, [key, draft]);
  return <aside className="mp-panel mp-tracking"><h2>Your follow-up</h2><p>Only you can see these notes and outcomes.</p><form onSubmit={async event => { event.preventDefault(); setBusy(true); setMessage(""); try { const next = await marketplace<EnquiryDetail>({ action: "tracking", enquiryId: id, notes: draft.notes, outcome: draft.outcome, followUp: draft.followUp, expectedVersion: draft.version }); setDraft(next.tracking!); removeLocal(key); onSaved(next); setMessage("Follow-up saved."); } catch (e) { setMessage(errorMessage(e)); } finally { setBusy(false); } }}><label>Lead outcome<select value={draft.outcome} onChange={event => setDraft({ ...draft, outcome: event.target.value as Outcome })}>{Object.entries(outcomeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><small>Needs a reply is tracked automatically until your first message. Started training is trainer-reported.</small><label>Follow-up date<input type="date" value={draft.followUp ?? ""} onInput={event => setDraft({ ...draft, followUp: event.currentTarget.value || null })} onChange={event => setDraft({ ...draft, followUp: event.target.value || null })} /></label><label>Private notes<textarea rows={8} maxLength={8000} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label><button className="td-button" disabled={busy}>Save follow-up</button><p role="status">{message}</p>{draft.version !== tracking.version && <button type="button" className="td-text-button" onClick={() => setDraft({ ...draft, version: tracking.version })}>Keep my notes and use latest version</button>}</form></aside>;
}
