import { Queue, Worker, Job, type ConnectionOptions } from "bullmq";
import { requireEnv } from "@/lib/env";

export const QUEUE_NAMES = {
  INDEXING: "indexing",
  PR_REVIEW: "pr-review",
} as const;

export type QueueTrigger = "connect" | "push" | "manual" | "cron";

interface QueueJobMetadata {
  trigger: QueueTrigger;
  deliveryId?: string;
  headSha?: string | null;
}

export interface IndexingJobData {
  repositoryId: string;
  userId: string;
  fullName: string;
  defaultBranch: string;
  accessToken: string;
  forceFullIndex?: boolean;
  metadata: QueueJobMetadata;
}

export interface PrReviewJobData {
  repositoryId: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  accessToken: string;
  prBody?: string | null;
  prUrl?: string | null;
  baseBranch?: string | null;
  headBranch?: string | null;
  headSha?: string | null;
  metadata: QueueJobMetadata;
}

function getRedisOptions(): ConnectionOptions {
  const url = requireEnv("UPSTASH_REDIS_REST_URL");
  const token = requireEnv("UPSTASH_REDIS_REST_TOKEN");
  const host = url.replace("https://", "").replace("http://", "");

  return {
    host,
    port: 6379,
    password: token,
    tls: {},
    maxRetriesPerRequest: null,
  };
}

let indexingQueue: Queue | null = null;
let prReviewQueue: Queue | null = null;

export function getIndexingQueue(): Queue {
  if (!indexingQueue) {
    indexingQueue = new Queue(QUEUE_NAMES.INDEXING, {
      connection: getRedisOptions(),
    });
  }
  return indexingQueue;
}

export function getPrReviewQueue(): Queue {
  if (!prReviewQueue) {
    prReviewQueue = new Queue(QUEUE_NAMES.PR_REVIEW, {
      connection: getRedisOptions(),
    });
  }
  return prReviewQueue;
}

function sanitizeJobSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function joinJobId(parts: string[]): string {
  return parts.map(sanitizeJobSegment).join("__");
}

export function buildIndexJobId(data: {
  repositoryId: string;
  defaultBranch: string;
  headSha?: string | null;
}): string {
  const branch = data.defaultBranch;
  const headMarker = data.headSha?.slice(0, 12) ?? "latest";
  return joinJobId(["index", data.repositoryId, branch, headMarker]);
}

export function buildReviewJobId(data: {
  repositoryId: string;
  prNumber: number;
  headSha?: string | null;
}): string {
  const headMarker = data.headSha?.slice(0, 12) ?? "latest";
  return joinJobId([
    "review",
    data.repositoryId,
    String(data.prNumber),
    headMarker,
  ]);
}

function isDuplicateJobError(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  return (
    err?.code === "EJOBEXISTS" ||
    err?.code === "ERR_JOB_EXISTS" ||
    err?.message?.toLowerCase().includes("jobid") ||
    err?.message?.toLowerCase().includes("exists") ||
    false
  );
}

export function createIndexingWorker(
  processor: (job: Job<IndexingJobData>) => Promise<void>
): Worker {
  return new Worker(QUEUE_NAMES.INDEXING, processor, {
    connection: getRedisOptions(),
    concurrency: 2,
  });
}

export function createPrReviewWorker(
  processor: (job: Job<PrReviewJobData>) => Promise<void>
): Worker {
  return new Worker(QUEUE_NAMES.PR_REVIEW, processor, {
    connection: getRedisOptions(),
    concurrency: 2,
  });
}

export async function addIndexingJob(data: IndexingJobData): Promise<string> {
  const queue = getIndexingQueue();
  const jobId = buildIndexJobId({
    repositoryId: data.repositoryId,
    defaultBranch: data.defaultBranch,
    headSha: data.metadata.headSha,
  });

  try {
    const job = await queue.add("index-repository", data, {
      jobId,
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: 200,
      removeOnFail: 200,
    });
    return String(job.id ?? jobId);
  } catch (error) {
    if (!isDuplicateJobError(error)) {
      throw error;
    }
    const existingJob = await queue.getJob(jobId);
    return String(existingJob?.id ?? jobId);
  }
}

export async function addPrReviewJob(data: PrReviewJobData): Promise<string> {
  const queue = getPrReviewQueue();
  const jobId = buildReviewJobId({
    repositoryId: data.repositoryId,
    prNumber: data.prNumber,
    headSha: data.headSha ?? data.metadata.headSha,
  });

  try {
    const job = await queue.add("review-pr", data, {
      jobId,
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 3000,
      },
      removeOnComplete: 200,
      removeOnFail: 200,
    });
    return String(job.id ?? jobId);
  } catch (error) {
    if (!isDuplicateJobError(error)) {
      throw error;
    }
    const existingJob = await queue.getJob(jobId);
    return String(existingJob?.id ?? jobId);
  }
}
