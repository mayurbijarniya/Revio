import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getUserAccessToken } from "@/lib/auth";
import { GitHubService } from "@/lib/services/github";
import { jsonSuccess, jsonError } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const REQUIRED_EVENTS = ["pull_request", "push", "issue_comment"] as const;

/**
 * POST /api/repos/[id]/webhook/upgrade
 * Upgrade an existing webhook to include required events (e.g. `issue_comment`).
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id: repositoryId } = await params;

  try {
    const repo = await db.repository.findFirst({
      where: { id: repositoryId, userId: session.userId },
      select: { id: true, fullName: true, webhookId: true },
    });

    if (!repo) {
      return jsonError("REPO_001", "Repository not found", 404);
    }

    if (!repo.webhookId) {
      return jsonSuccess({
        upgraded: false,
        alreadyUpToDate: false,
        webhookConfigured: false,
        message:
          "No webhook is configured for this repository. Reconnect the repository in a publicly reachable environment to enable webhooks.",
      });
    }

    const accessToken = await getUserAccessToken(session.userId);
    if (!accessToken) {
      return jsonError("AUTH_001", "Invalid GitHub token", 401);
    }

    const [owner, repoName] = repo.fullName.split("/");
    if (!owner || !repoName) {
      return jsonError("REPO_002", "Invalid repository name", 400);
    }

    const github = new GitHubService(accessToken);
    const current = await github.getWebhook(owner, repoName, repo.webhookId);

    const currentEvents = current.events || [];
    const hasWildcard = currentEvents.includes("*");
    const hasAllRequired =
      hasWildcard || REQUIRED_EVENTS.every((e) => currentEvents.includes(e));

    if (hasAllRequired) {
      return jsonSuccess({
        upgraded: false,
        alreadyUpToDate: true,
        webhookConfigured: true,
        webhookId: current.id,
        events: currentEvents,
        message: "Webhook already includes required events (including issue_comment).",
      });
    }

    const desiredEvents = Array.from(
      new Set<string>([...currentEvents, ...REQUIRED_EVENTS])
    ).sort((a, b) => a.localeCompare(b));

    const updated = await github.updateWebhookEvents(
      owner,
      repoName,
      repo.webhookId,
      desiredEvents
    );

    return jsonSuccess({
      upgraded: true,
      alreadyUpToDate: false,
      webhookConfigured: true,
      webhookId: updated.id,
      before: currentEvents,
      after: updated.events,
      message: "Webhook upgraded to include required events (including issue_comment).",
    });
  } catch (error) {
    console.error("Failed to upgrade webhook:", error);
    return jsonError(
      "INTERNAL_001",
      error instanceof Error ? error.message : "Failed to upgrade webhook",
      500
    );
  }
}

