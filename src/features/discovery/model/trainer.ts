import { z } from "zod";

const shortText = z.string().trim().min(1).max(160);
const list = z.array(shortText).max(30);

// Stored catalog entries use a protected Storage object path. The server
// resolves that path to an expiring HTTPS URL before returning a profile.
export const trainerPhotoSchema = z.string().min(1).max(4_000).refine((value) => {
  if (value.startsWith("https://")) {
    try {
      const url = new URL(value);
      return !url.username && !url.password && Boolean(url.hostname);
    } catch {
      return false;
    }
  }
  return /^(?:\/(?!\/)|onboarding\/)[^\s?#\\]*$/.test(value)
    && !value.split("/").some((part) => part === "." || part === "..");
}, "Use an HTTPS image URL or a valid image path.");

export const trainerSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  name: shortText,
  photo: trainerPhotoSchema,
  specialty: shortText,
  specialties: list,
  area: shortText,
  price: z.number().finite().nonnegative().max(100_000),
  tenPackPrice: z.number().finite().nonnegative().max(1_000_000).nullable(),
  monthlyPrice: z.number().finite().nonnegative().max(1_000_000).nullable(),
  // Distance belongs to a client/trainer pair; it is absent from the catalog.
  distanceMiles: z.number().finite().nonnegative().nullable().optional(),
  coachingStyles: list,
  venues: list,
  qualifications: list,
  availability: list,
  bio: z.string().trim().min(1).max(4_000),
  isDemo: z.boolean().optional(),
});

export type Trainer = z.infer<typeof trainerSchema>;

export const trainerCardPreviewSchema = trainerSchema.pick({
  id: true,
  name: true,
  photo: true,
  specialty: true,
  area: true,
  price: true,
  isDemo: true,
});

export type TrainerCardPreview = z.infer<typeof trainerCardPreviewSchema>;

export const trainerCardName = (trainer: Pick<Trainer, "name">) => (
  trainer.name.trim().split(/\s+/)[0] || trainer.name
);

export const matchReasonFor = (trainer: Trainer) => (
  `${trainer.specialty} · ${trainer.coachingStyles[0] ?? "Personal training"}`
);
