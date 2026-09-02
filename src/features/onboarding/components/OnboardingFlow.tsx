import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
  useLocalRuntime,
  type ChatModelAdapter,
  type EmptyMessagePartProps,
  type TextMessagePartProps,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, LoaderCircle, LockKeyhole, RotateCcw, Send, Trash2 } from "lucide-react";
import { requestMagicLink } from "../../auth/api/magicLink";
import {
  clearLocalConversationV4,
  clearDraftCapability,
  confirmWebOnboardingDraftV3,
  createLocalConversationV4,
  createIdempotencyKey,
  deleteWebOnboardingDraftV3,
  finalizeWebOnboardingV4,
  getWebOnboardingDraftV3,
  readLocalConversationV4,
  readDraftCapability,
  runWebOnboardingTurnV4,
  saveLocalConversationV4,
  WEB_ONBOARDING_CONSENT_VERSION,
} from "../api/webOnboarding";
import {
  conversationProgress,
  formatDobInput,
  identityAnswersSchema,
  profileMarkdownSchema,
  type DraftCapability,
  type IdentityAnswers,
  type OnboardingChatMessage,
  type OnboardingConversationSessionV4,
  type OnboardingDraftSnapshotV3,
} from "../model/onboarding";

type OnboardingFlowProps = {
  profileMarkdown: string;
  identity: IdentityAnswers;
  onExit: () => void;
  onIdentityChange: (identity: IdentityAnswers) => void;
  onMagicLinkRequested: (email: string, mode: "sent" | "preview") => void;
  onProfileMarkdownChange: (profileMarkdown: string) => void;
};

type LoadState = "starting" | "chat" | "error";

const readableError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message.trim() : "";
  return !message || /^(?:internal|unknown|not found)$/i.test(message) ? fallback : message;
};

const isTerminalDraftRestoreError = (error: unknown) => {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  return ["not-found", "permission-denied", "deadline-exceeded"].some((item) => code.endsWith(item));
};

const localConversationFromSnapshot = (
  snapshot: OnboardingDraftSnapshotV3,
): OnboardingConversationSessionV4 => {
  const fallback = createLocalConversationV4();
  const status = snapshot.status === "ready_to_map" ? "ready_to_map" : "collecting";
  return {
    schemaVersion: 4,
    status,
    messages: snapshot.messages.length > 0 ? snapshot.messages : fallback.messages,
    quickReplies: snapshot.quickReplies,
    userTurns: snapshot.userTurns,
    updatedAt: new Date().toISOString(),
  };
};

export function OnboardingFlow(props: OnboardingFlowProps) {
  const { onProfileMarkdownChange } = props;
  const [initialCapability] = useState<DraftCapability | null>(() => readDraftCapability());
  const [loadState, setLoadState] = useState<LoadState>(initialCapability ? "starting" : "chat");
  const [session, setSession] = useState<OnboardingConversationSessionV4>(() => (
    readLocalConversationV4() ?? createLocalConversationV4()
  ));
  const [reviewSnapshot, setReviewSnapshot] = useState<OnboardingDraftSnapshotV3 | null>(null);
  const [capability, setCapability] = useState<DraftCapability | null>(initialCapability);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const openChat = async () => {
      setError(null);
      const stored = readDraftCapability();
      if (!stored) {
        saveLocalConversationV4(session);
        setLoadState("chat");
        return;
      }
      setLoadState("starting");
      try {
        const restored = await getWebOnboardingDraftV3(stored);
        if (cancelled) return;
        if (["review", "confirmed"].includes(restored.snapshot.status) && restored.snapshot.profileMarkdown) {
          setCapability(stored);
          setReviewSnapshot(restored.snapshot);
          onProfileMarkdownChange(restored.snapshot.profileMarkdown);
          clearLocalConversationV4();
        } else {
          const migrated = localConversationFromSnapshot(restored.snapshot);
          setSession(migrated);
          saveLocalConversationV4(migrated);
          setCapability(null);
          clearDraftCapability();
        }
        setLoadState("chat");
      } catch (restoreError) {
        if (cancelled) return;
        if (isTerminalDraftRestoreError(restoreError)) {
          clearDraftCapability();
          setCapability(null);
          saveLocalConversationV4(session);
          setLoadState("chat");
        } else {
          setError(readableError(restoreError, "The secure onboarding draft isn’t available right now. Please try again in a moment."));
          setLoadState("error");
        }
      }
    };
    void openChat();
    return () => { cancelled = true; };
  }, [onProfileMarkdownChange, retryKey, session]);

  if (loadState === "starting") return <LoadingShell onExit={props.onExit} />;
  if (loadState === "error") {
    return <ChatStartError error={error} onExit={props.onExit} onRetry={() => setRetryKey((value) => value + 1)} />;
  }

  return (
    <ChatOnboarding
      {...props}
      initialCapability={capability}
      initialReviewSnapshot={reviewSnapshot}
      initialSession={session}
    />
  );
}

function ChatOnboarding({
  identity,
  initialCapability,
  initialReviewSnapshot,
  initialSession,
  onExit,
  onIdentityChange,
  onMagicLinkRequested,
  onProfileMarkdownChange,
}: OnboardingFlowProps & {
  initialCapability: DraftCapability | null;
  initialReviewSnapshot: OnboardingDraftSnapshotV3 | null;
  initialSession: OnboardingConversationSessionV4;
}) {
  const [session, setSession] = useState(initialSession);
  const [capability, setCapability] = useState(initialCapability);
  const [reviewSnapshot, setReviewSnapshot] = useState(initialReviewSnapshot);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [finalizationError, setFinalizationError] = useState<string | null>(null);
  const [preparingDetails, setPreparingDetails] = useState(false);
  const sessionRef = useRef(session);
  const finalizationKeyRef = useRef<string | null>(null);

  useEffect(() => { sessionRef.current = session; }, [session]);

  const updateSession = useCallback((next: OnboardingConversationSessionV4) => {
    sessionRef.current = next;
    setSession(next);
    saveLocalConversationV4(next);
  }, []);

  const updateReviewSnapshot = useCallback((next: OnboardingDraftSnapshotV3) => {
    setReviewSnapshot(next);
    if (next.profileMarkdown !== null) onProfileMarkdownChange(next.profileMarkdown);
  }, [onProfileMarkdownChange]);

  const chatModel = useMemo<ChatModelAdapter>(() => ({
    async *run({ messages, abortSignal }) {
      const transcript = messages.flatMap((message): OnboardingChatMessage[] => {
        if (message.role !== "assistant" && message.role !== "user") return [];
        const text = message.content
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("\n")
          .trim();
        if (!text) return [];
        return [{
          id: message.id,
          role: message.role,
          text,
          createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : new Date().toISOString(),
          sequence: 0,
        }];
      }).map((message, index) => ({ ...message, sequence: index + 1 }));
      if (transcript.at(-1)?.role !== "user") throw new Error("Write an answer before sending.");

      const clientStartedAt = performance.now();
      const pending = await runWebOnboardingTurnV4({ messages: transcript }, abortSignal);
      const streamReadyMs = Math.round(performance.now() - clientStartedAt);
      let streamedReply = "";
      let firstReplyMs: number | null = null;
      for await (const chunk of pending.stream) {
        if (chunk.type !== "reply_delta" || !chunk.text) continue;
        streamedReply += chunk.text;
        if (firstReplyMs === null) firstReplyMs = Math.round(performance.now() - clientStartedAt);
        yield { content: [{ type: "text", text: streamedReply }] };
      }

      const response = await pending.data;
      const assistantMessage = response.result.reply;
      if (!assistantMessage) throw new Error("Petey returned an empty reply. Please try again.");
      const completedAt = new Date().toISOString();
      updateSession({
        schemaVersion: 4,
        status: response.result.readyForReview ? "ready_to_map" : "collecting",
        messages: [
          ...transcript,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: assistantMessage,
            createdAt: completedAt,
            sequence: transcript.length + 1,
          },
        ],
        quickReplies: response.result.readyForReview ? [] : response.result.quickReplies,
        userTurns: transcript.filter(({ role }) => role === "user").length,
        updatedAt: completedAt,
      });
      console.info("web_onboarding_latency_v4", {
        streamReadyMs,
        firstReplyMs,
        clientTotalMs: Math.round(performance.now() - clientStartedAt),
        ...response.timings,
      });
      if (streamedReply !== assistantMessage) {
        yield { content: [{ type: "text", text: assistantMessage }] };
      }
    },
  }), [updateSession]);

  const initialMessages = useMemo<ThreadMessageLike[]>(() => initialSession.messages.map((message) => (
    message.role === "assistant"
      ? {
          id: message.id,
          role: "assistant" as const,
          content: [{ type: "text" as const, text: message.text }],
          createdAt: new Date(message.createdAt),
          status: { type: "complete" as const, reason: "stop" as const },
        }
      : {
          id: message.id,
          role: "user" as const,
          content: [{ type: "text" as const, text: message.text }],
          createdAt: new Date(message.createdAt),
        }
  )), [initialSession.messages]);

  const runtime = useLocalRuntime(chatModel, { initialMessages });
  const progress = conversationProgress(reviewSnapshot?.status ?? session.status, session.userTurns);
  const showingSecureDetails = Boolean(capability && reviewSnapshot?.profileMarkdown)
    && (reviewSnapshot?.status === "review" || reviewSnapshot?.status === "confirmed");

  const prepareDetails = useCallback(async () => {
    const current = sessionRef.current;
    if (current.status !== "ready_to_map" || preparingDetails) return;
    const idempotencyKey = finalizationKeyRef.current ?? createIdempotencyKey();
    finalizationKeyRef.current = idempotencyKey;
    setPreparingDetails(true);
    setFinalizationError(null);
    try {
      const response = await finalizeWebOnboardingV4({
        consentVersion: WEB_ONBOARDING_CONSENT_VERSION,
        idempotencyKey,
        messages: current.messages,
      });
      setCapability({ draftId: response.draftId, capability: response.capability });
      updateReviewSnapshot(response.snapshot);
      finalizationKeyRef.current = null;
    } catch (prepareError) {
      setFinalizationError(readableError(
        prepareError,
        "We couldn’t prepare your details. Your conversation is kept on this device — try again.",
      ));
    } finally {
      setPreparingDetails(false);
    }
  }, [preparingDetails, updateReviewSnapshot]);

  useEffect(() => {
    if (session.status === "ready_to_map" && !reviewSnapshot && !finalizationError) void prepareDetails();
  }, [finalizationError, prepareDetails, reviewSnapshot, session.status]);

  const deleteAndExit = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteWebOnboardingDraftV3(capability ?? undefined);
      clearLocalConversationV4();
      clearDraftCapability();
      onExit();
    } catch {
      setDeleteError("We couldn’t delete this chat. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="onboarding-shell onboarding-shell--chat">
      <ChatHeader deleteError={deleteError} deleting={deleting} inactive={showingSecureDetails} onDelete={deleteAndExit} onExit={onExit} progress={progress} />
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadPrimitive.Root aria-hidden={showingSecureDetails || undefined} className="chat-thread" inert={showingSecureDetails || undefined}>
          <ThreadPrimitive.Viewport autoScroll={session.status === "collecting"} className="chat-thread__viewport">
            <div aria-live="polite" className="chat-thread__messages">
              <ThreadPrimitive.Messages components={{ AssistantMessage, UserMessage }} />
            </div>

            {session.status === "ready_to_map" && !reviewSnapshot ? (
              <PreparingDetails error={finalizationError} preparing={preparingDetails} onRetry={() => void prepareDetails()} />
            ) : null}

            <ThreadPrimitive.ViewportFooter className="chat-thread__footer">
              {session.status === "collecting" ? <QuickReplies prompts={session.quickReplies} /> : null}
              {session.status === "collecting" ? <ChatComposer /> : null}
            </ThreadPrimitive.ViewportFooter>
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
      </AssistantRuntimeProvider>
      {showingSecureDetails && capability && reviewSnapshot?.profileMarkdown ? (
        <SecureDetailsModal
          capability={capability}
          identity={identity}
          onIdentityChange={onIdentityChange}
          onMagicLinkRequested={onMagicLinkRequested}
          onSnapshotChange={updateReviewSnapshot}
          profileMarkdown={reviewSnapshot.profileMarkdown}
          snapshot={reviewSnapshot}
        />
      ) : null}
    </main>
  );
}

function QuickReplies({ prompts }: { prompts: string[] }) {
  const aui = useAui();
  const labels = [...new Set(prompts.map((prompt) => prompt.trim().replace(/\.+$/, "").trim()))]
    .filter(Boolean);
  if (labels.length === 0) return null;
  return (
    <div aria-label="Suggested replies" className="chat-suggestions">
      {labels.map((prompt) => (
        <button className="chat-suggestion" key={prompt} onClick={() => {
          aui.thread.composer().setText(prompt);
          aui.thread.composer().send();
        }} type="button">{prompt}</button>
      ))}
    </div>
  );
}

function ChatHeader({
  deleteError,
  deleting,
  inactive,
  onDelete,
  onExit,
  progress,
}: {
  deleteError: string | null;
  deleting: boolean;
  inactive: boolean;
  onDelete: () => void;
  onExit: () => void;
  progress: ReturnType<typeof conversationProgress>;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <header aria-hidden={inactive || undefined} className="flow-header chat-header" inert={inactive || undefined}>
      <button aria-label="Back to home" className="icon-button" onClick={onExit} type="button"><ArrowLeft size={20} /></button>
      <div className="chat-progress" role="progressbar" aria-label="Conversation progress" aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress.percent} aria-valuetext={`${progress.percent}% complete`}>
        <span className="sr-only">Conversation {progress.percent}% complete</span>
        <motion.span
          animate={{ width: `${progress.percent}%` }}
          aria-hidden="true"
          className="chat-progress__fill"
          initial={false}
          transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <button aria-label="Delete chat" className="chat-delete" disabled={deleting} onClick={onDelete} type="button">
        <Trash2 aria-hidden="true" size={17} /> <span>{deleting ? "Deleting…" : "Delete chat"}</span>
      </button>
      {deleteError ? <p className="flow-error chat-delete-error" role="alert">{deleteError}</p> : null}
    </header>
  );
}

function AssistantMessage() {
  const messageIndex = useAuiState((state) => state.message.index);
  const reducedMotion = useReducedMotion();
  const openingDelay = messageIndex === 0 ? 80 : messageIndex === 1 ? 680 : 0;
  return (
    <MessagePrimitive.Root className="chat-message chat-message--assistant" style={{ animationDelay: reducedMotion ? "0ms" : `${openingDelay}ms` }}>
      <span aria-hidden="true" className="chat-message__avatar">P</span>
      <div className="chat-message__content">
        <MessagePrimitive.Parts components={{ Empty: AssistantPending, Text: GenerativeText }} />
        <MessagePrimitive.Error>
          <div className="chat-message__failure" role="alert">
            <ErrorPrimitive.Root className="chat-message__error"><ErrorPrimitive.Message /></ErrorPrimitive.Root>
            <ActionBarPrimitive.Root>
              <ActionBarPrimitive.Reload className="chat-message__retry" type="button"><RotateCcw size={15} /> Try again</ActionBarPrimitive.Reload>
            </ActionBarPrimitive.Root>
          </div>
        </MessagePrimitive.Error>
      </div>
    </MessagePrimitive.Root>
  );
}

function GenerativeText({ text }: TextMessagePartProps) {
  const messageIndex = useAuiState((state) => state.message.index);
  const reducedMotion = useReducedMotion();
  const openingDelay = messageIndex === 0 ? 120 : messageIndex === 1 ? 720 : 45;
  return (
    <p className="chat-message__text">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{text.split(/(\s+)/).map((segment, index) => {
        if (/^\s+$/.test(segment)) return segment;
        const delay = openingDelay + Math.min(index * 28, 715);
        return <motion.span animate={{ opacity: 1, y: 0 }} className="chat-message__word" initial={reducedMotion ? false : { opacity: 0, y: 3 }} key={`${segment}-${index}`} transition={{ delay: reducedMotion ? 0 : delay / 1_000, duration: reducedMotion ? 0 : 0.18 }}>{segment}</motion.span>;
      })}</span>
    </p>
  );
}

function AssistantPending({ status }: EmptyMessagePartProps) {
  if (status.type !== "running") return null;
  return <span aria-label="Petey is thinking" className="chat-typing" role="status"><span aria-hidden="true"><i /><i /><i /></span></span>;
}

function UserMessage() {
  return <MessagePrimitive.Root className="chat-message chat-message--user"><div className="chat-message__content"><MessagePrimitive.Parts /></div></MessagePrimitive.Root>;
}

function ChatComposer() {
  const running = useAuiState((state) => state.thread.isRunning);
  return (
    <div className="chat-composer-wrap">
      <ComposerPrimitive.Root className="chat-composer">
        <ComposerPrimitive.Input aria-label="Your answer" autoFocus className="chat-composer__input" maxLength={2_000} placeholder="Answer naturally…" rows={1} />
        <ComposerPrimitive.Send aria-label="Send answer" className="chat-composer__send">
          {running ? <LoaderCircle className="status-spinner" size={18} /> : <Send size={18} />}
        </ComposerPrimitive.Send>
      </ComposerPrimitive.Root>
      <span className="sr-only" role="status">{running ? "Reading your answer" : "Ready for your answer"}</span>
    </div>
  );
}

function PreparingDetails({ error, preparing, onRetry }: { error: string | null; preparing: boolean; onRetry: () => void }) {
  return (
    <section aria-live="polite" className="chat-preparing" role="status">
      {preparing ? <LoaderCircle aria-hidden="true" className="status-spinner" size={22} /> : null}
      <div>
        <h2>{error ? "Your details aren’t ready yet" : "Preparing your details…"}</h2>
        <p>{error ?? "I’m securely finishing your matching profile."}</p>
      </div>
      {error ? <button className="secondary-button" onClick={onRetry} type="button"><RotateCcw size={16} /> Try preparing again</button> : null}
    </section>
  );
}

function SecureDetailsModal({
  capability,
  identity,
  onIdentityChange,
  onMagicLinkRequested,
  onSnapshotChange,
  profileMarkdown,
  snapshot,
}: {
  capability: DraftCapability;
  identity: IdentityAnswers;
  onIdentityChange: (identity: IdentityAnswers) => void;
  onMagicLinkRequested: OnboardingFlowProps["onMagicLinkRequested"];
  onSnapshotChange: (snapshot: OnboardingDraftSnapshotV3) => void;
  profileMarkdown: string;
  snapshot: OnboardingDraftSnapshotV3;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstIdentityFieldRef = useRef<HTMLInputElement | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      firstIdentityFieldRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const keepFocusInDialog = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      "input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ) ?? []);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const submitIdentity = async (event: FormEvent) => {
    event.preventDefault();
    const profileResult = profileMarkdownSchema.safeParse(profileMarkdown);
    if (!profileResult.success) {
      setError("We couldn’t finish preparing your matching profile. Please delete this chat and start again.");
      return;
    }
    const identityResult = identityAnswersSchema.safeParse(identity);
    if (!identityResult.success) {
      setError(identityResult.error.issues[0]?.message ?? "Check your private details.");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const confirmed = await confirmWebOnboardingDraftV3({
        ...capability,
        profileMarkdown: profileResult.data,
        identity: identityResult.data,
        expectedVersion: snapshot.version,
      });
      onSnapshotChange(confirmed.snapshot);
      const normalizedEmail = identityResult.data.email.trim().toLowerCase();
      const mode = await requestMagicLink(normalizedEmail);
      onMagicLinkRequested(normalizedEmail, mode);
    } catch (submitError) {
      setError(readableError(submitError, "We couldn’t send the sign-in link. Try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="secure-details-modal" role="presentation">
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        aria-describedby="secure-details-description"
        aria-labelledby="secure-details-title"
        aria-modal="true"
        className="secure-details-modal__panel"
        initial={reducedMotion ? false : { opacity: 0, scale: 0.985, y: 12 }}
        onKeyDown={keepFocusInDialog}
        ref={dialogRef}
        role="dialog"
        transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <form className="secure-identity" onSubmit={submitIdentity}>
          <div className="secure-identity__heading">
            <span aria-hidden="true" className="secure-identity__icon"><LockKeyhole size={20} /></span>
            <div>
              <h2 id="secure-details-title">Secure final details</h2>
              <p id="secure-details-description">These private details stay separate from your conversation and are only used for your account and secure sign-in.</p>
            </div>
          </div>
          <label className="input-field"><span>Full name</span><input autoComplete="name" maxLength={100} onChange={(event) => onIdentityChange({ ...identity, fullName: event.target.value })} placeholder="Your name" ref={firstIdentityFieldRef} value={identity.fullName} /></label>
          <label className="input-field"><span>Date of birth</span><input autoComplete="bday" inputMode="numeric" maxLength={10} onChange={(event) => onIdentityChange({ ...identity, dateOfBirth: formatDobInput(event.target.value) })} placeholder="DD/MM/YYYY" value={identity.dateOfBirth} /><small>You must be 18 or over. Your date of birth stays private.</small></label>
          <label className="input-field"><span>Email address</span><input autoCapitalize="none" autoComplete="email" inputMode="email" maxLength={320} onChange={(event) => onIdentityChange({ ...identity, email: event.target.value })} placeholder="you@example.com" type="email" value={identity.email} /><small>No password. We’ll send one secure sign-in link.</small></label>
          {error ? <p aria-live="polite" className="flow-error secure-identity__error" role="alert">{error}</p> : null}
          <button className="primary-button" disabled={submitting} type="submit">{submitting ? "Sending link…" : "Confirm and email my link"}{!submitting ? <ArrowRight aria-hidden="true" size={18} /> : null}</button>
        </form>
      </motion.div>
    </div>
  );
}

function ChatStartError({ error, onExit, onRetry }: { error: string | null; onExit: () => void; onRetry: () => void }) {
  return <main className="onboarding-shell onboarding-shell--chat"><header className="flow-header chat-header chat-header--simple"><button aria-label="Back to home" className="icon-button" onClick={onExit} type="button"><ArrowLeft size={20} /></button></header><section className="chat-loading" role="alert"><h1>We couldn’t start the chat.</h1><p>{error ?? "Check your connection and try again."}</p><button className="primary-button" onClick={onRetry} type="button">Try again <ArrowRight size={18} /></button></section></main>;
}

function LoadingShell({ onExit }: { onExit: () => void }) {
  return <main className="onboarding-shell onboarding-shell--chat"><header className="flow-header chat-header chat-header--simple"><button aria-label="Back to home" className="icon-button" onClick={onExit} type="button"><ArrowLeft size={20} /></button></header><section className="chat-loading" role="status"><LoaderCircle className="status-spinner" size={26} /><h1>Preparing your onboarding</h1><p>Detailed answers help us find the perfect match</p></section></main>;
}
