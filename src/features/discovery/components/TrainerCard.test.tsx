import { render, screen } from "@testing-library/react";
import { TRAINERS } from "../data/trainers";
import { TrainerCard } from "./TrainerCard";

const aliyah = TRAINERS.find(({ id }) => id === "aliyah-rahman")!;

describe("TrainerCard", () => {
  it("uses a first name visually while preserving the full accessible identity", () => {
    render(<TrainerCard trainer={aliyah} />);

    expect(screen.getByRole("heading", { name: /^Aliyah$/ })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: /Aliyah Rahman, demo trainer profile/i })).toBeInTheDocument();
    expect(screen.getByAltText(/Demo portrait for Aliyah Rahman's trainer profile/i)).toBeInTheDocument();
  });

  it("keeps the full name on shortlist cards outside the home carousel", () => {
    render(<TrainerCard trainer={aliyah} variant="feed" />);

    expect(screen.getByRole("heading", { name: /^Aliyah Rahman$/ })).toBeInTheDocument();
  });
});
