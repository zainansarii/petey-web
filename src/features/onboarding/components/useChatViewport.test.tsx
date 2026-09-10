import { act, render, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { useChatViewport } from "./useChatViewport";

function Harness() {
  const ref = useRef<HTMLElement | null>(null);
  useChatViewport(ref);
  return <main ref={ref} data-testid="chat-shell" />;
}

describe("chat visual viewport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fits keyboard resize and pan, then restores the full viewport on dismissal", async () => {
    const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
    vi.stubGlobal("visualViewport", viewport);
    vi.stubGlobal("innerHeight", 844);
    const { getByTestId } = render(<Harness />);
    const shell = getByTestId("chat-shell");
    expect(shell.style.getPropertyValue("--chat-viewport-height")).toBe("844px");

    act(() => {
      viewport.height = 360;
      viewport.offsetTop = 94;
      viewport.dispatchEvent(new Event("resize"));
      viewport.dispatchEvent(new Event("scroll"));
    });
    await waitFor(() => expect(shell.style.getPropertyValue("--chat-viewport-height")).toBe("360px"));
    expect(shell.style.getPropertyValue("--chat-viewport-top")).toBe("94px");
    expect(shell).toHaveAttribute("data-keyboard-open", "true");

    act(() => {
      viewport.height = 844;
      viewport.offsetTop = 0;
      viewport.dispatchEvent(new Event("resize"));
    });
    await waitFor(() => expect(shell.style.getPropertyValue("--chat-viewport-height")).toBe("844px"));
    expect(shell.style.getPropertyValue("--chat-viewport-top")).toBe("0px");
    expect(shell).toHaveAttribute("data-keyboard-open", "false");
  });

  it("keeps native pinch zoom from reflowing the chat and removes listeners on exit", async () => {
    const viewport = Object.assign(new EventTarget(), { height: 420, offsetTop: 40, scale: 2 });
    vi.stubGlobal("visualViewport", viewport);
    const removeListener = vi.spyOn(viewport, "removeEventListener");
    const { getByTestId, unmount } = render(<Harness />);
    const shell = getByTestId("chat-shell");
    expect(shell.style.getPropertyValue("--chat-viewport-height")).toBe("");

    act(() => {
      viewport.scale = 1;
      viewport.height = 844;
      viewport.offsetTop = 0;
      viewport.dispatchEvent(new Event("resize"));
    });
    await waitFor(() => expect(shell.style.getPropertyValue("--chat-viewport-height")).toBe("844px"));
    unmount();
    expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(shell.style.getPropertyValue("--chat-viewport-height")).toBe("");
  });
});
