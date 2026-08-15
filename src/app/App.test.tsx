import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";

describe("Petey web journey", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("moves from the trainer carousel into trainee onboarding with one downward wheel gesture", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /your trainer is closer/i })).toBeInTheDocument();
    fireEvent.wheel(screen.getByRole("main"), { deltaY: 80 });

    expect(await screen.findByRole("heading", { name: /what are you working towards/i })).toBeInTheDocument();
    expect(screen.queryByText(/i’m a personal trainer/i)).not.toBeInTheDocument();
  });
});
