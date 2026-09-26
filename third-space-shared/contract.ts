export type MembershipType = "club" | "wharf" | "group" | "group-plus" | "unknown";

export interface ThirdSpaceClub {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  sourceUrl: string;
  verifiedAt: string;
}

export interface ThirdSpaceTrainer {
  kind: "synthetic" | "sourced";
  id: string;
  name: string;
  clubIds: string[];
  photoUrl: string;
  expertise: string[];
  qualifications: string[];
  summary: string;
  bio: string;
  tier: "personal" | "elite" | null;
  sourceUrl?: string;
  verifiedAt?: string;
}

export interface LondonLocation {
  id: string;
  name: string;
  aliases: string[];
  latitude: number;
  longitude: number;
}

export interface ThirdSpaceBrief {
  goal: string;
  experience: string;
  coachingStyle: string;
  specialistNeeds: string[];
  membership: "member" | "non-member" | "unsure";
  membershipType: MembershipType;
  homeClubIds: string[];
  accessibleClubIds: string[];
  excludedClubIds: string[];
  locationAnchors: string[];
  trainingClubIds?: string[];
  maxDistanceKm?: number | null;
  budget: string;
  additionalPreferences: string[];
}

export interface DemoMessage {
  role: "user" | "assistant";
  content: string;
}

export const TOPICS = ["goal", "experience", "membership", "access", "location", "coaching", "budget"] as const;
export type DemoTopic = (typeof TOPICS)[number];
export interface ThirdSpaceTurn {
  reply: string;
  quickReplies: string[];
  readyForMatching: boolean;
  topic: DemoTopic | "complete";
  coverage: Record<DemoTopic, boolean>;
}

export interface ThirdSpaceMatch {
  trainerId: string;
  clubId: string;
  reasons: string[];
  locationReason: string;
}

export interface ThirdSpaceMatches {
  brief: ThirdSpaceBrief;
  matches: ThirdSpaceMatch[];
  unconfirmed: string[];
  emptyReason?: string;
}

export const BUDGET_QUICK_REPLIES = ["£85–£100", "£100–£125", "Not sure yet"];
export const OPENING_MESSAGE = "What would you like a personal trainer to help you achieve?";
