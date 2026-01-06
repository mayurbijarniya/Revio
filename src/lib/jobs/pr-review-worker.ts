import { Job } from "bullmq";
import { createPrReviewWorker, type PrReviewJobData } from "@/lib/queue";
import { reviewPullRequest, postReviewToGitHub } from "@/lib/services/reviewer";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";

/**
 * Process PR review jobs
 */
async function processPrReviewJob(job: Job<PrReviewJobData>): Promise<void> {
  const { repositoryId, prNumber, prTitle, prAuthor, accessToken } = job.data;

  console.warn(`[PR Review] Starting review for PR #${prNumber}`);

  try {
    // Decrypt the access token
    const decryptedToken = decrypt(accessToken);

    // Get PR URL
    const repository = await db.repository.findUnique({
      where: { id: repositoryId },
    });

    if (!repository) {
      throw new Error("Repository not found");
    }

    const prUrl = `https://github.com/${repository.fullName}/pull/${prNumber}`;

    // Review the PR
    const review = await reviewPullRequest(
      repositoryId,
      {
        number: prNumber,
        title: prTitle,
        body: null, // We don't have the body in the job data
        author: prAuthor,
        url: prUrl,
        baseBranch: repository.defaultBranch,
        headBranch: "", // Not needed for review
      },
      decryptedToken
    );

    if (!review) {
      throw new Error("Failed to generate review");
    }

    // Post review to GitHub
    const commentId = await postReviewToGitHub(
      repositoryId,
      prNumber,
      review,
      decryptedToken
    );

    console.warn(
      `[PR Review] Completed review for PR #${prNumber}, comment ID: ${commentId}`
    );
  } catch (error) {
    console.error(`[PR Review] Failed for PR #${prNumber}:`, error);

    // Update the PR review status to failed
    await db.prReview.upsert({
      where: {
        repositoryId_prNumber: {
          repositoryId,
          prNumber,
        },
      },
      update: {
        status: "failed",
      },
      create: {
        repositoryId,
        prNumber,
        prTitle,
        prAuthor,
        status: "failed",
      },
    });

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
