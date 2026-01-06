import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { z } from "zod";

const UpdateOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/orgs/[id]
 * Get organization details
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    const org = await db.organization.findFirst({
      where: {
        id,
        OR: [
          { ownerId: session.userId },
          { members: { some: { userId: session.userId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            githubUsername: true,
            avatarUrl: true,
          },
        },
        members: {
          select: {
            id: true,
            role: true,
            user: {
              select: {
                id: true,
                githubUsername: true,
                avatarUrl: true,
              },
            },
            createdAt: true,
          },
        },
        _count: {
          select: {
            repositories: true,
          },
        },
      },
    });

    if (!org) {
      return jsonError("ORG_002", "Organization not found", 404);
    }

    // Get user's role in this org
    const userMembership = org.members.find(m => m.user.id === session.userId);
    const userRole = userMembership?.role || (org.owner.id === session.userId ? "owner" : null);

    return jsonSuccess({
      organization: {
        ...org,
        userRole,
      },
    }, 200);
  } catch (error) {
    console.error("Failed to get organization:", error);
    return jsonError("INTERNAL_001", "Failed to get organization", 500);
  }
}

/**
 * PATCH /api/orgs/[id]
 * Update organization (owner only)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = UpdateOrgSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("VALIDATION_001", "Invalid request parameters", 400, {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    // Check if user is the owner
    const org = await db.organization.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!org) {
      return jsonError("ORG_002", "Organization not found", 404);
    }

    if (org.ownerId !== session.userId) {
      return jsonError("AUTH_003", "Only owner can update organization", 403);
    }

    const { name } = parsed.data;

    const updated = await db.organization.update({
      where: { id },
      data: { name },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        createdAt: true,
      },
    });

    return jsonSuccess({ organization: updated }, 200);
  } catch (error) {
    console.error("Failed to update organization:", error);
    return jsonError("INTERNAL_001", "Failed to update organization", 500);
  }
}

/**
 * DELETE /api/orgs/[id]
 * Delete organization (owner only)
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    // Check if user is the owner
    const org = await db.organization.findUnique({
      where: { id },
      select: { ownerId: true, _count: { select: { members: true, repositories: true } } },
    });

    if (!org) {
      return jsonError("ORG_002", "Organization not found", 404);
    }

    if (org.ownerId !== session.userId) {
      return jsonError("AUTH_003", "Only owner can delete organization", 403);
    }

    // Check if org has members or repositories
    if (org._count.members > 1 || org._count.repositories > 0) {
      return jsonError("ORG_003", "Cannot delete organization with members or repositories", 400);
    }

    await db.organization.delete({ where: { id } });

    return jsonSuccess({ message: "Organization deleted" }, 200);
  } catch (error) {
    console.error("Failed to delete organization:", error);
    return jsonError("INTERNAL_001", "Failed to delete organization", 500);
  }
}
