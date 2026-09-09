import { useEffect, useState, type ReactNode } from "react";
import { finishMagicLink, getFirebaseAuth, observeFirebaseAuthSession, requestMagicLink } from "../auth/api/magicLink";
import { BrandMark } from "../../shared/ui/BrandMark";
import { errorMessage, marketplace, watchAccess } from "./api";
import type { Access } from "./model";

export function AccessGate({ trainer, children }: { trainer: boolean; children: (access: Access) => ReactNode }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [state, setState] = useState("loading"); const [email, setEmail] = useState(""); const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true; let stop = () => {}; let stopAccess = () => {};
    async function start() {
      if (import.meta.env.DEV) {
        const qa = await import("./qa"); if (qa.qaRole()) {
          const result = await qa.qaCall<Access>({ action: "access" }); if (alive) { setAccess(result); setState("ready"); }
          return;
        }
      }
      const finished = await finishMagicLink(); if (!alive) return;
      if (finished === "missing-email" || finished === "error") { setState(finished); return; }
      stop = await observeFirebaseAuthSession(async signedIn => {
        if (!alive) return;
        if (!signedIn) { setAccess(null); setState("login"); return; }
        try {
          const token = new URLSearchParams(location.search).get("invite");
          let result: Access;
          try { result = await marketplace<Access>(token ? { action: "redeem", token } : { action: "access" }); }
          catch (failure) {
            // A redeemed invitation is single-use. Recover a lost response using
            // the existing explicit membership, never by matching emails.
            if (!token) throw failure;
            result = await marketplace<Access>({ action: "access" });
            if (result.membership?.status !== "active") throw failure;
          }
          if (!alive) return;
          if (token) { const url = new URL(location.href); url.searchParams.delete("invite"); history.replaceState(null, "", url); }
          setAccess(result); setState("ready");
          stopAccess = await watchAccess(result.uid, () => { if (alive) { setAccess(null); setState("revoked"); } });
          if (!alive) stopAccess();
        } catch (e) { if (alive) { setAccess(null); setError(errorMessage(e)); setState("access-error"); } }
      });
      if (!alive) stop();
    }
    void start().catch(e => { if (alive) { setError(errorMessage(e)); setState("access-error"); } });
    return () => { alive = false; stop(); stopAccess(); };
  }, [attempt]);
  if (state === "ready" && access && (!trainer || access.membership?.status === "active")) return <>{children(access)}</>;
  return <main className="mp-access"><header className="mp-access-header"><a href={import.meta.env.BASE_URL} aria-label="Petey home"><BrandMark /></a></header><div className="mp-access-panel">
    <h1>{state === "loading" ? "Opening your workspace…" : state === "sent" ? "Check your email" : state === "missing-email" ? "Confirm your email" : state === "ready" ? "Your trainer workspace starts with an invitation" : state === "revoked" ? "Trainer access is unavailable" : "Welcome back"}</h1>
    {state === "ready" ? <><p>Approved web applicants receive a personal invitation from Petey. Use the link sent to your application email to connect your trainer profile.</p><p>Signed in as {access?.email}.</p></> : state === "revoked" ? <p>Your trainer access has changed. Contact Petey for help.</p> : state === "sent" ? <p>Open the secure sign-in link sent to <strong>{email}</strong>. You can complete it on another device by confirming this email address.</p> : state !== "loading" && <form onSubmit={async event => { event.preventDefault(); setError(""); try {
      if (state === "missing-email" || state === "error") { const result = await finishMagicLink(email); if (result !== "signed-in") throw new Error("This link could not be completed. Request a new sign-in link."); setAttempt(value => value + 1); setState("loading"); }
      else { await requestMagicLink(email, `${location.pathname}${location.search}${location.hash}`); setState("sent"); }
    } catch (e) { setError(errorMessage(e)); } }}><p>{state === "missing-email" ? "Enter the email address that received this sign-in link." : "Sign in with your email to continue securely."}</p><label>Email address<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label><button className="td-button" type="submit">{state === "missing-email" ? "Confirm email" : "Email me a sign-in link"}</button></form>}
    {error && <p className="mp-error" role="alert">{error}</p>}
    {state === "error" && <button className="td-text-button" onClick={() => { const url = new URL(location.href); for (const key of ["mode", "oobCode", "apiKey", "finishSignUp"]) url.searchParams.delete(key); history.replaceState(null, "", url); setState("login"); setError(""); }}>Request a new sign-in link</button>}
    {state === "access-error" && <button className="td-text-button" onClick={() => { setState("loading"); setAttempt(value => value + 1); }}>Retry access</button>}
    {["ready", "revoked", "access-error"].includes(state) && <button className="td-text-button" onClick={async () => { const { signOut } = await import("firebase/auth"); await signOut(await getFirebaseAuth()); location.assign(location.pathname); }}>Use another account</button>}
  </div></main>;
}
