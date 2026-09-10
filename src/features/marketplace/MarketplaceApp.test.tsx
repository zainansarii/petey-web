import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketplaceApp } from "./MarketplaceApp";
import { marketplace } from "./api";
import type { Access, InboxItem } from "./model";

vi.mock("./AccessGate", () => ({
  AccessGate: ({ children }: { children: (access: Access) => ReactNode }) => children({
    uid: "trainee", email: "trainee@example.com", membership: null,
    pilotEnabled: false, preferences: { enquiries: false, messages: true },
  }),
}));
vi.mock("./api", async original => ({
  ...await original<typeof import("./api")>(),
  marketplace: vi.fn(),
  watchInbox: vi.fn(async () => () => {}),
  watchMessages: vi.fn(async () => () => {}),
}));

const api = vi.mocked(marketplace);
const enquiry: InboxItem = {
  id: "a".repeat(64), trainerId: "trainer", trainerName: "Alex Morgan", traineeLabel: "Sam E.",
  createdAt: "2026-09-09T12:00:00Z", latestAt: "2026-09-09T12:00:00Z",
  summary: { goals: "Build strength", area: "North London", settings: "Online", budget: "£70", availability: "Weekdays", frequency: "Twice weekly", goalCategory: "Strength" },
  unlockedAt: null, firstReplyAt: null, withdrawnAt: null, blocked: false,
  unreadCount: 0, lastSeq: 0, readSeq: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  history.replaceState(null, "", "/petey-web/messages/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  api.mockImplementation(async request => {
    if (request.action === "inbox") return { items: [enquiry], nextCursor: null };
    if (request.action === "detail") return { ...enquiry, role: "trainee", tradeoffs: [], content: null, tracking: null };
    return {};
  });
});
afterEach(() => vi.restoreAllMocks());

describe("trainee inbox", () => {
  it("shows trainee statuses and navigation without trainer pilot or lead-management copy", async () => {
    render(<MarketplaceApp trainer={false} />);
    expect(await screen.findByRole("button", { name: /Alex Morgan.*Waiting for trainer/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Your inbox" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your trainer matches" })).toHaveAttribute("href", import.meta.env.BASE_URL);
    expect(screen.queryByText(/Free trainer pilot|New enquiries are paused/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Enquiry status")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Search enquiries")).not.toBeInTheDocument();
    expect(api.mock.calls.some(([request]) => ["dashboard", "profile"].includes(request.action))).toBe(false);
  });

  it("keeps the list minimal and saves email preferences when expanded", async () => {
    render(<MarketplaceApp trainer={false} />);
    await screen.findByRole("button", { name: /Alex Morgan/ });
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByText("North London")).not.toBeInTheDocument();
    expect(screen.queryByText("1 conversation")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeVisible();
    fireEvent.click(screen.getByText("Email preferences"));
    fireEvent.click(screen.getByRole("checkbox", { name: "Unread message emails" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith({ action: "preferences", preferences: { enquiries: false, messages: false } }));
  });

  it("shows the latest message and activity date with an accessible unread count", async () => {
    api.mockResolvedValue({ items: [{ ...enquiry, unlockedAt: enquiry.createdAt, latestAt: "2026-09-10T10:24:00Z", latestMessage: "Thanks for your message! I’m free next week.", unreadCount: 2 }], nextCursor: null });
    render(<MarketplaceApp trainer={false} />);
    const row = await screen.findByRole("button", { name: /Alex Morgan.*Thanks for your message.*2 unread messages/ });
    expect(row.querySelector("time")).toHaveAttribute("dateTime", "2026-09-10T10:24:00Z");
    expect(row).not.toHaveTextContent(enquiry.summary.goals);
    fireEvent.click(row);
    await waitFor(() => expect(location.hash).toBe(`#${enquiry.id}`));
  });

  it("provides a route back to matches for an empty inbox", async () => {
    api.mockResolvedValue({ items: [], nextCursor: null });
    render(<MarketplaceApp trainer={false} />);
    expect(await screen.findByRole("heading", { name: "No conversations yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View my trainer matches" })).toHaveAttribute("href", import.meta.env.BASE_URL);
  });

  it("shows a retryable error instead of claiming a failed inbox is empty", async () => {
    api.mockRejectedValueOnce(new Error("Could not load conversations"));
    render(<MarketplaceApp trainer={false} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load conversations");
    expect(screen.queryByText("No conversations yet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: /Alex Morgan/ })).toBeInTheDocument();
  });

  it("opens a linked conversation, keeps trainer actions private, and returns to the inbox", async () => {
    history.replaceState(null, "", `/petey-web/messages/#${enquiry.id}`);
    render(<MarketplaceApp trainer={false} />);
    expect(await screen.findByRole("heading", { name: "Your enquiry has been sent" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Unlock enquiry/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Private notes")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Your message")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to inbox" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Alex Morgan.*Waiting for trainer/ })).toBeInTheDocument());
  });
});
