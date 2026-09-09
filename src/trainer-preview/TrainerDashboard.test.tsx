import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { TrainerDashboard } from "./TrainerDashboard";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

describe("trainer dashboard product wireframe", () => {
  it("keeps an introduction locked on payment failure, unlocks once and includes replies", async () => {
    const user = userEvent.setup();
    render(<TrainerDashboard />);
    await user.click(screen.getByRole("button", { name: "View enquiry from Emma Wilson" }));
    expect(screen.queryByText(/I’ve signed up for my first 10K/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Unlock enquiry · £8" }));
    await user.click(screen.getByRole("checkbox", { name: "Test a declined payment" }));
    await user.click(screen.getByRole("button", { name: /Simulate £8 payment/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Nothing was charged or unlocked");
    expect(screen.queryByText(/I’ve signed up for my first 10K/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Test a declined payment" }));
    await user.click(screen.getByRole("button", { name: /Simulate £8 payment/ }));
    expect(screen.getByText(/I’ve signed up for my first 10K/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Simulate £8 payment/ })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Your reply"), "Hi Emma, let’s talk about your running goals.");
    await user.click(screen.getByRole("button", { name: "Send preview reply" }));
    expect(screen.getByLabelText("Lead status")).toHaveValue("contacted");
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    await user.click(screen.getByRole("button", { name: "Spending" }));
    expect(screen.getByText("£136")).toBeInTheDocument();
  });

  it("keeps date-filtered metrics and the linked enquiry list consistent", async () => {
    const user = userEvent.setup();
    render(<TrainerDashboard />);
    await user.selectOptions(screen.getByLabelText("Reporting period"), "7");
    const newTile = screen.getByRole("button", { name: /New enquiries 05/ });
    await user.click(newTile);
    expect(screen.getAllByRole("button", { name: /View enquiry from/ })).toHaveLength(5);
    await user.type(screen.getByLabelText("Search enquiries"), "Sophie");
    expect(screen.getAllByRole("button", { name: /View enquiry from/ })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "View enquiry from Sophie Patel" }));
    expect(screen.getByText(/below your £72 rate/)).toBeVisible();
  });

  it("retains a profile draft across navigation without publishing it", async () => {
    const user = userEvent.setup();
    render(<TrainerDashboard />);
    await user.click(screen.getByRole("button", { name: "My profile" }));
    fireEvent.change(screen.getByLabelText("About you"), { target: { value: "My revised coaching introduction." } });
    await user.click(screen.getByRole("button", { name: "Submit changes" }));
    expect(screen.getByText("Changes awaiting review")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Overview" }));
    await user.click(screen.getByRole("button", { name: "My profile" }));
    expect(screen.getByLabelText("About you")).toHaveValue("My revised coaching introduction.");
    await user.click(screen.getByRole("button", { name: "Preview profile" }));
    expect(within(screen.getByRole("dialog")).getByText("My revised coaching introduction.")).toBeVisible();
  });

  it("shows honest empty metrics and recovers from the example load error", async () => {
    const user = userEvent.setup();
    render(<TrainerDashboard />);
    await user.selectOptions(screen.getByLabelText("Preview state"), "empty");
    expect(screen.getByText("Your next client starts here")).toBeVisible();
    expect(screen.getByText("£0")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Preview state"), "error");
    expect(screen.getByText("Your dashboard couldn’t load")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Try again/ }));
    expect(screen.getByRole("button", { name: /New enquiries 08/ })).toBeVisible();
  });
});
