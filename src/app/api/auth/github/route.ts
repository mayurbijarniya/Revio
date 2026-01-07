import { NextResponse } from "next/server";

/**
 * GET /api/auth/github
 * Initiates GitHub App installation flow
 * This combines OAuth + App installation in one step
 */
export async function GET() {
  const appClientId = process.env.GITHUB_APP_CLIENT_ID;

  if (!appClientId) {
    return NextResponse.json(
      { success: false, error: { code: "AUTH_001", message: "GitHub App not configured" } },
      { status: 500 }
    );
  }

  // Generate a random state for CSRF protection
  const state = crypto.randomUUID();

  // Use GitHub App installation URL
  // This will prompt user to install the app AND authorize OAuth in one flow
  const installUrl = `https://github.com/apps/revio-bot/installations/new?state=${state}`;

  // Create response with redirect
  const response = NextResponse.redirect(installUrl);

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
