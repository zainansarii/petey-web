import { useEffect, useState, type ReactNode } from "react";
import { finishMagicLink, getFirebaseAuth, observeFirebaseAuthSession, requestMagicLink } from "../auth/api/magicLink";
import { AuthScreen } from "../auth/components/AuthScreen";
import { EmailLinkScreen } from "../auth/components/EmailLinkScreen";
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
  const newLink = () => {
    const url = new URL(location.href);
    for (const key of ["mode", "oobCode", "apiKey", "finishSignUp"]) url.searchParams.delete(key);
    history.replaceState(null, "", url);
    setState("login"); setError("");
  };
  if (["login", "missing-email", "error"].includes(state)) {
    const confirming = state !== "login";
    return <EmailLinkScreen
      key={confirming ? "confirm" : "login"}
      title={confirming ? "Confirm your email" : undefined}
      description={confirming ? "Enter the email address that received this sign-in link." : undefined}
      submitLabel={confirming ? "Confirm email" : undefined}
      busyLabel={confirming ? "Signing in…" : undefined}
      showTerms={!confirming}
      failureMessage={errorMessage}
      onSubmit={async address => {
        setError("");
        if (confirming) {
          const result = await finishMagicLink(address);
          if (result !== "signed-in") throw new Error("This link could not be completed. Request a new sign-in link.");
          setAttempt(value => value + 1); setState("loading");
        } else {
          const mode = await requestMagicLink(address, `${location.pathname}${location.search}${location.hash}`);
          setEmail(address); setState(mode === "preview" ? "preview" : "sent");
        }
      }}
    >
      {confirming && <button className="auth-text-button" type="button" onClick={newLink}>Request a new sign-in link</button>}
    </EmailLinkScreen>;
  }
  const title = state === "loading" ? trainer ? "Opening your workspace…" : "Opening your inbox…"
    : state === "sent" || state === "preview" ? "Check your email"
    : state === "ready" ? "Your trainer workspace starts with an invitation"
    : state === "revoked" ? trainer ? "Trainer access is unavailable" : "Inbox access is unavailable"
    : "We couldn’t open your account";
  const description = state === "ready" ? "Approved web applicants receive a personal invitation from Petey. Use the link sent to your application email to connect your trainer profile."
    : state === "revoked" ? trainer ? "Your trainer access has changed. Contact Petey for help." : "Your inbox access has changed. Contact Petey for help."
    : state === "sent" ? <>Open the secure login link sent to <strong>{email}</strong>. You can also open it on another device and confirm this email address.</>
    : state === "preview" ? "Email sign-in isn’t configured in this preview, so no email was sent."
    : undefined;
  return <AuthScreen title={title} description={description}>
    {state === "loading" && <span className="sr-only" role="status">Checking your account access.</span>}
    {state === "ready" && <p className="auth-screen__status">Signed in as {access?.email}.</p>}
    {error && <p className="auth-screen__status" role="alert">{error}</p>}
    {state !== "loading" && <div className="auth-screen__actions">
      {["sent", "preview"].includes(state) && <button className="auth-text-button" type="button" onClick={newLink}>Use a different email</button>}
      {state === "access-error" && <button className="auth-primary-button" type="button" onClick={() => { setError(""); setState("loading"); setAttempt(value => value + 1); }}>Retry access</button>}
      {["ready", "revoked", "access-error"].includes(state) && <button className="auth-text-button" type="button" onClick={async () => { const { signOut } = await import("firebase/auth"); await signOut(await getFirebaseAuth()); location.assign(location.pathname); }}>Use another account</button>}
    </div>}
  </AuthScreen>;
}
