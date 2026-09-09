import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminApp } from "./AdminApp";
import type { ReviewApi } from "./api";
import { makeReviewFixture } from "./fixture";
import type { ReviewSession } from "./auth";

const auth = vi.hoisted(() => ({ observer: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("./auth", async (actual) => ({ ...await actual<typeof import("./auth")>(), observeReviewSession: auth.observer, signInReviewer: auth.signIn, signOutReviewer: auth.signOut }));

function mockApi(): ReviewApi {
  const detail = makeReviewFixture();
  return {
    access: vi.fn().mockResolvedValue({ reviewer: { uid: "reviewer", email: "reviewer@example.com" }, health: { lastSuccessfulSyncAt: null, lastAttemptAt: null, errorCount: 0, message: null } }),
    list: vi.fn().mockResolvedValue({ applications: [detail.application], nextCursor: null }),
    detail: vi.fn().mockResolvedValue(detail), save: vi.fn(), decide: vi.fn(),
  };
}

beforeEach(() => { window.history.replaceState(null, "", "/petey-web/admin/"); vi.clearAllMocks(); vi.spyOn(window, "scrollTo").mockImplementation(() => undefined); });
afterEach(() => { vi.useRealTimers(); });

it("does not load applications for an unauthorised reviewer", async () => {
  auth.observer.mockImplementation(async (change) => { change({ uid: "reviewer", email: "reviewer@example.com", authTime: Date.now() }); return vi.fn(); });
  const api = mockApi();
  vi.mocked(api.access).mockRejectedValue(Object.assign(new Error("not allowed"), { code: "functions/permission-denied" }));
  render(<AdminApp api={api} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("does not have active reviewer access");
  expect(api.list).not.toHaveBeenCalled();
  expect(api.detail).not.toHaveBeenCalled();
});

it("reattaches the session observer when Google sign-in recovers from an initial setup failure", async () => {
  auth.observer.mockRejectedValueOnce(new Error("Temporary session setup failure.")).mockImplementation(async (change) => {
    change({ uid: "reviewer", email: "reviewer@example.com", authTime: Date.now() });
    return vi.fn();
  });
  auth.signIn.mockResolvedValue(undefined);
  const api = mockApi();
  render(<AdminApp api={api} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Temporary session setup failure.");
  expect(api.list).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));
  await screen.findByRole("link", { name: /Alex Morgan/ });
  expect(auth.observer).toHaveBeenCalledTimes(2);
  expect(api.access).toHaveBeenCalled();
});

it("opens bookmarked applications and filters the inbox by status", async () => {
  auth.observer.mockImplementation(async (change) => { change({ uid: "reviewer", email: "reviewer@example.com", authTime: Date.now() }); return vi.fn(); });
  window.history.replaceState(null, "", "/petey-web/admin/#/applications/preview-alex");
  const api = mockApi();
  render(<AdminApp api={api} />);
  expect(await screen.findByRole("heading", { name: "Alex Morgan", level: 1 })).toBeVisible();
  expect(api.detail).toHaveBeenCalledWith("preview-alex");
  await act(async () => { window.location.hash = "#/"; window.dispatchEvent(new HashChangeEvent("hashchange")); });
  expect(await screen.findByRole("heading", { name: "Trainer applications", level: 1 })).toBeVisible();
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "suspended" } });
  await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ status: "suspended" }));
});

it("renews an hourly session without discarding the open unsaved draft", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  let sessionChanged: (session: ReviewSession) => void = () => undefined;
  const startedAt = Date.now();
  auth.observer.mockImplementation(async (change) => { sessionChanged = change; change({ uid: "reviewer", email: "reviewer@example.com", authTime: startedAt }); return vi.fn(); });
  window.history.replaceState(null, "", "/petey-web/admin/#/applications/preview-alex");
  render(<AdminApp api={mockApi()} />);
  await screen.findByRole("heading", { name: "Alex Morgan", level: 1 });
  fireEvent.change(screen.getByLabelText("Profile bio"), { target: { value: "Unsaved review correction." } });
  await act(async () => { vi.setSystemTime(startedAt + 3_601_000); vi.advanceTimersByTime(30_000); });
  expect(screen.getByRole("heading", { name: "Renew your review session" })).toBeVisible();
  expect(screen.getByLabelText("Profile bio")).not.toBeVisible();
  await act(async () => sessionChanged({ uid: "reviewer", email: "reviewer@example.com", authTime: Date.now() }));
  expect(screen.getByLabelText("Profile bio")).toBeVisible();
  expect(screen.getByLabelText("Profile bio")).toHaveValue("Unsaved review correction.");
});
