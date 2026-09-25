import { fireEvent, render, screen, within } from "@testing-library/react";
import { AdminDashboard } from "./AdminDashboard";
import { count, selectJourneys, summarise } from "./data";

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); } });
});

it("updates summary, comparisons, opportunities and table when filters change", () => {
  render(<AdminDashboard />);
  fireEvent.change(screen.getByRole("combobox", { name: "Club" }), { target: { value: "city" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Reporting period" }), { target: { value: "7" } });
  const expected = summarise(selectJourneys(7, "city"));
  expect(within(screen.getByRole("region", { name: "Completed searches" })).getByText(count(expected.searches), { exact: true })).toBeVisible();
  expect(within(screen.getByRole("region", { name: "Enquiries generated" })).getByText(count(expected.enquiries), { exact: true })).toBeVisible();
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  expect(within(screen.getByRole("table")).getByRole("button", { name: "Explore City" })).toBeVisible();
  expect(screen.getAllByText("vs previous 7 days")).toHaveLength(4);
  expect(screen.getByRole("status")).toHaveTextContent(`City, last 7 days: ${expected.searches} searches`);
});

it("paginates and resets the table when switching between clubs and trainers", () => {
  render(<AdminDashboard />);
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(screen.getByText("7–12 of 16 clubs")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Trainers" }));
  expect(screen.getByText("1–6 of 32 trainers")).toBeVisible();
  expect(screen.getByRole("columnheader", { name: "Recommended" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Conversion" }));
  expect(screen.getByRole("columnheader", { name: "Conversion" })).toHaveAttribute("aria-sort", "descending");
});

it("opens the selected club detail with scoped values and restores focus on close", () => {
  render(<AdminDashboard />);
  fireEvent.change(screen.getByRole("combobox", { name: "Club" }), { target: { value: "city" } });
  const button = screen.getByRole("button", { name: "Explore City" });
  button.focus();
  fireEvent.click(button);
  const dialog = screen.getByRole("dialog", { name: "City" });
  expect(within(dialog).getByRole("heading", { name: "Enquiry conversion over time" })).toBeVisible();
  expect(within(dialog).getByText(count(summarise(selectJourneys(28, "city")).searches), { exact: true })).toBeVisible();
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
