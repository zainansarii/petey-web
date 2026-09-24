import { createChatScrollController } from "./chatScroll";

const OriginalResizeObserver = globalThis.ResizeObserver;
let callbacks: Map<number, FrameRequestCallback>;
let nextFrame: number;
let now: number;
let resize: ResizeObserverCallback;
let disconnect = vi.fn(() => undefined);

beforeEach(() => {
  callbacks = new Map();
  nextFrame = 0;
  now = 0;
  disconnect = vi.fn(() => undefined);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callbacks.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { callbacks.delete(id); });
  globalThis.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) { resize = callback; }
    observe() {}
    unobserve() {}
    disconnect = disconnect;
  };
});
afterEach(() => {
  globalThis.ResizeObserver = OriginalResizeObserver;
  vi.unstubAllGlobals();
});

function frame() {
  now += 1000 / 60;
  const pending = [...callbacks.values()];
  callbacks.clear();
  pending.forEach((callback) => callback(now));
}
function finishAnimation() {
  for (let index = 0; callbacks.size && index < 200; index += 1) frame();
  expect(callbacks.size).toBe(0);
}
function setup() {
  const viewport = document.createElement("div");
  const content = document.createElement("div");
  viewport.append(content);
  const size = { content: 500, viewport: 300 };
  Object.defineProperties(viewport, {
    scrollHeight: { get: () => size.content },
    clientHeight: { get: () => size.viewport },
  });
  const controller = createChatScrollController(viewport, content);
  const changed = (...targets: Element[]) => resize(targets.map((target) => ({ target }) as ResizeObserverEntry), {} as ResizeObserver);
  return { viewport, content, size, controller, changed };
}

it("eases new content to the bottom and settles without jumping", () => {
  const { viewport, content, size, changed, controller } = setup();
  expect(viewport.scrollTop).toBe(200);
  size.content = 1000;
  changed(content);
  expect(viewport.scrollTop).toBe(200);
  frame();
  expect(viewport.scrollTop).toBeGreaterThan(200);
  expect(viewport.scrollTop).toBeLessThan(700);
  finishAnimation();
  expect(viewport.scrollTop).toBe(700);
  changed(content);
  expect(callbacks.size).toBe(0);
  controller.dispose();
});

it.each(["wheel", "touchstart", "pointerdown", "keydown"])("stops on %s and leaves someone reading older messages alone", (eventType) => {
  const { viewport, content, size, changed, controller } = setup();
  size.content = 1000;
  changed(content);
  frame();
  viewport.dispatchEvent(eventType === "keydown" ? new KeyboardEvent(eventType, { key: "PageUp" }) : new Event(eventType));
  viewport.scrollTop = 100;
  viewport.dispatchEvent(new Event("scroll"));
  size.content = 1200;
  changed(content);
  controller.scheduleMeasurement();
  finishAnimation();
  expect(viewport.scrollTop).toBe(100);
  viewport.scrollTop = 900;
  viewport.dispatchEvent(new Event("scroll"));
  size.content = 1400;
  changed(content);
  finishAnimation();
  expect(viewport.scrollTop).toBe(1100);
  controller.dispose();
});

it("resumes following an explicitly sent answer without immediately jumping", () => {
  const { viewport, size, controller } = setup();
  viewport.dispatchEvent(new Event("wheel"));
  viewport.scrollTop = 50;
  size.content = 1000;
  controller.followLatest();
  expect(viewport.scrollTop).toBe(50);
  finishAnimation();
  expect(viewport.scrollTop).toBe(700);
  controller.dispose();
});

it("animates a sent message even when hiding suggestions resizes the viewport in the same frame", () => {
  const { viewport, content, size, changed, controller } = setup();
  controller.followLatest();
  size.content = 1000;
  size.viewport = 400;
  changed(viewport, content);
  expect(viewport.scrollTop).toBe(200);
  frame();
  expect(viewport.scrollTop).toBeGreaterThan(200);
  expect(viewport.scrollTop).toBeLessThan(600);
  finishAnimation();
  expect(viewport.scrollTop).toBe(600);
  controller.dispose();
});

it("follows keyboard or composer resizing immediately, unless reading older turns", () => {
  const { viewport, content, size, changed, controller } = setup();
  size.content = 1000;
  changed(content);
  frame();
  size.viewport = 200;
  changed(viewport);
  expect(viewport.scrollTop).toBe(800);
  expect(callbacks.size).toBe(0);
  viewport.dispatchEvent(new Event("touchstart"));
  viewport.scrollTop = 100;
  size.viewport = 150;
  changed(viewport);
  expect(viewport.scrollTop).toBe(100);
  controller.dispose();
});

it("honours reduced motion even when enabled during an in-flight scroll", () => {
  const { viewport, content, size, changed, controller } = setup();
  size.content = 1000;
  changed(content);
  frame();
  controller.setReducedMotion(true);
  expect(viewport.scrollTop).toBe(700);
  expect(callbacks.size).toBe(0);
  size.content = 1200;
  changed(content);
  expect(viewport.scrollTop).toBe(900);
  expect(callbacks.size).toBe(0);
  controller.dispose();
});

it("keeps following when a resize scroll event arrives before the new reply is measured", () => {
  const { viewport, content, size, changed, controller } = setup();
  size.viewport = 250;
  changed(viewport);
  expect(viewport.scrollTop).toBe(250);
  size.content = 800;
  viewport.dispatchEvent(new Event("scroll"));
  changed(content);
  frame();
  expect(viewport.scrollTop).toBeGreaterThan(250);
  expect(viewport.scrollTop).toBeLessThan(550);
  finishAnimation();
  expect(viewport.scrollTop).toBe(550);
  controller.dispose();
});

it("settles completely when the browser rounds scroll positions to physical pixels", () => {
  const { viewport, content, size, changed, controller } = setup();
  let position = viewport.scrollTop;
  Object.defineProperty(viewport, "scrollTop", {
    get: () => position,
    set: (value: number) => { position = Math.round(value * 2) / 2; },
  });
  size.content = 1000;
  changed(content);
  finishAnimation();
  expect(viewport.scrollTop).toBe(700);
  controller.dispose();
});

it("cancels frames and disconnects its observer on unmount", () => {
  const { viewport, content, size, changed, controller } = setup();
  size.content = 1000;
  changed(content);
  controller.scheduleMeasurement();
  controller.dispose();
  expect(callbacks.size).toBe(0);
  expect(disconnect).toHaveBeenCalledOnce();
  expect(viewport.scrollTop).toBe(200);
});
