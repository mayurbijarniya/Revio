import { startPrReviewWorker } from "@/lib/jobs/pr-review-worker";

const worker = startPrReviewWorker();

const shutdown = async () => {
  await worker.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
