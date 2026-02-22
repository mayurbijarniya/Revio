import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { env } from "@/lib/env";
import { scheduleIndexing } from "@/lib/services/background-orchestrator";

type RecoveryReason = "stale_index" | "pending_timeout" | "indexing_timeout";

interface CandidateRepo {
  id: string;
  userId: string;
  fullName: string;
  defaultBranch: string;
  indexStatus: string;
  indexQueuedAt: Date | null;
  indexStartedAt: Date | null;
  indexHeartbeatAt: Date | null;
  indexedAt: Date | null;
  user: {
    accessToken: string;
  };
}

interface RecoveryCandidate extends CandidateRepo {
  reason: RecoveryReason;
}

/**
 * GET /api/cron/reindex
 * Background cron job:
 * 1) Re-index stale repositories
 * 2) Recover stuck pending/indexing repositories
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isValidAuth = authHeader === `Bearer ${env.CRON_SECRET}`;
  const isVercelCron =
    request.headers.get("user-agent")?.includes("vercel-cron") ||
    request.headers.has("x-vercel-id");

  if (!isValidAuth && !isVercelCron && env.NODE_ENV === "production") {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = Date.now();
  const staleDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const pendingCutoff = new Date(now - 10 * 60 * 1000);
  const indexingCutoff = new Date(now - 20 * 60 * 1000);

  const maxReposPerRun = 8;

  try {
    const [staleIndexed, stuckPending, stuckIndexing] = await Promise.all([
      db.repository.findMany({
        where: {
          indexStatus: "indexed",
          indexedAt: { lt: staleDate },
        },
        include: {
          user: {
            select: {
              accessToken: true,
            },
          },
        },
        take: maxReposPerRun,
      }),
      db.repository.findMany({
        where: {
          indexStatus: "pending",
          indexQueuedAt: { lt: pendingCutoff },
        },
        include: {
          user: {
            select: {
              accessToken: true,
            },
          },
        },
        take: maxReposPerRun,
      }),
      db.repository.findMany({
        where: {
          indexStatus: "indexing",
          OR: [
            { indexHeartbeatAt: { lt: indexingCutoff } },
            {
              indexHeartbeatAt: null,
              indexStartedAt: { lt: indexingCutoff },
            },
          ],
        },
        include: {
          user: {
            select: {
              accessToken: true,
            },
          },
        },
        take: maxReposPerRun,
      }),
    ]);

    const candidatesById = new Map<string, RecoveryCandidate>();

    for (const repo of staleIndexed) {
      candidatesById.set(repo.id, {
        ...repo,
        reason: "stale_index",
      });
    }
    for (const repo of stuckPending) {
      candidatesById.set(repo.id, {
        ...repo,
        reason: "pending_timeout",
      });
    }
    for (const repo of stuckIndexing) {
      candidatesById.set(repo.id, {
        ...repo,
        reason: "indexing_timeout",
      });
    }

    const candidates = Array.from(candidatesById.values()).slice(0, maxReposPerRun);
    if (candidates.length === 0) {
      return Response.json({
        success: true,
        message: "No stale or stuck repositories to recover",
        recovered: 0,
      });
    }

    const results: Array<{
      repoId: string;
      repoName: string;
      reason: RecoveryReason;
      status: "success" | "failed" | "skipped";
      mode?: "queue" | "fallback";
      jobId?: string;
      error?: string;
    }> = [];

    for (const repo of candidates) {
      // Lightweight lease lock to avoid duplicate recovery actions.
      const lockResult = await db.repository.updateMany({
        where: {
          id: repo.id,
          indexStatus: repo.indexStatus,
        },
        data: {
          indexHeartbeatAt: new Date(),
        },
      });

      if (lockResult.count === 0) {
        results.push({
          repoId: repo.id,
          repoName: repo.fullName,
          reason: repo.reason,
          status: "skipped",
          error: "Could not acquire lease lock",
        });
        continue;
      }

      try {
        if (repo.reason === "indexing_timeout") {
          await db.repository.update({
            where: { id: repo.id },
            data: {
              indexStatus: "stale",
              indexError:
                "Indexing heartbeat timeout detected by cron watchdog; re-scheduling incremental re-index.",
            },
          });
        }

        const fallbackAccessToken = decrypt(repo.user.accessToken);
        const scheduling = await scheduleIndexing({
          repositoryId: repo.id,
          userId: repo.userId,
          fullName: repo.fullName,
          defaultBranch: repo.defaultBranch,
          encryptedAccessToken: repo.user.accessToken,
          fallbackAccessToken,
          forceFullIndex: false,
          trigger: "cron",
        });

        results.push({
          repoId: repo.id,
          repoName: repo.fullName,
          reason: repo.reason,
          status: "success",
          mode: scheduling.mode,
          jobId: scheduling.jobId,
        });
      } catch (error) {
        console.error(`[Cron] Failed to recover ${repo.fullName}:`, error);
        await db.repository.update({
          where: { id: repo.id },
          data: {
            indexStatus: "failed",
            indexError:
              error instanceof Error ? error.message : "Cron recovery failed",
            indexQueuedAt: null,
            indexStartedAt: null,
            indexHeartbeatAt: null,
            indexJobId: null,
          },
        });
        results.push({
          repoId: repo.id,
          repoName: repo.fullName,
          reason: repo.reason,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const failedCount = results.filter((r) => r.status === "failed").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;

    return Response.json({
      success: failedCount === 0,
      message: `Recovered ${successCount} repositories (${failedCount} failed, ${skippedCount} skipped)`,
      recovered: successCount,
      failed: failedCount,
      skipped: skippedCount,
      results,
    });
  } catch (error) {
    console.error("Cron reindex watchdog error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Cron job failed",
      },
      { status: 500 }
    );
  }
}

export { GET as POST };
