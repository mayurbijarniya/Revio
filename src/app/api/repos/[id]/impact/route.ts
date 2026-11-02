import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { jsonError, jsonSuccess } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { getCodeGraph, analyzeChangeImpact } from "@/lib/services/code-graph";
import { z } from "zod";

const impactRequestSchema = z.object({
  files: z.array(z.string().min(1)).min(1, "Missing or invalid 'files' array in request body").max(500),
  /** Optional changed line numbers per file; limits impact to the functions on those lines */
  changedLines: z.record(z.string(), z.array(z.number().int().positive()).max(10_000)).optional(),
});

/**
 * POST /api/repos/[id]/impact
 * Analyze impact of changes to specific files
 *
 * Request body:
 * {
 *   "files": ["src/lib/services/example.ts", "src/app/api/route.ts"],
 *   "changedLines": { "src/lib/services/example.ts": [12, 13, 40] }   // optional
 * }
 * Without changedLines, every function in the listed files counts as changed.
 */
export async function POST(
  request: NextRequest,
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
      select: { userId: true, name: true },
    });

    if (!repository) {
      return jsonError("REPO_001", "Repository not found", 404);
    }

    if (repository.userId !== session.userId) {
      return jsonError("AUTH_003", "Forbidden", 403);
    }

    // Parse request body
    const parsed = impactRequestSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return jsonError(
        "VALIDATION_001",
        parsed.error.errors[0]?.message ?? "Missing or invalid 'files' array in request body",
        400
      );
    }
    const body = parsed.data;

    // Get code graph
    const graphData = await getCodeGraph(repositoryId);

    if (!graphData) {
      return jsonError(
        "REPO_003",
        "Code graph not available. Please re-index the repository to build the graph.",
        404
      );
    }

    // Analyze impact
    const impactAnalysis = analyzeChangeImpact(graphData, body.files, body.changedLines);

    return jsonSuccess({
      impact: impactAnalysis,
      changedFiles: body.files,
      repository: {
        name: repository.name,
      },
    });
  } catch (error) {
    console.error("[API] Failed to analyze impact:", error);
    return jsonError(
      "INTERNAL_001",
      error instanceof Error ? error.message : "Failed to analyze impact",
      500
    );
  }
}
