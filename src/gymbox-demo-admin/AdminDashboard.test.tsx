import { fireEvent, render, screen, within } from "@testing-library/react";
import { AdminDashboard } from "./AdminDashboard";
import { ADMIN_CLUBS, count, selectJourneys, summarise } from "./data";

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); } });
});

it("updates summary, comparisons, opportunities and table when filters change", () => {
  render(<AdminDashboard />);
  fireEvent.change(screen.getByRole("combobox", { name: "Club" }), { target: { value: "bank" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Reporting period" }), { target: { value: "7" } });
  const expected = summarise(selectJourneys(7, "bank"));
  expect(within(screen.getByRole("region", { name: "Completed searches" })).getByText(count(expected.searches), { exact: true })).toBeVisible();
  expect(within(screen.getByRole("region", { name: "Enquiry intent" })).getByText(count(expected.enquiries), { exact: true })).toBeVisible();
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  expect(within(screen.getByRole("table")).getByRole("button", { name: "Explore Bank" })).toBeVisible();
  expect(screen.getAllByText("vs previous 7 days")).toHaveLength(4);
  expect(screen.getByRole("status")).toHaveTextContent(`Bank, last 7 days: ${expected.searches} searches`);
});

it("paginates and resets the table when switching between clubs and trainers", () => {
  render(<AdminDashboard />);
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(screen.getByText(`7–10 of ${ADMIN_CLUBS.length} clubs`)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Trainers" }));
  expect(screen.getByText("1–6 of 10 trainers")).toBeVisible();
  expect(screen.getByRole("columnheader", { name: "Recommended" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Conversion" }));
  expect(screen.getByRole("columnheader", { name: "Conversion" })).toHaveAttribute("aria-sort", "descending");
});

it("opens the selected club detail with scoped values and restores focus on close", () => {
  render(<AdminDashboard />);
  fireEvent.change(screen.getByRole("combobox", { name: "Club" }), { target: { value: "bank" } });
  const button = screen.getByRole("button", { name: "Explore Bank" });
  button.focus();
  fireEvent.click(button);
  const dialog = screen.getByRole("dialog", { name: "Bank" });
  expect(within(dialog).getByRole("heading", { name: "Intent conversion over time" })).toBeVisible();
  expect(within(dialog).getByText(count(summarise(selectJourneys(28, "bank")).searches), { exact: true })).toBeVisible();
  fireEvent.click(within(dialog).getByRole("button", { name: "Close details" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(button).toHaveFocus();
  expect(document.body.style.overflow).toBe("");
});

it("makes demand bars and underserved segments open evidence with the same denominator", () => {
  render(<AdminDashboard />);
  fireEvent.click(screen.getByRole("button", { name: /^Explore Build strength:/ }));
  expect(screen.getByRole("dialog", { name: "Build strength" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Demand by club" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Close details" }));
  const gaps = screen.getByRole("region", { name: "Room for a better match" });
  fireEvent.click(within(gaps).getAllByRole("button")[0]);
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText(/searches received no match/)).toBeVisible();
  expect(within(dialog).getByRole("heading", { name: "Trainer coverage" })).toBeVisible();
});

it("shows empty sample coverage for a club without inventing trainer activity", () => {
  render(<AdminDashboard />);
  const uncovered = ADMIN_CLUBS.find(({ id }) => !["bank", "farringdon"].includes(id))!;
  fireEvent.change(screen.getByRole("combobox", { name: "Club" }), { target: { value: uncovered.id } });
  expect(screen.getByRole("note")).toHaveTextContent(`No sample journeys or fictional trainers are included for ${uncovered.name}.`);
  expect(screen.getByRole("status")).toHaveTextContent("0 searches, 0 searches with enquiry intent, 0.0% conversion");
  fireEvent.click(screen.getByRole("button", { name: "Trainers" }));
  expect(screen.getByText("No fictional trainers at this club.")).toBeVisible();
  expect(screen.getByText("0–0 of 0 trainers")).toBeVisible();
  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
});

it("opens Emma's own recommendations and enquiries in her trainer detail", () => {
  render(<AdminDashboard />);
  fireEvent.change(screen.getByRole("combobox", { name: "Club" }), { target: { value: "bank" } });
  fireEvent.click(screen.getByRole("button", { name: "Trainers" }));
  fireEvent.click(screen.getByRole("button", { name: "Explore Emma Carter" }));
  const dialog = screen.getByRole("dialog", { name: "Emma Carter" });
  const recommendations = selectJourneys(28, "bank").filter(({ trainerIds }) => trainerIds.includes("gb-demo-emma-carter"));
  expect(within(dialog).getByText(count(recommendations.length), { exact: true })).toBeVisible();
  expect(within(dialog).getByText("Bank · Sample trainer")).toBeVisible();
  expect(within(dialog).getByRole("heading", { name: "Who this trainer is reaching" })).toBeVisible();
});
