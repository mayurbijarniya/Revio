import { NextRequest, after } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getUserAccessToken } from "@/lib/auth";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { ConnectRepoSchema } from "@/types/repository";
import { PLAN_LIMITS } from "@/lib/constants";
import { scheduleIndexing } from "@/lib/services/background-orchestrator";

// GitHub App handles webhooks globally - no per-repo webhooks needed

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

    // Verify user has valid GitHub token
    const accessToken = await getUserAccessToken(session.userId);
    if (!accessToken) {
      return jsonError("AUTH_001", "Invalid GitHub token", 401);
    }

    // Create repository record
    // Note: Webhooks are handled by the GitHub App globally, not per-repo
    const repo = await db.repository.create({
      data: {
        userId: session.userId,
        githubRepoId,
        name,
        fullName,
        private: isPrivate,
        defaultBranch,
        language,
        // webhookId and webhookSecret are deprecated - GitHub App handles webhooks
        webhookId: null,
        webhookSecret: null,
        indexStatus: "pending",
      },
    });

    // Queue-first indexing via Upstash Redis (durable retries/backoff).
    const encryptedUserToken = await db.user.findUnique({
      where: { id: session.userId },
      select: { accessToken: true },
    });

    const indexingResult = await scheduleIndexing({
      repositoryId: repo.id,
      userId: session.userId,
      fullName,
      defaultBranch,
      encryptedAccessToken: encryptedUserToken?.accessToken ?? null,
      fallbackAccessToken: accessToken,
      forceFullIndex: false,
      trigger: "connect",
      dispatchTask: (task) => after(task),
    });

    const refreshedRepo = await db.repository.findUnique({
      where: { id: repo.id },
    });
    const responseRepo = refreshedRepo ?? repo;

    return jsonSuccess(
      {
        repository: {
          id: responseRepo.id,
          githubRepoId: responseRepo.githubRepoId,
          name: responseRepo.name,
          fullName: responseRepo.fullName,
          private: responseRepo.private,
          defaultBranch: responseRepo.defaultBranch,
          language: responseRepo.language,
          indexStatus: responseRepo.indexStatus,
          indexQueuedAt: responseRepo.indexQueuedAt,
          indexStartedAt: responseRepo.indexStartedAt,
          indexHeartbeatAt: responseRepo.indexHeartbeatAt,
          indexJobId: responseRepo.indexJobId,
          autoReview: responseRepo.autoReview,
          webhookActive: true, // GitHub App handles webhooks globally
        },
        scheduling: {
          mode: indexingResult.mode,
          jobId: indexingResult.jobId,
        },
        message:
          `Repository connected with automatic PR reviews enabled via GitHub App. ${indexingResult.message}`,
      },
      201
    );
  } catch (error) {
    console.error("Failed to connect repo:", error);
    return jsonError("INTERNAL_001", "Failed to connect repository", 500);
  }
}
