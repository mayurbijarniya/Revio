import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { indexRepository } from "@/lib/services/indexer";
import { decrypt } from "@/lib/encryption";

/**
 * GET /api/cron/reindex
 * Background cron job to re-index stale repositories
 * Triggered by Vercel Cron (configured in vercel.json)
 *
 * A repository is considered stale if:
 * - indexStatus is "indexed" AND
 * - indexedAt is older than 7 days
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // In development, allow without auth
    if (process.env.NODE_ENV === "production") {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const staleThresholdDays = 7;
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - staleThresholdDays);

  try {
    // Find stale repositories that need re-indexing
    const staleRepos = await db.repository.findMany({
      where: {
        indexStatus: "indexed",
        indexedAt: {
          lt: staleDate,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            accessToken: true,
          },
        },
      },
      take: 5, // Limit to 5 repos per cron run to avoid timeout
    });

    if (staleRepos.length === 0) {
      return Response.json({
        success: true,
        message: "No stale repositories to re-index",
        reindexed: 0,
      });
    }

    const results: Array<{
      repoId: string;
      repoName: string;
      status: "success" | "failed";
      error?: string;
    }> = [];

    for (const repo of staleRepos) {
      try {
        // Decrypt user's access token
        const accessToken = decrypt(repo.user.accessToken);

        // Mark as re-indexing
        await db.repository.update({
          where: { id: repo.id },
          data: { indexStatus: "indexing", indexProgress: 0 },
        });

        // Run incremental index
        await indexRepository(
          repo.id,
          repo.userId,
          repo.fullName,
          repo.defaultBranch,
          accessToken,
          false // Incremental only
        );

        results.push({
          repoId: repo.id,
          repoName: repo.fullName,
          status: "success",
        });
      } catch (error) {
        console.error(`Failed to re-index ${repo.fullName}:`, error);

        // Mark as failed
        await db.repository.update({
          where: { id: repo.id },
          data: {
            indexStatus: "failed",
            indexError: error instanceof Error ? error.message : "Re-indexing failed",
          },
        });

        results.push({
          repoId: repo.id,
          repoName: repo.fullName,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    return Response.json({
      success: true,
      message: `Re-indexed ${successCount} repositories, ${failedCount} failed`,
      reindexed: successCount,
      failed: failedCount,
      results,
    });
  } catch (error) {
    console.error("Cron reindex error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Cron job failed",
      },
      { status: 500 }
    );
  }
}

// Also allow POST for manual triggers
export { GET as POST };
