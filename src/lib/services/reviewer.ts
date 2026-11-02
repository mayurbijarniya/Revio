import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { GitHubService } from "./github";
import { createBotGitHubService } from "./github-app";
import { retrieveMultiContext, formatContextForPrompt } from "./retriever";
import {
  formatReviewForGitHub,
  createInlineComments,
  type ReviewResult,
  type DocstringSuggestion,
} from "@/lib/prompts/review";
import type { BlastRadiusData } from "@/types/blast-radius";
import type { TestCoverageData } from "@/types/test-coverage";
import { REVIEW_CONFIG } from "@/lib/constants";
import { parseReviewSettings } from "@/types/review";
import { logActivity } from "./activity";
import { StandardsDetector } from "./standards-detector";
import { getCodeGraph } from "./code-graph";
import { generateDocstringSuggestions } from "./docstrings";
import { getEffectiveLearningContext, updateAdoptionRatesFromRuns } from "./learning";
import { parseUnifiedDiff } from "./diff-parser";
import { baseGraphScope, buildPrGraphScope } from "./pr-graph";
import { runReviewCore } from "./review-core";

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

  const reviewSettings = parseReviewSettings(repository.reviewRules);

  // Shared review pipeline (also used by the offline evaluation), with production data sources
  const core = await runReviewCore(
    {
      title: prData.title,
      body: prData.body,
      diff,
      ignoredPaths: repository.ignoredPaths || [],
      settings: reviewSettings,
    },
    {
      loadLearning: () => getEffectiveLearningContext(repositoryId),
      loadSemanticContext: async (files) => {
        if (repository.indexStatus !== "indexed") return null;
        const contextQueries = files.slice(0, 10).map((file) => {
          return `File changes in ${file.path}: ${file.additions.slice(0, 500)}`;
        });
        console.warn(`[Reviewer] Retrieving semantic context for ${contextQueries.length} queries`);
        const context = await retrieveMultiContext(repositoryId, contextQueries, {
          maxChunksPerQuery: 3,
          maxTotalChunks: REVIEW_CONFIG.maxContextChunks,
          maxTokens: REVIEW_CONFIG.maxContextTokens,
        });
        console.warn(`[Reviewer] Retrieved ${context.chunks.length} context chunks`);
        return formatContextForPrompt(context.chunks);
      },
      loadStandardsContext: async () =>
        StandardsDetector.formatStandardsForPrompt(
          await StandardsDetector.getRepositoryStandards(repositoryId)
        ),
      // Indexed base-branch graph with the changed files re-parsed at the PR head
      loadGraphScope: async (files) => {
        const baseGraph = await getCodeGraph(repositoryId);
        if (!baseGraph) return null;
        const scope = headSha
          ? await buildPrGraphScope({
              baseGraph,
              files,
              loadHeadFile: (path) =>
                github.getFileContent(owner, repo, path, headSha).catch(() => null),
            })
          : baseGraphScope(baseGraph, files);
        console.warn(
          `[Reviewer] Graph scope ready: ${scope.headParsedFiles}/${files.length} changed files parsed at PR head, ` +
            `${scope.extraChangedNodeIds.length} removed definitions`
        );
        return scope;
      },
    },
    { repositoryId, organizationId: repository.organizationId }
  );

  if (!core) {
    console.error("Failed to parse review response");
    return null;
  }

  const {
    filteredFiles,
    review: finalReview,
    sequenceDiagram,
    blastRadius,
    testCoverage,
    confidence: confidenceResult,
    tokensUsed,
  } = core;

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

  console.warn(`[Reviewer] Confidence score: ${confidenceResult.score}/5 (${confidenceResult.level})`);
  console.warn(`[Reviewer] Reasoning: ${confidenceResult.reasoning.join(", ")}`);

  // Transform positives (strings) to suggestions format (objects with title/description)
  const formattedSuggestions = (finalReview.positives || []).map((positive: string, idx: number) => ({
    title: `Highlight ${idx + 1}`,
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
