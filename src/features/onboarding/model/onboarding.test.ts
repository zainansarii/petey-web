import { describe, expect, it } from "vitest";
import {
  ONBOARDING_OPENING_MESSAGES,
  ONBOARDING_OPENING_QUICK_REPLIES,
  conversationProgress,
  identityAnswersSchema,
  profileMarkdownSchema,
} from "./onboarding";

describe("onboarding V3 Markdown contract", () => {
  it("uses the requested welcome and outcome-led examples", () => {
    expect(ONBOARDING_OPENING_MESSAGES).toEqual([
      "Hi, welcome to Petey!",
      "To get you matched with the best personal trainer for you, tell us a bit about what you're hoping to achieve.",
    ]);
    expect(ONBOARDING_OPENING_QUICK_REPLIES).toEqual([
      "I want to build strength",
      "Help train for a marathon",
      "I want to lose weight before my wedding",
    ]);
  });

  it("accepts one useful editable Markdown training brief", () => {
    const result = profileMarkdownSchema.safeParse(`# Training brief

## The trainee
Wants to build strength for everyday life.

## The trainer
Responds best to patient, data-informed coaching.

## The sessions
Usually free on weekday mornings.`);
    expect(result.success).toBe(true);
  });

  it("rejects an empty or implausibly short training brief", () => {
    expect(profileMarkdownSchema.safeParse("").success).toBe(false);
    expect(profileMarkdownSchema.safeParse("Not sure").success).toBe(false);
  });

  it("keeps identity separate and validates it independently", () => {
    expect(identityAnswersSchema.safeParse({
      fullName: "Sam Taylor",
      dateOfBirth: "01/01/1990",
      email: "sam@example.com",
    }).success).toBe(true);
    expect(identityAnswersSchema.safeParse({
      fullName: "Sam Taylor",
      dateOfBirth: "01/01/2015",
      email: "sam@example.com",
    }).success).toBe(false);
  });

  it("advances a bounded conversational progress percentage and completes at handoff", () => {
    expect(conversationProgress("collecting", 0)).toEqual({ percent: 12, isComplete: false });
    expect(conversationProgress("collecting", 1).percent).toBeGreaterThan(12);
    expect(conversationProgress("collecting", 8).percent).toBeGreaterThan(conversationProgress("collecting", 7).percent);
    expect(conversationProgress("collecting", 50)).toEqual({ percent: 96, isComplete: false });
    expect(conversationProgress("ready_to_map", 8)).toEqual({ percent: 100, isComplete: true });
    expect(conversationProgress("review", 8)).toEqual({ percent: 100, isComplete: true });
  });
});
