import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import type { ConnectedRepository } from "@/types/repository";

/**
 * GET /api/repos/connected
 * List all connected repositories for the authenticated user
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  try {
    const repos = await db.repository.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: "desc" },
    });

    const connectedRepos: ConnectedRepository[] = repos.map((repo) => ({
      id: repo.id,
      githubRepoId: repo.githubRepoId,
      name: repo.name,
      fullName: repo.fullName,
      private: repo.private,
      defaultBranch: repo.defaultBranch,
      language: repo.language,
      indexStatus: repo.indexStatus as ConnectedRepository["indexStatus"],
      indexProgress: repo.indexProgress,
      indexedAt: repo.indexedAt,
      indexError: repo.indexError,
      fileCount: repo.fileCount,
      chunkCount: repo.chunkCount,
      autoReview: repo.autoReview,
      createdAt: repo.createdAt,
      updatedAt: repo.updatedAt,
    }));

    return jsonSuccess({ repositories: connectedRepos });
  } catch (error) {
    console.error("Failed to fetch connected repos:", error);
    return jsonError("INTERNAL_001", "Failed to fetch connected repositories", 500);
  }
}
