import { useLayoutEffect, type RefObject } from "react";

// The software keyboard can shrink/pan the visual viewport without resizing
// 100dvh. Size the chat itself so its input stays in normal layout, above it.
export function useChatViewport(shellRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const shell = shellRef.current;
    const viewport = window.visualViewport;
    if (!shell || !viewport) return;
    let frame: number | null = null;

    const update = () => {
      frame = null;
      // Preserve native pinch zoom instead of reflowing the page underneath it.
      if (viewport.scale !== 1) return;
      shell.style.setProperty("--chat-viewport-height", `${viewport.height}px`);
      shell.style.setProperty("--chat-viewport-top", `${Math.max(0, viewport.offsetTop)}px`);
      shell.dataset.keyboardOpen = String(window.innerHeight - viewport.height > 120);
    };
    const scheduleUpdate = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };

    update();
    viewport.addEventListener("resize", scheduleUpdate);
    viewport.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", scheduleUpdate);
      viewport.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      shell.style.removeProperty("--chat-viewport-height");
      shell.style.removeProperty("--chat-viewport-top");
      delete shell.dataset.keyboardOpen;
    };
  }, [shellRef]);
}
