import OpenAI from "openai";
import type { Response, ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

// Shared by both Functions codebases. Keep routing in one place so retries,
// compatibility endpoints and evaluation scripts cannot silently change models.
export const MODEL_ROUTES = {
  chat: { model: "gpt-6-luna", effort: "low" },
  matching: { model: "gpt-6-sol", effort: "medium" },
} as const;

export type ModelMessage = { role: "user" | "assistant"; content: string };
export interface ModelRequest {
  task: keyof typeof MODEL_ROUTES;
  systemInstruction: string;
  input: string | ModelMessage[];
  schema?: { name: string; json: Record<string, unknown> };
  // Responses counts reasoning and visible output against this combined limit.
  maxOutputTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
}

export class ModelResponseError extends Error {}

// Our output contracts accept empty arrays/strings (or explicit null) for
// missing information. Require every property on the wire, including fields
// that older stored/fixture responses were allowed to omit.
export function openAIJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    const result = Object.fromEntries(Object.entries(value)
      .filter(([key]) => !["$schema", "propertyOrdering", "default"].includes(key))
      .map(([key, nested]) => [key, visit(nested)]));
    if (result.type === "object") {
      result.additionalProperties = false;
      result.required = Object.keys(result.properties as Record<string, unknown> ?? {});
    }
    return result;
  };
  return visit(schema) as Record<string, unknown>;
}

export function responseParameters(request: ModelRequest): ResponseCreateParamsNonStreaming {
  const route = MODEL_ROUTES[request.task];
  return {
    model: route.model,
    reasoning: { effort: route.effort },
    instructions: request.systemInstruction,
    input: request.input,
    store: false,
    max_output_tokens: request.maxOutputTokens,
    text: {
      verbosity: "low",
      format: request.schema
        ? { type: "json_schema", name: request.schema.name, strict: true, schema: openAIJsonSchema(request.schema.json) }
        : { type: "text" },
    },
  };
}

export function createOpenAIClient(apiKey: string) {
  if (!apiKey.trim()) throw new Error("OPENAI_API_KEY is not configured.");
  return new OpenAI({ apiKey, maxRetries: 0 });
}

function completedText(response: Response) {
  if (response.status !== "completed") throw new ModelResponseError("The model returned an incomplete response.");
  const messages = response.output.filter(item => item.type === "message");
  if (messages.some(message => message.status !== "completed" || message.content.some(part => part.type === "refusal"))) {
    throw new ModelResponseError("The model could not complete this request.");
  }
  const text = messages.flatMap(message => message.content.flatMap(part => part.type === "output_text" ? [part.text] : [])).join("");
  if (!text.trim()) throw new ModelResponseError("The model returned no response.");
  return text;
}

async function withinDeadline<T>(request: ModelRequest, run: (signal: AbortSignal) => Promise<T>) {
  // The signal covers the entire body/stream, not only time to response headers.
  const deadline = AbortSignal.timeout(request.timeoutMs);
  const signal = request.signal ? AbortSignal.any([deadline, request.signal]) : deadline;
  try {
    return await run(signal);
  } catch (error) {
    if (deadline.aborted && !request.signal?.aborted) {
      throw Object.assign(new Error("The model request timed out."), { name: "TimeoutError" });
    }
    throw error;
  }
}

export async function generateOpenAIText(client: OpenAI, request: ModelRequest): Promise<string> {
  return withinDeadline(request, async signal => completedText(await client.responses.create(
    responseParameters(request), { signal, timeout: request.timeoutMs, maxRetries: 0 },
  )));
}

export async function streamOpenAIText(client: OpenAI, request: ModelRequest, onDelta: (delta: string) => Promise<void>): Promise<string> {
  return withinDeadline(request, async signal => {
    const stream = await client.responses.create(
      { ...responseParameters(request), stream: true }, { signal, timeout: request.timeoutMs, maxRetries: 0 },
    );
    try {
      for await (const event of stream) {
        if (event.type === "response.output_text.delta") await onDelta(event.delta);
        if (event.type === "response.completed") return completedText(event.response);
        if (event.type === "response.failed" || event.type === "response.incomplete" || event.type === "error") {
          // Do not expose provider error bodies, which can include submitted text.
          throw new ModelResponseError("The model returned an incomplete response.");
        }
      }
      throw new ModelResponseError("The model stream ended before completion.");
    } finally {
      stream.controller.abort();
    }
  });
}
