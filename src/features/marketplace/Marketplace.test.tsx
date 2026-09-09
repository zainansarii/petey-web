import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Conversation } from "./Conversation";
import { EnquiryComposer } from "./EnquiryComposer";
import { ProfileEditor } from "./ProfileEditor";
import { marketplace } from "./api";
import type { EnquiryDetail, ProfileWorkspace, SharedSummary } from "./model";
vi.mock("./api", async original => ({ ...await original<typeof import("./api")>(), marketplace: vi.fn(), watchMessages: vi.fn(async () => () => {}) }));
vi.mock("../auth/api/magicLink", () => ({ getFirebaseAuth: async () => ({ currentUser: { uid: "trainee" } }) }));
const api = vi.mocked(marketplace);
const summary: SharedSummary = { goals: "Build strength", area: "North London", settings: "Online", budget: "£70", availability: "Weekdays", frequency: "Twice weekly", goalCategory: "Strength" };
const locked: EnquiryDetail = { id: "lead", trainerId: "trainer", trainerName: "Alex Morgan", traineeLabel: "Sam E.", createdAt: "2026-09-09T12:00:00Z", latestAt: "2026-09-09T12:00:00Z", summary, unlockedAt: null, firstReplyAt: null, withdrawnAt: null, blocked: false, unreadCount: 0, lastSeq: 0, readSeq: 0, role: "trainer", tradeoffs: [], content: null, tracking: { notes: "", outcome: "open", followUp: null, version: 0 } };
const publicDraft = { name: "Alex Morgan", bio: "Calm strength coaching", area: "North London", serviceAreaNotes: "Travel by arrangement", specialties: ["Strength"], coachingStyles: ["Supportive"], venues: ["Online"], availability: ["Monday evenings", "Other times by arrangement"], singleSessionPence: 6500, tenPackPence: null, monthlyCoachingPence: null, sessionDurationMinutes: 60, pricingNotes: "", gender: null, experience: "5 years", professionalUrl: null, acceptingNewClients: true, availableFrom: null };
const workspace: ProfileWorkspace = { draft: publicDraft, published: publicDraft, draftVersion: 0, version: 3, baseVersion: 3, photoUrl: "/photo.png", draftPhotoUrl: "/photo.png", qualifications: ["PT diploma"], verificationExpiresOn: "2027-01-01" };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); HTMLDialogElement.prototype.showModal = function () { this.open = true; }; HTMLDialogElement.prototype.close = function () { this.open = false; }; HTMLElement.prototype.scrollIntoView = vi.fn(); });
describe("live pilot interaction states", () => {
  it("saves date-picker input with private follow-up notes", async () => {
    api.mockImplementation(async request => request.action === "tracking" ? { ...locked, tracking: { notes: request.notes, outcome: request.outcome, followUp: request.followUp, version: 1 } } : locked);
    render(<Conversation uid="trainer" id="lead" updated="" onBack={vi.fn()} onChange={vi.fn()} />);
    fireEvent.input(await screen.findByLabelText("Follow-up date"), { target: { value: "2026-09-10" } });
    await userEvent.type(screen.getByLabelText("Private notes"), "Discuss a consultation");
    await userEvent.click(screen.getByRole("button", { name: "Save follow-up" }));
    expect(await screen.findByText("Follow-up saved.")).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith(expect.objectContaining({ action: "tracking", followUp: "2026-09-10", notes: "Discuss a consultation" }));
    expect(screen.getByLabelText("Follow-up date")).toHaveValue("2026-09-10");
  });
  it("keeps locked introductions absent and unlocks with no checkout", async () => {
    api.mockImplementation(async request => { if (request.action === "detail") return locked; if (request.action === "unlock") return { ...locked, unlockedAt: "2026-09-09", content: { fullName: "Sam Ellis", introduction: "I would like help getting started." } }; if (request.action === "messages") return { messages: [], hasMore: false }; return {}; });
    render(<Conversation uid="trainer" id="lead" updated="" onBack={vi.fn()} onChange={vi.fn()} />);
    expect(await screen.findByText("Sam E.")).toBeInTheDocument(); expect(screen.queryByText("Sam Ellis")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Unlock enquiry — free during pilot" }));
    expect(await screen.findByText("I would like help getting started.")).toBeInTheDocument(); expect(screen.queryByText(/checkout/i)).not.toBeInTheDocument();
  });
  it("preserves unsent drafts through remount and retries the same send ID", async () => {
    let fail = true;
    api.mockImplementation(async request => { if (request.action === "detail") return { ...locked, unlockedAt: "2026-09-09", content: { fullName: "Sam Ellis", introduction: "Hello Alex" } }; if (request.action === "messages") return { messages: [], hasMore: false }; if (request.action === "send" && fail) { fail = false; throw new Error("Connection interrupted"); } return {}; });
    const props = { uid: "trainer", id: "lead", updated: "", onBack: vi.fn(), onChange: vi.fn() };
    const view = render(<Conversation {...props} />); await screen.findByLabelText("Your message");
    await userEvent.type(screen.getByLabelText("Your message"), "Hello Sam, let’s talk."); view.unmount();
    render(<Conversation {...props} />); expect(await screen.findByLabelText("Your message")).toHaveValue("Hello Sam, let’s talk.");
    await userEvent.click(screen.getByRole("button", { name: "Send message" })); await screen.findByText(/Connection interrupted/);
    await userEvent.click(screen.getByRole("button", { name: "Send message" })); await waitFor(() => expect(screen.getByLabelText("Your message")).toHaveValue(""));
    const sends = api.mock.calls.map(([request]) => request).filter(request => request.action === "send"); expect(sends).toHaveLength(2); expect(sends[0]).toEqual(sends[1]);
  });
  it("requires disclosure confirmation and sends the trainee-corrected summary", async () => {
    api.mockImplementation(async request => request.action === "prepare" ? { summary, tradeoffs: ["Availability needs confirming."] } : { enquiryId: "lead" });
    render(<EnquiryComposer trainerId="trainer" trainerName="Alex Morgan" onClose={vi.fn()} />);
    await screen.findByLabelText("Goals"); expect(screen.getByRole("button", { name: "Send enquiry" })).toBeDisabled();
    await userEvent.clear(screen.getByLabelText("Goals")); await userEvent.type(screen.getByLabelText("Goals"), "Build strength for hiking");
    await userEvent.type(screen.getByLabelText("Your introduction"), "Hello Alex, I’d like to get started.");
    await userEvent.click(screen.getByRole("checkbox")); await userEvent.click(screen.getByRole("button", { name: "Send enquiry" }));
    expect(await screen.findByRole("link", { name: "Open your inbox" })).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith(expect.objectContaining({ action: "enquire", summary: expect.objectContaining({ goals: "Build strength for hiking" }) }));
  });
  it("keeps public edits on a conflict and presents the newer version for comparison", async () => {
    api.mockImplementation(async request => { if (request.action === "credentialList") return []; if (request.action === "draft") throw Object.assign(new Error("The profile changed in another window."), { code: "functions/aborted" }); if (request.action === "profile") return { ...workspace, version: 4, published: { ...publicDraft, bio: "Newer published bio" } }; return {}; });
    render(<ProfileEditor uid="trainer" trainerId="catalogue" workspace={workspace} onChange={vi.fn()} />);
    await userEvent.clear(screen.getByLabelText("About you")); await userEvent.type(screen.getByLabelText("About you"), "My unsaved bio");
    fireEvent.submit(screen.getByRole("button", { name: "Publish changes" }).closest("form")!);
    expect(await screen.findByText("A newer profile is available")).toBeInTheDocument(); expect(screen.getByLabelText("About you")).toHaveValue("My unsaved bio");
    expect(screen.getByLabelText(/^Availability notes/)).toHaveValue("Other times by arrangement"); expect(screen.getByRole("button", { name: "Monday evening" })).toHaveAttribute("aria-pressed", "true");
  });
});
