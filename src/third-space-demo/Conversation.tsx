import {
  AssistantRuntimeProvider, ComposerPrimitive, MessagePrimitive, ThreadPrimitive, useExternalStoreRuntime,
  useAui, useAuiState, type ThreadMessageLike, type TextMessagePartProps,
} from "@assistant-ui/react";
import { ArrowUp, RotateCcw } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
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

function QuickReplies({ prompts }: { prompts: string[] }) {
  const aui = useAui();
  const running = useAuiState((state) => state.thread.isRunning);
  const composing = useAuiState((state) => state.composer.text.trim().length > 0);
  const rowRef = useRef<HTMLDivElement>(null);
  const labels = useMemo(() => prompts.map((prompt) => prompt.trim().replace(/\.+$/, "").trim()).filter(Boolean), [prompts]);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const buttons = Array.from(row.querySelectorAll<HTMLButtonElement>("button"));
    // Follow Petey's QuickReplies rules: natural widths, complete buttons, original order.
    const fitReplies = () => {
      if (!row.clientWidth) return;
      const style = getComputedStyle(row);
      const gap = parseFloat(style.columnGap) || 0;
      let remaining = row.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
      let visible = 0;
      const widths = buttons.map((button) => button.getBoundingClientRect().width);
      buttons.forEach((button, index) => {
        const required = widths[index] + (visible ? gap : 0);
        const fits = required <= remaining;
        button.toggleAttribute("data-overflow", !fits);
        button.toggleAttribute("inert", !fits);
        if (fits) {
          button.removeAttribute("aria-hidden");
          remaining -= required;
          visible += 1;
        } else {
          button.setAttribute("aria-hidden", "true");
        }
      });
      row.toggleAttribute("data-empty", visible === 0);
    };
    fitReplies();
    const observer = new ResizeObserver(fitReplies);
    observer.observe(row);
    buttons.forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [labels]);

  if (!labels.length) return null;
  return <div className="ts-quick-replies" aria-label="Suggested answers" data-composing={composing} ref={rowRef}>
    {labels.map((reply, index) => <button key={`${index}-${reply}`} type="button" disabled={running} onMouseDown={(event) => {
      if (event.button === 0 && document.activeElement?.matches(".ts-composer textarea")) event.preventDefault();
    }} onClick={() => {
      if (aui.thread.getState().isRunning) return;
      aui.thread.composer().setText(reply);
      aui.thread.composer().send();
    }}>{reply}</button>)}
  </div>;
}

export function Conversation({ messages, quickReplies, pending, error, onSend, onRetry }: {
  messages: DemoMessage[];
  quickReplies: string[];
  pending: boolean;
  error: string | null;
  onSend: (text: string) => Promise<void>;
  onRetry: () => void;
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
      <ThreadPrimitive.Viewport ref={viewport} className="ts-conversation__viewport" autoScroll={false} scrollToBottomOnInitialize={false} scrollToBottomOnRunStart={false} scrollToBottomOnThreadSwitch={false} tabIndex={0} role="log" aria-label="Your trainer matching conversation" aria-live="polite" aria-relevant="additions text">
        <div className="ts-conversation__messages" ref={messageList}>
          <ThreadPrimitive.Messages components={{ AssistantMessage, UserMessage }} />
          {pending ? <div className="ts-thinking" role="status"><span className="ts-thinking__dots" aria-hidden="true"><i /><i /><i /></span><span className="ts-sr-only">Thinking about your answer</span></div> : null}
          {error ? <div className="ts-error" role="alert"><p>{error}</p><button className="ts-text-button" onClick={() => { scroll.current?.followLatest(); onRetry(); }}><RotateCcw size={16} />Try again</button></div> : null}
        </div>
      </ThreadPrimitive.Viewport>
      <div className="ts-conversation__footer">
        {!pending && !error ? <QuickReplies prompts={quickReplies} /> : null}
        <ComposerPrimitive.Root className="ts-composer">
          <ComposerPrimitive.Input ref={input} aria-label="Your message" placeholder="Tell us in your own words…" rows={1} maxRows={4} maxLength={2000} autoComplete="off" addAttachmentOnPaste={false} disabled={Boolean(error)} unstable_focusOnRunStart={false} unstable_focusOnScrollToBottom={false} unstable_focusOnThreadSwitched={false} />
          <ComposerPrimitive.Send className="ts-send" aria-label="Send message" disabled={pending || Boolean(error)} onMouseDown={(event) => { if (document.activeElement === input.current) event.preventDefault(); }}><ArrowUp size={21} strokeWidth={1.7} /></ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
        <p className="ts-privacy-note">AI-assisted. Please leave out medical details. Demo Powered by Petey.</p>
      </div>
    </ThreadPrimitive.Root>
  </AssistantRuntimeProvider>;
}
