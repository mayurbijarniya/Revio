import { Job } from "bullmq";
import { createIndexingWorker, type IndexingJobData } from "@/lib/queue";
import { indexRepository } from "@/lib/services/indexer";
import { decrypt } from "@/lib/encryption";
import { markIndexStarted } from "@/lib/services/background-orchestrator";

/**
 * Process indexing jobs
 */
async function processIndexingJob(job: Job<IndexingJobData>): Promise<void> {
  const { repositoryId, userId, fullName, defaultBranch, accessToken, forceFullIndex, metadata } =
    job.data;

  try {
    await markIndexStarted(repositoryId, String(job.id ?? ""));
    const decryptedToken = decrypt(accessToken);
    const result = await indexRepository(
      repositoryId,
      userId,
      fullName,
      defaultBranch,
      decryptedToken,
      Boolean(forceFullIndex)
    );

    console.warn(
      `[Indexing] Completed ${fullName}: ${result.fileCount} files, ${result.chunkCount} chunks (trigger: ${metadata.trigger})`
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
