import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getUserAccessToken } from "@/lib/auth";
import { GitHubService } from "@/lib/services/github";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { deleteCollection } from "@/lib/services/qdrant";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/repos/[id]
 * Get a specific connected repository
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    const repo = await db.repository.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    });

    if (!repo) {
      return jsonError("REPO_001", "Repository not found", 404);
    }

    return jsonSuccess({
      repository: {
        id: repo.id,
        githubRepoId: repo.githubRepoId,
        name: repo.name,
        fullName: repo.fullName,
        private: repo.private,
        defaultBranch: repo.defaultBranch,
        language: repo.language,
        indexStatus: repo.indexStatus,
        indexProgress: repo.indexProgress,
        indexedAt: repo.indexedAt,
        indexError: repo.indexError,
        indexQueuedAt: repo.indexQueuedAt,
        indexStartedAt: repo.indexStartedAt,
        indexHeartbeatAt: repo.indexHeartbeatAt,
        indexJobId: repo.indexJobId,
        fileCount: repo.fileCount,
        chunkCount: repo.chunkCount,
        autoReview: repo.autoReview,
        webhookActive: !!repo.webhookId,
        createdAt: repo.createdAt,
        updatedAt: repo.updatedAt,
      },
    });
  } catch (error) {
    console.error("Failed to fetch repo:", error);
    return jsonError("INTERNAL_001", "Failed to fetch repository", 500);
  }
}

/**
 * DELETE /api/repos/[id]
 * Disconnect a repository
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    // Find the repository
    const repo = await db.repository.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    });

    if (!repo) {
      return jsonError("REPO_001", "Repository not found", 404);
    }

    // Try to delete webhook if it exists
    if (repo.webhookId) {
      try {
        const accessToken = await getUserAccessToken(session.userId);
        if (accessToken) {
          const github = new GitHubService(accessToken);
          const parts = repo.fullName.split("/");
          const owner = parts[0];
          const repoName = parts[1];
          if (owner && repoName) {
            await github.deleteWebhook(owner, repoName, repo.webhookId);
          }
        }
      } catch (webhookError) {
        // Webhook deletion failed - continue with repo deletion
        console.warn("Webhook deletion failed:", webhookError);
      }
    }

    // Delete repository (cascades to indexed files, conversations, etc.)
    await db.repository.delete({
      where: { id },
    });

    try {
      await deleteCollection(repo.id);
    } catch (qdrantError) {
      // Non-blocking cleanup: repository is already disconnected from app database.
      console.warn("Qdrant collection cleanup failed:", qdrantError);
    }

    return jsonSuccess({ message: "Repository disconnected successfully" });
  } catch (error) {
    console.error("Failed to disconnect repo:", error);
    return jsonError("INTERNAL_001", "Failed to disconnect repository", 500);
  }
}

/**
 * PATCH /api/repos/[id]
 * Update repository settings
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    const body = await request.json();

    // Find the repository
    const repo = await db.repository.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    });

    if (!repo) {
      return jsonError("REPO_001", "Repository not found", 404);
    }

    // Update allowed fields
    const updateData: Record<string, unknown> = {};

    if (typeof body.autoReview === "boolean") {
      updateData.autoReview = body.autoReview;
    }

    if (Array.isArray(body.ignoredPaths)) {
      updateData.ignoredPaths = body.ignoredPaths;
    }

    if (body.reviewRules && typeof body.reviewRules === "object") {
      updateData.reviewRules = body.reviewRules;
    }

    const updated = await db.repository.update({
      where: { id },
      data: updateData,
    });

    return jsonSuccess({
      repository: {
        id: updated.id,
        autoReview: updated.autoReview,
        ignoredPaths: updated.ignoredPaths,
        reviewRules: updated.reviewRules,
      },
    });
  } catch (error) {
    console.error("Failed to update repo:", error);
    return jsonError("INTERNAL_001", "Failed to update repository", 500);
  }
}
