import { NextRequest, NextResponse } from "next/server";
import { buildGitHubAppInstallUrl } from "@/lib/services/github-installations";

/**
 * GET /api/auth/github
 * Initiates GitHub OAuth flow
 *
 * Query params:
 * - install=true: Force GitHub App installation flow (for reinstalling or first-time setup)
 *
 * Flow:
 * - Default: Use standard OAuth flow
 * - With ?install=true: Redirect to GitHub App installation page
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

  // Generate a random state for CSRF protection
  const state = crypto.randomUUID();

  let authUrl: string;

  if (forceInstall) {
    authUrl = buildGitHubAppInstallUrl(state);
  } else {
    // Default: Use standard OAuth flow first. The callback decides whether to
    // continue to the dashboard or send the user to the GitHub App install flow.
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
