import aliyahPhoto from "../../../assets/trainers/aliyah-rahman.webp";
import marcusPhoto from "../../../assets/trainers/marcus-adebayo.webp";
import mayaPhoto from "../../../assets/trainers/maya-chen.webp";
import rohanPhoto from "../../../assets/trainers/rohan-kapoor.webp";
import {
  GENDER_OPTIONS,
  type MatchingAnswers,
} from "../../onboarding/model/onboarding";

type Goal = NonNullable<MatchingAnswers["goal"]>;
type CoachingPreference = NonNullable<MatchingAnswers["coachingStyle"]>;
type Experience = NonNullable<MatchingAnswers["experience"]>;
type Budget = NonNullable<MatchingAnswers["budget"]>;
type TrainerGender = MatchingAnswers["trainerGenders"][number];
type Venue = MatchingAnswers["venues"][number];
type AvailabilitySlot = MatchingAnswers["availability"][number];
type AvailabilityDay = AvailabilitySlot extends `${infer Day}-${string}` ? Day : never;
type AvailabilityPeriod = AvailabilitySlot extends `${string}-${infer Period}` ? Period : never;

type TrainerCoachingStyle =
  | "calm"
  | "encouraging"
  | "friendly"
  | "educational"
  | "high_energy"
  | "data_driven"
  | "strict_accountability";

export type Trainer = {
  id: string;
  name: string;
  photo: string;
  specialty: string;
  specialties: string[];
  area: string;
  price: number;
  tenPackPrice: number;
  monthlyPrice: number;
  distanceMiles: number;
  gender: TrainerGender;
  coachingStyles: string[];
  coachingStyleCodes: TrainerCoachingStyle[];
  venues: string[];
  venueTypes: Venue[];
  experienceLevels: Experience[];
  qualifications: string[];
  availability: string[];
  availabilitySlots: AvailabilitySlot[];
  bio: string;
  bestFor: Goal[];
};

export const trainerCardName = (trainer: Pick<Trainer, "name">) => (
  trainer.name.trim().split(/\s+/)[0] || trainer.name
);

const weeklySlots = (
  days: AvailabilityDay[],
  periods: AvailabilityPeriod[],
): AvailabilitySlot[] => days.flatMap(
  (day) => periods.map((period) => `${day}-${period}` as AvailabilitySlot),
);

export const TRAINERS: Trainer[] = [
  {
    id: "maya-chen",
    name: "Maya Chen",
    photo: mayaPhoto,
    specialty: "Running & endurance",
    specialties: ["General fitness", "Mobility", "Fat loss", "Functional fitness"],
    area: "Battersea · SW11",
    price: 70,
    tenPackPrice: 630,
    monthlyPrice: 360,
    distanceMiles: 2.4,
    gender: "woman",
    coachingStyles: ["Encouraging", "Friendly", "Educational"],
    coachingStyleCodes: ["encouraging", "friendly", "educational"],
    venues: ["Outdoors", "Your home", "Private studio", "Remote"],
    venueTypes: ["outdoors", "client_home", "private_studio", "remote"],
    experienceLevels: ["never_trained", "beginner", "intermediate"],
    qualifications: [
      "Level 3 Personal Training",
      "Leader in Running Fitness",
      "Emergency First Aid at Work",
    ],
    availability: ["Weekday mornings", "Weekday evenings", "Weekend mornings"],
    availabilitySlots: [
      ...weeklySlots(["Mon", "Tue", "Wed", "Thu", "Fri"], ["Morning", "Evening"]),
      ...weeklySlots(["Sat", "Sun"], ["Morning"]),
    ],
    bio: "Maya makes movement feel achievable. Her sessions blend practical strength, running confidence and steady encouragement for people building a routine that lasts.",
    bestFor: ["lose_weight", "prepare_for_event", "recover_from_injury", "improve_fitness"],
  },
  {
    id: "marcus-adebayo",
    name: "Marcus Adebayo",
    photo: marcusPhoto,
    specialty: "Strength",
    specialties: ["Muscle building", "Powerlifting", "Body recomposition", "Functional fitness"],
    area: "Shoreditch · E1",
    price: 80,
    tenPackPrice: 720,
    monthlyPrice: 480,
    distanceMiles: 3.2,
    gender: "man",
    coachingStyles: ["Data-driven", "Accountable", "Educational"],
    coachingStyleCodes: ["data_driven", "strict_accountability", "educational"],
    venues: ["Commercial gym", "Private studio", "Your office", "Remote"],
    venueTypes: ["commercial_gym", "private_studio", "office_gym", "remote"],
    experienceLevels: ["intermediate", "advanced"],
    qualifications: [
      "Level 3 Personal Training",
      "Level 4 Strength & Conditioning",
      "Emergency First Aid at Work",
    ],
    availability: ["Weekday lunchtimes", "Weekday evenings", "Weekend lunchtimes"],
    availabilitySlots: [
      ...weeklySlots(["Mon", "Tue", "Wed", "Thu", "Fri"], ["Lunch", "Evening"]),
      ...weeklySlots(["Sat", "Sun"], ["Lunch"]),
    ],
    bio: "Marcus combines clear technique with measurable progress. Expect focused sessions, honest feedback and a plan that makes every hour in the gym count.",
    bestFor: ["build_muscle", "something_else", "improve_fitness"],
  },
  {
    id: "aliyah-rahman",
    name: "Aliyah Rahman",
    photo: aliyahPhoto,
    specialty: "Pilates",
    specialties: ["Mobility", "Body recomposition", "General fitness", "Functional fitness"],
    area: "Islington · N1",
    price: 65,
    tenPackPrice: 590,
    monthlyPrice: 340,
    distanceMiles: 4.1,
    gender: "woman",
    coachingStyles: ["Calm", "Friendly", "Educational"],
    coachingStyleCodes: ["calm", "friendly", "educational"],
    venues: ["Commercial gym", "Outdoors", "Your home", "Your office", "Private studio", "Remote"],
    venueTypes: ["commercial_gym", "outdoors", "client_home", "office_gym", "private_studio", "remote"],
    experienceLevels: ["never_trained", "beginner", "intermediate"],
    qualifications: [
      "Level 3 Personal Training",
      "Level 3 Mat Pilates",
      "Emergency First Aid at Work",
    ],
    availability: [
      "Weekday mornings",
      "Weekday lunchtimes",
      "Weekday evenings",
      "Weekend mornings",
      "Weekend lunchtimes",
    ],
    availabilitySlots: [
      "Mon-Morning",
      "Mon-Lunch",
      "Tue-Evening",
      "Wed-Morning",
      "Wed-Lunch",
      "Thu-Evening",
      "Fri-Morning",
      "Sat-Morning",
      "Sat-Lunch",
      "Sun-Morning",
    ],
    bio: "Aliyah brings calm, precise coaching to Pilates-led strength and mobility. Her sessions build confidence, control and everyday ease from wherever you are starting.",
    bestFor: ["lose_weight", "recover_from_injury", "improve_fitness"],
  },
  {
    id: "rohan-kapoor",
    name: "Rohan Kapoor",
    photo: rohanPhoto,
    specialty: "Boxing & combat fitness",
    specialties: ["HIIT", "Strength", "Body recomposition", "General fitness"],
    area: "Bethnal Green · E2",
    price: 75,
    tenPackPrice: 680,
    monthlyPrice: 420,
    distanceMiles: 3.8,
    gender: "man",
    coachingStyles: ["High-energy", "Accountable", "Educational"],
    coachingStyleCodes: ["high_energy", "strict_accountability", "educational"],
    venues: ["Commercial gym", "Outdoors", "Your home", "Your office", "Private studio", "Remote"],
    venueTypes: ["commercial_gym", "outdoors", "client_home", "office_gym", "private_studio", "remote"],
    experienceLevels: ["intermediate", "advanced"],
    qualifications: [
      "Level 3 Personal Training",
      "Level 2 Boxing Coach",
      "Emergency First Aid at Work",
    ],
    availability: ["Weekday mornings", "Weekday lunchtimes", "Weekday evenings", "Weekend mornings"],
    availabilitySlots: [
      "Mon-Morning",
      "Mon-Evening",
      "Tue-Lunch",
      "Tue-Evening",
      "Wed-Evening",
      "Thu-Morning",
      "Thu-Lunch",
      "Fri-Evening",
      "Sat-Morning",
    ],
    bio: "Rohan blends boxing technique, conditioning and focused accountability. His high-energy sessions turn hard work into clear progress without losing sight of good form.",
    bestFor: ["lose_weight", "build_muscle", "prepare_for_event", "improve_fitness"],
  },
];

const STYLE_COMPATIBILITY: Record<CoachingPreference, TrainerCoachingStyle[]> = {
  gentle_encouragement: ["calm", "encouraging", "friendly"],
  lots_of_accountability: ["strict_accountability", "data_driven"],
  tough_love: ["strict_accountability", "high_energy"],
  technical_coaching: ["educational", "data_driven"],
  fun: ["friendly", "encouraging", "high_energy"],
  data_and_metrics: ["data_driven"],
};

const STYLE_REASON_LABELS: Record<TrainerCoachingStyle, string> = {
  calm: "Calm coaching",
  encouraging: "Encouraging coaching",
  friendly: "Friendly energy",
  educational: "Educational coaching",
  high_energy: "High-energy coaching",
  data_driven: "Data-driven coaching",
  strict_accountability: "Strong accountability",
};

const VENUE_REASON_LABELS: Record<Venue, string> = {
  remote: "Remote training",
  client_home: "Home sessions",
  office_gym: "Office sessions",
  outdoors: "Outdoor training",
  private_studio: "Private studio",
  commercial_gym: "Gym sessions",
};

const BUDGET_RANGES: Record<Budget, readonly [number, number] | null> = {
  gbp_250_400: [250, 400],
  gbp_400_600: [400, 600],
  gbp_600_900: [600, 900],
  gbp_900_plus: [900, Number.POSITIVE_INFINITY],
  not_sure_yet: null,
};

const matchingTrainerStyle = (trainer: Trainer, answers: MatchingAnswers) => {
  if (!answers.coachingStyle) return null;
  const compatibleStyles = STYLE_COMPATIBILITY[answers.coachingStyle];
  return trainer.coachingStyleCodes.find((style) => compatibleStyles.includes(style)) ?? null;
};

const budgetFit = (trainer: Trainer, answers: MatchingAnswers) => {
  if (!answers.budget) return "unknown" as const;
  const range = BUDGET_RANGES[answers.budget];
  if (!range) return "unknown" as const;
  if (trainer.monthlyPrice >= range[0] && trainer.monthlyPrice <= range[1]) return "exact" as const;
  if (trainer.monthlyPrice < range[0]) return "below" as const;
  return "over" as const;
};

const hasGenderPreference = (answers: MatchingAnswers) => (
  answers.trainerGenders.length > 0
  && answers.trainerGenders.length < GENDER_OPTIONS.length
);

const matchingVenue = (trainer: Trainer, answers: MatchingAnswers) => (
  answers.venues.find((venue) => trainer.venueTypes.includes(venue)) ?? null
);

const isWithinTravelRange = (trainer: Trainer, answers: MatchingAnswers) => (
  Boolean(answers.postcode.trim())
  && trainer.distanceMiles * 1.609344 <= answers.travelKm
);

const hasAvailabilityOverlap = (trainer: Trainer, answers: MatchingAnswers) => (
  answers.availability.some((slot) => trainer.availabilitySlots.includes(slot))
);

const compatibilityScore = (trainer: Trainer, answers: MatchingAnswers) => {
  let score = 0;

  if (answers.goal && trainer.bestFor.includes(answers.goal)) score += 6;
  if (matchingTrainerStyle(trainer, answers)) score += 4;

  const trainerBudgetFit = budgetFit(trainer, answers);
  if (trainerBudgetFit === "exact") score += 3;
  else if (trainerBudgetFit === "below") score += 2;
  else if (trainerBudgetFit === "over") score -= 3;

  if (hasGenderPreference(answers)) {
    score += answers.trainerGenders.includes(trainer.gender) ? 6 : -6;
  }

  if (answers.venues.length > 0) {
    score += matchingVenue(trainer, answers) ? 4 : -4;
  }

  if (answers.postcode.trim()) {
    score += isWithinTravelRange(trainer, answers) ? 3 : -3;
  }

  if (answers.experience) {
    score += trainer.experienceLevels.includes(answers.experience) ? 2 : -2;
  }

  if (answers.availability.length > 0) {
    score += hasAvailabilityOverlap(trainer, answers) ? 4 : -4;
  }

  return score;
};

export const orderTrainersFor = (answers: MatchingAnswers) => (
  TRAINERS
    .map((trainer, originalIndex) => ({
      originalIndex,
      score: compatibilityScore(trainer, answers),
      trainer,
    }))
    .sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex)
    .map(({ trainer }) => trainer)
);

export const matchReasonFor = (trainer: Trainer, answers: MatchingAnswers) => {
  const reasons: string[] = [];
  if (answers.goal && trainer.bestFor.includes(answers.goal)) reasons.push("Goal fit");

  const style = matchingTrainerStyle(trainer, answers);
  if (style) reasons.push(STYLE_REASON_LABELS[style]);

  const trainerBudgetFit = budgetFit(trainer, answers);
  if (trainerBudgetFit === "exact" || trainerBudgetFit === "below") reasons.push("Within budget");

  const venue = matchingVenue(trainer, answers);
  if (venue) reasons.push(VENUE_REASON_LABELS[venue]);

  if (isWithinTravelRange(trainer, answers)) reasons.push(`${trainer.distanceMiles} mi away`);
  if (answers.experience && trainer.experienceLevels.includes(answers.experience)) {
    reasons.push("Fits your experience");
  }
  if (hasAvailabilityOverlap(trainer, answers)) reasons.push("Schedule overlap");

  if (reasons.length > 0) return reasons.slice(0, 2).join(" + ");
  return `${trainer.specialty} near ${trainer.area.split(" · ")[0]}`;
};
