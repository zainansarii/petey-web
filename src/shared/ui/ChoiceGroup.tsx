import { useRef, type KeyboardEvent } from "react";
import { Check } from "lucide-react";

type ChoiceGroupProps = {
  options: readonly (readonly [string, string])[];
  value: string | readonly string[] | null;
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  columns?: 2 | 3;
  ariaLabel: string;
};

export function ChoiceGroup({
  options,
  value,
  onChange,
  multiple = false,
  columns = 2,
  ariaLabel,
}: ChoiceGroupProps) {
  const selectedValues = Array.isArray(value) ? value : value ? [value] : [];
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (nextValue: string) => {
    if (!multiple) {
      onChange(nextValue);
      return;
    }

    onChange(
      selectedValues.includes(nextValue)
        ? selectedValues.filter((item) => item !== nextValue)
        : [...selectedValues, nextValue],
    );
  };

  const navigateRadioGroup = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (multiple || !["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Home"].includes(event.key)) return;

    event.preventDefault();
    const lastIndex = options.length - 1;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? lastIndex
        : ["ArrowRight", "ArrowDown"].includes(event.key)
          ? (currentIndex + 1) % options.length
          : (currentIndex - 1 + options.length) % options.length;

    select(options[nextIndex][0]);
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      aria-label={ariaLabel}
      className={`choice-grid choice-grid--${columns}`}
      role={multiple ? "group" : "radiogroup"}
    >
      {options.map(([optionValue, label], index) => {
        const selected = selectedValues.includes(optionValue);
        const isTabStop = multiple || selected || (selectedValues.length === 0 && index === 0);
        return (
          <button
            aria-checked={multiple ? undefined : selected}
            aria-pressed={multiple ? selected : undefined}
            className={`choice-button ${selected ? "choice-button--selected" : ""}`}
            key={optionValue}
            onKeyDown={(event) => navigateRadioGroup(event, index)}
            onClick={() => select(optionValue)}
            ref={(element) => { optionRefs.current[index] = element; }}
            role={multiple ? undefined : "radio"}
            tabIndex={isTabStop ? 0 : -1}
            type="button"
          >
            <span>{label}</span>
            <span aria-hidden="true" className="choice-button__mark">
              {selected ? <Check size={16} strokeWidth={3} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
