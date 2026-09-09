import { useId } from "react";
import { CalendarDays } from "lucide-react";
import "./trainer-availability.css";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PERIODS = [
  { key: "morning", label: "Morning", hours: "6am–12pm" },
  { key: "afternoon", label: "Afternoon", hours: "12pm–6pm" },
  { key: "evening", label: "Evening", hours: "6pm–12am" },
] as const;

// Catalog availability is a list of labels, not bookable appointments. Only
// expand known labels; keep any more specific schedule notes visible as text.
function readSchedule(availability: string[]) {
  const slots = new Map<string, string[]>();
  const notes: string[] = [];
  for (const label of availability) {
    const match = /^(weekday|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\s+(morning|afternoon|evening|lunchtime)s?$/i.exec(label.trim());
    if (!match) {
      notes.push(label);
      continue;
    }
    const dayGroup = match[1]!.toLowerCase();
    const period = match[2]!.toLowerCase();
    const days = dayGroup === "weekday" ? DAYS.slice(0, 5)
      : dayGroup === "weekend" ? DAYS.slice(5)
        : DAYS.filter((day) => day.toLowerCase() === dayGroup);
    for (const day of days) {
      const key = `${day}-${period === "lunchtime" ? "afternoon" : period}`;
      slots.set(key, [...(slots.get(key) ?? []), label]);
    }
  }
  return { slots, notes };
}

export function TrainerAvailability({ availability }: { availability: string[] }) {
  const headingId = useId();
  const { slots, notes } = readSchedule(availability);

  return (
    <section aria-labelledby={headingId} className="trainer-availability">
      <h3 id={headingId}><CalendarDays aria-hidden="true" size={17} />Availability</h3>
      {slots.size > 0 ? <table className="trainer-availability__table">
        <caption className="sr-only">Weekly availability</caption>
        <colgroup><col className="trainer-availability__day-column" /><col span={3} /></colgroup>
        <thead>
          <tr>
            <td><span className="sr-only">Day</span></td>
            {PERIODS.map((period) => (
              <th key={period.key} scope="col">
                {period.label}<span className="trainer-availability__hours">{period.hours}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((day) => (
            <tr key={day}>
              <th scope="row" aria-label={day}>
                <span className="trainer-availability__day-full" aria-hidden="true">{day}</span>
                <span className="trainer-availability__day-short" aria-hidden="true">{day.slice(0, 3)}</span>
              </th>
              {PERIODS.map((period) => {
                const labels = slots.get(`${day}-${period.key}`);
                return (
                  <td key={period.key}>
                    <span
                      className={`trainer-availability__slot${labels ? " trainer-availability__slot--available" : ""}`}
                      title={labels?.join(" · ") ?? "No availability listed"}
                    >
                      <span className="sr-only">{labels ? `Usually available: ${labels.join("; ")}` : "No availability listed"}</span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table> : null}
      {slots.size > 0 ? (
        <p className="trainer-availability__legend"><span aria-hidden="true" />Usually available</p>
      ) : null}
      {notes.length > 0 ? <p className="trainer-availability__note">{notes.join(" · ")}</p> : null}
      {availability.length === 0 ? <p className="trainer-availability__note">Availability to be confirmed.</p> : null}
    </section>
  );
}
