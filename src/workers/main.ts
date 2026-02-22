import { startIndexingWorker } from "@/lib/jobs/indexing-worker";
import { startPrReviewWorker } from "@/lib/jobs/pr-review-worker";

const indexingWorker = startIndexingWorker();
const reviewWorker = startPrReviewWorker();

let shuttingDown = false;

const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.warn("[Worker] Graceful shutdown started");
  await Promise.all([indexingWorker.close(), reviewWorker.close()]);
  console.warn("[Worker] Shutdown complete");
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
