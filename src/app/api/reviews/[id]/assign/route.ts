import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { z } from "zod";

const AssignReviewSchema = z.object({
  assignedToId: z.string().uuid().nullable(),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/reviews/[id]/assign
 * Assign a PR review to a team member
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = AssignReviewSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("VALIDATION_001", "Invalid request parameters", 400, {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { assignedToId } = parsed.data;

    // Get the review and check access
    const review = await db.prReview.findUnique({
      where: { id },
      select: {
        id: true,
        repositoryId: true,
        repository: {
          select: {
            userId: true,
            organizationId: true,
          },
        },
      },
    });

    if (!review) {
      return jsonError("REVIEW_001", "Review not found", 404);
    }

    // Check if user has access to this review
    // Must be repo owner or org admin/owner
    let hasAccess = review.repository.userId === session.userId;

    if (!hasAccess && review.repository.organizationId) {
      const orgMember = await db.organizationMember.findFirst({
        where: {
          organizationId: review.repository.organizationId,
          userId: session.userId,
          role: { in: ["owner", "admin"] },
        },
      });
      hasAccess = !!orgMember;

      // Also check if user is org owner
      if (!hasAccess) {
        const org = await db.organization.findFirst({
          where: {
            id: review.repository.organizationId,
            ownerId: session.userId,
          },
        });
        hasAccess = !!org;
      }
    }

    if (!hasAccess) {
      return jsonError("AUTH_003", "Not authorized to assign this review", 403);
    }

    // If assigning to someone, verify they have access to the repo
    if (assignedToId) {
      // Check if user exists
      const assignee = await db.user.findUnique({
        where: { id: assignedToId },
        select: { id: true, githubUsername: true },
      });

      if (!assignee) {
        return jsonError("USER_001", "User not found", 404);
      }

      // If repo is in an org, assignee must be a member
      if (review.repository.organizationId) {
        const isMember = await db.organizationMember.findFirst({
          where: {
            organizationId: review.repository.organizationId,
            userId: assignedToId,
          },
        });

        const isOwner = await db.organization.findFirst({
          where: {
            id: review.repository.organizationId,
            ownerId: assignedToId,
          },
        });

        if (!isMember && !isOwner) {
          return jsonError("AUTH_004", "Assignee must be an organization member", 400);
        }
      }
    }

    // Update the review assignment
    const updated = await db.prReview.update({
      where: { id },
      data: { assignedToId },
      select: {
        id: true,
        prNumber: true,
        prTitle: true,
        status: true,
        assignedToId: true,
        assignedTo: {
          select: {
            id: true,
            githubUsername: true,
            avatarUrl: true,
          },
        },
      },
    });

    return jsonSuccess({
      review: updated,
      message: assignedToId
        ? `Review assigned to ${updated.assignedTo?.githubUsername}`
        : "Review unassigned",
    }, 200);
  } catch (error) {
    console.error("Failed to assign review:", error);
    return jsonError("INTERNAL_001", "Failed to assign review", 500);
  }
}
