import { describe, expect, it } from "vitest";
import {
  conversationHistoryForGeminiV3,
  createRateLimitForProjectV3,
  draftIdentityForIdempotencyKeyV3,
  extractReplyPrefixFromStructuredStreamV4,
  hasReviewReadinessPhrasingV3,
  isTranscriptReadyForFinalizationV4,
  isExplicitFinishRequestV3,
  normalizeProfileMarkdownV3,
  parseConversationalModelOutputV3,
  requiredPracticalTopicsForTranscriptV3,
  shouldReadyForReviewV3,
} from "./index.js";
import { ONBOARDING_CONVERSATION_SYSTEM_PROMPT } from "./onboardingConversationPrompt.js";

describe("AI onboarding V3 conversational output", () => {
  it("allows development QA headroom without relaxing production creation limits", () => {
    expect(createRateLimitForProjectV3("petey-dev-getcass")).toBe(50);
    expect(createRateLimitForProjectV3("petey-prod-getcass")).toBe(5);
    expect(createRateLimitForProjectV3(undefined)).toBe(5);
  });

  it("guides one open-ended conversation through trainee, trainer, then sessions", () => {
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Phase 1 — the trainee");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Phase 2 — the trainer");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Phase 3 — the sessions");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Ask open-ended questions");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Ask no more than one question per reply");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Do not ask for a postcode or exact address");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Keep acknowledgements restrained and proportionate");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Generate them from the current context");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("at least the fifth user answer");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Availability and budget are mandatory");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("every number in a quick reply must be a monetary amount prefixed with the pound");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain('"Near London Bridge"');
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain('"Shoreditch"');
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain('"Fulham"');
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Trainer gender preference is a mandatory");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Ask only about the trainer's gender");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Seven answers is a target, not a limit");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Twelve answers is the fallback finish point");
  });

  it("uses one native Gemini chat history instead of serializing the transcript into every turn", () => {
    expect(conversationHistoryForGeminiV3([
      { id: "opening-1", role: "assistant", text: "Hi, welcome to Petey!", createdAt: "2026-09-01T00:00:00.000Z", sequence: 1 },
      { id: "opening-2", role: "assistant", text: "What are you hoping to achieve?", createdAt: "2026-09-01T00:00:00.000Z", sequence: 2 },
      { id: "user-1", role: "user", text: "I want to build strength.", createdAt: "2026-09-01T00:00:01.000Z", sequence: 3 },
      { id: "model-1", role: "assistant", text: "Great goal. What would feeling stronger make easier?", createdAt: "2026-09-01T00:00:02.000Z", sequence: 4 },
    ])).toEqual([
      { role: "user", parts: [{ text: "I want to build strength." }] },
      { role: "model", parts: [{ text: "Great goal. What would feeling stronger make easier?" }] },
    ]);
  });

  it("keeps the public draft ID separate from the creation key and capability", () => {
    const key = "8bce2f60-dc73-4e40-a4bb-019a18b4d91e";
    const first = draftIdentityForIdempotencyKeyV3(key);
    expect(first).toEqual(draftIdentityForIdempotencyKeyV3(key));
    expect(first.draftId).not.toBe(key);
    expect(first.draftId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.capability).not.toContain(first.draftId);
  });

  it("accepts ordinary prose and returns only the first explicit question", () => {
    expect(parseConversationalModelOutputV3(
      "Congratulations! When is the wedding? How much weight would you like to lose?",
    )).toEqual({
      reply: "Congratulations! When is the wedding?",
      readyForReview: false,
      quickReplies: [],
    });
  });

  it("unwraps and validates the private response envelope without exposing JSON", () => {
    expect(parseConversationalModelOutputV3(JSON.stringify({
      reply: "That sounds important. What would success look like to you?",
      readyForReview: false,
      quickReplies: [
        "I'd like to feel stronger day to day",
        "I want to feel confident for my wedding",
        "My main aim is improving my marathon time",
      ],
    }))).toEqual({
      reply: "That sounds important. What would success look like to you?",
      readyForReview: false,
      quickReplies: [
        "I'd like to feel stronger day to day",
        "I want to feel confident for my wedding",
        "My main aim is improving my marathon time",
      ],
    });
  });

  it("extracts only the progressively available reply text from a structured stream", () => {
    expect(extractReplyPrefixFromStructuredStreamV4('{"reply":"Hello')).toBe("Hello");
    expect(extractReplyPrefixFromStructuredStreamV4('{"reply":"Hello\\nworld","readyForReview":false}'))
      .toBe("Hello\nworld");
    expect(extractReplyPrefixFromStructuredStreamV4('{"readyForReview":false')).toBe("");
  });

  it("exposes concise natural quick replies, including answer fragments", () => {
    expect(parseConversationalModelOutputV3(JSON.stringify({
      reply: "What coaching style would bring out your best?",
      readyForReview: false,
      quickReplies: [
        "  I want tough love and accountability.  ",
        "Someone who is warm and friendly.",
        "Next summer.",
      ],
    }))).toMatchObject({
      quickReplies: [
        "I want tough love and accountability",
        "Someone who is warm and friendly",
        "Next summer",
      ],
    });
  });

  it("adds pound signs to every number in budget quick replies", () => {
    expect(parseConversationalModelOutputV3(JSON.stringify({
      reply: "What budget would feel comfortable per session?",
      readyForReview: false,
      quickReplies: [
        "Around 40 per session",
        "Between 50 and 70",
        "I'm not sure yet",
      ],
    }))).toMatchObject({
      quickReplies: [
        "Around £40 per session",
        "Between £50 and £70",
        "I'm not sure yet",
      ],
    });
  });

  it("defaults optional envelope fields while still requiring a reply", () => {
    expect(parseConversationalModelOutputV3(JSON.stringify({
      reply: "What would you like your trainer to specialise in?",
    }))).toEqual({
      reply: "What would you like your trainer to specialise in?",
      readyForReview: false,
      quickReplies: [],
    });
    expect(() => parseConversationalModelOutputV3(JSON.stringify({
      quickReplies: [],
    }))).toThrow(/structured output/i);
  });

  it("filters unsafe or overlong suggestion values", () => {
    expect(parseConversationalModelOutputV3(JSON.stringify({
      reply: "What coaching style would bring out your best?",
      quickReplies: [
        "Someone who is warm and friendly?",
        "I would answer using JSON metadata",
        `I want ${"very ".repeat(20)}close accountability`,
      ],
    }))).toMatchObject({ quickReplies: [] });
  });

  it("drops suggestions when the envelope is ready for review", () => {
    expect(parseConversationalModelOutputV3(JSON.stringify({
      reply: "I have everything I need to prepare your training brief.",
      readyForReview: true,
      quickReplies: ["I want to add one more detail"],
    }))).toEqual({
      reply: "I have everything I need to prepare your training brief.",
      readyForReview: true,
      quickReplies: [],
    });
  });

  it("rejects model metadata and JSON without a user-facing reply", () => {
    expect(() => parseConversationalModelOutputV3('{"readyForReview":true}')).toThrow(/structured output|metadata/i);
    expect(() => parseConversationalModelOutputV3(JSON.stringify({
      reply: "What setting suits you?",
      readyForReview: false,
      quickReplies: [],
      internalReason: "sessions phase",
    }))).toThrow(/structured output|metadata/i);
    expect(() => parseConversationalModelOutputV3(JSON.stringify({
      reply: "What setting suits you?",
      readyForReview: false,
      quickReplies: ["I train at home", "I use a gym", "I train online", "I train outside"],
    }))).toThrow(/structured output|metadata/i);
    expect(() => parseConversationalModelOutputV3("Here is the JSON requested.")).toThrow(/metadata/i);
    expect(() => parseConversationalModelOutputV3("```json\n{}\n```")).toThrow(/structured output|metadata/i);
  });

  it("requires trainer gender preference, availability, and budget before accepting readiness", () => {
    expect(shouldReadyForReviewV3({
      userTurns: 8,
      explicitFinish: false,
      modelReadyForReview: true,
    })).toBe(false);
    expect(shouldReadyForReviewV3({
      userTurns: 8,
      explicitFinish: false,
      modelReadyForReview: true,
      trainerGenderPreferenceAnswered: true,
      availabilityAnswered: true,
      budgetAnswered: false,
    })).toBe(false);
    expect(shouldReadyForReviewV3({
      userTurns: 8,
      explicitFinish: true,
      trainerGenderPreferenceAnswered: true,
      availabilityAnswered: false,
      budgetAnswered: true,
    })).toBe(false);
    expect(shouldReadyForReviewV3({
      userTurns: 8,
      explicitFinish: true,
      trainerGenderPreferenceAnswered: false,
      availabilityAnswered: true,
      budgetAnswered: true,
    })).toBe(false);
  });

  it("can complete after seven answers and uses twelve as a fallback once required topics are covered", () => {
    expect(shouldReadyForReviewV3({
      userTurns: 7,
      explicitFinish: false,
      modelReadyForReview: false,
      trainerGenderPreferenceAnswered: true,
      availabilityAnswered: true,
      budgetAnswered: true,
    })).toBe(false);
    expect(shouldReadyForReviewV3({
      userTurns: 8,
      explicitFinish: false,
      modelReadyForReview: true,
      trainerGenderPreferenceAnswered: true,
      availabilityAnswered: true,
      budgetAnswered: true,
    })).toBe(true);
    expect(shouldReadyForReviewV3({
      userTurns: 11,
      explicitFinish: false,
      modelReadyForReview: false,
      trainerGenderPreferenceAnswered: true,
      availabilityAnswered: true,
      budgetAnswered: true,
    })).toBe(false);
    expect(shouldReadyForReviewV3({
      userTurns: 12,
      explicitFinish: false,
      trainerGenderPreferenceAnswered: true,
      availabilityAnswered: true,
      budgetAnswered: true,
    })).toBe(true);
    expect(shouldReadyForReviewV3({
      userTurns: 2,
      explicitFinish: true,
      trainerGenderPreferenceAnswered: true,
      availabilityAnswered: true,
      budgetAnswered: true,
    })).toBe(true);
  });

  it("counts required matching topics only after separate assistant questions receive answers", () => {
    expect(requiredPracticalTopicsForTranscriptV3([
      { role: "assistant", text: "Do you have a trainer gender preference, or no preference?" },
      { role: "user", text: "I don't have a preference" },
      { role: "assistant", text: "Which days or times usually suit you best?" },
      { role: "user", text: "Weekday evenings" },
      { role: "assistant", text: "What budget would feel comfortable per session?" },
      { role: "user", text: "I'm not sure yet" },
    ])).toEqual({
      trainerGenderPreferenceAnswered: true,
      availabilityAnswered: true,
      budgetAnswered: true,
    });

    expect(requiredPracticalTopicsForTranscriptV3([
      { role: "assistant", text: "What is your availability and budget?" },
      { role: "user", text: "Evenings and around £50" },
    ])).toEqual({
      trainerGenderPreferenceAnswered: false,
      availabilityAnswered: false,
      budgetAnswered: false,
    });

    expect(requiredPracticalTopicsForTranscriptV3([
      { role: "assistant", text: "How much would you feel comfortable spending per session?" },
    ])).toEqual({
      trainerGenderPreferenceAnswered: false,
      availabilityAnswered: false,
      budgetAnswered: false,
    });

    expect(requiredPracticalTopicsForTranscriptV3([
      { role: "assistant", text: "Do you have a trainer gender preference, and what availability works?" },
      { role: "user", text: "A woman, on weekday evenings" },
    ])).toEqual({
      trainerGenderPreferenceAnswered: false,
      availabilityAnswered: false,
      budgetAnswered: false,
    });

    expect(requiredPracticalTopicsForTranscriptV3([
      { role: "assistant", text: "Do you have a trainer gender preference, or no preference?" },
      { role: "user", text: "No gender preference" },
      { role: "assistant", text: "Got it — no gender preference. What availability works for training?" },
      { role: "user", text: "Weekday evenings" },
    ])).toEqual({
      trainerGenderPreferenceAnswered: true,
      availabilityAnswered: true,
      budgetAnswered: false,
    });
  });

  it("uses clear readiness wording as a gated fallback when the flag drifts", () => {
    const reply = "I have everything I need to put together your training brief.";
    expect(hasReviewReadinessPhrasingV3(reply)).toBe(true);
    expect(hasReviewReadinessPhrasingV3("I've got enough to prepare your review.")).toBe(true);
    expect(shouldReadyForReviewV3({
      userTurns: 4,
      explicitFinish: false,
      modelReadyForReview: false,
      reply,
      trainerGenderPreferenceAnswered: true,
      availabilityAnswered: true,
      budgetAnswered: true,
    })).toBe(false);
    expect(shouldReadyForReviewV3({
      userTurns: 5,
      explicitFinish: false,
      modelReadyForReview: false,
      reply,
      trainerGenderPreferenceAnswered: true,
      availabilityAnswered: true,
      budgetAnswered: true,
    })).toBe(true);
    expect(hasReviewReadinessPhrasingV3("What would success look like to you?")).toBe(false);
  });

  it("recognises a finish request without mistaking a marathon goal", () => {
    expect(isExplicitFinishRequestV3("Prepare my notes")).toBe(true);
    expect(isExplicitFinishRequestV3("I want to finish a marathon")).toBe(false);
  });

  it("allows final persistence only after all required matching topics and enough answers", () => {
    const timestamp = "2026-09-01T00:00:00.000Z";
    const texts = [
      ["assistant", "Hi, welcome to Petey!"],
      ["assistant", "To get you matched with the best personal trainer for you, tell us a bit about what you're hoping to achieve."],
      ["user", "I want to build strength"],
      ["assistant", "What would feeling stronger make easier for you?"],
      ["user", "Daily life and hiking"],
      ["assistant", "Do you have a trainer gender preference, or no preference?"],
      ["user", "No preference"],
      ["assistant", "Which days or times usually suit you best?"],
      ["user", "Weekday evenings"],
      ["assistant", "What budget feels comfortable per session?"],
      ["user", "Around £60"],
      ["assistant", "I have everything I need to prepare your training brief."],
    ] as const;
    const messages = texts.map(([role, text], index) => ({
      id: `message-${index}`,
      role,
      text,
      createdAt: timestamp,
      sequence: index + 1,
    }));
    expect(isTranscriptReadyForFinalizationV4(messages)).toBe(true);
    expect(isTranscriptReadyForFinalizationV4(messages.filter((message) => message.text !== "Around £60")))
      .toBe(false);
  });
});

describe("AI onboarding V3 Markdown profile", () => {
  it("accepts a plain Markdown document and removes a surrounding fence", () => {
    const markdown = normalizeProfileMarkdownV3(`\`\`\`markdown
# Training brief

## The trainee
Wants to build strength for a marathon.

## The trainer
Likes calm, data-informed feedback.

## The sessions
Can train on weekday mornings.
\`\`\``);
    expect(markdown).toContain("## The trainee");
    expect(markdown).not.toContain("```");
  });

  it("rejects structured output instead of storing it as a profile", () => {
    expect(() => normalizeProfileMarkdownV3('{"goal":"Build strength"}')).toThrow(/structured output/i);
  });
});
