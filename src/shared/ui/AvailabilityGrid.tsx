import { Check } from "lucide-react";
import {
  DAYS,
  PERIODS,
  type AvailabilitySlot,
} from "../../features/onboarding/model/onboarding";

export function AvailabilityGrid({
  value,
  onChange,
}: {
  value: AvailabilitySlot[];
  onChange: (value: AvailabilitySlot[]) => void;
}) {
  const toggle = (slot: AvailabilitySlot) => {
    onChange(value.includes(slot) ? value.filter((item) => item !== slot) : [...value, slot]);
  };

  return (
    <div className="availability" role="group" aria-label="Weekly availability">
      <div aria-hidden="true" className="availability__corner" />
      {PERIODS.map((period) => (
        <div className="availability__period" key={period}>{period}</div>
      ))}
      {DAYS.map((day) => (
        <div className="availability__row" key={day}>
          <div className="availability__day">{day}</div>
          {PERIODS.map((period) => {
            const slot = `${day}-${period}` as AvailabilitySlot;
            const selected = value.includes(slot);
            return (
              <button
                aria-label={`${day} ${period}`}
                aria-pressed={selected}
                className={`availability__slot ${selected ? "availability__slot--selected" : ""}`}
                key={slot}
                onClick={() => toggle(slot)}
                type="button"
              >
                {selected ? <Check aria-hidden="true" size={16} strokeWidth={3} /> : <span />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
