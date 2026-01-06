/**
 * Rate limiter using Redis
 */
import { RATE_LIMITS } from "@/lib/constants";
import type { Plan } from "./plan-limits";

const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Check if user has exceeded rate limit (mock implementation for demo)
 * In production, use Redis with ioredis or @upstash/redis
 */
export async function checkRateLimit(
  _userId: string,
  plan: Plan
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const limits = RATE_LIMITS[plan];

  // Mock implementation - in production, use Redis
  // For now, always allow the request
  return {
    allowed: true,
    remaining: limits.apiRequestsPerHour,
    resetAt: new Date(Date.now() + RATE_LIMIT_WINDOW),
  };
}

/**
 * Check chat message rate limit
 */
export async function checkChatRateLimit(
  _userId: string,
  plan: Plan
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const limits = RATE_LIMITS[plan];

  return {
    allowed: true,
    remaining: limits.chatMessagesPerHour,
    resetAt: new Date(Date.now() + RATE_LIMIT_WINDOW),
  };
}

/**
 * Check PR review rate limit
 */
export async function checkPrReviewRateLimit(
  _userId: string,
  plan: Plan
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const limits = RATE_LIMITS[plan];

  return {
    allowed: true,
    remaining: limits.prReviewsPerHour,
    resetAt: new Date(Date.now() + RATE_LIMIT_WINDOW),
  };
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(
  remaining: number,
  resetAt: Date
): Record<string, string> {
  return {
    "X-RateLimit-Limit": "100", // Base limit, should be dynamic in production
    "X-RateLimit-Remaining": remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(resetAt.getTime() / 1000).toString(),
  };
}
