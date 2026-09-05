import { trainerSchema, type Trainer } from "../../src/features/discovery/model/trainer.js";

// Mirrors the canonical mobile enum values and public presentation labels.
// Unknown future values are omitted until their meaning is explicitly mapped.
const specialties: Record<string, string> = {
  fat_loss: "Fat loss", body_recomposition: "Body recomposition",
  boxing_combat: "Boxing & combat fitness", calisthenics: "Calisthenics",
  functional_fitness: "Functional fitness", muscle_building: "Muscle building",
  hiit: "HIIT", olympic_weightlifting: "Olympic weightlifting", pilates: "Pilates",
  powerlifting: "Powerlifting", strength: "Strength", general_fitness: "General fitness",
  womens_fitness: "Women’s fitness", pre_post_natal: "Pre & postnatal",
  running: "Running and endurance", hypertrophy: "Hypertrophy", mobility: "Mobility",
  older_adults: "Older adults", rehab: "Rehab", sport_specific: "Sport performance", other: "Other",
};
const venues: Record<string, string> = {
  client_home: "Your home", office_gym: "Your office", commercial_gym: "Commercial gym",
  outdoors: "Outdoors", private_studio: "Private studio", remote: "Remote",
};
const styles: Record<string, string> = {
  drill_sergeant: "Drill sergeant", encouraging: "Encouraging", calm: "Calm",
  data_driven: "Data-driven", friendly: "Friendly", high_energy: "High-energy",
  educational: "Educational", strict_accountability: "Strict accountability",
};
const days: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
  friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};
const periods: Record<string, string> = {
  morning: "mornings", lunch: "lunchtimes", afternoon: "afternoons", evening: "evenings",
};
const record = (value: unknown): Record<string, unknown> => value !== null
  && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const strings = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
  : [];
const labels = (value: unknown, lookup: Record<string, string>) => Array.from(new Set(
  strings(value).flatMap((item) => Object.hasOwn(lookup, item) ? [lookup[item]!] : []),
));
const pounds = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value)
  && value >= 0 ? value / 100 : null;

/** Public practical facts override editorial copy on every read. Reapproval can
 * change prices, name, images or sessions without requiring a web republish. */
export function projectWebTrainer(publicValue: unknown, webProfile: Trainer): Trainer | null {
  const published = record(publicValue);
  const pricing = record(published.pricing);
  const price = pounds(pricing.singleSessionPence);
  const homeArea = typeof published.homeAreaLabel === "string" ? published.homeAreaLabel.trim() : "";
  if (price === null || !homeArea) return null;
  const trainingSpecialties = labels(published.specialties, specialties);
  if (trainingSpecialties.length === 0) return null;
  const headline = trainingSpecialties[0]!;
  // Retain 'Battersea · SW11' only while the approved area is still SW11.
  // A changed area falls back to the exact published label, never a guessed town.
  const areaSuffix = webProfile.area.split("·").at(-1)?.trim().toLocaleLowerCase("en-GB");
  const area = areaSuffix === homeArea.toLocaleLowerCase("en-GB") ? webProfile.area : homeArea;
  const availability = Array.from(new Set((Array.isArray(published.availability) ? published.availability : [])
    .flatMap((value) => {
      const slot = record(value);
      if (typeof slot.day !== "string" || typeof slot.period !== "string"
        || !Object.hasOwn(days, slot.day) || !Object.hasOwn(periods, slot.period)) return [];
      return [`${days[slot.day]} ${periods[slot.period]}`];
    })));
  const projection = trainerSchema.safeParse({
    ...webProfile,
    id: published.trainerId,
    name: published.fullName,
    photo: published.primaryPhotoPath,
    specialty: headline,
    specialties: trainingSpecialties.slice(1),
    area,
    price,
    tenPackPrice: pounds(pricing.tenPackPence),
    monthlyPrice: pounds(pricing.monthlyCoachingPence),
    coachingStyles: labels(Array.isArray(published.coachingStyles)
      ? published.coachingStyles : [published.coachingStyle], styles),
    venues: labels(published.venues, venues),
    qualifications: strings(published.qualificationTitles),
    availability,
    distanceMiles: undefined,
  });
  if (!projection.success) return null;
  delete projection.data.distanceMiles;
  return projection.data;
}
