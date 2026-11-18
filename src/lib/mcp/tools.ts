/**
 * Revio MCP tool handlers. Each returns plain text for the model (compact, so it does not fill
 * the client's context window) and marks user-correctable problems as errors.
 */
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AI_CONFIG, MCP_CONFIG } from "@/lib/constants";
import { parseReviewSettings } from "@/types/review";
import { checkMcpReviewRateLimit, checkPrReviewLimit } from "@/lib/plan-limits";
import { parseUnifiedDiff } from "@/lib/services/diff-parser";
import { runReviewCore, type ReviewCoreResult } from "@/lib/services/review-core";
import { createReviewProviders } from "@/lib/services/review-providers";
import { analyzeChangeImpact, getCodeGraph, type CodeGraphData } from "@/lib/services/code-graph";
import { retrieveContext, retrieveMultiRepoContext } from "@/lib/services/retriever";
import { isRepositoryChatReady } from "@/lib/services/chat-service";
import type { ReviewIssue, ReviewResult } from "@/lib/prompts/review";
import type { BlastRadiusData } from "@/types/blast-radius";

export interface McpContext {
  userId: string;
  keyId: string;
}

export interface ToolOutput {
  text: string;
  isError?: boolean;
}

function fail(text: string): ToolOutput {
  return { text, isError: true };
}

const repositorySelect = {
  id: true,
  fullName: true,
  name: true,
  private: true,
  language: true,
  indexStatus: true,
  indexedAt: true,
  fileCount: true,
  chunkCount: true,
  autoReview: true,
  ignoredPaths: true,
  reviewRules: true,
  organizationId: true,
} as const;

type RepositoryRow = Awaited<ReturnType<typeof loadRepositories>>[number];

async function loadRepositories(userId: string) {
  return db.repository.findMany({
    where: { userId },
    select: repositorySelect,
    orderBy: { fullName: "asc" },
  });
}

/**
 * Find one of the user's repositories by "owner/name", repository name or id
 */
export async function resolveRepository(
  userId: string,
  reference: string
): Promise<{ repository: RepositoryRow } | { error: string }> {
  const repositories = await loadRepositories(userId);
  if (repositories.length === 0) {
    return { error: "You have no repositories connected to Revio. Connect one in the Revio dashboard first." };
  }

  const ref = reference.trim().toLowerCase();
  const exact = repositories.find((r) => r.id === reference.trim() || r.fullName.toLowerCase() === ref);
  if (exact) return { repository: exact };

  const byName = repositories.filter((r) => r.name.toLowerCase() === ref);
  if (byName.length === 1 && byName[0]) return { repository: byName[0] };

  const available = repositories.map((r) => r.fullName).join(", ");
  return {
    error:
      byName.length > 1
        ? `"${reference}" matches several repositories. Use the full name: ${byName.map((r) => r.fullName).join(", ")}.`
        : `Repository "${reference}" is not connected to Revio. Connected repositories: ${available}.`,
  };
}

function formatDay(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "never";
}

// ------------------------------------------------------------------ list_repositories

export async function listRepositoriesTool(ctx: McpContext): Promise<ToolOutput> {
  const repositories = await loadRepositories(ctx.userId);
  if (repositories.length === 0) {
    return { text: "No repositories are connected to Revio yet. Connect one in the Revio dashboard." };
  }

  const lines = repositories.map((r) => {
    const details = [
      r.private ? "private" : "public",
      r.language ?? "unknown language",
      `index: ${r.indexStatus} (last indexed ${formatDay(r.indexedAt)}, ${r.fileCount} files)`,
      r.autoReview ? "auto review on" : "auto review off",
    ];
    return `- ${r.fullName}: ${details.join(", ")}`;
  });
  return { text: `Connected repositories (${repositories.length}):\n${lines.join("\n")}` };
}

// ------------------------------------------------------------------ shared review formatting

const RECOMMENDATION_LABEL: Record<ReviewResult["recommendation"], string> = {
  approve: "Approve (ready to merge)",
  comment: "Comment (non-blocking items to address)",
  request_changes: "Request changes (fix before merging)",
};

function formatIssues(issues: ReviewIssue[]): string {
  if (issues.length === 0) return "Issues: none found.";
  const lines = issues.map((issue, index) => {
    const parts = [
      `${index + 1}. [${issue.severity}] ${issue.file}:${issue.line} (${issue.category}) ${issue.title}`,
      issue.description ? `   ${issue.description}` : "",
      issue.suggestion ? `   Fix: ${issue.suggestion}` : "",
    ];
    return parts.filter(Boolean).join("\n");
  });
  return `Issues (${issues.length}):\n${lines.join("\n")}`;
}

function formatImpact(blast: BlastRadiusData | null): string {
  if (!blast || !blast.riskLevel) return "";
  const callers = blast.indirectCallers?.sample ?? [];
  const callerText = callers.length
    ? ` Callers: ${callers.slice(0, 5).map((c) => `${c.name} (${c.file}${c.line ? `:${c.line}` : ""})`).join(", ")}.`
    : "";
  return (
    `Structural impact: ${blast.riskLevel.toUpperCase()} (${blast.indirectCallers?.total ?? 0} callers, ` +
    `${blast.directlyAffectedFiles?.total ?? 0} dependent files, ` +
    `${blast.affectedEntryPoints?.total ?? 0} entry points).${callerText}`
  );
}

function formatReviewHeader(review: Pick<ReviewResult, "recommendation" | "riskLevel">, confidence: number | null): string {
  const confidenceText = confidence ? ` | Confidence: ${confidence}/5` : "";
  return `Verdict: ${RECOMMENDATION_LABEL[review.recommendation]} | Risk: ${review.riskLevel}${confidenceText}`;
}

// ------------------------------------------------------------------ get_pr_review

export async function getPrReviewTool(
  ctx: McpContext,
  args: { repository: string; pr_number: number }
): Promise<ToolOutput> {
  const resolved = await resolveRepository(ctx.userId, args.repository);
  if ("error" in resolved) return fail(resolved.error);
  const { repository } = resolved;

  const review = await db.prReview.findFirst({
    where: { repositoryId: repository.id, prNumber: args.pr_number },
    select: {
      id: true,
      prTitle: true,
      prUrl: true,
      status: true,
      summary: true,
      issues: true,
      recommendation: true,
      riskLevel: true,
      confidenceScore: true,
      blastRadius: true,
      updatedAt: true,
    },
  });

  if (!review) {
    return fail(
      `Revio has not reviewed PR #${args.pr_number} in ${repository.fullName}. ` +
        `Trigger a review from the Revio dashboard or comment "@revio-bot re-review" on the PR.`
    );
  }
  if (review.status !== "completed") {
    return { text: `The Revio review of PR #${args.pr_number} in ${repository.fullName} is ${review.status}. Try again in a minute.` };
  }

  const issues = Array.isArray(review.issues) ? (review.issues as unknown as ReviewIssue[]) : [];
  const recommendation = (review.recommendation ?? "comment") as ReviewResult["recommendation"];
  const riskLevel = (review.riskLevel ?? "low") as ReviewResult["riskLevel"];
  const dashboardUrl = env.NEXT_PUBLIC_APP_URL ? `${env.NEXT_PUBLIC_APP_URL}/dashboard/reviews/${review.id}` : null;

  const sections = [
    `Revio review of PR #${args.pr_number} "${review.prTitle}" in ${repository.fullName} (reviewed ${formatDay(review.updatedAt)})`,
    formatReviewHeader({ recommendation, riskLevel }, review.confidenceScore),
    review.summary ? `Summary: ${review.summary}` : "",
    formatIssues(issues),
    formatImpact(review.blastRadius as unknown as BlastRadiusData | null),
    [review.prUrl ? `PR: ${review.prUrl}` : "", dashboardUrl ? `Dashboard: ${dashboardUrl}` : ""].filter(Boolean).join(" | "),
  ];
  return { text: sections.filter(Boolean).join("\n\n") };
}

// ------------------------------------------------------------------ get_impact

function normalizePath(path: string): string {
  return path.trim().replace(/^\.\//, "").replace(/^\/+/, "");
}

export async function getImpactTool(
  ctx: McpContext,
  args: { repository: string; files: string[]; functions?: string[] }
): Promise<ToolOutput> {
  const resolved = await resolveRepository(ctx.userId, args.repository);
  if ("error" in resolved) return fail(resolved.error);
  const { repository } = resolved;

  const graph = await getCodeGraph(repository.id);
  if (!graph) {
    return fail(`No code graph exists for ${repository.fullName} yet. Index (or re-index) the repository in Revio first.`);
  }

  const files = Array.from(new Set(args.files.map(normalizePath).filter(Boolean)));
  const knownFiles = new Set(graph.nodes.filter((n) => n.type === "file").map((n) => n.file));
  const unknown = files.filter((f) => !knownFiles.has(f));
  const known = files.filter((f) => knownFiles.has(f));
  if (known.length === 0) {
    return fail(
      `None of these files are in Revio's code graph for ${repository.fullName}: ${unknown.join(", ")}. ` +
        "Use paths relative to the repository root; new files have no callers yet."
    );
  }

  const impact = args.functions?.length
    ? impactForFunctions(graph, known, args.functions)
    : { analysis: analyzeChangeImpact(graph, known), missingFunctions: [] as string[] };

  return { text: formatImpactReport(graph, repository.fullName, known, unknown, impact) };
}

function impactForFunctions(graph: CodeGraphData, files: string[], functions: string[]) {
  const wanted = new Set(functions.map((f) => f.trim()));
  const matches = graph.nodes.filter(
    (n) => (n.type === "function" || n.type === "class") && files.includes(n.file) && wanted.has(n.name)
  );

  // The start line of each named definition selects exactly that definition
  const changedLinesByFile: Record<string, number[]> = {};
  for (const node of matches) {
    if (typeof node.line !== "number") continue;
    changedLinesByFile[node.file] = [...(changedLinesByFile[node.file] ?? []), node.line];
  }

  return {
    analysis: analyzeChangeImpact(graph, files, changedLinesByFile),
    missingFunctions: Array.from(wanted).filter((name) => !matches.some((m) => m.name === name)),
  };
}

function formatImpactReport(
  graph: CodeGraphData,
  repositoryName: string,
  files: string[],
  unknownFiles: string[],
  impact: { analysis: ReturnType<typeof analyzeChangeImpact>; missingFunctions: string[] }
): string {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const describe = (id: string) => {
    const node = nodeById.get(id);
    return node ? `${node.name} (${node.file}${node.line ? `:${node.line}` : ""})` : id;
  };
  const list = (ids: string[]) => ids.slice(0, 15).map((id) => `  - ${describe(id)}`).join("\n") + (ids.length > 15 ? `\n  ... and ${ids.length - 15} more` : "");
  const { analysis } = impact;

  const sections = [
    `Impact of changing ${files.join(", ")} in ${repositoryName}`,
    `Structural impact: ${analysis.riskLevel.toUpperCase()} (${analysis.totalImpactRadius} downstream)`,
    `Changed functions/classes considered (${analysis.directlyAffectedFunctions.length}):\n${list(analysis.directlyAffectedFunctions) || "  - none"}`,
    `Callers in other code (${analysis.indirectlyAffectedFunctions.length}):\n${list(analysis.indirectlyAffectedFunctions) || "  - none"}`,
    `Dependent files (${analysis.directlyAffectedFiles.length}):\n${analysis.directlyAffectedFiles.slice(0, 15).map((f) => `  - ${f}`).join("\n") || "  - none"}`,
    analysis.affectedEntryPoints.length ? `Public entry points affected (${analysis.affectedEntryPoints.length}):\n${list(analysis.affectedEntryPoints)}` : "",
    impact.missingFunctions.length ? `Not found in these files: ${impact.missingFunctions.join(", ")}` : "",
    unknownFiles.length ? `Not in the code graph (new or unsupported files): ${unknownFiles.join(", ")}` : "",
    "Based on the last indexed version of the repository; callers are one hop.",
  ];
  return sections.filter(Boolean).join("\n\n");
}

// ------------------------------------------------------------------ search_codebase

export async function searchCodebaseTool(
  ctx: McpContext,
  args: { query: string; repository?: string; max_results?: number }
): Promise<ToolOutput> {
  let repositories: RepositoryRow[];
  if (args.repository) {
    const resolved = await resolveRepository(ctx.userId, args.repository);
    if ("error" in resolved) return fail(resolved.error);
    repositories = [resolved.repository];
  } else {
    repositories = await loadRepositories(ctx.userId);
  }

  const ready = repositories.filter((r) => isRepositoryChatReady(r));
  if (ready.length === 0) {
    return fail(
      args.repository
        ? `${repositories[0]?.fullName ?? args.repository} is not indexed yet. Index it in Revio first.`
        : "None of your repositories are indexed yet. Index one in Revio first."
    );
  }

  const options = {
    maxChunks: Math.min(args.max_results ?? 8, MCP_CONFIG.maxSearchResults),
    scoreThreshold: AI_CONFIG.chat.retrievalScoreThreshold,
  };
  const ids = ready.map((r) => r.id);
  const context = ids.length === 1 && ids[0]
    ? await retrieveContext(ids[0], args.query, options)
    : await retrieveMultiRepoContext(ids, args.query, options);

  if (context.chunks.length === 0) {
    return { text: `No code matched "${args.query}" in ${ready.map((r) => r.fullName).join(", ")}.` };
  }

  const results = context.chunks.map((chunk) => {
    const lines = chunk.content.split("\n");
    const shown = lines.slice(0, 60).join("\n") + (lines.length > 60 ? "\n// ... truncated" : "");
    const label = chunk.name ? `${chunk.type} ${chunk.name}` : chunk.type;
    return `### ${chunk.filePath}:${chunk.startLine}-${chunk.endLine} (${label}, score ${chunk.score.toFixed(2)})\n\`\`\`${chunk.language}\n${shown}\n\`\`\``;
  });
  return {
    text: `${context.chunks.length} results for "${args.query}" in ${ready.map((r) => r.fullName).join(", ")}:\n\n${results.join("\n\n")}`,
  };
}

// ------------------------------------------------------------------ review_changes

export interface ReviewChangesArgs {
  repository: string;
  diff: string;
  title?: string;
  description?: string;
  files?: Array<{ path: string; content: string }>;
}

export async function reviewChangesTool(
  ctx: McpContext,
  args: ReviewChangesArgs,
  run: typeof runReviewCore = runReviewCore
): Promise<ToolOutput> {
  const resolved = await resolveRepository(ctx.userId, args.repository);
  if ("error" in resolved) return fail(resolved.error);
  const { repository } = resolved;

  if (parseUnifiedDiff(args.diff).length === 0) {
    return fail(
      "The diff contains no file changes. Send unified diff output from git, for example `git diff` for " +
        "uncommitted work or `git diff main...HEAD` for a branch."
    );
  }

  const monthly = await checkPrReviewLimit(ctx.userId);
  if (monthly.exceeded) {
    return fail(
      `Monthly review limit reached (${monthly.current}/${monthly.limit} on the ${monthly.plan.toUpperCase()} plan). ` +
        "Upgrade in Revio → Billing for more reviews."
    );
  }
  const hourly = await checkMcpReviewRateLimit(ctx.userId);
  if (hourly.exceeded) {
    return fail(`Hourly review limit reached (${hourly.limit} per hour on the ${hourly.plan.toUpperCase()} plan). Try again later.`);
  }

  const headFiles = new Map((args.files ?? []).map((f) => [normalizePath(f.path), f.content]));
  const core = await run(
    {
      title: args.title?.trim() || "Local changes",
      body: args.description?.trim() || null,
      diff: args.diff,
      ignoredPaths: repository.ignoredPaths ?? [],
      settings: parseReviewSettings(repository.reviewRules),
    },
    createReviewProviders({
      repositoryId: repository.id,
      indexStatus: repository.indexStatus,
      loadHeadFile: headFiles.size > 0 ? async (path) => headFiles.get(path) ?? null : null,
    }),
    { repositoryId: repository.id, organizationId: repository.organizationId }
  );

  if (!core) {
    return fail("The review could not be completed because the model's answer was unreadable. Please try again.");
  }

  // Only reviews that reached the model count toward limits
  if (core.modelReview) {
    await db.usage.create({
      data: {
        userId: ctx.userId,
        repositoryId: repository.id,
        actionType: MCP_CONFIG.reviewUsageAction,
        metadata: {
          apiKeyId: ctx.keyId,
          files: core.filteredFiles.length,
          issues: core.review.issues.length,
          recommendation: core.review.recommendation,
          tokensUsed: core.tokensUsed,
        },
      },
    });
  }

  return { text: formatChangesReview(repository.fullName, core) };
}

function formatChangesReview(repositoryName: string, core: ReviewCoreResult): string {
  const missingTests = core.testCoverage?.missingTests ?? [];
  const sections = [
    `Revio review of local changes in ${repositoryName} (${core.filteredFiles.length} files, ${core.linesChanged} changed lines)`,
    formatReviewHeader(core.review, core.confidence.score),
    `Summary: ${core.review.summary}`,
    formatIssues(core.review.issues),
    formatImpact(core.blastRadius),
    missingTests.length ? `Possible test gaps: ${missingTests.slice(0, 8).map((m) => m.file).join(", ")}` : "",
    "Not posted to GitHub. Line numbers refer to the new version of each file.",
  ];
  return sections.filter(Boolean).join("\n\n");
}
