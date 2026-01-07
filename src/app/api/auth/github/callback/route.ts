import { NextRequest, NextResponse } from "next/server";
import {
  GITHUB_OAUTH_CONFIG,
  GitHubUserSchema,
  GitHubEmailSchema,
  GitHubTokenResponseSchema,
} from "@/types/auth";
import { upsertUser } from "@/lib/auth";
import { createSession } from "@/lib/session";

/**
 * GET /api/auth/github/callback
 * Handles GitHub OAuth callback, exchanges code for token, creates/updates user
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Handle OAuth errors from GitHub
  if (error) {
    const errorDescription = searchParams.get("error_description") || "OAuth failed";
    console.error("GitHub OAuth error:", error, errorDescription);
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(errorDescription)}`);
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/login?error=missing_params`);
  }

  // Verify state to prevent CSRF
  const storedState = request.cookies.get("oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${appUrl}/login?error=invalid_state`);
  }

  try {
    // Exchange code for access token using GitHub App credentials
    const tokenResponse = await fetch(GITHUB_OAUTH_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_APP_CLIENT_ID,
        client_secret: process.env.GITHUB_APP_CLIENT_SECRET,
        code,
        redirect_uri: `${appUrl}/api/auth/github/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", await tokenResponse.text());
      return NextResponse.redirect(`${appUrl}/login?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();

    // Check for error in token response
    if (tokenData.error) {
      console.error("Token error:", tokenData.error_description);
      return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
    }

    const parsedToken = GitHubTokenResponseSchema.parse(tokenData);

    // Fetch user profile from GitHub
    const userResponse = await fetch(GITHUB_OAUTH_CONFIG.userUrl, {
      headers: {
        Authorization: `Bearer ${parsedToken.access_token}`,
        Accept: "application/json",
      },
    });

    if (!userResponse.ok) {
      console.error("User fetch failed:", await userResponse.text());
      return NextResponse.redirect(`${appUrl}/login?error=user_fetch_failed`);
    }

    const userData = await userResponse.json();
    const githubUser = GitHubUserSchema.parse(userData);

    // Fetch user emails if primary email not in profile
    let email = githubUser.email;
    if (!email) {
      const emailsResponse = await fetch(GITHUB_OAUTH_CONFIG.emailsUrl, {
        headers: {
          Authorization: `Bearer ${parsedToken.access_token}`,
          Accept: "application/json",
        },
      });

      if (emailsResponse.ok) {
        const emails = await emailsResponse.json();
        const primaryEmail = emails.find(
          (e: { primary: boolean; verified: boolean }) => e.primary && e.verified
        );
        if (primaryEmail) {
          const parsed = GitHubEmailSchema.parse(primaryEmail);
          email = parsed.email;
        }
      }
    }

    // Create or update user in database
    const user = await upsertUser({
      githubId: githubUser.id,
      githubUsername: githubUser.login,
      email,
      avatarUrl: githubUser.avatar_url,
      accessToken: parsedToken.access_token,
      refreshToken: parsedToken.refresh_token,
      tokenExpiresAt: parsedToken.expires_in
        ? new Date(Date.now() + parsedToken.expires_in * 1000)
        : undefined,
    });

    // Create session token
    const sessionToken = await createSession(user);

    // Set session cookie and redirect to dashboard
    const response = NextResponse.redirect(`${appUrl}/dashboard`);

    // Clear OAuth state cookie
    response.cookies.delete("oauth_state");

    // Set session cookie
    response.cookies.set("revio_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(`${appUrl}/login?error=callback_failed`);
  }
}
