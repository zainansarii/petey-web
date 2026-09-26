import { defineSecret } from "firebase-functions/params";
import { createOpenAIClient } from "./openai.js";

export const openaiApiKey = defineSecret("OPENAI_API_KEY");
let client: ReturnType<typeof createOpenAIClient> | undefined;

// Secret values are available only inside a bound function at runtime.
export function openaiClient() {
  return client ??= createOpenAIClient(openaiApiKey.value());
}
