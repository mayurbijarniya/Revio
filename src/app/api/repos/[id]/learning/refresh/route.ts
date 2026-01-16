import { NextRequest, after } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonError, jsonSuccess } from "@/lib/api-utils";
import { getUserAccessToken } from "@/lib/auth";
import { GitHubService } from "@/lib/services/github";
import { generateChatResponse, type ChatMessage } from "@/lib/services/gemini";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  IssueCategories,
  SeverityLevels,
  type ReviewRule,
} from "@/types/review";
import { invalidateLearningCache } from "@/lib/services/learning";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const LEARNING_REFRESH_RATE_LIMIT = {
  maxPerHour: 10,
  windowMs: 60 * 60 * 1000,
};

const suggestionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(""),
  message: z.string().min(1).max(500),
  category: z.enum(IssueCategories),
  severity: z.enum(SeverityLevels),
  pattern: z.string().max(500).optional().nullable(),
  examples: z.array(z.string()).optional().default([]),
  confidence: z.number().min(0).max(1).optional().default(0.6),
});

const aiResponseSchema = z.array(suggestionSchema).max(10);

function isBotUser(user: { login?: string; type?: string } | null | undefined): boolean {
  const login = (user?.login || "").toLowerCase();
  const type = (user?.type || "").toLowerCase();
  return type === "bot" || login.endsWith("[bot]") || login.includes("revio-bot");
}

function normalizeKey(text: string): string {
  return text.trim().toLowerCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

function ruleIdFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `learned-${slug || "rule"}`;
}

/**
 * POST /api/repos/[id]/learning/refresh
 * Re-scan recent PR comments and update suggested rules.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  const repository = await db.repository.findFirst({
    where: { id, userId: session.userId },
    select: { id: true, fullName: true, reviewRules: true, organizationId: true },
  });

  if (!repository) {
    return jsonError("REPO_001", "Repository not found", 404);
  }

  const accessToken = await getUserAccessToken(session.userId);
  if (!accessToken) {
    return jsonError("AUTH_004", "Access token not found", 401);
  }

  const windowStart = new Date(Date.now() - LEARNING_REFRESH_RATE_LIMIT.windowMs);
  const recentCount = await db.usage.count({
    where: {
      userId: session.userId,
      repositoryId: repository.id,
      actionType: "learning_refresh",
      createdAt: { gte: windowStart },
    },
  });

  if (recentCount >= LEARNING_REFRESH_RATE_LIMIT.maxPerHour) {
    return jsonError(
      "RATE_LIMIT_001",
      `Too many refresh requests. Try again later.`,
      429,
      {
        limit: LEARNING_REFRESH_RATE_LIMIT.maxPerHour,
        windowSeconds: Math.floor(LEARNING_REFRESH_RATE_LIMIT.windowMs / 1000),
      }
    );
  }

  await db.usage.create({
    data: {
      userId: session.userId,
      organizationId: repository.organizationId || undefined,
      repositoryId: repository.id,
      actionType: "learning_refresh",
      tokensInput: 0,
      tokensOutput: 0,
      metadata: { source: "manual" } as unknown as Prisma.InputJsonValue,
    },
  });

  const [owner, repo] = repository.fullName.split("/");
  if (!owner || !repo) {
    return jsonError("REPO_002", "Invalid repository name", 400);
  }

  after(async () => {
    try {
      // Pull a small set of recent reviewed PRs as a data source.
      const recent = await db.prReview.findMany({
        where: { repositoryId: repository.id, status: "completed" },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: { prNumber: true },
      });

      const prNumbers = Array.from(new Set(recent.map((r) => r.prNumber))).slice(0, 10);
      if (prNumbers.length === 0) return;

      const github = new GitHubService(accessToken);
      const commentBodies: string[] = [];

      for (const prNumber of prNumbers) {
        const [issueComments, reviewComments] = await Promise.all([
          github.listIssueComments(owner, repo, prNumber, { perPage: 50 }),
          github.listReviewComments(owner, repo, prNumber, { perPage: 50 }),
        ]);

        for (const c of issueComments) {
          if (isBotUser(c.user)) continue;
          const body = (c.body || "").trim();
          if (!body) continue;
          if (body.toLowerCase().includes("@revio-bot")) continue;
          commentBodies.push(`PR #${prNumber} (issue comment) by ${c.user.login}:\n${body}`);
        }

        for (const c of reviewComments) {
          if (isBotUser(c.user)) continue;
          const body = (c.body || "").trim();
          if (!body) continue;
          if (body.toLowerCase().includes("@revio-bot")) continue;
          commentBodies.push(
            `PR #${prNumber} (inline review comment) by ${c.user.login} on ${c.path}:${c.line ?? "?"}:\n${body}`
          );
        }
      }

      const trimmed = commentBodies
        .slice(0, 40)
        .map((t) => (t.length > 800 ? t.slice(0, 800) + "…" : t));

      if (trimmed.length === 0) return;

      const systemPrompt =
        "You extract actionable, recurring team preferences from human PR review comments and convert them into reusable code review rules. " +
        "Return ONLY valid JSON (no code fences). Output an array of up to 10 rules. " +
        `Allowed categories: ${IssueCategories.join(", ")}. ` +
        `Allowed severities: ${SeverityLevels.join(", ")}. ` +
        "Each item must include: name, message, category, severity. " +
        "Optionally include: description, pattern (simple regex if appropriate), examples (short), confidence (0..1). " +
        "Avoid suggesting rules that would suppress bugs/security concerns. Keep rules specific and implementable.";

      const userPrompt = [
        "Human PR review comments:",
        "",
        ...trimmed,
      ].join("\n\n");

      const messages: ChatMessage[] = [{ role: "user", content: userPrompt }];
      const raw = await generateChatResponse(systemPrompt, messages, {
        temperature: 0.2,
        maxTokens: 1200,
      });

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw);
      } catch {
        return;
      }

      const validated = aiResponseSchema.safeParse(parsedJson);
      if (!validated.success) return;

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

      const existing = Array.isArray(learning.customRuleSuggestions)
        ? (learning.customRuleSuggestions as Array<Record<string, unknown>>)
        : [];

      const byKey = new Map<string, Record<string, unknown>>();
      for (const s of existing) {
        const rule = s.rule as unknown as { message?: string; name?: string } | undefined;
        const key = normalizeKey(rule?.message || rule?.name || "");
        if (key) byKey.set(key, s);
      }

      for (const s of validated.data) {
        const key = normalizeKey(s.message || s.name);
        const existingSuggestion = byKey.get(key);

        const rule: ReviewRule = {
          id: ruleIdFromName(s.name),
          name: s.name,
          description: s.description || "",
          enabled: false,
          pattern: s.pattern || undefined,
          category: s.category,
          severity: s.severity,
          message: s.message,
        };

        if (existingSuggestion) {
          existingSuggestion.rule = rule;
          existingSuggestion.frequency = (typeof existingSuggestion.frequency === "number"
            ? existingSuggestion.frequency
            : 1) + 1;
          existingSuggestion.confidence =
            typeof existingSuggestion.confidence === "number"
              ? Math.max(existingSuggestion.confidence, s.confidence)
              : s.confidence;
          existingSuggestion.examples = Array.from(
            new Set([
              ...((Array.isArray(existingSuggestion.examples) ? existingSuggestion.examples : []) as string[]),
              ...(s.examples || []),
            ])
          ).slice(0, 10);
          existingSuggestion.status = existingSuggestion.status || "suggested";
          existingSuggestion.updatedAt = nowIso();
        } else {
          existing.push({
            id: `suggest_${randomUUID()}`,
            rule,
            source: "pr_comments",
            confidence: s.confidence,
            frequency: 1,
            examples: (s.examples || []).slice(0, 10),
            status: "suggested",
            createdAt: nowIso(),
            updatedAt: nowIso(),
          });
        }
      }

      await db.reviewLearning.update({
        where: { id: learning.id },
        data: { customRuleSuggestions: existing as unknown as Prisma.InputJsonValue },
      });

      invalidateLearningCache(repository.id);
    } catch (error) {
      console.error("[Learning Refresh] Failed:", error);
    }
  });

  return jsonSuccess({ message: "Learning refresh started" });
}
