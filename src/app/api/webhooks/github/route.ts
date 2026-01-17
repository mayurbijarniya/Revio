import { NextRequest, NextResponse, after } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { WEBHOOK_CONFIG } from "@/lib/constants";
import { reviewPullRequest, postReviewToGitHub } from "@/lib/services/reviewer";
import { decrypt } from "@/lib/encryption";
import { createBotGitHubService } from "@/lib/services/github-app";
import {
  parseBotCommand,
  getOrCreateConversation,
  addMessageToConversation,
  processBotCommand,
  type BotMessage,
} from "@/lib/services/bot-conversation";

// GitHub App webhook secret (required for all webhook events)
const GITHUB_APP_WEBHOOK_SECRET = process.env.GITHUB_APP_WEBHOOK_SECRET;

/**
 * Verify GitHub webhook signature
 */
function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) return false;

  const hmac = crypto.createHmac(WEBHOOK_CONFIG.signatureAlgorithm, secret);
  const digest = `sha256=${hmac.update(payload).digest("hex")}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    // Buffer lengths differ
    return false;
  }
}

/**
 * POST /api/webhooks/github - Handle GitHub webhook events
 */
export async function POST(request: NextRequest) {
  const event = request.headers.get("x-github-event");
  const delivery = request.headers.get("x-github-delivery");
  const signature = request.headers.get("x-hub-signature-256");

  console.warn(`[Webhook] Received event: ${event}, delivery: ${delivery}`);

  // Get raw body for signature verification
  const payload = await request.text();

  // Parse the payload
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  // Check for ignored events
  if (event && (WEBHOOK_CONFIG.ignoredEvents as readonly string[]).includes(event)) {
    return NextResponse.json({ message: "Event ignored" });
  }

  // Get repository info to find webhook secret
  const repoFullName = (body.repository as { full_name?: string })?.full_name;

  if (!repoFullName) {
    return NextResponse.json({ error: "Missing repository info" }, { status: 400 });
  }

  // Find the repository in our database
  const repository = await db.repository.findFirst({
    where: { fullName: repoFullName },
    include: {
      user: {
        select: { accessToken: true },
      },
    },
  });

  if (!repository) {
    console.warn(`[Webhook] Repository not found: ${repoFullName}`);
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  // Verify webhook signature using GitHub App secret
  if (!GITHUB_APP_WEBHOOK_SECRET) {
    console.error(`[Webhook] GITHUB_APP_WEBHOOK_SECRET not configured!`);
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  if (!verifySignature(payload, signature, GITHUB_APP_WEBHOOK_SECRET)) {
    console.warn(`[Webhook] Invalid signature for ${repoFullName}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  
  console.warn(`[Webhook] Signature verified for ${repoFullName}`);

  // Handle pull_request events
  if (event === "pull_request") {
    return handlePullRequestEvent(body, repository);
  }

  // Handle issue_comment events (for @bot conversations)
  if (event === "issue_comment") {
    return handleIssueCommentEvent(body, repository);
  }

  // Handle push events (for re-indexing in the future)
  if (event === "push") {
    return handlePushEvent(body, repository);
  }

  return NextResponse.json({ message: "Event received" });
}

interface RepositoryWithUser {
  id: string;
  fullName: string;
  autoReview: boolean;
  user: {
    accessToken: string;
  };
}

/**
 * Handle pull_request events
 */
async function handlePullRequestEvent(
  body: Record<string, unknown>,
  repository: RepositoryWithUser
) {
  const action = body.action as string;
  const pr = body.pull_request as {
    number: number;
    title: string;
    body: string | null;
    user: { login: string };
    html_url: string;
    draft?: boolean;
    base: { ref: string };
    head: { ref: string; sha?: string };
  };

  // Only process specific actions
  if (!(WEBHOOK_CONFIG.reviewTriggers as readonly string[]).includes(action)) {
    return NextResponse.json({ message: "Action not trigger for review" });
  }

  // Skip draft PRs unless they become ready
  if (pr.draft && action !== "ready_for_review") {
    return NextResponse.json({ message: "Skipping draft PR" });
  }

  // Check if auto-review is enabled
  if (!repository.autoReview) {
    return NextResponse.json({ message: "Auto-review disabled for repository" });
  }

  console.warn(
    `[Webhook] Starting review for PR #${pr.number} in ${repository.fullName}`
  );

  // Create pending PR review record immediately so it shows on dashboard
  await db.prReview.upsert({
    where: {
      repositoryId_prNumber: {
        repositoryId: repository.id,
        prNumber: pr.number,
      },
    },
    update: {
      prTitle: pr.title,
      prUrl: pr.html_url,
      prAuthor: pr.user.login,
      status: "pending",
    },
    create: {
      repositoryId: repository.id,
      prNumber: pr.number,
      prTitle: pr.title,
      prUrl: pr.html_url,
      prAuthor: pr.user.login,
      status: "pending",
    },
  });

  // Process review using the Next.js 15 after() API
  // This ensures the background process continues after the response is sent to GitHub
  console.warn(`[Webhook] Scheduling async review for PR #${pr.number} using after()`);
  after(async () => {
    try {
      await processReviewAsync(repository, pr);
    } catch (error) {
      console.error(`[Webhook] Critical error in review background process for PR #${pr.number}:`, error);
    }
  });

  return NextResponse.json({
    message: "PR review started",
    pr: pr.number,
  });
}

/**
 * Process PR review asynchronously (fire and forget)
 */
async function processReviewAsync(
  repository: RepositoryWithUser,
  pr: {
    number: number;
    title: string;
    body: string | null;
    user: { login: string };
    html_url: string;
    base: { ref: string };
    head: { ref: string; sha?: string };
  }
) {
  try {
    const parts = repository.fullName.split("/");
    const owner = parts[0];
    const repo = parts[1];

    if (!owner || !repo) {
      throw new Error("Invalid repository name");
    }

    // Try to get bot service first for more reliable authentication
    const botService = await createBotGitHubService(owner, repo);
    let accessToken: string;

    if (botService) {
      console.warn(`[Webhook] Using bot token for ${repository.fullName}`);
      accessToken = botService.token;
    } else {
      console.warn(`[Webhook] Bot service unavailable for ${repository.fullName}, falling back to user token`);
      // Decrypt the user access token as fallback
      accessToken = decrypt(repository.user.accessToken);
    }

    // Get repository details for default branch
    const repoDetails = await db.repository.findUnique({
      where: { id: repository.id },
      select: { defaultBranch: true },
    });

    // Review the PR
    const review = await reviewPullRequest(
      repository.id,
      {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        author: pr.user.login,
        url: pr.html_url,
        baseBranch: repoDetails?.defaultBranch || pr.base.ref,
        headBranch: pr.head.ref,
        headSha: pr.head.sha,
      },
      accessToken
    );

    if (!review) {
      throw new Error("Failed to generate review");
    }

    // Post review to GitHub
    await postReviewToGitHub(
      repository.id,
      pr.number,
      review,
      accessToken
    );

    console.warn(`[Webhook] Completed review for PR #${pr.number}`);
  } catch (error) {
    console.error(`[Webhook] Failed to process PR #${pr.number}:`, error);

    // Update the PR review status to failed
    console.warn(`[Webhook] Marking PR #${pr.number} as failed in database`);
    await db.prReview.update({
      where: {
        repositoryId_prNumber: {
          repositoryId: repository.id,
          prNumber: pr.number,
        },
      },
      data: {
        status: "failed",
      },
    });
  }
}

/**
 * Handle issue_comment events (for @bot conversations)
 */
async function handleIssueCommentEvent(
  body: Record<string, unknown>,
  repository: RepositoryWithUser
) {
  const action = body.action as string;
  const comment = body.comment as {
    id: number;
    body: string;
    user: { login: string; id: number; type?: string };
    created_at: string;
  };
  const issue = body.issue as {
    number: number;
    pull_request?: { url: string };
  };

  // Only process created comments (not edited/deleted)
  if (action !== "created") {
    return NextResponse.json({ message: "Comment action not supported" });
  }

  // Only process comments on pull requests (not regular issues)
  if (!issue.pull_request) {
    return NextResponse.json({ message: "Comment not on pull request" });
  }

  // Ignore bot-authored comments to prevent loops
  const isBotUser =
    comment.user.type === "Bot" || comment.user.login.toLowerCase().endsWith("[bot]");
  if (isBotUser) {
    return NextResponse.json({ message: "Ignoring bot comment" });
  }

  // Check if comment mentions the bot
  const botCommand = parseBotCommand(comment.body);

  if (!botCommand) {
    return NextResponse.json({ message: "No bot command found in comment" });
  }

  console.warn(
    `[Webhook] Bot command detected in PR #${issue.number}: ${botCommand.command}`
  );

  // Find the PR review for this PR
  const prReview = await db.prReview.findUnique({
    where: {
      repositoryId_prNumber: {
        repositoryId: repository.id,
        prNumber: issue.number,
      },
    },
  });

  if (!prReview) {
    console.warn(`[Webhook] No PR review found for PR #${issue.number}`);
    return NextResponse.json({ error: "PR review not found" }, { status: 404 });
  }

  // Process bot command in background
  after(async () => {
    try {
      await processBotCommentAsync(
        repository,
        prReview.id,
        issue.number,
        comment,
        botCommand
      );
    } catch (error) {
      console.error(`[Webhook] Failed to process bot comment for PR #${issue.number}:`, error);
    }
  });

  return NextResponse.json({
    message: "Bot command received",
    command: botCommand.command,
  });
}

/**
 * Process bot comment asynchronously
 */
async function processBotCommentAsync(
  repository: RepositoryWithUser,
  prReviewId: string,
  prNumber: number,
  comment: {
    id: number;
    body: string;
    user: { login: string; id: number };
    created_at: string;
  },
  botCommand: { command: string; args: string; rawContent: string }
) {
  try {
    // Get or create conversation
    const conversation = await getOrCreateConversation(
      prReviewId,
      repository.id,
      prNumber
    );

    // Add user message to conversation
    const userMessage: BotMessage = {
      role: "user",
      content: botCommand.rawContent,
      timestamp: comment.created_at,
      commentId: comment.id,
      userId: String(comment.user.id),
    };

    await addMessageToConversation(conversation.id, userMessage);

    // Process command and generate bot response
    const botResponse = await processBotCommand(
      botCommand as { command: "explain" | "why" | "ignore" | "re-review" | "unknown"; args: string; rawContent: string },
      prReviewId,
      repository.id,
      prNumber
    );

    // Add bot response to conversation
    const botMessage: BotMessage = {
      role: "bot",
      content: botResponse,
      timestamp: new Date().toISOString(),
    };

    await addMessageToConversation(conversation.id, botMessage);

    // Post bot response as GitHub comment
    const parts = repository.fullName.split("/");
    const owner = parts[0];
    const repo = parts[1];

    if (!owner || !repo) {
      throw new Error("Invalid repository name");
    }

    // Use bot service to post comment
    const botService = await createBotGitHubService(owner, repo);
    let accessToken: string;

    if (botService) {
      console.warn(`[Webhook] Using bot token for comment reply in ${repository.fullName}`);
      accessToken = botService.token;
    } else {
      console.warn(`[Webhook] Bot service unavailable, falling back to user token`);
      accessToken = decrypt(repository.user.accessToken);
    }

    // Import GitHubService
    const { GitHubService } = await import("@/lib/services/github");
    const githubService = new GitHubService(accessToken);

    // Post comment reply
    await githubService.createPrComment(owner, repo, prNumber, botResponse);

    console.warn(`[Webhook] Posted bot response to PR #${prNumber}`);

    if (botCommand.command === "re-review") {
      try {
        const pr = await githubService.getPullRequest(owner, repo, prNumber);
        await processReviewAsync(repository, pr);
      } catch (reviewError) {
        console.error(`[Webhook] Failed to re-review PR #${prNumber}:`, reviewError);
      }
    }
  } catch (error) {
    console.error(`[Webhook] Failed to process bot comment:`, error);
    throw error;
  }
}

/**
 * Handle push events (placeholder for future re-indexing)
 */
async function handlePushEvent(
  body: Record<string, unknown>,
  repository: RepositoryWithUser
) {
  const ref = body.ref as string;
  const defaultBranch = (body.repository as { default_branch?: string })?.default_branch;

  // Only care about pushes to default branch
  if (ref !== `refs/heads/${defaultBranch}`) {
    return NextResponse.json({ message: "Push not to default branch" });
  }

  console.warn(
    `[Webhook] Push to ${defaultBranch} in ${repository.fullName} - re-indexing not yet implemented`
  );

  // TODO: Queue re-indexing job

  return NextResponse.json({ message: "Push event received" });
}
