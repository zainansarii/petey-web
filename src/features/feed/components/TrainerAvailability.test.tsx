import { render, screen, within } from "@testing-library/react";
import { TrainerAvailability } from "./TrainerAvailability";

describe("trainer availability calendar", () => {
  it("expands grouped availability and keeps individual days in the right cells", () => {
    render(<TrainerAvailability availability={["Weekday mornings", "Weekend evenings", "Tuesday afternoons"]} />);
    const table = screen.getByRole("table", { name: "Weekly availability" });
    const rows = within(table).getAllByRole("row").slice(1);
    const availablePeriods = rows.map((row) => within(row).getAllByRole("cell")
      .map((cell) => cell.textContent?.startsWith("Usually available")));
    expect(availablePeriods).toEqual([
      [true, false, false],
      [true, true, false],
      [true, false, false],
      [true, false, false],
      [true, false, false],
      [false, false, true],
      [false, false, true],
    ]);
    expect(within(table).getByRole("rowheader", { name: "Wednesday" })).toBeInTheDocument();
    expect(within(table).queryByRole("button")).not.toBeInTheDocument();
  });

  it("places lunchtime slots under afternoon and preserves the more specific description", () => {
    render(<TrainerAvailability availability={["Monday lunchtimes", "Monday afternoons"]} />);
    const monday = screen.getByRole("row", { name: /^Monday / });
    const cells = within(monday).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("No availability listed");
    expect(cells[1]).toHaveTextContent("Usually available: Monday lunchtimes; Monday afternoons");
    expect(cells[2]).toHaveTextContent("No availability listed");
    expect(screen.getByText("Lunchtime slots are shown under afternoon.")).toBeInTheDocument();
  });

  it("keeps unstructured notes visible without inventing times, and handles missing schedules", () => {
    const { rerender } = render(<TrainerAvailability availability={["Monday mornings by arrangement"]} />);
    expect(screen.getByText("Monday mornings by arrangement")).toBeInTheDocument();
    expect(screen.getAllByRole("cell").filter((cell) => cell.textContent === "No availability listed")).toHaveLength(21);
    rerender(<TrainerAvailability availability={[]} />);
    expect(screen.getByText("Availability to be confirmed.")).toBeInTheDocument();
    expect(screen.queryByText("Monday mornings by arrangement")).not.toBeInTheDocument();
  });
});
