import { fireEvent, render, screen } from "@testing-library/react";
import { LandingScreen } from "./LandingScreen";

vi.mock("motion/react", async (importOriginal) => ({
  ...await importOriginal<typeof import("motion/react")>(),
  useReducedMotion: () => true,
}));

describe("trainer application call to action", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
  it("opens the configured Google Form in a separate tab", () => {
    const url = "https://docs.google.com/forms/d/e/production-form/viewform";
    vi.stubEnv("VITE_TRAINER_APPLICATION_URL", url);
    render(<LandingScreen onLogin={vi.fn()} onStart={vi.fn()} />);
    const link = screen.getByRole("link", { name: "I'm a personal trainer" });
    expect(link).toHaveAttribute("href", url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
  it("disables applications when the environment has no valid responder URL", () => {
    vi.stubEnv("VITE_TRAINER_APPLICATION_URL", "https://untrusted.example/form");
    render(<LandingScreen onLogin={vi.fn()} onStart={vi.fn()} />);
    expect(screen.getByRole("button", { name: "I'm a personal trainer" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "I'm a personal trainer" })).not.toBeInTheDocument();
  });

  it("lets compact layouts scroll without starting onboarding", () => {
    const media = window.matchMedia("");
    vi.spyOn(window, "matchMedia").mockReturnValue({ ...media, matches: true });
    const onStart = vi.fn();
    render(<LandingScreen onLogin={vi.fn()} onStart={onStart} />);
    const page = screen.getByRole("main");
    fireEvent.wheel(page, { deltaY: 100 });
    fireEvent.touchStart(page, { touches: [{ clientX: 100, clientY: 250 }] });
    fireEvent.touchEnd(page, { changedTouches: [{ clientX: 110, clientY: 100 }] });
    fireEvent.keyDown(window, { key: "PageDown" });
    expect(onStart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Find my trainer" }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("keeps the desktop scroll-to-onboarding interaction", () => {
    const onStart = vi.fn();
    render(<LandingScreen onLogin={vi.fn()} onStart={onStart} />);
    fireEvent.wheel(screen.getByRole("main"), { deltaY: 100 });
    expect(onStart).toHaveBeenCalledOnce();
  });
});
