import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonError, jsonSuccess } from "@/lib/api-utils";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { IssueCategories, parseReviewSettings, type ReviewRule } from "@/types/review";
import { getEffectiveLearningContext, invalidateLearningCache } from "@/lib/services/learning";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("toggle_suppression"),
    suppressionId: z.string().min(1),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("add_suppression"),
    type: z.enum(["category", "text"]),
    category: z.enum(IssueCategories).optional(),
    pattern: z.string().min(1).optional(),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("dismiss_rule_suggestion"),
    suggestionId: z.string().min(1),
  }),
  z.object({
    action: z.literal("accept_rule_suggestion"),
    suggestionId: z.string().min(1),
  }),
]);

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * GET /api/repos/[id]/learning
 * Returns repo/org learning state + effective learned preferences.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    const repository = await db.repository.findFirst({
      where: { id, userId: session.userId },
      select: { id: true, fullName: true, organizationId: true },
    });

    if (!repository) {
      return jsonError("REPO_001", "Repository not found", 404);
    }

    const [repoLearning, orgLearning, effective] = await Promise.all([
      db.reviewLearning.upsert({
        where: { repositoryId: repository.id },
        create: {
          repositoryId: repository.id,
          preferredPatterns: [],
          suppressedPatterns: [],
          customRuleSuggestions: [],
          feedbackStats: {},
          adoptionRates: {},
        },
        update: {},
      }),
      repository.organizationId
        ? db.reviewLearning.upsert({
          where: { organizationId: repository.organizationId },
          create: {
            organizationId: repository.organizationId,
            preferredPatterns: [],
            suppressedPatterns: [],
            customRuleSuggestions: [],
            feedbackStats: {},
            adoptionRates: {},
          },
          update: {},
        })
        : null,
      getEffectiveLearningContext(repository.id),
    ]);

    return jsonSuccess({
      repository,
      repoLearning: {
        id: repoLearning.id,
        suppressedPatterns: repoLearning.suppressedPatterns,
        customRuleSuggestions: repoLearning.customRuleSuggestions,
        feedbackStats: repoLearning.feedbackStats,
        adoptionRates: repoLearning.adoptionRates,
        updatedAt: repoLearning.updatedAt,
      },
      orgLearning: orgLearning
        ? {
          id: orgLearning.id,
          suppressedPatterns: orgLearning.suppressedPatterns,
          customRuleSuggestions: orgLearning.customRuleSuggestions,
          feedbackStats: orgLearning.feedbackStats,
          adoptionRates: orgLearning.adoptionRates,
          updatedAt: orgLearning.updatedAt,
        }
        : null,
      effective,
    });
  } catch (error) {
    console.error("[Learning API] Failed to get learning state:", error);
    return jsonError("INTERNAL_001", "Failed to get learning state", 500);
  }
}

/**
 * PATCH /api/repos/[id]/learning
 * Update repo-level learning state (suppression + rule suggestion actions).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    const repository = await db.repository.findFirst({
      where: { id, userId: session.userId },
      select: { id: true, organizationId: true, reviewRules: true },
    });

    if (!repository) {
      return jsonError("REPO_001", "Repository not found", 404);
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("VALIDATION_001", "Invalid request", 400);
    }
    const payload = parsed.data;

    const learning = await db.reviewLearning.upsert({
      where: { repositoryId: repository.id },
      create: {
        repositoryId: repository.id,
        preferredPatterns: [],
        suppressedPatterns: [],
        customRuleSuggestions: [],
        feedbackStats: {},
        adoptionRates: {},
      },
      update: {},
    });

    const suppressedPatterns = Array.isArray(learning.suppressedPatterns)
      ? (learning.suppressedPatterns as Array<Record<string, unknown>>)
      : [];
    const customRuleSuggestions = Array.isArray(learning.customRuleSuggestions)
      ? (learning.customRuleSuggestions as Array<Record<string, unknown>>)
      : [];

    const now = nowIso();

    switch (payload.action) {
      case "toggle_suppression": {
        const item = suppressedPatterns.find((p) => p.id === payload.suppressionId);
        if (!item) {
          return jsonError("NOT_FOUND", "Suppression entry not found", 404);
        }
        item.enabled = payload.enabled;
        item.updatedAt = now;
        await db.reviewLearning.update({
          where: { id: learning.id },
          data: {
            suppressedPatterns: suppressedPatterns as unknown as Prisma.InputJsonValue,
            updatedAt: new Date(now),
          },
        });
        break;
      }
      case "add_suppression": {
        if (payload.type === "category") {
          if (!payload.category) {
            return jsonError("VALIDATION_001", "Missing category", 400);
          }
          suppressedPatterns.push({
            id: `manual_${randomUUID()}`,
            type: "category",
            category: payload.category,
            reason: payload.reason || "Manually suppressed by user",
            source: "manual",
            enabled: true,
            count: 0,
            createdAt: now,
            updatedAt: now,
          });
        } else {
          if (!payload.pattern) {
            return jsonError("VALIDATION_001", "Missing pattern", 400);
          }
          suppressedPatterns.push({
            id: `manual_${randomUUID()}`,
            type: "text",
            pattern: payload.pattern,
            reason: payload.reason || "Manually suppressed by user",
            source: "manual",
            enabled: true,
            count: 0,
            createdAt: now,
            updatedAt: now,
          });
        }
        await db.reviewLearning.update({
          where: { id: learning.id },
          data: {
            suppressedPatterns: suppressedPatterns as unknown as Prisma.InputJsonValue,
            updatedAt: new Date(now),
          },
        });
        break;
      }
      case "dismiss_rule_suggestion": {
        const item = customRuleSuggestions.find((s) => s.id === payload.suggestionId);
        if (!item) {
          return jsonError("NOT_FOUND", "Rule suggestion not found", 404);
        }
        item.status = "dismissed";
        item.updatedAt = now;
        await db.reviewLearning.update({
          where: { id: learning.id },
          data: {
            customRuleSuggestions: customRuleSuggestions as unknown as Prisma.InputJsonValue,
            updatedAt: new Date(now),
          },
        });
        break;
      }
      case "accept_rule_suggestion": {
        const item = customRuleSuggestions.find((s) => s.id === payload.suggestionId);
        if (!item) {
          return jsonError("NOT_FOUND", "Rule suggestion not found", 404);
        }

        const rule = item.rule as unknown as ReviewRule | undefined;
        if (!rule || !rule.id || !rule.name || !rule.message) {
          return jsonError("VALIDATION_001", "Invalid rule suggestion payload", 400);
        }

        const settings = parseReviewSettings(repository.reviewRules);
        const exists = settings.customRules.some((r) => r.id === rule.id);
        if (!exists) {
          settings.customRules.push({ ...rule, enabled: true });
        } else {
          settings.customRules = settings.customRules.map((r) =>
            r.id === rule.id ? { ...r, enabled: true } : r
          );
        }

        await db.repository.update({
          where: { id: repository.id },
          data: { reviewRules: settings as unknown as Prisma.InputJsonValue },
        });

        item.status = "adopted";
        item.updatedAt = now;
        await db.reviewLearning.update({
          where: { id: learning.id },
          data: {
            customRuleSuggestions: customRuleSuggestions as unknown as Prisma.InputJsonValue,
            updatedAt: new Date(now),
          },
        });
        break;
      }
    }

    invalidateLearningCache(repository.id);
    return jsonSuccess({ ok: true });
  } catch (error) {
    console.error("[Learning API] Failed to update learning state:", error);
    return jsonError("INTERNAL_001", "Failed to update learning state", 500);
  }
}
