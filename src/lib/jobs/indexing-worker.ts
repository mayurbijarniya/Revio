import { Job } from "bullmq";
import { createIndexingWorker, type IndexingJobData } from "@/lib/queue";
import { indexRepository } from "@/lib/services/indexer";

/**
 * Process indexing jobs
 */
async function processIndexingJob(job: Job<IndexingJobData>): Promise<void> {
  const { repositoryId, userId, fullName, defaultBranch, accessToken } =
    job.data;

  try {
    const result = await indexRepository(
      repositoryId,
      userId,
      fullName,
      defaultBranch,
      accessToken
    );

    console.warn(
      `[Indexing] Completed ${fullName}: ${result.fileCount} files, ${result.chunkCount} chunks`
    );
  } catch (error) {
    console.error(`[Indexing] Failed for ${fullName}:`, error);
    throw error;
  }
}

/**
 * Start the indexing worker
 */
export function startIndexingWorker() {
  const worker = createIndexingWorker(processIndexingJob);

  worker.on("completed", (job) => {
    console.warn(`[Worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err);
  });

  return worker;
}
