import { NextRequest, NextResponse } from "next/server";
import { getSession } from "./session";
import { db } from "./db";
import type { SessionPayload, PublicUser } from "@/types/auth";
import { errorResponse } from "./errors";

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
