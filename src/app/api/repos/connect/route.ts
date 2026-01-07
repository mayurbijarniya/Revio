import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getUserAccessToken } from "@/lib/auth";
import { GitHubService } from "@/lib/services/github";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { ConnectRepoSchema } from "@/types/repository";
import { PLAN_LIMITS } from "@/lib/constants";
import { generateSecret } from "@/lib/encryption";
import { addIndexingJob } from "@/lib/queue";

/**
 * POST /api/repos/connect
 * Connect a GitHub repository for the authenticated user
 */
export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  try {
    const body = await request.json();
    const parsed = ConnectRepoSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("VALIDATION_001", "Invalid request parameters", 400, {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { githubRepoId, name, fullName, private: isPrivate, defaultBranch, language } = parsed.data;

    // Check if repo is already connected
    const existing = await db.repository.findUnique({
      where: {
        userId_githubRepoId: {
          userId: session.userId,
          githubRepoId,
        },
      },
    });

    if (existing) {
      return jsonError("REPO_003", "Repository already connected", 409);
    }

    // Check plan limits
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { plan: true },
    });

    const plan = (user?.plan || "free") as keyof typeof PLAN_LIMITS;
    const limit = PLAN_LIMITS[plan].repos;

    if (limit !== -1) {
      const repoCount = await db.repository.count({
        where: { userId: session.userId },
      });

      if (repoCount >= limit) {
        return jsonError("LIMIT_003", `Repository limit reached (${limit} repos on ${plan} plan)`, 403);
      }
    }

    // Get access token for webhook creation
    const accessToken = await getUserAccessToken(session.userId);
    if (!accessToken) {
      return jsonError("AUTH_001", "Invalid GitHub token", 401);
    }

    // Create webhook secret
    const webhookSecret = generateSecret(32);
    const parts = fullName.split("/");
    const owner = parts[0];
    const repoName = parts[1];

    let webhookId: number | null = null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const isLocalhost = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");

    // Try to create webhook (may fail if user doesn't have admin access)
    // Skip webhook creation for localhost since GitHub can't deliver webhooks to local URLs
    if (owner && repoName && !isLocalhost) {
      try {
        const github = new GitHubService(accessToken);
        const webhookUrl = `${appUrl}/api/webhooks/github`;
        webhookId = await github.createWebhook(owner, repoName, webhookUrl, webhookSecret);
      } catch (webhookError) {
        // Webhook creation failed - continue without webhook
        // User can still use chat and manual reviews
        console.warn("Webhook creation failed:", webhookError);
      }
    } else if (isLocalhost) {
      console.warn("Skipping webhook creation for localhost. Use manual PR review instead.");
    }

    // Create repository record
    const repo = await db.repository.create({
      data: {
        userId: session.userId,
        githubRepoId,
        name,
        fullName,
        private: isPrivate,
        defaultBranch,
        language,
        webhookId,
        webhookSecret: webhookId ? webhookSecret : null,
        indexStatus: "pending",
      },
    });

    // Get user's encrypted access token for indexing job
    const userToken = await db.user.findUnique({
      where: { id: session.userId },
      select: { accessToken: true },
    });

    // Queue indexing job automatically
    if (userToken?.accessToken) {
      try {
        await addIndexingJob({
          repositoryId: repo.id,
          userId: session.userId,
          fullName,
          defaultBranch,
          accessToken: userToken.accessToken,
        });
      } catch (indexError) {
        // Indexing job failed to queue - log but don't fail the connect
        console.warn("Failed to queue indexing job:", indexError);
      }
    }

    return jsonSuccess(
      {
        repository: {
          id: repo.id,
          githubRepoId: repo.githubRepoId,
          name: repo.name,
          fullName: repo.fullName,
          private: repo.private,
          defaultBranch: repo.defaultBranch,
          language: repo.language,
          indexStatus: repo.indexStatus,
          autoReview: repo.autoReview,
          webhookActive: !!webhookId,
        },
        message: isLocalhost
          ? "Repository connected. Webhooks are not available on localhost - use manual PR reviews instead."
          : webhookId
            ? "Repository connected with automatic PR reviews enabled."
            : "Repository connected. Webhook creation failed - use manual PR reviews instead.",
      },
      201
    );
  } catch (error) {
    console.error("Failed to connect repo:", error);
    return jsonError("INTERNAL_001", "Failed to connect repository", 500);
  }
}
