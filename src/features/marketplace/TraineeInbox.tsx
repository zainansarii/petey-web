import { ArrowRight, Clock3, MessageCircle, Minus } from "lucide-react";
import type { InboxItem } from "./model";

function dateLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
}

export function TraineeInbox({ items, onSelect }: { items: InboxItem[]; onSelect: (id: string) => void }) {
  if (!items.length) return <div className="mp-empty">
    <MessageCircle aria-hidden="true" size={28} />
    <h3>No conversations yet</h3>
    <p>Contact a trainer to start a conversation.</p>
    <a className="td-button mp-matches-link" href={import.meta.env.BASE_URL}>View my trainer matches <ArrowRight aria-hidden="true" size={15} /></a>
  </div>;

  return <ul className="mp-trainee-inbox" aria-label="Conversations">{items.map(item => {
    const stopped = item.withdrawnAt || item.blocked;
    const state = stopped ? "muted" : item.unreadCount > 0 ? "unread" : !item.unlockedAt ? "waiting" : "open";
    const status = item.withdrawnAt ? "Enquiry withdrawn" : item.blocked ? "Conversation blocked"
      : item.unreadCount > 0 ? `${item.unreadCount} unread ${item.unreadCount === 1 ? "message" : "messages"}`
      : !item.unlockedAt ? "Waiting for trainer" : "Conversation open";
    const preview = stopped ? status : (item.unlockedAt && item.latestMessage) || item.summary.goals;
    return <li key={item.id}>
      <button className={`mp-inbox-row mp-inbox-row--${state}`} onClick={() => onSelect(item.id)}>
        <span className="mp-inbox-avatar" aria-hidden="true">
          <span className="mp-initials">{item.trainerName.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("")}</span>
          <span className="mp-inbox-dot">{state === "waiting" ? <Clock3 size={12} /> : state === "muted" ? <Minus size={12} /> : null}</span>
        </span>
        <span className="mp-inbox-person"><strong>{item.trainerName}</strong><span>{preview}</span></span>
        {!stopped && <span className="sr-only">{status}.</span>}
        <time dateTime={item.latestAt} title={new Date(item.latestAt).toLocaleString("en-GB")}>{dateLabel(item.latestAt)}</time>
        <ArrowRight className="mp-inbox-arrow" aria-hidden="true" size={20} />
      </button>
    </li>;
  })}</ul>;
}
