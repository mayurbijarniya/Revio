/**
 * Keep Qdrant and Upstash Redis services active
 * Run this script periodically to prevent free tier suspension
 * 
 * Usage: npx tsx scripts/keep-services-active.ts
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { Queue } from "bullmq";
import "dotenv/config";

async function pingQdrant(): Promise<void> {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;

  if (!url || !apiKey) {
    console.error("Qdrant configuration missing");
    return;
  }

  try {
    const client = new QdrantClient({ url, apiKey });
    const collections = await client.getCollections();
    console.log(`Qdrant is active - Found ${collections.collections.length} collections`);
  } catch (error) {
    console.error("Failed to ping Qdrant:", error);
  }
}

async function pingRedis(): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.error("Upstash Redis configuration missing");
    return;
  }

  try {
    // Parse Upstash URL for ioredis
    const host = url.replace("https://", "").replace("http://", "");

    // Create a temporary queue just to test the connection
    const testQueue = new Queue("keep-alive", {
      connection: {
        host,
        port: 6379,
        password: token,
        tls: {},
        maxRetriesPerRequest: null,
      },
    });

    // Ping Redis by getting queue counts
    const counts = await testQueue.getJobCounts();
    console.log(`Upstash Redis is active - Job counts: ${JSON.stringify(counts)}`);

    // Clean up
    await testQueue.close();
  } catch (error) {
    console.error("Failed to ping Upstash Redis:", error);
  }
}

async function main() {
  console.log("Starting service health check...\n");

  await Promise.all([
    pingQdrant(),
    pingRedis(),
  ]);

  console.log("\nHealth check complete!");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
