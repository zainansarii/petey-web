import { act, fireEvent, render, screen } from "@testing-library/react";
import { requestMagicLink } from "../api/magicLink";
import { CheckEmailScreen } from "./CheckEmailScreen";

vi.mock("../api/magicLink", () => ({
  requestMagicLink: vi.fn(),
}));

describe("CheckEmailScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(requestMagicLink).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the simplified email confirmation composition", () => {
    const onBack = vi.fn();

    const { container } = render(
      <CheckEmailScreen
        email="trainee@example.com"
        onBack={onBack}
        onPreviewFeed={vi.fn()}
        preview={false}
      />,
    );

    const header = container.querySelector(".check-email__header");
    expect(header?.firstElementChild).toHaveClass("flow-header__logo");
    expect(header?.lastElementChild).toHaveClass("check-email__back");
    expect(container.querySelectorAll(".mail-mark")).toHaveLength(1);
    expect(container.querySelector(".mail-mark")?.children).toHaveLength(1);
    expect(screen.queryByText(/one link\. no password/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back to your details/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("allows only one resend while a request is in flight", async () => {
    let finishResend!: (result: "sent") => void;
    vi.mocked(requestMagicLink).mockReturnValue(new Promise((resolve) => {
      finishResend = resolve;
    }));

    render(
      <CheckEmailScreen
        email="trainee@example.com"
        onBack={vi.fn()}
        onPreviewFeed={vi.fn()}
        preview={false}
      />,
    );

    act(() => vi.advanceTimersByTime(30_000));
    const resend = screen.getByRole("button", { name: /resend link/i });

    fireEvent.click(resend);
    fireEvent.click(resend);

    expect(requestMagicLink).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();

    await act(async () => finishResend("sent"));
    expect(screen.getByText(/fresh link is on its way/i)).toBeInTheDocument();
  });

  it("uses login-specific email copy for returning members", () => {
    render(
      <CheckEmailScreen
        email="member@example.com"
        onBack={vi.fn()}
        onPreviewFeed={vi.fn()}
        preview={false}
        purpose="login"
      />,
    );

    expect(screen.getByText(/secure login link/i)).toBeInTheDocument();
    expect(screen.getByText(/open it on this device to sign in/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to login/i })).toBeInTheDocument();
  });
});
