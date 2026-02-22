import { db } from "@/lib/db";
import { env, getMissingRequiredEnvKeys } from "@/lib/env";

export async function GET() {
  const startedAt = Date.now();
  const missing = getMissingRequiredEnvKeys();
  const envOk = missing.length === 0;

  try {
    await db.$queryRaw`SELECT 1`;
    const ready = envOk;

    return Response.json({
      success: ready,
      status: ready ? "ready" : "not_ready",
      mode: env.BACKGROUND_MODE,
      checks: {
        env: {
          ok: envOk,
          missing,
        },
        database: { ok: true },
      },
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    }, { status: ready ? 200 : 503 });
  } catch (error) {
    return Response.json(
      {
        success: false,
        status: "not_ready",
        mode: env.BACKGROUND_MODE,
        checks: {
          env: {
            ok: envOk,
            missing,
          },
          database: {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown database error",
          },
        },
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
