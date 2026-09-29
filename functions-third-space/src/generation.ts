import { MODEL_ROUTES, type ModelRequest } from "../../functions/src/openai.js";
import type { GenerateRequest } from "./service.js";
import { withTransientProviderRetry, type ProviderRetryEvent, type ProviderRetryOptions } from "./provider-retry.js";

interface GenerationOptions extends Omit<ProviderRetryOptions, "onRetry"> {
  generateText: (request: ModelRequest) => Promise<string>;
  onRetry?: (event: ProviderRetryEvent & { kind: GenerateRequest["kind"]; model: string; nextModel: string }) => void;
}

export async function generateModelResponse(request: GenerateRequest, options: GenerationOptions): Promise<string> {
  const task = request.kind === "chat" ? "chat" : "matching";
  const model = MODEL_ROUTES[task].model;
  // Matching, including retries, always uses Sol at medium reasoning.
  const text = await withTransientProviderRetry(() => options.generateText({
    task, input: request.contents, systemInstruction: request.systemInstruction,
    schema: { name: `third_space_${request.kind}`, json: request.responseJsonSchema },
    maxOutputTokens: task === "chat" ? 8_192 : 16_384,
    // SDK retries are disabled. Two matching stages take at most
    // 6 * 25s + 2 * (2.5s + 5.5s) = 166s within the 180s callable.
    timeoutMs: task === "chat" ? 20_000 : 25_000,
  }), {
    sleep: options.sleep, random: options.random,
    onRetry: event => options.onRetry?.({ ...event, kind: request.kind, model, nextModel: model }),
  });
  if (!text.trim()) throw new Error("The model returned no response.");
  return text;
}
