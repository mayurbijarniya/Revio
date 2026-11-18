import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { jsonError, jsonSuccess } from "@/lib/api-utils";
import { revokeApiKey } from "@/lib/api-keys";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/api-keys/[id] - Revoke a key. It stops working immediately.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return jsonError("VALIDATION_001", "Invalid key id", 400);
  }

  try {
    const revoked = await revokeApiKey(session.userId, id);
    if (!revoked) {
      return jsonError("NOT_FOUND", "API key not found", 404);
    }
    return jsonSuccess({ revoked: true });
  } catch (error) {
    console.error("Failed to revoke API key:", error);
    return jsonError("INTERNAL_001", "Failed to revoke API key", 500);
  }
}
