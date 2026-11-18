/**
 * Production data sources for the review core, shared by the PR reviewer (reviewer.ts) and the
 * MCP review tool, so a review from Claude Code sees the same context as a review on GitHub.
 */
import { REVIEW_CONFIG } from "@/lib/constants";
import { formatContextForPrompt, retrieveMultiContext } from "./retriever";
import { StandardsDetector } from "./standards-detector";
import { getEffectiveLearningContext } from "./learning";
import { getCodeGraph } from "./code-graph";
import { baseGraphScope, buildPrGraphScope, type PrGraphScope } from "./pr-graph";
import type { DiffFile } from "./diff-parser";
import type { ReviewCoreProviders } from "./review-core";

/**
 * Semantic code context for the changed files (vector search). Needs an indexed repository.
 */
export async function loadSemanticReviewContext(
  repositoryId: string,
  indexStatus: string,
  files: DiffFile[]
): Promise<string | null> {
  if (indexStatus !== "indexed") return null;

  const contextQueries = files.slice(0, 10).map((file) => {
    return `File changes in ${file.path}: ${file.additions.slice(0, 500)}`;
  });
  console.warn(`[ReviewContext] Retrieving semantic context for ${contextQueries.length} queries`);
  const context = await retrieveMultiContext(repositoryId, contextQueries, {
    maxChunksPerQuery: 3,
    maxTotalChunks: REVIEW_CONFIG.maxContextChunks,
    maxTokens: REVIEW_CONFIG.maxContextTokens,
  });
  console.warn(`[ReviewContext] Retrieved ${context.chunks.length} context chunks`);
  return formatContextForPrompt(context.chunks);
}

export async function loadStandardsReviewContext(repositoryId: string): Promise<string> {
  return StandardsDetector.formatStandardsForPrompt(
    await StandardsDetector.getRepositoryStandards(repositoryId)
  );
}

/**
 * Indexed base-branch graph with the changed files re-parsed from their new content when
 * available (falls back to the base graph per file).
 */
export async function loadReviewGraphScope(
  repositoryId: string,
  files: DiffFile[],
  loadHeadFile: ((path: string) => Promise<string | null>) | null
): Promise<PrGraphScope | null> {
  const baseGraph = await getCodeGraph(repositoryId);
  if (!baseGraph) return null;

  const scope = loadHeadFile
    ? await buildPrGraphScope({ baseGraph, files, loadHeadFile })
    : baseGraphScope(baseGraph, files);
  console.warn(
    `[ReviewContext] Graph scope ready: ${scope.headParsedFiles}/${files.length} changed files parsed at head, ` +
      `${scope.extraChangedNodeIds.length} removed definitions`
  );
  return scope;
}

/**
 * All production providers for a repository
 */
export function createReviewProviders(params: {
  repositoryId: string;
  indexStatus: string;
  loadHeadFile: ((path: string) => Promise<string | null>) | null;
}): ReviewCoreProviders {
  const { repositoryId, indexStatus, loadHeadFile } = params;
  return {
    loadLearning: () => getEffectiveLearningContext(repositoryId),
    loadSemanticContext: (files) => loadSemanticReviewContext(repositoryId, indexStatus, files),
    loadStandardsContext: () => loadStandardsReviewContext(repositoryId),
    loadGraphScope: (files) => loadReviewGraphScope(repositoryId, files, loadHeadFile),
  };
}
