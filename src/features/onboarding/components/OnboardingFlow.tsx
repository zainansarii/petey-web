import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiEvent,
  useAuiState,
  useLocalRuntime,
  type ChatModelAdapter,
  type EmptyMessagePartProps,
  type TextMessagePartProps,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, LoaderCircle, LockKeyhole, RotateCcw, Send, Trash2, X } from "lucide-react";
import { requestMagicLink } from "../../auth/api/magicLink";
import { TrainerCard } from "../../discovery/components/TrainerCard";
import type { TrainerCardPreview } from "../../discovery/model/trainer";
import { TextDots } from "../../../shared/ui/TextDots";
import { TwinOrbit } from "../../../shared/ui/TwinOrbit";
import { usePhoneLayout } from "../../../shared/ui/usePhoneLayout";
import { useChatViewport } from "./useChatViewport";
import {
  clearLocalConversationV4,
  clearDraftCapability,
  confirmWebOnboardingDraftV3,
  createLocalConversationV4,
  createIdempotencyKey,
  deleteWebOnboardingDraftV3,
  finalizeWebOnboardingV4,
  getWebOnboardingDraftV3,
  matchWebOnboardingDraftV1,
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
  type MatchPreviewResult,
  type OnboardingChatMessage,
  type OnboardingConversationSessionV4,
  type OnboardingDraftSnapshotV3,
} from "../model/onboarding";

type OnboardingFlowProps = {
  profileMarkdown: string;
  identity: IdentityAnswers;
  previewHandoff?: boolean;
  onExit: () => void;
  onIdentityChange: (identity: IdentityAnswers) => void;
  onMagicLinkRequested: (email: string, mode: "sent" | "preview") => void;
  onMatchesReady?: (capability: DraftCapability) => Promise<void>;
  onProfileMarkdownChange: (profileMarkdown: string) => void;
};

type LoadState = "starting" | "chat" | "error";
type HandoffPhase = "chat" | "confirmation" | "clearing" | "matching" | "matches" | "error";

const COMPLETION_MESSAGE = "Thanks! We have everything needed now to find your match.";
const COMPLETION_HOLD_MS = 1_400;
const CLEARING_MS = 500;
const MINIMUM_MATCHING_MS = 2_500;
const CHAT_SCROLL_TIME_CONSTANT_MS = 180;
const CHAT_SCROLL_SETTLE_DISTANCE_PX = 0.5;

const createHandoffPreviewSessionV4 = (): OnboardingConversationSessionV4 => {
  const opening = createLocalConversationV4();
  const createdAt = new Date().toISOString();
  return {
    ...opening,
    status: "ready_to_map",
    messages: [
      ...opening.messages,
      {
        id: crypto.randomUUID(),
        role: "user",
        text: "I’m ready to see my matches.",
        createdAt,
        sequence: opening.messages.length + 1,
      },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: COMPLETION_MESSAGE,
        createdAt,
        sequence: opening.messages.length + 2,
      },
    ],
    quickReplies: [],
    userTurns: 6,
    updatedAt: createdAt,
  };
};

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
  const { onProfileMarkdownChange, previewHandoff = false } = props;
  const [initialCapability] = useState<DraftCapability | null>(() => (
    previewHandoff ? null : readDraftCapability()
  ));
  const [loadState, setLoadState] = useState<LoadState>(initialCapability ? "starting" : "chat");
  const [session, setSession] = useState<OnboardingConversationSessionV4>(() => (
    previewHandoff
      ? createHandoffPreviewSessionV4()
      : readLocalConversationV4() ?? createLocalConversationV4()
  ));
  const [reviewSnapshot, setReviewSnapshot] = useState<OnboardingDraftSnapshotV3 | null>(null);
  const [capability, setCapability] = useState<DraftCapability | null>(initialCapability);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const openChat = async () => {
      setError(null);
      if (previewHandoff) {
        setLoadState("chat");
        return;
      }
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
  }, [onProfileMarkdownChange, previewHandoff, retryKey, session]);

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
  onMatchesReady,
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
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [handoffPhase, setHandoffPhase] = useState<HandoffPhase>(() => {
    if (initialReviewSnapshot?.profileMarkdown) return initialReviewSnapshot.matching ? "matches" : "matching";
    if (initialSession.status === "ready_to_map") return "confirmation";
    return "chat";
  });
  const sessionRef = useRef(session);
  const finalizationKeyRef = useRef<string | null>(null);
  const handoffRef = useRef<HTMLElement | null>(null);
  const matchingStartedAtRef = useRef<number | null>(null);
  const matchingRequestActiveRef = useRef(false);
  const savedRetuneAttemptRef = useRef<string | null>(null);
  const matchingAttemptedDraftRef = useRef<string | null>(null);
  const threadViewportRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  const reducedMotion = Boolean(useReducedMotion());
  useChatViewport(shellRef);

  useEffect(() => { sessionRef.current = session; }, [session]);

  const updateSession = useCallback((next: OnboardingConversationSessionV4) => {
    sessionRef.current = next;
    if (next.status === "ready_to_map") {
      setHandoffPhase((current) => current === "chat" ? "confirmation" : current);
    }
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
      const streamIterator = pending.stream[Symbol.asyncIterator]();
      const finalResponse = pending.data.then((value) => ({ type: "response" as const, value }));
      const commitTurn = (
        assistantMessage: string,
        readyForReview: boolean,
        quickReplies: string[],
      ) => {
        const completedAt = new Date().toISOString();
        updateSession({
          schemaVersion: 4,
          status: readyForReview ? "ready_to_map" : "collecting",
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
          quickReplies: readyForReview ? [] : quickReplies,
          userTurns: transcript.filter(({ role }) => role === "user").length,
          updatedAt: completedAt,
        });
      };
      let response: Awaited<typeof pending.data> | null = null;
      while (!response) {
        const event = await Promise.race([
          streamIterator.next().then((result) => ({ type: "stream" as const, result })),
          finalResponse,
        ]);
        if (event.type === "response") {
          response = event.value;
          void streamIterator.return?.().catch(() => undefined);
          break;
        }
        if (event.result.done) {
          response = await pending.data;
          break;
        }
        const chunk = event.result.value;
        if (chunk.type !== "reply_delta" || !chunk.text) continue;
        streamedReply += chunk.text;
        if (firstReplyMs === null) firstReplyMs = Math.round(performance.now() - clientStartedAt);
        yield { content: [{ type: "text", text: streamedReply }] };
      }

      const assistantMessage = response.result.readyForReview
        ? COMPLETION_MESSAGE
        : response.result.reply;
      if (!assistantMessage) throw new Error("Petey returned an empty reply. Please try again.");
      commitTurn(assistantMessage, response.result.readyForReview, response.result.quickReplies);
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
          content: [{
            type: "text" as const,
            text: initialSession.status === "ready_to_map"
              && message.id === initialSession.messages.at(-1)?.id
              ? COMPLETION_MESSAGE
              : message.text,
          }],
          createdAt: new Date(message.createdAt),
          status: { type: "complete" as const, reason: "stop" as const },
        }
      : {
          id: message.id,
          role: "user" as const,
          content: [{ type: "text" as const, text: message.text }],
          createdAt: new Date(message.createdAt),
        }
  )), [initialSession.messages, initialSession.status]);

  const runtime = useLocalRuntime(chatModel, { initialMessages });
  const progress = conversationProgress(reviewSnapshot?.status ?? session.status, session.userTurns);
  const hasSecureDetails = Boolean(capability && reviewSnapshot?.profileMarkdown)
    && (reviewSnapshot?.status === "review" || reviewSnapshot?.status === "confirmed");
  const hasMatchingResults = hasSecureDetails && Boolean(reviewSnapshot?.matching);
  const showingSecureDetails = hasMatchingResults
    && !onMatchesReady
    && handoffPhase === "matches"
    && selectedMatchId !== null;
  const showComposer = handoffPhase === "chat" || handoffPhase === "confirmation";
  const chatRetired = !showComposer && handoffPhase !== "clearing";

  useLayoutEffect(() => {
    // Once the downward transition finishes, the transcript leaves the scroll
    // layout. Start the handoff at the top, including when restoring a draft.
    if (chatRetired && threadViewportRef.current) threadViewportRef.current.scrollTop = 0;
  }, [chatRetired]);

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
        "We couldn’t prepare your matches. Your progress is saved — try again.",
      ));
    } finally {
      setPreparingDetails(false);
    }
  }, [preparingDetails, updateReviewSnapshot]);

  useEffect(() => {
    if (session.status === "ready_to_map" && !reviewSnapshot && !finalizationError) void prepareDetails();
  }, [finalizationError, prepareDetails, reviewSnapshot, session.status]);

  const prepareMatches = useCallback(async () => {
    if (!capability || !reviewSnapshot?.profileMarkdown || matchingRequestActiveRef.current
      || matchingAttemptedDraftRef.current === capability.draftId) return;
    // Keep the attempt recorded after it settles: an already queued effect may
    // still hold a snapshot without matching results until React commits them.
    matchingAttemptedDraftRef.current = capability.draftId;
    matchingRequestActiveRef.current = true;
    try {
      const { matching } = await matchWebOnboardingDraftV1(capability);
      updateReviewSnapshot({ ...reviewSnapshot, matching });
    } catch (matchingError) {
      setFinalizationError(readableError(
        matchingError,
        "We couldn’t find your matches just now. Your training brief is saved — try again.",
      ));
    } finally {
      matchingRequestActiveRef.current = false;
    }
  }, [capability, reviewSnapshot, updateReviewSnapshot]);

  useEffect(() => {
    let active = true;
    if (hasSecureDetails && !reviewSnapshot?.matching && !finalizationError) {
      void Promise.resolve().then(() => {
        if (active) return prepareMatches();
      });
    }
    return () => { active = false; };
  }, [finalizationError, hasSecureDetails, prepareMatches, reviewSnapshot?.matching]);

  useEffect(() => {
    if (handoffPhase !== "confirmation") return;
    const confirmationTimer = window.setTimeout(
      () => setHandoffPhase("clearing"),
      COMPLETION_HOLD_MS,
    );
    return () => window.clearTimeout(confirmationTimer);
  }, [handoffPhase]);

  useEffect(() => {
    if (handoffPhase !== "clearing") return;
    handoffRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    const matchingTimer = window.setTimeout(() => {
      matchingStartedAtRef.current = performance.now();
      setHandoffPhase("matching");
    }, reducedMotion ? 0 : CLEARING_MS);
    return () => {
      window.clearTimeout(matchingTimer);
    };
  }, [handoffPhase, reducedMotion]);

  useEffect(() => {
    if (handoffPhase !== "matching") return;
    matchingStartedAtRef.current ??= performance.now();
    if (!hasMatchingResults && !finalizationError) return;
    const minimumDuration = reducedMotion ? 300 : MINIMUM_MATCHING_MS;
    const elapsed = performance.now() - (matchingStartedAtRef.current ?? performance.now());
    const revealTimer = window.setTimeout(() => {
      setHandoffPhase(finalizationError ? "error" : "matches");
    }, Math.max(0, minimumDuration - elapsed));
    return () => window.clearTimeout(revealTimer);
  }, [finalizationError, handoffPhase, hasMatchingResults, reducedMotion]);

  useEffect(() => {
    if (handoffPhase !== "matches" || !hasMatchingResults || !capability || !onMatchesReady
      || savedRetuneAttemptRef.current === capability.draftId) return;
    savedRetuneAttemptRef.current = capability.draftId;
    void onMatchesReady(capability).catch((saveError) => {
      setFinalizationError(readableError(saveError, "We couldn’t save your updated matches. Your answers are saved — try again."));
      setHandoffPhase("error");
    });
  }, [capability, handoffPhase, hasMatchingResults, onMatchesReady]);

  const retryPreparingDetails = useCallback(() => {
    savedRetuneAttemptRef.current = null;
    setFinalizationError(null);
    matchingStartedAtRef.current = performance.now();
    setHandoffPhase("matching");
    if (reviewSnapshot?.matching) return;
    if (reviewSnapshot?.profileMarkdown) {
      matchingAttemptedDraftRef.current = null;
      void prepareMatches();
    } else void prepareDetails();
  }, [prepareDetails, prepareMatches, reviewSnapshot?.matching, reviewSnapshot?.profileMarkdown]);

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
    <main className="onboarding-shell onboarding-shell--chat" ref={shellRef}>
      <ChatHeader
        deleteError={deleteError}
        deleting={deleting}
        inactive={showingSecureDetails}
        onDelete={deleteAndExit}
        onExit={onExit}
        progress={progress}
        showProgress={showComposer}
      />
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadPrimitive.Root aria-hidden={showingSecureDetails || undefined} className="chat-thread" inert={showingSecureDetails || undefined}>
          <ThreadPrimitive.Viewport
            aria-label="Conversation"
            autoScroll={false}
            className="chat-thread__viewport"
            data-handoff-phase={handoffPhase}
            ref={threadViewportRef}
            role="region"
            scrollToBottomOnInitialize={false}
            scrollToBottomOnRunStart={false}
            scrollToBottomOnThreadSwitch={false}
            tabIndex={0}
          >
            <ChatScrollAnimator
              enabled={handoffPhase === "chat" || handoffPhase === "confirmation"}
              reducedMotion={reducedMotion}
              viewportRef={threadViewportRef}
            />
            <div aria-live="polite" className="chat-thread__messages" hidden={chatRetired} inert={!showComposer || undefined}>
              <ThreadPrimitive.Messages components={{ AssistantMessage, UserMessage }} />
            </div>

            {handoffPhase !== "chat" && handoffPhase !== "confirmation" ? (
              <PostChatHandoff
                error={finalizationError}
                matching={reviewSnapshot?.matching}
                onCreateAccount={() => setSelectedMatchId("account")}
                onSelectMatch={setSelectedMatchId}
                onRetry={retryPreparingDetails}
                phase={onMatchesReady && handoffPhase === "matches" ? "matching" : handoffPhase}
                reducedMotion={reducedMotion}
                stageRef={handoffRef}
              />
            ) : null}

          </ThreadPrimitive.Viewport>
          <div className="chat-thread__footer" hidden={chatRetired}>
            <AnimatePresence initial={false}>
              {showComposer ? (
                <motion.div
                  animate={{ opacity: 1 }}
                  aria-hidden={handoffPhase === "confirmation" || undefined}
                  className="chat-thread__controls"
                  exit={{ opacity: 0 }}
                  inert={handoffPhase === "confirmation" || undefined}
                  initial={false}
                  key="chat-controls"
                  transition={{ duration: reducedMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  {session.status === "collecting" ? <QuickReplies prompts={session.quickReplies} /> : null}
                  <ChatComposer inactive={handoffPhase === "confirmation"} />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </ThreadPrimitive.Root>
      </AssistantRuntimeProvider>
      <AnimatePresence initial={false}>
        {showingSecureDetails && capability && reviewSnapshot?.profileMarkdown ? (
          <SecureDetailsModal
            capability={capability}
            identity={identity}
            onClose={() => setSelectedMatchId(null)}
            key="secure-details"
            onIdentityChange={onIdentityChange}
            onMagicLinkRequested={onMagicLinkRequested}
            onSnapshotChange={updateReviewSnapshot}
            profileMarkdown={reviewSnapshot.profileMarkdown}
            snapshot={reviewSnapshot}
          />
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function PostChatHandoff({
  error,
  matching,
  onCreateAccount,
  onRetry,
  onSelectMatch,
  phase,
  reducedMotion,
  stageRef,
}: {
  error: string | null;
  matching: MatchPreviewResult | undefined;
  onCreateAccount: () => void;
  onRetry: () => void;
  onSelectMatch: (trainerId: string) => void;
  phase: HandoffPhase;
  reducedMotion: boolean;
  stageRef: RefObject<HTMLElement | null>;
}) {
  return (
    <section className="post-chat-handoff" ref={stageRef}>
      <AnimatePresence initial={false} mode="wait">
        {phase === "matching" ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="post-chat-matching"
            exit={{ opacity: 0 }}
            initial={reducedMotion ? false : { opacity: 0 }}
            key="matching"
            transition={{ duration: reducedMotion ? 0 : 0.56, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="post-chat-matching__content">
              <span aria-hidden="true" className="post-chat-matching__loader">
                <TwinOrbit className="post-chat-matching__orbit" />
              </span>
              <h2>
                <TextDots aria-label="Finding your personal trainer">Finding your personal trainer</TextDots>
              </h2>
            </div>
          </motion.div>
        ) : null}

        {phase === "matches" && matching ? (
          <motion.div
            animate={{ opacity: 1 }}
            aria-live="polite"
            className="post-chat-results"
            initial={reducedMotion ? false : { opacity: 0 }}
            key="matches"
            transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.h2
              animate={{ opacity: 1, y: 0 }}
              initial={reducedMotion ? false : { opacity: 0, y: 52 }}
              transition={{ duration: reducedMotion ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              {matching.totalMatches === 0 ? "No trainers available yet" : matching.matchKind === "closest"
                ? "Explore your closest options"
                : `We found ${matching.totalMatches} ${matching.totalMatches === 1 ? "match" : "matches"}`}
            </motion.h2>
            {matching.matchKind === "closest" && matching.totalMatches > 0 ? <p>We couldn’t find a close enough match for all your preferences. Here are the closest options to consider.</p> : null}
            {matching.totalMatches > 0 ? <MatchPreviews matching={matching} onSelect={onSelectMatch} reducedMotion={reducedMotion} /> : (
              <div className="post-chat-results__empty">
                <p>There are no available trainer profiles right now. You can still save your training brief by creating an account.</p>
                <button className="primary-button" onClick={onCreateAccount} type="button">
                  Create an account <ArrowRight aria-hidden="true" size={18} />
                </button>
              </div>
            )}
          </motion.div>
        ) : null}

        {phase === "error" ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="post-chat-error"
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            key="error"
            role="alert"
            transition={{ duration: reducedMotion ? 0 : 0.24 }}
          >
            <h2>Your matches aren’t ready yet</h2>
            <p>{error ?? "We couldn’t prepare your matches. Your progress is saved — try again."}</p>
            <button className="secondary-button" onClick={onRetry} type="button">
              <RotateCcw aria-hidden="true" size={16} /> Try again
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function MatchPreviews({ matching, onSelect, reducedMotion }: {
  matching: MatchPreviewResult;
  onSelect: (trainerId: string) => void;
  reducedMotion: boolean;
}) {
  const phoneLayout = usePhoneLayout();
  const [position, setPosition] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const previews = matching.previews.slice(0, 3);
  const count = previews.length;
  const activeIndex = count ? (position % count + count) % count : 0;
  const move = (direction: number) => setPosition((current) => current + direction);

  return <>
    <div
      aria-label={matching.matchKind === "closest" ? "Your closest trainer options" : "Your trainer matches"}
      aria-roledescription={phoneLayout && count > 1 ? "carousel" : undefined}
      className="match-preview"
      data-preview-count={count}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }}
      onKeyDown={(event) => {
        if (!phoneLayout || count < 2 || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        event.currentTarget.focus();
        move(event.key === "ArrowRight" ? 1 : -1);
      }}
      onTouchStart={(event) => {
        suppressClick.current = false;
        const touch = event.touches[0];
        touchStart.current = phoneLayout && touch ? { x: touch.clientX, y: touch.clientY } : null;
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const end = event.changedTouches[0];
        touchStart.current = null;
        if (!start || !end || count < 2) return;
        const dx = end.clientX - start.x;
        const dy = end.clientY - start.y;
        if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy)) {
          suppressClick.current = true;
          move(dx < 0 ? 1 : -1);
        }
      }}
      onTouchCancel={() => { touchStart.current = null; }}
      role="list"
      tabIndex={phoneLayout && count > 1 ? 0 : undefined}
    >
      {previews.map((trainer, index) => {
        const offset = (index - activeIndex + count) % count;
        return <MatchPreviewCard
          index={index}
          key={trainer.id}
          onSelect={onSelect}
          reducedMotion={reducedMotion}
          slot={phoneLayout ? (offset > 1 ? -1 : offset) : undefined}
          trainer={trainer}
        />;
      })}
    </div>
    {phoneLayout && count > 1 ? <div aria-label="Browse trainer matches" className="match-preview-nav">
      <button aria-label="Previous match" className="icon-button" onClick={() => move(-1)} type="button"><ArrowLeft aria-hidden="true" size={18} /></button>
      <span aria-live="polite" className="match-preview-nav__position">{activeIndex + 1} of {count}</span>
      <button aria-label="Next match" className="icon-button" onClick={() => move(1)} type="button"><ArrowRight aria-hidden="true" size={18} /></button>
    </div> : null}
  </>;
}

function MatchPreviewCard({
  index,
  onSelect,
  reducedMotion,
  slot,
  trainer,
}: {
  index: number;
  onSelect: (trainerId: string) => void;
  reducedMotion: boolean;
  slot?: number;
  trainer: TrainerCardPreview;
}) {
  const [focused, setFocused] = useState(false);
  const restingPose = { scale: 1, y: 0 };
  const raisedPose = reducedMotion || slot !== undefined ? restingPose : { scale: 1.025, y: -8 };
  const behind = slot !== undefined && slot !== 0;

  return (
    <motion.div
      animate={{ opacity: behind ? 0.42 : 1, y: 0, x: `${(slot ?? 0) * 20}%`, scale: behind ? 0.7 : 1 }}
      aria-hidden={behind || undefined}
      className="match-preview__item"
      initial={reducedMotion ? false : { opacity: 0, y: 20 }}
      inert={behind || undefined}
      role="listitem"
      style={{ zIndex: slot === undefined ? undefined : behind ? 1 : 2 }}
      transition={{
        delay: reducedMotion || slot !== undefined ? 0 : 0.28 + index * 0.13,
        duration: reducedMotion ? 0 : slot !== undefined ? 0.32 : 0.66,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <motion.div
        animate={focused ? raisedPose : restingPose}
        className="match-preview__card"
        initial={false}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}
        onFocusCapture={() => setFocused(true)}
        transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        whileHover={raisedPose}
      >
        <div aria-hidden="true" className="match-preview__profile">
          <TrainerCard trainer={trainer} variant="hero" />
        </div>
        <button
          aria-label={`Choose match ${index + 1}, ${trainer.name}: ${trainer.specialty}, ${trainer.area}, from £${trainer.price}`}
          className="match-preview__select"
          onClick={() => onSelect(trainer.id)}
          type="button"
        >
          <span className="match-preview__action">Choose <ArrowRight aria-hidden="true" size={15} /></span>
        </button>
      </motion.div>
    </motion.div>
  );
}

function QuickReplies({ prompts }: { prompts: string[] }) {
  const aui = useAui();
  const running = useAuiState((state) => state.thread.isRunning);
  const composing = useAuiState((state) => state.composer.text.trim().length > 0);
  const labels = prompts.map((prompt) => prompt.trim().replace(/\.+$/, "").trim())
    .filter(Boolean);
  if (labels.length === 0) return null;
  return (
    <div aria-label="Suggested replies" className="chat-suggestions" data-composing={composing}>
      {labels.map((prompt, index) => (
        <button className="chat-suggestion" disabled={running} key={`${index}-${prompt}`} onMouseDown={keepComposerFocus} onClick={() => {
          if (aui.thread.getState().isRunning) return;
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
  showProgress,
}: {
  deleteError: string | null;
  deleting: boolean;
  inactive: boolean;
  onDelete: () => void;
  onExit: () => void;
  progress: ReturnType<typeof conversationProgress>;
  showProgress: boolean;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <header aria-hidden={inactive || undefined} className="flow-header chat-header" inert={inactive || undefined}>
      <button aria-label="Back to home" className="icon-button" onClick={onExit} type="button"><ArrowLeft size={20} /></button>
      <AnimatePresence initial={false}>
        {showProgress ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="chat-progress"
            exit={{ opacity: 0 }}
            initial={false}
            key="chat-progress"
            role="progressbar"
            aria-label="Conversation progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress.percent}
            aria-valuetext={`${progress.percent}% complete`}
            transition={{ duration: reducedMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="sr-only">Conversation {progress.percent}% complete</span>
            <motion.span
              animate={{ scaleX: progress.percent / 100 }}
              aria-hidden="true"
              className="chat-progress__fill"
              initial={false}
              transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
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

function ChatScrollAnimator({
  enabled,
  reducedMotion,
  viewportRef,
}: {
  enabled: boolean;
  reducedMotion: boolean;
  viewportRef: RefObject<HTMLDivElement | null>;
}) {
  const animationFrameRef = useRef<number | null>(null);
  const measureFrameRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef<number | null>(null);
  const targetScrollTopRef = useRef(0);
  const followingBottomRef = useRef(true);

  const cancelAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    if (measureFrameRef.current !== null) cancelAnimationFrame(measureFrameRef.current);
    animationFrameRef.current = null;
    measureFrameRef.current = null;
    lastFrameAtRef.current = null;
  }, []);

  const animateToBottom = useCallback(function animateScroll(now: number) {
    const viewport = viewportRef.current;
    if (!viewport || !enabled || !followingBottomRef.current) {
      animationFrameRef.current = null;
      lastFrameAtRef.current = null;
      return;
    }

    const current = viewport.scrollTop;
    const distance = targetScrollTopRef.current - current;
    if (Math.abs(distance) <= CHAT_SCROLL_SETTLE_DISTANCE_PX) {
      viewport.scrollTop = targetScrollTopRef.current;
      animationFrameRef.current = null;
      lastFrameAtRef.current = null;
      return;
    }

    const previousFrameAt = lastFrameAtRef.current ?? now - (1_000 / 60);
    const elapsed = Math.min(34, Math.max(0, now - previousFrameAt));
    const easing = 1 - Math.exp(-elapsed / CHAT_SCROLL_TIME_CONSTANT_MS);
    viewport.scrollTop = current + distance * easing;
    lastFrameAtRef.current = now;
    animationFrameRef.current = requestAnimationFrame(animateScroll);
  }, [enabled, viewportRef]);

  const measureAndAnimate = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !enabled || !followingBottomRef.current) return;
    targetScrollTopRef.current = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    if (reducedMotion) {
      viewport.scrollTop = targetScrollTopRef.current;
      return;
    }
    if (animationFrameRef.current === null) {
      lastFrameAtRef.current = null;
      animationFrameRef.current = requestAnimationFrame(animateToBottom);
    }
  }, [animateToBottom, enabled, reducedMotion, viewportRef]);

  const scheduleMeasurement = useCallback(() => {
    if (measureFrameRef.current !== null) cancelAnimationFrame(measureFrameRef.current);
    measureFrameRef.current = requestAnimationFrame(() => {
      measureFrameRef.current = null;
      measureAndAnimate();
    });
  }, [measureAndAnimate]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    targetScrollTopRef.current = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    viewport.scrollTop = targetScrollTopRef.current;
  }, [viewportRef]);

  useAuiEvent("thread.runStart", () => {
    if (!enabled) return;
    followingBottomRef.current = true;
    scheduleMeasurement();
  });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const stopFollowing = () => {
      followingBottomRef.current = false;
      cancelAnimation();
    };
    const resumeAtBottom = () => {
      // Scrolling back down opts into following new replies again. Programmatic
      // animation frames must not be mistaken for someone reading older turns.
      if (animationFrameRef.current !== null) return;
      followingBottomRef.current = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 8;
    };
    const handleScrollKey = (event: globalThis.KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) stopFollowing();
    };
    viewport.addEventListener("wheel", stopFollowing, { passive: true });
    viewport.addEventListener("touchstart", stopFollowing, { passive: true });
    viewport.addEventListener("pointerdown", stopFollowing, { passive: true });
    viewport.addEventListener("scroll", resumeAtBottom, { passive: true });
    viewport.addEventListener("keydown", handleScrollKey);

    const resizeObserver = new ResizeObserver((entries) => {
      if (!enabled || !followingBottomRef.current) return;
      if (entries.some(({ target }) => target === viewport)) {
        // Match keyboard/composer resizing immediately; easing this movement
        // creates a second animation that lags behind the keyboard.
        cancelAnimation();
        targetScrollTopRef.current = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        viewport.scrollTop = targetScrollTopRef.current;
      } else {
        measureAndAnimate();
      }
    });
    resizeObserver.observe(viewport);
    viewport.querySelectorAll(":scope > .chat-thread__messages")
      .forEach((element) => resizeObserver.observe(element));

    return () => {
      viewport.removeEventListener("wheel", stopFollowing);
      viewport.removeEventListener("touchstart", stopFollowing);
      viewport.removeEventListener("pointerdown", stopFollowing);
      viewport.removeEventListener("scroll", resumeAtBottom);
      viewport.removeEventListener("keydown", handleScrollKey);
      resizeObserver.disconnect();
      cancelAnimation();
    };
  }, [cancelAnimation, enabled, measureAndAnimate, viewportRef]);

  return null;
}

function UserMessage() {
  return <MessagePrimitive.Root className="chat-message chat-message--user"><div className="chat-message__content"><MessagePrimitive.Parts /></div></MessagePrimitive.Root>;
}

function ChatComposer({ inactive = false }: { inactive?: boolean }) {
  const running = useAuiState((state) => state.thread.isRunning);
  const [autoFocus] = useState(() => !window.matchMedia("(pointer: coarse), (max-width: 767px)").matches);
  return (
    <div className="chat-composer-wrap">
      <ComposerPrimitive.Root className="chat-composer">
        <ComposerPrimitive.Input aria-label="Your answer" autoCapitalize="sentences" autoFocus={autoFocus} className="chat-composer__input" disabled={inactive} enterKeyHint="send" maxLength={2_000} maxRows={4} placeholder="Answer naturally…" rows={1} unstable_focusOnRunStart={false} unstable_focusOnScrollToBottom={false} unstable_focusOnThreadSwitched={false} />
        <ComposerPrimitive.Send aria-label="Send answer" className="chat-composer__send" disabled={inactive} onMouseDown={keepComposerFocus}>
          {running ? <LoaderCircle className="status-spinner" size={18} /> : <Send size={18} />}
        </ComposerPrimitive.Send>
      </ComposerPrimitive.Root>
      <span className="sr-only" role="status">{running ? "Reading your answer" : "Ready for your answer"}</span>
    </div>
  );
}

function keepComposerFocus(event: MouseEvent<HTMLButtonElement>) {
  // Sending is an action on the current draft. Keep an already-open keyboard
  // steady, but never open it just because someone picked a suggested answer.
  if (event.button === 0 && document.activeElement?.matches(".chat-composer__input")) {
    event.preventDefault();
  }
}

function SecureDetailsModal({
  capability,
  identity,
  onClose,
  onIdentityChange,
  onMagicLinkRequested,
  onSnapshotChange,
  profileMarkdown,
  snapshot,
}: {
  capability: DraftCapability;
  identity: IdentityAnswers;
  onClose: () => void;
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
    const trigger = document.activeElement;
    const frame = requestAnimationFrame(() => {
      firstIdentityFieldRef.current?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      requestAnimationFrame(() => {
        if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
      });
    };
  }, []);

  const keepFocusInDialog = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !submitting) {
      event.preventDefault();
      onClose();
      return;
    }
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
    <motion.div
      animate={{ opacity: 1 }}
      className="secure-details-modal"
      exit={{ opacity: 0 }}
      initial={reducedMotion ? false : { opacity: 0 }}
      role="presentation"
      transition={{ delay: reducedMotion ? 0 : 0.48, duration: reducedMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        animate={{ opacity: 1 }}
        aria-describedby="secure-details-description"
        aria-labelledby="secure-details-title"
        aria-modal="true"
        className="secure-details-modal__panel"
        initial={reducedMotion ? false : { opacity: 0 }}
        onKeyDown={keepFocusInDialog}
        ref={dialogRef}
        role="dialog"
        transition={{ delay: reducedMotion ? 0 : 0.5, duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <form className="secure-identity" onSubmit={submitIdentity}>
          <div className="secure-identity__heading">
            <div className="secure-identity__title">
              <span aria-hidden="true" className="secure-identity__icon"><LockKeyhole size={20} /></span>
              <h2 id="secure-details-title">Create an account</h2>
              <button aria-label="Close account dialog" className="dialog-close secure-identity__close" disabled={submitting} onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button>
            </div>
            <p id="secure-details-description">Add your basic details to access your matches. They stay separate from your conversation and are only used for your account and secure sign-in.</p>
          </div>
          <label className="input-field"><span>Full name</span><input autoComplete="name" maxLength={100} onChange={(event) => onIdentityChange({ ...identity, fullName: event.target.value })} placeholder="Your name" ref={firstIdentityFieldRef} value={identity.fullName} /></label>
          <label className="input-field"><span>Date of birth</span><input autoComplete="bday" inputMode="numeric" maxLength={10} onChange={(event) => onIdentityChange({ ...identity, dateOfBirth: formatDobInput(event.target.value) })} placeholder="DD/MM/YYYY" value={identity.dateOfBirth} /><small>You must be 18 or over. Your date of birth stays private.</small></label>
          <label className="input-field"><span>Email address</span><input autoCapitalize="none" autoComplete="email" inputMode="email" maxLength={320} onChange={(event) => onIdentityChange({ ...identity, email: event.target.value })} placeholder="you@example.com" type="email" value={identity.email} /><small>No password. We’ll send one secure sign-in link.</small></label>
          {error ? <p aria-live="polite" className="flow-error secure-identity__error" role="alert">{error}</p> : null}
          <button className="primary-button" disabled={submitting} type="submit">{submitting ? "Sending link…" : "Confirm and email my link"}{!submitting ? <ArrowRight aria-hidden="true" size={18} /> : null}</button>
        </form>
      </motion.div>
    </motion.div>
  );
}

function ChatStartError({ error, onExit, onRetry }: { error: string | null; onExit: () => void; onRetry: () => void }) {
  return <main className="onboarding-shell onboarding-shell--chat"><header className="flow-header chat-header chat-header--simple"><button aria-label="Back to home" className="icon-button" onClick={onExit} type="button"><ArrowLeft size={20} /></button></header><section className="chat-loading" role="alert"><h1>We couldn’t start the chat</h1><p>{error ?? "Check your connection and try again."}</p><button className="primary-button" onClick={onRetry} type="button">Try again <ArrowRight size={18} /></button></section></main>;
}

function LoadingShell({ onExit }: { onExit: () => void }) {
  return <main className="onboarding-shell onboarding-shell--chat"><header className="flow-header chat-header chat-header--simple"><button aria-label="Back to home" className="icon-button" onClick={onExit} type="button"><ArrowLeft size={20} /></button></header><section className="chat-loading" role="status"><LoaderCircle className="status-spinner" size={26} /><h1>Preparing your onboarding</h1><p>Detailed answers help us find the perfect match</p></section></main>;
}
