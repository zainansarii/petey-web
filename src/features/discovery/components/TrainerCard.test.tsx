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

  it("renders a real trainer preview without a demo label or invented availability", () => {
    render(<TrainerCard trainer={{
      id: "real-trainer", name: "Alex Smith", photo: "/alex.jpg", specialty: "Strength",
      area: "Battersea", price: 70, isDemo: false,
    }} />);

    expect(screen.getByRole("article", { name: "Alex Smith, trainer profile, Strength" })).toBeInTheDocument();
    expect(screen.queryByText("Demo profile")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Example availability")).not.toBeInTheDocument();
    expect(screen.getByText("Battersea")).toBeInTheDocument();
  });

  it("keeps the full name on shortlist cards outside the home carousel", () => {
    render(<TrainerCard trainer={aliyah} variant="feed" />);

    expect(screen.getByRole("heading", { name: /^Aliyah Rahman$/ })).toBeInTheDocument();
  });
});
