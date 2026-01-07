import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { getOrganizationActivities } from "@/lib/services/activity";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/orgs/[id]/activity
 * Get the activity feed for an organization
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    // Check if user has access to this org
    const org = await db.organization.findFirst({
      where: {
        id,
        OR: [
          { ownerId: session.userId },
          { members: { some: { userId: session.userId } } },
        ],
      },
      select: { id: true },
    });

    if (!org) {
      return jsonError("ORG_002", "Organization not found or access denied", 404);
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const activities = await getOrganizationActivities(id, { limit, offset });

    return jsonSuccess({ activities }, 200);
  } catch (error) {
    console.error("Failed to get organization activities:", error);
    return jsonError("INTERNAL_001", "Failed to get activities", 500);
  }
}
