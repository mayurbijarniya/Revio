import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { logActivity } from "@/lib/services/activity";
import { z } from "zod";

const AddRepoSchema = z.object({
  repositoryId: z.string().uuid(),
});

const RemoveRepoSchema = z.object({
  repositoryId: z.string().uuid(),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Check if user has access to org with minimum role
 */
async function checkOrgAccess(userId: string, orgId: string, minRole: "viewer" | "member" | "admin" | "owner" = "member") {
  const org = await db.organization.findFirst({
    where: {
      id: orgId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      ownerId: true,
      members: {
        where: { userId },
        select: { role: true },
      },
    },
  });

  if (!org) return null;

  const isOwner = org.ownerId === userId;
  const memberRole = org.members[0]?.role;
  const role = isOwner ? "owner" : memberRole;

  const roleHierarchy = { viewer: 0, member: 1, admin: 2, owner: 3 };
  const hasAccess = roleHierarchy[role as keyof typeof roleHierarchy] >= roleHierarchy[minRole];

  return hasAccess ? { org, role } : null;
}

/**
 * GET /api/orgs/[id]/repos
 * List all repositories in the organization
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    // Check if user has access to this org (viewer access is enough to list repos)
    const access = await checkOrgAccess(session.userId, id, "viewer");
    if (!access) {
      return jsonError("ORG_002", "Organization not found or access denied", 404);
    }

    const repos = await db.repository.findMany({
      where: { organizationId: id },
      select: {
        id: true,
        name: true,
        fullName: true,
        private: true,
        language: true,
        indexStatus: true,
        indexedAt: true,
        fileCount: true,
        chunkCount: true,
        autoReview: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            githubUsername: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            prReviews: true,
            conversations: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonSuccess({
      repositories: repos.map(repo => ({
        ...repo,
        addedBy: repo.user,
        prReviewCount: repo._count.prReviews,
        conversationCount: repo._count.conversations,
      })),
    }, 200);
  } catch (error) {
    console.error("Failed to list organization repos:", error);
    return jsonError("INTERNAL_001", "Failed to list organization repositories", 500);
  }
}

/**
 * POST /api/orgs/[id]/repos
 * Add a repository to the organization (transfer from personal)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = AddRepoSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("VALIDATION_001", "Invalid request parameters", 400, {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    // Check if user has admin access to this org
    const access = await checkOrgAccess(session.userId, id, "admin");
    if (!access) {
      return jsonError("AUTH_003", "Admin access required to add repositories", 403);
    }

    const { repositoryId } = parsed.data;

    // Check if user owns this repository
    const repo = await db.repository.findFirst({
      where: {
        id: repositoryId,
        userId: session.userId,
      },
    });

    if (!repo) {
      return jsonError("REPO_002", "Repository not found or you don't own it", 404);
    }

    if (repo.organizationId) {
      return jsonError("REPO_004", "Repository is already in an organization", 400);
    }

    // Add repository to organization
    const updated = await db.repository.update({
      where: { id: repositoryId },
      data: { organizationId: id },
      select: {
        id: true,
        name: true,
        fullName: true,
        private: true,
        language: true,
        indexStatus: true,
        organizationId: true,
      },
    });

    // Log activity
    await logActivity({
      organizationId: id,
      userId: session.userId,
      type: "repo_added",
      title: `Added repository ${updated.fullName}`,
      repositoryId: updated.id,
    });

    return jsonSuccess({
      repository: updated,
      message: "Repository added to organization",
    }, 200);
  } catch (error) {
    console.error("Failed to add repository to org:", error);
    return jsonError("INTERNAL_001", "Failed to add repository to organization", 500);
  }
}

/**
 * DELETE /api/orgs/[id]/repos
 * Remove a repository from the organization (transfer back to personal)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = RemoveRepoSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("VALIDATION_001", "Invalid request parameters", 400, {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    // Check if user has admin access to this org
    const access = await checkOrgAccess(session.userId, id, "admin");
    if (!access) {
      return jsonError("AUTH_003", "Admin access required to remove repositories", 403);
    }

    const { repositoryId } = parsed.data;

    // Check if repository is in this organization
    const repo = await db.repository.findFirst({
      where: {
        id: repositoryId,
        organizationId: id,
      },
    });

    if (!repo) {
      return jsonError("REPO_002", "Repository not found in this organization", 404);
    }

    // Remove repository from organization
    const updated = await db.repository.update({
      where: { id: repositoryId },
      data: { organizationId: null },
      select: {
        id: true,
        name: true,
        fullName: true,
        private: true,
        language: true,
        indexStatus: true,
        organizationId: true,
      },
    });

    // Log activity
    await logActivity({
      organizationId: id,
      userId: session.userId,
      type: "repo_removed",
      title: `Removed repository ${updated.fullName}`,
      metadata: { repositoryId: updated.id, fullName: updated.fullName },
    });

    return jsonSuccess({
      repository: updated,
      message: "Repository removed from organization",
    }, 200);
  } catch (error) {
    console.error("Failed to remove repository from org:", error);
    return jsonError("INTERNAL_001", "Failed to remove repository from organization", 500);
  }
}
