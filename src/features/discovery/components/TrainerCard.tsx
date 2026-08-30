import { ArrowUpRight, BadgeCheck, MapPin, MessageCircle, Target } from "lucide-react";
import { trainerCardName, type Trainer } from "../data/trainers";

type TrainerCardProps = {
  trainer: Trainer;
  variant?: "hero" | "feed";
  decorative?: boolean;
  matchReason?: string;
  onView?: (trigger: HTMLButtonElement) => void;
  onRequest?: (trigger: HTMLButtonElement) => void;
};

export function TrainerCard({
  trainer,
  variant = "hero",
  decorative = false,
  matchReason,
  onView,
  onRequest,
}: TrainerCardProps) {
  const isFeed = variant === "feed";
  const cardName = isFeed ? trainer.name : trainerCardName(trainer);

  if (decorative) {
    return (
      <div aria-hidden="true" className={`trainer-card trainer-card--${variant}`}>
        <img alt="" className="trainer-card__photo" src={trainer.photo} />
        <div className="trainer-card__shade" />
      </div>
    );
  }

  return (
    <article className={`trainer-card trainer-card--${variant}`} aria-label={`${trainer.name}, demo trainer profile, ${trainer.specialty}`}>
      <img className="trainer-card__photo" src={trainer.photo} alt={`Demo portrait for ${trainer.name}'s trainer profile`} />
      <div className="trainer-card__shade" />

      <div className="trainer-card__topline">
        <span className="trainer-card__verified">
          <BadgeCheck aria-hidden="true" size={16} strokeWidth={2.5} />
          Demo profile
        </span>
        {isFeed && matchReason ? <span className="trainer-card__match">{matchReason}</span> : null}
      </div>

      <div className="trainer-card__content">
        <div className="trainer-card__name-row">
          <h2>{cardName}</h2>
          <span aria-label="Example availability" className="trainer-card__status">
            <span />
          </span>
        </div>

        <div className="trainer-card__facts">
          <span><Target aria-hidden="true" size={14} />{trainer.specialty}</span>
          <span><MapPin aria-hidden="true" size={14} />{isFeed ? `${trainer.distanceMiles} mi` : trainer.area}</span>
          <span>From £{trainer.price}</span>
        </div>

        {isFeed ? (
          <div className="trainer-card__actions">
            <button className="trainer-card__secondary" onClick={(event) => onView?.(event.currentTarget)} type="button">
              View profile <ArrowUpRight aria-hidden="true" size={18} />
            </button>
            <button
              className="trainer-card__primary"
              onClick={(event) => onRequest?.(event.currentTarget)}
              type="button"
            >
              <MessageCircle aria-hidden="true" size={17} />
              Preview intro
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
