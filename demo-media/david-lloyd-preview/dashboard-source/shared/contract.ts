export interface DavidLloydClub {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  sourceUrl: string;
  verifiedAt: string;
}

export interface DavidLloydTrainer {
  kind: "synthetic" | "sourced";
  id: string;
  name: string;
  clubIds: string[];
  photoUrl: string;
  expertise: string[];
  qualifications: string[];
  summary: string;
  bio: string;
  tier: null;
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

export interface DavidLloydBrief {
  goal: string;
  experience: string;
  coachingStyle: string;
  specialistNeeds: string[];
  membership: "member" | "non-member" | "unsure";
  membershipPackage: string;
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
export interface DavidLloydTurn {
  reply: string;
  quickReplies: string[];
  readyForMatching: boolean;
  topic: DemoTopic | "complete";
  coverage: Record<DemoTopic, boolean>;
}

export interface DavidLloydMatch {
  trainerId: string;
  clubId: string;
  reasons: string[];
  locationReason: string;
}

export interface DavidLloydMatches {
  brief: DavidLloydBrief;
  matches: DavidLloydMatch[];
  unconfirmed: string[];
  emptyReason?: string;
}

export const BUDGET_QUICK_REPLIES = ["Not sure yet", "Flexible"];
export const LOCATION_QUICK_REPLIES = ["Wimbledon", "Kingston", "Earlsfield"];
export const OPENING_MESSAGE = "What would you like a personal trainer to help you achieve?";
