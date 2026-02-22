import { Job } from "bullmq";
import { createPrReviewWorker, type PrReviewJobData } from "@/lib/queue";
import { reviewPullRequest, postReviewToGitHub } from "@/lib/services/reviewer";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { createBotGitHubService } from "@/lib/services/github-app";
import {
  markPrReviewFailed,
  markPrReviewStarted,
} from "@/lib/services/background-orchestrator";

/**
 * Process PR review jobs
 */
async function processPrReviewJob(job: Job<PrReviewJobData>): Promise<void> {
  const {
    repositoryId,
    prNumber,
    prTitle,
    prAuthor,
    accessToken,
    prBody,
    prUrl,
    baseBranch,
    headBranch,
    headSha,
    metadata,
  } = job.data;

  console.warn(`[PR Review] Starting review for PR #${prNumber}`);

  try {
    await markPrReviewStarted(repositoryId, prNumber, String(job.id ?? ""));
    const decryptedUserToken = decrypt(accessToken);

    // Get PR URL
    const repository = await db.repository.findUnique({
      where: { id: repositoryId },
    });

    if (!repository) {
      throw new Error("Repository not found");
    }

    const [owner, repo] = repository.fullName.split("/");
    if (!owner || !repo) {
      throw new Error("Invalid repository name");
    }

    const botService = await createBotGitHubService(owner, repo);
    const effectiveToken = botService?.token ?? decryptedUserToken;
    const effectivePrUrl = prUrl ?? `https://github.com/${repository.fullName}/pull/${prNumber}`;

    // Review the PR
    const review = await reviewPullRequest(
      repositoryId,
      {
        number: prNumber,
        title: prTitle,
        body: prBody ?? null,
        author: prAuthor,
        url: effectivePrUrl,
        baseBranch: baseBranch ?? repository.defaultBranch,
        headBranch: headBranch ?? "",
        headSha: headSha ?? undefined,
      },
      effectiveToken
    );

    if (!review) {
      throw new Error("Failed to generate review");
    }

    // Post review to GitHub
    const commentId = await postReviewToGitHub(
      repositoryId,
      prNumber,
      review,
      effectiveToken
    );

    console.warn(
      `[PR Review] Completed review for PR #${prNumber}, comment ID: ${commentId} (trigger: ${metadata.trigger})`
    );
  } catch (error) {
    console.error(`[PR Review] Failed for PR #${prNumber}:`, error);

    // Update the PR review status to failed
    await markPrReviewFailed(repositoryId, prNumber);

    throw error;
  }
}

/**
 * Start the PR review worker
 */
export function startPrReviewWorker() {
  const worker = createPrReviewWorker(processPrReviewJob);

  worker.on("completed", (job) => {
    console.warn(`[Worker] PR review job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Worker] PR review job ${job?.id} failed:`, err);
  });

  return worker;
}
