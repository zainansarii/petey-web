import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { validateTranscript } from "../../functions-third-space/src/service";
import { TRAINERS } from "../../third-space-shared/catalogue";
import { BUDGET_QUICK_REPLIES, OPENING_MESSAGE, type DemoMessage, type ThirdSpaceMatches, type ThirdSpaceTurn } from "../../third-space-shared/contract";
import { ThirdSpaceDemo } from "./ThirdSpaceDemo";

const api = vi.hoisted(() => ({ runThirdSpaceTurn: vi.fn(), findThirdSpaceMatches: vi.fn() }));
vi.mock("./api", () => api);
vi.mock("motion/react", async (original) => ({ ...await original<typeof import("motion/react")>(), useReducedMotion: () => true }));

const readyTurn: ThirdSpaceTurn = {
  reply: "I’ll now find trainers who fit your goals.", topic: "complete", quickReplies: [], readyForMatching: true,
  coverage: { goal: true, experience: true, membership: true, access: true, location: true, coaching: true, budget: true },
};
const trainer = TRAINERS[0];
const results: ThirdSpaceMatches = {
  brief: { goal: "Build strength and feel confident", experience: "Beginner", coachingStyle: "Patient", specialistNeeds: [], membership: "non-member", membershipType: "unknown", homeClubIds: [], accessibleClubIds: [], excludedClubIds: [], locationAnchors: ["Battersea"], budget: "£90", additionalPreferences: [] },
  matches: [{ trainerId: trainer.id, clubId: trainer.clubIds[0], reasons: [trainer.summary], locationReason: "Battersea fits your training area." }],
  unconfirmed: ["Individual trainer prices and session availability need confirming.", "A Third Space membership is required."],
};

function typeAndSend(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Your message" }), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}
function start() { fireEvent.click(screen.getByRole("button", { name: "Find my trainer" })); }

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); } });
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  api.runThirdSpaceTurn.mockResolvedValue(readyTurn);
  api.findThirdSpaceMatches.mockResolvedValue(results);
});

it("completes an anonymous journey, opens the real profile and preserves valid history for refinement", async () => {
  const storage = vi.spyOn(Storage.prototype, "setItem");
  render(<ThirdSpaceDemo />);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  start();
  expect(screen.getByText(OPENING_MESSAGE)).toBeInTheDocument();
  typeAndSend("I want to build strength. I’m a beginner near Battersea, not a member yet, and I can spend £90 an hour.");
  await screen.findByRole("heading", { name: "Your people. Your potential." });
  expect(api.runThirdSpaceTurn).toHaveBeenCalledTimes(1);
  expect(api.findThirdSpaceMatches).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/sign in|create an account|email address/i)).not.toBeInTheDocument();
  expect(storage).not.toHaveBeenCalled();
  expect(screen.getAllByText(/prices.*availability.*confirming/i)).toHaveLength(1);
  expect(screen.getAllByText(/membership.*needed|membership.*required/i)).toHaveLength(1);
  const card = screen.getByRole("button", { name: `View ${trainer.name}’s profile` });
  card.focus();
  fireEvent.click(card);
  const panel = screen.getByRole("dialog", { name: trainer.name });
  expect(within(panel).getByText(trainer.bio)).toBeInTheDocument();
  expect(within(panel).getByRole("link", { name: /View original Third Space profile/ })).toHaveAttribute("href", trainer.sourceUrl);
  expect(within(panel).getByRole("button", { name: "Close trainer profile" })).toHaveFocus();
  fireEvent(panel, new Event("cancel", { bubbles: true, cancelable: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(card).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Refine my matches" }));
  typeAndSend("I’d prefer someone with running expertise too.");
  await waitFor(() => expect(api.runThirdSpaceTurn).toHaveBeenCalledTimes(2));
  const transcript = api.runThirdSpaceTurn.mock.calls[1][0] as DemoMessage[];
  expect(transcript.filter((message) => message.role === "user")).toHaveLength(2);
  expect(transcript[1].content).toContain("£90");
  expect(() => validateTranscript({ messages: transcript }, true)).not.toThrow();
  await screen.findByRole("heading", { name: "Your people. Your potential." });
});

it("uses the exact hourly budget suggestions while accepting a different typed amount", async () => {
  api.runThirdSpaceTurn.mockResolvedValueOnce({ ...readyTurn, reply: "What hourly budget works for you?", readyForMatching: false, topic: "budget", quickReplies: ["Incorrect model option"] });
  render(<ThirdSpaceDemo />);
  start();
  typeAndSend("Build strength near Oxford Circus; I have Group membership and like encouraging coaching.");
  await screen.findByRole("button", { name: BUDGET_QUICK_REPLIES[0] });
  const suggestions = screen.getByLabelText("Suggested answers");
  expect(within(suggestions).getAllByRole("button").map((button) => button.textContent)).toEqual(BUDGET_QUICK_REPLIES);
  typeAndSend("£110 per hour");
  await screen.findByRole("heading", { name: "Your people. Your potential." });
  expect(api.runThirdSpaceTurn.mock.calls[1][0].at(-1).content).toBe("£110 per hour");
});

it("retries a failed AI turn without duplicating or losing the answer", async () => {
  api.runThirdSpaceTurn.mockRejectedValueOnce(new Error("offline"));
  render(<ThirdSpaceDemo />);
  start();
  typeAndSend("Train for my first marathon");
  expect(await screen.findByRole("alert")).toHaveTextContent("Your answer is still here");
  expect(await screen.findByText("Train for my first marathon")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Your message" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("heading", { name: "Your people. Your potential." });
  expect(api.runThirdSpaceTurn.mock.calls[0][0]).toEqual(api.runThirdSpaceTurn.mock.calls[1][0]);
});

it("retries matching independently and never shows fabricated results on failure", async () => {
  api.findThirdSpaceMatches.mockRejectedValueOnce(new Error("timeout"));
  render(<ThirdSpaceDemo />);
  start();
  fireEvent.click(screen.getByRole("button", { name: "Build strength" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Your conversation is still here");
  expect(screen.queryByRole("button", { name: /View .*profile/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("heading", { name: "Your people. Your potential." });
  expect(api.runThirdSpaceTurn).toHaveBeenCalledTimes(1);
  expect(api.findThirdSpaceMatches.mock.calls[0][0]).toEqual(api.findThirdSpaceMatches.mock.calls[1][0]);
});

it("offers refinement for empty matches without padding the shortlist", async () => {
  api.findThirdSpaceMatches.mockResolvedValue({ ...results, matches: [], emptyReason: "No sampled trainer has this specialty within your club access." });
  render(<ThirdSpaceDemo />);
  start();
  fireEvent.click(screen.getByRole("button", { name: "Train for an event" }));
  await screen.findByText("No sampled trainer has this specialty within your club access.");
  expect(screen.queryByRole("button", { name: /View .*profile/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Talk it through" }));
  expect(screen.getByRole("textbox", { name: "Your message" })).toBeInTheDocument();
});

it("clears memory on reset and ignores an old in-flight response", async () => {
  let resolveTurn: (turn: ThirdSpaceTurn) => void = () => undefined;
  api.runThirdSpaceTurn.mockImplementationOnce(() => new Promise<ThirdSpaceTurn>((resolve) => { resolveTurn = resolve; }));
  render(<ThirdSpaceDemo />);
  start();
  typeAndSend("An answer I want to clear");
  await waitFor(() => expect(api.runThirdSpaceTurn).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Start again" }));
  const confirmation = screen.getByRole("dialog", { name: "Start a new conversation?" });
  fireEvent.click(within(confirmation).getByRole("button", { name: "Start again" }));
  await act(async () => { resolveTurn(readyTurn); });
  expect(screen.getByRole("button", { name: "Find my trainer" })).toBeInTheDocument();
  expect(api.findThirdSpaceMatches).not.toHaveBeenCalled();
  start();
  await waitFor(() => expect(screen.queryByText("An answer I want to clear")).not.toBeInTheDocument());
  expect(screen.getByText(OPENING_MESSAGE)).toBeInTheDocument();
});
