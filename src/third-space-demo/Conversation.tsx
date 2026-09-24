import {
  AssistantRuntimeProvider, ComposerPrimitive, MessagePrimitive, ThreadPrimitive, useExternalStoreRuntime,
  useAuiState, type ThreadMessageLike, type TextMessagePartProps,
} from "@assistant-ui/react";
import { ArrowUp, RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { DemoMessage } from "../../third-space-shared/contract";

const convertMessage = (message: DemoMessage, index: number): ThreadMessageLike => ({
  id: String(index), role: message.role, content: [{ type: "text", text: message.content }],
});

function AssistantMessage() {
  const hasText = useAuiState((state) => state.message.content.some((part) => part.type === "text" && part.text.trim()));
  if (!hasText) return null;
  return <MessagePrimitive.Root className="ts-message ts-message--assistant"><span className="ts-sr-only">Assistant: </span><MessagePrimitive.Parts components={{ Text: GenerativeText }} /></MessagePrimitive.Root>;
}
function GenerativeText({ text }: TextMessagePartProps) {
  const messageIndex = useAuiState((state) => state.message.index);
  const isLast = useAuiState((state) => state.message.isLast);
  const reducedMotion = useReducedMotion();
  // Match Petey's GenerativeText timing while leaving earlier turns fully visible.
  const openingDelay = messageIndex === 0 ? 120 : 45;
  return <p>
    <span className="ts-sr-only">{text}</span>
    <span aria-hidden="true">{text.split(/(\s+)/).map((segment, index) => {
      if (/^\s+$/.test(segment)) return segment;
      const delay = openingDelay + Math.min(index * 28, 715);
      return <motion.span key={`${segment}-${index}`} className="ts-message__word" initial={reducedMotion || !isLast ? false : { opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reducedMotion || !isLast ? 0 : delay / 1000, duration: reducedMotion || !isLast ? 0 : 0.18 }}>{segment}</motion.span>;
    })}</span>
  </p>;
}
function UserMessage() {
  return <MessagePrimitive.Root className="ts-message ts-message--user"><span className="ts-sr-only">You: </span><MessagePrimitive.Parts /></MessagePrimitive.Root>;
}

export function Conversation({ messages, quickReplies, pending, error, onSend, onRetry, refining }: {
  messages: DemoMessage[];
  quickReplies: string[];
  pending: boolean;
  error: string | null;
  onSend: (text: string) => Promise<void>;
  onRetry: () => void;
  refining: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const viewport = useRef<HTMLDivElement>(null);
  const messageList = useRef<HTMLDivElement>(null);
  const followingBottom = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);
  const runtime = useExternalStoreRuntime<DemoMessage>({
    messages, convertMessage, isRunning: pending, isSendDisabled: pending || Boolean(error),
    onNew: async (message) => {
      const text = message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
      await onSend(text);
    },
  });
  useEffect(() => {
    const container = viewport.current;
    const content = messageList.current;
    if (!container || !content) return;
    const follow = () => {
      if (followingBottom.current) container.scrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    };
    const onScroll = () => {
      if (container.scrollHeight - container.clientHeight - container.scrollTop < 36) followingBottom.current = true;
    };
    const onWheel = (event: WheelEvent) => { if (event.deltaY < 0) followingBottom.current = false; };
    const stopFollowing = () => { followingBottom.current = false; };
    const onKeyDown = (event: KeyboardEvent) => { if (["ArrowUp", "PageUp", "Home"].includes(event.key)) stopFollowing(); };
    const observer = new ResizeObserver(follow);
    observer.observe(container);
    observer.observe(content);
    container.addEventListener("scroll", onScroll, { passive: true });
    container.addEventListener("wheel", onWheel, { passive: true });
    container.addEventListener("touchstart", stopFollowing, { passive: true });
    container.addEventListener("pointerdown", stopFollowing);
    container.addEventListener("keydown", onKeyDown);
    follow();
    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", onScroll);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("touchstart", stopFollowing);
      container.removeEventListener("pointerdown", stopFollowing);
      container.removeEventListener("keydown", onKeyDown);
    };
  }, []);
  useEffect(() => {
    if (messages.at(-1)?.role === "user") followingBottom.current = true;
    if (followingBottom.current && viewport.current) viewport.current.scrollTop = Math.max(0, viewport.current.scrollHeight - viewport.current.clientHeight);
  }, [messages, pending, error, quickReplies]);
  useEffect(() => { input.current?.focus(); }, []);

  return <AssistantRuntimeProvider runtime={runtime}>
    <ThreadPrimitive.Root className="ts-conversation">
      <div className="ts-conversation__heading"><h1>{refining ? "Make it more you." : "Let’s find your fit."}</h1></div>
      <ThreadPrimitive.Viewport ref={viewport} className="ts-conversation__viewport" autoScroll={false} role="log" aria-label="Your trainer matching conversation" aria-live="polite" aria-relevant="additions text">
        <div className="ts-conversation__messages" ref={messageList}>
          <ThreadPrimitive.Messages components={{ AssistantMessage, UserMessage }} />
          {pending ? <div className="ts-thinking" role="status"><span className="ts-thinking__dots" aria-hidden="true"><i /><i /><i /></span><span className="ts-sr-only">Thinking about your answer</span></div> : null}
          {error ? <div className="ts-error" role="alert"><p>{error}</p><button className="ts-text-button" onClick={onRetry}><RotateCcw size={16} />Try again</button></div> : null}
        </div>
      </ThreadPrimitive.Viewport>
      <div className="ts-conversation__footer">
        {!pending && !error && quickReplies.length > 0 ? <motion.div className="ts-quick-replies" aria-label="Suggested answers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>
          {quickReplies.map((reply) => <button key={reply} onClick={() => void onSend(reply)}>{reply}</button>)}
        </motion.div> : null}
        <ComposerPrimitive.Root className="ts-composer">
          <ComposerPrimitive.Input ref={input} aria-label="Your message" placeholder="Tell us in your own words…" rows={1} maxRows={4} maxLength={2000} autoComplete="off" addAttachmentOnPaste={false} disabled={Boolean(error)} unstable_focusOnRunStart={false} unstable_focusOnScrollToBottom={false} unstable_focusOnThreadSwitched={false} />
          <ComposerPrimitive.Send className="ts-send" aria-label="Send message" disabled={pending || Boolean(error)} onMouseDown={(event) => { if (document.activeElement === input.current) event.preventDefault(); }}><ArrowUp size={21} strokeWidth={1.7} /></ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
        <p className="ts-privacy-note">AI-assisted. Please leave out medical details. Demo Powered by Petey.</p>
      </div>
    </ThreadPrimitive.Root>
  </AssistantRuntimeProvider>;
}
