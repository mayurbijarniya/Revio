import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export type ActivityType =
  | "repo_added"
  | "repo_removed"
  | "repo_indexed"
  | "pr_reviewed"
  | "member_joined"
  | "member_left"
  | "member_role_changed"
  | "settings_updated";

interface LogActivityParams {
  organizationId: string;
  userId: string;
  type: ActivityType;
  title: string;
  description?: string;
  repositoryId?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Log an activity to the organization's activity feed
 */
export async function logActivity({
  organizationId,
  userId,
  type,
  title,
  description,
  repositoryId,
  metadata = {},
}: LogActivityParams) {
  try {
    await db.activity.create({
      data: {
        organizationId,
        userId,
        type,
        title,
        description,
        repositoryId,
        metadata,
      },
    });
  } catch (error) {
    // Don't throw - activity logging should not break main operations
    console.warn("Failed to log activity:", error);
  }
}

/**
 * Get recent activities for an organization
 */
export async function getOrganizationActivities(
  organizationId: string,
  options: { limit?: number; offset?: number } = {}
) {
  const { limit = 50, offset = 0 } = options;

  return db.activity.findMany({
    where: { organizationId },
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          githubUsername: true,
          avatarUrl: true,
        },
      },
      repository: {
        select: {
          id: true,
          name: true,
          fullName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}
