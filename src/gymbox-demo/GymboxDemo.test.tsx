import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { validateTranscript } from "../../functions-gymbox/src/service";
import { TRAINERS } from "../../gymbox-shared/catalogue";
import { BUDGET_QUICK_REPLIES, OPENING_MESSAGE, type DemoMessage, type GymboxMatches, type GymboxTurn } from "../../gymbox-shared/contract";
import { GymboxDemo } from "./GymboxDemo";
import { ProfilePanel } from "./ProfilePanel";
import { CLUBS } from "../../gymbox-shared/locations";

const api = vi.hoisted(() => ({ runGymboxTurn: vi.fn(), findGymboxMatches: vi.fn() }));
const motionPreference = vi.hoisted(() => ({ reduced: true }));
vi.mock("./api", () => api);
vi.mock("motion/react", async (original) => ({ ...await original<typeof import("motion/react")>(), useReducedMotion: () => motionPreference.reduced }));

const readyTurn: GymboxTurn = {
  reply: "I’ll now find trainers who fit your goals.", topic: "complete", quickReplies: [], readyForMatching: true,
  coverage: { goal: true, experience: true, membership: true, access: true, location: true, coaching: true, budget: true },
};
const trainer = TRAINERS[0];
const results: GymboxMatches = {
  brief: { goal: "Build strength and feel confident", experience: "Beginner", coachingStyle: "Patient", specialistNeeds: [], membership: "non-member", membershipPackage: "", homeClubIds: [], accessibleClubIds: [], excludedClubIds: [], locationAnchors: ["Bank"], budget: "£90", additionalPreferences: [] },
  matches: [{ trainerId: trainer.id, clubId: trainer.clubIds[0], reasons: [trainer.summary], locationReason: "Bank fits your training area." }],
  unconfirmed: ["Individual trainer prices and session availability need confirming.", "A Gymbox membership is required."],
};

async function typeAndSend(text: string) {
  const user = userEvent.setup();
  const input = screen.getByRole("textbox", { name: "Your message" });
  await user.clear(input);
  await user.type(input, text);
  await user.click(screen.getByRole("button", { name: "Send message" }));
}
async function start() {
  fireEvent.click(screen.getByRole("button", { name: "Find my trainer" }));
  await screen.findByRole("textbox", { name: "Your message" });
}

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); } });
});
beforeEach(() => {
  vi.clearAllMocks();
  motionPreference.reduced = true;
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  api.runGymboxTurn.mockReset().mockResolvedValue(readyTurn);
  api.findGymboxMatches.mockReset().mockResolvedValue(results);
});

it("completes an anonymous journey, identifies fictional profiles and preserves valid history for refinement", async () => {
  const storage = vi.spyOn(Storage.prototype, "setItem");
  render(<GymboxDemo />);
  expect(screen.getByText(/AI matchmaking demo with fictional trainers/)).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  await start();
  expect(screen.getByText(OPENING_MESSAGE)).toBeInTheDocument();
  await typeAndSend("I want to build strength. I’m a beginner near Bank, not a member yet, and I can spend £90 per session.");
  await screen.findByRole("heading", { name: "Meet your matches" });
  expect(api.runGymboxTurn).toHaveBeenCalledTimes(1);
  expect(api.findGymboxMatches).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/sign in|create an account|email address/i)).not.toBeInTheDocument();
  expect(storage).not.toHaveBeenCalled();
  expect(screen.getByText(/10 fictional trainer profiles/)).toBeInTheDocument();
  const card = screen.getByRole("button", { name: `View ${trainer.name.split(" ")[0]}’s profile` });
  expect(within(card).getByText("Rates on enquiry")).toBeInTheDocument();
  card.focus();
  fireEvent.click(card);
  const panel = screen.getByRole("dialog", { name: trainer.name });
  expect(within(panel).getByText(trainer.bio)).toBeInTheDocument();
  expect(within(panel).getByText("Rates on enquiry")).toBeInTheDocument();
  expect(within(panel).queryByRole("link", { name: /View original Gymbox profile/ })).not.toBeInTheDocument();
  expect(within(panel).getByText("Fictional profile for this demo. Sessions are not available to book.")).toBeInTheDocument();
  expect(within(panel).getByRole("button", { name: "Close trainer profile" })).toHaveFocus();
  fireEvent(panel, new Event("cancel", { bubbles: true, cancelable: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(card).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Refine my matches" }));
  await typeAndSend("I’d prefer someone with running expertise too.");
  await waitFor(() => expect(api.runGymboxTurn).toHaveBeenCalledTimes(2));
  const transcript = api.runGymboxTurn.mock.calls[1][0] as DemoMessage[];
  expect(transcript.filter((message) => message.role === "user")).toHaveLength(2);
  expect(transcript[1].content).toContain("£90");
  expect(() => validateTranscript({ messages: transcript }, true)).not.toThrow();
  await screen.findByRole("heading", { name: "Meet your matches" });
});

it("retains original-profile links for explicitly sourced profiles", () => {
  const sourced = { ...trainer, pricePerSessionGbp: null, kind: "sourced" as const, sourceUrl: "https://gymbox.com/personal-training/", verifiedAt: "2026-09-24" };
  render(<ProfilePanel trainer={sourced} club={CLUBS.find(club => club.id === trainer.clubIds[0])} match={results.matches[0]} onClose={vi.fn()} />);
  expect(screen.getByRole("link", { name: /View original Gymbox profile/ })).toHaveAttribute("href", sourced.sourceUrl);
  expect(screen.queryByText(/Fictional profile/)).not.toBeInTheDocument();
  expect(screen.getByText("Rates on enquiry")).toBeInTheDocument();
});

it("omits confirmation disclaimers from the matches", async () => {
  const unconfirmed = [
    "Individual trainer prices and session availability need to be confirmed.",
    "Confirm membership and club access before arranging personal training.",
    "Distances are approximate straight-line distances, not travel times.",
  ];
  api.findGymboxMatches.mockResolvedValueOnce({ ...results, unconfirmed });
  render(<GymboxDemo />);
  await start();
  await typeAndSend("Build strength near Bank, up to £60 per session on Tuesday evenings. I’m unsure about membership.");
  await screen.findByRole("heading", { name: "Meet your matches" });
  expect(screen.queryByRole("list", { name: "Details to confirm" })).not.toBeInTheDocument();
  for (const note of unconfirmed) expect(screen.queryByText(note)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: `View ${trainer.name.split(" ")[0]}’s profile` })).toBeInTheDocument();
});

it("rejects a stale sourced trainer returned by an older backend", async () => {
  api.findGymboxMatches.mockResolvedValueOnce({ ...results, matches: [{ ...results.matches[0], trainerId: "dl-demo-emma-carter" }] });
  render(<GymboxDemo />);
  await start();
  await typeAndSend("Build strength at Bank");
  expect(await screen.findByRole("alert")).toHaveTextContent("Your conversation is still here");
  expect(screen.queryByRole("button", { name: /View .*profile/ })).not.toBeInTheDocument();
});

it("uses the budget choices without price assumptions while accepting a different typed amount", async () => {
  api.runGymboxTurn.mockResolvedValueOnce({ ...readyTurn, reply: "What would you feel comfortable spending per personal-training session?", readyForMatching: false, topic: "budget", quickReplies: ["Incorrect model option"] });
  render(<GymboxDemo />);
  await start();
  await typeAndSend("Build strength at Bank, my home club; I like encouraging coaching.");
  await screen.findByRole("button", { name: BUDGET_QUICK_REPLIES[0] });
  const suggestions = screen.getByLabelText("Suggested answers");
  expect(within(suggestions).getAllByRole("button").map((button) => button.textContent)).toEqual(BUDGET_QUICK_REPLIES);
  await typeAndSend("£65 per session");
  await screen.findByRole("heading", { name: "Meet your matches" });
  expect(api.runGymboxTurn.mock.calls[1][0].at(-1).content).toBe("£65 per session");
});

it("retries a failed AI turn without duplicating or losing the answer", async () => {
  api.runGymboxTurn.mockRejectedValueOnce(new Error("offline"));
  render(<GymboxDemo />);
  await start();
  await typeAndSend("Train for my first marathon");
  expect(await screen.findByRole("alert")).toHaveTextContent("Your answer is still here");
  expect(await screen.findByText("Train for my first marathon")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Your message" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("heading", { name: "Meet your matches" });
  expect(api.runGymboxTurn.mock.calls[0][0]).toEqual(api.runGymboxTurn.mock.calls[1][0]);
});

it("retries matching independently and never shows fabricated results on failure", async () => {
  api.findGymboxMatches.mockRejectedValueOnce(new Error("timeout"));
  render(<GymboxDemo />);
  await start();
  fireEvent.click(screen.getByRole("button", { name: "Build muscle" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Your conversation is still here");
  expect(screen.queryByRole("button", { name: /View .*profile/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("heading", { name: "Meet your matches" });
  expect(api.runGymboxTurn).toHaveBeenCalledTimes(1);
  expect(api.findGymboxMatches.mock.calls[0][0]).toEqual(api.findGymboxMatches.mock.calls[1][0]);
});

it("offers refinement for empty matches without padding the shortlist", async () => {
  api.findGymboxMatches.mockResolvedValue({ ...results, matches: [], emptyReason: "No sampled trainer has this specialty within your club access." });
  render(<GymboxDemo />);
  await start();
  fireEvent.click(screen.getByRole("button", { name: "Run my first 5K" }));
  await screen.findByText("No sampled trainer has this specialty within your club access.");
  expect(screen.queryByRole("button", { name: /View .*profile/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Talk it through" }));
  expect(screen.getByRole("textbox", { name: "Your message" })).toBeInTheDocument();
});

it("clears memory on reset and ignores an old in-flight response", async () => {
  let resolveTurn: (turn: GymboxTurn) => void = () => undefined;
  api.runGymboxTurn.mockImplementationOnce(() => new Promise<GymboxTurn>((resolve) => { resolveTurn = resolve; }));
  render(<GymboxDemo />);
  await start();
  await typeAndSend("An answer I want to clear");
  await waitFor(() => expect(api.runGymboxTurn).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Start again" }));
  const confirmation = screen.getByRole("dialog", { name: "Start a new conversation?" });
  fireEvent.click(within(confirmation).getByRole("button", { name: "Start again" }));
  await act(async () => { resolveTurn(readyTurn); });
  expect(await screen.findByRole("button", { name: "Find my trainer" })).toBeInTheDocument();
  expect(api.findGymboxMatches).not.toHaveBeenCalled();
  await start();
  await waitFor(() => expect(screen.queryByText("An answer I want to clear")).not.toBeInTheDocument());
  expect(screen.getByText(OPENING_MESSAGE)).toBeInTheDocument();
});

it("reveals new assistant replies while keeping the complete text accessible", async () => {
  motionPreference.reduced = false;
  api.runGymboxTurn.mockResolvedValueOnce({ ...readyTurn, reply: "What does your training look like at the moment?", readyForMatching: false, topic: "experience", quickReplies: [] });
  const { container } = render(<GymboxDemo />);
  await start();
  const opening = screen.getByText(OPENING_MESSAGE);
  expect(opening).not.toHaveAttribute("aria-hidden");
  const words = Array.from(container.querySelectorAll<HTMLElement>(".gb-message__word"));
  expect(words.some((word) => word.style.opacity !== "1")).toBe(true);
  expect(words[0].parentElement).toHaveAttribute("aria-hidden", "true");
  await waitFor(() => expect(words.every((word) => word.style.opacity === "1")).toBe(true), { timeout: 2000 });
  expect(screen.getByText("AI-assisted. Please leave out medical details. Demo Powered by Petey.")).toBeInTheDocument();
  await typeAndSend("Build strength");
  const reply = await screen.findByText("What does your training look like at the moment?");
  const newWords = Array.from(reply.parentElement!.querySelectorAll<HTMLElement>(".gb-message__word"));
  expect(newWords.some((word) => word.style.opacity !== "1")).toBe(true);
  expect(words.every((word) => word.style.opacity === "1")).toBe(true);
  await waitFor(() => expect(newWords.every((word) => word.style.opacity === "1")).toBe(true), { timeout: 2000 });
});

it("rejects duplicate identities in a matching response", async () => {
  api.findGymboxMatches.mockResolvedValueOnce({ ...results, matches: [results.matches[0], results.matches[0]] });
  render(<GymboxDemo />);
  await start();
  await typeAndSend("Build strength at Bank");
  expect(await screen.findByRole("alert")).toHaveTextContent("Your conversation is still here");
  expect(screen.queryByRole("button", { name: /View .*profile/ })).not.toBeInTheDocument();
});
