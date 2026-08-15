import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { ChoiceGroup } from "./ChoiceGroup";

const OPTIONS = [
  ["gentle", "Gentle encouragement"],
  ["technical", "Technical coaching"],
  ["fun", "Fun"],
] as const;

function RadioHarness() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <ChoiceGroup
      ariaLabel="Coaching style"
      onChange={(next) => setValue(next as string)}
      options={OPTIONS}
      value={value}
    />
  );
}

describe("ChoiceGroup", () => {
  it("uses arrow keys to move and select within a radio group", () => {
    render(<RadioHarness />);
    const first = screen.getByRole("radio", { name: "Gentle encouragement" });
    const second = screen.getByRole("radio", { name: "Technical coaching" });

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });

    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("aria-checked", "true");
    expect(first).toHaveAttribute("tabindex", "-1");
  });
});
