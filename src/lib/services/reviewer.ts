import { db } from "@/lib/db";
import { GitHubService } from "./github";
import { retrieveMultiContext, formatContextForPrompt } from "./retriever";
import { generateReviewResponse } from "./gemini";
import {
  REVIEW_SYSTEM_PROMPT,
  buildReviewPrompt,
  parseReviewResponse,
  formatReviewForGitHub,
  createInlineComments,
  type ReviewResult,
} from "@/lib/prompts/review";
import { REVIEW_CONFIG, AI_CONFIG } from "@/lib/constants";

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

  // Get PR diff
  const diff = await github.getPrDiff(owner, repo, prData.number);

  // Check if PR is too large
  if (diff.length > REVIEW_CONFIG.maxDiffBytes) {
    console.warn(`PR ${prData.number} diff too large: ${diff.length} bytes`);
    // Still process but truncate
  }

  // Parse changed files from diff
  const changedFiles = parseChangedFiles(diff);

  // Check file count limit
  if (changedFiles.length > REVIEW_CONFIG.maxFiles) {
    console.warn(`PR ${prData.number} has too many files: ${changedFiles.length}`);
  }

  // Build queries for context retrieval based on changed files
  const contextQueries = changedFiles.slice(0, 10).map((file) => {
    return `File changes in ${file.path}: ${file.additions.slice(0, 500)}`;
  });

  // Retrieve codebase context
  let codebaseContext = "No additional context available.";
  if (repository.indexStatus === "indexed" && contextQueries.length > 0) {
    const context = await retrieveMultiContext(repositoryId, contextQueries, {
      maxChunksPerQuery: 3,
      maxTotalChunks: REVIEW_CONFIG.maxContextChunks,
      maxTokens: REVIEW_CONFIG.maxContextTokens,
    });
    codebaseContext = formatContextForPrompt(context.chunks);
  }

  // Determine if we need the complex model
  const isComplex =
    changedFiles.length > AI_CONFIG.review.complexThresholds.changedFiles ||
    diff.length > AI_CONFIG.review.complexThresholds.diffLength;

  // Build review prompt
  const truncatedDiff = diff.slice(0, REVIEW_CONFIG.maxDiffBytes);
  const reviewPrompt = buildReviewPrompt(
    prData.title,
    prData.body,
    truncatedDiff,
    codebaseContext
  );

  // Generate review
  const rawResponse = await generateReviewResponse(
    REVIEW_SYSTEM_PROMPT,
    reviewPrompt,
    { isComplex }
  );

  // Parse response
  const review = parseReviewResponse(rawResponse);

  if (!review) {
    console.error("Failed to parse review response");
    return null;
  }

  const processingTime = Date.now() - startTime;

  // Save review to database
  await db.prReview.upsert({
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
      summary: review.summary,
      issues: JSON.parse(JSON.stringify(review.issues)),
      suggestions: JSON.parse(JSON.stringify(review.positives)),
      filesAnalyzed: JSON.parse(JSON.stringify(changedFiles.map((f) => f.path))),
      status: "completed",
      processingTimeMs: processingTime,
    },
    create: {
      repositoryId,
      prNumber: prData.number,
      prTitle: prData.title,
      prUrl: prData.url,
      prAuthor: prData.author,
      summary: review.summary,
      issues: JSON.parse(JSON.stringify(review.issues)),
      suggestions: JSON.parse(JSON.stringify(review.positives)),
      filesAnalyzed: JSON.parse(JSON.stringify(changedFiles.map((f) => f.path))),
      status: "completed",
      processingTimeMs: processingTime,
    },
  });

  return review;
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

  const github = new GitHubService(accessToken);

  // Format the main comment
  const commentBody = formatReviewForGitHub(review);

  // Create inline comments
  const inlineComments = createInlineComments(review);

  // Post PR review with inline comments
  const commentId = await github.createPrReview(
    owner,
    repo,
    prNumber,
    commentBody,
    review.recommendation === "approve"
      ? "APPROVE"
      : review.recommendation === "request_changes"
      ? "REQUEST_CHANGES"
      : "COMMENT",
    inlineComments
  );

  // Update the PR review record with the comment ID
  await db.prReview.update({
    where: {
      repositoryId_prNumber: {
        repositoryId,
        prNumber,
      },
    },
    data: {
      githubCommentId: commentId,
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
