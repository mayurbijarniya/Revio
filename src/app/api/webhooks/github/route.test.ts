import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRepositoryFindFirst, mockPrReviewUpsert, mockScheduleIndexing, mockSchedulePrReview } =
  vi.hoisted(() => ({
    mockRepositoryFindFirst: vi.fn(),
    mockPrReviewUpsert: vi.fn(),
    mockScheduleIndexing: vi.fn(),
    mockSchedulePrReview: vi.fn(),
  }));

vi.mock("@/lib/env", () => ({
  env: {
    GITHUB_APP_WEBHOOK_SECRET: "webhook-secret",
    NODE_ENV: "test",
    BACKGROUND_MODE: "hybrid",
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    repository: {
      findFirst: mockRepositoryFindFirst,
      findUnique: vi.fn(),
    },
    prReview: {
      upsert: mockPrReviewUpsert,
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/background-orchestrator", () => ({
  scheduleIndexing: mockScheduleIndexing,
  schedulePrReview: mockSchedulePrReview,
  markPrReviewFailed: vi.fn(),
}));

vi.mock("@/lib/services/reviewer", () => ({
  reviewPullRequest: vi.fn(),
  postReviewToGitHub: vi.fn(),
}));

vi.mock("@/lib/services/github-app", () => ({
  createBotGitHubService: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn().mockReturnValue("token"),
}));

vi.mock("@/lib/services/bot-conversation", () => ({
  parseBotCommand: vi.fn().mockReturnValue(null),
  getOrCreateConversation: vi.fn(),
  addMessageToConversation: vi.fn(),
  processBotCommand: vi.fn(),
}));

import { POST } from "@/app/api/webhooks/github/route";

function createWebhookRequest(event: string, payload: Record<string, unknown>, delivery = "delivery-1"): Request {
  const body = JSON.stringify(payload);
  const signature = `sha256=${crypto
    .createHmac("sha256", "webhook-secret")
    .update(body)
    .digest("hex")}`;

  return new Request("http://localhost/api/webhooks/github", {
    method: "POST",
    headers: {
      "x-github-event": event,
      "x-github-delivery": delivery,
      "x-hub-signature-256": signature,
      "content-type": "application/json",
    },
    body,
  });
}

const connectedRepository = {
  id: "repo-1",
  userId: "user-1",
  fullName: "owner/repo",
  defaultBranch: "main",
  indexStatus: "indexed",
  autoReview: true,
  user: {
    accessToken: "encrypted-token",
  },
};

describe("github webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepositoryFindFirst.mockResolvedValue(connectedRepository);
    mockPrReviewUpsert.mockResolvedValue({});
    mockScheduleIndexing.mockResolvedValue({
      mode: "queue",
      jobId: "index__repo-1__main__abcdef123456",
      message: "Indexing queued in background.",
    });
    mockSchedulePrReview.mockResolvedValue({
      mode: "queue",
      jobId: "review__repo-1__9__abcdef123456",
      message: "PR review queued in background.",
    });
  });

  it("queues indexing for push to default branch", async () => {
    const request = createWebhookRequest("push", {
      ref: "refs/heads/main",
      after: "abcdef1234567890",
      deleted: false,
      repository: {
        full_name: "owner/repo",
        default_branch: "main",
      },
    });

    const response = await POST(request as never);
    const body = (await response.json()) as { mode?: string; jobId?: string };

    expect(response.status).toBe(200);
    expect(body.mode).toBe("queue");
    expect(body.jobId).toBe("index__repo-1__main__abcdef123456");
    expect(mockScheduleIndexing).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryId: "repo-1",
        trigger: "push",
        deliveryId: "delivery-1",
        headSha: "abcdef1234567890",
      })
    );
  });

  it("ignores pushes that are not on the default branch", async () => {
    const request = createWebhookRequest("push", {
      ref: "refs/heads/feature-x",
      after: "abcdef1234567890",
      deleted: false,
      repository: {
        full_name: "owner/repo",
        default_branch: "main",
      },
    });

    const response = await POST(request as never);
    const body = (await response.json()) as { message?: string };

    expect(response.status).toBe(200);
    expect(body.message).toBe("Push not to default branch");
    expect(mockScheduleIndexing).not.toHaveBeenCalled();
  });

  it("ignores branch deletion push events", async () => {
    const request = createWebhookRequest("push", {
      ref: "refs/heads/main",
      after: "0000000000000000",
      deleted: true,
      repository: {
        full_name: "owner/repo",
        default_branch: "main",
      },
    });

    const response = await POST(request as never);
    const body = (await response.json()) as { message?: string };

    expect(response.status).toBe(200);
    expect(body.message).toBe("Branch deletion push ignored");
    expect(mockScheduleIndexing).not.toHaveBeenCalled();
  });

  it("queues PR review for pull request webhook events", async () => {
    const request = createWebhookRequest("pull_request", {
      action: "opened",
      repository: {
        full_name: "owner/repo",
      },
      pull_request: {
        number: 9,
        title: "Improve parser",
        body: "Adds reliability improvements",
        html_url: "https://github.com/owner/repo/pull/9",
        user: { login: "octocat" },
        draft: false,
        base: { ref: "main" },
        head: { ref: "feature/parser", sha: "abcdef1234567890abcdef1234567890abcdef12" },
      },
    });

    const response = await POST(request as never);
    const body = (await response.json()) as { mode?: string; jobId?: string; pr?: number };

    expect(response.status).toBe(200);
    expect(body.mode).toBe("queue");
    expect(body.pr).toBe(9);
    expect(mockPrReviewUpsert).toHaveBeenCalledOnce();
    expect(mockSchedulePrReview).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryId: "repo-1",
        prNumber: 9,
        trigger: "push",
      })
    );
  });
});
