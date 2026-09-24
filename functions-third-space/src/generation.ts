import { ThinkingLevel, type GenerateContentParameters } from "@google/genai";
import type { GenerateRequest } from "./service.js";
import { withTransientProviderRetry, type ProviderRetryEvent, type ProviderRetryOptions } from "./provider-retry.js";

interface GenerationOptions extends Omit<ProviderRetryOptions, "onRetry"> {
  chatModel: string;
  matchingModel: string;
  generateContent: (request: GenerateContentParameters) => Promise<{ text?: string }>;
  onRetry?: (event: ProviderRetryEvent & { kind: GenerateRequest["kind"]; model: string; nextModel: string }) => void;
}

export async function generateModelResponse(request: GenerateRequest, options: GenerationOptions): Promise<string> {
  // Keep the preferred matching model on the first attempt. If it is temporarily unavailable,
  // use the configured chat model for the remaining attempts, with the same contract.
  const modelForAttempt = (attempt: number) => request.kind === "chat" || attempt > 0
    ? options.chatModel : options.matchingModel;
  const response = await withTransientProviderRetry(attempt => {
    const model = modelForAttempt(attempt);
    return options.generateContent({
      model, contents: request.contents,
      config: {
        // No nested retries or extra fallback budget: two stages take at most
        // 6 * 25s + 2 * (2.5s + 5.5s) = 166s within the 180s matching callable.
        httpOptions: { timeout: request.kind === "chat" ? 20_000 : 25_000, retryOptions: { attempts: 1 } },
        systemInstruction: request.systemInstruction,
        responseMimeType: "application/json", responseJsonSchema: request.responseJsonSchema,
        temperature: 0.35, maxOutputTokens: request.kind === "ranking" ? 4_000 : 3_000,
        thinkingConfig: model.startsWith("gemini-2.") ? { thinkingBudget: 0 }
          : { thinkingLevel: model.startsWith("gemini-3.7") ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL },
      },
    });
  }, {
    sleep: options.sleep, random: options.random,
    onRetry: event => options.onRetry?.({
      ...event, kind: request.kind, model: modelForAttempt(event.retry - 1), nextModel: modelForAttempt(event.retry),
    }),
  });
  if (!response.text) throw new Error("The model returned no response.");
  return response.text;
}
