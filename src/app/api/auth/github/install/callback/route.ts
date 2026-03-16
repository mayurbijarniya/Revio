import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserAccessToken } from "@/lib/auth";
import {
  syncSingleInstallationForUser,
  syncUserInstallations,
} from "@/lib/services/github-installations";

export async function GET(request: NextRequest) {
  const session = await getSession();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const installationIdParam = request.nextUrl.searchParams.get("installation_id");

  if (!session) {
    return NextResponse.redirect(`${appUrl}/login?error=install_session_missing`);
  }

  const accessToken = await getUserAccessToken(session.userId);
  if (!accessToken) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?error=github_token_missing`);
  }

  try {
    let hasInstallation = false;

    if (installationIdParam) {
      const installationId = Number(installationIdParam);
      if (Number.isFinite(installationId)) {
        hasInstallation = await syncSingleInstallationForUser(
          session.userId,
          accessToken,
          installationId
        );
      }
    }

    if (!hasInstallation) {
      const installations = await syncUserInstallations(session.userId, accessToken);
      hasInstallation = installations.some((installation) => !installation.suspendedAt);
    }

    return NextResponse.redirect(
      `${appUrl}/${hasInstallation ? "dashboard?github_app=installed" : "dashboard/settings?error=install_not_detected"}`
    );
  } catch (error) {
    console.error("GitHub App install callback error:", error);
    return NextResponse.redirect(`${appUrl}/dashboard/settings?error=install_sync_failed`);
  }
}
