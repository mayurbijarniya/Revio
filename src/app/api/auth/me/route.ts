import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/auth/me
 * Returns the current authenticated user or null
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AUTH_002",
          message: "Not authenticated",
        },
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { user },
  });
}
