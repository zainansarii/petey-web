import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { finishMagicLink, observeFirebaseAuthSession, requestMagicLink } from "../auth/api/magicLink";
import { marketplace, watchAccess } from "./api";
import { AccessGate } from "./AccessGate";
import type { Access } from "./model";

vi.mock("../auth/api/magicLink", () => ({ finishMagicLink: vi.fn(), observeFirebaseAuthSession: vi.fn(), requestMagicLink: vi.fn(), getFirebaseAuth: vi.fn() }));
vi.mock("./api", () => ({ marketplace: vi.fn(), watchAccess: vi.fn(), errorMessage: (error: unknown) => error instanceof Error ? error.message : "Try again." }));
vi.mock("./qa", () => ({ qaRole: () => null }));

const access: Access = { uid: "trainer", email: "trainer@example.com", membership: { trainerId: "profile", status: "active", email: "trainer@example.com" }, pilotEnabled: true, preferences: { messages: true, enquiries: true } };
const renderGate = (trainer = true) => render(<AccessGate trainer={trainer}>{() => <p>Signed-in workspace</p>}</AccessGate>);
const enterEmail = (email = " Trainer@Example.COM ") => fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), { target: { value: email } });

beforeEach(() => {
  vi.resetAllMocks();
  history.replaceState(null, "", "/trainer/");
  vi.mocked(finishMagicLink).mockResolvedValue("ignored");
  vi.mocked(observeFirebaseAuthSession).mockImplementation(async notify => { notify(false); return () => {}; });
  vi.mocked(requestMagicLink).mockResolvedValue("sent");
  vi.mocked(watchAccess).mockResolvedValue(() => {});
  vi.mocked(marketplace).mockResolvedValue(access);
});

it.each([true, false])("preserves the requested marketplace destination when sending a link (trainer=%s)", async trainer => {
  const destination = trainer ? "/trainer/?invite=synthetic-token#profile" : "/messages/#conversation";
  history.replaceState(null, "", destination);
  renderGate(trainer);
  await screen.findByRole("heading", { name: "Welcome back" });
  enterEmail();
  fireEvent.click(screen.getByRole("button", { name: "Email me a login link" }));
  await screen.findByRole("heading", { name: "Check your email" });
  expect(requestMagicLink).toHaveBeenCalledWith("trainer@example.com", destination);
});

it("confirms a cross-device email before checking membership", async () => {
  vi.mocked(finishMagicLink).mockResolvedValueOnce("missing-email").mockResolvedValueOnce("signed-in").mockResolvedValue("ignored");
  vi.mocked(observeFirebaseAuthSession).mockImplementation(async notify => { notify(true); return () => {}; });
  renderGate();
  await screen.findByRole("heading", { name: "Confirm your email" });
  expect(marketplace).not.toHaveBeenCalled();
  enterEmail();
  fireEvent.click(screen.getByRole("button", { name: "Confirm email" }));
  await screen.findByText("Signed-in workspace");
  expect(finishMagicLink).toHaveBeenCalledWith("trainer@example.com");
  expect(requestMagicLink).not.toHaveBeenCalled();
});

it("discards an invalid sign-in code while keeping the invitation and destination", async () => {
  history.replaceState(null, "", "/trainer/?invite=synthetic-token&mode=signIn&oobCode=expired&apiKey=test&finishSignUp=1#profile");
  vi.mocked(finishMagicLink).mockResolvedValue("error");
  renderGate();
  fireEvent.click(await screen.findByRole("button", { name: "Request a new sign-in link" }));
  expect(location.search).toBe("?invite=synthetic-token");
  expect(location.hash).toBe("#profile");
  enterEmail();
  fireEvent.click(screen.getByRole("button", { name: "Email me a login link" }));
  await waitFor(() => expect(requestMagicLink).toHaveBeenCalledWith("trainer@example.com", "/trainer/?invite=synthetic-token#profile"));
});

it("keeps trainers without membership out of the workspace", async () => {
  vi.mocked(observeFirebaseAuthSession).mockImplementation(async notify => { notify(true); return () => {}; });
  vi.mocked(marketplace).mockResolvedValue({ ...access, membership: null });
  renderGate();
  await screen.findByRole("heading", { name: "Your trainer workspace starts with an invitation" });
  expect(screen.queryByText("Signed-in workspace")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Use another account" })).toBeInTheDocument();
});

it("removes workspace content when access is revoked", async () => {
  vi.mocked(observeFirebaseAuthSession).mockImplementation(async notify => { notify(true); return () => {}; });
  renderGate();
  await screen.findByText("Signed-in workspace");
  await waitFor(() => expect(watchAccess).toHaveBeenCalled());
  act(() => vi.mocked(watchAccess).mock.calls[0][1]());
  expect(screen.getByRole("heading", { name: "Trainer access is unavailable" })).toBeInTheDocument();
  expect(screen.queryByText("Signed-in workspace")).not.toBeInTheDocument();
});

it("reports delivery failure and allows retry without losing the address", async () => {
  vi.mocked(requestMagicLink).mockRejectedValueOnce(new Error("Could not send the link."));
  renderGate();
  await screen.findByRole("heading", { name: "Welcome back" });
  enterEmail("trainer@example.com");
  fireEvent.click(screen.getByRole("button", { name: "Email me a login link" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not send the link.");
  expect(screen.getByRole("textbox", { name: "Email address" })).toHaveValue("trainer@example.com");
  fireEvent.click(screen.getByRole("button", { name: "Email me a login link" }));
  await screen.findByRole("heading", { name: "Check your email" });
});
