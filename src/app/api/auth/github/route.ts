import { NextResponse } from "next/server";
import { GITHUB_OAUTH_CONFIG } from "@/types/auth";

/**
 * GET /api/auth/github
 * Initiates GitHub OAuth flow by redirecting to GitHub authorization page
 */
export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { success: false, error: { code: "AUTH_001", message: "GitHub OAuth not configured" } },
      { status: 500 }
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`;
  const scope = GITHUB_OAUTH_CONFIG.scopes.join(" ");

  // Generate a random state for CSRF protection
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    allow_signup: "true",
  });

  const authUrl = `${GITHUB_OAUTH_CONFIG.authorizationUrl}?${params.toString()}`;

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
