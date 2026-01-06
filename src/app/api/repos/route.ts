import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getUserAccessToken } from "@/lib/auth";
import { GitHubService } from "@/lib/services/github";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import type { AvailableRepository } from "@/types/repository";

/**
 * GET /api/repos
 * List all GitHub repositories for the authenticated user
 * Includes connection status for each repo
 */
export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = parseInt(searchParams.get("per_page") || "30", 10);

  try {
    // Get user's access token
    const accessToken = await getUserAccessToken(session.userId);
    if (!accessToken) {
      return jsonError("AUTH_001", "Invalid GitHub token", 401);
    }

    // Fetch repos from GitHub
    const github = new GitHubService(accessToken);
    const githubRepos = await github.getUserRepos(page, perPage);

    // Get connected repo IDs for this user
    const connectedRepos = await db.repository.findMany({
      where: { userId: session.userId },
      select: { githubRepoId: true },
    });
    const connectedIds = new Set(connectedRepos.map((r) => r.githubRepoId));

    // Map to available repositories with connection status
    const repos: AvailableRepository[] = githubRepos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      description: repo.description,
      language: repo.language,
      defaultBranch: repo.default_branch,
      pushedAt: repo.pushed_at,
      stargazersCount: repo.stargazers_count,
      isConnected: connectedIds.has(repo.id),
    }));

    return jsonSuccess({
      repositories: repos,
      page,
      perPage,
      hasMore: githubRepos.length === perPage,
    });
  } catch (error) {
    console.error("Failed to fetch repos:", error);
    return jsonError("INTERNAL_001", "Failed to fetch repositories", 500);
  }
}
