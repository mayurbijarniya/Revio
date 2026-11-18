import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { jsonError, jsonSuccess } from "@/lib/api-utils";
import { ApiKeyLimitError, createApiKey, listApiKeys } from "@/lib/api-keys";

const createApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the key a name, for example \"My laptop\"")
    .max(100, "Name must be 100 characters or less"),
});

/**
 * GET /api/api-keys - List the user's active API keys (never the keys themselves)
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  try {
    const keys = await listApiKeys(session.userId);
    return jsonSuccess({ keys });
  } catch (error) {
    console.error("Failed to list API keys:", error);
    return jsonError("INTERNAL_001", "Failed to load API keys", 500);
  }
}

/**
 * POST /api/api-keys - Create a key. The full key is returned only in this response.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const parsed = createApiKeySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("VALIDATION_001", parsed.error.errors[0]?.message ?? "Invalid request", 400);
  }

  try {
    const { key, apiKey } = await createApiKey(session.userId, parsed.data.name);
    return jsonSuccess({ key, apiKey }, 201);
  } catch (error) {
    if (error instanceof ApiKeyLimitError) {
      return jsonError("LIMIT_005", error.message, 403);
    }
    console.error("Failed to create API key:", error);
    return jsonError("INTERNAL_001", "Failed to create API key", 500);
  }
}
