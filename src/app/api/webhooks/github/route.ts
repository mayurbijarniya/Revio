import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { addPrReviewJob } from "@/lib/queue";
import { WEBHOOK_CONFIG } from "@/lib/constants";

/**
 * Verify GitHub webhook signature
 */
function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  const hmac = crypto.createHmac(WEBHOOK_CONFIG.signatureAlgorithm, secret);
  const digest = `sha256=${hmac.update(payload).digest("hex")}`;

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
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

  // Verify webhook signature
  if (repository.webhookSecret) {
    if (!verifySignature(payload, signature, repository.webhookSecret)) {
      console.warn(`[Webhook] Invalid signature for ${repoFullName}`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // Handle pull_request events
  if (event === "pull_request") {
    return handlePullRequestEvent(body, repository);
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
    user: { login: string };
    html_url: string;
    draft?: boolean;
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
    `[Webhook] Queueing review for PR #${pr.number} in ${repository.fullName}`
  );

  // Queue the PR review job
  const jobId = await addPrReviewJob({
    repositoryId: repository.id,
    prNumber: pr.number,
    prTitle: pr.title,
    prAuthor: pr.user.login,
    accessToken: repository.user.accessToken,
  });

  return NextResponse.json({
    message: "PR review queued",
    jobId,
    pr: pr.number,
  });
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
