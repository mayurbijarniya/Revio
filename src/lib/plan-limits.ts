/**
 * Plan limit checking utilities
 */
import { db } from "@/lib/db";
import { PLAN_LIMITS, RATE_LIMITS } from "@/lib/constants";

export type Plan = keyof typeof PLAN_LIMITS;

export interface UsageStats {
  repositories: number;
  prReviewsThisMonth: number;
  messagesThisMonth: number;
}

export interface LimitStatus {
  exceeded: boolean;
  current: number;
  limit: number;
  plan: Plan;
}

export interface RateLimitStatus {
  exceeded: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Get user's current plan
 */
export async function getUserPlan(userId: string): Promise<Plan> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  return (user?.plan || "free") as Plan;
}

/**
 * Get user's usage statistics for the current month
 */
export async function getUserUsage(userId: string): Promise<UsageStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get user's repositories
  const repoCount = await db.repository.count({
    where: { userId },
  });

  // Count PR reviews this month through repositories
  const prReviewsCount = await db.prReview.count({
    where: {
      repository: { userId },
      createdAt: { gte: startOfMonth },
    },
  });

  // Count messages this month through conversations
  const messagesCount = await db.message.count({
    where: {
      conversation: { userId },
      role: "user",
      createdAt: { gte: startOfMonth },
    },
  });

  return {
    repositories: repoCount,
    prReviewsThisMonth: prReviewsCount,
    messagesThisMonth: messagesCount,
  };
}

/**
 * Check if user has exceeded repository limit
 */
export async function checkRepoLimit(userId: string): Promise<LimitStatus> {
  const plan = await getUserPlan(userId);
  const usage = await getUserUsage(userId);
  const limit = PLAN_LIMITS[plan].repos;

  return {
    exceeded: limit !== -1 && usage.repositories >= limit,
    current: usage.repositories,
    limit: limit === -1 ? Infinity : limit,
    plan,
  };
}

/**
 * Check if user has exceeded PR review limit for this month
 */
export async function checkPrReviewLimit(userId: string): Promise<LimitStatus> {
  const plan = await getUserPlan(userId);
  const usage = await getUserUsage(userId);
  const limit = PLAN_LIMITS[plan].reviewsPerMonth;

  return {
    exceeded: limit !== -1 && usage.prReviewsThisMonth >= limit,
    current: usage.prReviewsThisMonth,
    limit: limit === -1 ? Infinity : limit,
    plan,
  };
}

/**
 * Check if user has exceeded chat message limit for this month
 */
export async function checkMessageLimit(userId: string): Promise<LimitStatus> {
  const plan = await getUserPlan(userId);
  const usage = await getUserUsage(userId);
  const limit = PLAN_LIMITS[plan].messagesPerMonth;

  return {
    exceeded: limit !== -1 && usage.messagesThisMonth >= limit,
    current: usage.messagesThisMonth,
    limit: limit === -1 ? Infinity : limit,
    plan,
  };
}

/**
 * Get rate limit status for a user
 */
export function getRateLimitStatus(plan: Plan): RateLimitStatus {
  const limits = RATE_LIMITS[plan];
  return {
    exceeded: false,
    remaining: limits.apiRequestsPerHour,
    resetAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
  };
}

/**
 * Check all limits and return a comprehensive status
 */
export async function checkAllLimits(userId: string) {
  const plan = await getUserPlan(userId);
  const usage = await getUserUsage(userId);

  const limits = PLAN_LIMITS[plan];

  return {
    plan,
    usage,
    limits: {
      repos: {
        exceeded: limits.repos !== -1 && usage.repositories >= limits.repos,
        current: usage.repositories,
        limit: limits.repos === -1 ? Infinity : limits.repos,
      },
      prReviews: {
        exceeded: limits.reviewsPerMonth !== -1 && usage.prReviewsThisMonth >= limits.reviewsPerMonth,
        current: usage.prReviewsThisMonth,
        limit: limits.reviewsPerMonth === -1 ? Infinity : limits.reviewsPerMonth,
      },
      messages: {
        exceeded: limits.messagesPerMonth !== -1 && usage.messagesThisMonth >= limits.messagesPerMonth,
        current: usage.messagesThisMonth,
        limit: limits.messagesPerMonth === -1 ? Infinity : limits.messagesPerMonth,
      },
    },
  };
}
