import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { z } from "zod";

const UpgradeSchema = z.object({
  plan: z.enum(["free", "pro", "team"]),
});

/**
 * POST /api/billing/upgrade
 * Upgrade or downgrade user plan (auto-upgrade without Stripe for demo)
 */
export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  try {
    const body = await request.json();
    const parsed = UpgradeSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("VALIDATION_001", "Invalid request parameters", 400, {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { plan } = parsed.data;

    // Update user plan
    await db.user.update({
      where: { id: session.userId },
      data: { plan },
    });

    return jsonSuccess(
      {
        plan,
        message: `Successfully ${plan === "free" ? "downgraded" : "upgraded"} to ${plan.toUpperCase()} plan`,
      },
      200
    );
  } catch (error) {
    console.error("Failed to update plan:", error);
    return jsonError("INTERNAL_001", "Failed to update plan", 500);
  }
}

/**
 * GET /api/billing/upgrade
 * Get current plan and usage
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  try {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        plan: true,
        createdAt: true,
        repositories: {
          select: { id: true },
        },
        _count: {
          select: {
            repositories: true,
            conversations: true,
          },
        },
      },
    });

    if (!user) {
      return jsonError("AUTH_001", "User not found", 404);
    }

    return jsonSuccess(
      {
        plan: user.plan,
        usage: {
          repositories: user._count.repositories,
          conversations: user._count.conversations,
        },
        memberSince: user.createdAt,
      },
      200
    );
  } catch (error) {
    console.error("Failed to get plan:", error);
    return jsonError("INTERNAL_001", "Failed to get plan", 500);
  }
}
