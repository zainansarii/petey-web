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
});
