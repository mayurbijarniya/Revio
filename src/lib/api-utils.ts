import { NextRequest, NextResponse } from "next/server";
import { getSession } from "./session";
import { db } from "./db";
import type { SessionPayload, PublicUser } from "@/types/auth";
import { errorResponse } from "./errors";
import {
  checkRepoLimit,
  checkPrReviewLimit,
  checkMessageLimit,
  getUserPlan,
} from "./plan-limits";

/**
 * Authentication context for API routes
 */
export interface AuthContext {
  session: SessionPayload;
  user: PublicUser;
}

/**
 * Wrapper for authenticated API routes
 */
export function withAuth<T>(
  handler: (
    request: NextRequest,
    context: AuthContext,
    params?: T
  ) => Promise<Response>
) {
  return async (request: NextRequest, params?: T): Promise<Response> => {
    const session = await getSession();

    if (!session) {
      return errorResponse("AUTH_002", 401);
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        githubId: true,
        githubUsername: true,
        email: true,
        avatarUrl: true,
        plan: true,
        createdAt: true,
      },
    });

    if (!user) {
      return errorResponse("AUTH_002", 401);
    }

    const publicUser: PublicUser = {
      id: user.id,
      githubId: user.githubId,
      githubUsername: user.githubUsername,
      email: user.email,
      avatarUrl: user.avatarUrl,
      plan: user.plan,
      createdAt: user.createdAt,
    };

    return handler(request, { session, user: publicUser }, params);
  };
}

/**
 * Wrapper for optional auth (user may or may not be logged in)
 */
export function withOptionalAuth<T>(
  handler: (
    request: NextRequest,
    context: AuthContext | null,
    params?: T
  ) => Promise<Response>
) {
  return async (request: NextRequest, params?: T): Promise<Response> => {
    const session = await getSession();

    if (!session) {
      return handler(request, null, params);
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        githubId: true,
        githubUsername: true,
        email: true,
        avatarUrl: true,
        plan: true,
        createdAt: true,
      },
    });

    if (!user) {
      return handler(request, null, params);
    }

    const publicUser: PublicUser = {
      id: user.id,
      githubId: user.githubId,
      githubUsername: user.githubUsername,
      email: user.email,
      avatarUrl: user.avatarUrl,
      plan: user.plan,
      createdAt: user.createdAt,
    };

    return handler(request, { session, user: publicUser }, params);
  };
}

/**
 * Check if user has exceeded their plan limits for a specific action
 */
export type LimitType = "repos" | "prReviews" | "messages";

export async function checkPlanLimit(
  userId: string,
  type: LimitType
): Promise<{ allowed: boolean; error?: NextResponse }> {
  const plan = await getUserPlan(userId);

  switch (type) {
    case "repos": {
      const status = await checkRepoLimit(userId);
      if (status.exceeded) {
        return {
          allowed: false,
          error: jsonError(
            "LIMIT_003",
            `Repository limit reached (${status.current}/${status.limit} repos on ${plan.toUpperCase()} plan). Upgrade to add more repositories.`,
            403
          ),
        };
      }
      break;
    }
    case "prReviews": {
      const status = await checkPrReviewLimit(userId);
      if (status.exceeded) {
        return {
          allowed: false,
          error: jsonError(
            "LIMIT_001",
            `Monthly PR review limit reached (${status.current}/${status.limit} on ${plan.toUpperCase()} plan). Upgrade for more reviews.`,
            403
          ),
        };
      }
      break;
    }
    case "messages": {
      const status = await checkMessageLimit(userId);
      if (status.exceeded) {
        return {
          allowed: false,
          error: jsonError(
            "LIMIT_002",
            `Monthly message limit reached (${status.current}/${status.limit} on ${plan.toUpperCase()} plan). Upgrade for more messages.`,
            403
          ),
        };
      }
      break;
    }
  }

  return { allowed: true };
}

/**
 * Get formatted limit info for response headers or debugging
 */
export async function getLimitInfo(userId: string, type: LimitType) {
  const plan = await getUserPlan(userId);

  switch (type) {
    case "repos": {
      const status = await checkRepoLimit(userId);
      return {
        type: "repos",
        plan,
        current: status.current,
        limit: status.limit === Infinity ? "unlimited" : status.limit,
      };
    }
    case "prReviews": {
      const status = await checkPrReviewLimit(userId);
      return {
        type: "prReviews",
        plan,
        current: status.current,
        limit: status.limit === Infinity ? "unlimited" : status.limit,
        period: "month",
      };
    }
    case "messages": {
      const status = await checkMessageLimit(userId);
      return {
        type: "messages",
        plan,
        current: status.current,
        limit: status.limit === Infinity ? "unlimited" : status.limit,
        period: "month",
      };
    }
  }
}

/**
 * Standard JSON success response
 */
export function jsonSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Standard JSON error response
 */
export function jsonError(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, ...(details && { details }) },
    },
    { status }
  );
}
