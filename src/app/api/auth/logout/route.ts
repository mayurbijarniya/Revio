import { NextResponse } from "next/server";
import { deleteSessionCookie } from "@/lib/session";

/**
 * POST /api/auth/logout
 * Logs out the current user by clearing the session cookie
 */
export async function POST() {
  await deleteSessionCookie();

  return NextResponse.json({
    success: true,
    data: { message: "Logged out successfully" },
  });
}

/**
 * GET /api/auth/logout
 * Alternative logout via GET (for simple redirects)
 */
export async function GET() {
  await deleteSessionCookie();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(appUrl);
}
