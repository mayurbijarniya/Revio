import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { decrypt } from "@/lib/encryption";
import {
  addIndexingJob,
  addPrReviewJob,
  type IndexingJobData,
  type PrReviewJobData,
  type QueueTrigger,
} from "@/lib/queue";

export type BackgroundTaskDispatcher = (task: () => Promise<void>) => void;

export interface BackgroundScheduleResult {
  mode: "queue" | "fallback";
  jobId?: string;
  message: string;
}

interface BaseScheduleOptions {
  trigger: QueueTrigger;
  deliveryId?: string;
  headSha?: string | null;
}

interface ScheduleIndexingOptions extends BaseScheduleOptions {
  repositoryId: string;
  userId: string;
  fullName: string;
  defaultBranch: string;
  encryptedAccessToken?: string | null;
  fallbackAccessToken?: string | null;
  forceFullIndex?: boolean;
  dispatchTask?: BackgroundTaskDispatcher;
}

interface SchedulePrReviewOptions extends BaseScheduleOptions {
  repositoryId: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  encryptedAccessToken?: string | null;
  fallbackTask: () => Promise<void>;
  dispatchTask?: BackgroundTaskDispatcher;
  prBody?: string | null;
  prUrl?: string | null;
  baseBranch?: string | null;
  headBranch?: string | null;
}

function runTask(
  task: () => Promise<void>,
  dispatchTask?: BackgroundTaskDispatcher
): Promise<void> {
  if (dispatchTask) {
    dispatchTask(task);
    return Promise.resolve();
  }
  return task();
}

async function markIndexQueued(repositoryId: string, jobId: string): Promise<void> {
  await db.repository.update({
    where: { id: repositoryId },
    data: {
      indexStatus: "pending",
      indexProgress: 0,
      indexError: null,
      indexQueuedAt: new Date(),
      indexJobId: jobId,
      indexStartedAt: null,
      indexHeartbeatAt: null,
    },
  });
}

export async function markIndexStarted(
  repositoryId: string,
  jobId?: string | null
): Promise<void> {
  await db.repository.update({
    where: { id: repositoryId },
    data: {
      indexStatus: "indexing",
      indexStartedAt: new Date(),
      indexHeartbeatAt: new Date(),
      ...(jobId ? { indexJobId: jobId } : {}),
    },
  });
}

async function markPrReviewQueued(
  repositoryId: string,
  prNumber: number,
  jobId: string
): Promise<void> {
  await db.prReview.upsert({
    where: {
      repositoryId_prNumber: {
        repositoryId,
        prNumber,
      },
    },
    update: {
      status: "pending",
      queuedAt: new Date(),
      startedAt: null,
      jobId,
    },
    create: {
      repositoryId,
      prNumber,
      status: "pending",
      queuedAt: new Date(),
      startedAt: null,
      jobId,
    },
  });
}

export async function markPrReviewStarted(
  repositoryId: string,
  prNumber: number,
  jobId?: string | null
): Promise<void> {
  await db.prReview.upsert({
    where: {
      repositoryId_prNumber: {
        repositoryId,
        prNumber,
      },
    },
    update: {
      status: "pending",
      startedAt: new Date(),
      ...(jobId ? { jobId } : {}),
    },
    create: {
      repositoryId,
      prNumber,
      status: "pending",
      startedAt: new Date(),
      ...(jobId ? { jobId } : {}),
    },
  });
}

export async function markPrReviewFailed(
  repositoryId: string,
  prNumber: number
): Promise<void> {
  await db.prReview.upsert({
    where: {
      repositoryId_prNumber: {
        repositoryId,
        prNumber,
      },
    },
    update: {
      status: "failed",
      queuedAt: null,
      startedAt: null,
      jobId: null,
    },
    create: {
      repositoryId,
      prNumber,
      status: "failed",
      queuedAt: null,
      startedAt: null,
      jobId: null,
    },
  });
}

async function runIndexingFallback(options: ScheduleIndexingOptions): Promise<void> {
  const { indexRepository } = await import("@/lib/services/indexer");
  const fallbackToken =
    options.fallbackAccessToken ??
    (options.encryptedAccessToken ? decrypt(options.encryptedAccessToken) : null);

  if (!fallbackToken) {
    throw new Error("No fallback access token available for indexing");
  }

  await markIndexStarted(options.repositoryId, `fallback:${Date.now()}`);
  await indexRepository(
    options.repositoryId,
    options.userId,
    options.fullName,
    options.defaultBranch,
    fallbackToken,
    Boolean(options.forceFullIndex)
  );
}

export async function scheduleIndexing(options: ScheduleIndexingOptions): Promise<BackgroundScheduleResult> {
  const queueEnabled = env.BACKGROUND_MODE !== "serverless";
  if (env.BACKGROUND_MODE === "queue" && !options.encryptedAccessToken) {
    throw new Error("Queue mode requires encrypted access token for indexing jobs");
  }

  if (queueEnabled && options.encryptedAccessToken) {
    try {
      const payload: IndexingJobData = {
        repositoryId: options.repositoryId,
        userId: options.userId,
        fullName: options.fullName,
        defaultBranch: options.defaultBranch,
        accessToken: options.encryptedAccessToken,
        forceFullIndex: options.forceFullIndex,
        metadata: {
          trigger: options.trigger,
          deliveryId: options.deliveryId,
          headSha: options.headSha,
        },
      };
      const jobId = await addIndexingJob(payload);
      await markIndexQueued(options.repositoryId, jobId);
      return {
        mode: "queue",
        jobId,
        message: "Indexing queued in background.",
      };
    } catch (error) {
      if (env.BACKGROUND_MODE === "queue") {
        throw error;
      }
      console.error("[Background] Failed to queue indexing, using fallback:", error);
    }
  }

  await runTask(() => runIndexingFallback(options), options.dispatchTask);
  return {
    mode: "fallback",
    message: "Queue unavailable, fallback indexing started in background.",
  };
}

export async function schedulePrReview(options: SchedulePrReviewOptions): Promise<BackgroundScheduleResult> {
  const queueEnabled = env.BACKGROUND_MODE !== "serverless";
  if (env.BACKGROUND_MODE === "queue" && !options.encryptedAccessToken) {
    throw new Error("Queue mode requires encrypted access token for review jobs");
  }

  if (queueEnabled && options.encryptedAccessToken) {
    try {
      const payload: PrReviewJobData = {
        repositoryId: options.repositoryId,
        prNumber: options.prNumber,
        prTitle: options.prTitle,
        prAuthor: options.prAuthor,
        accessToken: options.encryptedAccessToken,
        prBody: options.prBody,
        prUrl: options.prUrl,
        baseBranch: options.baseBranch,
        headBranch: options.headBranch,
        headSha: options.headSha ?? null,
        metadata: {
          trigger: options.trigger,
          deliveryId: options.deliveryId,
          headSha: options.headSha,
        },
      };
      const jobId = await addPrReviewJob(payload);
      await markPrReviewQueued(options.repositoryId, options.prNumber, jobId);
      return {
        mode: "queue",
        jobId,
        message: "PR review queued in background.",
      };
    } catch (error) {
      if (env.BACKGROUND_MODE === "queue") {
        throw error;
      }
      console.error("[Background] Failed to queue PR review, using fallback:", error);
    }
  }

  await runTask(async () => {
    await markPrReviewStarted(options.repositoryId, options.prNumber, `fallback:${Date.now()}`);
    try {
      await options.fallbackTask();
    } catch (error) {
      await markPrReviewFailed(options.repositoryId, options.prNumber);
      throw error;
    }
  }, options.dispatchTask);

  return {
    mode: "fallback",
    message: "Queue unavailable, fallback review started in background.",
  };
}
