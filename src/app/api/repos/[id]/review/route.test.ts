import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetSession,
  mockRepositoryFindFirst,
  mockPrReviewFindUnique,
  mockPrReviewUpsert,
  mockUserFindUnique,
  mockSchedulePrReview,
  mockGetPullRequest,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRepositoryFindFirst: vi.fn(),
  mockPrReviewFindUnique: vi.fn(),
  mockPrReviewUpsert: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockSchedulePrReview: vi.fn(),
  mockGetPullRequest: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: mockGetSession,
}));

vi.mock("@/lib/db", () => ({
  db: {
    repository: {
      findFirst: mockRepositoryFindFirst,
    },
    prReview: {
      findUnique: mockPrReviewFindUnique,
      upsert: mockPrReviewUpsert,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

vi.mock("@/lib/services/background-orchestrator", () => ({
  schedulePrReview: mockSchedulePrReview,
}));

vi.mock("@/lib/services/github-app", () => ({
  createBotGitHubService: vi.fn().mockResolvedValue({ token: "bot-token" }),
}));

vi.mock("@/lib/auth", () => ({
  getUserAccessToken: vi.fn().mockResolvedValue("user-token"),
}));

vi.mock("@/lib/services/reviewer", () => ({
  reviewPullRequest: vi.fn(),
  postReviewToGitHub: vi.fn(),
}));

vi.mock("@/lib/services/github", () => ({
  GitHubService: vi.fn().mockImplementation(() => ({
    getPullRequest: mockGetPullRequest,
  })),
}));

import { POST } from "@/app/api/repos/[id]/review/route";

describe("manual PR review route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    mockRepositoryFindFirst.mockResolvedValue({
      id: "repo-1",
      userId: "user-1",
      fullName: "owner/repo",
    });
    mockPrReviewFindUnique.mockResolvedValue(null);
    mockPrReviewUpsert.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue({ accessToken: "encrypted-token" });
    mockGetPullRequest.mockResolvedValue({
      number: 7,
      title: "Improve reliability",
      body: "Adds queue safeguards",
      html_url: "https://github.com/owner/repo/pull/7",
      user: { login: "octocat" },
      base: { ref: "main" },
      head: { ref: "feature/reliability", sha: "abcdef1234567890abcdef1234567890abcdef12" },
    });
    mockSchedulePrReview.mockResolvedValue({
      mode: "queue",
      jobId: "review:repo-1:7:abcdef123456",
      message: "PR review queued in background.",
    });
  });

  it("uses queue-first scheduling for manual PR review", async () => {
    const request = new Request("http://localhost/api/repos/repo-1/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prNumber: 7 }),
    });

    const response = await POST(request as never, {
      params: Promise.resolve({ id: "repo-1" }),
    });
    const body = (await response.json()) as { success?: boolean; data?: { mode?: string; jobId?: string } };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data?.mode).toBe("queue");
    expect(body.data?.jobId).toBe("review:repo-1:7:abcdef123456");
    expect(mockSchedulePrReview).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryId: "repo-1",
        prNumber: 7,
        trigger: "manual",
      })
    );
  });
});
