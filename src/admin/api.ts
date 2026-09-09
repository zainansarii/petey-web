import type {
  ApplicationDetail, ApplicationPage, ApplicationStatus, ReviewAccess, ReviewDecision, ReviewDraft, Verification,
} from "../features/trainerApplications/model";
import { callReviewFunction } from "./auth";
import type { MarketplaceRequest } from "../features/marketplace/model";

export interface ReviewApi {
  marketplace?<T>(request: MarketplaceRequest): Promise<T>;
  access(): Promise<ReviewAccess>;
  list(request: { status?: ApplicationStatus; cursor?: string }): Promise<ApplicationPage>;
  detail(applicationId: string): Promise<ApplicationDetail>;
  save(request: { applicationId: string; expectedVersion: number; draft: ReviewDraft; verification: Verification }): Promise<ApplicationDetail>;
  decide(request: { applicationId: string; expectedVersion: number; decision: ReviewDecision; reason?: string; requestId: string }): Promise<ApplicationDetail>;
}

export const isReviewFixture = () => import.meta.env.DEV && new URLSearchParams(window.location.search).get("adminFixture") === "1";
const fixture = () => import.meta.env.DEV ? import("./fixture") : Promise.reject(new Error("Review fixtures are only available in development."));

export const reviewApi: ReviewApi = {
  marketplace: request => callReviewFunction("webMarketplaceV1", request),
  access: async () => isReviewFixture() ? (await fixture()).fixtureApi.access() : callReviewFunction("getWebTrainerReviewAccessV1", {}),
  list: async (request) => isReviewFixture() ? (await fixture()).fixtureApi.list(request) : callReviewFunction("listWebTrainerApplicationsV1", request),
  detail: async (applicationId) => isReviewFixture() ? (await fixture()).fixtureApi.detail(applicationId) : callReviewFunction("getWebTrainerApplicationV1", { applicationId }),
  save: async (request) => isReviewFixture() ? (await fixture()).fixtureApi.save(request) : callReviewFunction("saveWebTrainerApplicationV1", request),
  decide: async (request) => isReviewFixture() ? (await fixture()).fixtureApi.decide(request) : callReviewFunction("reviewWebTrainerApplicationV1", request),
};
