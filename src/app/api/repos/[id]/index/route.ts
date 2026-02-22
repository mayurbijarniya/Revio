import { NextRequest, after } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getUserAccessToken } from "@/lib/auth";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { scheduleIndexing } from "@/lib/services/background-orchestrator";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const indexOptionsSchema = z.object({
  forceFullIndex: z.boolean().optional().default(false),
});

/**
 * POST /api/repos/[id]/index
 * Trigger indexing for a repository
 *
 * Body:
 * - forceFullIndex: boolean (optional) - Force full re-index instead of incremental
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    // Parse options from request body
    let forceFullIndex = false;
    try {
      const body = await request.json();
      const options = indexOptionsSchema.parse(body);
      forceFullIndex = options.forceFullIndex;
    } catch {
      // Default to incremental if no body or parse error
    }

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

    const encryptedUserToken = await db.user.findUnique({
      where: { id: session.userId },
      select: { accessToken: true },
    });

    const result = await scheduleIndexing({
      repositoryId: repo.id,
      userId: session.userId,
      fullName: repo.fullName,
      defaultBranch: repo.defaultBranch,
      encryptedAccessToken: encryptedUserToken?.accessToken ?? null,
      fallbackAccessToken: accessToken,
      forceFullIndex,
      trigger: "manual",
      dispatchTask: (task) => after(task),
    });

    return jsonSuccess({
      message: result.message,
      mode: result.mode,
      jobId: result.jobId,
      forceFullIndex,
      status: "pending",
    });
  } catch (error) {
    console.error("Failed to index repo:", error);
    return jsonError("INTERNAL_001", "Failed to index repository", 500);
  }
}
