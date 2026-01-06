import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { z } from "zod";

const InviteSchema = z.object({
  githubUsername: z.string().min(1).max(255),
  role: z.enum(["admin", "member", "viewer"]),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/orgs/[id]/invite
 * Invite a user to the organization by GitHub username
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = InviteSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("VALIDATION_001", "Invalid request parameters", 400, {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { githubUsername, role } = parsed.data;

    // Check org access
    const org = await db.organization.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        members: {
          where: { userId: session.userId },
          select: { role: true },
        },
      },
    });

    if (!org) {
      return jsonError("ORG_002", "Organization not found", 404);
    }

    const isOwner = org.ownerId === session.userId;
    const isAdmin = org.members[0]?.role === "admin";

    if (!isOwner && !isAdmin) {
      return jsonError("AUTH_003", "Only owner or admin can invite members", 403);
    }

    // Find the user to invite
    const invitedUser = await db.user.findFirst({
      where: { githubUsername },
      select: { id: true, githubUsername: true, avatarUrl: true },
    });

    if (!invitedUser) {
      return jsonError("USER_001", "User not found on Revio. They need to sign in first.", 404);
    }

    // Check if already a member
    const existing = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: id,
          userId: invitedUser.id,
        },
      },
    });

    if (existing) {
      return jsonError("MEMBER_002", "User is already a member", 409);
    }

    // Cannot invite owner
    if (invitedUser.id === org.ownerId) {
      return jsonError("AUTH_003", "User is already the owner", 400);
    }

    // Create membership
    const member = await db.organizationMember.create({
      data: {
        organizationId: id,
        userId: invitedUser.id,
        role,
      },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            githubUsername: true,
            avatarUrl: true,
          },
        },
      },
    });

    return jsonSuccess({ member }, 201);
  } catch (error) {
    console.error("Failed to invite member:", error);
    return jsonError("INTERNAL_001", "Failed to invite member", 500);
  }
}
