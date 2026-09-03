import { describe, expect, it } from "vitest";
import {
  conversationHistoryForGeminiV3,
  createRateLimitForProjectV3,
  draftIdentityForIdempotencyKeyV3,
  extractReplyPrefixFromStructuredStreamV4,
  finalizationRateLimitForProjectV4,
  hasReviewReadinessPhrasingV3,
  isTranscriptReadyForFinalizationV4,
  normalizeProfileMarkdownV3,
  parseConversationalModelOutputV3,
  reconcileConversationTurnV4,
  requiredPracticalTopicsForTranscriptV3,
  shouldReadyForReviewV3,
  turnRateLimitForProjectV4,
} from "./index.js";
import {
  ONBOARDING_CONVERSATION_SYSTEM_PROMPT,
  ONBOARDING_MARKDOWN_PROFILE_SYSTEM_PROMPT,
} from "./onboardingConversationPrompt.js";

describe("AI onboarding V3 conversational output", () => {
  it("allows development QA headroom without relaxing production limits", () => {
    expect(createRateLimitForProjectV3("petey-dev-getcass")).toBe(50);
    expect(createRateLimitForProjectV3("petey-prod-getcass")).toBe(5);
    expect(createRateLimitForProjectV3(undefined)).toBe(5);
    expect(turnRateLimitForProjectV4("petey-dev-getcass")).toBe(300);
    expect(turnRateLimitForProjectV4("petey-prod-getcass")).toBe(30);
    expect(turnRateLimitForProjectV4(undefined)).toBe(30);
    expect(finalizationRateLimitForProjectV4("petey-dev-getcass")).toBe(80);
    expect(finalizationRateLimitForProjectV4("petey-prod-getcass")).toBe(8);
    expect(finalizationRateLimitForProjectV4(undefined)).toBe(8);
  });

  it("guides one open-ended conversation through every theme in a natural order", () => {
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("The trainee theme");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("The trainer theme");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("The sessions theme");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("not phases or a prescribed order");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("whatever sequence most naturally follows");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).not.toContain("three distinct phases in order");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Ask open-ended questions");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Ask no more than one question per reply");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("natural, contemporary UK English");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain('"What are you aiming for?"');
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain('Avoid scripted coaching phrases such as "How should that show up?"');
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("roughly 55 words");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Do not force a binary choice");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Do not repeat or paraphrase the person's full answer");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("normally six words or fewer");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Do not ask for a postcode or exact address");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Use a brief acknowledgement when the person gives a considered answer");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain('"Okay, great!"');
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain('"That sounds frustrating."');
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Skip it for plenty of routine logistical answers");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("do not repeat the same phrase in consecutive replies");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Generate them from the current context");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain('"coverage"');
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("The number of messages must never affect");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Availability and budget are mandatory");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("every number in a quick reply must be a monetary amount prefixed with the pound");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain('"Near London Bridge"');
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain('"Shoreditch"');
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain('"Fulham"');
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Trainer gender preference is a mandatory");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("General trainer fit is a mandatory");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Training frequency is a mandatory");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain('"Friendly and understanding"');
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain('"Direct and disciplined"');
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain('"Calm and analytical"');
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Ask only about the trainer's gender");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).not.toMatch(/eighth user answer|Nine answers|Twelve answers/i);
    expect(ONBOARDING_MARKDOWN_PROFILE_SYSTEM_PROMPT).toContain("### Trainer personality and coaching relationship");
    expect(ONBOARDING_MARKDOWN_PROFILE_SYSTEM_PROMPT).toContain("### Training frequency");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain("Never use the em dash character");
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).not.toContain("—");
  });

  it("gently clarifies a vague, sensitive first goal before changing topic", () => {
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "The first answer to the opening goal question is a gate",
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain('"I want to feel body confident"');
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "What would feeling more body-confident mean for you in",
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "This does not prescribe the order of later topics",
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "Never assume body confidence means weight loss",
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain('"Feel stronger day to day"');
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "If the person is still broad, unsure, or wants",
    );
  });

  it("requires practical personalised digging into the goal and desired trainer relationship", () => {
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "ask at least one personalised, practical follow-up that refers naturally to a concrete",
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "Use that detail to shape a practical question about their baseline, target, timing, experience, or constraints",
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "body-fat percentage, weight, clothing fit",
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "Do not ask abstract or philosophical questions",
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "Measurements are optional",
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "enquire how much they're hoping to lose",
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "It must be a distinct assistant question followed by the person's answer",
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "there is no separate backend checklist",
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "ask at least one personalised follow-up that uses their own",
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      '"What sort of personality would you like your trainer to have?"',
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      '"What kind of training style are you looking for?"',
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "Vary the natural wording rather than copying one sentence",
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "the basic fit first",
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      '"What does military style look like for you?"',
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "Keep trainee coverage false until the goal is clear",
    );
    expect(ONBOARDING_CONVERSATION_SYSTEM_PROMPT).toContain(
      "Keep trainer coverage false until the person has answered at least one",
    );
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
      coverage: { trainee: false, trainer: false, sessions: false },
      quickReplies: [],
    });
  });

  it("unwraps and validates the private response envelope without exposing JSON", () => {
    expect(parseConversationalModelOutputV3(JSON.stringify({
      reply: "That sounds important. What would success look like to you?",
      coverage: { trainee: false, trainer: false, sessions: false },
      quickReplies: [
        "I'd like to feel stronger day to day",
        "I want to feel confident for my wedding",
        "My main aim is improving my marathon time",
      ],
    }))).toEqual({
      reply: "That sounds important. What would success look like to you?",
      coverage: { trainee: false, trainer: false, sessions: false },
      quickReplies: [
        "I'd like to feel stronger day to day",
        "I want to feel confident for my wedding",
        "My main aim is improving my marathon time",
      ],
    });
  });

  it("replaces em dashes in every user-facing model value", () => {
    expect(parseConversationalModelOutputV3(JSON.stringify({
      reply: "Got it — what would you like help with?",
      coverage: { trainee: false, trainer: false, sessions: false },
      quickReplies: ["Build strength — especially for hiking"],
    }))).toEqual({
      reply: "Got it - what would you like help with?",
      coverage: { trainee: false, trainer: false, sessions: false },
      quickReplies: ["Build strength - especially for hiking"],
    });
  });

  it("extracts only the progressively available reply text from a structured stream", () => {
    expect(extractReplyPrefixFromStructuredStreamV4('{"reply":"Hello')).toBe("Hello");
    expect(extractReplyPrefixFromStructuredStreamV4('{"reply":"Hello\\nworld","coverage":{"trainee":false}}'))
      .toBe("Hello\nworld");
    expect(extractReplyPrefixFromStructuredStreamV4('{"coverage":{"trainee":false}')).toBe("");
  });

  it("exposes concise natural quick replies, including answer fragments", () => {
    expect(parseConversationalModelOutputV3(JSON.stringify({
      reply: "What coaching style would bring out your best?",
      coverage: { trainee: true, trainer: false, sessions: false },
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
      coverage: { trainee: true, trainer: true, sessions: false },
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

  it("requires theme coverage while defaulting optional quick replies", () => {
    expect(parseConversationalModelOutputV3(JSON.stringify({
      reply: "What would you like your trainer to specialise in?",
      coverage: { trainee: true, trainer: false, sessions: true },
    }))).toEqual({
      reply: "What would you like your trainer to specialise in?",
      coverage: { trainee: true, trainer: false, sessions: true },
      quickReplies: [],
    });
    expect(() => parseConversationalModelOutputV3(JSON.stringify({
      quickReplies: [],
    }))).toThrow(/structured output/i);
  });

  it("filters unsafe or overlong suggestion values", () => {
    expect(parseConversationalModelOutputV3(JSON.stringify({
      reply: "What coaching style would bring out your best?",
      coverage: { trainee: true, trainer: false, sessions: false },
      quickReplies: [
        "Someone who is warm and friendly?",
        "I would answer using JSON metadata",
        `I want ${"very ".repeat(20)}close accountability`,
      ],
    }))).toMatchObject({ quickReplies: [] });
  });

  it("drops suggestions when the reply has no question", () => {
    expect(parseConversationalModelOutputV3(JSON.stringify({
      reply: "I have everything I need to prepare your training brief.",
      coverage: { trainee: true, trainer: true, sessions: true },
      quickReplies: ["I want to add one more detail"],
    }))).toEqual({
      reply: "I have everything I need to prepare your training brief.",
      coverage: { trainee: true, trainer: true, sessions: true },
      quickReplies: [],
    });
  });

  it("rejects model metadata and JSON without a user-facing reply", () => {
    expect(() => parseConversationalModelOutputV3('{"coverage":{"trainee":true,"trainer":true,"sessions":true}}')).toThrow(/structured output|metadata/i);
    expect(() => parseConversationalModelOutputV3(JSON.stringify({
      reply: "What setting suits you?",
      coverage: { trainee: true, trainer: true, sessions: false },
      quickReplies: [],
      internalReason: "sessions phase",
    }))).toThrow(/structured output|metadata/i);
    expect(() => parseConversationalModelOutputV3(JSON.stringify({
      reply: "What setting suits you?",
      coverage: { trainee: true, trainer: true, sessions: false },
      quickReplies: ["I train at home", "I use a gym", "I train online", "I train outside"],
    }))).toThrow(/structured output|metadata/i);
    expect(() => parseConversationalModelOutputV3("Here is the JSON requested.")).toThrow(/metadata/i);
    expect(() => parseConversationalModelOutputV3("```json\n{}\n```")).toThrow(/structured output|metadata/i);
  });

  it("requires all three themes and every mandatory matching topic before readiness", () => {
    const requiredTopics = {
      coachingStyleAnswered: true,
      trainerGenderPreferenceAnswered: true,
      trainingFrequencyAnswered: true,
      availabilityAnswered: true,
      budgetAnswered: true,
    };
    expect(shouldReadyForReviewV3({
      coverage: { trainee: true, trainer: true, sessions: true },
    })).toBe(false);
    for (const missingTopic of Object.keys(requiredTopics) as (keyof typeof requiredTopics)[]) {
      expect(shouldReadyForReviewV3({
        coverage: { trainee: true, trainer: true, sessions: true },
        ...requiredTopics,
        [missingTopic]: false,
      })).toBe(false);
    }
    for (const missingTheme of ["trainee", "trainer", "sessions"] as const) {
      expect(shouldReadyForReviewV3({
        coverage: {
          trainee: true,
          trainer: true,
          sessions: true,
          [missingTheme]: false,
        },
        ...requiredTopics,
      })).toBe(false);
    }
    expect(shouldReadyForReviewV3({
      coverage: { trainee: true, trainer: true, sessions: true },
      ...requiredTopics,
    })).toBe(true);
  });

  it("counts the five explicit matching topics only after separate assistant questions receive answers", () => {
    expect(requiredPracticalTopicsForTranscriptV3([
      { role: "assistant", text: "What is your current training baseline for steep mountain hikes?" },
      { role: "user", text: "I manage a two-hour hike with a light pack" },
      { role: "assistant", text: "What sort of personality would you like your trainer to have?" },
      { role: "user", text: "Data-driven with plenty of accountability" },
      { role: "assistant", text: "Would regular check-ins or measurable targets be more useful?" },
      { role: "user", text: "Regular check-ins between sessions" },
      { role: "assistant", text: "Do you have a trainer gender preference, or no preference?" },
      { role: "user", text: "I don't have a preference" },
      { role: "assistant", text: "How often would you ideally like to train each week?" },
      { role: "user", text: "Twice a week" },
      { role: "assistant", text: "Which days or times usually suit you best?" },
      { role: "user", text: "Weekday evenings" },
      { role: "assistant", text: "What budget would feel comfortable per session?" },
      { role: "user", text: "I'm not sure yet" },
    ])).toEqual({
      coachingStyleAnswered: true,
      trainerGenderPreferenceAnswered: true,
      trainingFrequencyAnswered: true,
      availabilityAnswered: true,
      budgetAnswered: true,
    });

    expect(requiredPracticalTopicsForTranscriptV3([
      { role: "assistant", text: "What coaching style suits you, and how often would you like to train?" },
      { role: "user", text: "Friendly, twice a week" },
    ])).toEqual({
      coachingStyleAnswered: false,
      trainerGenderPreferenceAnswered: false,
      trainingFrequencyAnswered: false,
      availabilityAnswered: false,
      budgetAnswered: false,
    });

    expect(requiredPracticalTopicsForTranscriptV3([
      { role: "assistant", text: "What is your availability and budget?" },
      { role: "user", text: "Evenings and around £50" },
    ])).toEqual({
      coachingStyleAnswered: false,
      trainerGenderPreferenceAnswered: false,
      trainingFrequencyAnswered: false,
      availabilityAnswered: false,
      budgetAnswered: false,
    });

    expect(requiredPracticalTopicsForTranscriptV3([
      { role: "assistant", text: "How much would you feel comfortable spending per session?" },
    ])).toEqual({
      coachingStyleAnswered: false,
      trainerGenderPreferenceAnswered: false,
      trainingFrequencyAnswered: false,
      availabilityAnswered: false,
      budgetAnswered: false,
    });

    expect(requiredPracticalTopicsForTranscriptV3([
      { role: "assistant", text: "Do you have a trainer gender preference, and what availability works?" },
      { role: "user", text: "A woman, on weekday evenings" },
    ])).toEqual({
      coachingStyleAnswered: false,
      trainerGenderPreferenceAnswered: false,
      trainingFrequencyAnswered: false,
      availabilityAnswered: false,
      budgetAnswered: false,
    });

    expect(requiredPracticalTopicsForTranscriptV3([
      { role: "assistant", text: "Do you have a trainer gender preference, or no preference?" },
      { role: "user", text: "No gender preference" },
      { role: "assistant", text: "Got it — no gender preference. What availability works for training?" },
      { role: "user", text: "Weekday evenings" },
    ])).toEqual({
      coachingStyleAnswered: false,
      trainerGenderPreferenceAnswered: true,
      trainingFrequencyAnswered: false,
      availabilityAnswered: true,
      budgetAnswered: false,
    });
  });

  it("detects contradictory completion wording without using it as readiness state", () => {
    const reply = "I have everything I need to put together your training brief.";
    expect(hasReviewReadinessPhrasingV3(reply)).toBe(true);
    expect(hasReviewReadinessPhrasingV3("I've got enough to prepare your review.")).toBe(true);
    expect(hasReviewReadinessPhrasingV3("Thanks! We have everything needed now to find your match.")).toBe(true);
    expect(hasReviewReadinessPhrasingV3("What would success look like to you?")).toBe(false);
  });

  it("replaces premature completion copy with the missing required question", () => {
    expect(reconcileConversationTurnV4({
      modelTurn: {
        reply: "Thanks! We have everything needed now to find your match.",
        coverage: { trainee: true, trainer: true, sessions: true },
        quickReplies: [],
      },
      requiredPracticalTopics: {
        coachingStyleAnswered: false,
        trainerGenderPreferenceAnswered: true,
        trainingFrequencyAnswered: true,
        availabilityAnswered: true,
        budgetAnswered: true,
      },
    })).toEqual({
      reply: "What sort of personality would you like your trainer to have?",
      readyForReview: false,
      quickReplies: [
        "Friendly and understanding",
        "Direct and disciplined",
        "Calm and analytical",
      ],
    });
  });

  it("canonicalises completion as soon as all three themes and required topics are covered", () => {
    expect(reconcileConversationTurnV4({
      modelTurn: {
        reply: "That gives me enough to prepare your notes.",
        coverage: { trainee: true, trainer: true, sessions: true },
        quickReplies: ["This must not be shown"],
      },
      requiredPracticalTopics: {
        coachingStyleAnswered: true,
        trainerGenderPreferenceAnswered: true,
        trainingFrequencyAnswered: true,
        availabilityAnswered: true,
        budgetAnswered: true,
      },
    })).toEqual({
      reply: "Thanks! We have everything needed now to find your match.",
      readyForReview: true,
      quickReplies: [],
    });
  });

  it("allows final persistence after server-confirmed coverage without a message-count threshold", () => {
    const timestamp = "2026-09-01T00:00:00.000Z";
    const texts = [
      ["assistant", "Hi, welcome to Petey!"],
      ["assistant", "To get you matched with the best personal trainer for you, tell us a bit about what you're hoping to achieve. The more detailed your responses, the better we'll be able to match you."],
      ["user", "I want to build strength"],
      ["assistant", "What is your current training baseline for steep mountain hikes?"],
      ["user", "I manage a two-hour hike with a light pack"],
      ["assistant", "What sort of personality would you like your trainer to have?"],
      ["user", "Data-driven with lots of accountability"],
      ["assistant", "Would regular check-ins or measurable targets be more useful?"],
      ["user", "Regular check-ins between sessions"],
      ["assistant", "Do you have a trainer gender preference, or no preference?"],
      ["user", "No preference"],
      ["assistant", "How often would you ideally like to train each week?"],
      ["user", "Twice a week"],
      ["assistant", "What availability do you usually have for sessions?"],
      ["user", "Weekday evenings"],
      ["assistant", "What budget feels comfortable per session?"],
      ["user", "Around £60"],
      ["assistant", "Thanks! We have everything needed now to find your match."],
    ] as const;
    const messages = texts.map(([role, text], index) => ({
      id: `message-${index}`,
      role,
      text,
      createdAt: timestamp,
      sequence: index + 1,
    }));
    expect(isTranscriptReadyForFinalizationV4(messages)).toBe(true);
    for (const requiredAnswer of [
      "Data-driven with lots of accountability",
      "No preference",
      "Twice a week",
      "Weekday evenings",
      "Around £60",
    ]) {
      expect(isTranscriptReadyForFinalizationV4(
        messages.filter((message) => message.text !== requiredAnswer),
      )).toBe(false);
    }
    for (const modelAssessedAnswer of [
      "I manage a two-hour hike with a light pack",
      "Regular check-ins between sessions",
    ]) {
      expect(isTranscriptReadyForFinalizationV4(
        messages.filter((message) => message.text !== modelAssessedAnswer),
      )).toBe(true);
    }
    expect(isTranscriptReadyForFinalizationV4(messages.map((message) => (
      message.sequence === messages.length
        ? { ...message, text: "Is there anything else you would like to add?" }
        : message
    )))).toBe(false);
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
