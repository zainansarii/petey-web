import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApplicationDetail } from "../features/trainerApplications/model";
import { makeReviewFixture } from "./fixture";
import { ReviewEditor } from "./ReviewEditor";
import type { ReviewApi } from "./api";

const ready = () => {
  const detail = makeReviewFixture();
  detail.verification.qualification = { checked: true, title: "Level 3 PT", provider: "Awarding body", expiresOn: null, reference: "Certificate checked directly." };
  detail.verification.insurance = { checked: true, provider: "Insurance provider", expiresOn: "2099-12-31", reference: "Current policy checked directly." };
  return detail;
};
function mockApi(detail: ApplicationDetail): ReviewApi {
  return {
    access: vi.fn(), list: vi.fn(), detail: vi.fn().mockResolvedValue(detail),
    save: vi.fn().mockImplementation(async ({ draft, verification }) => ({ ...detail, draft, verification, application: { ...detail.application, version: 2 } })),
    decide: vi.fn().mockResolvedValue({ ...detail, application: { ...detail.application, version: 3, status: "approved", publishedVersion: 3 } }),
  };
}

describe("trainer application review", () => {
  it("saves an exact review version and pence price while preserving original form answers", async () => {
    const detail = ready();
    const api = mockApi(detail);
    render(<ReviewEditor initial={detail} api={api} onDirtyChange={vi.fn()} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Public name"));
    await user.type(screen.getByLabelText("Public name"), "Alex Taylor");
    fireEvent.change(screen.getByLabelText("Standard session price (£)"), { target: { value: "72.35" } });
    expect(screen.getByRole("button", { name: "Approve & publish" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ applicationId: detail.application.id, expectedVersion: 1, draft: expect.objectContaining({ name: "Alex Taylor", singleSessionPence: 7235 }) })));
    expect(detail.originalAnswers.name).toBe("Alex Morgan");
    await user.click(screen.getByText("Original form answers", { selector: "summary" }));
    expect(screen.getByText("Alex Morgan", { selector: "dd" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Approve & publish" }));
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 2, decision: "approve", requestId: expect.any(String) })));
  });

  it("blocks approval for incomplete verification and failed photos, and requires reasons for other decisions", async () => {
    const detail = makeReviewFixture();
    detail.photo.state = "error";
    const api = mockApi(detail);
    render(<ReviewEditor initial={detail} api={api} onDirtyChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Approve & publish" })).toBeDisabled();
    expect(screen.getByText("A valid profile photo is required.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Decision reason"), "Please supply a supported profile photo.");
    await user.click(screen.getByRole("button", { name: "Needs changes" }));
    expect(api.decide).toHaveBeenCalledWith(expect.objectContaining({ decision: "needs_changes", reason: "Please supply a supported profile photo." }));
  });

  it("keeps unsaved corrections after a stale-version rejection and exposes reload recovery", async () => {
    const detail = ready();
    const api = mockApi(detail);
    vi.mocked(api.save).mockRejectedValue(Object.assign(new Error("stale"), { code: "functions/aborted" }));
    render(<ReviewEditor initial={detail} api={api} onDirtyChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Profile bio"), { target: { value: "Updated coaching introduction." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("changed since you opened it");
    expect(screen.getByLabelText("Profile bio")).toHaveValue("Updated coaching introduction.");
    expect(screen.getByRole("button", { name: "Approve & publish" })).toBeDisabled();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Reload latest" })));
    expect(screen.getByLabelText("Profile bio")).toHaveValue(detail.draft.bio);
  });

  it("rejects invalid professional links before calling the save API", async () => {
    const detail = ready();
    const api = mockApi(detail);
    render(<ReviewEditor initial={detail} api={api} onDirtyChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Professional link (optional)"), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Use an HTTPS professional link");
    expect(api.save).not.toHaveBeenCalled();
  });

  it("saves date input values and omits empty lines from profile lists", async () => {
    const detail = ready();
    const api = mockApi(detail);
    render(<ReviewEditor initial={detail} api={api} onDirtyChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Insurance expiry"), { target: { value: "2027-09-07" } });
    fireEvent.change(screen.getByLabelText("Specialisms"), { target: { value: "Strength\n\nMobility\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ draft: expect.objectContaining({ specialties: ["Strength", "Mobility"] }), verification: expect.objectContaining({ insurance: expect.objectContaining({ expiresOn: "2027-09-07" }) }) })));
  });

  it("reuses the decision request id after an ambiguous network failure", async () => {
    const detail = ready();
    const api = mockApi(detail);
    vi.mocked(api.decide).mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: "functions/deadline-exceeded" }));
    render(<ReviewEditor initial={detail} api={api} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve & publish" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be reached");
    fireEvent.click(screen.getByRole("button", { name: "Approve & publish" }));
    await waitFor(() => expect(api.decide).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.decide).mock.calls[1][0].requestId).toBe(vi.mocked(api.decide).mock.calls[0][0].requestId);
  });
});
