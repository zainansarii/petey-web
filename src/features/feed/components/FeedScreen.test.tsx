import { fireEvent, render, screen, within } from "@testing-library/react";
import { DEMO_TRAINER_FIXTURES as TRAINERS } from "../../discovery/data/demoTrainerFixture";
import { FeedScreen } from "./FeedScreen";

vi.mock("motion/react", async (importOriginal) => ({
  ...await importOriginal<typeof import("motion/react")>(),
  useReducedMotion: () => true,
}));
vi.mock("../../marketplace/api", async original => ({
  ...await original<typeof import("../../marketplace/api")>(),
  marketplace: vi.fn(async () => ({ trainerIds: [] })),
}));

describe("matched trainer feed", () => {
  beforeEach(() => vi.stubEnv("BASE_URL", "/petey-web/"));
  afterEach(() => vi.unstubAllEnvs());

  it.each([{ matches: [] }, { matches: [{ trainer: TRAINERS[0]!, score: 90, reason: "A good fit." }] }])("keeps the live inbox reachable with any shortlist", ({ matches }) => {
    render(<FeedScreen matches={matches} liveEnquiries onEditMatch={vi.fn()} onHome={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute("href", "/petey-web/messages/");
  });

  it("shows exact form profile pricing, duration, locations, availability and coaching notes", () => {
    const trainer = {
      ...TRAINERS[0]!, sessionDurationMinutes: 45, tenPackPrice: null, monthlyPrice: null,
      availability: [], availabilityNotes: "Monday and Wednesday 6–9pm, UK time.",
      pricingNotes: "Six sessions for £360; payment upfront.",
      serviceAreaNotes: "Online or at North Studio; membership required.",
      coachingStyleNotes: "Calm explanations with regular progress reviews.",
      experience: "3–5 years", professionalUrl: "https://example.com/coach",
    };
    render(<FeedScreen matches={[{ trainer, score: 90, reason: "Your practical preferences fit." }]} onEditMatch={vi.fn()} onHome={vi.fn()} />);
    const profile = screen.getByRole("region", { name: `${trainer.name}'s profile details` });
    for (const note of [trainer.availabilityNotes, trainer.pricingNotes, trainer.serviceAreaNotes, trainer.coachingStyleNotes]) {
      expect(within(profile).getByText(note)).toBeInTheDocument();
    }
    expect(within(profile).getByText("Single session · 45 minutes")).toBeInTheDocument();
    expect(within(profile).queryByText("10 sessions")).not.toBeInTheDocument();
    expect(within(profile).getByRole("link", { name: "Professional website or social profile" }))
      .toHaveAttribute("href", trainer.professionalUrl);
  });

  it("labels alternatives honestly and separates dealbreakers from preference differences", () => {
    render(<FeedScreen matches={[{
      trainer: TRAINERS[0]!, score: 60, reason: "Useful strength experience, but above your maximum price.", matchKind: "closest",
      dealbreakers: { budget: "not_met", availability: "unconfirmed", venue: "met", location: "met", trainerGender: "not_required", otherRequirements: "not_required" },
      tradeoffs: ["More talkative than you prefer."],
    }]} onEditMatch={vi.fn()} onHome={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Your closest options" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Why you match" })).not.toBeInTheDocument();
    const essentials = screen.getByRole("region", { name: "Dealbreakers" });
    expect(essentials).toHaveTextContent("Budget: Doesn’t meet your requirement");
    expect(essentials).toHaveTextContent("Availability: Needs confirming");
    expect(essentials).toHaveTextContent("Training setting: Fits");
    expect(screen.getByRole("region", { name: "Preference differences" })).toHaveTextContent("More talkative than you prefer.");
  });

  it("makes every returned match available in server order, including beyond the three previews", async () => {
    const matchedTrainers = [TRAINERS[5]!, TRAINERS[3]!, TRAINERS[4]!, TRAINERS[7]!];
    render(<FeedScreen matches={matchedTrainers.map((trainer, index) => ({
      trainer,
      score: 90 - index,
      reason: `A match because of ${trainer.specialty.toLowerCase()}.`,
    }))} onEditMatch={vi.fn()} onHome={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "John Kim" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show Maya Chen" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show Yasmin Okafor" }));
    expect(await screen.findByRole("heading", { name: "Yasmin Okafor" })).toBeInTheDocument();
    expect(screen.getByText("A match because of strength.", { exact: false })).toBeInTheDocument();
    const profile = await screen.findByRole("region", { name: "Yasmin Okafor's profile details" });
    expect(screen.queryByRole("button", { name: "View profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(profile).getByText(TRAINERS[7]!.bio)).toBeInTheDocument();
    expect(within(profile).getByRole("heading", { name: "Where you can train" })).toBeInTheDocument();
    expect(within(profile).queryByText(/miles away/i)).not.toBeInTheDocument();
  });

  it("omits packages that the trainer does not offer", async () => {
    render(<FeedScreen matches={[{
      trainer: { ...TRAINERS[0]!, tenPackPrice: null, monthlyPrice: null, isDemo: false },
      score: 88,
      reason: "The sessions fit your goals.",
    }]} onEditMatch={vi.fn()} onHome={vi.fn()} />);
    const profile = await screen.findByRole("region", { name: "Maya Chen's profile details" });
    expect(within(profile).getByText("Single session")).toBeInTheDocument();
    expect(within(profile).queryByText("10 sessions")).not.toBeInTheDocument();
    expect(within(profile).queryByText("Monthly coaching")).not.toBeInTheDocument();
    expect(profile).not.toHaveTextContent("£null");
  });

  it("keeps the card and details in sync in both directions and opens an intro from the details", async () => {
    render(<FeedScreen matches={TRAINERS.slice(0, 2).map(trainer => ({ trainer, score: 90, reason: `Why ${trainer.name} fits.` }))} onEditMatch={vi.fn()} onHome={vi.fn()} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const details = await screen.findByRole("region", { name: "Marcus Adebayo's profile details" });
    expect(screen.getByRole("heading", { name: "Marcus Adebayo" })).toBeInTheDocument();
    expect(within(details).getByText(TRAINERS[1]!.bio)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(await screen.findByRole("region", { name: "Maya Chen's profile details" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview intro request" }));
    expect(await screen.findByRole("dialog", { name: "Preview an introduction to Maya Chen" })).toBeInTheDocument();
  });

  it("leaves the empty shortlist usable by keyboard without cycling through demo trainers", () => {
    const onEditMatch = vi.fn();
    render(<FeedScreen matches={[]} onEditMatch={onEditMatch} onHome={vi.fn()} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("heading", { name: "No trainers available yet" })).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update my preferences" }));
    expect(onEditMatch).toHaveBeenCalledOnce();
  });
});
