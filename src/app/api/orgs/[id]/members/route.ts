import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { z } from "zod";

const UpdateMemberRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(["admin", "member", "viewer"]),
});

const RemoveMemberSchema = z.object({
  memberId: z.string().uuid(),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/orgs/[id]/members
 * List all members of an organization
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    // Check access
    const org = await db.organization.findFirst({
      where: {
        id,
        OR: [
          { ownerId: session.userId },
          { members: { some: { userId: session.userId } } },
        ],
      },
      select: { id: true, ownerId: true },
    });

    if (!org) {
      return jsonError("ORG_002", "Organization not found", 404);
    }

    const members = await db.organizationMember.findMany({
      where: { organizationId: id },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            githubUsername: true,
            avatarUrl: true,
            email: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    // Get current user's role
    const isOwner = org.ownerId === session.userId;
    const currentUserMember = members.find(m => m.user.id === session.userId);
    const userRole = isOwner ? "owner" : currentUserMember?.role;

    return jsonSuccess({
      members,
      userRole,
      isOwner,
    }, 200);
  } catch (error) {
    console.error("Failed to list members:", error);
    return jsonError("INTERNAL_001", "Failed to list members", 500);
  }
}

/**
 * PATCH /api/orgs/[id]/members
 * Update member role (owner or admin only)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = UpdateMemberRoleSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("VALIDATION_001", "Invalid request parameters", 400, {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { memberId, role } = parsed.data;

    // Get org with membership check
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
      return jsonError("AUTH_003", "Only owner or admin can update roles", 403);
    }

    // Get the member being updated
    const member = await db.organizationMember.findUnique({
      where: { id: memberId },
      select: { organizationId: true, userId: true, role: true },
    });

    if (!member || member.organizationId !== id) {
      return jsonError("MEMBER_001", "Member not found", 404);
    }

    // Cannot change owner's role
    if (member.userId === org.ownerId) {
      return jsonError("AUTH_003", "Cannot change owner's role", 403);
    }

    // Cannot demote yourself if you're the only owner
    if (session.userId === member.userId && role !== "admin" && isOwner) {
      return jsonError("AUTH_003", "Cannot demote yourself as the only owner", 400);
    }

    const updated = await db.organizationMember.update({
      where: { id: memberId },
      data: { role },
      select: {
        id: true,
        role: true,
        user: {
          select: {
            id: true,
            githubUsername: true,
          },
        },
      },
    });

    return jsonSuccess({ member: updated }, 200);
  } catch (error) {
    console.error("Failed to update member role:", error);
    return jsonError("INTERNAL_001", "Failed to update member role", 500);
  }
}

/**
 * DELETE /api/orgs/[id]/members
 * Remove a member (owner or admin only, or self-removal)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = RemoveMemberSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("VALIDATION_001", "Invalid request parameters", 400, {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { memberId } = parsed.data;

    // Get org with membership check
    const org = await db.organization.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        members: {
          where: { userId: session.userId },
          select: { role: true, id: true },
        },
      },
    });

    if (!org) {
      return jsonError("ORG_002", "Organization not found", 404);
    }

    // Get the member to be removed
    const member = await db.organizationMember.findUnique({
      where: { id: memberId },
      select: { organizationId: true, userId: true, role: true },
    });

    if (!member || member.organizationId !== id) {
      return jsonError("MEMBER_001", "Member not found", 404);
    }

    const isOwner = org.ownerId === session.userId;
    const isAdmin = org.members[0]?.role === "admin";
    const isSelf = member.userId === session.userId;

    // Check permissions
    if (!isOwner && !isAdmin && !isSelf) {
      return jsonError("AUTH_003", "Not authorized to remove this member", 403);
    }

    // Cannot remove owner
    if (member.userId === org.ownerId) {
      return jsonError("AUTH_003", "Cannot remove organization owner", 403);
    }

    // Only owner can remove admins
    if (member.role === "admin" && !isOwner) {
      return jsonError("AUTH_003", "Only owner can remove admins", 403);
    }

    await db.organizationMember.delete({ where: { id: memberId } });

    return jsonSuccess({ message: "Member removed" }, 200);
  } catch (error) {
    console.error("Failed to remove member:", error);
    return jsonError("INTERNAL_001", "Failed to remove member", 500);
  }
}
