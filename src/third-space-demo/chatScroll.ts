// Keep Third Space's transcript motion aligned with Petey's ChatScrollAnimator.
const TIME_CONSTANT_MS = 180;
const SETTLE_DISTANCE_PX = 0.5;

export function createChatScrollController(viewport: HTMLDivElement, content: HTMLDivElement) {
  let animationFrame: number | null = null;
  let measureFrame: number | null = null;
  let lastFrameAt: number | null = null;
  let targetScrollTop = 0;
  let followingBottom = true;
  let reducedMotion = false;

  const cancelAnimation = () => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    if (measureFrame !== null) cancelAnimationFrame(measureFrame);
    animationFrame = null;
    measureFrame = null;
    lastFrameAt = null;
  };

  const animateToBottom = (now: number) => {
    if (!followingBottom) {
      animationFrame = null;
      lastFrameAt = null;
      return;
    }
    const current = viewport.scrollTop;
    const distance = targetScrollTop - current;
    if (Math.abs(distance) <= SETTLE_DISTANCE_PX) {
      viewport.scrollTop = targetScrollTop;
      animationFrame = null;
      lastFrameAt = null;
      return;
    }
    const previousFrameAt = lastFrameAt ?? now - (1000 / 60);
    const elapsed = Math.min(34, Math.max(0, now - previousFrameAt));
    viewport.scrollTop = current + distance * (1 - Math.exp(-elapsed / TIME_CONSTANT_MS));
    // Browsers round scroll positions to physical pixels. Finish the tiny tail
    // once easing falls below that precision instead of scheduling forever.
    if (viewport.scrollTop === current) {
      viewport.scrollTop = targetScrollTop;
      animationFrame = null;
      lastFrameAt = null;
      return;
    }
    lastFrameAt = now;
    animationFrame = requestAnimationFrame(animateToBottom);
  };

  const measureAndAnimate = () => {
    if (!followingBottom) return;
    targetScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    if (reducedMotion || Math.abs(targetScrollTop - viewport.scrollTop) <= SETTLE_DISTANCE_PX) {
      viewport.scrollTop = targetScrollTop;
    } else if (animationFrame === null) {
      lastFrameAt = null;
      animationFrame = requestAnimationFrame(animateToBottom);
    }
  };

  const scheduleMeasurement = () => {
    if (measureFrame !== null) cancelAnimationFrame(measureFrame);
    measureFrame = requestAnimationFrame(() => {
      measureFrame = null;
      measureAndAnimate();
    });
  };

  const stopFollowing = () => {
    followingBottom = false;
    cancelAnimation();
  };
  const resumeAtBottom = () => {
    // Only user input stops following. A resize can queue a scroll event before
    // assistant-ui finishes mounting the reply, when the bottom moves again.
    if (animationFrame !== null) return;
    if (viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 8) followingBottom = true;
  };
  const handleScrollKey = (event: KeyboardEvent) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) stopFollowing();
  };
  viewport.addEventListener("wheel", stopFollowing, { passive: true });
  viewport.addEventListener("touchstart", stopFollowing, { passive: true });
  viewport.addEventListener("pointerdown", stopFollowing);
  viewport.addEventListener("scroll", resumeAtBottom, { passive: true });
  viewport.addEventListener("keydown", handleScrollKey);

  const observer = new ResizeObserver((entries) => {
    if (!followingBottom) return;
    const viewportChanged = entries.some(({ target }) => target === viewport);
    const contentChanged = entries.some(({ target }) => target === content);
    if (viewportChanged && !contentChanged) {
      // Follow keyboard/composer resizing immediately, without a lagging animation.
      cancelAnimation();
      targetScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      viewport.scrollTop = targetScrollTop;
    } else {
      // Sending/replying also changes the suggestion row. Keep the simultaneous
      // content + viewport resize on the message animation instead of snapping.
      measureAndAnimate();
    }
  });
  observer.observe(viewport);
  observer.observe(content);
  viewport.scrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);

  return {
    scheduleMeasurement,
    followLatest() {
      followingBottom = true;
      scheduleMeasurement();
    },
    setReducedMotion(value: boolean) {
      if (value === reducedMotion) return;
      reducedMotion = value;
      cancelAnimation();
      measureAndAnimate();
    },
    dispose() {
      viewport.removeEventListener("wheel", stopFollowing);
      viewport.removeEventListener("touchstart", stopFollowing);
      viewport.removeEventListener("pointerdown", stopFollowing);
      viewport.removeEventListener("scroll", resumeAtBottom);
      viewport.removeEventListener("keydown", handleScrollKey);
      observer.disconnect();
      cancelAnimation();
    },
  };
}
