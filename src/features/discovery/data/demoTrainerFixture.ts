import seed from "../../../../functions/scripts/demo-web-trainers.json";
import { trainerSchema, type Trainer } from "../model/trainer";
import { TRAINERS } from "./trainers";

// This module is for tests and the dynamically loaded development QA flow.
// Sharing the import data avoids maintaining a second full demo catalog.
export const DEMO_TRAINER_FIXTURES: Trainer[] = seed.map((entry) => {
  const id = entry.id.replace("petey-demo-trainer-", "");
  const card = TRAINERS.find((trainer) => trainer.id === id);
  if (!card) throw new Error(`Missing landing demo image for ${id}.`);
  return trainerSchema.parse({ ...entry, id, photo: card.photo });
});
