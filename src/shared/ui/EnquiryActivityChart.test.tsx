import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EnquiryActivityChart, type ActivityPoint } from "./EnquiryActivityChart";

vi.mock("motion/react", async original => ({ ...await original<typeof import("motion/react")>(), useReducedMotion: () => true }));
const points: ActivityPoint[] = [
  { date: "2026-09-07", label: "7 Sept", received: 1, unlocked: 0 },
  { date: "2026-09-08", label: "8 Sept", received: 6, unlocked: 2 },
  { date: "2026-09-09", label: "9 Sept", received: 0, unlocked: 8 },
];
const description = "Daily totals in UTC. Unlocks use the date unlocked.";

describe("enquiry activity chart", () => {
  it("exposes exact recorded counts to keyboard users, including more unlocks than enquiries", () => {
    render(<EnquiryActivityChart points={points} description={description} />);
    const chart = screen.getByRole("slider", { name: "Explore enquiry activity" });
    expect(chart).toHaveAttribute("aria-valuetext", "9 Sept: 0 enquiries, 8 unlocked.");
    fireEvent.keyDown(chart, { key: "Home" });
    expect(chart).toHaveAttribute("aria-valuenow", "1");
    expect(chart).toHaveAttribute("aria-valuetext", "7 Sept: 1 enquiries, 0 unlocked.");
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(chart).toHaveAttribute("aria-valuetext", "8 Sept: 6 enquiries, 2 unlocked.");
    fireEvent.keyDown(chart, { key: "End" });
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(chart).toHaveAttribute("aria-valuenow", "3");
  });

  it("keeps exact accessible values and totals when a visual series is hidden", () => {
    render(<EnquiryActivityChart points={points} description={description} />);
    fireEvent.click(screen.getByRole("button", { name: "Unlocked series" }));
    expect(screen.getByRole("button", { name: "Unlocked series" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "9 Sept: 0 enquiries, 8 unlocked.");
    expect(screen.getByRole("button", { name: "Enquiries series" })).toHaveTextContent("7");
    expect(screen.getByRole("button", { name: "Unlocked series" })).toHaveTextContent("10");
  });

  it("recovers the selection across reporting periods and renders zero or missing data honestly", () => {
    const view = render(<EnquiryActivityChart points={points} description={description} />);
    const zero = { ...points[0], received: 0, unlocked: 0 };
    view.rerender(<EnquiryActivityChart points={[zero]} description={description} />);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "7 Sept: 0 enquiries, 0 unlocked.");
    fireEvent.click(screen.getByRole("button", { name: "Enquiries series" }));
    fireEvent.click(screen.getByRole("button", { name: "Unlocked series" }));
    expect(screen.getByText("Choose a series above to explore activity.")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    view.rerender(<EnquiryActivityChart points={[]} description={description} />);
    expect(screen.getByText("Your activity will appear here with your first enquiry.")).toBeInTheDocument();
    expect(view.container.innerHTML).not.toMatch(/NaN|Infinity/);
  });
});
