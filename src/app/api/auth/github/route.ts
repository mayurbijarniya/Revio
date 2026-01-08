import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/session";

/**
 * GET /api/auth/github
 * Initiates GitHub OAuth flow
 *
 * Query params:
 * - install=true: Force GitHub App installation flow (for new users or reinstalling)
 *
 * Flow:
 * - New users or ?install=true: Redirect to GitHub App installation
 * - Returning users: Use standard OAuth flow
 */
export async function GET(request: NextRequest) {
  const appClientId = process.env.GITHUB_APP_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!appClientId) {
    return NextResponse.json(
      { success: false, error: { code: "AUTH_001", message: "GitHub App not configured" } },
      { status: 500 }
    );
  }

  // Check if install flow is explicitly requested
  const searchParams = request.nextUrl.searchParams;
  const forceInstall = searchParams.get("install") === "true";

  // Check if user is already logged in and exists in DB
  let isReturningUser = false;
  try {
    const sessionToken = request.cookies.get("revio_session")?.value;
    if (sessionToken) {
      const session = await verifySession(sessionToken);
      if (session) {
        const user = await db.user.findUnique({
          where: { id: session.userId },
          select: { id: true },
        });
        isReturningUser = !!user;
      }
    }
  } catch {
    // Session invalid or expired, treat as new user
  }

  // Generate a random state for CSRF protection
  const state = crypto.randomUUID();

  let authUrl: string;

  if (forceInstall || !isReturningUser) {
    // New users or explicit install request: Use GitHub App installation URL
    // This will prompt user to install the app AND authorize OAuth in one flow
    authUrl = `https://github.com/apps/revio-bot/installations/new?state=${state}`;
  } else {
    // Returning users: Use standard OAuth flow (faster, no install prompt)
    const scopes = ["read:user", "user:email", "repo"];
    authUrl = `https://github.com/login/oauth/authorize?client_id=${appClientId}&redirect_uri=${encodeURIComponent(`${appUrl}/api/auth/github/callback`)}&scope=${scopes.join(" ")}&state=${state}`;
  }

  // Create response with redirect
  const response = NextResponse.redirect(authUrl);

  // Store state in cookie for verification in callback
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  return response;
}
