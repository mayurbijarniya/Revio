import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { cache } from "@/lib/cache";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  IssueCategories,
  SeverityLevels,
  type IssueCategory,
  type ReviewRule,
  type ReviewSettings,
  DEFAULT_REVIEW_SETTINGS,
} from "@/types/review";
import type { ReviewResult } from "@/lib/prompts/review";

export type ReviewFeedback = "helpful" | "not_helpful";

export interface SuppressedPattern {
  id: string;
  type: "category" | "issueType" | "text";
  category?: IssueCategory;
  issueType?: string;
  pattern?: string;
  reason?: string;
  source: "auto_adoption" | "auto_feedback" | "bot_ignore" | "manual";
  enabled: boolean;
  count: number;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestedRule {
  id: string;
  rule: ReviewRule;
  source: "pr_comments" | "manual";
  confidence: number; // 0..1
  frequency: number;
  examples: string[];
  status: "suggested" | "dismissed" | "adopted";
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackStats {
  [category: string]: {
    helpful: number;
    notHelpful: number;
  };
}

export interface AdoptionRate {
  adopted: number;
  total: number;
  rate: number; // 0..1
  lastUpdated: string;
}

export interface EffectiveLearningContext {
  repositoryId: string;
  organizationId: string | null;
  suppressedCategories: IssueCategory[];
  suppressedIssueTypes: string[];
  suppressedText: string[];
  suppressedPatterns: SuppressedPattern[];
  suggestedRules: SuggestedRule[];
  feedbackStats: FeedbackStats;
  adoptionRates: Record<string, AdoptionRate>;
}

const AUTO_SUPPRESSIBLE_CATEGORIES: IssueCategory[] = ["style", "documentation"];
const NEVER_SUPPRESS_CATEGORIES = new Set<IssueCategory>(["security"]);
const LEARNING_CACHE_TTL_SECONDS = 5 * 60;

function nowIso(): string {
  return new Date().toISOString();
}

function isIssueCategory(value: unknown): value is IssueCategory {
  return typeof value === "string" && (IssueCategories as readonly string[]).includes(value);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord<T extends Record<string, unknown>>(value: unknown): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as T;
  }
  return value as T;
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

function buildIssueTypeKey(issue: {
  category?: string;
  title?: string;
  ruleId?: string;
}): string {
  const category = (issue.category || "other").toLowerCase();
  const title = issue.title ? normalizeText(issue.title) : "";
  const ruleId = issue.ruleId ? normalizeText(issue.ruleId) : "";

  if (ruleId) return `${category}:rule:${ruleId}`;
  if (title) return `${category}:title:${title}`;
  return `${category}:unknown`;
}

function shouldNeverSuppressIssue(issue: {
  severity?: string;
  category?: string;
  title?: string;
  description?: string;
}): boolean {
  const category = issue.category?.toLowerCase() || "";
  const severity = issue.severity?.toLowerCase() || "";

  if (category === "security") return true;
  if (severity === "critical") return true;

  const title = (issue.title || "").toLowerCase();
  const description = (issue.description || "").toLowerCase();
  if (title.includes("data loss") || description.includes("data loss")) return true;

  return false;
}

function parseSuppressedPatterns(value: unknown): SuppressedPattern[] {
  const items = asArray<unknown>(value);
  const parsed: SuppressedPattern[] = [];
  for (const item of items) {
    const obj = asRecord<Record<string, unknown>>(item);
    const id = typeof obj.id === "string" ? obj.id : "";
    const type = obj.type;
    const source = obj.source;
    const enabled = typeof obj.enabled === "boolean" ? obj.enabled : true;
    const count = typeof obj.count === "number" ? obj.count : 0;
    const createdAt = typeof obj.createdAt === "string" ? obj.createdAt : nowIso();
    const updatedAt = typeof obj.updatedAt === "string" ? obj.updatedAt : nowIso();

    if (!id || (type !== "category" && type !== "issueType" && type !== "text")) continue;
    if (
      source !== "auto_adoption" &&
      source !== "auto_feedback" &&
      source !== "bot_ignore" &&
      source !== "manual"
    ) {
      continue;
    }

    const candidate: SuppressedPattern = {
      id,
      type,
      source,
      enabled,
      count,
      createdAt,
      updatedAt,
    };

    if (type === "category" && isIssueCategory(obj.category)) {
      candidate.category = obj.category;
    }
    if (type === "issueType" && typeof obj.issueType === "string") {
      candidate.issueType = obj.issueType;
    }
    if (type === "text" && typeof obj.pattern === "string") {
      candidate.pattern = obj.pattern;
    }
    if (typeof obj.reason === "string") {
      candidate.reason = obj.reason;
    }

    parsed.push(candidate);
  }

  return parsed;
}

function parseSuggestedRules(value: unknown): SuggestedRule[] {
  const items = asArray<unknown>(value);
  const parsed: SuggestedRule[] = [];
  for (const item of items) {
    const obj = asRecord<Record<string, unknown>>(item);
    const id = typeof obj.id === "string" ? obj.id : "";
    const rule = obj.rule as unknown;
    const source = obj.source;
    const confidence = typeof obj.confidence === "number" ? clamp01(obj.confidence) : 0.5;
    const frequency = typeof obj.frequency === "number" ? obj.frequency : 1;
    const examples = asArray<string>(obj.examples).filter((e) => typeof e === "string");
    const status = obj.status;
    const createdAt = typeof obj.createdAt === "string" ? obj.createdAt : nowIso();
    const updatedAt = typeof obj.updatedAt === "string" ? obj.updatedAt : nowIso();

    if (!id) continue;
    if (source !== "pr_comments" && source !== "manual") continue;
    if (status !== "suggested" && status !== "dismissed" && status !== "adopted") continue;

    const ruleObj = asRecord<Record<string, unknown>>(rule);
    const category = ruleObj.category;
    const severity = ruleObj.severity;

    if (!isIssueCategory(category)) continue;
    if (typeof severity !== "string" || !(SeverityLevels as readonly string[]).includes(severity)) {
      continue;
    }

    const reviewRule: ReviewRule = {
      id: typeof ruleObj.id === "string" ? ruleObj.id : id,
      name: typeof ruleObj.name === "string" ? ruleObj.name : "Suggested Rule",
      description: typeof ruleObj.description === "string" ? ruleObj.description : "",
      enabled: typeof ruleObj.enabled === "boolean" ? ruleObj.enabled : false,
      pattern: typeof ruleObj.pattern === "string" ? ruleObj.pattern : undefined,
      category,
      severity: severity as ReviewRule["severity"],
      message: typeof ruleObj.message === "string" ? ruleObj.message : "",
    };

    parsed.push({
      id,
      rule: reviewRule,
      source,
      confidence,
      frequency,
      examples,
      status,
      createdAt,
      updatedAt,
    });
  }
  return parsed;
}

function parseFeedbackStats(value: unknown): FeedbackStats {
  const obj = asRecord<Record<string, unknown>>(value);
  const stats: FeedbackStats = {};

  for (const [key, raw] of Object.entries(obj)) {
    const row = asRecord<Record<string, unknown>>(raw);
    const helpful = typeof row.helpful === "number" ? row.helpful : 0;
    const notHelpful = typeof row.notHelpful === "number" ? row.notHelpful : 0;
    stats[key] = { helpful, notHelpful };
  }

  return stats;
}

function parseAdoptionRates(value: unknown): Record<string, AdoptionRate> {
  const obj = asRecord<Record<string, unknown>>(value);
  const parsed: Record<string, AdoptionRate> = {};

  for (const [key, raw] of Object.entries(obj)) {
    const row = asRecord<Record<string, unknown>>(raw);
    const adopted = typeof row.adopted === "number" ? row.adopted : 0;
    const total = typeof row.total === "number" ? row.total : 0;
    const rate =
      typeof row.rate === "number" ? clamp01(row.rate) : total > 0 ? clamp01(adopted / total) : 0;
    const lastUpdated = typeof row.lastUpdated === "string" ? row.lastUpdated : nowIso();
    parsed[key] = { adopted, total, rate, lastUpdated };
  }

  return parsed;
}

async function getOrCreateRepoLearning(repositoryId: string) {
  return db.reviewLearning.upsert({
    where: { repositoryId },
    create: {
      repositoryId,
      preferredPatterns: [],
      suppressedPatterns: [],
      customRuleSuggestions: [],
      feedbackStats: {},
      adoptionRates: {},
    },
    update: {},
  });
}

async function getOrCreateOrgLearning(organizationId: string) {
  return db.reviewLearning.upsert({
    where: { organizationId },
    create: {
      organizationId,
      preferredPatterns: [],
      suppressedPatterns: [],
      customRuleSuggestions: [],
      feedbackStats: {},
      adoptionRates: {},
    },
    update: {},
  });
}

function mergeLearning(repoRow: unknown | null, orgRow: unknown | null): EffectiveLearningContext {
  const repo = repoRow as {
    repositoryId?: string | null;
    organizationId?: string | null;
    suppressedPatterns?: unknown;
    customRuleSuggestions?: unknown;
    feedbackStats?: unknown;
    adoptionRates?: unknown;
  } | null;

  const org = orgRow as {
    organizationId?: string | null;
    suppressedPatterns?: unknown;
    customRuleSuggestions?: unknown;
    feedbackStats?: unknown;
    adoptionRates?: unknown;
  } | null;

  const repoSuppressed = parseSuppressedPatterns(repo?.suppressedPatterns);
  const orgSuppressed = parseSuppressedPatterns(org?.suppressedPatterns);
  const suppressedPatterns = [...repoSuppressed, ...orgSuppressed].filter((p) => p.enabled);

  const suppressedCategories = new Set<IssueCategory>();
  const suppressedIssueTypes = new Set<string>();
  const suppressedText = new Set<string>();

  for (const entry of suppressedPatterns) {
    if (entry.type === "category" && entry.category) suppressedCategories.add(entry.category);
    if (entry.type === "issueType" && entry.issueType) suppressedIssueTypes.add(entry.issueType);
    if (entry.type === "text" && entry.pattern) suppressedText.add(entry.pattern);
  }

  const suggestedRules = [
    ...parseSuggestedRules(repo?.customRuleSuggestions),
    ...parseSuggestedRules(org?.customRuleSuggestions),
  ].filter((s) => s.status === "suggested");

  const feedbackStats = {
    ...parseFeedbackStats(org?.feedbackStats),
    ...parseFeedbackStats(repo?.feedbackStats),
  };

  const adoptionRates = {
    ...parseAdoptionRates(org?.adoptionRates),
    ...parseAdoptionRates(repo?.adoptionRates),
  };

  return {
    repositoryId: repo?.repositoryId || "",
    organizationId: repo?.organizationId || org?.organizationId || null,
    suppressedCategories: Array.from(suppressedCategories),
    suppressedIssueTypes: Array.from(suppressedIssueTypes),
    suppressedText: Array.from(suppressedText),
    suppressedPatterns,
    suggestedRules,
    feedbackStats,
    adoptionRates,
  };
}

function effectiveLearningCacheKey(repositoryId: string): string {
  return cache.generateKey("learning", "effective", repositoryId);
}

export function invalidateLearningCache(repositoryId: string): void {
  cache.delete(effectiveLearningCacheKey(repositoryId));
}

export async function getEffectiveLearningContext(
  repositoryId: string
): Promise<EffectiveLearningContext> {
  const cached = cache.get<EffectiveLearningContext>(effectiveLearningCacheKey(repositoryId));
  if (cached) return cached;

  const repository = await db.repository.findUnique({
    where: { id: repositoryId },
    select: { id: true, organizationId: true },
  });

  if (!repository) {
    throw new Error("Repository not found");
  }

  const [repoLearning, orgLearning] = await Promise.all([
    getOrCreateRepoLearning(repository.id),
    repository.organizationId ? getOrCreateOrgLearning(repository.organizationId) : null,
  ]);

  const merged = mergeLearning(repoLearning, orgLearning);
  cache.set(effectiveLearningCacheKey(repositoryId), merged, LEARNING_CACHE_TTL_SECONDS);
  return merged;
}

function applyAutoCategorySuppression(
  suppressed: SuppressedPattern[],
  stats: FeedbackStats
): SuppressedPattern[] {
  const out = [...suppressed];
  const now = nowIso();

  for (const category of AUTO_SUPPRESSIBLE_CATEGORIES) {
    const row = stats[category];
    if (!row) continue;
    const total = (row.helpful || 0) + (row.notHelpful || 0);
    if (total < 10) continue;
    const helpfulRate = total > 0 ? row.helpful / total : 0;
    if (helpfulRate >= 0.2) continue;
    if (NEVER_SUPPRESS_CATEGORIES.has(category)) continue;

    const existing = out.find((s) => s.type === "category" && s.category === category);
    if (existing) {
      existing.enabled = true;
      existing.source = existing.source || "auto_feedback";
      existing.reason = existing.reason || "Auto-suppressed due to low feedback helpfulness";
      existing.count = Math.max(existing.count, total);
      existing.updatedAt = now;
      continue;
    }

    out.push({
      id: `supp_${category}_${randomUUID()}`,
      type: "category",
      category,
      reason: "Auto-suppressed due to low feedback helpfulness",
      source: "auto_feedback",
      enabled: true,
      count: total,
      createdAt: now,
      updatedAt: now,
    });
  }

  return out;
}

export function buildLearningPromptSection(learning: EffectiveLearningContext): string {
  const parts: string[] = [];

  if (learning.suppressedCategories.length > 0 || learning.suppressedIssueTypes.length > 0) {
    parts.push("## Team Preferences (Learned)");
    parts.push(
      "The team has consistently ignored the following categories or issue types. Avoid raising them unless they indicate a real bug, data loss, or security risk."
    );
    if (learning.suppressedCategories.length > 0) {
      parts.push(`- Suppressed categories: ${learning.suppressedCategories.join(", ")}`);
    }
    if (learning.suppressedIssueTypes.length > 0) {
      parts.push(`- Suppressed issue types: ${learning.suppressedIssueTypes.slice(0, 25).join(", ")}`);
    }
  }

  if (learning.suppressedText.length > 0) {
    parts.push("## Issues to Avoid (Learned)");
    parts.push(
      "The team asked to suppress/ignore the following recurring topics. Do not raise issues about these unless there is a clear correctness/security impact:"
    );
    for (const pattern of learning.suppressedText.slice(0, 15)) {
      parts.push(`- ${pattern}`);
    }
  }

  return parts.length > 0 ? `\n\n${parts.join("\n")}` : "";
}

export function applyLearningNitpickFiltering(
  review: ReviewResult,
  learning: EffectiveLearningContext,
  settings?: ReviewSettings
): ReviewResult {
  const effectiveSettings = settings || DEFAULT_REVIEW_SETTINGS;
  const suppressedCategories = new Set<IssueCategory>(learning.suppressedCategories);
  const suppressedIssueTypes = new Set<string>(learning.suppressedIssueTypes);
  const suppressedText = learning.suppressedText.map((t) => normalizeText(t)).filter(Boolean);

  const minSeverityRank: Record<string, number> = {
    info: 0,
    suggestion: 1,
    warning: 2,
    critical: 3,
  };
  const minRank = minSeverityRank[effectiveSettings.minSeverity] ?? 0;

  const issues = (review.issues || []).filter((issue) => {
    if (shouldNeverSuppressIssue(issue)) return true;

    const category = issue.category as IssueCategory | undefined;
    const severity = (issue.severity || "info").toLowerCase();
    const severityRank = minSeverityRank[severity] ?? 0;

    if (severityRank < minRank) {
      return false;
    }

    if (category && suppressedCategories.has(category)) {
      return false;
    }

    const issueType = buildIssueTypeKey(issue);
    if (suppressedIssueTypes.has(issueType)) {
      return false;
    }

    if (suppressedText.length > 0) {
      const haystack = `${issue.title || ""}\n${issue.description || ""}`.toLowerCase();
      for (const pattern of suppressedText) {
        if (!pattern) continue;
        if (haystack.includes(pattern)) return false;
      }
    }

    return true;
  });

  return {
    ...review,
    issues,
  };
}

export async function recordReviewFeedbackChange(params: {
  reviewId: string;
  previousFeedback: ReviewFeedback | null;
  nextFeedback: ReviewFeedback | null;
}): Promise<void> {
  const { reviewId, previousFeedback, nextFeedback } = params;

  const review = await db.prReview.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      repositoryId: true,
      issues: true,
      repository: { select: { organizationId: true } },
    },
  });

  if (!review) return;

  const issueList = asArray<Record<string, unknown>>(review.issues);
  const categoriesPresent = new Set<IssueCategory>();
  for (const issue of issueList) {
    const category = issue.category;
    if (isIssueCategory(category)) {
      categoriesPresent.add(category);
    }
  }

  const delta = (from: ReviewFeedback | null, to: ReviewFeedback | null) => {
    if (from === to) return { incHelpful: 0, incNotHelpful: 0 };
    const incHelpful = (to === "helpful" ? 1 : 0) - (from === "helpful" ? 1 : 0);
    const incNotHelpful = (to === "not_helpful" ? 1 : 0) - (from === "not_helpful" ? 1 : 0);
    return { incHelpful, incNotHelpful };
  };

  const { incHelpful, incNotHelpful } = delta(previousFeedback, nextFeedback);
  if (incHelpful === 0 && incNotHelpful === 0) return;

  const now = nowIso();

  // Update repo learning stats
  const repoLearning = await getOrCreateRepoLearning(review.repositoryId);
  const repoStats = parseFeedbackStats(repoLearning.feedbackStats);
  for (const category of categoriesPresent) {
    const stat = repoStats[category] || { helpful: 0, notHelpful: 0 };
    stat.helpful = Math.max(0, (stat.helpful || 0) + incHelpful);
    stat.notHelpful = Math.max(0, (stat.notHelpful || 0) + incNotHelpful);
    repoStats[category] = stat;
  }

  const repoSuppressed = applyAutoCategorySuppression(
    parseSuppressedPatterns(repoLearning.suppressedPatterns),
    repoStats
  );

  await db.reviewLearning.update({
    where: { id: repoLearning.id },
    data: {
      feedbackStats: repoStats as unknown as Prisma.InputJsonValue,
      suppressedPatterns: repoSuppressed as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(now),
    },
  });

  // Update org learning stats (if any)
  const organizationId = review.repository.organizationId;
  if (organizationId) {
    const orgLearning = await getOrCreateOrgLearning(organizationId);
    const orgStats = parseFeedbackStats(orgLearning.feedbackStats);
    for (const category of categoriesPresent) {
      const stat = orgStats[category] || { helpful: 0, notHelpful: 0 };
      stat.helpful = Math.max(0, (stat.helpful || 0) + incHelpful);
      stat.notHelpful = Math.max(0, (stat.notHelpful || 0) + incNotHelpful);
      orgStats[category] = stat;
    }

    const orgSuppressed = applyAutoCategorySuppression(
      parseSuppressedPatterns(orgLearning.suppressedPatterns),
      orgStats
    );

    await db.reviewLearning.update({
      where: { id: orgLearning.id },
      data: {
        feedbackStats: orgStats as unknown as Prisma.InputJsonValue,
        suppressedPatterns: orgSuppressed as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(now),
      },
    });
  }

  invalidateLearningCache(review.repositoryId);

  logger.info("Recorded review feedback for learning", {
    prReviewId: reviewId,
    repositoryId: review.repositoryId,
    organizationId: organizationId || undefined,
    categories: Array.from(categoriesPresent),
    previousFeedback: previousFeedback || undefined,
    nextFeedback: nextFeedback || undefined,
  });
}

export async function recordIgnorePattern(params: {
  repositoryId: string;
  pattern: string;
  reason?: string;
}): Promise<void> {
  const { repositoryId, pattern, reason } = params;
  const normalized = pattern.trim();
  if (!normalized) return;

  const learning = await getOrCreateRepoLearning(repositoryId);
  const suppressed = parseSuppressedPatterns(learning.suppressedPatterns);
  const now = nowIso();

  const existing = suppressed.find(
    (s) => s.type === "text" && normalizeText(s.pattern || "") === normalizeText(normalized)
  );

  if (existing) {
    existing.enabled = true;
    existing.count = (existing.count || 0) + 1;
    existing.updatedAt = now;
    if (reason && !existing.reason) existing.reason = reason;
  } else {
    suppressed.push({
      id: `ignore_${randomUUID()}`,
      type: "text",
      pattern: normalized,
      reason: reason || "User requested ignore via @revio-bot",
      source: "bot_ignore",
      enabled: true,
      count: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db.reviewLearning.update({
    where: { id: learning.id },
    data: {
      suppressedPatterns: suppressed as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(now),
    },
  });

  invalidateLearningCache(repositoryId);
}

export async function updateAdoptionRatesFromRuns(params: {
  prReviewId: string;
}): Promise<void> {
  const { prReviewId } = params;

  const [latestRun, previousRun, prReview] = await Promise.all([
    db.prReviewRun.findFirst({
      where: { prReviewId },
      orderBy: { runNumber: "desc" },
      select: { runNumber: true, issues: true },
    }),
    db.prReviewRun.findFirst({
      where: { prReviewId },
      orderBy: { runNumber: "desc" },
      skip: 1,
      select: { runNumber: true, issues: true },
    }),
    db.prReview.findUnique({
      where: { id: prReviewId },
      select: { repositoryId: true, repository: { select: { organizationId: true } } },
    }),
  ]);

  if (!latestRun || !previousRun || !prReview) return;

  const previousIssues = asArray<Record<string, unknown>>(previousRun.issues);
  const latestIssues = asArray<Record<string, unknown>>(latestRun.issues);

  const prevKeys = new Set(previousIssues.map((i) => buildIssueTypeKey(i)).filter(Boolean));
  const nextKeys = new Set(latestIssues.map((i) => buildIssueTypeKey(i)).filter(Boolean));

  const resolved = Array.from(prevKeys).filter((k) => !nextKeys.has(k));
  const unresolved = Array.from(prevKeys).filter((k) => nextKeys.has(k));

  if (resolved.length === 0 && unresolved.length === 0) return;

  const repositoryId = prReview.repositoryId;
  const organizationId = prReview.repository.organizationId;

  const now = nowIso();

  const updateRecord = async (scope: { repositoryId?: string; organizationId?: string }) => {
    if (!scope.repositoryId && !scope.organizationId) return;

    const learning = scope.repositoryId
      ? await getOrCreateRepoLearning(scope.repositoryId)
      : await getOrCreateOrgLearning(scope.organizationId!);

    const adoptionRates = parseAdoptionRates(learning.adoptionRates);

    for (const key of resolved) {
      const current = adoptionRates[key] || { adopted: 0, total: 0, rate: 0, lastUpdated: now };
      current.adopted += 1;
      current.total += 1;
      current.rate = clamp01(current.adopted / current.total);
      current.lastUpdated = now;
      adoptionRates[key] = current;
    }

    for (const key of unresolved) {
      const current = adoptionRates[key] || { adopted: 0, total: 0, rate: 0, lastUpdated: now };
      current.total += 1;
      current.rate = clamp01(current.adopted / current.total);
      current.lastUpdated = now;
      adoptionRates[key] = current;
    }

    // Auto-suppress low adoption issue types (only for suppressible categories)
    const suppressed = parseSuppressedPatterns(learning.suppressedPatterns);
    for (const [issueType, row] of Object.entries(adoptionRates)) {
      if (row.total < 10) continue;
      if (row.rate >= 0.2) continue;

      const category = issueType.split(":")[0] || "";
      if (!isIssueCategory(category)) continue;
      if (!AUTO_SUPPRESSIBLE_CATEGORIES.includes(category)) continue;

      const existing = suppressed.find((s) => s.type === "issueType" && s.issueType === issueType);
      if (existing) {
        existing.enabled = true;
        existing.count = Math.max(existing.count, row.total);
        existing.updatedAt = now;
        continue;
      }

      suppressed.push({
        id: `adopt_${randomUUID()}`,
        type: "issueType",
        issueType,
        reason: "Auto-suppressed due to low adoption rate across re-reviews",
        source: "auto_adoption",
        enabled: true,
        count: row.total,
        createdAt: now,
        updatedAt: now,
      });
    }

    await db.reviewLearning.update({
      where: { id: learning.id },
      data: {
        adoptionRates: adoptionRates as unknown as Prisma.InputJsonValue,
        suppressedPatterns: suppressed as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(now),
      },
    });
  };

  await updateRecord({ repositoryId });
  if (organizationId) {
    await updateRecord({ organizationId });
  }

  invalidateLearningCache(repositoryId);

  logger.info("Updated adoption rates from review runs", {
    prReviewId,
    repositoryId,
    organizationId: organizationId || undefined,
    previousRun: previousRun.runNumber,
    latestRun: latestRun.runNumber,
    resolvedCount: resolved.length,
    unresolvedCount: unresolved.length,
  });
}
