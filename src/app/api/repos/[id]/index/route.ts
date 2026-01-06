import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getUserAccessToken } from "@/lib/auth";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { indexRepository } from "@/lib/services/indexer";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/repos/[id]/index
 * Trigger indexing for a repository
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
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

    // Check if already indexing
    if (repo.indexStatus === "indexing") {
      return jsonError("INDEX_003", "Indexing in progress", 409);
    }

    // Get access token
    const accessToken = await getUserAccessToken(session.userId);
    if (!accessToken) {
      return jsonError("AUTH_001", "Invalid GitHub token", 401);
    }

    // Start indexing (synchronous for now, can be moved to queue later)
    // For production, use: await addIndexingJob({ ... })
    const result = await indexRepository(
      repo.id,
      session.userId,
      repo.fullName,
      repo.defaultBranch,
      accessToken
    );

    return jsonSuccess({
      message: "Indexing complete",
      fileCount: result.fileCount,
      chunkCount: result.chunkCount,
    });
  } catch (error) {
    console.error("Failed to index repo:", error);
    return jsonError("INTERNAL_001", "Failed to index repository", 500);
  }
}
