import { Queue, Worker, Job, type ConnectionOptions } from "bullmq";

// Queue names
export const QUEUE_NAMES = {
  INDEXING: "indexing",
  PR_REVIEW: "pr-review",
} as const;

// Indexing job data
export interface IndexingJobData {
  repositoryId: string;
  userId: string;
  fullName: string;
  defaultBranch: string;
  accessToken: string;
}

// PR Review job data
export interface PrReviewJobData {
  repositoryId: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  accessToken: string;
}

// Get Redis connection options for Upstash
function getRedisOptions(): ConnectionOptions {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("Redis configuration missing");
  }

  // Parse Upstash URL for ioredis
  const host = url.replace("https://", "").replace("http://", "");

  return {
    host,
    port: 6379,
    password: token,
    tls: {},
    maxRetriesPerRequest: null,
  };
}

// Singleton queues
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

// Create a worker for indexing jobs
export function createIndexingWorker(
  processor: (job: Job<IndexingJobData>) => Promise<void>
): Worker {
  return new Worker(QUEUE_NAMES.INDEXING, processor, {
    connection: getRedisOptions(),
    concurrency: 2,
  });
}

// Create a worker for PR review jobs
export function createPrReviewWorker(
  processor: (job: Job<PrReviewJobData>) => Promise<void>
): Worker {
  return new Worker(QUEUE_NAMES.PR_REVIEW, processor, {
    connection: getRedisOptions(),
    concurrency: 2,
  });
}

// Add an indexing job
export async function addIndexingJob(data: IndexingJobData): Promise<string> {
  const queue = getIndexingQueue();
  const job = await queue.add("index-repository", data, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
  return job.id ?? "";
}

// Add a PR review job
export async function addPrReviewJob(data: PrReviewJobData): Promise<string> {
  const queue = getPrReviewQueue();
  const job = await queue.add("review-pr", data, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
  return job.id ?? "";
}
