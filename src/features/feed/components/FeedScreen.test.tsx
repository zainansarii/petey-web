import { fireEvent, render, screen, within } from "@testing-library/react";
import { DEMO_TRAINER_FIXTURES as TRAINERS } from "../../discovery/data/demoTrainerFixture";
import { FeedScreen } from "./FeedScreen";

vi.mock("motion/react", async (importOriginal) => ({
  ...await importOriginal<typeof import("motion/react")>(),
  useReducedMotion: () => true,
}));

describe("matched trainer feed", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "View profile" }));
    const profile = await screen.findByRole("dialog", { name: "Yasmin Okafor's demo profile" });
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
    fireEvent.click(screen.getByRole("button", { name: "View profile" }));
    const profile = await screen.findByRole("dialog", { name: "Maya Chen's profile" });
    expect(within(profile).getByText("Single session")).toBeInTheDocument();
    expect(within(profile).queryByText("10 sessions")).not.toBeInTheDocument();
    expect(within(profile).queryByText("Monthly coaching")).not.toBeInTheDocument();
    expect(profile).not.toHaveTextContent("£null");
  });

  it("leaves the empty shortlist usable by keyboard without cycling through demo trainers", () => {
    const onEditMatch = vi.fn();
    render(<FeedScreen matches={[]} onEditMatch={onEditMatch} onHome={vi.fn()} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("heading", { name: "No compatible trainers yet." })).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update my preferences" }));
    expect(onEditMatch).toHaveBeenCalledOnce();
  });
});
