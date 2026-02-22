import { z } from "zod";

const BackgroundModeSchema = z.enum(["hybrid", "queue", "serverless"]);

const RuntimeEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BACKGROUND_MODE: BackgroundModeSchema.default("hybrid"),

  // Core
  DATABASE_URL: z.string().min(1).optional(),
  DIRECT_URL: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(1).optional(),
  ENCRYPTION_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().min(1).optional(),

  // GitHub App
  GITHUB_APP_ID: z.string().min(1).optional(),
  GITHUB_APP_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
  GITHUB_APP_WEBHOOK_SECRET: z.string().min(1).optional(),

  // AI
  OPENAI_API_KEY: z.string().min(1).optional(),
  GOOGLE_AI_API_KEY: z.string().min(1).optional(),

  // Qdrant
  QDRANT_URL: z.string().min(1).optional(),
  QDRANT_API_KEY: z.string().min(1).optional(),

  // Redis
  UPSTASH_REDIS_REST_URL: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // Cron
  CRON_SECRET: z.string().min(1).optional(),
});

export type BackgroundMode = z.infer<typeof BackgroundModeSchema>;

const REQUIRED_ENV_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SESSION_SECRET",
  "ENCRYPTION_KEY",
  "NEXT_PUBLIC_APP_URL",
  "GITHUB_APP_ID",
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_APP_WEBHOOK_SECRET",
  "OPENAI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "QDRANT_URL",
  "QDRANT_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "CRON_SECRET",
] as const;

type RequiredEnvKey = (typeof REQUIRED_ENV_KEYS)[number];
type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

const parsed = RuntimeEnvSchema.safeParse(process.env);
if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`[Env] Invalid environment configuration: ${message}`);
}

const runtimeEnv: RuntimeEnv = parsed.data;

function computeMissingRequiredKeys(env: RuntimeEnv): RequiredEnvKey[] {
  return REQUIRED_ENV_KEYS.filter((key) => {
    const value = env[key];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

const missingRequiredKeys = computeMissingRequiredKeys(runtimeEnv);
if (runtimeEnv.NODE_ENV === "production" && missingRequiredKeys.length > 0) {
  throw new Error(
    `[Env] Missing required environment variables: ${missingRequiredKeys.join(", ")}`
  );
}

if (runtimeEnv.NODE_ENV !== "production" && missingRequiredKeys.length > 0) {
  console.warn(
    `[Env] Missing environment variables for full functionality: ${missingRequiredKeys.join(", ")}`
  );
}

export const env = Object.freeze(runtimeEnv);

export function getMissingRequiredEnvKeys(): RequiredEnvKey[] {
  return [...missingRequiredKeys];
}

export function requireEnv(key: RequiredEnvKey): string {
  const value = env[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  throw new Error(`[Env] Missing required environment variable: ${key}`);
}
