import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { GitHubService } from "./github";
import { createBotGitHubService } from "./github-app";
import { retrieveMultiContext, formatContextForPrompt } from "./retriever";
import { estimateTokenCount, generateReviewResponse } from "./gemini";
import {
  buildReviewSystemPrompt,
  buildReviewPrompt,
  parseReviewResponse,
  formatReviewForGitHub,
  createInlineComments,
  type ReviewResult,
  type DocstringSuggestion,
} from "@/lib/prompts/review";
import type { BlastRadiusData } from "@/types/blast-radius";
import type { TestCoverageData } from "@/types/test-coverage";
import { REVIEW_CONFIG, AI_CONFIG } from "@/lib/constants";
import { parseReviewSettings } from "@/types/review";
import { logActivity } from "./activity";
import {
  scanCode,
  calculateSecurityScore,
  getSeverityCounts,
  type SecurityIssue,
} from "./security-scanner";
import { getLanguageFromPath } from "./chunker";
import { StandardsDetector } from "./standards-detector";
import { calculateConfidenceScore } from "./confidence-scorer";
import { getCodeGraph, formatGraphContextForPrompt } from "./code-graph";
import { generateSequenceDiagram } from "./sequence-diagram";
import { generateDocstringSuggestions } from "./docstrings";
import { generateBlastRadius } from "./blast-radius";
import { analyzeTestCoverage } from "./test-coverage";
import {
  applyLearningNitpickFiltering,
  buildLearningPromptSection,
  getEffectiveLearningContext,
  updateAdoptionRatesFromRuns,
  type EffectiveLearningContext,
} from "./learning";
import {
  buildPromptDiff,
  matchesIgnoredPath,
  parseUnifiedDiff,
} from "./diff-parser";
import { decideReviewVerdict } from "./review-verdict";
import { baseGraphScope, buildPrGraphScope, type PrGraphScope } from "./pr-graph";

/**
 * PR data for review
 */
export interface PullRequestData {
  number: number;
  title: string;
  body: string | null;
  author: string;
  url: string;
  baseBranch: string;
  headBranch: string;
  headSha?: string;
}

/**
 * Review a pull request
 */
export async function reviewPullRequest(
  repositoryId: string,
  prData: PullRequestData,
  accessToken: string
): Promise<ReviewResult | null> {
  const startTime = Date.now();

  // Get repository info
  const repository = await db.repository.findUnique({
    where: { id: repositoryId },
  });

  if (!repository) {
    throw new Error("Repository not found");
  }

  const parts = repository.fullName.split("/");
  const owner = parts[0];
  const repo = parts[1];

  if (!owner || !repo) {
    throw new Error("Invalid repository name");
  }

  const github = new GitHubService(accessToken);

  // Resolve PR head SHA (for run tracking and adoption metrics)
  let headSha: string | null = prData.headSha || null;
  if (!headSha) {
    try {
      const pr = await github.getPullRequest(owner, repo, prData.number);
      headSha = pr.head.sha;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn("[Reviewer] Failed to fetch head SHA for PR", {
        repositoryId,
        repository: `${owner}/${repo}`,
        prNumber: prData.number,
        error: errorMessage,
      });
    }
  }

  // Get PR diff
  console.warn(`[Reviewer] Fetching diff for PR #${prData.number}`);
  const diff = await github.getPrDiff(owner, repo, prData.number);
  console.warn(`[Reviewer] Diff fetched: ${diff.length} bytes`);

  if (diff.length > REVIEW_CONFIG.maxDiffBytes) {
    console.warn(`[Reviewer] PR ${prData.number} diff too large: ${diff.length} bytes (limit: ${REVIEW_CONFIG.maxDiffBytes}), sending whole files up to the limit`);
  }

  // Parse the diff once; every later step uses these files and line numbers
  const changedFiles = parseUnifiedDiff(diff);
  console.warn(`[Reviewer] Parsed ${changedFiles.length} files from diff`);

  if (changedFiles.length > REVIEW_CONFIG.maxFiles) {
    console.warn(`[Reviewer] PR ${prData.number} has too many files: ${changedFiles.length} (limit: ${REVIEW_CONFIG.maxFiles})`);
  }

  // Ignored paths apply to every step of the review
  const ignoredPaths = repository.ignoredPaths || [];
  const filteredFiles = changedFiles.filter((file) => !matchesIgnoredPath(file.path, ignoredPaths));
  const filteredPaths = filteredFiles.map((f) => f.path);

  const promptDiff = buildPromptDiff(filteredFiles, REVIEW_CONFIG.maxDiffBytes);

  // Parse review settings from repository
  const reviewSettings = parseReviewSettings(repository.reviewRules);

  // Load learned team preferences (repo + org)
  let learningContext: Awaited<ReturnType<typeof getEffectiveLearningContext>> | null = null;
  try {
    learningContext = await getEffectiveLearningContext(repositoryId);
  } catch (learningError) {
    console.warn("[Reviewer] Failed to load learning context:", learningError);
  }

  // Run security scanning on added lines, reporting real line numbers in the new file
  const securityIssues: SecurityIssue[] = [];
  for (const file of filteredFiles) {
    const language = getLanguageFromPath(file.path);
    if (!language || file.addedLines.length === 0) continue;
    const issues = scanCode(file.path, file.additions, language);
    for (const issue of issues) {
      securityIssues.push({ ...issue, line: file.addedLines[issue.line - 1]?.line ?? issue.line });
    }
  }

  // Code graph for structural facts (callers, dependents, entry points): the indexed
  // base-branch graph with the changed files re-parsed at the PR head
  let graphScope: PrGraphScope | null = null;
  try {
    const baseGraph = await getCodeGraph(repositoryId);
    if (baseGraph && filteredFiles.length > 0) {
      graphScope = headSha
        ? await buildPrGraphScope({
            baseGraph,
            files: filteredFiles,
            loadHeadFile: (path) =>
              github.getFileContent(owner, repo, path, headSha).catch(() => null),
          })
        : baseGraphScope(baseGraph, filteredFiles);
      console.warn(
        `[Reviewer] Graph scope ready: ${graphScope.headParsedFiles}/${filteredFiles.length} changed files parsed at PR head, ` +
          `${graphScope.extraChangedNodeIds.length} removed definitions`
      );
    }
  } catch (graphError) {
    console.warn(`[Reviewer] Failed to prepare code graph:`, graphError);
  }
  const codeGraphData = graphScope?.graph ?? null;

  let review: ReviewResult;
  let tokensUsed = 0;
  let systemPrompt = "";

  if (filteredFiles.length === 0) {
    console.warn(`[Reviewer] All ${changedFiles.length} changed files match ignored paths, skipping AI review`);
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
    // Retrieve codebase context for the reviewed files
    const contextQueries = filteredFiles.slice(0, 10).map((file) => {
      return `File changes in ${file.path}: ${file.additions.slice(0, 500)}`;
    });

    let codebaseContext = "No additional context available.";
    if (repository.indexStatus === "indexed" && contextQueries.length > 0) {
      console.warn(`[Reviewer] Retrieving semantic context for ${contextQueries.length} queries`);
      const context = await retrieveMultiContext(repositoryId, contextQueries, {
        maxChunksPerQuery: 3,
        maxTotalChunks: REVIEW_CONFIG.maxContextChunks,
        maxTokens: REVIEW_CONFIG.maxContextTokens,
      });
      codebaseContext = formatContextForPrompt(context.chunks);
      console.warn(`[Reviewer] Retrieved ${context.chunks.length} context chunks`);
    }

    let securityContext = "";
    if (securityIssues.length > 0) {
      const severityCounts = getSeverityCounts(securityIssues);
      const securityScore = calculateSecurityScore(securityIssues);
      securityContext = formatSecurityContext(securityIssues, severityCounts, securityScore);
    }

    // Get coding standards for this repository
    const codingStandards = await StandardsDetector.getRepositoryStandards(repositoryId);
    const standardsContext = StandardsDetector.formatStandardsForPrompt(codingStandards);

    let graphContext = "";
    if (graphScope) {
      try {
        graphContext = formatGraphContextForPrompt(
          graphScope.graph,
          graphScope.changedFiles,
          graphScope.changedLinesByFile,
          graphScope.extraChangedNodeIds
        );
        console.warn(`[Reviewer] Added graph context with impact analysis`);
      } catch (graphError) {
        console.warn(`[Reviewer] Failed to build graph context:`, graphError);
      }
    }

    const fullContext = [codebaseContext, securityContext, standardsContext, graphContext]
      .filter(Boolean)
      .join("\n\n");

    const reviewPrompt = buildReviewPrompt(prData.title, prData.body, promptDiff.text, fullContext);

    // Build system prompt with custom rules + learned preferences
    const learningPrompt = learningContext ? buildLearningPromptSection(learningContext) : "";
    systemPrompt = buildReviewSystemPrompt(reviewSettings, learningPrompt);

    const isComplex =
      filteredFiles.length > AI_CONFIG.review.complexThresholds.changedFiles ||
      promptDiff.text.length > AI_CONFIG.review.complexThresholds.diffLength;

    console.warn(`[Reviewer] Starting AI generation using ${isComplex ? 'complex' : 'standard'} model`);
    const generationResult = await generateReviewResponse(systemPrompt, reviewPrompt, { isComplex });
    const rawResponse = generationResult.text;
    console.warn(`[Reviewer] AI generation completed, parsing response`);

    const parsed = parseReviewResponse(rawResponse);
    if (!parsed) {
      console.error("Failed to parse review response");
      return null;
    }

    review = parsed;
    tokensUsed =
      generationResult.usageMetadata?.totalTokenCount ??
      estimateTokenCount(`${systemPrompt}\n\n${reviewPrompt}\n\n${rawResponse}`);
  }

  // Severity threshold and learned suppressions always apply (empty learning when unavailable)
  const filteredReview = applyLearningNitpickFiltering(
    review,
    learningContext ?? createEmptyLearningContext(repositoryId, repository.organizationId),
    reviewSettings
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
        })
      : null;
  } catch (blastError) {
    const errorMessage = blastError instanceof Error ? blastError.message : String(blastError);
    logger.warn("[Reviewer] Blast radius generation failed", {
      repositoryId,
      repository: `${owner}/${repo}`,
      prNumber: prData.number,
      error: errorMessage,
    });
  }

  let testCoverage: TestCoverageData | null = null;
  try {
    testCoverage = analyzeTestCoverage({
      changedFiles: filteredPaths,
      graphData: codeGraphData,
    });
  } catch (coverageError) {
    const errorMessage = coverageError instanceof Error ? coverageError.message : String(coverageError);
    logger.warn("[Reviewer] Test coverage analysis failed", {
      repositoryId,
      repository: `${owner}/${repo}`,
      prNumber: prData.number,
      error: errorMessage,
    });
  }

  // One final verdict: risk and recommendation used everywhere below
  const verdict = decideReviewVerdict({
    review: filteredReview,
    graphImpact: blastRadius?.riskLevel ?? null,
    settings: reviewSettings,
  });
  const finalReview: ReviewResult = { ...filteredReview, ...verdict };
  console.warn(
    `[Reviewer] Verdict: ${finalReview.recommendation}, risk ${finalReview.riskLevel} ` +
      `(model: ${review.recommendation}/${review.riskLevel}, graph impact: ${blastRadius?.riskLevel ?? "n/a"})`
  );

  // Generate docstring suggestions (best-effort, limited)
  let docstringSuggestions: DocstringSuggestion[] = [];
  if (filteredFiles.length > 0) {
    try {
      const res = await generateDocstringSuggestions({
        owner,
        repo,
        accessToken,
        headSha,
        diff: filteredFiles.map((f) => f.raw).join("\n"),
        maxSuggestions: 3,
      });
      docstringSuggestions = res.suggestions;
    } catch (docError) {
      console.warn("[Reviewer] Docstring generation failed:", docError);
    }
  }

  const processingTime = Date.now() - startTime;

  // Calculate confidence score for merge readiness
  const linesChanged = filteredFiles.reduce((sum, f) => sum + f.addedCount + f.deletedCount, 0);

  // Count standards violations from review issues
  const standardsViolations = (finalReview.issues || []).filter((issue) =>
    issue.description?.toLowerCase().includes("coding standard") ||
    issue.description?.toLowerCase().includes("standard violation")
  ).length;

  const confidenceResult = calculateConfidenceScore(
    finalReview,
    securityIssues,
    filteredFiles.length,
    linesChanged,
    standardsViolations
  );

  console.warn(`[Reviewer] Confidence score: ${confidenceResult.score}/5 (${confidenceResult.level})`);
  console.warn(`[Reviewer] Reasoning: ${confidenceResult.reasoning.join(", ")}`);

  // Transform positives (strings) to suggestions format (objects with title/description)
  const formattedSuggestions = (finalReview.positives || []).map((positive: string, idx: number) => ({
    title: `Positive #${idx + 1}`,
    description: positive,
  }));

  const formattedFiles = filteredFiles.map((f) => ({
    path: f.path,
    additions: f.addedCount,
    deletions: f.deletedCount,
  }));

  // Save review to database
  const blastRadiusJson = JSON.parse(JSON.stringify(blastRadius || {}));
  const testCoverageJson = JSON.parse(JSON.stringify(testCoverage || {}));
  const savedReview = await db.prReview.upsert({
    where: {
      repositoryId_prNumber: {
        repositoryId,
        prNumber: prData.number,
      },
    },
    update: {
      prTitle: prData.title,
      prUrl: prData.url,
      prAuthor: prData.author,
      summary: finalReview.summary,
      issues: JSON.parse(JSON.stringify(finalReview.issues)),
      suggestions: JSON.parse(JSON.stringify(formattedSuggestions)),
      filesAnalyzed: JSON.parse(JSON.stringify(formattedFiles)),
      recommendation: finalReview.recommendation,
      riskLevel: finalReview.riskLevel,
      confidenceScore: confidenceResult.score,
      sequenceDiagram,
      docstringSuggestions: JSON.parse(JSON.stringify(docstringSuggestions)),
      blastRadius: blastRadiusJson,
      testCoverage: testCoverageJson,
      headSha,
      runCount: { increment: 1 },
      status: "completed",
      queuedAt: null,
      startedAt: null,
      jobId: null,
      processingTimeMs: processingTime,
      tokensUsed,
    },
    create: {
      repositoryId,
      prNumber: prData.number,
      prTitle: prData.title,
      prUrl: prData.url,
      prAuthor: prData.author,
      summary: finalReview.summary,
      issues: JSON.parse(JSON.stringify(finalReview.issues)),
      suggestions: JSON.parse(JSON.stringify(formattedSuggestions)),
      filesAnalyzed: JSON.parse(JSON.stringify(formattedFiles)),
      recommendation: finalReview.recommendation,
      riskLevel: finalReview.riskLevel,
      confidenceScore: confidenceResult.score,
      sequenceDiagram,
      docstringSuggestions: JSON.parse(JSON.stringify(docstringSuggestions)),
      blastRadius: blastRadiusJson,
      testCoverage: testCoverageJson,
      headSha,
      runCount: 1,
      status: "completed",
      queuedAt: null,
      startedAt: null,
      jobId: null,
      processingTimeMs: processingTime,
      tokensUsed,
    },
  });

  // Persist a run record for adoption tracking (runNumber aligns with pr_reviews.run_count)
  try {
    await db.prReviewRun.create({
      data: {
        prReviewId: savedReview.id,
        runNumber: savedReview.runCount,
        headSha,
        summary: finalReview.summary,
        issues: JSON.parse(JSON.stringify(finalReview.issues)),
        suggestions: JSON.parse(JSON.stringify(formattedSuggestions)),
        filesAnalyzed: JSON.parse(JSON.stringify(formattedFiles)),
        recommendation: finalReview.recommendation,
        riskLevel: finalReview.riskLevel,
        confidenceScore: confidenceResult.score,
        sequenceDiagram,
        processingTimeMs: processingTime,
        tokensUsed,
        docstringSuggestions: JSON.parse(JSON.stringify(docstringSuggestions)),
        blastRadius: blastRadiusJson,
        testCoverage: testCoverageJson,
      },
    });

    await updateAdoptionRatesFromRuns({ prReviewId: savedReview.id });
  } catch (runError) {
    console.warn("[Reviewer] Failed to record review run history:", runError);
  }

  // Log activity if repository is in an organization
  if (repository.organizationId && savedReview.requestedById) {
    await logActivity({
      organizationId: repository.organizationId,
      userId: savedReview.requestedById,
      type: "pr_reviewed",
      title: `Completed review for PR #${prData.number}`,
      description: `${finalReview.issues.length} issues found in "${prData.title}"`,
      repositoryId,
      metadata: {
        prNumber: prData.number,
        issueCount: finalReview.issues.length,
        recommendation: finalReview.recommendation,
      },
    });
  }

  return finalReview;
}

/**
 * Post review to GitHub
 */
export async function postReviewToGitHub(
  repositoryId: string,
  prNumber: number,
  review: ReviewResult,
  accessToken: string
): Promise<number | null> {
  const repository = await db.repository.findUnique({
    where: { id: repositoryId },
  });

  if (!repository) {
    throw new Error("Repository not found");
  }

  const parts = repository.fullName.split("/");
  const owner = parts[0];
  const repo = parts[1];

  if (!owner || !repo) {
    throw new Error("Invalid repository name");
  }

  // Get the confidence score from the database
  const prReview = await db.prReview.findFirst({
    where: { repositoryId, prNumber },
    select: { confidenceScore: true, sequenceDiagram: true, docstringSuggestions: true, blastRadius: true, testCoverage: true },
  });

  // Format the main comment with confidence score
  const commentBody = formatReviewForGitHub(review, {
    confidenceScore: prReview?.confidenceScore ?? undefined,
    sequenceDiagram: prReview?.sequenceDiagram ?? null,
    docstringSuggestions:
      (prReview?.docstringSuggestions as unknown as DocstringSuggestion[]) ?? null,
    blastRadius: (prReview?.blastRadius as unknown as BlastRadiusData) ?? null,
    testCoverage: (prReview?.testCoverage as unknown as TestCoverageData) ?? null,
  });

  // Lines GitHub can anchor review comments to (added + context lines of the PR diff)
  let commentableLines: Map<string, Set<number>> | undefined;
  try {
    const diff = await new GitHubService(accessToken).getPrDiff(owner, repo, prNumber);
    commentableLines = new Map(parseUnifiedDiff(diff).map((f) => [f.path, f.commentableLines]));
  } catch (diffError) {
    console.warn("[Reviewer] Could not fetch diff to validate inline comment lines:", diffError);
  }

  // Create inline comments (review issues + docstring suggestions)
  const baseInlineComments = createInlineComments(review, commentableLines);
  const docSuggestions =
    (prReview?.docstringSuggestions as unknown as DocstringSuggestion[]) ?? [];
  const docInlineComments = docSuggestions
    .filter((s) => !commentableLines || commentableLines.get(s.path)?.has(s.line))
    .slice(0, 5)
    .map((s) => {
    const replacement = `${s.docstring}\n${s.signatureLine}`;
    const body =
      `📝 **Docstring suggestion**\n\n` +
      "```suggestion\n" +
      replacement +
      "\n```";
    return { path: s.path, line: s.line, body };
  });
  const inlineComments = [...baseInlineComments, ...docInlineComments];

  // Determine review event type
  const reviewEvent =
    review.recommendation === "approve"
      ? "APPROVE"
      : review.recommendation === "request_changes"
        ? "REQUEST_CHANGES"
        : "COMMENT";

  let commentId: number | null = null;

  // Try using GitHub App bot first (can approve/request changes on any PR)
  const botService = await createBotGitHubService(owner, repo);

  if (botService) {
    // Use the bot to post reviews - it can approve anyone's PRs
    console.warn("[Reviewer] Using Revio Bot to post review");
    const botGithub = new GitHubService(botService.token);

    try {
      commentId = await botGithub.createPrReview(
        owner,
        repo,
        prNumber,
        commentBody,
        reviewEvent,
        inlineComments
      );
    } catch (error: unknown) {
      // Check if error is line resolution issue (422)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Line could not be resolved") || errorMessage.includes("422")) {
        console.warn("[Reviewer] Inline comments failed (line resolution error), posting review without inline comments");
        // Retry without inline comments
        commentId = await botGithub.createPrReview(
          owner,
          repo,
          prNumber,
          commentBody,
          reviewEvent,
          undefined // No inline comments
        );

        // Post inline comments as a separate comment if there are any
        if (inlineComments.length > 0) {
          let inlineBody = "### Additional Code-Level Feedback\n\n";
          for (const comment of inlineComments) {
            inlineBody += `**\`${comment.path}:${comment.line}\`**\n${comment.body}\n\n---\n\n`;
          }
          await botGithub.createPrComment(owner, repo, prNumber, inlineBody);
        }
      } else {
        throw error;
      }
    }
  } else {
    // Fall back to user's token if GitHub App not installed
    console.warn("[Reviewer] GitHub App not installed, using user token");
    const github = new GitHubService(accessToken);

    // Post PR review with inline comments
    // If posting APPROVE/REQUEST_CHANGES for own PR fails, fall back to COMMENT
    try {
      commentId = await github.createPrReview(
        owner,
        repo,
        prNumber,
        commentBody,
        reviewEvent,
        inlineComments
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if error is line resolution issue (422)
      if (errorMessage.includes("Line could not be resolved") || errorMessage.includes("422")) {
        console.warn("[Reviewer] Inline comments failed (line resolution error), posting review without inline comments");
        // Retry without inline comments
        try {
          commentId = await github.createPrReview(
            owner,
            repo,
            prNumber,
            commentBody,
            reviewEvent,
            undefined
          );
        } catch (retryError: unknown) {
          const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
          if (
            retryMessage.includes("Can not approve your own pull request") ||
            retryMessage.includes("Can not request changes on your own pull request")
          ) {
            commentId = await github.createPrReview(owner, repo, prNumber, commentBody, "COMMENT", undefined);
          } else {
            throw retryError;
          }
        }

        // Post inline comments as a separate comment if there are any
        if (inlineComments.length > 0) {
          let inlineBody = "### Additional Code-Level Feedback\n\n";
          for (const comment of inlineComments) {
            inlineBody += `**\`${comment.path}:${comment.line}\`**\n${comment.body}\n\n---\n\n`;
          }
          await github.createPrComment(owner, repo, prNumber, inlineBody);
        }
      } else if (
        errorMessage.includes("Can not approve your own pull request") ||
        errorMessage.includes("Can not request changes on your own pull request")
      ) {
        console.warn(`Cannot ${reviewEvent} own PR, falling back to COMMENT`);
        commentId = await github.createPrReview(
          owner,
          repo,
          prNumber,
          commentBody,
          "COMMENT",
          inlineComments
        );
      } else {
        throw error;
      }
    }
  }

  // Update the PR review record with the comment ID
  await db.prReview.update({
    where: {
      repositoryId_prNumber: {
        repositoryId,
        prNumber,
      },
    },
    data: {
      githubCommentId: commentId ? BigInt(commentId) : null,
    },
  });

  return commentId;
}

function createEmptyLearningContext(
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

  // Group by severity
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
