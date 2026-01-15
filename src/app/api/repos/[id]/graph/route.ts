import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { jsonError, jsonSuccess } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { getCodeGraph } from "@/lib/services/code-graph";

/**
 * GET /api/repos/[id]/graph
 * Get code graph data for a repository
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return jsonError("AUTH_002", "Not authenticated", 401);
    }

    const { id: repositoryId } = await params;

    // Verify repository ownership
    const repository = await db.repository.findUnique({
      where: { id: repositoryId },
      select: { userId: true, name: true, fullName: true },
    });

    if (!repository) {
      return jsonError("REPO_001", "Repository not found", 404);
    }

    if (repository.userId !== session.userId) {
      return jsonError("AUTH_003", "Forbidden", 403);
    }

    // Get code graph
    const graphData = await getCodeGraph(repositoryId);

    if (!graphData) {
      return jsonSuccess({
        exists: false,
        message: "Code graph not built yet. It will be generated during the next indexing.",
      });
    }

    return jsonSuccess({
      exists: true,
      graph: graphData,
      repository: {
        name: repository.name,
        fullName: repository.fullName,
      },
    });
  } catch (error) {
    console.error("[API] Failed to get code graph:", error);
    return jsonError(
      "INTERNAL_001",
      error instanceof Error ? error.message : "Failed to get code graph",
      500
    );
  }
}
