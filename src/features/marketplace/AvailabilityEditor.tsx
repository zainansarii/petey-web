import { Check } from "lucide-react";
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const periods = ["morning", "afternoon", "evening"];
function splitAvailability(values: string[]) {
  const slots = new Set<string>(); const notes: string[] = [];
  for (const value of values) {
    const match = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) (morning|afternoon|evening)s?$/i.exec(value.trim());
    if (match) slots.add(`${days.find(day => day.toLowerCase() === match[1].toLowerCase())} ${match[2].toLowerCase()}`);
    else notes.push(value);
  }
  return { slots, notes };
}
export function AvailabilityEditor({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const { slots, notes } = splitAvailability(value);
  return <div className="mp-availability"><h3>Typical weekly availability</h3><p className="mp-muted">Select broad times for matching. Arrange exact session times in your conversations.</p><div className="mp-week"><span>Day</span>{periods.map(period => <span key={period}>{period[0].toUpperCase() + period.slice(1)}</span>)}{days.map(day => <div className="mp-week-row" key={day}><span>{day.slice(0,3)}</span>{periods.map(period => { const label = `${day} ${period}`; return <button key={label} type="button" aria-label={label} aria-pressed={slots.has(label)} onClick={() => { const next = new Set(slots); if (next.has(label)) next.delete(label); else next.add(label); onChange([...next, ...notes]); }}>{slots.has(label) ? <Check size={16} /> : <span aria-hidden="true">–</span>}</button>; })}</div>)}</div><label>Availability notes<textarea rows={3} value={notes.join("\n")} onChange={event => onChange([...slots, ...event.target.value.split("\n")])} /><small>Your original free-form notes are preserved here. Keep them consistent with the selected times.</small></label></div>;
}
