import { BadgeCheck, MapPin, Target } from "lucide-react";
import { trainerCardName, type TrainerCardPreview } from "../model/trainer";

type TrainerCardProps = {
  trainer: TrainerCardPreview;
  variant?: "hero" | "feed";
  decorative?: boolean;
  matchReason?: string;
};

export function TrainerCard({
  trainer,
  variant = "hero",
  decorative = false,
  matchReason,
}: TrainerCardProps) {
  const isFeed = variant === "feed";
  const isDemo = trainer.isDemo === true;
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
    <article className={`trainer-card trainer-card--${variant}`} aria-label={`${trainer.name}, ${isDemo ? "demo " : ""}trainer profile, ${trainer.specialty}`}>
      <img className="trainer-card__photo" src={trainer.photo} alt={`${isDemo ? "Demo portrait for" : "Portrait of"} ${trainer.name}'s trainer profile`} />
      <div className="trainer-card__shade" />

      <div className="trainer-card__topline">
        <span className="trainer-card__verified">
          <BadgeCheck aria-hidden="true" size={16} strokeWidth={2.5} />
          {isDemo ? "Demo profile" : "Trainer profile"}
        </span>
        {isFeed && matchReason ? <span className="trainer-card__match">{matchReason}</span> : null}
      </div>

      <div className="trainer-card__content">
        <div className="trainer-card__name-row">
          <h2>{cardName}</h2>
          {isDemo ? <span aria-label="Example availability" className="trainer-card__status"><span /></span> : null}
        </div>

        <div className="trainer-card__facts">
          <div className="trainer-card__facts-row">
            <span><Target aria-hidden="true" size={14} />{trainer.specialty}</span>
          </div>
          <div className="trainer-card__facts-row">
            <span><MapPin aria-hidden="true" size={14} />{trainer.area}</span>
            <span>From £{trainer.price}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
