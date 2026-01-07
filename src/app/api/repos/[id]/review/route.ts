import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { getUserAccessToken } from "@/lib/auth";
import { GitHubService } from "@/lib/services/github";
import { reviewPullRequest, postReviewToGitHub } from "@/lib/services/reviewer";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const reviewSchema = z.object({
  prNumber: z.number().int().positive(),
});

/**
 * POST /api/repos/[id]/review
 * Manually trigger a PR review
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("VALIDATION_001", "Invalid request: prNumber required", 400);
    }

    const { prNumber } = parsed.data;

    // Find the repository
    const repository = await db.repository.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    });

    if (!repository) {
      return jsonError("REPO_001", "Repository not found", 404);
    }

    // Get access token
    const accessToken = await getUserAccessToken(session.userId);
    if (!accessToken) {
      return jsonError("AUTH_004", "Access token not found", 401);
    }

    // Get PR details from GitHub
    const github = new GitHubService(accessToken);
    const [owner, repo] = repository.fullName.split("/");

    if (!owner || !repo) {
      return jsonError("REPO_002", "Invalid repository name", 400);
    }

    let prDetails;
    try {
      prDetails = await github.getPullRequest(owner, repo, prNumber);
    } catch {
      return jsonError("PR_001", `PR #${prNumber} not found`, 404);
    }

    // Create or update pending PR review record
    await db.prReview.upsert({
      where: {
        repositoryId_prNumber: {
          repositoryId: id,
          prNumber,
        },
      },
      update: {
        prTitle: prDetails.title,
        prUrl: prDetails.html_url,
        prAuthor: prDetails.user.login,
        status: "pending",
      },
      create: {
        repositoryId: id,
        prNumber,
        prTitle: prDetails.title,
        prUrl: prDetails.html_url,
        prAuthor: prDetails.user.login,
        status: "pending",
      },
    });

    // Process the review
    try {
      const review = await reviewPullRequest(
        id,
        {
          number: prNumber,
          title: prDetails.title,
          body: prDetails.body,
          author: prDetails.user.login,
          url: prDetails.html_url,
          baseBranch: prDetails.base.ref,
          headBranch: prDetails.head.ref,
        },
        accessToken
      );

      if (!review) {
        throw new Error("Failed to generate review");
      }

      // Post to GitHub
      await postReviewToGitHub(id, prNumber, review, accessToken);

      return jsonSuccess({
        message: "PR review completed",
        prNumber,
        summary: review.summary,
        recommendation: review.recommendation,
      });
    } catch (error) {
      console.error(`Failed to review PR #${prNumber}:`, error);

      // Update status to failed
      await db.prReview.update({
        where: {
          repositoryId_prNumber: {
            repositoryId: id,
            prNumber,
          },
        },
        data: { status: "failed" },
      });

      return jsonError(
        "REVIEW_001",
        `Failed to review PR #${prNumber}`,
        500
      );
    }
  } catch (error) {
    console.error("Failed to trigger PR review:", error);
    return jsonError("INTERNAL_001", "Failed to trigger PR review", 500);
  }
}

/**
 * GET /api/repos/[id]/review
 * List open PRs that can be reviewed
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    // Find the repository
    const repository = await db.repository.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    });

    if (!repository) {
      return jsonError("REPO_001", "Repository not found", 404);
    }

    // Get access token
    const accessToken = await getUserAccessToken(session.userId);
    if (!accessToken) {
      return jsonError("AUTH_004", "Access token not found", 401);
    }

    // Get open PRs from GitHub
    const github = new GitHubService(accessToken);
    const [owner, repo] = repository.fullName.split("/");

    if (!owner || !repo) {
      return jsonError("REPO_002", "Invalid repository name", 400);
    }

    const prs = await github.listPullRequests(owner, repo, { state: "open" });

    // Get existing reviews for these PRs
    const existingReviews = await db.prReview.findMany({
      where: {
        repositoryId: id,
        prNumber: { in: prs.map((pr) => pr.number) },
      },
      select: {
        prNumber: true,
        status: true,
        createdAt: true,
      },
    });

    const reviewMap = new Map(
      existingReviews.map((r) => [r.prNumber, r])
    );

    return jsonSuccess({
      pullRequests: prs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        author: pr.user.login,
        url: pr.html_url,
        draft: pr.draft,
        createdAt: pr.created_at,
        reviewStatus: reviewMap.get(pr.number)?.status || null,
        lastReviewedAt: reviewMap.get(pr.number)?.createdAt || null,
      })),
    });
  } catch (error) {
    console.error("Failed to list PRs:", error);
    return jsonError("INTERNAL_001", "Failed to list pull requests", 500);
  }
}
