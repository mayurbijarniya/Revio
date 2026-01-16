import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { GitHubService } from "./github";
import { createBotGitHubService } from "./github-app";
import { retrieveMultiContext, formatContextForPrompt } from "./retriever";
import { generateReviewResponse } from "./gemini";
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
} from "./learning";

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

  // Check if PR is too large
  if (diff.length > REVIEW_CONFIG.maxDiffBytes) {
    console.warn(`[Reviewer] PR ${prData.number} diff too large: ${diff.length} bytes (limit: ${REVIEW_CONFIG.maxDiffBytes})`);
    // Still process but truncate
  }

  // Parse changed files from diff
  const changedFiles = parseChangedFiles(diff);
  console.warn(`[Reviewer] Parsed ${changedFiles.length} files from diff`);

  // Check file count limit
  if (changedFiles.length > REVIEW_CONFIG.maxFiles) {
    console.warn(`[Reviewer] PR ${prData.number} has too many files: ${changedFiles.length} (limit: ${REVIEW_CONFIG.maxFiles})`);
  }

  // Build queries for context retrieval based on changed files
  const contextQueries = changedFiles.slice(0, 10).map((file) => {
    return `File changes in ${file.path}: ${file.additions.slice(0, 500)}`;
  });

  // Retrieve codebase context
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

  // Determine if we need the complex model
  const isComplex =
    changedFiles.length > AI_CONFIG.review.complexThresholds.changedFiles ||
    diff.length > AI_CONFIG.review.complexThresholds.diffLength;

  // Parse review settings from repository
  const reviewSettings = parseReviewSettings(repository.reviewRules);

  // Load learned team preferences (repo + org)
  let learningContext: Awaited<ReturnType<typeof getEffectiveLearningContext>> | null = null;
  try {
    learningContext = await getEffectiveLearningContext(repositoryId);
  } catch (learningError) {
    console.warn("[Reviewer] Failed to load learning context:", learningError);
  }

  // Filter out ignored paths from changed files
  const ignoredPaths = repository.ignoredPaths || [];
  const filteredFiles = changedFiles.filter((file) => {
    return !ignoredPaths.some((pattern) => {
      // Simple glob matching
      const regex = new RegExp(
        "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
      );
      return regex.test(file.path);
    });
  });

  // Run security scanning on changed files
  const securityIssues: SecurityIssue[] = [];
  for (const file of filteredFiles) {
    const language = getLanguageFromPath(file.path);
    if (language) {
      const issues = scanCode(file.path, file.additions, language);
      securityIssues.push(...issues);
    }
  }

  // Format security issues for prompt context
  let securityContext = "";
  if (securityIssues.length > 0) {
    const severityCounts = getSeverityCounts(securityIssues);
    const securityScore = calculateSecurityScore(securityIssues);
    securityContext = formatSecurityContext(securityIssues, severityCounts, securityScore);
  }

  // Get coding standards for this repository
  const codingStandards = await StandardsDetector.getRepositoryStandards(repositoryId);
  const standardsContext = StandardsDetector.formatStandardsForPrompt(codingStandards);

  // Get code graph for impact analysis
  let graphContext = "";
  let codeGraphData: Awaited<ReturnType<typeof getCodeGraph>> = null;
  try {
    codeGraphData = await getCodeGraph(repositoryId);
    if (codeGraphData) {
      const changedFilePaths = filteredFiles.map((f) => f.path);
      graphContext = formatGraphContextForPrompt(codeGraphData, changedFilePaths);
      console.warn(`[Reviewer] Added graph context with impact analysis`);
    }
  } catch (graphError) {
    console.warn(`[Reviewer] Failed to retrieve graph context:`, graphError);
  }

  // Build review prompt with filtered files, security context, coding standards, and graph analysis
  const truncatedDiff = filterDiffByPaths(diff, filteredFiles.map((f) => f.path));
  const fullContext = [
    codebaseContext,
    securityContext,
    standardsContext,
    graphContext,
  ]
    .filter(Boolean)
    .join("\n\n");

  const reviewPrompt = buildReviewPrompt(
    prData.title,
    prData.body,
    truncatedDiff.slice(0, REVIEW_CONFIG.maxDiffBytes),
    fullContext
  );

  // Build system prompt with custom rules + learned preferences
  const learningPrompt = learningContext ? buildLearningPromptSection(learningContext) : "";
  const systemPrompt = buildReviewSystemPrompt(reviewSettings, learningPrompt);

  // Generate review
  console.warn(`[Reviewer] Starting AI generation using ${isComplex ? 'complex' : 'standard'} model`);
  const rawResponse = await generateReviewResponse(
    systemPrompt,
    reviewPrompt,
    { isComplex }
  );
  console.warn(`[Reviewer] AI generation completed, parsing response`);

  // Parse response
  const review = parseReviewResponse(rawResponse);

  if (!review) {
    console.error("Failed to parse review response");
    return null;
  }

  const filteredReview = learningContext
    ? applyLearningNitpickFiltering(review, learningContext, reviewSettings)
    : review;

  const processingTime = Date.now() - startTime;

  // Generate a Mermaid sequence diagram from code graph + changed files (best-effort)
  const sequenceDiagram = generateSequenceDiagram({
    changedFiles: filteredFiles.map((f) => f.path),
    graphData: codeGraphData,
  });

  let blastRadius: BlastRadiusData | null = null;
  try {
    blastRadius = generateBlastRadius({
      changedFiles: filteredFiles.map((f) => f.path),
      graphData: codeGraphData,
    });
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
      changedFiles: filteredFiles.map((f) => f.path),
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

  // Generate docstring suggestions (best-effort, limited)
  let docstringSuggestions: DocstringSuggestion[] = [];
  try {
    const res = await generateDocstringSuggestions({
      owner,
      repo,
      accessToken,
      headSha,
      diff,
      maxSuggestions: 3,
    });
    docstringSuggestions = res.suggestions;
  } catch (docError) {
    console.warn("[Reviewer] Docstring generation failed:", docError);
  }

  // Calculate confidence score for merge readiness
  const linesChanged = changedFiles.reduce((sum, f) => sum + f.lineCount, 0);

  // Count standards violations from review issues
  const standardsViolations = (filteredReview.issues || []).filter((issue) =>
    issue.description?.toLowerCase().includes("coding standard") ||
    issue.description?.toLowerCase().includes("standard violation")
  ).length;

  const confidenceResult = calculateConfidenceScore(
    filteredReview,
    securityIssues,
    changedFiles.length,
    linesChanged,
    standardsViolations
  );

  console.warn(`[Reviewer] Confidence score: ${confidenceResult.score}/5 (${confidenceResult.level})`);
  console.warn(`[Reviewer] Reasoning: ${confidenceResult.reasoning.join(", ")}`);

  // Transform positives (strings) to suggestions format (objects with title/description)
  const formattedSuggestions = (review.positives || []).map((positive: string, idx: number) => ({
    title: `Positive #${idx + 1}`,
    description: positive,
  }));

  // Transform files to proper format with path property
  const formattedFiles = changedFiles.map((f) => ({
    path: f.path,
    additions: f.additions ? f.additions.split("\n").length : 0,
    deletions: f.deletions ? f.deletions.split("\n").length : 0,
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
      summary: filteredReview.summary,
      issues: JSON.parse(JSON.stringify(filteredReview.issues)),
      suggestions: JSON.parse(JSON.stringify(formattedSuggestions)),
      filesAnalyzed: JSON.parse(JSON.stringify(formattedFiles)),
      recommendation: filteredReview.recommendation,
      riskLevel: filteredReview.riskLevel,
      confidenceScore: confidenceResult.score,
      sequenceDiagram,
      docstringSuggestions: JSON.parse(JSON.stringify(docstringSuggestions)),
      blastRadius: blastRadiusJson,
      testCoverage: testCoverageJson,
      headSha,
      runCount: { increment: 1 },
      status: "completed",
      processingTimeMs: processingTime,
    },
    create: {
      repositoryId,
      prNumber: prData.number,
      prTitle: prData.title,
      prUrl: prData.url,
      prAuthor: prData.author,
      summary: filteredReview.summary,
      issues: JSON.parse(JSON.stringify(filteredReview.issues)),
      suggestions: JSON.parse(JSON.stringify(formattedSuggestions)),
      filesAnalyzed: JSON.parse(JSON.stringify(formattedFiles)),
      recommendation: filteredReview.recommendation,
      riskLevel: filteredReview.riskLevel,
      confidenceScore: confidenceResult.score,
      sequenceDiagram,
      docstringSuggestions: JSON.parse(JSON.stringify(docstringSuggestions)),
      blastRadius: blastRadiusJson,
      testCoverage: testCoverageJson,
      headSha,
      runCount: 1,
      status: "completed",
      processingTimeMs: processingTime,
    },
  });

  // Persist a run record for adoption tracking (runNumber aligns with pr_reviews.run_count)
  try {
    await db.prReviewRun.create({
      data: {
        prReviewId: savedReview.id,
        runNumber: savedReview.runCount,
        headSha,
        summary: filteredReview.summary,
        issues: JSON.parse(JSON.stringify(filteredReview.issues)),
        suggestions: JSON.parse(JSON.stringify(formattedSuggestions)),
        filesAnalyzed: JSON.parse(JSON.stringify(formattedFiles)),
        recommendation: filteredReview.recommendation,
        riskLevel: filteredReview.riskLevel,
        confidenceScore: confidenceResult.score,
        sequenceDiagram,
        processingTimeMs: processingTime,
        tokensUsed: 0,
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
      description: `${filteredReview.issues.length} issues found in "${prData.title}"`,
      repositoryId,
      metadata: {
        prNumber: prData.number,
        issueCount: filteredReview.issues.length,
        recommendation: filteredReview.recommendation,
      },
    });
  }

  return filteredReview;
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

  // Create inline comments (review issues + docstring suggestions)
  const baseInlineComments = createInlineComments(review);
  const docSuggestions =
    (prReview?.docstringSuggestions as unknown as DocstringSuggestion[]) ?? [];
  const docInlineComments = docSuggestions.slice(0, 5).map((s) => {
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

/**
 * Parse changed files from diff
 */
interface ChangedFile {
  path: string;
  additions: string;
  deletions: string;
  lineCount: number;
}

function parseChangedFiles(diff: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  const fileBlocks = diff.split(/^diff --git/m).slice(1);

  for (const block of fileBlocks) {
    const pathMatch = block.match(/a\/(.+?)\s+b\/(.+)/);
    if (!pathMatch) continue;

    const path = pathMatch[2] ?? pathMatch[1] ?? "";
    const lines = block.split("\n");

    let additions = "";
    let deletions = "";
    let lineCount = 0;

    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        additions += line.slice(1) + "\n";
        lineCount++;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        deletions += line.slice(1) + "\n";
        lineCount++;
      }
    }

    files.push({ path, additions, deletions, lineCount });
  }

  return files;
}

/**
 * Filter diff to only include specified file paths
 */
function filterDiffByPaths(diff: string, allowedPaths: string[]): string {
  if (allowedPaths.length === 0) return diff;

  const allowedSet = new Set(allowedPaths);
  const fileBlocks = diff.split(/^(diff --git)/m);
  const result: string[] = [];

  for (let i = 0; i < fileBlocks.length; i++) {
    const block = fileBlocks[i];
    if (block === "diff --git" && i + 1 < fileBlocks.length) {
      const content = fileBlocks[i + 1];
      const pathMatch = content?.match(/a\/(.+?)\s+b\/(.+)/);
      const path = pathMatch?.[2] ?? pathMatch?.[1] ?? "";

      if (allowedSet.has(path)) {
        result.push("diff --git" + content);
      }
      i++; // Skip the content block since we processed it
    }
  }

  return result.join("");
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
