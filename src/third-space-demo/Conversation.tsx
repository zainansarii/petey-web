import {
  AssistantRuntimeProvider, ComposerPrimitive, MessagePrimitive, ThreadPrimitive, useExternalStoreRuntime,
  useAuiState, type ThreadMessageLike, type TextMessagePartProps,
} from "@assistant-ui/react";
import { ArrowUp, RotateCcw } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { DemoMessage } from "../../third-space-shared/contract";
import { createChatScrollController } from "./chatScroll";

const convertMessage = (message: DemoMessage, index: number): ThreadMessageLike => ({
  id: String(index), role: message.role, content: [{ type: "text", text: message.content }],
});

function AssistantMessage() {
  const hasText = useAuiState((state) => state.message.content.some((part) => part.type === "text" && part.text.trim()));
  const messageIndex = useAuiState((state) => state.message.index);
  const isLast = useAuiState((state) => state.message.isLast);
  const reducedMotion = useReducedMotion();
  if (!hasText) return null;
  return <MessagePrimitive.Root className="ts-message ts-message--assistant" data-animate={isLast && !reducedMotion} style={{ animationDelay: !reducedMotion && messageIndex === 0 ? "80ms" : "0ms" }}><span className="ts-sr-only">Assistant: </span><MessagePrimitive.Parts components={{ Text: GenerativeText }} /></MessagePrimitive.Root>;
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
  const isLast = useAuiState((state) => state.message.isLast || (state.thread.isRunning && state.thread.messages.at(-2)?.id === state.message.id));
  const reducedMotion = useReducedMotion();
  return <MessagePrimitive.Root className="ts-message ts-message--user" data-animate={isLast && !reducedMotion}><span className="ts-sr-only">You: </span><MessagePrimitive.Parts /></MessagePrimitive.Root>;
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
  const scroll = useRef<ReturnType<typeof createChatScrollController> | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const send = (text: string) => {
    scroll.current?.followLatest();
    return onSend(text);
  };
  const runtime = useExternalStoreRuntime<DemoMessage>({
    messages, convertMessage, isRunning: pending, isSendDisabled: pending || Boolean(error),
    onNew: async (message) => {
      const text = message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
      await send(text);
    },
  });
  useLayoutEffect(() => {
    const container = viewport.current;
    const content = messageList.current;
    if (!container || !content) return;
    const controller = createChatScrollController(container, content);
    scroll.current = controller;
    return () => {
      controller.dispose();
      scroll.current = null;
    };
  }, []);
  useLayoutEffect(() => { scroll.current?.setReducedMotion(Boolean(reducedMotion)); }, [reducedMotion]);
  useEffect(() => {
    scroll.current?.scheduleMeasurement();
  }, [messages, pending, error, quickReplies]);
  useEffect(() => { input.current?.focus(); }, []);

  return <AssistantRuntimeProvider runtime={runtime}>
    <ThreadPrimitive.Root className="ts-conversation">
      <div className="ts-conversation__heading"><h1>{refining ? "Make it more you." : "Let’s find your fit."}</h1></div>
      <ThreadPrimitive.Viewport ref={viewport} className="ts-conversation__viewport" autoScroll={false} scrollToBottomOnInitialize={false} scrollToBottomOnRunStart={false} scrollToBottomOnThreadSwitch={false} tabIndex={0} role="log" aria-label="Your trainer matching conversation" aria-live="polite" aria-relevant="additions text">
        <div className="ts-conversation__messages" ref={messageList}>
          <ThreadPrimitive.Messages components={{ AssistantMessage, UserMessage }} />
          {pending ? <div className="ts-thinking" role="status"><span className="ts-thinking__dots" aria-hidden="true"><i /><i /><i /></span><span className="ts-sr-only">Thinking about your answer</span></div> : null}
          {error ? <div className="ts-error" role="alert"><p>{error}</p><button className="ts-text-button" onClick={() => { scroll.current?.followLatest(); onRetry(); }}><RotateCcw size={16} />Try again</button></div> : null}
        </div>
      </ThreadPrimitive.Viewport>
      <div className="ts-conversation__footer">
        {!pending && !error && quickReplies.length > 0 ? <div className="ts-quick-replies" aria-label="Suggested answers">
          {quickReplies.map((reply) => <button key={reply} onClick={() => void send(reply)}>{reply}</button>)}
        </div> : null}
        <ComposerPrimitive.Root className="ts-composer">
          <ComposerPrimitive.Input ref={input} aria-label="Your message" placeholder="Tell us in your own words…" rows={1} maxRows={4} maxLength={2000} autoComplete="off" addAttachmentOnPaste={false} disabled={Boolean(error)} unstable_focusOnRunStart={false} unstable_focusOnScrollToBottom={false} unstable_focusOnThreadSwitched={false} />
          <ComposerPrimitive.Send className="ts-send" aria-label="Send message" disabled={pending || Boolean(error)} onMouseDown={(event) => { if (document.activeElement === input.current) event.preventDefault(); }}><ArrowUp size={21} strokeWidth={1.7} /></ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
        <p className="ts-privacy-note">AI-assisted. Please leave out medical details. Demo Powered by Petey.</p>
      </div>
    </ThreadPrimitive.Root>
  </AssistantRuntimeProvider>;
}
