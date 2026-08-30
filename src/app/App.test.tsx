import { act, fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";

describe("Petey web journey", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("moves from the trainer carousel into trainee onboarding with one downward wheel gesture", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /find your personal trainer/i })).toBeInTheDocument();
    fireEvent.wheel(screen.getByRole("main"), { deltaY: 80 });

    expect(await screen.findByRole("heading", { name: /what is your goal/i })).toBeInTheDocument();
    expect(screen.queryByText(/i’m a personal trainer/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: /sign-up progress/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/private by design/i)).not.toBeInTheDocument();
    expect(document.querySelector(".flow-header__controls .flow-progress")).toBeInTheDocument();
  });

  it("presents the landing profiles as a centered horizontal carousel", () => {
    render(<App />);

    expect(screen.queryByText("Personal training, personally matched.")).not.toBeInTheDocument();
    expect(screen.queryByText("Meet your match")).not.toBeInTheDocument();
    expect(screen.queryByText("Scroll once to start")).not.toBeInTheDocument();
    expect(screen.queryByText("No account needed to start")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pause trainer carousel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /previous trainer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next trainer/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start matching" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show Maya Chen" })).not.toBeInTheDocument();
    const carousel = screen.getByRole("region", { name: "Trainer previews" });
    expect(carousel.querySelectorAll(".hero-carousel__card")).toHaveLength(5);
    expect(carousel.querySelectorAll(".hero-carousel__card--side")).toHaveLength(2);
    expect(carousel.querySelectorAll(".hero-carousel__card--offstage")).toHaveLength(2);
    expect([...carousel.querySelectorAll<HTMLElement>(".hero-carousel__card")]
      .map(({ dataset }) => dataset.carouselSlot)).toEqual(["-2", "-1", "0", "1", "2"]);
    expect(screen.getByRole("heading", { name: /^Maya$/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Maya Chen$/ })).not.toBeInTheDocument();
    expect(screen.getByText(/showing maya chen, running & endurance, 1 of 4/i)).toBeInTheDocument();

    fireEvent.touchStart(screen.getByRole("main"), { touches: [{ clientX: 240, clientY: 240 }] });
    fireEvent.touchEnd(screen.getByRole("main"), { changedTouches: [{ clientX: 150, clientY: 242 }] });

    expect(carousel.querySelector<HTMLElement>('[data-carousel-slot="0"]')?.textContent)
      .toContain("Marcus");
    expect(screen.getByRole("heading", { name: /^Marcus$/ })).toBeInTheDocument();
    expect(screen.getByText(/showing marcus adebayo, strength, 2 of 4/i)).toBeInTheDocument();
  });

  it("automatically rotates the trainer deck every five seconds", () => {
    vi.useFakeTimers();
    const { unmount } = render(<App />);

    expect(screen.getByText(/showing maya chen, running & endurance, 1 of 4/i)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4_999));
    expect(screen.getByText(/showing maya chen, running & endurance, 1 of 4/i)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText(/showing marcus adebayo, strength, 2 of 4/i)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByText(/showing aliyah rahman, pilates, 3 of 4/i)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByText(/showing rohan kapoor, boxing & combat fitness, 4 of 4/i)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByText(/showing maya chen, running & endurance, 1 of 4/i)).toBeInTheDocument();

    unmount();
    vi.useRealTimers();
  });
});
