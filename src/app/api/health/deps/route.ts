import { QdrantClient } from "@qdrant/js-client-rest";
import { db } from "@/lib/db";
import { env, getMissingRequiredEnvKeys, requireEnv } from "@/lib/env";
import { getIndexingQueue } from "@/lib/queue";
import { checkGitHubAppAuth } from "@/lib/services/github-app";

type DependencyCheck = {
  ok: boolean;
  error?: string;
};

export async function GET() {
  const startedAt = Date.now();
  const missing = getMissingRequiredEnvKeys();

  const checks: Record<string, DependencyCheck> = {
    env: { ok: missing.length === 0, ...(missing.length > 0 ? { error: missing.join(", ") } : {}) },
    database: { ok: false },
    qdrant: { ok: false },
    redis: { ok: false },
    githubApp: { ok: false },
  };

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = { ok: true };
  } catch (error) {
    checks.database = {
      ok: false,
      error: error instanceof Error ? error.message : "Database check failed",
    };
  }

  try {
    const client = new QdrantClient({
      url: requireEnv("QDRANT_URL"),
      apiKey: requireEnv("QDRANT_API_KEY"),
    });
    await client.getCollections();
    checks.qdrant = { ok: true };
  } catch (error) {
    checks.qdrant = {
      ok: false,
      error: error instanceof Error ? error.message : "Qdrant check failed",
    };
  }

  try {
    const queue = getIndexingQueue();
    await queue.getJobCounts("waiting");
    checks.redis = { ok: true };
  } catch (error) {
    checks.redis = {
      ok: false,
      error: error instanceof Error ? error.message : "Redis check failed",
    };
  }

  try {
    await checkGitHubAppAuth();
    checks.githubApp = { ok: true };
  } catch (error) {
    checks.githubApp = {
      ok: false,
      error: error instanceof Error ? error.message : "GitHub App auth check failed",
    };
  }

  const isHealthy = Object.values(checks).every((check) => check.ok);

  return Response.json(
    {
      success: isHealthy,
      status: isHealthy ? "healthy" : "degraded",
      mode: env.BACKGROUND_MODE,
      checks,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: isHealthy ? 200 : 503 }
  );
}
