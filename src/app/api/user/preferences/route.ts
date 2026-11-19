import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonError, jsonSuccess } from "@/lib/api-utils";
import { REVIEW_PROVIDERS } from "@/lib/constants";
import { getUserReviewProvider, isDeepSeekAvailable } from "@/lib/services/review-model";

const updatePreferencesSchema = z.object({
  reviewProvider: z.enum(REVIEW_PROVIDERS, {
    errorMap: () => ({ message: "Review provider must be \"google\" or \"deepseek\"" }),
  }),
});

/**
 * GET /api/user/preferences - Review provider and which providers this server can use
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  return jsonSuccess({
    reviewProvider: await getUserReviewProvider(session.userId),
    deepSeekAvailable: isDeepSeekAvailable(),
  });
}

/**
 * PATCH /api/user/preferences - Choose the AI provider for this user's PR reviews
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const parsed = updatePreferencesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("VALIDATION_001", parsed.error.errors[0]?.message ?? "Invalid request", 400);
  }

  const { reviewProvider } = parsed.data;
  if (reviewProvider === "deepseek" && !isDeepSeekAvailable()) {
    return jsonError("VALIDATION_001", "DeepSeek is not available on this server yet", 400);
  }

  try {
    await db.user.update({
      where: { id: session.userId },
      data: { reviewProvider },
    });
    return jsonSuccess({ reviewProvider });
  } catch (error) {
    console.error("Failed to update review provider:", error);
    return jsonError("INTERNAL_001", "Failed to save your review model", 500);
  }
}
