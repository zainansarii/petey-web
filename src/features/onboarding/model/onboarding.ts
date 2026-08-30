export const GOAL_OPTIONS = [
  ["lose_weight", "Lose weight"],
  ["build_muscle", "Build muscle"],
  ["prepare_for_event", "Prepare for an event"],
  ["recover_from_injury", "Recover from injury"],
  ["improve_fitness", "Improve fitness"],
  ["something_else", "Something else"],
] as const;

export const EXPERIENCE_OPTIONS = [
  ["never_trained", "Never trained before"],
  ["beginner", "Beginner"],
  ["intermediate", "Intermediate"],
  ["advanced", "Advanced"],
] as const;

export const COACHING_OPTIONS = [
  ["gentle_encouragement", "Gentle encouragement"],
  ["lots_of_accountability", "Lots of accountability"],
  ["tough_love", "Tough love"],
  ["technical_coaching", "Technical coaching"],
  ["fun", "Fun"],
  ["data_and_metrics", "Data & metrics"],
] as const;

export const BUDGET_OPTIONS = [
  ["gbp_250_400", "£250–400 / month"],
  ["gbp_400_600", "£400–600 / month"],
  ["gbp_600_900", "£600–900 / month"],
  ["gbp_900_plus", "£900+ / month"],
  ["not_sure_yet", "Not sure yet"],
] as const;

export const GENDER_OPTIONS = [
  ["woman", "Women"],
  ["man", "Men"],
  ["non_binary", "Other"],
] as const;

export const VENUE_OPTIONS = [
  ["remote", "Remote"],
  ["client_home", "Home"],
  ["office_gym", "Office"],
  ["outdoors", "Outdoor"],
  ["private_studio", "Private studio"],
  ["commercial_gym", "Gym"],
] as const;

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const PERIODS = ["Morning", "Lunch", "Evening"] as const;

type OptionValue<T extends readonly (readonly [string, string])[]> = T[number][0];

export type AvailabilitySlot = `${typeof DAYS[number]}-${typeof PERIODS[number]}`;

export type MatchingAnswers = {
  goal: OptionValue<typeof GOAL_OPTIONS> | null;
  experience: OptionValue<typeof EXPERIENCE_OPTIONS> | null;
  coachingStyle: OptionValue<typeof COACHING_OPTIONS> | null;
  budget: OptionValue<typeof BUDGET_OPTIONS> | null;
  trainerGenders: OptionValue<typeof GENDER_OPTIONS>[];
  postcode: string;
  venues: OptionValue<typeof VENUE_OPTIONS>[];
  travelKm: number;
  availability: AvailabilitySlot[];
  medicalNote: string;
  biggestObstacle: string;
  healthConsent: boolean;
};

export type IdentityAnswers = {
  fullName: string;
  dateOfBirth: string;
  email: string;
};

export const INITIAL_MATCHING_ANSWERS: MatchingAnswers = {
  goal: null,
  experience: null,
  coachingStyle: null,
  budget: null,
  trainerGenders: GENDER_OPTIONS.map(([value]) => value),
  postcode: "",
  venues: [],
  travelKm: 10,
  availability: [],
  medicalNote: "",
  biggestObstacle: "",
  healthConsent: false,
};

export const INITIAL_IDENTITY_ANSWERS: IdentityAnswers = {
  fullName: "",
  dateOfBirth: "",
  email: "",
};

export const ONBOARDING_STEPS = [
  { title: "What is your goal?", subtitle: "Choose the one outcome you want to prioritise." },
  { title: "What kind of support fits?", subtitle: "Two quick choices help us tune the shortlist." },
  { title: "What feels comfortable?", subtitle: "Budget and trainer preference shape the people we show you." },
  { title: "Where could you train?", subtitle: "We use your approximate area for matching, never your home address." },
  { title: "When could you train?", subtitle: "Pick a few regular windows. You can change these later." },
  { title: "Anything useful to know?", subtitle: "This is optional, private, and only shared when you choose." },
  { title: "Save your shortlist", subtitle: "Your name and date of birth stay private. We’ll email a secure sign-in link." },
] as const;

export const UK_POSTCODE_PATTERN = /^(GIR ?0AA|[A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]? ?\d[ABD-HJLNP-UW-Z]{2})$/i;

export const normalizePostcode = (value: string) => {
  const compact = value.toUpperCase().replace(/\s+/g, "");
  if (compact.length <= 3) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
};

export const formatDobInput = (value: string) => {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
    .filter(Boolean)
    .join("/");
};

export const isAdultDate = (value: string, today = new Date()) => {
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const ukMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const parts = isoMatch
    ? [Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])]
    : ukMatch
      ? [Number(ukMatch[3]), Number(ukMatch[2]), Number(ukMatch[1])]
      : null;
  if (!parts) return false;

  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return false;
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;

  let age = today.getUTCFullYear() - date.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - date.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < date.getUTCDate())) age -= 1;
  return age >= 18 && age < 100;
};

export const stepError = (step: number, answers: MatchingAnswers, identity: IdentityAnswers) => {
  switch (step) {
    case 0:
      return answers.goal ? null : "Choose your main goal to continue.";
    case 1:
      if (!answers.experience) return "Choose your current training experience.";
      return answers.coachingStyle ? null : "Choose the coaching approach that suits you.";
    case 2:
      return answers.budget ? null : "Choose a comfortable monthly budget.";
    case 3:
      if (!UK_POSTCODE_PATTERN.test(normalizePostcode(answers.postcode))) return "Enter a valid UK postcode.";
      return answers.venues.length > 0 ? null : "Choose at least one place you could train.";
    case 4:
      return answers.availability.length > 0 ? null : "Choose at least one regular training window.";
    case 5: {
      const sharesHealthData = answers.goal === "recover_from_injury" || answers.medicalNote.trim().length > 0;
      return sharesHealthData && !answers.healthConsent
        ? "Please consent before saving health information."
        : null;
    }
    case 6:
      if (!identity.fullName.trim()) return "Enter your full name.";
      if (!isAdultDate(identity.dateOfBirth)) return "Enter a valid date of birth. You must be 18 or over.";
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email.trim())
        ? null
        : "Enter a valid email address.";
    default:
      return null;
  }
};

const MATCHING_STORAGE_KEY = "petey.web.matching-draft.v1";

export const loadMatchingDraft = (): MatchingAnswers => {
  try {
    const stored = window.sessionStorage.getItem(MATCHING_STORAGE_KEY);
    if (!stored) return INITIAL_MATCHING_ANSWERS;
    return { ...INITIAL_MATCHING_ANSWERS, ...JSON.parse(stored) } as MatchingAnswers;
  } catch {
    return INITIAL_MATCHING_ANSWERS;
  }
};

export const saveMatchingDraft = (answers: MatchingAnswers) => {
  try {
    const nonSensitiveAnswers = {
      ...answers,
      postcode: "",
      medicalNote: "",
      biggestObstacle: "",
      healthConsent: false,
    };
    window.sessionStorage.setItem(MATCHING_STORAGE_KEY, JSON.stringify(nonSensitiveAnswers));
  } catch {
    // The flow remains usable when storage is unavailable.
  }
};
