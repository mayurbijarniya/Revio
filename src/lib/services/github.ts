import { Octokit } from "@octokit/rest";

/**
 * GitHub repository from API
 */
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  language: string | null;
  default_branch: string;
  html_url: string;
  clone_url: string;
  updated_at: string;
  pushed_at: string;
  stargazers_count: number;
  open_issues_count: number;
  owner: {
    login: string;
    avatar_url: string;
  };
}

/**
 * Changed file in a PR
 */
export interface ChangedFile {
  filename: string;
  status: "added" | "removed" | "modified" | "renamed";
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

/**
 * GitHub Service for API interactions
 */
export class GitHubService {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({ auth: accessToken });
  }

  /**
   * Get authenticated user's repositories
   */
  async getUserRepos(
    page: number = 1,
    perPage: number = 30
  ): Promise<GitHubRepo[]> {
    const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
      sort: "pushed",
      direction: "desc",
      per_page: perPage,
      page,
      type: "all",
    });

    return data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      description: repo.description,
      language: repo.language,
      default_branch: repo.default_branch,
      html_url: repo.html_url,
      clone_url: repo.clone_url,
      updated_at: repo.updated_at ?? "",
      pushed_at: repo.pushed_at ?? "",
      stargazers_count: repo.stargazers_count,
      open_issues_count: repo.open_issues_count,
      owner: {
        login: repo.owner.login,
        avatar_url: repo.owner.avatar_url,
      },
    }));
  }

  /**
   * Get a specific repository
   */
  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    const { data } = await this.octokit.rest.repos.get({ owner, repo });

    return {
      id: data.id,
      name: data.name,
      full_name: data.full_name,
      private: data.private,
      description: data.description,
      language: data.language,
      default_branch: data.default_branch,
      html_url: data.html_url,
      clone_url: data.clone_url,
      updated_at: data.updated_at ?? "",
      pushed_at: data.pushed_at ?? "",
      stargazers_count: data.stargazers_count,
      open_issues_count: data.open_issues_count,
      owner: {
        login: data.owner.login,
        avatar_url: data.owner.avatar_url,
      },
    };
  }

  /**
   * Create a webhook for a repository
   */
  async createWebhook(
    owner: string,
    repo: string,
    webhookUrl: string,
    secret: string
  ): Promise<number> {
    const { data } = await this.octokit.rest.repos.createWebhook({
      owner,
      repo,
      config: {
        url: webhookUrl,
        content_type: "json",
        secret,
        insecure_ssl: "0",
      },
      events: ["pull_request", "push"],
      active: true,
    });

    return data.id;
  }

  /**
   * Delete a webhook from a repository
   */
  async deleteWebhook(
    owner: string,
    repo: string,
    hookId: number
  ): Promise<void> {
    await this.octokit.rest.repos.deleteWebhook({
      owner,
      repo,
      hook_id: hookId,
    });
  }

  /**
   * Get PR diff as raw text
   */
  async getPRDiff(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<string> {
    const response = await this.octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      {
        owner,
        repo,
        pull_number: prNumber,
        headers: { Accept: "application/vnd.github.v3.diff" },
      }
    );
    return response.data as unknown as string;
  }

  /**
   * Get changed files in a PR
   */
  async getChangedFiles(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ChangedFile[]> {
    const files: ChangedFile[] = [];
    let page = 1;

    while (true) {
      const { data } = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
        page,
      });

      files.push(
        ...data.map((f) => ({
          filename: f.filename,
          status: f.status as ChangedFile["status"],
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
          patch: f.patch,
        }))
      );

      if (data.length < 100) break;
      page++;
    }

    return files;
  }

  /**
   * Get file content from repository
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string> {
    const { data } = await this.octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if ("content" in data && data.encoding === "base64") {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }

    throw new Error("Unable to get file content");
  }

  /**
   * Post a review comment on a PR
   */
  async createReview(
    owner: string,
    repo: string,
    prNumber: number,
    commitId: string,
    body: string,
    event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
    comments?: Array<{ path: string; line: number; body: string }>
  ): Promise<number> {
    const { data } = await this.octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      commit_id: commitId,
      body,
      event,
      comments: comments?.map((c) => ({
        path: c.path,
        line: c.line,
        body: c.body,
        side: "RIGHT" as const,
      })),
    });

    return data.id;
  }

  /**
   * Create a PR review (fetches latest commit automatically)
   */
  async createPrReview(
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
    comments?: Array<{ path: string; line: number; body: string }>
  ): Promise<number> {
    // Get the PR to find the latest commit
    const { data: pr } = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    return this.createReview(
      owner,
      repo,
      prNumber,
      pr.head.sha,
      body,
      event,
      comments
    );
  }

  /**
   * Get PR diff (alias for consistent naming)
   */
  async getPrDiff(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<string> {
    return this.getPRDiff(owner, repo, prNumber);
  }

  /**
   * Post a comment on a PR (not a review)
   */
  async createPrComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string
  ): Promise<number> {
    const { data } = await this.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });

    return data.id;
  }

  /**
   * Get a specific pull request
   */
  async getPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<{
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    user: { login: string };
    base: { ref: string };
    head: { ref: string; sha: string };
    draft: boolean;
    state: string;
    created_at: string;
    updated_at: string;
  }> {
    const { data } = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    return {
      number: data.number,
      title: data.title,
      body: data.body,
      html_url: data.html_url,
      user: { login: data.user?.login || "unknown" },
      base: { ref: data.base.ref },
      head: { ref: data.head.ref, sha: data.head.sha },
      draft: data.draft || false,
      state: data.state,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  /**
   * List pull requests for a repository
   */
  async listPullRequests(
    owner: string,
    repo: string,
    options: { state?: "open" | "closed" | "all"; per_page?: number } = {}
  ): Promise<
    Array<{
      number: number;
      title: string;
      html_url: string;
      user: { login: string };
      draft: boolean;
      state: string;
      created_at: string;
    }>
  > {
    const { data } = await this.octokit.rest.pulls.list({
      owner,
      repo,
      state: options.state || "open",
      per_page: options.per_page || 30,
    });

    return data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      html_url: pr.html_url,
      user: { login: pr.user?.login || "unknown" },
      draft: pr.draft || false,
      state: pr.state,
      created_at: pr.created_at,
    }));
  }
}
