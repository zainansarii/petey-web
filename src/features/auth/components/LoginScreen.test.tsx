import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { requestMagicLink } from "../api/magicLink";
import { LoginScreen } from "./LoginScreen";

vi.mock("../api/magicLink", () => ({
  requestMagicLink: vi.fn(),
}));

describe("LoginScreen", () => {
  beforeEach(() => {
    vi.mocked(requestMagicLink).mockReset();
  });

  it("validates the email before requesting a login link", () => {
    render(<LoginScreen onBack={vi.fn()} onLinkRequested={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: /email address/i }), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: /email me a login link/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
    expect(requestMagicLink).not.toHaveBeenCalled();
  });

  it("requests a link with the normalized email", async () => {
    const onLinkRequested = vi.fn();
    vi.mocked(requestMagicLink).mockResolvedValue("sent");
    render(<LoginScreen onBack={vi.fn()} onLinkRequested={onLinkRequested} />);

    fireEvent.change(screen.getByRole("textbox", { name: /email address/i }), { target: { value: " Member@Example.COM " } });
    fireEvent.click(screen.getByRole("button", { name: /email me a login link/i }));

    await waitFor(() => expect(requestMagicLink).toHaveBeenCalledWith("member@example.com"));
    expect(onLinkRequested).toHaveBeenCalledWith("member@example.com", "sent");
  });
});
