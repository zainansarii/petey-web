import { render, screen } from "@testing-library/react";
import { App } from "./App";

const authMocks = vi.hoisted(() => ({
  finishMagicLink: vi.fn(),
  observeFirebaseAuthSession: vi.fn(),
  requestMagicLink: vi.fn(),
}));

vi.mock("../features/auth/api/magicLink", () => ({
  finishMagicLink: authMocks.finishMagicLink,
  observeFirebaseAuthSession: authMocks.observeFirebaseAuthSession,
  requestMagicLink: authMocks.requestMagicLink,
}));

describe("App auth restoration", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.sessionStorage.clear();
    window.localStorage.clear();
    authMocks.observeFirebaseAuthSession.mockReset();
    authMocks.observeFirebaseAuthSession.mockImplementation(async (onSessionChange) => {
      onSessionChange(true);
      return () => undefined;
    });
  });

  it("restores the feed for an existing Firebase session", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: /two demo trainers to explore/i })).toBeInTheDocument();
  });
});
