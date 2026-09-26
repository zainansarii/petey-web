import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import { generateOpenAIText, openAIJsonSchema, responseParameters, streamOpenAIText, type ModelRequest } from "./openai.js";

const request: ModelRequest = {
  task: "chat", systemInstruction: "Application instructions", input: [{ role: "user", content: "Private goal" }],
  schema: { name: "turn", json: { type: "object", properties: { reply: { type: "string" } } } },
  maxOutputTokens: 8_192, timeoutMs: 1_000,
};
const completed = (text: string) => ({
  id: "resp_test", object: "response", status: "completed",
  output: [{ id: "msg_test", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text, annotations: [] }] }],
});
const clientFor = (fetch: typeof globalThis.fetch) => new OpenAI({ apiKey: "test-key", maxRetries: 0, fetch });
const sse = (events: unknown[]) => new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });

describe("shared OpenAI transport", () => {
  it.each([
    ["chat", "gpt-6-luna", "low"], ["matching", "gpt-6-sol", "medium"],
  ] as const)("routes %s through Responses with the requested reasoning and privacy settings", async (task, model, effort) => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, options) => {
      const body = JSON.parse(options!.body as string);
      expect(body).toMatchObject({ model, reasoning: { effort }, store: false, input: request.input,
        text: { format: { type: "json_schema", strict: true, schema: { additionalProperties: false, required: ["reply"] } } } });
      expect(body).not.toHaveProperty("temperature");
      expect(body).not.toHaveProperty("thinkingConfig");
      expect(body).not.toHaveProperty("previous_response_id");
      return Response.json(completed('{"reply":"Next question?"}'));
    });
    await expect(generateOpenAIText(clientFor(fetch), { ...request, task })).resolves.toBe('{"reply":"Next question?"}');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("prepares nested strict schemas without changing the validation constraints or source object", () => {
    const source = { $schema: "schema-url", type: "object", propertyOrdering: ["choices"], properties: {
      choices: { type: "array", maxItems: 3, items: { type: "object", properties: {
        value: { type: "string", minLength: 1 }, distance: { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] },
      }, required: ["value"] } },
    } };
    const schema = openAIJsonSchema(source);
    expect(schema).toMatchObject({ required: ["choices"], additionalProperties: false, properties: {
      choices: { maxItems: 3, items: { required: ["value", "distance"], additionalProperties: false, properties: { value: { minLength: 1 } } } },
    } });
    expect(schema).not.toHaveProperty("$schema");
    expect(schema).not.toHaveProperty("propertyOrdering");
    expect(source.properties.choices.items.required).toEqual(["value"]);
  });

  it("uses plain text for the Markdown profile while keeping Sol at medium", () => {
    expect(responseParameters({ ...request, task: "matching", schema: undefined })).toMatchObject({
      model: "gpt-6-sol", reasoning: { effort: "medium" }, text: { format: { type: "text" } },
    });
  });

  it.each(["incomplete", "failed", "cancelled"])("rejects a %s response even when it contains partial output", async status => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ ...completed("private partial output"), status }));
    await expect(generateOpenAIText(clientFor(fetch), request)).rejects.toThrow("The model returned an incomplete response.");
  });

  it("rejects refusal and empty output without exposing provider content", async () => {
    const refused = completed("unused");
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ ...refused, output: [{
      ...refused.output[0], content: [{ type: "refusal", refusal: "Private refused content" }],
    }] }));
    await expect(generateOpenAIText(clientFor(fetch), request)).rejects.toThrow("The model could not complete this request.");
    await expect(generateOpenAIText(clientFor(async () => Response.json(completed(""))), request)).rejects.toThrow("The model returned no response.");
  });

  it("streams only output-text deltas and validates the completed response", async () => {
    const onDelta = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn<typeof globalThis.fetch>(async () => sse([
      { type: "response.reasoning_text.delta", delta: "private reasoning" },
      { type: "response.output_text.delta", delta: '{"reply":' },
      { type: "response.output_text.delta", delta: '"Hello"}' },
      { type: "response.completed", response: completed('{"reply":"Hello"}') },
    ]));
    await expect(streamOpenAIText(clientFor(fetch), request, onDelta)).resolves.toBe('{"reply":"Hello"}');
    expect(onDelta.mock.calls).toEqual([['{"reply":'], ['"Hello"}']]);
  });

  it.each(["response.incomplete", "response.failed", "error", "disconnect"])("rejects a stream ending with %s", async type => {
    const events: unknown[] = [{ type: "response.output_text.delta", delta: '{"reply":"partial' }];
    if (type !== "disconnect") events.push({ type, response: { ...completed("partial"), status: "incomplete" }, message: "private provider details" });
    await expect(streamOpenAIText(clientFor(async () => sse(events)), request, async () => {})).rejects.toThrow(/The model (returned an incomplete response|stream ended before completion)/);
  });

  it("does not multiply retry attempts inside the SDK", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ error: { message: "private", type: "server_error" } }, { status: 503 }));
    await expect(generateOpenAIText(clientFor(fetch), request)).rejects.toMatchObject({ status: 503 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["buffered", "streamed"])("enforces the deadline after %s response headers arrive", async mode => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, options) => new Response(new ReadableStream({
      start(controller) {
        options!.signal!.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
      },
    }), { headers: { "content-type": mode === "streamed" ? "text/event-stream" : "application/json" } }));
    const deadlineRequest = { ...request, timeoutMs: 25 };
    const response = mode === "streamed"
      ? streamOpenAIText(clientFor(fetch), deadlineRequest, async () => {})
      : generateOpenAIText(clientFor(fetch), deadlineRequest);
    await expect(response).rejects.toMatchObject({ name: "TimeoutError", message: "The model request timed out." });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
