/**
 * Review core: turns a PR diff into a final review, independent of the database and GitHub.
 *
 * Used by the PR reviewer (reviewer.ts) and by the offline evaluation (scripts/eval), so the
 * evaluation measures exactly the pipeline that runs in production. Data sources are passed in
 * as providers; leaving one out disables it (the evaluation's "diff only" mode passes none).
 */
import { estimateTokenCount, generateReviewResponse, type ReviewGenerationResult } from "./gemini";
import {
  buildReviewPrompt,
  buildReviewSystemPrompt,
  parseReviewResponse,
  type ReviewResult,
} from "@/lib/prompts/review";
import type { BlastRadiusData } from "@/types/blast-radius";
import type { TestCoverageData } from "@/types/test-coverage";
import type { ReviewSettings } from "@/types/review";
import { AI_CONFIG, REVIEW_CONFIG } from "@/lib/constants";
import { calculateSecurityScore, getSeverityCounts, scanCode, type SecurityIssue } from "./security-scanner";
import { getLanguageFromPath } from "./chunker";
import { CODING_STANDARD_RULE_ID } from "./standards-detector";
import { calculateConfidenceScore, type ConfidenceResult } from "./confidence-scorer";
import { formatGraphContextForPrompt } from "./code-graph";
import { generateSequenceDiagram } from "./sequence-diagram";
import { generateBlastRadius } from "./blast-radius";
import { analyzeTestCoverage } from "./test-coverage";
import {
  applyLearningNitpickFiltering,
  buildLearningPromptSection,
  type EffectiveLearningContext,
} from "./learning";
import { buildPromptDiff, matchesIgnoredPath, parseUnifiedDiff, type DiffFile } from "./diff-parser";
import { decideReviewVerdict } from "./review-verdict";
import type { PrGraphScope } from "./pr-graph";

export interface ReviewCoreInput {
  title: string;
  body: string | null;
  diff: string;
  ignoredPaths: string[];
  settings: ReviewSettings;
}

export interface ReviewCoreProviders {
  /** Learned team preferences (suppressions, feedback) */
  loadLearning?: () => Promise<EffectiveLearningContext | null>;
  /** Semantic code context for the reviewed files (vector search), already formatted */
  loadSemanticContext?: (files: DiffFile[]) => Promise<string | null>;
  /** Coding standards prompt section */
  loadStandardsContext?: () => Promise<string>;
  /** PR-aware code graph for structural facts */
  loadGraphScope?: (files: DiffFile[]) => Promise<PrGraphScope | null>;
}

export interface ReviewCoreOptions {
  /** Run the pattern-based security scanner and give its findings to the model (default true) */
  securityScan?: boolean;
  /** Model call; defaults to Gemini */
  generate?: (
    systemPrompt: string,
    userPrompt: string,
    options: { isComplex?: boolean }
  ) => Promise<ReviewGenerationResult>;
  /** Used only to build an empty learning context when none is loaded */
  repositoryId?: string;
  organizationId?: string | null;
}

export interface ReviewCoreResult {
  changedFiles: DiffFile[];
  filteredFiles: DiffFile[];
  /** The model's parsed answer before filtering and the final verdict (null when the AI was skipped) */
  modelReview: ReviewResult | null;
  /** Final review: suppressions applied, risk and recommendation decided */
  review: ReviewResult;
  securityIssues: SecurityIssue[];
  confirmedSecurityIssues: SecurityIssue[];
  graphScope: PrGraphScope | null;
  sequenceDiagram: string | null;
  blastRadius: BlastRadiusData | null;
  testCoverage: TestCoverageData | null;
  confidence: ConfidenceResult;
  linesChanged: number;
  tokensUsed: number;
}

/**
 * Run the review pipeline on a diff. Returns null when the model answer cannot be parsed.
 */
export async function runReviewCore(
  input: ReviewCoreInput,
  providers: ReviewCoreProviders = {},
  options: ReviewCoreOptions = {}
): Promise<ReviewCoreResult | null> {
  const { securityScan = true, generate = generateReviewResponse } = options;

  if (input.diff.length > REVIEW_CONFIG.maxDiffBytes) {
    console.warn(`[ReviewCore] Diff too large: ${input.diff.length} bytes (limit: ${REVIEW_CONFIG.maxDiffBytes}), sending whole files up to the limit`);
  }

  // Parse the diff once; every later step uses these files and line numbers
  const changedFiles = parseUnifiedDiff(input.diff);
  if (changedFiles.length > REVIEW_CONFIG.maxFiles) {
    console.warn(`[ReviewCore] Too many files: ${changedFiles.length} (limit: ${REVIEW_CONFIG.maxFiles})`);
  }

  // Ignored paths apply to every step of the review
  const filteredFiles = changedFiles.filter((file) => !matchesIgnoredPath(file.path, input.ignoredPaths));
  const promptDiff = buildPromptDiff(filteredFiles, REVIEW_CONFIG.maxDiffBytes);

  const learningContext = await optional("learning context", () => providers.loadLearning?.());

  // Security scan on added lines, reporting real line numbers in the new file
  const securityIssues: SecurityIssue[] = [];
  if (securityScan) {
    for (const file of filteredFiles) {
      const language = getLanguageFromPath(file.path);
      if (!language || file.addedLines.length === 0) continue;
      for (const issue of scanCode(file.path, file.additions, language)) {
        securityIssues.push({ ...issue, line: file.addedLines[issue.line - 1]?.line ?? issue.line });
      }
    }
  }

  const graphScope =
    filteredFiles.length > 0
      ? await optional("code graph", () => providers.loadGraphScope?.(filteredFiles))
      : null;

  let review: ReviewResult;
  let modelReview: ReviewResult | null = null;
  let tokensUsed = 0;

  if (filteredFiles.length === 0) {
    review = {
      summary:
        changedFiles.length === 0
          ? "This PR has no file changes to review."
          : "All changed files match this repository's ignored paths, so no code was reviewed.",
      riskLevel: "low",
      issues: [],
      positives: [],
      recommendation: "comment",
    };
  } else {
    const codebaseContext =
      (await optional("semantic context", () => providers.loadSemanticContext?.(filteredFiles))) ||
      "No additional context available.";

    const securityContext =
      securityIssues.length > 0
        ? formatSecurityContext(securityIssues, getSeverityCounts(securityIssues), calculateSecurityScore(securityIssues))
        : "";

    const standardsContext = (await optional("coding standards", () => providers.loadStandardsContext?.())) ?? "";

    let graphContext = "";
    if (graphScope) {
      try {
        graphContext = formatGraphContextForPrompt(
          graphScope.graph,
          graphScope.changedFiles,
          graphScope.changedLinesByFile,
          graphScope.extraChangedNodeIds,
          graphScope.filesWithRemovals
        );
      } catch (graphError) {
        console.warn("[ReviewCore] Failed to build graph context:", graphError);
      }
    }

    const fullContext = [codebaseContext, securityContext, standardsContext, graphContext]
      .filter(Boolean)
      .join("\n\n");

    const reviewPrompt = buildReviewPrompt(input.title, input.body, promptDiff.text, fullContext);
    const learningPrompt = learningContext ? buildLearningPromptSection(learningContext) : "";
    const systemPrompt = buildReviewSystemPrompt(input.settings, learningPrompt);

    const isComplex =
      filteredFiles.length > AI_CONFIG.review.complexThresholds.changedFiles ||
      promptDiff.text.length > AI_CONFIG.review.complexThresholds.diffLength;

    const generationResult = await generate(systemPrompt, reviewPrompt, { isComplex });
    const parsed = parseReviewResponse(generationResult.text);
    if (!parsed) {
      console.error("[ReviewCore] Failed to parse review response");
      return null;
    }

    review = parsed;
    modelReview = parsed;
    tokensUsed =
      generationResult.usageMetadata?.totalTokenCount ??
      estimateTokenCount(`${systemPrompt}\n\n${reviewPrompt}\n\n${generationResult.text}`);
  }

  // Severity threshold and learned suppressions always apply (empty learning when unavailable)
  const filteredReview = applyLearningNitpickFiltering(
    review,
    learningContext ?? createEmptyLearningContext(options.repositoryId ?? "", options.organizationId ?? null),
    input.settings
  );

  // Graph-derived views share the same changed lines as the prompt context
  const sequenceDiagram = graphScope
    ? generateSequenceDiagram({
        changedFiles: graphScope.changedFiles,
        graphData: graphScope.graph,
        changedLinesByFile: graphScope.changedLinesByFile,
        extraChangedNodeIds: graphScope.extraChangedNodeIds,
      })
    : null;

  let blastRadius: BlastRadiusData | null = null;
  try {
    blastRadius = graphScope
      ? generateBlastRadius({
          changedFiles: graphScope.changedFiles,
          graphData: graphScope.graph,
          changedLinesByFile: graphScope.changedLinesByFile,
          extraChangedNodeIds: graphScope.extraChangedNodeIds,
          filesWithRemovals: graphScope.filesWithRemovals,
        })
      : null;
  } catch (blastError) {
    console.warn("[ReviewCore] Blast radius generation failed:", blastError);
  }

  let testCoverage: TestCoverageData | null = null;
  try {
    testCoverage = analyzeTestCoverage({
      changedFiles: filteredFiles.map((f) => f.path),
      graphData: graphScope?.graph ?? null,
    });
  } catch (coverageError) {
    console.warn("[ReviewCore] Test coverage analysis failed:", coverageError);
  }

  // One final verdict: risk and recommendation used everywhere downstream
  const verdict = decideReviewVerdict({
    review: filteredReview,
    graphImpact: blastRadius?.riskLevel ?? null,
    settings: input.settings,
  });
  const finalReview: ReviewResult = { ...filteredReview, ...verdict };
  console.warn(
    `[ReviewCore] Verdict: ${finalReview.recommendation}, risk ${finalReview.riskLevel} ` +
      `(model: ${review.recommendation}/${review.riskLevel}, graph impact: ${blastRadius?.riskLevel ?? "n/a"})`
  );

  const linesChanged = filteredFiles.reduce((sum, f) => sum + f.addedCount + f.deletedCount, 0);

  // Standards violations: the model tags them with CODING_STANDARD_RULE_ID (text match as fallback)
  const standardsViolations = finalReview.issues.filter((issue) =>
    issue.ruleId === CODING_STANDARD_RULE_ID ||
    issue.description?.toLowerCase().includes("coding standard") ||
    issue.description?.toLowerCase().includes("standard violation")
  ).length;

  // Scanner findings the model rejected as false positives must not lower confidence:
  // only count those matching a security issue the model kept (same file, nearby line)
  const confirmedSecurityIssues = securityIssues.filter((finding) =>
    finalReview.issues.some(
      (issue) =>
        issue.category === "security" &&
        issue.file === finding.file &&
        Math.abs(issue.line - finding.line) <= 3
    )
  );

  const confidence = calculateConfidenceScore(
    finalReview,
    confirmedSecurityIssues,
    filteredFiles.length,
    linesChanged,
    standardsViolations
  );

  return {
    changedFiles,
    filteredFiles,
    modelReview,
    review: finalReview,
    securityIssues,
    confirmedSecurityIssues,
    graphScope,
    sequenceDiagram,
    blastRadius,
    testCoverage,
    confidence,
    linesChanged,
    tokensUsed,
  };
}

/**
 * Run an optional data source; a failure only disables that source for this review
 */
async function optional<T>(label: string, load: () => Promise<T> | undefined): Promise<T | null> {
  try {
    return (await load()) ?? null;
  } catch (error) {
    console.warn(`[ReviewCore] Failed to load ${label}:`, error);
    return null;
  }
}

export function createEmptyLearningContext(
  repositoryId: string,
  organizationId: string | null
): EffectiveLearningContext {
  return {
    repositoryId,
    organizationId,
    suppressedCategories: [],
    suppressedIssueTypes: [],
    suppressedText: [],
    suppressedPatterns: [],
    suggestedRules: [],
    feedbackStats: {},
    adoptionRates: {},
  };
}

/**
 * Format security issues for inclusion in the review prompt
 */
function formatSecurityContext(
  issues: SecurityIssue[],
  severityCounts: Record<SecurityIssue["severity"], number>,
  score: number
): string {
  const lines: string[] = [
    "## Automated Security Scan Results",
    `Security Score: ${score}/100`,
    "",
    "### Issue Summary",
    `- Critical: ${severityCounts.critical}`,
    `- High: ${severityCounts.high}`,
    `- Medium: ${severityCounts.medium}`,
    `- Low: ${severityCounts.low}`,
    "",
    "### Detected Issues",
  ];

  const criticalHighIssues = issues.filter(
    (i) => i.severity === "critical" || i.severity === "high"
  );

  for (const issue of criticalHighIssues.slice(0, 10)) {
    lines.push(`
**[${issue.severity.toUpperCase()}] ${issue.title}**
- File: \`${issue.file}\` (line ${issue.line})
- Description: ${issue.description}
- CWE: ${issue.cwe || "N/A"}
- OWASP: ${issue.owasp || "N/A"}
- Code: \`${issue.code.slice(0, 100)}\`
- Suggestion: ${issue.suggestion || "Review and fix manually"}
`);
  }

  if (issues.length > 10) {
    lines.push(`\n*... and ${issues.length - 10} more issues*`);
  }

  lines.push(`
IMPORTANT: The automated security scan has detected potential vulnerabilities.
Please include these findings in your review with appropriate severity ratings.
Critical and high severity issues should typically block approval.
`);

  return lines.join("\n");
}
