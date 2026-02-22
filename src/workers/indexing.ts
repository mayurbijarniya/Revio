import { startIndexingWorker } from "@/lib/jobs/indexing-worker";

const worker = startIndexingWorker();

const shutdown = async () => {
  await worker.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
