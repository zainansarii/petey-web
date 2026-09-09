import { render, screen } from "@testing-library/react";
import { LandingScreen } from "./LandingScreen";

vi.mock("motion/react", async (importOriginal) => ({
  ...await importOriginal<typeof import("motion/react")>(),
  useReducedMotion: () => true,
}));

describe("trainer application call to action", () => {
  afterEach(() => vi.unstubAllEnvs());
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
});
